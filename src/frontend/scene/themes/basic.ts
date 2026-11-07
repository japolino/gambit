/**
 * A plain working layout: the stand-in each theme starts from. Not a theme
 * anyone should ship; every real theme replaces it entirely.
 */
import { esc, type ThemeCtx, type ThemeFactory, type ThemeRenderer } from "./contract.js";

export function basicTheme(name: string): ThemeFactory {
  return (ctx: ThemeCtx): ThemeRenderer => {
    const r = ctx.root;
    r.innerHTML = `<style>
      .bx { position: absolute; inset: 0; display: grid; grid-template-columns: 1fr 320px; }
      .bx .view { position: relative; } .bx .side { background: #111; overflow: auto; padding: 12px; display: grid; align-content: start; gap: 6px; }
      .bx button { font: inherit; color: inherit; background: #222; border: 1px solid #555; padding: 6px 10px; text-align: left; cursor: pointer; }
      .bx .figs { position: absolute; left: 0; right: 0; bottom: 0; display: flex; gap: 8px; padding: 8px; } .bx .figs img { height: 220px; }
    </style><div class="bx"><div class="view"></div><div class="side"></div></div>`;
    r.querySelector(".view")!.append(ctx.world);
    const figs = document.createElement("div");
    figs.className = "figs";
    r.querySelector(".view")!.append(figs);
    const side = r.querySelector(".side") as HTMLDivElement;
    return {
      render(v) {
        ctx.backdrop(v, { post: "paper" });
        const s = ctx.status(v);
        const b = ctx.box(v);
        side.innerHTML = `<b>${esc(name)}: ${esc(s.where)}</b><div>Day ${s.day} ${esc(s.time)} · ${s.coin} ${esc(s.currency)} · vigor ${Math.round(s.vigor * 100)}%</div><p>${esc(b.desc)}</p>${b.log.map((l) => `<div>${esc(l)}</div>`).join("")}`;
        for (const m of ctx.menu(v)) {
          const bt = document.createElement("button");
          bt.textContent = m.label;
          bt.onclick = m.run;
          side.append(bt);
        }
        for (const [label, fn] of [["Journal", ctx.journal.toggle], ["Classes", ctx.classes.toggle]] as const) {
          const bt = document.createElement("button");
          bt.textContent = label;
          bt.onclick = fn;
          side.append(bt);
        }
        const sel = document.createElement("select");
        sel.innerHTML = ctx.themes.map((t) => `<option value="${t.id}" ${t.id === v.theme ? "selected" : ""}>${t.label}</option>`).join("");
        sel.onchange = () => ctx.setTheme(sel.value as never);
        side.append(sel);
        if (ctx.journal.open) side.insertAdjacentHTML("beforeend", `<div>${ctx.journal.html(v)}</div>`);
        figs.innerHTML = "";
        for (const p of ctx.people(v)) {
          const a = ctx.personArt(v, p.id);
          if (!a) continue;
          const img = document.createElement("img");
          img.src = a.url;
          img.alt = p.name;
          img.onclick = p.talk;
          figs.append(img);
        }
      },
      destroy() {},
    };
  };
}
