import type { UIMessage } from "ai";

/** Audio-in/audio-out chat model, called straight through OpenRouter. */
export const TURN_MODEL = "openai/gpt-audio";
export const TURN_VOICE = "alloy";

export const TURN_INSTRUCTIONS =
  "You are a warm, concise voice assistant. Reply in English, in one or two spoken sentences.";

/** The reply arrives as base64 PCM16 chunks alongside its transcript. */
export type TurnDataParts = { audio: string };

export type TurnUIMessage = UIMessage<never, TurnDataParts>;
