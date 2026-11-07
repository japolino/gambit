/**
 * Gambit backend entry. Routes frontend messages to the battle sessions and
 * the art pipeline. All model and image calls go through host APIs; the
 * backend cannot fetch (docs/DESIGN.md, 8.1).
 */
import type { SpindleAPI } from "lumiverse-spindle-types";
import { registerArt } from "./art/controller.js";
import { requestBattleArt } from "./backend/battle-art.js";
import { createBattles } from "./backend/battles.js";
import type { ToBackend, ToFrontend } from "./shared/protocol.js";

declare const spindle: SpindleAPI;

const VERSION = "0.1.0";

const send = (msg: ToFrontend, userId?: string) => spindle.sendToFrontend(msg, userId);
// Without image connections the art pipeline reports "placeholder art" and
// the game runs on the stage's procedural figures.
const art = registerArt(spindle, send, { gptConcurrency: 2 });
const battles = createBattles(spindle, send, (state, userId) => requestBattleArt(art, state, userId));
const CAMPAIGN = "default"; // one campaign until the World Bible exists (M4)

spindle.onFrontendMessage(async (raw: unknown, userId: string) => {
  const msg = raw as ToBackend;
  try {
    if (art.handle(msg, userId)) return;
    switch (msg.type) {
      case "hello": {
        await art.setCampaign(CAMPAIGN, userId);
        send({ type: "welcome", version: VERSION, styleLook: art.styleLock(userId)?.lookId ?? null }, userId);
        await battles.resume(userId);
        break;
      }
      case "stage.opened":
        // In the host runtime but not yet in the published types (0.6.79).
        await (spindle as unknown as { ui?: { closeDrawer?(o: { userId: string }): Promise<void> } }).ui?.closeDrawer?.({ userId }).catch(() => {});
        break;
      case "battle.start":
        await battles.start(userId, msg.encounterId, msg.seed);
        break;
      case "battle.act":
        await battles.act(userId, msg.battleId, msg.action);
        break;
    }
  } catch (err) {
    spindle.log.error(`gambit: ${msg?.type}: ${err instanceof Error ? err.stack : String(err)}`);
    send({ type: "notice", level: "error", text: err instanceof Error ? err.message : String(err) }, userId);
  }
});

spindle.log.info(`Gambit ${VERSION} backend ready`);
