import { VOICE_MODEL } from "@/lib/voice";
import { gateway } from "ai";

/**
 * Mints a short-lived client secret. The Gateway API key never leaves the
 * server; the browser connects to the returned url with the returned token.
 */
export async function POST() {
  const setup = await gateway.experimental_realtime.getToken({
    model: VOICE_MODEL,
  });

  return Response.json(setup);
}
