/**
 * The Diorama theme: the place as a little shop. With WebGL it is a real 3D
 * room (diorama/room3d.ts): a modelled counter with an oak top, a lip and a
 * panelled front; bookcase or crate walls; the place's painting as the back
 * wall (indoors) or the view through the stall (outdoors); a hanging lamp
 * that is a real shadow-casting light; and the props as lit models on the
 * counter. Hovering a prop makes it glow, and clicking it glides the camera in:
 * the register opens the shop, the books the journal and classes, the
 * postcards the ways out, the teacup rest, the hourglass waiting, the
 * dagger a fight, the lantern a delve, the globe the theme picker. Whoever is
 * here stands behind the counter as a lit cut-out, or framed on a standee if
 * their art is opaque. Labels, narration and overlays are DOM on top.
 *
 * Without WebGL, and in a delve (where the host's own corridor takes the
 * layer), the 2.5D build (diorama/flat.ts) draws the same shop with CSS and
 * canvas: a perspective-painted counter, angled props and parallax layers.
 */
import { BOARD_SKINS } from "../board-skins.js";
import type { SceneView, ThemeCtx, ThemeFactory, ThemeRenderer } from "./contract.js";
import * as A from "./diorama/art.js";
import { flatDiorama, type Mode } from "./diorama/flat.js";
import { room3d } from "./diorama/room3d.js";
import { JOURNAL_CSS, MW_FRAME, tex } from "./diorama/shared.js";
import { CSS } from "./diorama/style.js";
import { CSS2, CSS3D } from "./diorama/style3d.js";

export const diorama: ThemeFactory = (ctx: ThemeCtx): ThemeRenderer => {
  const r = ctx.root;
  r.innerHTML = `<style>${CSS}${CSS2}${JOURNAL_CSS}${CSS3D}</style><style class="dr-tex"></style>${A.DEFS}<div class="h2" hidden></div><div class="h3" hidden></div>`;
  const texStyle = r.querySelector(".dr-tex") as HTMLStyleElement;
  texStyle.textContent = `.gs.diorama .mw-art { --dr-frame: ${MW_FRAME}; }
.gs.diorama > .fg { --dr-leather: url("${tex.leather()}"); --dr-paper: url("${tex.paperTile()}"); }`;
  const h2 = r.querySelector(".h2") as HTMLDivElement;
  const h3 = r.querySelector(".h3") as HTMLDivElement;
  const paperVar = `url("${tex.paperTile()}")`;
  h2.style.setProperty("--tex-paper", paperVar);
  h3.style.setProperty("--tex-paper", paperVar);

  const flat = flatDiorama(ctx, h2);
  flat.deactivate();
  const room: Mode | null = ctx.has3d ? room3d(ctx, h3) : null;
  room?.deactivate();
  let cur: Mode | null = null;

  return {
    boardSkin: BOARD_SKINS.diorama,
    render(v: SceneView) {
      const want = room && !v.delve ? room : flat;
      if (cur !== want) {
        cur?.deactivate();
        want.activate();
        cur = want;
      }
      want.render(v);
    },
    key(e: KeyboardEvent, v: SceneView) {
      return cur?.key(e, v) ?? false;
    },
    destroy() {
      flat.destroy();
      room?.destroy();
    },
  };
};
