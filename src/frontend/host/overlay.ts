/**
 * The full-screen Stage layer (docs/DESIGN.md, 6 and 8.1). Prefers an app
 * mount ("app-overlay", needs app_manipulation); without that permission it
 * falls back to a chromeless float widget sized to the viewport. Everything
 * renders inside one Shadow DOM root so host CSS and Gambit CSS never mix.
 */
import type { SpindleFrontendContext } from "lumiverse-spindle-types";

export interface Overlay {
  /** Element inside the shadow root to render the stage into. */
  content: HTMLElement;
  show(): void;
  hide(): void;
  visible(): boolean;
  onClose(fn: () => void): void;
  destroy(): void;
}

const CSS = `
:host { all: initial; }
.gx-layer { position: fixed; inset: 0; z-index: 40; background: #0b0a0c; color: #e9e2d4;
  font: 14px/1.4 "Cormorant Garamond", "EB Garamond", Georgia, serif; display: none; }
.gx-layer.open { display: block; }
.gx-content { position: absolute; inset: 0; overflow: hidden; }
.gx-close { position: absolute; top: max(10px, env(safe-area-inset-top)); right: 12px; z-index: 5;
  width: 36px; height: 36px; border-radius: 50%; border: 1px solid rgba(233,226,212,.25);
  background: rgba(11,10,12,.55); color: #e9e2d4; font-size: 18px; cursor: pointer;
  display: grid; place-items: center; backdrop-filter: blur(6px); }
.gx-close:hover { border-color: rgba(200,162,106,.8); color: #c8a26a; }
`;

export function createOverlay(ctx: SpindleFrontendContext, canMountApp: boolean): Overlay {
  let host: HTMLElement;
  let dispose: () => void;
  let setVisible: (v: boolean) => void;

  if (canMountApp) {
    const mount = ctx.ui.mountApp({ className: "gambit-stage", position: "app-overlay" });
    host = mount.root;
    setVisible = (v) => mount.setVisible(v);
    dispose = () => mount.destroy();
  } else {
    const widget = ctx.ui.createFloatWidget({ width: window.innerWidth, height: window.innerHeight, initialPosition: { x: 0, y: 0 }, chromeless: true, tooltip: "Gambit" });
    host = widget.root;
    const fit = () => {
      widget.setSize(window.innerWidth, window.innerHeight);
      widget.moveTo(0, 0);
    };
    window.addEventListener("resize", fit);
    setVisible = (v) => {
      if (v) fit();
      widget.setVisible(v);
    };
    dispose = () => {
      window.removeEventListener("resize", fit);
      widget.destroy();
    };
  }

  const shadow = host.attachShadow ? host.attachShadow({ mode: "open" }) : (host as unknown as ShadowRoot);
  const style = document.createElement("style");
  style.textContent = CSS;
  const layer = document.createElement("div");
  layer.className = "gx-layer"; // gx-: the stage markup shares this shadow root
  const content = document.createElement("div");
  content.className = "gx-content";
  const close = document.createElement("button");
  close.className = "gx-close";
  close.setAttribute("aria-label", "Close");
  close.textContent = "✕";
  layer.append(content, close);
  shadow.append(style, layer);

  const closers: (() => void)[] = [];
  close.addEventListener("click", () => {
    hide();
    closers.forEach((f) => f());
  });

  function show() {
    setVisible(true);
    layer.classList.add("open");
  }
  function hide() {
    layer.classList.remove("open");
    setVisible(false);
  }
  hide();

  return {
    content,
    show,
    hide,
    visible: () => layer.classList.contains("open"),
    onClose: (fn) => closers.push(fn),
    destroy: () => dispose(),
  };
}
