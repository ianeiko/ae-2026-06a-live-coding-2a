import type { Experimental_RealtimeSessionConfig } from "ai";

/** Bidirectional audio model, served through the Vercel AI Gateway. */
export const VOICE_MODEL = "openai/gpt-realtime-2.1";

export const VOICE_SESSION: Partial<Experimental_RealtimeSessionConfig> = {
  voice: "marin",
  instructions:
    "You are a warm, concise voice assistant. Keep replies to one or two spoken sentences.",
  outputModalities: ["audio"],
  // Transcribe both sides so the conversation stays readable on screen.
  inputAudioTranscription: { model: "whisper-1" },
  outputAudioTranscription: { model: "whisper-1" },
  // The model decides when you have finished a thought; no push-to-talk.
  turnDetection: { type: "semantic-vad" },
};
