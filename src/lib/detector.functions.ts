import { createServerFn } from "@tanstack/react-start";
import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import { z } from "zod";
import {
  analyzeImageHeuristically,
  analyzeTextHeuristically,
  calculateLinguisticMetrics,
} from "./detector.heuristics";

const textInputSchema = z.object({
  kind: z.literal("text"),
  content: z.string().min(80).max(12000),
});

const imageInputSchema = z.object({
  kind: z.literal("image"),
  dataUrl: z.string().max(9_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

const inputSchema = z.discriminatedUnion("kind", [textInputSchema, imageInputSchema]);

const resultSchema = z.object({
  score: z.number(),
  verdict: z.enum(["Likely AI-generated", "Uncertain", "Likely human-made"]),
  confidence: z.enum(["High", "Moderate", "Low"]),
  summary: z.string(),
  signals: z.array(
    z.object({
      label: z.string(),
      weight: z.number(),
      detail: z.string(),
    }),
  ),
  segments: z.array(
    z.object({
      text: z.string(),
      score: z.number(),
    }),
  ),
  metrics: z
    .object({
      perplexity: z.number(),
      burstiness: z.number(),
      repetition: z.number(),
    })
    .optional(),
});

export type DetectionResult = z.infer<typeof resultSchema>;

export const analyzeContent = createServerFn({ method: "POST" })
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      // Graceful offline / heuristic analysis when AI gateway API key is not configured
      if (data.kind === "text") {
        return analyzeTextHeuristically(data.content);
      }
      return analyzeImageHeuristically(data.dataUrl, data.mimeType);
    }

    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: {
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
    });

    const instructions = `You are a senior synthetic-content forensic analyst. Return a careful, calibrated probabilistic assessment — never a claim of certainty.

SCORING RUBRIC (0 = certainly human, 100 = certainly AI):
0-19  Strong human markers: idiosyncratic voice, uneven rhythm, typos, lived specifics, opinionated asides, unusual word choice.
20-39 Mostly human; some polish or editing assistance possible.
40-59 Genuinely ambiguous. Use this band often — short, generic, or heavily edited content usually belongs here.
60-79 Multiple independent AI markers agree, but a competent professional writer could plausibly produce this.
80-100 Dense convergence of AI markers with no counter-evidence.

CALIBRATION EXAMPLES (patterns learned from large labelled corpora):
- "Moreover, it is important to note that businesses must carefully balance innovation with responsibility." -> ~88. Connective scaffolding, hedged abstraction, zero concrete referents, uniform clause length.
- "In today's fast-paced digital landscape, organizations are increasingly leveraging cutting-edge solutions." -> ~92. Template opener, stacked stock modifiers.
- "we tried the new build friday and honestly it broke twice before lunch — jamie's fix held though" -> ~6. Casing drift, named specifics, temporal anchoring, informal punctuation.
- "The study found a 3.2% decline across the 1,184 sampled households between March and June." -> ~35. Formal but concrete and verifiable; formality alone is NOT an AI marker.
- Technical documentation or academic abstracts: subtract weight for domain-required formality; judge on burstiness and specificity instead.
- Images: check lighting/shadow consistency, hand and tooth anatomy, background text legibility, hair-to-skin edges, texture repetition, unnaturally even bokeh, physically impossible reflections. Compression noise or low resolution is NOT evidence either way.

METHOD:
1. List candidate evidence for AI and for human origin before deciding.
2. Weigh counter-evidence explicitly; a single marker never justifies a score above 70.
3. Penalise confidence when the sample is short (<60 words), quoted, translated, or domain-constrained.
4. Confidence: High only with several independent converging markers and ample content; Low for short or conflicting evidence.

OUTPUT: 3 to 5 concise signals with weights 0-100 reflecting each signal's actual contribution. For text, split the content into representative sentence-sized segments and score each, preserving their exact text. For images, segments must be an empty array. Never identify a specific person. Keep the summary under 45 words. Never claim metadata or forensic evidence you cannot inspect.`;

    const prompt =
      data.kind === "text"
        ? [
            {
              role: "user" as const,
              content: `Analyze this writing for signals of AI generation:\n\n${data.content}`,
            },
          ]
        : [
            {
              role: "user" as const,
              content: [
                { type: "text" as const, text: "Analyze this image for signals of AI generation." },
                { type: "image" as const, image: data.dataUrl, mediaType: data.mimeType },
              ],
            },
          ];

    const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

    const runPass = async (temperature: number) => {
      const pass = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        system: instructions,
        messages: prompt,
        temperature,
        output: Output.object({ schema: resultSchema }),
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "high",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      return await pass.output;
    };

    try {
      // Two independent passes are averaged; their agreement calibrates confidence.
      const passes = await Promise.allSettled([runPass(0.1), runPass(0.6)]);
      const outputs = passes
        .filter(
          (pass): pass is PromiseFulfilledResult<z.infer<typeof resultSchema>> =>
            pass.status === "fulfilled",
        )
        .map((pass) => pass.value);

      if (outputs.length === 0) {
        const failure = passes[0];
        throw failure && failure.status === "rejected" && failure.reason instanceof Error
          ? failure.reason
          : new Error("Analysis failed.");
      }

      const primary = outputs[0]!;
      const score = clamp(outputs.reduce((total, item) => total + item.score, 0) / outputs.length);
      const spread = outputs.length > 1 ? Math.abs(outputs[0]!.score - outputs[1]!.score) : 100;
      const ambiguous = score >= 40 && score <= 60;
      const confidence: DetectionResult["confidence"] =
        spread <= 10 && !ambiguous ? "High" : spread <= 25 ? "Moderate" : "Low";
      const verdict: DetectionResult["verdict"] =
        score >= 65 ? "Likely AI-generated" : score <= 35 ? "Likely human-made" : "Uncertain";

      const metrics = data.kind === "text" ? calculateLinguisticMetrics(data.content) : undefined;

      return {
        ...primary,
        score,
        verdict,
        confidence,
        signals: primary.signals.slice(0, 5).map((signal) => ({
          ...signal,
          weight: clamp(signal.weight),
        })),
        segments: primary.segments.slice(0, 16).map((segment) => ({
          ...segment,
          score: clamp(segment.score),
        })),
        ...(metrics ? { metrics } : {}),
      } satisfies DetectionResult;
    } catch (error) {
      console.warn("AI gateway analysis failed; falling back to forensic heuristics:", error);
      if (data.kind === "text") {
        return analyzeTextHeuristically(data.content);
      }
      return analyzeImageHeuristically(data.dataUrl, data.mimeType);
    }
  });
