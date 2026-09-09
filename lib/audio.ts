/** gpt-audio listens and speaks at 24 kHz mono PCM16. */
export const AUDIO_SAMPLE_RATE = 24_000;

function encodeWav(samples: Int16Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.byteLength);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  text(0, "RIFF");
  view.setUint32(4, 36 + samples.byteLength, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  view.setUint32(40, samples.byteLength, true);
  new Int16Array(buffer, 44).set(samples);

  return buffer;
}

/**
 * MediaRecorder hands back webm/opus, which the model will not accept. Decode
 * it and re-encode as the mono 24 kHz WAV data URL a file part can carry.
 */
export async function recordingToWavDataUrl(blob: Blob): Promise<string> {
  const decodeContext = new AudioContext();
  const decoded = await decodeContext.decodeAudioData(await blob.arrayBuffer());
  await decodeContext.close();

  const frames = Math.ceil(decoded.duration * AUDIO_SAMPLE_RATE);
  const offline = new OfflineAudioContext(1, frames, AUDIO_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const mono = (await offline.startRendering()).getChannelData(0);

  const samples = new Int16Array(mono.length);
  for (let i = 0; i < mono.length; i++) {
    const clamped = Math.max(-1, Math.min(1, mono[i]));
    samples[i] = clamped * 0x7f_ff;
  }

  const bytes = new Uint8Array(encodeWav(samples, AUDIO_SAMPLE_RATE));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return `data:audio/wav;base64,${btoa(binary)}`;
}

/** Turn one base64 PCM16 chunk from the model into a playable buffer. */
export function pcm16ToAudioBuffer(
  base64: string,
  context: AudioContext
): AudioBuffer {
  const binary = atob(base64);
  const samples = new Int16Array(binary.length / 2);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8);
  }

  const buffer = context.createBuffer(1, samples.length, AUDIO_SAMPLE_RATE);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    channel[i] = samples[i] / 0x80_00;
  }

  return buffer;
}
