/**
 * Gambit backend entry. Routes frontend messages to the battle sessions and
 * the art pipeline. All model and image calls go through host APIs; the
 * backend cannot fetch (docs/DESIGN.md, 8.1).
 */
import type { SpindleAPI } from "lumiverse-spindle-types";
import { registerArt } from "./art/controller.js";
import { requestBattleArt } from "./backend/battle-art.js";
import { createBattles } from "./backend/battles.js";
import { createCards } from "./backend/cards.js";
import { createFxAssets } from "./backend/fx-assets.js";
import { createGate } from "./backend/gate.js";
import { sharedInlayPictures } from "./backend/inlay-pictures.js";
import { modelsFor } from "./backend/models.js";
import { createNotes } from "./backend/notes.js";
import { createParleys } from "./backend/parleys.js";
import { createPlay } from "./backend/play.js";
import type { ToBackend, ToFrontend } from "./shared/protocol.js";

declare const spindle: SpindleAPI;

const VERSION = "0.8.0";

const send = (msg: ToFrontend, userId?: string) => spindle.sendToFrontend(msg, userId);
// Without image connections the art pipeline reports "placeholder art" and
// the game runs on the stage's procedural figures.
const art = registerArt(spindle, send, { gptConcurrency: 2 });
let play: ReturnType<typeof createPlay> | null = null;
// Cut-ins of fights in a chat are drawn by Inlay Illustrator when it is there (backend/inlay-pictures.ts).
const cutinPictures = { inlay: sharedInlayPictures(spindle, (m) => spindle.log.info(`gambit ${m}`)), send: (msg: ToFrontend, userId: string) => send(msg, userId) };
// Inlay draws in the look picked in the drawer, as Gambit's own art does.
cutinPictures.inlay.useStyle((userId) => art.inlayStyle(userId));
const battles = createBattles(
  spindle,
  send,
  (state, userId) => requestBattleArt(art, state, userId, cutinPictures),
  (state, userId) => void play?.onBattleEnd(state, userId).catch((e) => spindle.log.error(`gambit play end: ${String(e)}`)),
);
const fxAssets = createFxAssets(spindle, (msg, userId) => send(msg, userId), (m) => spindle.log.warn(`gambit ${m}`));
const notes = createNotes(spindle);
const parleys = createParleys(spindle, (msg, userId) => send(msg, userId), art);
const cards = createCards(spindle, (msg, userId) => send(msg, userId), parleys);
cutinPictures.inlay.useAdult((userId, chatId) => cards.adultOn(userId, chatId));
play = createPlay(spindle, (msg, userId) => send(msg, userId), art, cards, battles, { pictures: cutinPictures.inlay });
// New places come from play (4.5): the reply detector asks where the scene went.
cards.setPlaceHook({
  where: (u, c) => play!.where(u, c),
  moved: (u, c, pick, p, lines) => play!.moved(u, c, pick, p, lines),
  settled: (u, c, now) => play!.settled(u, c, now),
  notice: (u, c, lines) => play!.notice(u, c, lines),
  extraCast: (u, c) => play!.extraCast(u, c),
  standing: (u, c, id) => play!.standing(u, c, id),
});
// Memory (4.6): Parley outcomes become deeds; the narrator hears what people here remember.
parleys.setEndHook((u, scenario, state) => void play!.onParleyEnd(u, scenario, state).catch((e) => spindle.log.error(`gambit deeds: ${String(e)}`)));
// A talk's replies are part of the story: a fact they let slip is known on the sheet, and so in the talk.
parleys.setStoryHook({
  heard: (u, c, lines) => play!.notice(u, c, lines),
  known: async (u, c) => ((await cards.sheetFor(u, c))?.facts ?? []).filter((f) => f.known).map((f) => f.id),
  theme: (u, c) => play!.themeOf(u, c),
});
/** World-changing actions run one at a time per chat. */
const acting = createGate();
const CAMPAIGN = "default"; // one campaign until the World Bible exists (M4)

