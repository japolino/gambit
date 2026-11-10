/**
 * The Parley scene (docs/DESIGN.md 4.1, 6): the NPC large on the left over
 * the place, the contest on the right: track, patience, the exchanges, and
 * the box you speak into. Each exchange plays the Referee's read and the
 * dice (about a second, which hides nothing: the result is already saved)
 * and then the NPC's narrated reply, streamed from the chat.
 *
 * Plain DOM inside the overlay's shadow root. All outcomes come from the
 * backend; this file only shows them.
 */
import { FACTS } from "../../engine/content/parleys.js";
import { canPay } from "../../engine/parley/exchange.js";
import { formatValue, effectLine, immersiveRead, leanLine, rollLine, stakeLine, whyText } from "../../engine/parley/narrate.js";
import type { Exchange, Mood, ParleyScenario, ParleyState } from "../../engine/parley/types.js";
import { TIER_NAMES } from "../../engine/parley/types.js";
import { expressionArtKey, isExpressionArtKey, momentIndexOf, npcArtKey, placeArtKey } from "../../shared/art-keys.js";
import { parleyMoment } from "../../engine/parley/moments.js";
import { EXPRESSION_FOR_MOOD } from "../../shared/parley-view.js";
import type { ParleyNarrator, ParleyViewMode } from "../../shared/protocol.js";
import { figureStats, framedPicture, usableExpression } from "../art/key-background.js";
import { facePosition, prepareArtFresh as prepareArt } from "../art/prepare.js";
import type { FaceBox } from "../art/cutout/face-kernel.js";
import { paintBackground } from "../stage/placeholder.js";
import { parleyCss } from "./style.js";
import { PARLEY_THEMES } from "./themes/index.js";
import type { ParleyDecor } from "./themes/types.js";
import { createPuppetDom } from "../scene/puppet-dom.js";
import { PUPPET_ACT } from "./acting.js";
import type { ThemeId } from "../../shared/scene-view.js";
import { THEME_FONTS_CSS } from "../scene/fonts.js";
import { PIXEL_FONT_CSS } from "../scene/pixel-font.js";
import { storyHtml, type StoryOpts, type Voices } from "../story-text.js";

export interface ParleyCallbacks {
  say(text: string): void;
  close(how: "deal" | "walk"): void;
  setMode(mode: ParleyViewMode): void;
  leave(): void;
}

export interface ParleyView {
  readonly parleyId: string;
  setState(state: ParleyState, journal: string[], mode: ParleyViewMode): void;
  exchange(state: ParleyState, ex: Exchange, narrated: boolean): void;
  judging(text: string): void;
  reply(index: number, text: string, final: boolean): void;
  setArt(key: string, url: string, cutout?: boolean): void;
  setMode(mode: ParleyViewMode): void;
  setNarrator(mode: ParleyNarrator): void;
  error(text: string): void;
  /** Put words in the input (a fact card played from the Table theme). */
  prefill(text: string): void;
  destroy(): void;
}

