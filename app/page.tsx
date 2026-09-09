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
import { Button } from "@/components/ui/button";
import { VOICE_MODEL, VOICE_SESSION } from "@/lib/voice";
import { experimental_useRealtime } from "@ai-sdk/react";
import { gateway } from "ai";
import { AudioLinesIcon, Loader2Icon, PhoneIcon, PhoneOffIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";

export default function VoicePage() {
  const [deviceId, setDeviceId] = useState<string>();
  const [error, setError] = useState<string>();
  const streamRef = useRef<MediaStream | null>(null);

  // The browser only ever holds the short-lived token from /api/realtime/setup.
  const model = useMemo(
    () => gateway.experimental_realtime(VOICE_MODEL),
    []
  );

  const {
    status,
    messages,
    isCapturing,
    isPlaying,
    connect,
    disconnect,
    startAudioCapture,
    stopAudioCapture,
  } = experimental_useRealtime({
    model,
    api: { token: "/api/realtime/setup" },
    sessionConfig: VOICE_SESSION,
    onError: (err) => setError(err.message),
  });

  // Plain functions: the React Compiler memoizes these, and manual useCallback
  // around the hook's own methods trips its memoization check.
  const releaseMic = () => {
    stopAudioCapture();
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;
  };

  const start = async () => {
    setError(undefined);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      streamRef.current = stream;

      await connect();
      startAudioCapture(stream);
    } catch (err) {
      releaseMic();
      setError(err instanceof Error ? err.message : "Could not start the call.");
    }
  };

  const stop = () => {
    releaseMic();
    disconnect();
  };

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  let personaState: PersonaState = "asleep";
  if (isPlaying) {
    personaState = "speaking";
  } else if (isCapturing) {
    personaState = "listening";
  } else if (isConnected) {
    personaState = "idle";
  }

  return (
    <main className="mx-auto flex h-dvh max-w-2xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-semibold text-lg">Voice</h1>
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
                    <MicSelectorItem key={device.deviceId} value={device.deviceId}>
                      <MicSelectorLabel device={device} />
                    </MicSelectorItem>
                  ))}
                </>
              )}
            </MicSelectorList>
          </MicSelectorContent>
        </MicSelector>
      </div>

      <Persona className="mx-auto size-48" state={personaState} variant="halo" />

      <Conversation className="min-h-0 flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              description="Start the call and just talk — it listens and answers on its own."
              icon={<AudioLinesIcon className="size-6" />}
              title="Talk to the assistant"
            />
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, index) =>
                    part.type === "text" ? (
                      <MessageResponse key={index}>{part.text}</MessageResponse>
                    ) : null
                  )}
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

      <Button
        className="mx-auto h-14 w-full max-w-xs gap-2 rounded-full"
        disabled={isConnecting}
        onClick={isConnected ? stop : start}
        size="lg"
        variant={isConnected ? "destructive" : "default"}
      >
        {isConnecting ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : isConnected ? (
          <PhoneOffIcon className="size-4" />
        ) : (
          <PhoneIcon className="size-4" />
        )}
        {isConnecting ? "Connecting" : isConnected ? "End call" : "Start call"}
      </Button>
    </main>
  );
}
