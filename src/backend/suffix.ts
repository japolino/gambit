/**
 * Gambit's notes ride at the very end of a generation's prompt: after the preset's last block and the history, so the
 * prompt before them is the one a normal reply sends and the provider's prompt cache still matches it. A preset's
 * assistant prefill stays last, as the host built it (it must end the prompt to be continued).
 */
import type { LlmMessageDTO } from "lumiverse-spindle-types";

export function withSuffix(messages: readonly LlmMessageDTO[], ...notes: LlmMessageDTO[]): LlmMessageDTO[] {
  let at = messages.length;
  while (at > 0 && messages[at - 1]!.role === "assistant" && (messages[at - 1] as { partial?: boolean }).partial) at--;
  return [...messages.slice(0, at), ...notes, ...messages.slice(at)];
}
