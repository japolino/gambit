/**
 * Gambit frontend entry. Owns the drawer tab and the Stage overlay, and
 * relays between the backend (authoritative engine) and the battle stage.
 */
import { applyUiTokens } from "./frontend/stage/theme.js";
import { applyStageSkin } from "./frontend/stage/skin.js";
import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import type { Action, BattleEvent, BattleState } from "./engine/types.js";
import type { ToBackend, ToFrontend } from "./shared/protocol.js";
import { createOverlay, type Overlay } from "./frontend/host/overlay.js";
import { createPanel } from "./frontend/host/panel.js";
import { mountBattleStage } from "./frontend/stage/index.js";
import { fxLibrary } from "./frontend/stage/fx-library.js";
import { registerArtFrontend } from "./frontend/art/client.js";
import type { ParleyScenario, ParleyState } from "./engine/parley/types.js";
import type { ContestChip } from "./engine/card/types.js";
import { createChips } from "./frontend/host/chips.js";
import { mountParley, type ParleyView } from "./frontend/parley/view.js";
import type { CardStatus, ParleyNarrator, ParleyViewMode } from "./shared/protocol.js";
import { mountScene, type SceneHandle } from "./frontend/scene/view.js";
import type { SceneView } from "./shared/scene-view.js";
import { createVoice, prefsFor, voiceChoice } from "./frontend/voice.js";
import { createMusic } from "./frontend/music.js";

type StageHandle = ReturnType<typeof mountBattleStage>;
type Step = { state: BattleState; events: BattleEvent[] };

