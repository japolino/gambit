/**
 * One world-changing action at a time per chat. Each action loads the chat's record, changes it and saves it, so two
 * at once (a double tap on a phone) would both act on the same record and the last save would win. While one runs, a
 * second is dropped: the player's next tap should act on what the first one did, not queue up behind it.
 */
export function createGate(staleMs = 120_000, now: () => number = Date.now) {
  const running = new Map<string, symbol>();
  const startedAt = new Map<symbol, number>();
  return {
    /** Runs `fn` unless one is already running for `key`; says whether it ran. One that hangs stops blocking after `staleMs`. */
    async run(key: string, fn: () => Promise<unknown>): Promise<boolean> {
      const held = running.get(key);
      if (held && now() - startedAt.get(held)! < staleMs) return false;
      const mine = Symbol(key);
      running.set(key, mine);
      startedAt.set(mine, now());
      try {
        await fn();
        return true;
      } finally {
        startedAt.delete(mine);
        if (running.get(key) === mine) running.delete(key);
      }
    },
  };
}
