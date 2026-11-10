/**
 * Parley harness (bun run preview, then /parley): the real Parley view on a
 * made-up haggle at a river ferry, with three exchanges already played, the
 * real engine for new lines (a canned Referee read) and painted stand-in art.
 * No Lumiverse needed. Query:
 *   ?theme=<id>        storybook | onebit | lobby | command (omit: the painted default)
 *   &ex=<n>            exchanges already played (0-3, default 3)
 *   &mode=transparent  show the dice maths (default immersive)
 *   &end=deal|walk     the contest is over
 *   &journal=1         open "What you know"
 *   &moment=1          play the moment still over the scene
 *   &img=<url>         NPC art (e.g. /api/v1/images/<id> with GAMBIT_PREVIEW_ART set); default a painted cut-out
 *   &bust=<url>        every mood's face is this picture (a card's square expression sprite)
 *   &place=<url>       place art; default a painted landing
 *   &opaque=1          the painted NPC on its own ground (shown as a framed portrait)
 *   &noart=1           no NPC art (the silhouette)
 *   &chat=0            no chat open; &narrator=chat the chat's preset voices the NPC
 *   &snap=1            no transitions or running animations (for screenshots)
 *   &bar=1             a theme picker; keys 0-6 switch theme too
 *   &wary=1            someone who remembers you badly, and caught you lying
 *   &purse=<n>         what you can pay (the fare is priced in your money)
 *   &long=1            a long name and stake, as real talks have them
 */
import { closeParley, createParley, applyExchange } from "../src/engine/parley/exchange.js";
import { DEFAULT_SPEAKER } from "../src/engine/content/parleys.js";
import { parleyMoment } from "../src/engine/parley/moments.js";
import type { Fact, ParleyScenario, ParleyState, RefereeRead, Tactic } from "../src/engine/parley/types.js";
import { expressionArtKey, momentArtKey, npcArtKey, placeArtKey } from "../src/shared/art-keys.js";
import { EXPRESSION_FOR_MOOD } from "../src/shared/parley-view.js";
import { THEMES, type ThemeId } from "../src/shared/scene-view.js";
import type { ParleyNarrator, ParleyViewMode } from "../src/shared/protocol.js";
import { mountParley, type ParleyView } from "../src/frontend/parley/view.js";

const q = new URLSearchParams(location.search);

/* ---------------------------- the scenario ---------------------------- */

const facts: Fact[] = [
  {
    id: "toll_doubled",
    text: "The river wardens doubled the crossing toll after the spring flood.",
    claim: "the wardens doubled the toll after the flood",
    leverage: 2,
    keywords: [["toll"], ["wardens"]],
  },
  {
    id: "cracked_keel",
    text: "Marrow's ferry has a cracked keel that he patches with pitch every dawn.",
    claim: "his ferry's keel is cracked and patched with pitch",
    leverage: 2,
    keywords: [["keel"], ["pitch"], ["leak"]],
    floorShift: 0.2,
  },
  {
    id: "weir_daughter",
    text: "Marrow's daughter keeps the lamp at the Weir House upriver; he has not seen her since autumn.",
    claim: "his daughter keeps the lamp at the Weir House",
    leverage: 1,
    keywords: [["daughter"], ["weir"]],
  },
  {
    id: "untaxed_salt",
    text: "Marrow ferries untaxed salt across for the Fenwick brothers on moonless nights.",
    claim: "he smuggles untaxed salt for the Fenwick brothers",
    leverage: 3,
    keywords: [["salt"], ["fenwick"], ["smuggle"]],
    floorShift: 0.5,
  },
];

