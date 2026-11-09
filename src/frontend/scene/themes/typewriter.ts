/**
 * A typewriter to write on, for the rooms with a table or a counter to stand it on (Table, Diorama). The page in the
 * roller is the field; the machine is drawn, and answers: the key you pressed dips, a type bar strikes, the carriage
 * creeps along, and Return throws it back with a bell. While a reply is being written the bars strike by themselves.
 * A room sets its own enamel with the --tw-* colours, and says where it stands.
 */
import type { ThemeCtx } from "./contract.js";
import { WRITE_PROMPT, wireWrite, type WriteBox } from "./write.js";

/** Each machine needs its own gradient ids: one hidden with display:none takes its gradients with it. */
let uid = 0;

const ROWS = ["QWERTYUIOP", "ASDFGHJKL"];
const BARS = 25;

function machine(): string {
  const id = `tw${++uid}`;
  const keys = ROWS.map((row, r) =>
    [...row]
      .map((ch, i) => {
        const x = 320 + (i - (row.length - 1) / 2) * 44 + (r ? 8 : 0);
        const y = 84 + r * 25;
        return `<g class="k" data-k="${ch}"><circle cx="${x}" cy="${y}" r="13.5" fill="url(#${id}c)" stroke="#000" stroke-width="1"/><circle cx="${x}" cy="${y}" r="10.5" fill="var(--tw-cap)"/><text x="${x}" y="${y + 3.6}" text-anchor="middle" font-family="Gambit Cinzel, Georgia, serif" font-size="10.5" font-weight="700" fill="var(--tw-legend)">${ch}</text></g>`;
      })
      .join(""),
  ).join("");
  const bars = Array.from({ length: BARS }, (_, i) => {
    const a = Math.PI * (0.06 + (0.88 * i) / (BARS - 1));
    const x = 320 - Math.cos(a) * 62;
    const y = 72 - Math.sin(a) * 30;
    return `<line class="tbar" x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(320 + (x - 320) * 0.28).toFixed(1)}" y2="${(42 + (y - 72) * 0.1).toFixed(1)}" stroke="url(#${id}c)" stroke-width="1.7" stroke-linecap="round"/>`;
  }).join("");
  const ribs = (x0: number) => Array.from({ length: 6 }, (_, i) => `<path d="M${x0 + 3 + i * 4.4} 7 V25" stroke="#000" stroke-opacity=".6" stroke-width="1.1"/>`).join("");
  const spool = (x: number) =>
    `<circle cx="${x}" cy="47" r="24" fill="url(#${id}c)" stroke="#000" stroke-width="1.4"/><circle cx="${x}" cy="47" r="19.5" fill="var(--tw-ribbon)"/><circle cx="${x}" cy="47" r="19.5" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="5" stroke-dasharray="1 2.5"/><circle cx="${x}" cy="47" r="7" fill="url(#${id}c)" stroke="#000"/><path d="M${x - 4} 47 H${x + 4} M${x} 43 V51" stroke="#000" stroke-width="1.2"/>`;
  return `<svg viewBox="0 0 640 128" aria-hidden="true"><defs>
<linearGradient id="${id}e" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--tw-a)"/><stop offset="1" style="stop-color:var(--tw-b)"/></linearGradient>
<linearGradient id="${id}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f1e6"/><stop offset=".45" stop-color="#a9a698"/><stop offset=".55" stop-color="#6d6a5e"/><stop offset="1" stop-color="#cfccbd"/></linearGradient>
<linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b3a38"/><stop offset=".3" stop-color="#1a1918"/><stop offset="1" stop-color="#050505"/></linearGradient>
</defs>
<path d="M78 30 H562 Q580 30 586 46 L622 118 Q626 128 612 128 H28 Q14 128 18 118 L54 46 Q60 30 78 30Z" fill="url(#${id}e)" stroke="#000" stroke-width="2"/>
<path d="M84 36 H556 Q572 36 578 50 L610 118 M30 118 L62 50 Q68 36 84 36" fill="none" style="stroke:var(--tw-trim)" stroke-width="1.3" opacity=".85"/>
<path d="M258 72 A62 30 0 0 1 382 72 Z" fill="#050505" stroke="#000"/>
${bars}
<path d="M210 40 H430" style="stroke:var(--tw-ribbon)" stroke-width="6"/>
<rect x="312" y="35" width="16" height="11" rx="1.5" fill="url(#${id}c)" stroke="#000"/>
${spool(186)}${spool(454)}
${keys}
<g class="k" data-k=" "><rect x="214" y="122" width="212" height="14" rx="6" fill="url(#${id}c)" stroke="#000"/></g>
<g class="cg">
<path d="M34 8 C26 -6 16 -14 4 -22" fill="none" stroke="url(#${id}c)" stroke-width="5" stroke-linecap="round"/><circle cx="3" cy="-23" r="6.5" fill="url(#${id}c)" stroke="#000"/>
<rect x="56" y="5" width="528" height="22" rx="10" fill="url(#${id}r)" stroke="#000"/>
<path d="M66 10 H574" stroke="#fff" stroke-opacity=".16" stroke-width="2" stroke-linecap="round"/>
<rect x="28" y="4" width="30" height="24" rx="4" fill="url(#${id}c)" stroke="#000"/>${ribs(30)}
<rect x="582" y="4" width="30" height="24" rx="4" fill="url(#${id}c)" stroke="#000"/>${ribs(584)}
<path d="M74 21 H566" stroke="url(#${id}c)" stroke-width="2.4"/><rect x="170" y="17" width="20" height="8" rx="4" fill="#111" stroke="#777"/><rect x="450" y="17" width="20" height="8" rx="4" fill="#111" stroke="#777"/>
</g></svg>`;
}

