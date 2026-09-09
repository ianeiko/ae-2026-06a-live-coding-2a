import { TURN_INSTRUCTIONS, TURN_MODEL, TURN_VOICE, type TurnUIMessage } from "@/lib/turn-based";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from "ai";

export const maxDuration = 300;

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(req: Request) {
  const { messages }: { messages: TurnUIMessage[] } = await req.json();

  const stream = createUIMessageStream<TurnUIMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "start" });

      const result = streamText({
        model: openrouter(TURN_MODEL, {
          extraBody: {
            modalities: ["text", "audio"],
            audio: { voice: TURN_VOICE, format: "pcm16" },
          },
        }),
        system: TURN_INSTRUCTIONS,
        messages: await convertToModelMessages(messages),
        // The spoken reply only exists on the provider's raw chunks.
        includeRawChunks: true,
      });

      const textId = "reply";
      writer.write({ type: "text-start", id: textId });

      for await (const part of result.fullStream) {
        if (part.type !== "raw") {
          continue;
        }

        const delta = (
          part.rawValue as {
            choices?: {
              delta?: { audio?: { data?: string; transcript?: string } };
            }[];
          }
        ).choices?.[0]?.delta?.audio;

        if (delta?.data) {
          // Transient: the PCM never needs to survive in message history.
          writer.write({ type: "data-audio", data: delta.data, transient: true });
        }

        if (delta?.transcript) {
          writer.write({ type: "text-delta", id: textId, delta: delta.transcript });
        }
      }

      writer.write({ type: "text-end", id: textId });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