const scenario: ParleyScenario = {
  id: "marrow_crossing",
  name: "Marrow's Crossing",
  blurb: "Haggle for a seat on the last ferry across the Greywater.",
  setting: "The last ferry landing on the Greywater at dusk: a sagging jetty, lanterns on poles, mist on black water.",
  opening: "\"Sixty crowns, and you sit where I tell you. The Greywater takes the careless, and I don't fish them out for free.\"",
  npc: {
    id: "marrow",
    name: q.get("long") ? "Captain Hollis Ashworth" : q.get("ko") ? "한소연" : "Marrow the Ferryman",
    role: "keeper of the last ferry across the Greywater",
    pronoun: "he",
    voice: "Slow and gravelly, every word weighed like cargo; dry humour, no patience for haste.",
    look: {
      tags: "old man, hooded grey cloak, long white beard, lantern, ferry pole",
      description: "an old ferryman in a hooded grey cloak with a long white beard, holding a lantern and a pole",
      sex: "boy",
      palette: "#3b4a5a,#c9a865,#6b3a2a",
    },
    stance: {
      temperament: { warmth: 0.35, pride: 0.6, greed: 0.55, fear: 0.3 },
      wants: ["coin for the keel", "news of his daughter", "a quiet crossing"],
      fears: ["the river wardens", "the Fenwick brothers talking"],
      respects: ["plain dealing", "people who know the river"],
      despises: ["haste", "threats on his own boat"],
      likesTactics: ["interest", "empathy"],
      hatesTactics: ["threat"],
      insight: 3,
      patience: 5,
      tells: {
        irritated: "spits into the black water",
        tempted: "weighs the lantern as if it were a purse",
        considering: "leans on the pole and looks at the far bank",
        unmoved: "goes back to coiling the mooring line",
        suspicious: "narrows his eyes under the hood",
        moved: "looks upriver, toward the Weir House",
        afraid: "glances along the bank for warden lamps",
        amused: "lets out a dry wheeze of a laugh",
        confused: "tilts his hood like a heron",
      },
      secrets: [{ fact: "untaxed_salt", leverage: 3 }],
    },
  },
  contest: { kind: "haggle", track: "fare", stake: q.get("long") ? "a room for the night with the two-coppers discount" : "passage across the Greywater", unit: "crowns", money: true, start: 60, floor: 42, hardFloor: 24, dc: 13 },
  facts,
  known: ["toll_doubled", "cracked_keel", "weir_daughter"],
  speaker: DEFAULT_SPEAKER,
  ...(q.get("wary") ? { history: { rapport: -1, caughtLies: 1, feel: "wary", remembers: ["caught you lying on day 1"] } } : {}),
  ...(q.get("purse") ? { purse: Number(q.get("purse")) } : {}),
};

const read = (tactic: Tactic, over: Partial<RefereeRead> = {}): RefereeRead => ({
  tactic,
  tacticP: { [tactic]: 0.8 },
  fit: 2,
  credibility: 2,
  temperament: 2.5,
  asserts: {},
  otherClaim: 0,
  by: "rules",
  ...over,
});

const PLAYED: { text: string; read: RefereeRead; reply: string }[] = [
  {
    text: "Sixty is robbery. The wardens doubled the toll, sure, but nobody has sat on that bench all evening.",
    read: read("logic", { fit: 2.4, credibility: 2.6, temperament: 3, asserts: { toll_doubled: 0.9 } }),
    reply:
      "*He leans on the pole and looks at the far bank.* \"Doubled it, they did. And who pays the wardens? Not the river.\"\n\n\"Fifty-four. The bench is empty because folk with sense crossed at noon.\"",
  },
  {
    text: "Your keel's patched with pitch, Marrow. I'd want a few crowns back for the bailing.",
    read: read("interest", { fit: 2.8, credibility: 3, temperament: 3.5, asserts: { cracked_keel: 0.85 } }),
    reply: "*A dry wheeze of a laugh.* \"Sharp eyes. She leaks a cup an hour, no more.\" *He taps the hull with his boot.* \"Forty-eight, and you hold the bucket.\"",
  },
  {
    text: "*I set my pack down.* \"Forty, and I'll carry a letter to your daughter at the Weir House. I'm going that way anyway.\"",
    read: read("empathy", { fit: 3, credibility: 2.6, temperament: 3.8, asserts: { weir_daughter: 0.9 } }),
    reply:
      "*He looks upriver for a long moment, toward a lamp you can barely see.*\n\n\"...She'd want it in her hand, not left on the step. Swear it, and we'll talk about forty.\"",
  },
];

let state: ParleyState = createParley(scenario, "harness-seed", null);
const played = Math.max(0, Math.min(PLAYED.length, Number(q.get("ex") ?? PLAYED.length)));
for (const p of PLAYED.slice(0, played)) {
  const r = applyExchange(scenario, state, p.text, p.read);
  r.exchange.reply = p.reply;
  state = r.state;
}
const end = q.get("end");
if (end === "deal" || end === "walk") state = closeParley(scenario, state, end);
// Learned elsewhere (another talk): in the journal, not yet played.
const journal: string[] = ["untaxed_salt"];