/** The form: the page, the machine over its foot, and the key that sends it. */
export function typewriterHtml(cls: string): string {
  return `<form class="tw ${cls}" hidden><div class="tw-m"><div class="tw-page"><textarea rows="1" data-write aria-label="${WRITE_PROMPT}" aria-keyshortcuts="/" placeholder="${WRITE_PROMPT}" enterkeyhint="send"></textarea></div>${machine()}<button type="submit" aria-label="Write it">Return</button></div></form>`;
}

export const TYPEWRITER_CSS = `
.tw { --tw-a: #2a2a2e; --tw-b: #08080a; --tw-trim: #c8a45a; --tw-ribbon: #8f1a1e; --tw-cap: #14120f; --tw-legend: #efe6d0; isolation: isolate; }
.tw[hidden] { display: none; }
.tw-m { position: relative; }
.tw-m > svg { position: relative; z-index: 2; display: block; width: 100%; height: auto; overflow: visible; pointer-events: none; filter: drop-shadow(0 5px 9px rgba(0,0,0,.75)); }
.tw-page { position: absolute; z-index: 1; left: 9%; right: 20%; bottom: 84%; box-sizing: border-box; padding: 7px 10px 13px; background: linear-gradient(180deg, #f6efdc, #eadfc4 80%, #b9ac8c); box-shadow: 0 -2px 8px rgba(0,0,0,.45), inset 0 0 0 1px rgba(90,70,35,.2); transform: translateX(var(--tw-shift, 0)); transition: transform .07s linear; cursor: text; }
.tw-page textarea { display: block; width: 100%; box-sizing: border-box; min-height: 1.3em; margin: 0; padding: 0; border: 0; border-radius: 0; outline: 0; resize: none; overflow: hidden; background: transparent; color: #1a1510; caret-color: #8f1a1e; font: 700 max(15px, 1.9cqh)/1.3 "American Typewriter", "Courier Prime", "Courier New", Courier, monospace; }
.tw-page textarea::placeholder { color: #6a5c42; opacity: 1; font-weight: 400; }
.tw-page:focus-within { background: linear-gradient(180deg, #fffaea, #f1e7cd 80%, #b9ac8c); }
.tw-page:has(textarea:disabled) { filter: brightness(.82); }
.tw-m > button { position: absolute; z-index: 3; right: 0; bottom: 86%; width: 18%; min-width: 58px; min-height: 34px; padding: 0 2px; border: 2px solid #8d8a7c; border-radius: 17px; background: radial-gradient(ellipse at 50% 30%, #3a3833, #0d0c0a); box-shadow: 0 0 0 1px #000, 0 3px 6px rgba(0,0,0,.7); color: #efe6d0; font: 800 max(10px, 1.25cqh)/1 "Gambit Cinzel", Georgia, serif; letter-spacing: .06em; cursor: pointer; transition: transform .06s; }
.tw-m > button:hover:not(:disabled), .tw-m > button:focus-visible { border-color: #e8d9a8; color: #fff; outline: 0; }
.tw-m > button:active:not(:disabled) { transform: translateY(2px); }
.tw-m > button:disabled { opacity: .6; cursor: default; }
.tw .cg { transform: translateX(var(--tw-shift, 0)); transition: transform .07s linear; }
.tw .k { transform-box: fill-box; transition: transform .05s; }
.tw .k.dn { transform: translateY(3px); }
.tw .tbar { transform-box: fill-box; transform-origin: 50% 100%; }
.tw .tbar.st { stroke: #fff; transform: translateY(-5px); }
/* Return: the carriage flies home and the page feeds up a line. */
.tw.ret .cg, .tw.ret .tw-page { transition: transform .26s cubic-bezier(.2,.8,.3,1); }
.tw.ret .tw-page { animation: twFeed .34s ease-out; }
@keyframes twFeed { 0% { translate: 0 0; } 40% { translate: 0 -9px; } 100% { translate: 0 0; } }
/* A reply on its way: the machine is writing it. */
@keyframes twStrike { 0%, 70%, 100% { transform: none; } 80% { transform: translateY(-5px); } }
.tw:has(textarea:disabled) .tbar { animation: twStrike .9s linear infinite; }
.tw:has(textarea:disabled) .tbar:nth-of-type(3n) { animation-delay: .3s; }
.tw:has(textarea:disabled) .tbar:nth-of-type(3n+1) { animation-delay: .6s; }
@media (prefers-reduced-motion: reduce) {
  .tw .cg, .tw-page, .tw .k { transition: none; }
  .tw.ret .tw-page, .tw:has(textarea:disabled) .tbar { animation: none; }
}
`;

