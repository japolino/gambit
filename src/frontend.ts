/**
 * Gambit frontend entry. Owns the drawer tab and the Stage overlay, and
 * relays between the backend (authoritative engine) and the battle stage.
 */
import { applyUiTokens } from "./frontend/stage/theme.js";
import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import type { Action, BattleEvent, BattleState } from "./engine/types.js";
import type { ToBackend, ToFrontend } from "./shared/protocol.js";
import { createOverlay, type Overlay } from "./frontend/host/overlay.js";
import { createPanel } from "./frontend/host/panel.js";
import { mountBattleStage } from "./frontend/stage/index.js";
import { registerArtFrontend } from "./frontend/art/client.js";
import type { ParleyScenario, ParleyState } from "./engine/parley/types.js";
import type { ContestChip } from "./engine/card/types.js";
import { createChips } from "./frontend/host/chips.js";
import { mountParley, type ParleyView } from "./frontend/parley/view.js";
import type { CardStatus, ParleyNarrator, ParleyViewMode } from "./shared/protocol.js";
import { mountScene, type SceneHandle } from "./frontend/scene/view.js";
import type { SceneView } from "./shared/scene-view.js";
import { createVoice, prefsFor, voiceChoice } from "./frontend/voice.js";

type StageHandle = ReturnType<typeof mountBattleStage>;
type Step = { state: BattleState; events: BattleEvent[] };