/* ------------------------------ stand-in art ------------------------------ */

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
}

/** The landing at dusk: sky, the far bank, black water, a jetty and its lanterns. */
function paintPlace(): string {
  const [c, g] = canvas(1600, 1000);
  const sky = g.createLinearGradient(0, 0, 0, 560);
  sky.addColorStop(0, "#1b2233");
  sky.addColorStop(0.55, "#5a4a5a");
  sky.addColorStop(1, "#c98a5a");
  g.fillStyle = sky;
  g.fillRect(0, 0, 1600, 560);
  g.fillStyle = "#1c1a22";
  g.beginPath();
  g.moveTo(0, 520);
  for (let x = 0; x <= 1600; x += 40) g.lineTo(x, 500 - Math.sin(x / 130) * 18 - Math.sin(x / 47) * 7 - (x > 1100 ? (x - 1100) / 6 : 0));
  g.lineTo(1600, 600);
  g.lineTo(0, 600);
  g.fill();
  const water = g.createLinearGradient(0, 540, 0, 1000);
  water.addColorStop(0, "#3a3440");
  water.addColorStop(1, "#08090c");
  g.fillStyle = water;
  g.fillRect(0, 540, 1600, 460);
  g.strokeStyle = "rgba(230,170,110,.25)";
  for (let i = 0; i < 70; i++) {
    const y = 560 + Math.pow(i / 70, 1.6) * 430;
    const x = 700 + Math.sin(i * 7.3) * 260;
    g.lineWidth = 1 + (i / 70) * 3;
    g.beginPath();
    g.moveTo(x - 30 - i, y);
    g.lineTo(x + 30 + i, y);
    g.stroke();
  }
  g.fillStyle = "#2a1c12";
  g.beginPath();
  g.moveTo(1000, 1000);
  g.lineTo(1180, 640);
  g.lineTo(1260, 640);
  g.lineTo(1600, 1000);
  g.fill();
  g.strokeStyle = "#140d08";
  g.lineWidth = 3;
  for (let i = 1; i < 14; i++) {
    const t = i / 14;
    g.beginPath();
    g.moveTo(1180 - t * 180, 640 + t * 360);
    g.lineTo(1260 + t * 340, 640 + t * 360);
    g.stroke();
  }
  for (const [x, y, s] of [
    [1150, 600, 1],
    [1330, 560, 1.4],
    [420, 470, 0.5],
  ] as const) {
    g.fillStyle = "#120c08";
    g.fillRect(x - 3 * s, y, 6 * s, 420 * s);
    const glow = g.createRadialGradient(x, y, 0, x, y, 120 * s);
    glow.addColorStop(0, "rgba(255,210,120,.95)");
    glow.addColorStop(0.15, "rgba(255,170,80,.55)");
    glow.addColorStop(1, "rgba(255,140,60,0)");
    g.fillStyle = glow;
    g.beginPath();
    g.arc(x, y, 120 * s, 0, Math.PI * 2);
    g.fill();
  }
  const mist = g.createLinearGradient(0, 470, 0, 640);
  mist.addColorStop(0, "rgba(200,190,200,0)");
  mist.addColorStop(0.5, "rgba(200,190,200,.28)");
  mist.addColorStop(1, "rgba(200,190,200,0)");
  g.fillStyle = mist;
  g.fillRect(0, 470, 1600, 170);
  return c.toDataURL("image/jpeg", 0.9);
}