// Prompt pipeline: Parley outcomes are decided before the narrator writes (docs/DESIGN.md 8.3).
// One interceptor per extension: a second registration replaces the first, so the Parley's and play's run as one.
spindle.registerInterceptor(async (messages, ctx) => {
  const parley = await parleys.intercept(messages, ctx);
  const after = Array.isArray(parley) ? parley : parley.messages;
  // Play's notes go after the Parley's (both before a preset's prefill), so the Parley's breakdown index still holds.
  const all = await play!.intercept(after, ctx);
  return Array.isArray(parley) ? all : { ...parley, messages: all };
}, 50);

spindle.on("GENERATION_STARTED", (p) => parleys.onGenerationStarted(p.chatId));
spindle.on("STREAM_TOKEN_RECEIVED", (p, userId) => {
  parleys.onStreamToken(p.chatId, p.token, p.type === "reasoning", userId);
  // A story beat the chat is writing under its own preset shows on the page as it comes.
  play?.onStreamToken(p.chatId, p.token, p.type === "reasoning");
});
spindle.on("GENERATION_ENDED", (p, userId) => {
  // Order matters: the contest detector must see whether this reply was a Parley narration.
  const wasParley = parleys.awaitingIn(p.chatId);
  void parleys.onGenerationEnded(p.chatId, p.content, userId).catch((e) => spindle.log.error(`gambit narration: ${String(e)}`));
  // An adult scene's reply is read page by page; it never sets up a contest.
  void play!
    .onGenerationEnded(p.chatId, p.error ? "" : p.content, p.messageId, p.error)
    .then((wasScene) => {
      if (userId && !wasParley && !wasScene && !p.error) return cards.afterReply(userId, p.chatId, p.messageId, p.generationType);
    })
    .catch((e) => spindle.log.error(`gambit chip: ${String(e)}`));
});
// The player pressed stop: an ending too, or a Parley waiting on this reply never gets its input back.
spindle.on("GENERATION_STOPPED", (p, userId) => {
  void parleys.onGenerationEnded(p.chatId, p.content, userId).catch((e) => spindle.log.error(`gambit narration: ${String(e)}`));
  void play!.onGenerationEnded(p.chatId, p.content).catch((e) => spindle.log.error(`gambit scene: ${String(e)}`));
});
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
      case "fx.get":
        await fxAssets.serve(userId);
        return;
      case "hello": {
        await art.setCampaign(CAMPAIGN, userId);
        // The drawer shows who writes the replies from the start, not only once a talk has opened.
        const prefs = await spindle.userStorage.getJson<{ parleyNarrator?: "gambit" | "chat" }>("settings.json", { fallback: {}, userId }).catch(() => ({}) as { parleyNarrator?: "gambit" | "chat" });
        send({ type: "welcome", version: VERSION, styleLook: art.styleLock(userId)?.lookId ?? null, ui: art.lookUi(userId), storyNarrator: await play!.storyNarrator(userId), parleyNarrator: prefs.parleyNarrator ?? "gambit" }, userId);
        break;
      }
      case "resume":
        await battles.resume(userId, msg.chatId);
        await parleys.resume(userId, msg.chatId);
        break;
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
      case "story.narrator":
        await play!.setStoryNarrator(userId, msg.mode);
        break;
      case "card.status":
        await cards.status(userId, msg.chatId);
        break;
      case "card.enable":
        await cards.enable(userId, msg.chatId, msg.on);
        break;
      case "card.read":
        await cards.reread(userId, msg.chatId);
        break;
      case "card.edit":
        await cards.edit(userId, msg.chatId, msg.social, msg.modules);
        break;
      case "card.talk":
        await cards.talk(userId, msg.chatId, msg.castId, msg.kind, msg.chipId);
        break;
      case "card.demo":
        await cards.installDemo(userId);
        break;
      case "card.chips":
        await cards.setChips(userId, msg.chatId, msg.on);
        break;
      case "card.adult":
        await cards.setAdult(userId, msg.chatId, msg.on);
        break;
      case "notes.get":
        send({ type: "notes.state", state: await notes.state(userId) }, userId);
        break;
      case "notes.set":
        await notes.set(userId, msg.id, msg.text);
        send({ type: "notes.state", state: await notes.state(userId) }, userId);
        break;
      case "models.get":
        send({ type: "models.state", state: await modelsFor(spindle).state(userId) }, userId);
        break;
      case "models.set":
        send({ type: "models.state", state: await modelsFor(spindle).update(userId, msg.patch) }, userId);
        break;
      case "journal.reset":
        await parleys.resetJournal(userId, msg.chatId);
        break;
      case "stage.opened":
        // In the host runtime but not yet in the published types (0.6.79).
        await (spindle as unknown as { ui?: { closeDrawer?(o: { userId: string }): Promise<void> } }).ui?.closeDrawer?.({ userId }).catch(() => {});
        break;
      case "music.want":
        await play!.music(userId, msg.chatId, msg.moment, msg.about);
        break;
      case "scene.open":
        await play!.open(userId, msg.chatId);
        // The chat may have gone on without the scene: it catches up in the background.
        void cards.readScene(userId, msg.chatId).catch((err) => spindle.log.warn(`gambit: scene read failed: ${String(err).slice(0, 160)}`));
        break;
      case "scene.act":
        await acting.run(`${userId}:${msg.chatId}`, () => play!.act(userId, msg.chatId, msg.hotspot));
        break;
      case "scene.say":
        // A line written while something else plays out (a walk into the night) is played after it, not lost.
        await acting.queue(`${userId}:${msg.chatId}`, () => play!.say(userId, msg.chatId, msg.text));
        break;
      case "scene.theme":
        await play!.setTheme(userId, msg.chatId, msg.theme);
        break;
      case "delve.step":
        await acting.run(`${userId}:${msg.chatId}`, () => play!.step(userId, msg.chatId, msg.move));
        break;
      case "delve.leave":
        await acting.run(`${userId}:${msg.chatId}`, () => play!.leave(userId, msg.chatId));
        break;
      case "hex.step":
        await acting.run(`${userId}:${msg.chatId}`, () => play!.hexStep(userId, msg.chatId, msg.q, msg.r));
        break;
      case "board.act":
        await acting.run(`${userId}:${msg.chatId}`, () => play!.boardAct(userId, msg.chatId, msg.op, msg.cell, msg.tier));
        break;
      case "forge.act":
        await play!.forgeAct(userId, msg.chatId, msg.op, msg.arg, msg.arg2, msg.text);
        break;
      case "play.fight":
        await acting.run(`${userId}:${msg.chatId}`, () => play!.fight(userId, msg.chatId, { ...(msg.lead ? { lead: msg.lead } : {}), ...(msg.boss ? { boss: true } : {}) }));
        break;
      case "look.match": {
        send({ type: "notice", level: "info", text: "Reading the card for a matching look…" }, userId);
        const res = await cards.matchLook(userId, msg.chatId);
        if ("error" in res) {
          send({ type: "notice", level: "warn", text: res.error }, userId);
          break;
        }
        await art.addLook(res.look, "card", userId);
        // Draw its gate and bust so it can be judged before switching (5.2a).
        art.handle({ type: "style.probe", lookId: res.look.id }, userId);
        send({ type: "notice", level: "info", text: `Made the look "${res.look.label}" for this card. Its previews are drawing.` }, userId);
        break;
      }
      case "look.describe": {
        send({ type: "notice", level: "info", text: "Writing a look from your description…" }, userId);
        const res = await cards.describeLook(userId, msg.text);
        if ("error" in res) {
          send({ type: "notice", level: "warn", text: res.error }, userId);
          break;
        }
        await art.addLook(res.look, "user", userId);
        art.handle({ type: "style.probe", lookId: res.look.id }, userId);
        send({ type: "notice", level: "info", text: `Made the look "${res.look.label}". Its previews are drawing.${res.warnings.length ? ` Notes: ${res.warnings.join(" ")}` : ""}` }, userId);
        break;
      }
      case "battle.start":
        await battles.start(userId, msg.encounterId, msg.seed);
        break;
      case "battle.act":
        await battles.act(userId, msg.battleId, msg.action);
        break;
    }
  } catch (err) {
    spindle.log.error(`gambit: ${msg?.type}: ${err instanceof Error ? err.stack : String(err)}`);
    const chatId = (msg as { chatId?: unknown })?.chatId;
    send({ type: "notice", level: "error", text: err instanceof Error ? err.message : String(err), ...(typeof chatId === "string" ? { chatId } : {}) }, userId);
  }
});

spindle.log.info(`Gambit ${VERSION} backend ready`);