const RESULT_WORD = { crit_success: "Critical success", success: "Success", partial: "Partial", fail: "Fail", crit_fail: "Critical fail" } as const;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Narration as the chat shows it (story-text.ts), a paragraph per line. */
function renderProse(target: HTMLElement, text: string, o: StoryOpts): void {
  // Presets sometimes add markdown headings ("## Response", "### Chapter 1"); they are not the NPC talking.
  const clean = text
    .split("\n")
    .filter((l) => !/^\s{0,3}#{1,6}\s/.test(l) && !/^\s*([-*_]\s*){3,}$/.test(l))
    .join("\n")
    .trim();
  target.innerHTML = storyHtml(clean, o)
    .map((p) => `<p>${p}</p>`)
    .join("");
}

type FigureStats = ReturnType<typeof figureStats>;

/** @font-face is ignored inside a shadow root: declare the theme fonts on the page once (the Scene view does the same). */
function ensureFonts(): void {
  if (document.getElementById("gambit-pixel-font") || document.getElementById("gambit-parley-fonts")) return;
  const st = document.createElement("style");
  st.id = "gambit-parley-fonts";
  st.textContent = `${PIXEL_FONT_CSS}\n${THEME_FONTS_CSS}`;
  document.head.append(st);
}

const colorsOf = (palette: string): number[] => palette.split(",").map((h) => parseInt(h.trim().replace("#", ""), 16)).filter((n) => Number.isFinite(n));

export function mountParley(
  root: HTMLElement,
  scenario: ParleyScenario,
  initial: ParleyState,
  journal: string[],
  mode: ParleyViewMode,
  where: {
    chatBound: boolean;
    narrator: ParleyNarrator;
    /** The scene theme to dress the talk in (style.ts); none keeps the painted default. */
    theme?: ThemeId;
    /** The scene staged this talk in its 3D room (the scene stays visible under the view). */
    inRoom?: boolean;
    /** The scene's cast, so a person's lines wear the same colour here as in the scene. */
    voices?: Voices;
  },
  cb: ParleyCallbacks,
): ParleyView {
  const chatBound = where.chatBound;
  let narrator = where.narrator;
  const npc = scenario.npc;
  const c = scenario.contest;
  let state = initial;
  let viewMode = mode;
  let known = new Set([...initial.known, ...journal]);
  let busy = false;
  const objectUrls: string[] = [];
  const art = new Map<string, string>();
  const replies = new Map<number, { text: string; final: boolean }>();
  const blocks = new Map<number, { npc: HTMLElement; read: HTMLElement; ready: boolean }>();

  ensureFonts();
  const theme: ThemeId | undefined = where.theme;
  /** The pixel themes' bitmap faces only have straight quotes. */
  const curlyQuotes = theme !== "onebit" && theme !== "command";
  const given = where.voices ?? { cast: [], player: scenario.speaker.name === "you" ? "" : scenario.speaker.name };
  const voices: Voices = given.cast.some((p) => p.name === npc.name) ? given : { ...given, cast: [...given.cast, { name: npc.name, pronoun: npc.pronoun, here: true }] };
  const prose = (target: HTMLElement, text: string, o: StoryOpts = {}) => renderProse(target, text, { voices, curly: curlyQuotes, speaker: npc.name, ...o });
  const look = theme ? PARLEY_THEMES[theme] : undefined;
  const style = el("style");
  style.textContent = parleyCss(look?.css ?? "");
  const wrap = el("div", "pl");
  wrap.dataset.mode = viewMode;
  // A theme that stages the talk in its 3D scene room: no backdrop of our own, the room shows through.
  if (look?.inRoom && where.inRoom) wrap.classList.add("in-room");
  if (theme) wrap.classList.add(`th-${theme}`);

  /* ---------------- scene ---------------- */
  const scene = el("div", "scene");
  const plate = el("div", "plate");
  const placeholder = paintBackground(`parley:${scenario.id}`, colorsOf(npc.look.palette), 1280, 960, 0.7);
  placeholder.className = "plate-canvas";
  plate.append(placeholder);
  const plateImg = el("img", "plate-img");
  plateImg.alt = "";
  plate.append(plateImg);
  const figure = el("div", "figure");
  const fig = el("div", "fig");
  const imgA = el("img", "face");
  const imgB = el("img", "face");
  imgA.alt = imgB.alt = "";
  const silhouette = el("div", "silhouette");
  silhouette.append(el("span", undefined, npc.name.replace(/^Sergeant /, "").charAt(0)), el("small", undefined, `Drawing ${npc.name}…`));
  fig.append(silhouette, imgA, imgB);
  // The figure breathes, sways and turns its head through Cue's rig when it is a cut-out.
  const puppets = createPuppetDom();
  puppets.follow(imgA);
  puppets.follow(imgB);
  figure.append(fig);
  const plaque = el("div", "plaque");
  plaque.append(el("div", "who", npc.name), el("div", "role", npc.role));
  const tellLine = el("div", "tell");
  // Moments: a still over the scene when a beat's picture lands, then a thumbnail to see it again.
  const momentBox = el("div", "moment");
  const momentImg = el("img");
  momentImg.alt = "";
  const momentCap = el("div", "cap");
  momentBox.append(momentImg, momentCap);
  const momentStrip = el("div", "moments");
  const moments = new Map<number, string>();
  let momentTimer: ReturnType<typeof setTimeout> | null = null;
  const hideMoment = () => {
    momentBox.classList.remove("show");
    if (momentTimer) clearTimeout(momentTimer);
    momentTimer = null;
  };
  momentBox.addEventListener("click", hideMoment);
  function showMoment(index: number) {
    const url = moments.get(index);
    const ex = state.exchanges[index];
    if (!url || !ex) return;
    momentImg.src = url;
    momentCap.textContent = parleyMoment(scenario, ex)?.caption ?? "";
    momentBox.classList.remove("show");
    void momentBox.offsetWidth;
    momentBox.classList.add("show");
    if (momentTimer) clearTimeout(momentTimer);
    momentTimer = setTimeout(hideMoment, 7000);
  }
  function addMoment(index: number, url: string) {
    const fresh = !moments.has(index);
    moments.set(index, url);
    if (fresh) {
      const b = el("button");
      b.type = "button";
      b.title = parleyMoment(scenario, state.exchanges[index]!)?.caption ?? "";
      const t = el("img");
      t.src = url;
      t.alt = "";
      b.append(t);
      b.addEventListener("click", () => showMoment(index));
      const after = [...momentStrip.children].find((c) => Number((c as HTMLElement).dataset.i) > index);
      b.dataset.i = String(index);
      momentStrip.insertBefore(b, after ?? null);
    }
    // The newest beat plays as it lands; older ones (a resumed Parley) wait in the strip.
    if (fresh && index === state.exchanges.length - 1 && Date.now() - lastExchangeAt < 120_000) showMoment(index);
  }
  let lastExchangeAt = 0;
  scene.append(plate, el("div", "vignette"), figure, plaque, tellLine, momentStrip, momentBox);

  /* ---------------- side ---------------- */
  const side = el("div", "side");
  const head = el("header", "head");
  const titleRow = el("div", "title-row");
  titleRow.append(el("div", "kind", stakeLine(scenario)));
  const modeSwitch = el("div", "mode");
  const modeBtns = (["immersive", "transparent"] as const).map((m) => {
    // Named for what each does, not for the mode's name: one shows the story alone, the other adds the dice.
    const b = el("button", undefined, m === "immersive" ? "Story only" : "Show dice");
    b.title = m === "immersive" ? "Show only what happens, with no numbers" : "Show the dice, the target and why each line scored as it did";
    b.addEventListener("click", () => cb.setMode(m));
    b.dataset.m = m;
    modeSwitch.append(b);
    return b;
  });
  titleRow.append(modeSwitch);
  const meter = el("div", "meter");
  const meterLabel = el("div", "meter-label", c.track);
  const meterValue = el("div", "meter-value");
  const meterDelta = el("span", "delta");
  const bar = el("div", "bar");
  const barFill = el("div", "fill");
  bar.append(barFill);
  const patience = el("div", "patience");
  meter.append(meterLabel, meterValue, bar, patience);
  const journalBtn = el("button", "journal-btn");
  const journalList = el("ul", "journal");
  journalBtn.addEventListener("click", () => journalList.classList.toggle("open"));
  head.append(titleRow, meter, journalBtn, journalList);

  const log = el("div", "log");
  const opening = el("div", "npc opening");
  opening.append(el("div", "speaker", npc.name));
  const openingText = el("div", "prose");
  prose(openingText, scenario.opening);
  opening.append(openingText);
  log.append(el("div", "setting", scenario.setting), opening);

  const foot = el("footer", "foot");
  const status = el("div", "status");
  const form = el("form", "composer");
  const input = el("textarea");
  input.rows = 2;
  const prompt = `Say something to ${npc.name}…`;
  input.placeholder = prompt;
  // Some themes draw the status inside the input box: only one of the three shows at a time.
  const sortBox = () => {
    input.placeholder = status.textContent ? "" : prompt;
    status.classList.toggle("muted", !!input.value);
  };
  new MutationObserver(sortBox).observe(status, { childList: true, characterData: true, subtree: true });
  input.addEventListener("input", sortBox);
  const sayBtn = el("button", "say", "Say");
  sayBtn.type = "submit";
  form.append(input, sayBtn);
  const hand = el("div", "hand");
  const actions = el("div", "actions");
  const dealBtn = el("button", "deal");
  const walkBtn = el("button", "walk", "Walk away");
  dealBtn.type = walkBtn.type = "button";
  dealBtn.addEventListener("click", () => cb.close("deal"));
  walkBtn.addEventListener("click", () => cb.close("walk"));
  if (c.kind === "haggle") actions.append(dealBtn);
  actions.append(walkBtn);
  const hint = el("div", "hint");
  const paintHint = () =>
    (hint.textContent = !chatBound
      ? `No chat open: Gambit voices ${npc.name} here only.`
      : narrator === "gambit"
        ? `Your words and ${npc.name}'s replies are posted to the chat; Gambit voices ${npc.name}.`
        : `Your words go to the chat; the chat's preset voices ${npc.name}.`);
  paintHint();
  const endBox = el("div", "end");
  foot.append(status, hand, form, actions, hint, endBox);
  side.append(head, log, foot);
  wrap.append(scene, side);
  root.append(style, wrap);
  let decor: ParleyDecor | null = null;
  try {
    decor = look?.decorate?.({ root: wrap, scene, side, scenario, state: initial, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches }) ?? null;
  } catch (e) {
    console.warn("[gambit] parley theme decoration failed", e);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    send();
  });
  // "/" reaches the box from anywhere in the talk, as in the scene.
  const onSlash = (e: KeyboardEvent) => {
    const t = e.composedPath()[0] as HTMLElement | null;
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || t?.tagName === "TEXTAREA" || t?.tagName === "INPUT" || !input.offsetParent) return;
    e.preventDefault();
    input.focus();
  };
  window.addEventListener("keydown", onSlash);
  if (!matchMedia("(pointer: coarse)").matches) requestAnimationFrame(() => input.offsetParent && input.focus({ preventScroll: true }));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send();
    }
  });
  function send() {
    const text = input.value.trim();
    if (!text || busy || state.end) return;
    busy = true;
    input.value = "";
    paintFoot();
    status.textContent = `${npc.name} weighs your words…`;
    pendingYou = addYou(text);
    cb.say(text);
    watchBusy();
  }
  /** Busy waits on the backend and the model. If nothing arrives for this long, hand the talk back rather than lock it. */
  let quiet: ReturnType<typeof setTimeout> | undefined;
  function watchBusy() {
    clearTimeout(quiet);
    if (!busy) return;
    quiet = setTimeout(() => {
      busy = false;
      status.textContent = `${npc.name} has gone quiet. You can keep talking.`;
      log.querySelectorAll(".prose.waiting").forEach((p) => p.classList.remove("waiting"));
      paintFoot();
    }, 180_000);
  }

  /* ---------------- figure and mood ---------------- */
  let showing: "a" | "b" = "a";
  let faceKey = npcArtKey(npc.id);
  /** The base face's figure stats, to judge expressions against. */
  let baseStats: FigureStats | undefined;
  /** Figure stats of every face shown, by art key (framing). */
  const artStats = new Map<string, FigureStats>();
  /** Where the face is in each picture, so a framed portrait's crop keeps it. */
  const artFaces = new Map<string, FaceBox | null>();
  /** Each picture's height over width. */
  const artAspects = new Map<string, number>();
  function setFace(key: string) {
    faceKey = key;
    const shownKey = art.has(key) ? key : npcArtKey(npc.id);
    const url = art.get(shownKey);
    if (!url) return;
    // Opaque art (a card's avatar or gallery picture) and busts (a card's square
    // Risu expression) are framed portraits, not rectangles pasted on the room or
    // heads peeking over the text box. Set with the picture it is for.
    const frame = () => {
      fig.classList.toggle("framed", framedPicture(baseStats?.coverage ?? artStats.get(shownKey)?.coverage ?? 0, artAspects.get(shownKey) ?? 0));
      const face = artFaces.get(shownKey) ?? artFaces.get(npcArtKey(npc.id));
      if (face) fig.style.setProperty("--face", facePosition(face));
      else fig.style.removeProperty("--face");
    };
    const [cur, next] = showing === "a" ? [imgA, imgB] : [imgB, imgA];
    if (cur.src === url) return frame();
    next.src = url;
    next.onload = () => {
      frame();
      next.classList.add("on");
      cur.classList.remove("on");
      showing = showing === "a" ? "b" : "a";
    };
    silhouette.classList.add("gone");
  }
  function setMood(mood: Mood | null) {
    for (const c of [...fig.classList]) if (c.startsWith("m-")) fig.classList.remove(c);
    void fig.offsetWidth;
    if (mood) fig.classList.add(`m-${mood}`);
    const ex = mood ? EXPRESSION_FOR_MOOD[mood] : null;
    setFace(ex ? expressionArtKey(npcArtKey(npc.id), ex) : npcArtKey(npc.id));
  }

  /* ---------------- header ---------------- */
  let shownValue = state.value;
  function paintHead() {
    wrap.dataset.mode = viewMode;
    modeBtns.forEach((b) => {
      b.classList.toggle("on", b.dataset.m === viewMode);
      b.setAttribute("aria-pressed", String(b.dataset.m === viewMode));
    });
    meterValue.textContent = formatValue(scenario, state.value);
    meterValue.append(meterDelta);
    const span = Math.max(1, c.start - c.hardFloor);
    barFill.style.width = `${Math.max(0, Math.min(100, ((state.value - c.hardFloor) / span) * 100))}%`;
    patience.textContent = "";
    patience.append(el("span", "pl-label", "Patience"));
    for (let i = 0; i < npc.stance.patience; i++) patience.append(el("i", i < state.patience ? "pip on" : "pip"));
    const facts = scenario.facts.filter((f) => known.has(f.id));
    journalBtn.textContent = `What you know (${facts.length})`;
    journalList.textContent = "";
    for (const f of facts) journalList.append(el("li", state.usedFacts.includes(f.id) ? "used" : "", f.text));
    hand.textContent = "";
    facts.forEach((f, i) => {
      const card = el("button", `fact-card${state.usedFacts.includes(f.id) ? " used" : ""}`, f.text);
      card.type = "button";
      card.title = "Play this card: cite it in what you say";
      card.style.setProperty("--tilt", `${(i - (facts.length - 1) / 2) * 6}deg`);
      card.addEventListener("click", () => {
        // Playing a card cites the fact; the Referee still reads the words, and code still checks you know it.
        const cite = `I know this: ${f.text.replace(/\.?$/, ".")}`;
        input.value = input.value.trim() ? `${input.value.trim()} ${cite}` : cite;
        input.focus();
      });
      hand.append(card);
    });
    if (!facts.length) journalList.append(el("li", "empty", "Nothing yet. Others here may know things."));
  }
  function bumpValue(from: number, to: number) {
    if (from === to) return;
    meterDelta.textContent = `${to < from ? "−" : "+"}${Math.abs(Math.round(to - from))}`;
    meterDelta.className = `delta show ${to < from ? "down" : "up"}`;
    setTimeout(() => (meterDelta.className = "delta"), 2400);
  }

  /* ---------------- log ---------------- */
  let pendingYou: HTMLElement | null = null;
  function addYou(text: string): HTMLElement {
    const you = el("div", "you");
    const said = el("div", "prose");
    prose(said, text, { speaker: "you" });
    you.append(el("div", "speaker", "You"), said);
    log.append(you);
    turnStart = you;
    scrollDown();
    return you;
  }
  /** On a phone, a turn longer than the log opens at its start: the player reads down from there. */
  let turnStart: HTMLElement | null = null;
  const scrollDown = () =>
    requestAnimationFrame(() => {
      const start = wrap.classList.contains("pl-phone") && turnStart?.isConnected ? turnStart : null;
      if (start) {
        const top = start.getBoundingClientRect().top - log.getBoundingClientRect().top + log.scrollTop;
        if (log.scrollHeight - top > log.clientHeight) {
          log.scrollTop = Math.max(0, top - 6);
          return;
        }
      }
      log.scrollTop = log.scrollHeight;
    });

  function readBlock(ex: Exchange): HTMLElement {
    const box = el("div", "read");
    const tray = el("div", "tray");
    const n = ex.roll.used.length;
    const dice: HTMLElement[] = [];
    for (let i = 0; i < n; i++) {
      const d = el("div", "die rolling", "20");
      dice.push(d);
      tray.append(d);
    }
    const res = el("div", `result r-${ex.roll.result}`, RESULT_WORD[ex.roll.result]);
    tray.append(res);
    box.append(tray);
    const imm = el("div", "imm", immersiveRead(scenario, ex));
    const trn = el("div", "trn");
    const chip = el("span", `tier t${ex.tier}`, `${TIER_NAMES[ex.tier]} · ${ex.read.tactic}`);
    const roll = el("div", "roll", rollLine(ex));
    const why = el("details", "why");
    why.append(el("summary", undefined, "Why?"), el("pre", undefined, whyText(scenario, ex)));
    // What the line showed of them is worth more than the numbers: it stands in the open, not behind "Why?".
    const lean = ex.nonsense ? "" : leanLine(scenario, ex);
    trn.append(chip, roll, ...(lean ? [el("div", `lean ${(ex.yieldStep ?? 0) > 0 ? "up" : "down"}`, lean)] : []), why);
    box.append(imm, trn);
    // The roll plays for about a second; the faces were fixed before it started.
    let t = 0;
    const spin = setInterval(() => {
      dice.forEach((d) => (d.textContent = String(1 + Math.floor(Math.random() * 20))));
      if ((t += 70) >= 900) {
        clearInterval(spin);
        const keep = ex.roll.natural;
        let kept = false;
        dice.forEach((d, i) => {
          const face = ex.roll.used[i]!;
          d.textContent = String(face);
          d.classList.remove("rolling");
          const isKept = !kept && face === keep;
          if (isKept) kept = true;
          d.classList.add(isKept ? "kept" : "dropped");
          if (isKept && face === 20) d.classList.add("nat20");
          if (isKept && face === 1) d.classList.add("nat1");
        });
        res.classList.add("show");
      }
    }, 70);
    return box;
  }

  function npcBlock(): HTMLElement {
    const box = el("div", "npc");
    box.append(el("div", "speaker", npc.name));
    const prose = el("div", "prose waiting");
    // Said in words while the reply is written: three dots alone read as a stuck screen, and a chat preset
    // can take a minute before its first word.
    prose.append(el("span", "wait", `${npc.name} is answering`), el("span", "dots", "…"));
    box.append(prose);
    if (chatBound && narrator === "chat")
      setTimeout(() => {
        if (prose.isConnected && prose.classList.contains("waiting")) prose.append(el("span", "slow", "Your chat's model is writing this reply. A long preset can take a minute or more."));
      }, 8000);
    return box;
  }

  let hush: ReturnType<typeof setTimeout> | undefined;
  function showReply(index: number) {
    const b = blocks.get(index);
    const r = replies.get(index);
    if (!b || !r || !b.ready) return;
    const box = b.npc.querySelector<HTMLElement>(".prose")!;
    box.classList.remove("waiting");
    prose(box, r.text, { streaming: !r.final });
    // The head moves with the line while it streams in, and settles a beat after.
    if (index === state.exchanges.length - 1) {
      clearTimeout(hush);
      puppets.talk(1);
      hush = setTimeout(() => puppets.talk(0), r.final ? 1400 : 2500);
    }
    if (r.final && index === state.exchanges.length - 1) {
      status.textContent = "";
      busy = false;
      paintFoot();
    }
    scrollDown();
  }

  /* ---------------- footer ---------------- */
  function paintFoot() {
    const over = !!state.end;
    const finalOffer = !over && state.exchanges.at(-1)?.ended?.kind === "final_offer";
    form.classList.toggle("hidden", over || finalOffer);
    actions.classList.toggle("hidden", over);
    hint.classList.toggle("hidden", over);
    // The box itself never locks: you can go on writing while they answer, it just can't be sent yet.
    sayBtn.disabled = busy;
    const short = !canPay(scenario, state.value);
    dealBtn.textContent = short ? `You have ${formatValue(scenario, scenario.purse ?? 0)}` : `${finalOffer ? "Take the final offer" : "Take it"} at ${formatValue(scenario, state.value)}`;
    dealBtn.disabled = busy || short;
    walkBtn.disabled = busy;
    endBox.textContent = "";
    endBox.classList.toggle("show", over);
    if (over) {
      const e = state.end!;
      const title =
        e.kind === "deal" ? `Deal: ${c.stake} for ${formatValue(scenario, e.value)}` : e.kind === "won" ? `${npc.name} gives in` : e.kind === "walked" ? "You walk away" : e.kind === "refused" ? `${npc.name} refuses` : "Over";
      endBox.append(el("div", "end-title", title));
      if (e.kind === "won" || e.kind === "deal") endBox.append(el("div", "end-sub", `Yours now: ${c.stake}.`));
      if (e.kind === "deal") {
        const saved = c.start - e.value;
        endBox.append(el("div", "end-sub", saved > 0 ? `${formatValue(scenario, saved)} under the asking price.` : "At the asking price."));
      }
      const learned = e.kind === "won" ? (scenario.reveals ?? []).map(journalFact).filter((f): f is string => !!f) : [];
      if (learned.length) {
        endBox.append(el("div", "end-sub", "New in your journal:"));
        const ul = el("ul", "reveals");
        for (const f of learned) ul.append(el("li", undefined, f));
        endBox.append(ul);
      }
      const leave = el("button", "leave", "Leave");
      leave.addEventListener("click", () => cb.leave());
      endBox.append(leave);
    } else if (finalOffer) {
      status.textContent = `${npc.name} is out of patience: final offer.`;
    } else if (!busy && c.winAt !== undefined && state.value <= state.floor && state.value > c.winAt) {
      // The track has stopped at its floor: only Leverage can move it now, so say so before another line costs patience.
      const unplayed = scenario.facts.some((f) => known.has(f.id) && f.floorShift && !state.usedFacts.includes(f.id));
      status.textContent = `${npc.name} won't move further on talk alone. ${unplayed ? "Use something you know." : "You'd need to learn more, or walk away."}`;
    }
  }
  const journalFact = (id: string): string | null => scenario.facts.find((f) => f.id === id)?.text ?? FACTS[id]?.text ?? null;

  /* ---------------- rebuild from a saved state ---------------- */
  function rebuild() {
    log.querySelectorAll(".you, .read, .npc:not(.opening)").forEach((n) => n.remove());
    blocks.clear();
    for (const ex of state.exchanges) {
      addYou(ex.text);
      const read = readBlockStatic(ex);
      const nb = npcBlock();
      log.append(read, nb);
      blocks.set(ex.index, { npc: nb, read, ready: true });
      if (ex.reply && !replies.has(ex.index)) replies.set(ex.index, { text: ex.reply, final: true });
      const r = replies.get(ex.index);
      if (r) showReply(ex.index);
      else {
        const prose = nb.querySelector<HTMLElement>(".prose")!;
        prose.classList.remove("waiting");
        prose.textContent = effectLine(scenario, ex);
      }
    }
    const last = state.exchanges.at(-1);
    setMood(last ? last.mood : null);
    const settled = last ? PUPPET_ACT[last.mood] : undefined;
    puppets.act(settled?.[0] ?? null, settled?.[1]);
    tellLine.textContent = "";
    scrollDown();
  }
  function readBlockStatic(ex: Exchange): HTMLElement {
    const b = readBlock(ex);
    // Saved exchanges show settled dice straight away.
    b.querySelectorAll<HTMLElement>(".die").forEach((d, i) => {
      d.classList.remove("rolling");
      d.textContent = String(ex.roll.used[i]);
    });
    let kept = false;
    b.querySelectorAll<HTMLElement>(".die").forEach((d, i) => {
      const isKept = !kept && ex.roll.used[i] === ex.roll.natural;
      if (isKept) kept = true;
      d.classList.add(isKept ? "kept" : "dropped");
    });
    b.querySelector(".result")?.classList.add("show");
    return b;
  }

  paintHead();
  paintFoot();
  rebuild();
  // Phones: fit the area the browser's bars and the keyboard leave, and say which layout applies (pl-phone, pl-short).
  const parent = wrap.parentElement;
  const vv = window.visualViewport;
  let lastFit = "";
  const fit = () => {
    const box = parent?.getBoundingClientRect();
    const w = Math.round(box?.width || window.innerWidth);
    const h = Math.round(Math.min(vv?.height ?? window.innerHeight, box?.height || Infinity));
    const key = `${w}x${h}:${vv?.offsetTop ?? 0}`;
    if (key === lastFit) return;
    lastFit = key;
    const phone = w <= 760 || h <= 480;
    wrap.classList.toggle("pl-phone", phone);
    wrap.classList.toggle("pl-short", phone && h < 480);
    wrap.style.setProperty("--pl-h", `${h}px`);
    wrap.style.height = phone ? `${h}px` : "";
    wrap.style.transform = phone && vv?.offsetTop ? `translateY(${Math.round(vv.offsetTop)}px)` : "";
    scrollDown();
  };
  fit();
  vv?.addEventListener("resize", fit);
  vv?.addEventListener("scroll", fit);
  window.addEventListener("resize", fit);
  const fitWatch = parent ? new ResizeObserver(fit) : null;
  if (parent) fitWatch?.observe(parent);
  // The theme fonts can arrive after the first layout and reflow the log; land on the newest line again.
  void document.fonts?.ready.then(() => scrollDown());

  return {
    parleyId: initial.id,
    setState(next, journalIds, m) {
      const rewound = next.exchanges.length < state.exchanges.length;
      state = next;
      viewMode = m;
      known = new Set([...next.known, ...journalIds]);
      busy = false;
      watchBusy();
      status.textContent = "";
      shownValue = state.value;
      paintHead();
      paintFoot();
      if (rewound || !log.querySelector(".you") || next.exchanges.some((e, i) => !blocks.has(i))) rebuild();
      decor?.update?.(state, [...known]);
    },
    exchange(next, ex, narrated) {
      state = next;
      decor?.update?.(next, [...known]);
      lastExchangeAt = Date.now();
      watchBusy();
      hideMoment();
      const from = shownValue;
      shownValue = next.value;
      if (pendingYou) pendingYou = null;
      else addYou(ex.text);
      const read = readBlock(ex);
      const nb = npcBlock();
      log.append(read);
      blocks.set(ex.index, { npc: nb, read, ready: false });
      status.textContent = narrated ? `${npc.name} answers…` : "";
      scrollDown();
      setTimeout(() => {
        // The talk closed while the dice were landing.
        if (!wrap.isConnected) return;
        log.append(nb);
        blocks.get(ex.index)!.ready = true;
        paintHead();
        bumpValue(from, next.value);
        setMood(ex.mood);
        // A caught bluff: a startle, then the step back; otherwise the mood's own gesture.
        const [expr, k, gesture] = PUPPET_ACT[ex.mood] ?? [null, 3];
        puppets.act(expr, k, ex.bluff?.caught ? "startle" : gesture);
        if (ex.bluff?.caught) setTimeout(() => puppets.act(expr, k, "step_back"), 450);
        tellLine.textContent = viewMode === "immersive" ? immersiveRead(scenario, ex) : "";
        tellLine.classList.remove("show");
        void tellLine.offsetWidth;
        tellLine.classList.add("show");
        showReply(ex.index);
        paintFoot();
        scrollDown();
      }, 1250);
    },
    judging(text) {
      busy = true;
      watchBusy();
      paintFoot();
      if (!pendingYou) pendingYou = addYou(text);
      status.textContent = `${npc.name} weighs your words…`;
    },
    reply(index, text, final) {
      replies.set(index, { text, final });
      showReply(index);
      watchBusy();
    },
    setArt(key, url, cutout) {
      if (key === placeArtKey(scenario.id)) {
        plateImg.src = url;
        plateImg.onload = () => plate.classList.add("painted");
        return;
      }
      const mi = momentIndexOf(key, state.id);
      if (mi !== null) {
        if (state.exchanges[mi]) addMoment(mi, url);
        return;
      }
      if (!key.startsWith(npcArtKey(npc.id))) return;
      // Generated expressions come on a flat ground and are keyed; art sent as drawn (cutout: true) never is.
      const needsKey = cutout === false || (isExpressionArtKey(key) && cutout !== true);
      void prepareArt(url, needsKey)
        .then(({ url: u, stats, face, aspect }) => {
          if (u !== url) objectUrls.push(u);
          if (key === npcArtKey(npc.id)) baseStats = stats;
          // A blank or off-model mood picture never replaces the face it was drawn from.
          else if (isExpressionArtKey(key) && !usableExpression(stats, baseStats)) {
            console.warn(`[Gambit] skipped an unusable expression for ${npc.name}: ${key}`, stats);
            return;
          }
          art.set(key, u);
          artStats.set(key, stats);
          artFaces.set(key, face);
          artAspects.set(key, aspect);
          if (key === npcArtKey(npc.id) || key === faceKey) setFace(faceKey);
        })
        .catch(() => {});
    },
    setNarrator(m) {
      narrator = m;
      paintHint();
    },
    setMode(m) {
      viewMode = m;
      paintHead();
      tellLine.textContent = "";
    },
    prefill(text) {
      input.value = input.value.trim() ? `${input.value.trim()} ${text}` : text;
      input.focus();
    },
    error(text) {
      busy = false;
      watchBusy();
      status.textContent = text;
      if (pendingYou) {
        pendingYou.remove();
        pendingYou = null;
      }
      paintFoot();
    },
    destroy() {
      vv?.removeEventListener("resize", fit);
      vv?.removeEventListener("scroll", fit);
      window.removeEventListener("resize", fit);
      window.removeEventListener("keydown", onSlash);
      fitWatch?.disconnect();
      try {
        decor?.destroy?.();
      } catch {
        // The view goes regardless.
      }
      if (momentTimer) clearTimeout(momentTimer);
      clearTimeout(quiet);
      puppets.destroy();
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
      style.remove();
      wrap.remove();
    },
  };
}