export function setup(ctx: SpindleFrontendContext): () => void {
  ctx.deferReady();
  const send = (msg: ToBackend) => ctx.sendToBackend(msg);

  let overlay: Overlay | null = null;
  let stage: StageHandle | null = null;
  let current: BattleState | null = null;
  let pending: ((step: Step) => void) | null = null;
  let disposed = false;
  /** Set by a click that should bring the Stage up; a resumed fight waits for "Resume". */
  let wantStage = false;
  /** The Parley on screen, the last state the backend sent, and whether a click asked for it. */
  let parley: ParleyView | null = null;
  let parleyState: { state: ParleyState; scenario: ParleyScenario; journal: string[] } | null = null;
  /** The card status of the chat on screen. */
  let card: CardStatus | null = null;
  // Voice (6.4): the host's TTS, off until the player turns it on.
  const voice = createVoice((ctx as unknown as { tts?: Parameters<typeof createVoice>[0] }).tts);
  let ttsConnections: { id: string; name: string }[] = [];
  let ttsListed = false;
  async function listTts(): Promise<void> {
    if (ttsListed) return;
    ttsListed = true;
    try {
      const res = await fetch("/api/v1/tts-connections", { credentials: "same-origin" });
      const body = (await res.json()) as unknown;
      const rows = (Array.isArray(body) ? body : ((body as { data?: unknown[]; connections?: unknown[] }).data ?? (body as { connections?: unknown[] }).connections ?? [])) as { id?: string; name?: string }[];
      ttsConnections = rows.filter((c) => c.id).map((c) => ({ id: c.id!, name: c.name || c.id! }));
      panel.setVoice(voiceUi());
    } catch {
      /* the default voice still works */
    }
  }
  let spokenStory = "";
  const spokenParley = new Map<string, number>();
  // The drawer's voice picker: no voice, the default one, or a TTS connection.
  const voiceUi = () => ({
    available: voice.available,
    choice: voiceChoice(voice.prefs()),
    connections: ttsConnections,
    error: voice.lastError(),
    choose: (c: string) => voice.set(prefsFor(c)),
    test: () => voice.say("The road ahead is quiet. For now."),
  });
  voice.onChange(() => panel.setVoice(voiceUi()));
  let wantParley = false;
  /** The Scene on screen (6.1), the last view the backend sent, and whether a click asked for it. */
  let scene: SceneHandle | null = null;
  let sceneView: SceneView | null = null;
  let wantScene = false;
  /** A fact card played in the Table theme: its citation waits for the Parley it starts. */
  let pendingCite: string | null = null;
  let parleyMode: ParleyViewMode = "immersive";
  let parleyNarrator: ParleyNarrator = "gambit";
  /** Ready art by key (Combatant.art), kept for stages mounted later. */
  const artReady = new Map<string, { url: string; cutout?: boolean; face?: [number, number, number, number] | null }>();
  const disposeArt = registerArtFrontend({ sendToBackend: send, onBackendMessage: (h) => ctx.onBackendMessage(h) });
  const pushArt = () => {
    for (const [key, a] of artReady) stage?.setArt(key, a.url, { cutout: a.cutout });
    for (const [key, a] of artReady) parley?.setArt(key, a.url, a.cutout);
    for (const [key, a] of artReady) scene?.setArt(key, a.url, a.cutout, a.face);
  };
  const activeChatId = (): string | null => {
    try {
      return (ctx as unknown as { getActiveChat?: () => { chatId: string | null } }).getActiveChat?.().chatId ?? null;
    } catch {
      return null;
    }
  };

  const panel = createPanel(ctx, {
    start: (encounterId) => {
      panel.setStatus("Setting the scene…");
      wantStage = true;
      send({ type: "battle.start", encounterId });
    },
    open: () => {
      if (current) showStage(current, []);
      else panel.setStatus("Pick an encounter below.");
    },
    probe: (lookId) => send({ type: "style.probe", ...(lookId ? { lookId } : {}) }),
    pick: (lookId) => send({ type: "style.pick", lookId }),
    looks: {
      list: () => send({ type: "look.list" }),
      importJson: (json) => send({ type: "look.import", json }),
      exportLook: (lookId) => send({ type: "look.export", lookId }),
      remove: (lookId) => send({ type: "look.delete", lookId }),
      match: () => withChat((chatId) => send({ type: "look.match", chatId })),
      describe: (text) => send({ type: "look.describe", text }),
    },
    parley: (scenarioId) => {
      panel.setStatus("Finding them…");
      wantParley = true;
      send({ type: "parley.start", scenarioId, chatId: activeChatId() });
    },
    resumeParley: () => {
      if (parleyState && !parleyState.state.end) void showParley(parleyState.state, parleyState.scenario, parleyState.journal);
    },
    setParleyMode: (mode) => send({ type: "parley.view", mode }),
    setNarrator: (mode) => send({ type: "parley.narrator", mode }),
    card: {
      enable: (on) => withChat((chatId) => send({ type: "card.enable", chatId, on })),
      reread: () => withChat((chatId) => send({ type: "card.read", chatId })),
      talk: (castId) => withChat((chatId) => startTalk(chatId, castId)),
      social: (stat, value) => withChat((chatId) => send({ type: "card.edit", chatId, social: { [stat]: value } })),
      module: (id, on) => withChat((chatId) => send({ type: "card.edit", chatId, modules: { [id]: on } })),
      chips: (on) => withChat((chatId) => send({ type: "card.chips", chatId, on })),
      play: () => withChat((chatId) => openScene(chatId)),
    },
    demo: () => {
      panel.setStatus("Adding the demo card…");
      send({ type: "card.demo" });
    },
    models: {
      get: () => send({ type: "models.get" }),
      set: (patch) => send({ type: "models.set", patch }),
    },
  });
  panel.setVoice(voiceUi());
  if (voice.available) void listTts();

  function withChat(fn: (chatId: string) => void): void {
    const chatId = activeChatId();
    if (chatId) fn(chatId);
    else panel.setCard(null, false);
  }

  function startTalk(chatId: string, castId: string, kind?: ContestChip["kind"], chipId?: string): void {
    wantParley = true;
    panel.setStatus("Setting the scene…");
    send({ type: "card.talk", chatId, castId, ...(kind ? { kind } : {}), ...(chipId ? { chipId } : {}) });
  }

  function openScene(chatId: string): void {
    wantScene = true;
    panel.setStatus("Opening the scene…");
    send({ type: "scene.open", chatId });
  }

  async function showScene(view: SceneView): Promise<void> {
    const ov = await ensureOverlay();
    if (disposed) return;
    if (!ov.visible()) send({ type: "stage.opened" });
    ov.show();
    parley?.destroy();
    parley = null;
    if (scene && scene.chatId !== view.chatId) {
      scene.destroy();
      scene = null;
    }
    if (!scene) {
      const chatId = view.chatId;
      scene = mountScene(ov.content, view, {
        act: (hotspot) => {
          if (hotspot.startsWith("talk:")) wantParley = true;
          send({ type: "scene.act", chatId, hotspot });
        },
        step: (move) => send({ type: "delve.step", chatId, move }),
        leave: () => send({ type: "delve.leave", chatId }),
        theme: (theme) => send({ type: "scene.theme", chatId, theme }),
        fight: () => send({ type: "play.fight", chatId }),
        close: () => ov.hide(),
        hex: (q, r) => send({ type: "hex.step", chatId, q, r }),
        board: (op, cell, tier) => send({ type: "board.act", chatId, op, ...(cell ? { cell } : {}), ...(tier !== undefined ? { tier } : {}) }),
        forge: (op, arg, arg2, text) => send({ type: "forge.act", chatId, op, ...(arg !== undefined ? { arg } : {}), ...(arg2 !== undefined ? { arg2 } : {}), ...(text !== undefined ? { text } : {}) }),
        cite: (personId, text) => {
          pendingCite = `I know this: ${text.replace(/\.?$/, ".")}`;
          wantParley = true;
          send({ type: "scene.act", chatId, hotspot: `talk:${personId}` });
        },
      });
      pushArt();
    } else scene.setView(view);
    if (stage) scene.hide();
    else scene.show();
  }

  /** A card battle ended: let the banner play, then go back to the scene it started in. */
  function backToScene(delay = 1600): void {
    setTimeout(() => {
      if (disposed || !current || current.outcome === "ongoing") return;
      const chatId = current.meta?.chatId;
      stage?.destroy();
      stage = null;
      if (sceneView && scene) {
        scene.setView(sceneView);
        scene.show();
      } else if (chatId) {
        // A resumed card battle has no scene under it yet: open the one it was fought in.
        wantScene = true;
        send({ type: "scene.open", chatId });
      }
    }, delay);
  }

  const chips = createChips(
    ctx,
    (chip) => startTalk(chip.chatId, chip.castId, chip.kind, chip.id),
    (chip) => panel.setStatus(`${chip.label} Open the Gambit drawer and press Talk.`),
  );

  /** Ask for the card status of whatever chat is on screen. */
  function refreshCard(): void {
    const chatId = activeChatId();
    card = null;
    panel.setCard(null, !!chatId);
    if (chatId) send({ type: "card.status", chatId });
  }
  const offChat = ctx.events.on("CHAT_SWITCHED", () => {
    chips.clear();
    refreshCard();
  });

  async function ensureOverlay(): Promise<Overlay> {
    if (overlay) return overlay;
    const granted = await ctx.permissions.getGranted().catch(() => [] as string[]);
    overlay = createOverlay(ctx, granted.includes("app_manipulation"));
    overlay.onClose(() => {
      voice.stop();
      stage?.destroy();
      stage = null;
      scene?.destroy();
      scene = null;
      parley?.destroy();
      parley = null;
    });
    return overlay;
  }

  function onAction(action: Action): Promise<Step> {
    if (!current) return Promise.reject(new Error("No battle"));
    return new Promise<Step>((resolve) => {
      pending = resolve;
      send({ type: "battle.act", battleId: current!.id, action });
    });
  }

  async function showStage(state: BattleState, events: BattleEvent[]): Promise<void> {
    chips.clear(activeChatId() ?? undefined);
    const ov = await ensureOverlay();
    if (disposed) return;
    if (!ov.visible()) send({ type: "stage.opened" });
    ov.show();
    parley?.destroy();
    parley = null;
    scene?.hide();
    if (!stage) {
      stage = mountBattleStage(ov.content, { state, onAction });
      pushArt();
      if (events.length) await stage.update(state, events);
    } else {
      await stage.update(state, events);
    }
    if (state.meta?.chatId && state.outcome !== "ongoing") backToScene();
  }

  async function showParley(state: ParleyState, scenario: ParleyScenario, journal: string[]): Promise<void> {
    const ov = await ensureOverlay();
    if (disposed) return;
    if (!ov.visible()) send({ type: "stage.opened" });
    ov.show();
    stage?.destroy();
    stage = null;
    scene?.hide();
    if (parley && parley.parleyId === state.id) {
      parley.setState(state, journal, parleyMode);
      return;
    }
    parley?.destroy();
    parley = mountParley(ov.content, scenario, state, journal, parleyMode, { chatBound: !!state.chatId, narrator: parleyNarrator, table: sceneView?.theme === "table" && sceneView.chatId === state.chatId }, {
      say: (text) => send({ type: "parley.say", parleyId: state.id, text }),
      close: (how) => send({ type: "parley.close", parleyId: state.id, how }),
      setMode: (mode) => send({ type: "parley.view", mode }),
      leave: () => {
        parley?.destroy();
        parley = null;
        if (scene) scene.show();
        else ov.hide();
      },
    });
    if (pendingCite) {
      parley.prefill(pendingCite);
      pendingCite = null;
    }
    pushArt();
  }

  const unsub = ctx.onBackendMessage((raw: unknown) => {
    const msg = raw as ToFrontend;
    switch (msg.type) {
      case "welcome":
        panel.setStatus("");
        panel.setLook(msg.styleLook);
        applyUiTokens(msg.ui);
        break;
      case "style.probes":
        panel.showProbes(msg.looks);
        break;
      case "style.locked":
        panel.setLook(msg.lookId);
        applyUiTokens(msg.ui);
        break;
      case "look.file": {
        // Save the look file through the browser.
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([msg.json], { type: "application/json" }));
        a.download = `${msg.lookId}.gambit-look.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        break;
      }
      case "art.update":
        for (const item of msg.items) {
          if (item.state !== "ready" || !item.url) continue;
          if (item.key.startsWith("style_probe:")) {
            panel.setProbeImage(item.key, item.url);
            continue;
          }
          artReady.set(item.key, { url: item.url, cutout: item.cutout, ...(item.face !== undefined ? { face: item.face } : {}) });
          stage?.setArt(item.key, item.url, { cutout: item.cutout });
          parley?.setArt(item.key, item.url, item.cutout);
          scene?.setArt(item.key, item.url, item.cutout, item.face);
        }
        break;
      case "battle.state": {
        const fresh = !current || current.id !== msg.state.id;
        current = msg.state;
        panel.setResumable(msg.state.outcome === "ongoing");
        panel.setStatus(msg.state.outcome === "ongoing" ? "" : `Last fight: ${msg.state.outcome}.`);
        if (pending) {
          const resolve = pending;
          pending = null;
          resolve({ state: msg.state, events: msg.events });
          // The player's last blow ended a card battle: back to its scene once the stage has played it out.
          if (msg.state.meta?.chatId && msg.state.outcome !== "ongoing") backToScene(4500);
        } else if (fresh) {
          stage?.destroy();
          stage = null;
          if (msg.state.meta?.chatId && scene && msg.state.outcome === "ongoing") wantStage = true;
          if (wantStage) {
            wantStage = false;
            void showStage(msg.state, msg.events);
          }
        } else if (stage) {
          void stage.update(msg.state, msg.events).then(() => {
            if (msg.state.meta?.chatId && msg.state.outcome !== "ongoing") backToScene();
          });
        }
        break;
      }
      case "scene.state": {
        sceneView = msg.view;
        {
          // A story tile's scene is read aloud as its card opens.
          const st = msg.view.board?.story;
          const sig = st ? `${st.title}|${st.text.length}` : "";
          if (st && sig !== spokenStory && !msg.view.board?.pending) voice.say(`${st.title}. ${st.text}`);
          spokenStory = sig;
        }
        panel.setStatus("");
        if (scene && scene.chatId === msg.view.chatId) {
          scene.setView(msg.view);
        } else if (wantScene) {
          wantScene = false;
          void showScene(msg.view);
        }
        break;
      }
      case "forge.state": {
        if (scene && scene.chatId === msg.chatId) scene.forge(msg.view);
        break;
      }
      case "scene.meanwhile": {
        if (scene && scene.chatId === msg.chatId) scene.meanwhile(msg.day, msg.vignettes);
        if (msg.vignettes?.length && scene?.chatId === msg.chatId) voice.queue(msg.vignettes.map((x) => x.text));
        break;
      }
      case "scene.suggest": {
        // A menu choice can become a line in the chat input instead (6.1).
        const composer = (ctx as unknown as { composer?: { setText(t: string): void; focus(): void } }).composer;
        try {
          composer?.setText(msg.text);
          overlay?.hide();
          scene?.destroy();
          scene = null;
          composer?.focus();
        } catch {
          panel.setStatus(msg.text);
        }
        break;
      }
      case "parley.state": {
        parleyState = { state: msg.state, scenario: msg.scenario, journal: msg.journal };
        {
          // Speak each NPC reply once, when it is written.
          const ex = msg.state.exchanges;
          const last = ex[ex.length - 1];
          if (last?.reply && (spokenParley.get(msg.state.id) ?? 0) < ex.length) {
            spokenParley.set(msg.state.id, ex.length);
            voice.say(last.reply);
          }
        }
        parleyMode = msg.view;
        parleyNarrator = msg.narrator;
        panel.setNarrator(msg.narrator);
        panel.setParley(msg.state.end ? null : msg.scenario.name, msg.view, msg.journal.length);
        panel.setStatus("");
        if (parley && parley.parleyId === msg.state.id) parley.setState(msg.state, msg.journal, msg.view);
        else if (wantParley && !msg.resumed) {
          wantParley = false;
          void showParley(msg.state, msg.scenario, msg.journal);
        }
        break;
      }
      case "parley.exchange":
        if (parleyState) parleyState = { ...parleyState, state: msg.state };
        panel.setParley(msg.state.end ? null : (parleyState?.scenario.name ?? null), parleyMode, parleyState?.journal.length ?? 0);
        if (parley?.parleyId === msg.parleyId) parley.exchange(msg.state, msg.exchange, msg.narrated);
        break;
      case "parley.judging":
        if (parley?.parleyId === msg.parleyId) parley.judging(msg.text);
        break;
      case "parley.reply":
        if (parley?.parleyId === msg.parleyId) parley.reply(msg.index, msg.text, msg.final);
        if (msg.final && msg.text && (spokenParley.get(msg.parleyId) ?? 0) < msg.index + 1) {
          spokenParley.set(msg.parleyId, msg.index + 1);
          voice.say(msg.text);
        }
        break;
      case "parley.view":
        parleyMode = msg.mode;
        parley?.setMode(msg.mode);
        panel.setParley(parleyState && !parleyState.state.end ? parleyState.scenario.name : null, msg.mode, parleyState?.journal.length ?? 0);
        break;
      case "parley.narrator":
        parleyNarrator = msg.mode;
        panel.setNarrator(msg.mode);
        parley?.setNarrator(msg.mode);
        break;
      case "parley.error":
        wantParley = false;
        chips.clear();
        if (parley) parley.error(msg.error);
        else panel.setStatus(msg.error);
        break;
      case "card.status":
        if (msg.status.chatId !== activeChatId()) break;
        card = msg.status;
        panel.setCard(card, true);
        break;
      case "card.chip":
        if (msg.chip.chatId === activeChatId()) chips.show(msg.chip);
        break;
      case "card.starting":
        panel.setStatus(`Setting the scene with ${msg.castName}…`);
        break;
      case "models.state":
        panel.setModels(msg.state);
        break;
      case "battle.error":
        panel.setStatus(msg.error);
        break;
      case "notice":
        panel.setStatus(msg.text);
        break;
    }
  });

  send({ type: "hello" });
  refreshCard();
  ctx.ready();

  return () => {
    disposed = true;
    unsub();
    offChat();
    chips.destroy();
    disposeArt();
    stage?.destroy();
    scene?.destroy();
    overlay?.destroy();
    panel.destroy();
  };
}