/* -------------------------------- The sound of it -------------------------------- */
// Made here, not from files: a typewriter is a click of noise and a bell. Quiet, under the scene's music.
let audio: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function ear(): AudioContext | null {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume().catch(() => {});
    if (!noise) {
      noise = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.05), audio.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return audio;
  } catch {
    return null;
  }
}

function click(at: number, freq: number, vol: number, len = 0.028): void {
  const a = audio!;
  const src = a.createBufferSource();
  src.buffer = noise;
  const f = a.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = 0.9;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + len);
  src.connect(f).connect(g).connect(a.destination);
  src.start(at);
  src.stop(at + len + 0.01);
}

function clack(soft: boolean): void {
  const a = ear();
  if (!a) return;
  try {
    const t = a.currentTime;
    click(t, soft ? 1500 : 2400 + Math.random() * 900, soft ? 0.05 : 0.11);
    if (!soft) click(t + 0.012, 620 + Math.random() * 160, 0.1, 0.04);
  } catch {
    /* No sound: the keys still move. */
  }
}

function bell(): void {
  const a = ear();
  if (!a) return;
  try {
    const t = a.currentTime;
    for (let i = 0; i < 7; i++) click(t + i * 0.032, 1900, 0.06, 0.018);
    const o = a.createOscillator();
    o.type = "sine";
    o.frequency.value = 2350;
    const g = a.createGain();
    g.gain.setValueAtTime(0.05, t + 0.24);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
    o.connect(g).connect(a.destination);
    o.start(t + 0.24);
    o.stop(t + 0.86);
  } catch {
    /* No sound: the carriage still flies. */
  }
}

/** The shared write box, with a machine answering it. */
export function wireTypewriter(ctx: ThemeCtx, form: HTMLFormElement, maxRows = 3): WriteBox {
  const keys = [...form.querySelectorAll<SVGGElement>(".k")];
  const bars = [...form.querySelectorAll<SVGLineElement>(".tbar")];
  const flick = (el: Element | undefined, cls: string, ms: number) => {
    if (!el || ctx.reducedMotion) return;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
  };
  let returnTimer: ReturnType<typeof setTimeout> | undefined;
  const write = wireWrite(ctx, form, {
    maxRows,
    onSend: () => {
      form.classList.add("ret");
      form.style.setProperty("--tw-shift", "0px");
      clearTimeout(returnTimer);
      returnTimer = setTimeout(() => form.classList.remove("ret"), 380);
      bell();
    },
  });
  write.field.addEventListener("input", (e) => {
    const typed = (e as InputEvent).data ?? "";
    const ch = typed.slice(-1).toUpperCase();
    const erasing = (e as InputEvent).inputType?.startsWith("delete");
    clack(erasing || !typed);
    const key = keys.find((k) => k.dataset.k === ch) ?? keys[Math.floor(Math.random() * keys.length)];
    flick(key, "dn", 90);
    if (!erasing && ch !== " ") flick(bars[Math.floor(Math.random() * bars.length)], "st", 70);
    // The carriage creeps left as the line runs on, and back at the end of each.
    if (!ctx.reducedMotion) form.style.setProperty("--tw-shift", `${-(write.field.value.length % 36) * 0.35}px`);
  });
  return write;
}
