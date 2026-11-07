/**
 * Gambit backend entry. Routes frontend messages to the battle sessions and
 * the art pipeline. All model and image calls go through host APIs; the
 * backend cannot fetch (docs/DESIGN.md, 8.1).
 */
import type { SpindleAPI } from "lumiverse-spindle-types";
import { registerArt } from "./art/controller.js";
import { requestBattleArt } from "./backend/battle-art.js";
import { createBattles } from "./backend/battles.js";
import { createParleys } from "./backend/parleys.js";
import type { ToBackend, ToFrontend } from "./shared/protocol.js";

declare const spindle: SpindleAPI;

const VERSION = "0.2.0";

const send = (msg: ToFrontend, userId?: string) => spindle.sendToFrontend(msg, userId);
// Without image connections the art pipeline reports "placeholder art" and
// the game runs on the stage's procedural figures.
const art = registerArt(spindle, send, { gptConcurrency: 2 });
const battles = createBattles(spindle, send, (state, userId) => requestBattleArt(art, state, userId));
const parleys = createParleys(spindle, (msg, userId) => send(msg, userId), art);
const CAMPAIGN = "default"; // one campaign until the World Bible exists (M4)

// Prompt pipeline: Parley outcomes are decided before the narrator writes (docs/DESIGN.md 8.3).
spindle.registerInterceptor((messages, ctx) => parleys.intercept(messages, ctx), 50);

spindle.on("GENERATION_STARTED", (p) => parleys.onGenerationStarted(p.chatId));
spindle.on("STREAM_TOKEN_RECEIVED", (p, userId) => parleys.onStreamToken(p.chatId, p.token, p.type === "reasoning", userId));
spindle.on("GENERATION_ENDED", (p, userId) => parleys.onGenerationEnded(p.chatId, p.content, userId));
spindle.on("MESSAGE_DELETED", (p, userId) => {
  const x = p as { chatId?: string; messageId?: string };
  if (x.chatId && x.messageId && userId) void parleys.onMessageDeleted(x.chatId, x.messageId, userId).catch((e) => spindle.log.error(`gambit parley delete: ${String(e)}`));
});
spindle.on("MESSAGE_EDITED", (p, userId) => {
  const x = p as { chatId?: string; message?: { id?: string; content?: string } };
  if (x.chatId && x.message?.id && typeof x.message.content === "string" && userId) {
    void parleys.onMessageEdited(x.chatId, x.message.id, x.message.content, userId).catch((e) => spindle.log.error(`gambit parley edit: ${String(e)}`));
  }
});

spindle.onFrontendMessage(async (raw: unknown, userId: string) => {
  const msg = raw as ToBackend;
  try {
    if (art.handle(msg, userId)) return;
    switch (msg.type) {
      case "hello": {
        await art.setCampaign(CAMPAIGN, userId);
        send({ type: "welcome", version: VERSION, styleLook: art.styleLock(userId)?.lookId ?? null }, userId);
        await battles.resume(userId);
        await parleys.resume(userId);
        break;
      }
      case "parley.start":
        await parleys.start(userId, msg.scenarioId, msg.chatId);
        break;
      case "parley.say":
        await parleys.say(userId, msg.parleyId, msg.text);
        break;
      case "parley.close":
        await parleys.close(userId, msg.parleyId, msg.how);
        break;
      case "parley.view":
        await parleys.setView(userId, msg.mode);
        break;
      case "parley.narrator":
        await parleys.setNarrator(userId, msg.mode);
        break;
      case "journal.reset":
        await parleys.resetJournal(userId);
        break;
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
