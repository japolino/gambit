/**
 * One world-changing action at a time per chat. Each action loads the chat's record, changes it and saves it, so two
 * at once (a double tap on a phone) would both act on the same record and the last save would win. While one runs, a
 * second is dropped: the player's next tap should act on what the first one did, not queue up behind it. A written
 * line is not a tap: it waits its turn instead (`queue`).
 */
export function createGate(staleMs = 120_000, now: () => number = Date.now, pollMs = 250) {
  const running = new Map<string, symbol>();
  const startedAt = new Map<symbol, number>();
  const queued = new Map<string, Promise<unknown>>();
  /** Runs `fn` unless one is already running for `key`; says whether it ran. One that hangs stops blocking after `staleMs`. */
  async function run(key: string, fn: () => Promise<unknown>): Promise<boolean> {
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
  }
  /** Runs `fn` once nothing runs for `key`, after whatever was queued for it before. */
  function queue(key: string, fn: () => Promise<unknown>): Promise<void> {
    const turn = (queued.get(key) ?? Promise.resolve()).then(async () => {
      while (!(await run(key, fn))) await new Promise((r) => setTimeout(r, pollMs));
    });
    queued.set(key, turn.catch(() => {}));
    return turn;
  }
  return { run, queue };
}
