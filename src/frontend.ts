/**
 * Gambit frontend entry. Owns the drawer tab and the Stage overlay, and
 * relays between the backend (authoritative engine) and the battle stage.
 */
import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import type { Action, BattleEvent, BattleState } from "./engine/types.js";
import type { ToBackend, ToFrontend } from "./shared/protocol.js";
import { createOverlay, type Overlay } from "./frontend/host/overlay.js";
import { createPanel } from "./frontend/host/panel.js";
import { mountBattleStage } from "./frontend/stage/index.js";
import { registerArtFrontend } from "./frontend/art/client.js";
import { PARLEYS } from "./engine/content/parleys.js";
import type { ParleyState } from "./engine/parley/types.js";
import { mountParley, type ParleyView } from "./frontend/parley/view.js";
import type { ParleyNarrator, ParleyViewMode } from "./shared/protocol.js";

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
  let parleyState: { state: ParleyState; journal: string[] } | null = null;
  let wantParley = false;
  let parleyMode: ParleyViewMode = "immersive";
  let parleyNarrator: ParleyNarrator = "gambit";
  /** Ready art by key (Combatant.art), kept for stages mounted later. */
  const artReady = new Map<string, { url: string; cutout?: boolean }>();
  const disposeArt = registerArtFrontend({ sendToBackend: send, onBackendMessage: (h) => ctx.onBackendMessage(h) });
  const pushArt = () => {
    for (const [key, a] of artReady) stage?.setArt(key, a.url, { cutout: a.cutout });
    for (const [key, a] of artReady) parley?.setArt(key, a.url, a.cutout);
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
    probe: () => send({ type: "style.probe" }),
    pick: (lookId) => send({ type: "style.pick", lookId }),
    parley: (scenarioId) => {
      panel.setStatus("Finding them…");
      wantParley = true;
      send({ type: "parley.start", scenarioId, chatId: activeChatId() });
    },
    resumeParley: () => {
      if (parleyState && !parleyState.state.end) void showParley(parleyState.state, parleyState.journal);
    },
    setParleyMode: (mode) => send({ type: "parley.view", mode }),
    setNarrator: (mode) => send({ type: "parley.narrator", mode }),
  });

  async function ensureOverlay(): Promise<Overlay> {
    if (overlay) return overlay;
    const granted = await ctx.permissions.getGranted().catch(() => [] as string[]);
    overlay = createOverlay(ctx, granted.includes("app_manipulation"));
    overlay.onClose(() => {
      stage?.destroy();
      stage = null;
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
    const ov = await ensureOverlay();
    if (disposed) return;
    if (!ov.visible()) send({ type: "stage.opened" });
    ov.show();
    parley?.destroy();
    parley = null;
    if (!stage) {
      stage = mountBattleStage(ov.content, { state, onAction });
      pushArt();
      if (events.length) await stage.update(state, events);
    } else {
      await stage.update(state, events);
    }
  }

  async function showParley(state: ParleyState, journal: string[]): Promise<void> {
    const scenario = PARLEYS[state.scenarioId];
    if (!scenario) return;
    const ov = await ensureOverlay();
    if (disposed) return;
    if (!ov.visible()) send({ type: "stage.opened" });
    ov.show();
    stage?.destroy();
    stage = null;
    if (parley && parley.parleyId === state.id) {
      parley.setState(state, journal, parleyMode);
      return;
    }
    parley?.destroy();
    parley = mountParley(ov.content, scenario, state, journal, parleyMode, { chatBound: !!state.chatId, narrator: parleyNarrator }, {
      say: (text) => send({ type: "parley.say", parleyId: state.id, text }),
      close: (how) => send({ type: "parley.close", parleyId: state.id, how }),
      setMode: (mode) => send({ type: "parley.view", mode }),
      leave: () => {
        parley?.destroy();
        parley = null;
        ov.hide();
      },
    });
    pushArt();
  }

  const unsub = ctx.onBackendMessage((raw: unknown) => {
    const msg = raw as ToFrontend;
    switch (msg.type) {
      case "welcome":
        panel.setStatus("");
        panel.setLook(msg.styleLook);
        break;
      case "style.probes":
        panel.showProbes(msg.looks);
        break;
      case "style.locked":
        panel.setLook(msg.lookId);
        break;
      case "art.update":
        for (const item of msg.items) {
          if (item.state !== "ready" || !item.url) continue;
          if (item.key.startsWith("style_probe:")) {
            panel.setProbeImage(item.key, item.url);
            continue;
          }
          artReady.set(item.key, { url: item.url, cutout: item.cutout });
          stage?.setArt(item.key, item.url, { cutout: item.cutout });
          parley?.setArt(item.key, item.url, item.cutout);
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
        } else if (fresh) {
          stage?.destroy();
          stage = null;
          if (wantStage) {
            wantStage = false;
            void showStage(msg.state, msg.events);
          }
        } else if (stage) {
          void stage.update(msg.state, msg.events);
        }
        break;
      }
      case "parley.state": {
        parleyState = { state: msg.state, journal: msg.journal };
        parleyMode = msg.view;
        parleyNarrator = msg.narrator;
        panel.setNarrator(msg.narrator);
        panel.setParley(msg.state.end ? null : PARLEYS[msg.state.scenarioId]?.name ?? null, msg.view, msg.journal.length);
        panel.setStatus("");
        if (parley && parley.parleyId === msg.state.id) parley.setState(msg.state, msg.journal, msg.view);
        else if (wantParley && !msg.resumed) {
          wantParley = false;
          void showParley(msg.state, msg.journal);
        }
        break;
      }
      case "parley.exchange":
        if (parleyState) parleyState = { ...parleyState, state: msg.state };
        panel.setParley(msg.state.end ? null : PARLEYS[msg.state.scenarioId]?.name ?? null, parleyMode, parleyState?.journal.length ?? 0);
        if (parley?.parleyId === msg.parleyId) parley.exchange(msg.state, msg.exchange, msg.narrated);
        break;
      case "parley.judging":
        if (parley?.parleyId === msg.parleyId) parley.judging(msg.text);
        break;
      case "parley.reply":
        if (parley?.parleyId === msg.parleyId) parley.reply(msg.index, msg.text, msg.final);
        break;
      case "parley.view":
        parleyMode = msg.mode;
        parley?.setMode(msg.mode);
        panel.setParley(parleyState && !parleyState.state.end ? PARLEYS[parleyState.state.scenarioId]?.name ?? null : null, msg.mode, parleyState?.journal.length ?? 0);
        break;
      case "parley.narrator":
        parleyNarrator = msg.mode;
        panel.setNarrator(msg.mode);
        parley?.setNarrator(msg.mode);
        break;
      case "parley.error":
        if (parley) parley.error(msg.error);
        else panel.setStatus(msg.error);
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
  ctx.ready();

  return () => {
    disposed = true;
    unsub();
    disposeArt();
    stage?.destroy();
    overlay?.destroy();
    panel.destroy();
  };
}
