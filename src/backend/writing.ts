/**
 * Asking a model to write something the player is waiting for: a rate limit is tried again after a
 * moment, and then the helper's connection is asked. Returns what was written, empty when nobody could.
 */
import type { Models } from "./models.js";

/** A provider saying "not right now": worth another try in a moment. */
export const isRateLimit = (err: unknown) => /\b429\b|\b503\b|rate.?limit|resource.?exhausted|overloaded|too many requests/i.test(err instanceof Error ? err.message : String(err));

type Request = Parameters<Models["stream"]>[2];

export async function writeWithRetry(
  models: Models,
  userId: string,
  request: () => Request,
  onText: (text: string) => void,
  { retryMs, log, usable = (t) => !!t.trim() }: { retryMs: readonly number[]; log: (m: string) => void; usable?: (text: string) => boolean },
): Promise<string> {
  let text = "";
  const ask = (role: "narrator" | "helper") =>
    models.stream(userId, role, request(), (t) => {
      text = t;
      onText(t);
    });
  const why = (err: unknown) => (err instanceof Error ? err.message.slice(0, 160) : String(err));
  for (let tries = 0; !usable(text); tries++) {
    try {
      text = await ask("narrator");
      break;
    } catch (err) {
      // Half a reply from a stream that broke or was cut off is not a reply.
      text = "";
      log(`narrator failed (${why(err)})`);
      const wait = isRateLimit(err) ? retryMs[tries] : undefined;
      if (wait === undefined) break;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  if (!usable(text)) {
    try {
      text = await ask("helper");
    } catch (err) {
      text = "";
      log(`helper couldn't narrate either (${why(err)})`);
    }
  }
  return usable(text) ? text : "";
}
