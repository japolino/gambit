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
  /** Ready art by key (Combatant.art), kept for stages mounted later. */
  const artReady = new Map<string, { url: string; cutout?: boolean }>();
  const disposeArt = registerArtFrontend({ sendToBackend: send, onBackendMessage: (h) => ctx.onBackendMessage(h) });
  const pushArt = () => {
    for (const [key, a] of artReady) stage?.setArt(key, a.url, { cutout: a.cutout });
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
  });

  async function ensureOverlay(): Promise<Overlay> {
    if (overlay) return overlay;
    const granted = await ctx.permissions.getGranted().catch(() => [] as string[]);
    overlay = createOverlay(ctx, granted.includes("app_manipulation"));
    overlay.onClose(() => {
      stage?.destroy();
      stage = null;
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
    if (!stage) {
      stage = mountBattleStage(ov.content, { state, onAction });
      pushArt();
      if (events.length) await stage.update(state, events);
    } else {
      await stage.update(state, events);
    }
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