export function setup(ctx: SpindleFrontendContext): () => void {
  ctx.deferReady();
  const send = (msg: ToBackend) => ctx.sendToBackend(msg);

  let overlay: Overlay | null = null;
  let stage: StageHandle | null = null;
  let current: BattleState | null = null;
  /** The player's action the backend hasn't answered yet. Always ends: an answer, an error, a timeout or a close. */
  let pending: { resolve: (step: Step) => void; reject: (err: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  const failAction = (why: string) => {
    if (!pending) return;
    const p = pending;
    pending = null;
    clearTimeout(p.timer);
    p.reject(new Error(why));
  };
  let disposed = false;
  /**
   * The screen the last click is waiting for (a resumed fight waits for "Resume"). One at a time: the newest click
   * wins and an error clears it, so a late message can't bring up a screen nobody is waiting for.
   */
  let want: "stage" | "parley" | "scene" | null = null;
  /** A finished card battle's trip back to its scene. One at a time, and any other screen change cancels it. */
  let returnTimer: ReturnType<typeof setTimeout> | undefined;
  /** The Parley on screen and the last state the backend sent. */
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
  // Music: the screen asks for its moment, a model answers with a track, and the player crossfades to it.
  const music = createMusic();
  /** The moment last asked for: an answer to anything else is stale. */
  let mood = "";
  let nightUp = false;
  const wantMusic = (chatId: string, moment: "scene" | "parley" | "fight" | "night", about?: string) => {
    if (!music.prefs().on) return;
    const sig = `${chatId}|${moment}|${about ?? ""}`;
    if (sig === mood) return;
    mood = sig;
    send({ type: "music.want", chatId, moment, ...(about ? { about } : {}) });
  };
  /** Back to the day: only when nothing else has the screen. */
  const sceneMusic = () => {
    if (!scene || !sceneView || sceneView.chatId !== scene.chatId || stage || parley || nightUp || !overlay?.visible()) return;
    music.dim(false);
    wantMusic(sceneView.chatId, "scene", `${sceneView.place.id}:${sceneView.clock.time === "evening" || sceneView.clock.time === "night" ? "night" : "day"}`);
  };
  const musicUi = () => ({
    on: music.prefs().on,
    volume: music.prefs().volume,
    now: music.now()?.title ?? null,
    credits: music.credits(),
    error: music.error(),
    setOn: (on: boolean) => {
      mood = "";
      music.setOn(on);
      if (on) sceneMusic();
    },
    setVolume: (v: number) => music.setVolume(v),
  });
  music.onChange(() => panel.setMusic(musicUi()));
  voice.onSpeaking((on) => music.duck(on));
  // The night's own track comes up at full level; the day's stays low until then, even if it's only now done loading.
  let nightTrack = "";
  music.onTrack((t) => {
    if (nightUp && t.url === nightTrack) music.dim(false);
  });
  // Each new track says what it is, over whatever is on screen.
  music.onTrack((t) => {
    const host = overlay?.content;
    if (!host) return;
    const note = document.createElement("div");
    note.style.cssText = "position:absolute;left:16px;bottom:16px;z-index:60;max-width:70%;padding:5px 11px;border-radius:999px;background:rgba(0,0,0,.62);color:#f1e6cf;font:12px/1.3 system-ui,sans-serif;pointer-events:none;transition:opacity 1s;opacity:0";
    note.textContent = `♪ ${t.title} · Kevin MacLeod (incompetech.com) · CC BY 4.0`;
    host.append(note);
    requestAnimationFrame(() => (note.style.opacity = "1"));
    setTimeout(() => (note.style.opacity = "0"), 6000);
    setTimeout(() => note.remove(), 7200);
  });
  /** The Scene on screen (6.1) and the last view the backend sent. */
  let scene: SceneHandle | null = null;
  let sceneView: SceneView | null = null;
  /** The scene's theme is staging the current fight or talk in its own room (the scene stays visible). */
  let staged = false;
  /** The locked look's palette tokens (a battle outside a themed chat wears them). */
  let lookUi: Parameters<typeof applyUiTokens>[0] = null;
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
      want = "stage";
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
      want = "parley";
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
  panel.setMusic(musicUi());
  if (voice.available) void listTts();

  function withChat(fn: (chatId: string) => void): void {
    const chatId = activeChatId();
    if (chatId) fn(chatId);
    else panel.setCard(null, false);
  }

  function startTalk(chatId: string, castId: string, kind?: ContestChip["kind"], chipId?: string): void {
    want = "parley";
    panel.setStatus("Setting the scene…");
    send({ type: "card.talk", chatId, castId, ...(kind ? { kind } : {}), ...(chipId ? { chipId } : {}) });
  }

  function openScene(chatId: string): void {
    want = "scene";
    panel.setStatus("Opening the scene…");
    send({ type: "scene.open", chatId });
  }

  async function showScene(view: SceneView): Promise<void> {
    const ov = await ensureOverlay();
    if (disposed) return;
    clearTimeout(returnTimer);
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
          if (hotspot.startsWith("talk:")) want = "parley";
          send({ type: "scene.act", chatId, hotspot });
        },
        say: (text) => send({ type: "scene.say", chatId, text }),
        step: (move) => send({ type: "delve.step", chatId, move }),
        leave: () => send({ type: "delve.leave", chatId }),
        theme: (theme) => send({ type: "scene.theme", chatId, theme }),
        fight: () => send({ type: "play.fight", chatId }),
        close: () => ov.hide(),
        nightEnd: () => {
          nightUp = false;
          sceneMusic();
        },
        hex: (q, r) => send({ type: "hex.step", chatId, q, r }),
        board: (op, cell, tier) => send({ type: "board.act", chatId, op, ...(cell ? { cell } : {}), ...(tier !== undefined ? { tier } : {}) }),
        forge: (op, arg, arg2, text) => send({ type: "forge.act", chatId, op, ...(arg !== undefined ? { arg } : {}), ...(arg2 !== undefined ? { arg2 } : {}), ...(text !== undefined ? { text } : {}) }),
        cite: (personId, text) => {
          pendingCite = `I know this: ${text.replace(/\.?$/, ".")}`;
          want = "parley";
          send({ type: "scene.act", chatId, hotspot: `talk:${personId}` });
        },
      });
      pushArt();
    } else scene.setView(view);
    if (stage && !staged) scene.hide();
    else scene.show();
    sceneMusic();
  }

  /** A card battle ended: let the banner play, then go back to the scene it started in. */
  function backToScene(delay = 1600): void {
    clearTimeout(returnTimer);
    returnTimer = setTimeout(() => {
      if (disposed || !stage || !current || current.outcome === "ongoing") return;
      const chatId = current.meta?.chatId;
      stage?.destroy();
      stage = null;
      if (staged) scene?.encounter(null);
      staged = false;
      if (sceneView && scene) {
        scene.setView(sceneView);
        scene.show();
        sceneMusic();
      } else if (chatId) {
        // A resumed card battle has no scene under it yet: open the one it was fought in.
        want = "scene";
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
      music.stop();
      mood = "";
      nightUp = false;
      stage?.destroy();
      stage = null;
      staged = false;
      scene?.destroy();
      scene = null;
      parley?.destroy();
      parley = null;
      want = null;
      clearTimeout(returnTimer);
      failAction("The stage closed.");
    });
    return overlay;
  }

  function onAction(action: Action): Promise<Step> {
    if (!current) return Promise.reject(new Error("No battle"));
    return new Promise<Step>((resolve, reject) => {
      const timer = setTimeout(() => failAction("No answer yet. Try again."), 30_000);
      pending = { resolve, reject, timer };
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
    if (!stage) {
      // A fight in a chat wears that chat's scene theme; elsewhere the stage's own look with the look's tokens.
      const theme = sceneView && sceneView.chatId === state.meta?.chatId ? sceneView.theme : null;
      if (!theme) {
        applyStageSkin(null);
        applyUiTokens(lookUi);
      }
      // A theme with its own room stages the fight there; the stage then draws see-through over the scene.
      staged =
        !!theme &&
        !!scene &&
        scene.chatId === state.meta?.chatId &&
        scene.encounter({
          kind: "battle",
          enemies: state.combatants.filter((c) => c.side === "enemy").map((c) => ({ id: c.id, name: c.name, art: c.art })),
          party: state.combatants.filter((c) => c.side === "party").map((c) => ({ id: c.id, name: c.name, art: c.art })),
        });
      stage = mountBattleStage(ov.content, { state, onAction, theme });
      pushArt();
      if (state.meta?.chatId && scene?.chatId === state.meta.chatId) wantMusic(state.meta.chatId, "fight", state.combatants.find((c) => c.side === "enemy")?.name);
      if (events.length) await stage.update(state, events);
    } else {
      await stage.update(state, events);
    }
    if (!staged) scene?.hide();
    if (state.meta?.chatId && state.outcome !== "ongoing") backToScene();
  }

  async function showParley(state: ParleyState, scenario: ParleyScenario, journal: string[]): Promise<void> {
    const ov = await ensureOverlay();
    if (disposed) return;
    clearTimeout(returnTimer);
    if (!ov.visible()) send({ type: "stage.opened" });
    ov.show();
    stage?.destroy();
    stage = null;
    if (parley && parley.parleyId === state.id) {
      parley.setState(state, journal, parleyMode);
      return;
    }
    parley?.destroy();
    if (staged) scene?.encounter(null);
    const talkTheme = sceneView && sceneView.chatId === state.chatId ? sceneView.theme : undefined;
    staged = !!talkTheme && !!scene && scene.chatId === state.chatId && scene.encounter({ kind: "parley", personId: scenario.npc.id, name: scenario.npc.name });
    if (!staged) scene?.hide();
    parley = mountParley(ov.content, scenario, state, journal, parleyMode, { chatBound: !!state.chatId, narrator: parleyNarrator, theme: talkTheme, inRoom: staged }, {
      say: (text) => send({ type: "parley.say", parleyId: state.id, text }),
      close: (how) => send({ type: "parley.close", parleyId: state.id, how }),
      setMode: (mode) => send({ type: "parley.view", mode }),
      leave: () => {
        parley?.destroy();
        parley = null;
        if (staged) scene?.encounter(null);
        staged = false;
        if (scene) {
          scene.show();
          sceneMusic();
        } else ov.hide();
      },
    });
    // A line can land while the view is mounting (a written line opens the talk): catch up on it.
    if (parleyState?.state.id === state.id && parleyState.state !== state) parley.setState(parleyState.state, parleyState.journal, parleyMode);
    if (state.chatId) wantMusic(state.chatId, "parley", scenario.npc.name);
    if (pendingCite) {
      parley.prefill(pendingCite);
      pendingCite = null;
    }
    pushArt();
  }

  const unsub = ctx.onBackendMessage((raw: unknown) => {
    const msg = raw as ToFrontend;
    if (fxLibrary.receive(msg)) return;
    switch (msg.type) {
      case "welcome":
        fxLibrary.request(send);
        panel.setStatus("");
        panel.setLook(msg.styleLook);
        lookUi = msg.ui;
        applyUiTokens(msg.ui);
        break;
      case "style.probes":
        panel.showProbes(msg.looks);
        break;
      case "style.locked":
        panel.setLook(msg.lookId);
        lookUi = msg.ui;
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
        // A different fight can't be the answer to this one's action.
        if (fresh) failAction("A new fight began.");
        current = msg.state;
        panel.setResumable(msg.state.outcome === "ongoing");
        panel.setStatus(msg.state.outcome === "ongoing" ? "" : `Last fight: ${msg.state.outcome}.`);
        if (pending) {
          const p = pending;
          pending = null;
          clearTimeout(p.timer);
          p.resolve({ state: msg.state, events: msg.events });
          // The player's last blow ended a card battle: back to its scene once the stage has played it out.
          if (msg.state.meta?.chatId && msg.state.outcome !== "ongoing") backToScene(4500);
        } else if (fresh) {
          clearTimeout(returnTimer);
          stage?.destroy();
          stage = null;
          const asked = want === "stage";
          if (asked) want = null;
          if (asked || (msg.state.meta?.chatId && scene && msg.state.outcome === "ongoing")) void showStage(msg.state, msg.events);
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
          sceneMusic();
        } else if (want === "scene") {
          want = null;
          void showScene(msg.view);
        }
        break;
      }
      case "scene.story": {
        // The reply as it is written: shown as the newest beat until the saved one replaces it.
        if (sceneView && scene && scene.chatId === msg.chatId) {
          const beat = { said: msg.said, roll: msg.roll, reply: msg.text };
          scene.setView({ ...sceneView, story: [...sceneView.story, beat] });
        }
        break;
      }
      case "forge.state": {
        if (scene && scene.chatId === msg.chatId) scene.forge(msg.view);
        break;
      }
      case "music.track": {
        if (`${msg.chatId}|${msg.moment}|${msg.about ?? ""}` !== mood) break;
        if (msg.moment === "night") nightTrack = msg.track?.url ?? "";
        if (msg.track) music.play(msg.track);
        else if (msg.error) music.fail(msg.error);
        break;
      }
      case "scene.meanwhile": {
        // The day's music sinks under the curtain, and the night gets its own once the scenes are written.
        if (scene && scene.chatId === msg.chatId) {
          nightUp = true;
          if (msg.vignettes) wantMusic(msg.chatId, "night", String(msg.day));
          else music.dim(true);
        }
        if (scene && scene.chatId === msg.chatId) scene.meanwhile(msg.day, msg.vignettes, { ...(msg.today ? { today: msg.today } : {}), ...(msg.morning ? { morning: msg.morning } : {}) });
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
        else if (want === "parley" && !msg.resumed) {
          want = null;
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
        if (want === "parley") want = null;
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
        // A talk is starting, whether a click or a written line asked for it: its first state opens it.
        want = "parley";
        panel.setStatus(`Setting the scene with ${msg.castName}…`);
        break;
      case "models.state":
        panel.setModels(msg.state);
        break;
      case "battle.error":
        if (want === "stage") want = null;
        failAction(msg.error);
        panel.setStatus(msg.error);
        break;
      case "notice":
        // A refusal or a failure ends whatever the click was waiting for; information doesn't.
        if (msg.level !== "info") want = null;
        if (msg.level === "error") failAction(msg.text);
        panel.setStatus(msg.text);
        break;
    }
  });

  send({ type: "hello" });
  refreshCard();
  ctx.ready();

  return () => {
    disposed = true;
    clearTimeout(returnTimer);
    failAction("Gambit closed.");
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