/** Marrow as a cut-out: hooded cloak, white beard, a lantern in one hand and the pole in the other. */
function paintFigure(w = 768, h = 1024, opaque = false): string {
  const [c, g] = canvas(w, h);
  const s = w / 768;
  g.scale(s, s);
  if (opaque) {
    const bg = g.createLinearGradient(0, 0, 0, 1024);
    bg.addColorStop(0, "#3a3446");
    bg.addColorStop(1, "#140f12");
    g.fillStyle = bg;
    g.fillRect(0, 0, 768, 1024);
  }
  // The pole.
  g.strokeStyle = "#4a3020";
  g.lineWidth = 16;
  g.beginPath();
  g.moveTo(560, 40);
  g.lineTo(610, 1024);
  g.stroke();
  // The cloak.
  const cloak = g.createLinearGradient(160, 200, 620, 1024);
  cloak.addColorStop(0, "#6f7682");
  cloak.addColorStop(0.5, "#3e4450");
  cloak.addColorStop(1, "#1d2028");
  g.fillStyle = cloak;
  g.beginPath();
  g.moveTo(384, 150);
  g.bezierCurveTo(250, 150, 220, 300, 230, 400);
  g.bezierCurveTo(150, 520, 110, 800, 100, 1024);
  g.lineTo(680, 1024);
  g.bezierCurveTo(660, 800, 620, 520, 540, 400);
  g.bezierCurveTo(550, 300, 520, 150, 384, 150);
  g.fill();
  g.strokeStyle = "rgba(20,22,28,.6)";
  g.lineWidth = 6;
  for (const x of [300, 384, 470]) {
    g.beginPath();
    g.moveTo(x, 470);
    g.quadraticCurveTo(x + (x - 384) * 0.3, 760, x + (x - 384) * 0.6, 1024);
    g.stroke();
  }
  // The face in the hood.
  g.fillStyle = "#16141a";
  g.beginPath();
  g.ellipse(384, 330, 92, 120, 0, 0, Math.PI * 2);
  g.fill();
  const skin = g.createRadialGradient(370, 300, 10, 384, 320, 90);
  skin.addColorStop(0, "#e2b896");
  skin.addColorStop(1, "#8a5a44");
  g.fillStyle = skin;
  g.beginPath();
  g.ellipse(384, 320, 66, 84, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#2a1a14";
  g.fillRect(348, 300, 22, 8);
  g.fillRect(398, 300, 22, 8);
  // The beard.
  const beard = g.createLinearGradient(0, 330, 0, 560);
  beard.addColorStop(0, "#f2efe8");
  beard.addColorStop(1, "#b8b2a8");
  g.fillStyle = beard;
  g.beginPath();
  g.moveTo(320, 340);
  g.quadraticCurveTo(384, 380, 448, 340);
  g.quadraticCurveTo(450, 470, 384, 570);
  g.quadraticCurveTo(318, 470, 320, 340);
  g.fill();
  // The hand and lantern.
  g.fillStyle = "#c4936e";
  g.beginPath();
  g.ellipse(250, 610, 30, 24, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#20160e";
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(250, 620);
  g.lineTo(250, 660);
  g.stroke();
  const glow = g.createRadialGradient(250, 720, 4, 250, 720, 120);
  glow.addColorStop(0, "rgba(255,230,150,1)");
  glow.addColorStop(0.25, "rgba(255,180,80,.6)");
  glow.addColorStop(1, "rgba(255,150,60,0)");
  g.fillStyle = glow;
  g.beginPath();
  g.arc(250, 720, 120, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#2a1c10";
  g.fillRect(212, 660, 76, 12);
  g.fillRect(212, 770, 76, 12);
  g.strokeRect(218, 672, 64, 98);
  g.fillStyle = "#ffd880";
  g.fillRect(222, 676, 56, 90);
  return c.toDataURL("image/png");
}

/** A moment: Marrow close up, lantern raised, the water behind him. */
function paintMoment(): Promise<string> {
  const [c, g] = canvas(1216, 832);
  const bg = g.createLinearGradient(0, 0, 0, 832);
  bg.addColorStop(0, "#2a2438");
  bg.addColorStop(0.6, "#7a5a52");
  bg.addColorStop(1, "#0c0a0e");
  g.fillStyle = bg;
  g.fillRect(0, 0, 1216, 832);
  const img = new Image();
  img.src = paintFigure(900, 1200);
  return new Promise<string>((res) => {
    img.onload = () => {
      g.drawImage(img, 160, 40, 900, 1200);
      res(c.toDataURL("image/jpeg", 0.88));
    };
  });
}

/* ------------------------------ mounting ------------------------------ */

const host = document.getElementById("host")!;
const shadow = host.attachShadow({ mode: "open" });
const root = document.createElement("div");
root.style.cssText = "position:absolute;inset:0;";
shadow.appendChild(root);
// &snap=1: no transitions or running animations, so a screenshot of a background tab shows the settled page.
if (q.get("snap") === "1") {
  const st = document.createElement("style");
  st.textContent = ".pl *, .pl *::before, .pl *::after { transition: none !important; animation-play-state: paused !important; } .pl .log { scroll-behavior: auto !important; }";
  shadow.appendChild(st);
}

const themeParam = q.get("theme");
const theme = THEMES.some((t) => t.id === themeParam) ? (themeParam as ThemeId) : undefined;
let mode: ParleyViewMode = q.get("mode") === "transparent" ? "transparent" : "immersive";
const narrator: ParleyNarrator = q.get("narrator") === "chat" ? "chat" : "gambit";

let view: ParleyView;
let replyTimer: ReturnType<typeof setInterval> | undefined;
// &inroom=1: the scene behind this page stages the talk in its room (preview/scene.ts &encounter=parley).
if (q.get("inroom") === "1") document.documentElement.style.background = document.body.style.background = "transparent";
view = mountParley(root, scenario, state, journal, mode, { chatBound: q.get("chat") !== "0", narrator, theme, inRoom: q.get("inroom") === "1" }, {
  say(text) {
    view.judging(text);
    setTimeout(() => {
      const lucky = (text.length % 7) / 7;
      const r = applyExchange(scenario, state, text, read("interest", { fit: 1.5 + lucky * 1.5, credibility: 2 + lucky, temperament: 2 + lucky * 2 }));
      state = r.state;
      view.exchange(state, r.exchange, true);
      const words = "*He turns the words over like a coin he suspects is clipped.* \"Hm. You talk like a merchant and dress like a mule driver. Go on, then. Make it worth the lamp oil.\"".split(" ");
      let n = 0;
      clearInterval(replyTimer);
      replyTimer = setInterval(() => {
        n += 3;
        const done = n >= words.length;
        view.reply(r.exchange.index, words.slice(0, n).join(" "), done);
        if (done) clearInterval(replyTimer);
      }, 90);
    }, 700);
  },
  close(how) {
    state = closeParley(scenario, state, how);
    view.setState(state, journal, mode);
  },
  setMode(m) {
    mode = m;
    view.setMode(m);
  },
  leave() {
    location.reload();
  },
});

view.setArt(placeArtKey(scenario.id), q.get("place") ?? paintPlace());
if (q.get("noart") !== "1") view.setArt(npcArtKey(scenario.npc.id), q.get("img") ?? paintFigure(768, 1024, q.get("opaque") === "1"), true);
// Every mood's face is this picture, as a card's square Risu expression would be.
const bust = q.get("bust");
if (bust) for (const ex of new Set(Object.values(EXPRESSION_FOR_MOOD))) if (ex) view.setArt(expressionArtKey(npcArtKey(scenario.npc.id), ex), bust, true);

// A moment for the exchanges that are moments (or the last one), as the backend would send them.
const momentFor = state.exchanges.filter((ex) => parleyMoment(scenario, ex)).map((ex) => ex.index);
if (!momentFor.length && state.exchanges.length) momentFor.push(state.exchanges.length - 1);
void paintMoment().then((url) => {
  for (const i of momentFor) view.setArt(momentArtKey(state.id, i), url);
  if (q.get("moment") === "1") setTimeout(() => shadow.querySelector<HTMLButtonElement>(".moments button:last-child")?.click(), 300);
});

if (q.get("journal") === "1") setTimeout(() => shadow.querySelector<HTMLButtonElement>(".journal-btn")?.click(), 50);

/* ------------------------------ theme switching ------------------------------ */

const ids: (ThemeId | "")[] = ["", ...THEMES.map((t) => t.id)];
function go(id: string) {
  const next = new URLSearchParams(location.search);
  if (id) next.set("theme", id);
  else next.delete("theme");
  location.search = next.toString();
}
addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement)?.closest?.("textarea, input") || e.composedPath().some((n) => n instanceof HTMLTextAreaElement)) return;
  const i = Number(e.key);
  if (Number.isInteger(i) && i >= 0 && i < ids.length) go(ids[i]!);
});
if (q.get("bar") === "1") {
  const bar = document.getElementById("bar")!;
  bar.classList.add("on");
  const sel = document.createElement("select");
  for (const id of ids) sel.append(new Option(id || "default", id, false, id === (theme ?? "")));
  sel.addEventListener("change", () => go(sel.value));
  bar.append(sel);
}
(window as unknown as { parley: unknown }).parley = { view, scenario, get state() { return state; } };
