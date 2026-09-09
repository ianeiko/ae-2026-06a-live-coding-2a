"use client";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  MicSelector,
  MicSelectorContent,
  MicSelectorEmpty,
  MicSelectorInput,
  MicSelectorItem,
  MicSelectorLabel,
  MicSelectorList,
  MicSelectorTrigger,
  MicSelectorValue,
} from "@/components/ai-elements/mic-selector";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Persona, type PersonaState } from "@/components/ai-elements/persona";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { pcm16ToAudioBuffer, recordingToWavDataUrl } from "@/lib/audio";
import type { TurnUIMessage } from "@/lib/turn-based";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessagesSquareIcon, MicIcon, SquareIcon } from "lucide-react";
import { type PointerEvent, useCallback, useRef, useState } from "react";

export default function TurnBasedPage() {
  const [deviceId, setDeviceId] = useState<string>();
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string>();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const playbackRef = useRef<AudioContext | null>(null);
  const playheadRef = useRef(0);
  const pendingRef = useRef(0);

  /** Chunks arrive faster than realtime, so queue them on a moving playhead. */
  const playChunk = useCallback((base64: string) => {
    const context = (playbackRef.current ??= new AudioContext());
    const buffer = pcm16ToAudioBuffer(base64, context);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);

    const startAt = Math.max(context.currentTime, playheadRef.current);
    source.start(startAt);
    playheadRef.current = startAt + buffer.duration;

    pendingRef.current += 1;
    setIsPlaying(true);
    source.onended = () => {
      pendingRef.current -= 1;
      if (pendingRef.current === 0) {
        setIsPlaying(false);
      }
    };
  }, []);

  const { messages, sendMessage, status } = useChat<TurnUIMessage>({
    transport: new DefaultChatTransport({ api: "/api/turn-based" }),
    onData: (part) => {
      if (part.type === "data-audio") {
        playChunk(part.data);
      }
    },
    onError: (err) => setError(err.message),
  });

  const startRecording = useCallback(
    async (event: PointerEvent<HTMLButtonElement>) => {
      setError(undefined);
      // Keep the release event even if the pointer leaves the button.
      event.currentTarget.setPointerCapture(event.pointerId);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        });
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = async () => {
          for (const track of stream.getTracks()) {
            track.stop();
          }
          const url = await recordingToWavDataUrl(new Blob(chunks));
          sendMessage({
            files: [
              {
                type: "file",
                mediaType: "audio/wav",
                filename: "speech.wav",
                url,
              },
            ],
          });
        };

        recorder.start();
        recorderRef.current = recorder;
        setIsRecording(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not use the mic.");
      }
    },
    [deviceId, sendMessage]
  );

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);
  }, []);

  const isBusy = status === "submitted" || status === "streaming";

  let personaState: PersonaState = "idle";
  if (isPlaying) {
    personaState = "speaking";
  } else if (isRecording) {
    personaState = "listening";
  } else if (isBusy) {
    personaState = "thinking";
  }

  return (
    <main className="mx-auto flex h-dvh max-w-2xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-semibold text-lg">Turn-based</h1>
        <MicSelector onValueChange={setDeviceId} value={deviceId}>
          <MicSelectorTrigger>
            <MicSelectorValue />
          </MicSelectorTrigger>
          <MicSelectorContent>
            <MicSelectorInput />
            <MicSelectorList>
              {(devices) => (
                <>
                  <MicSelectorEmpty />
                  {devices.map((device) => (
                    <MicSelectorItem
                      key={device.deviceId}
                      value={device.deviceId}
                    >
                      <MicSelectorLabel device={device} />
                    </MicSelectorItem>
                  ))}
                </>
              )}
            </MicSelectorList>
          </MicSelectorContent>
        </MicSelector>
      </div>

      <Persona className="mx-auto size-40" state={personaState} variant="opal" />

      <Conversation className="min-h-0 flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              description="Hold the mic to speak, or type. One turn at a time — it answers out loud."
              icon={<MessagesSquareIcon className="size-6" />}
              title="Push to talk"
            />
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, index) => {
                    if (part.type === "text") {
                      return (
                        <MessageResponse key={index}>
                          {part.text}
                        </MessageResponse>
                      );
                    }
                    if (part.type === "file") {
                      return <span key={index}>Spoke a message</span>;
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <PromptInput
        onSubmit={(message) => {
          if (message.text.trim()) {
            sendMessage({ text: message.text });
          }
        }}
      >
        <PromptInputBody>
          <PromptInputTextarea placeholder="Type, or hold the mic to speak" />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <PromptInputButton
              onPointerCancel={stopRecording}
              onPointerDown={startRecording}
              onPointerUp={stopRecording}
              variant={isRecording ? "default" : "ghost"}
            >
              {isRecording ? (
                <SquareIcon className="size-4" />
              ) : (
                <MicIcon className="size-4" />
              )}
              {isRecording ? "Release to send" : "Hold to talk"}
            </PromptInputButton>
          </PromptInputTools>
          <PromptInputSubmit status={status} />
        </PromptInputFooter>
      </PromptInput>
    </main>
  );
}
