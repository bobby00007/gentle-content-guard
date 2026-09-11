import { createServerFn } from "@tanstack/react-start";
import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import { z } from "zod";

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
});

export type DetectionResult = z.infer<typeof resultSchema>;

export const analyzeContent = createServerFn({ method: "POST" })
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI analysis is not configured for this project.");

    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: {
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
    });

    const instructions = `You are an expert synthetic-content forensic analyst. Return a careful probabilistic assessment, never a claim of certainty. Score from 0 to 100 where 100 means strongest evidence of AI generation. Provide 3 to 5 concise signals with weights from 0 to 100. For text, split the supplied content into representative sentence-sized segments and score each; preserve their exact text. For images, segments must be an empty array. Avoid identifying a specific person. Keep the summary under 45 words. Do not claim metadata or forensic evidence you cannot inspect.`;

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

    try {
      const result = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        system: instructions,
        messages: prompt,
        output: Output.object({ schema: resultSchema }),
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "medium",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });

      const output = await result.output;
      return {
        ...output,
        score: Math.max(0, Math.min(100, Math.round(output.score))),
        signals: output.signals.slice(0, 5).map((signal) => ({
          ...signal,
          weight: Math.max(0, Math.min(100, Math.round(signal.weight))),
        })),
        segments: output.segments.slice(0, 16).map((segment) => ({
          ...segment,
          score: Math.max(0, Math.min(100, Math.round(segment.score))),
        })),
      } satisfies DetectionResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analysis failed.";
      throw new Error(message);
    }
  });