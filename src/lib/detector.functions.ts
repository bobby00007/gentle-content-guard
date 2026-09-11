import { createServerFn } from "@tanstack/react-start";
import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import { z } from "zod";
import { calculateLinguisticMetrics } from "./detector.heuristics";

const textInputSchema = z.object({
  kind: z.literal("text"),
  content: z.string().min(40).max(12000),
  claimContext: z.string().optional(),
});

const imageInputSchema = z.object({
  kind: z.literal("image"),
  dataUrl: z.string().max(9_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  fileName: z.string().optional(),
  presetId: z.string().optional(),
});

const videoFrameSchema = z.object({
  dataUrl: z.string().startsWith("data:image/").max(2_000_000),
  timestampSec: z.number().min(0).max(86_400),
});

const videoInputSchema = z.object({
  kind: z.literal("video"),
  videoUrl: z.string().optional(),
  fileName: z.string().optional(),
  presetId: z.string().optional(),
  durationSec: z.number().optional(),
  frames: z.array(videoFrameSchema).max(8).optional(),
});

const inputSchema = z.discriminatedUnion("kind", [
  textInputSchema,
  imageInputSchema,
  videoInputSchema,
]);

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
  mediaType: z.enum(["text", "image", "video"]).optional(),
  scamCategory: z.string().optional(),
  familyAdvice: z.string().optional(),
  rebuttal: z
    .object({
      politeText: z.string(),
      urgentText: z.string(),
      familyElderExplanation: z.string(),
      keyPoints: z.array(z.string()),
    })
    .optional(),
  videoTimeline: z
    .array(
      z.object({
        timestampSec: z.number(),
        label: z.string(),
        riskScore: z.number(),
        flag: z.string().optional(),
      }),
    )
    .optional(),
  elaScore: z.number().optional(),
});

export type DetectionResult = z.infer<typeof resultSchema>;
export type WhatsAppRebuttal = NonNullable<DetectionResult["rebuttal"]>;
export type VideoTimelineFrame = NonNullable<DetectionResult["videoTimeline"]>[number];
export type AnalyzeContentInput = z.infer<typeof inputSchema>;

export const analyzeContent = createServerFn({ method: "POST" })
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const hasRealInput =
      data.kind === "text" ||
      (data.kind === "image" && data.dataUrl.length > 0) ||
      (data.kind === "video" && (data.frames?.length ?? 0) > 0);

    if (data.kind !== "text" && !hasRealInput) {
      throw new Error(
        "Preset cards are examples only. Upload the actual image or video you want analyzed.",
      );
    }

    const lovableApiKey = process.env["LOVABLE_API_KEY"];
    const openAiApiKey = process.env["OPENAI_API_KEY"];

    // Real uploads must never silently receive a canned result when the AI
    // backend is unavailable.
    if (!lovableApiKey && !openAiApiKey) {
      throw new Error(
        "AI analysis is not configured. Add OPENAI_API_KEY or LOVABLE_API_KEY to the Netlify production environment.",
      );
    }

    const provider = lovableApiKey
      ? createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey: lovableApiKey,
          headers: {
            "Lovable-API-Key": lovableApiKey,
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
          },
        })
      : createOpenAI({ apiKey: openAiApiKey! });
    const modelName = lovableApiKey
      ? process.env["LOVABLE_MODEL"] || "openai/gpt-6-astra"
      : process.env["OPENAI_MODEL"] || "gpt-4o-mini";

    const instructions = `You are a senior synthetic-content forensic analyst specializing in verifying misinformation and deepfakes shared in family messaging groups (WhatsApp, Telegram). Return a careful, calibrated probabilistic assessment — never a claim of certainty.

SCORING RUBRIC (0 = certainly human, 100 = certainly AI):
0-19  Strong human markers: idiosyncratic voice, uneven rhythm, typos, lived specifics, opinionated asides, unusual word choice.
20-39 Mostly human; some polish or editing assistance possible.
40-59 Genuinely ambiguous. Use this band often — short, generic, or heavily edited content usually belongs here.
60-79 Multiple independent AI markers agree, but a competent professional writer could plausibly produce this.
80-100 Dense convergence of AI markers with no counter-evidence.

OUTPUT: Always return every required field in the schema. Return 3 to 5 concise signals with weights 0-100 reflecting each signal's actual contribution. For text, split the content into representative sentence-sized segments and score each. For images, do not claim Error Level Analysis, sensor noise, eye reflections, or other pixel-level evidence unless it is genuinely observable from the supplied image. For video, only supplied frames are available: do not claim audio, lip-sync, blink cadence, or frame-to-frame behavior that the frames cannot establish. If evidence is insufficient, use an Uncertain verdict, Low confidence, and explain the limitation. Never identify a specific person. Keep summary under 45 words. Write the family advice and rebuttal for this specific input, not from a preset template.`;

    const prompt =
      data.kind === "text"
        ? [
            {
              role: "user" as const,
              content: `Analyze this writing/WhatsApp forward for signals of AI generation and misinformation.\n\n${data.content}${data.claimContext ? `\n\nContext supplied by the user: ${data.claimContext}` : ""}`,
            },
          ]
        : data.kind === "image"
          ? [
              {
                role: "user" as const,
                content: [
                  {
                    type: "text" as const,
                    text: "Analyze this supplied image for evidence of AI generation, editing, or manipulation. Separate observable visual evidence from uncertainty.",
                  },
                  { type: "image" as const, image: data.dataUrl, mediaType: data.mimeType },
                ],
              },
            ]
          : [
              {
                role: "user" as const,
                content: [
                  {
                    type: "text" as const,
                    text: `Analyze these ${data.frames?.length ?? 0} sampled frames from the supplied video. The timestamp for each frame is included below. Assess only visual evidence present in the frames; explicitly state that audio and unseen frames were not analyzed.\n\n${(data.frames ?? [])
                      .map((frame, index) => `Frame ${index + 1}: ${frame.timestampSec.toFixed(1)} seconds`)
                      .join("\n")}`,
                  },
                  ...(data.frames ?? []).map((frame) => ({
                    type: "image" as const,
                    image: frame.dataUrl,
                    mediaType: "image/jpeg" as const,
                  })),
                ],
              },
            ];

    const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

    const runPass = async (temperature: number) => {
      const pass = streamText({
        model: provider.responses(modelName),
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
        mediaType: data.kind,
      } satisfies DetectionResult;
    } catch (error) {
      console.error("AI analysis failed:", error);
      throw new Error(
        "The AI analysis service could not analyze this input. Check the provider key and model configuration, then try again.",
      );
    }
  });
