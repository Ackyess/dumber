(function attachDumberRenderer(root, factory) {
  const api = factory(root.DumberShared);
  root.DumberRenderer = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis, function createDumberRendererModule(Shared) {
  "use strict";

  if (!Shared && typeof require === "function") Shared = require("./shared.js");
  if (!Shared) throw new Error("DumberShared is required.");

  const STYLE_TEXT = String.raw`
    @property --dumber-angle {
      syntax: "<angle>";
      inherits: true;
      initial-value: 0deg;
    }

    @property --dumber-beam-opacity {
      syntax: "<number>";
      inherits: true;
      initial-value: 0;
    }

    .dumber-vip {
      --dumber-angle: 0deg;
      --dumber-surface: rgba(250, 250, 253, .985);
      --dumber-ink: #11131a;
      --dumber-radius: 16px;
      --dumber-beam-opacity: 0;
      --dumber-beam-stroke: 1;
      --dumber-beam-inner: .64;
      --dumber-beam-bloom: .5;
      --dumber-beam-brightness: 1.45;
      --dumber-beam-saturation: 1.5;
      --dumber-beam-shadow: rgba(255, 255, 255, .27);
      border-radius: var(--dumber-radius) !important;
      background-color: var(--dumber-surface) !important;
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, .34),
        0 0 26px rgba(156, 113, 255, .22),
        0 18px 48px rgba(18, 14, 36, .12) !important;
    }

    .dumber-vip.dumber-ring-contained::after {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 2;
      box-sizing: border-box;
      padding: 1px;
      border-radius: inherit;
      clip-path: inset(0 round var(--dumber-radius));
      background:
        conic-gradient(
          from var(--dumber-angle),
          transparent 0%, transparent 54%,
          rgba(255, 255, 255, .1) 57%,
          rgba(255, 255, 255, .3) 60%,
          rgba(255, 255, 255, .6) 63%,
          rgba(255, 255, 255, .75) 66%,
          rgba(255, 255, 255, .6) 69%,
          rgba(255, 255, 255, .3) 72%,
          rgba(255, 255, 255, .1) 75%,
          transparent 78%, transparent 100%
        ),
        radial-gradient(ellipse 70px 40px at 33% -7.4%, rgb(255, 50, 100), transparent),
        radial-gradient(ellipse 60px 35px at 12% -5%, rgb(40, 140, 255), transparent),
        radial-gradient(ellipse 40px 70px at 2.1% 68.3%, rgb(50, 200, 80), transparent),
        radial-gradient(ellipse 20px 35px at 2.1% 68.3%, rgb(30, 185, 170), transparent),
        radial-gradient(ellipse 180px 32px at 74.4% 100%, rgb(100, 70, 255), transparent),
        radial-gradient(ellipse 85px 26px at 55% 100%, rgb(40, 140, 255), transparent),
        radial-gradient(ellipse 74px 32px at 93.9% 0%, rgb(255, 120, 40), transparent),
        radial-gradient(ellipse 26px 42px at 100% 27.1%, rgb(240, 50, 180), transparent),
        radial-gradient(ellipse 52px 48px at 100% 27.1%, rgb(180, 40, 240), transparent);
      pointer-events: none;
      -webkit-mask:
        conic-gradient(
          from var(--dumber-angle),
          rgba(255, 255, 255, .7) 0%, rgba(255, 255, 255, .7) 30%,
          rgba(255, 255, 255, .78) 36%, rgba(255, 255, 255, .9) 44%,
          white 52%, white 80%,
          rgba(255, 255, 255, .9) 86%, rgba(255, 255, 255, .78) 92%,
          rgba(255, 255, 255, .7) 95%, rgba(255, 255, 255, .7) 100%
        ),
        linear-gradient(#000 0 0) content-box,
        linear-gradient(#000 0 0);
      -webkit-mask-composite: source-in, xor;
      mask:
        conic-gradient(
          from var(--dumber-angle),
          rgba(255, 255, 255, .7) 0%, rgba(255, 255, 255, .7) 30%,
          rgba(255, 255, 255, .78) 36%, rgba(255, 255, 255, .9) 44%,
          white 52%, white 80%,
          rgba(255, 255, 255, .9) 86%, rgba(255, 255, 255, .78) 92%,
          rgba(255, 255, 255, .7) 95%, rgba(255, 255, 255, .7) 100%
        ),
        linear-gradient(#000 0 0) content-box,
        linear-gradient(#000 0 0);
      mask-composite: intersect, exclude;
      opacity: calc(var(--dumber-beam-opacity) * var(--dumber-beam-stroke));
      animation: dumber-beam-hue 12s ease-in-out infinite;
    }

    .dumber-vip.dumber-ring-contained::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 1;
      border-radius: inherit;
      clip-path: inset(0 round var(--dumber-radius));
      background:
        radial-gradient(ellipse 63px 36px at 33% -7.4%, rgba(255, 50, 100, .45), transparent),
        radial-gradient(ellipse 54px 32px at 12% -5%, rgba(40, 140, 255, .45), transparent),
        radial-gradient(ellipse 36px 63px at 2.1% 68.3%, rgba(50, 200, 80, .45), transparent),
        radial-gradient(ellipse 18px 32px at 2.1% 68.3%, rgba(30, 185, 170, .45), transparent),
        radial-gradient(ellipse 162px 29px at 74.4% 100%, rgba(100, 70, 255, .45), transparent),
        radial-gradient(ellipse 77px 23px at 55% 100%, rgba(40, 140, 255, .45), transparent),
        radial-gradient(ellipse 67px 29px at 93.9% 0%, rgba(255, 120, 40, .45), transparent),
        radial-gradient(ellipse 23px 38px at 100% 27.1%, rgba(240, 50, 180, .45), transparent),
        radial-gradient(ellipse 47px 43px at 100% 27.1%, rgba(180, 40, 240, .45), transparent);
      box-shadow: inset 0 0 9px 1px var(--dumber-beam-shadow);
      -webkit-mask-image:
        conic-gradient(from var(--dumber-angle), rgba(255,255,255,.42) 0%, rgba(255,255,255,.42) 30%, rgba(255,255,255,.68) 44%, white 52%, white 80%, rgba(255,255,255,.68) 86%, rgba(255,255,255,.42) 100%),
        linear-gradient(white, transparent 28px, transparent calc(100% - 28px), white),
        linear-gradient(to right, white, transparent 28px, transparent calc(100% - 28px), white);
      -webkit-mask-composite: source-in, source-over;
      mask-image:
        conic-gradient(from var(--dumber-angle), rgba(255,255,255,.42) 0%, rgba(255,255,255,.42) 30%, rgba(255,255,255,.68) 44%, white 52%, white 80%, rgba(255,255,255,.68) 86%, rgba(255,255,255,.42) 100%),
        linear-gradient(white, transparent 28px, transparent calc(100% - 28px), white),
        linear-gradient(to right, white, transparent 28px, transparent calc(100% - 28px), white);
      mask-composite: intersect, add;
      pointer-events: none;
      opacity: calc(var(--dumber-beam-opacity) * var(--dumber-beam-inner));
      animation: dumber-beam-hue 12s ease-in-out infinite;
    }

    .dumber-vip.dumber-ring-contained > .dumber-beam-bloom {
      position: absolute;
      inset: 0;
      z-index: 3;
      box-sizing: border-box;
      padding: 1px;
      border-radius: inherit;
      clip-path: inset(0 round var(--dumber-radius));
      background: conic-gradient(
        from var(--dumber-angle),
        transparent 0%, transparent 58%,
        rgba(255,255,255,.03) 62%, rgba(255,255,255,.08) 65%,
        rgba(255,255,255,.2) 67%, rgba(255,255,255,.45) 69%,
        rgba(255,255,255,.85) 70%, rgba(255,255,255,.85) 70.5%,
        rgba(255,255,255,.45) 71.5%, rgba(255,255,255,.2) 73%,
        rgba(255,255,255,.08) 75%, rgba(255,255,255,.03) 78%,
        transparent 82%
      );
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask-composite: exclude;
      filter: blur(8px) brightness(var(--dumber-beam-brightness)) saturate(var(--dumber-beam-saturation));
      opacity: calc(var(--dumber-beam-opacity) * var(--dumber-beam-bloom));
      pointer-events: none;
    }

    .dumber-vip.dumber-ring-outline {
      outline: 2px solid #b98cff !important;
      outline-offset: -2px !important;
    }

    @keyframes dumber-beam-hue {
      0%, 100% { filter: hue-rotate(-30deg) brightness(var(--dumber-beam-brightness)) saturate(var(--dumber-beam-saturation)); }
      50% { filter: hue-rotate(30deg) brightness(var(--dumber-beam-brightness)) saturate(var(--dumber-beam-saturation)); }
    }

    .dumber-vip.dumber-beam-paused::before,
    .dumber-vip.dumber-beam-paused::after {
      animation-play-state: paused !important;
    }

    .dumber-vip:hover,
    .dumber-vip:focus-within {
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, .48),
        0 0 38px rgba(156, 113, 255, .31),
        0 22px 56px rgba(18, 14, 36, .16) !important;
    }

    .dumber-vip.dumber-primary,
    .dumber-vip .dumber-primary {
      color: var(--dumber-ink) !important;
    }

    .dumber-vip .dumber-emphasis {
      position: relative;
      z-index: 3;
      display: inline-block;
      margin: 0 -.03em;
      padding: 0 .03em;
      color: var(--dumber-neon-a, #8fffd8) !important;
      background: linear-gradient(
        100deg,
        var(--dumber-neon-a, #8fffd8),
        var(--dumber-neon-b, #80c8ff),
        var(--dumber-neon-c, #ff87bb),
        var(--dumber-neon-a, #8fffd8)
      );
      background-size: 240% 100%;
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      border-radius: .2em;
      line-height: inherit;
      filter: drop-shadow(0 0 3px var(--dumber-neon-glow, #80c8ff));
      transform-origin: 50% 68%;
      animation: dumber-emphasis-live 1700ms cubic-bezier(.45, 0, .25, 1) infinite;
      animation-delay: var(--dumber-emphasis-delay, 0ms);
      will-change: transform, filter, opacity, background-position;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
    }

    .dumber-vip.dumber-secondary,
    .dumber-vip .dumber-secondary {
      opacity: .66 !important;
      filter: saturate(.78) !important;
    }

    .dumber-sidecar {
      position: fixed;
      z-index: 2147483647;
      display: grid;
      grid-template-columns: 74px minmax(0, 1fr);
      gap: 13px;
      width: min(348px, calc(100vw - 24px));
      max-height: calc(100vh - 24px);
      padding: 13px;
      color: #f8f8fb;
      background: rgba(15, 15, 22, .965);
      border: 1px solid rgba(255, 255, 255, .22);
      border-radius: 16px;
      box-shadow: 0 18px 58px rgba(0, 0, 0, .38), 0 0 24px rgba(160, 114, 255, .2);
      opacity: 0;
      transform: translateY(7px) scale(.985);
      pointer-events: none;
      visibility: hidden;
      transition: opacity 150ms ease, transform 170ms cubic-bezier(.2, .8, .2, 1), visibility 0s linear 170ms;
      backdrop-filter: blur(18px) saturate(1.15);
      -webkit-backdrop-filter: blur(18px) saturate(1.15);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-sizing: border-box;
      overflow: auto;
    }

    .dumber-sidecar.dumber-sidecar-visible {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
      visibility: visible;
      transition-delay: 0s;
    }

    .dumber-sidecar.dumber-sidecar-unplaced {
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
      transition: none !important;
    }

    .dumber-celebration {
      display: grid;
      place-items: center;
      width: 74px;
      min-height: 88px;
      padding: 8px 5px;
      color: #17131f;
      background:
        radial-gradient(circle at 28% 18%, rgba(255,255,255,.92), transparent 26%),
        linear-gradient(145deg, #caff7a, #8fffe0 44%, #c99bff 100%);
      border-radius: 13px;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.52);
      font-family: ui-monospace, "SFMono-Regular", Consolas, monospace;
      font-size: 18px;
      font-weight: 900;
      line-height: 1.15;
      text-align: center;
      white-space: pre-line;
      user-select: none;
      box-sizing: border-box;
    }

    .dumber-sidecar-content {
      min-width: 0;
    }

    .dumber-sidecar-label {
      display: block;
      margin: 1px 0 6px;
      color: #caff7a;
      font-size: 11px;
      font-weight: 850;
      line-height: 1.2;
      letter-spacing: .09em;
      text-transform: uppercase;
    }

    .dumber-sidecar-copy {
      display: block;
      margin: 0;
      color: #fff;
      font-size: 14px;
      font-weight: 680;
      line-height: 1.45;
      letter-spacing: -.008em;
    }

    .dumber-sidecar-score {
      display: block;
      margin-top: 7px;
      color: rgba(255, 255, 255, .68);
      font-size: 11px;
      font-weight: 560;
      line-height: 1.3;
    }

    .dumber-sidecar-actions {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: -1px;
    }

    .dumber-sidecar button {
      min-height: 30px;
      padding: 5px 10px;
      color: #fff;
      background: rgba(255, 255, 255, .08);
      border: 1px solid rgba(255, 255, 255, .17);
      border-radius: 999px;
      font: 700 11px/1 ui-sans-serif, system-ui, sans-serif;
      cursor: pointer;
    }

    .dumber-sidecar button:hover,
    .dumber-sidecar button:focus-visible {
      background: rgba(255, 255, 255, .14);
      border-color: rgba(202, 255, 122, .5);
      outline: none;
    }

    .dumber-sidecar button:disabled {
      cursor: default;
      opacity: .55;
    }

    .dumber-sidecar-feedback {
      margin-left: auto;
      color: rgba(255, 255, 255, .65);
      font-size: 11px;
      line-height: 1.2;
    }

    .dumber-activity {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483646;
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr);
      align-items: center;
      gap: 12px;
      width: 270px;
      height: 74px;
      padding: 0 32px 0 9px;
      color: #f8f8fb;
      background: rgba(29, 29, 29, .82);
      border: 0;
      border-radius: 9999px;
      box-shadow:
        inset 0 0 0 1px rgba(104, 111, 128, .34),
        inset 0 0 50px rgba(255, 255, 255, .02),
        0 12px 38px rgba(0, 0, 0, .32),
        0 0 24px rgba(160, 114, 255, .18);
      pointer-events: none;
      overflow: hidden;
      box-sizing: border-box;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      opacity: 1;
      transform: translateY(0);
      transition: opacity 160ms ease, transform 180ms cubic-bezier(.2, .8, .2, 1);
      backdrop-filter: blur(16px) saturate(1.12);
      -webkit-backdrop-filter: blur(16px) saturate(1.12);
    }

    .dumber-activity[hidden] {
      display: none !important;
    }

    .dumber-activity[data-phase="error"] {
      box-shadow:
        inset 0 0 0 1px rgba(255, 143, 112, .55),
        inset 0 0 50px rgba(255, 143, 112, .035),
        0 12px 38px rgba(0, 0, 0, .32);
    }

    .dumber-activity-signal {
      display: block;
      width: 56px;
      height: 56px;
      filter:
        saturate(1.48)
        brightness(1.12)
        drop-shadow(0 0 2px rgba(128, 200, 255, .72))
        drop-shadow(0 0 7px rgba(185, 140, 255, .34));
    }

    .dumber-activity-copy {
      display: flex;
      align-items: center;
      min-width: 0;
    }

    .dumber-activity-label,
    .dumber-activity-detail {
      display: block;
      margin: 0;
      white-space: nowrap;
    }

    .dumber-activity-label {
      position: relative;
      color: rgba(251, 251, 251, .68);
      font-size: 18px;
      font-weight: 450;
      line-height: 24px;
    }

    .dumber-activity-label::before {
      content: attr(data-text);
      position: absolute;
      inset: 0;
      color: transparent;
      background: linear-gradient(90deg, transparent 0%, #8fffd8 34%, #80c8ff 43%, #b98cff 50%, #ff87bb 57%, #ffe06f 66%, transparent 100%);
      background-size: 220% 100%;
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: dumber-activity-shimmer 2s linear infinite;
    }

    .dumber-activity-detail {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
      border: 0;
    }

    @keyframes dumber-activity-shimmer {
      to { background-position: -220% 0; }
    }

    @keyframes dumber-emphasis-live {
      0%, 100% { transform: translate(0, 0) scale(1.05) rotate(-.15deg); filter: drop-shadow(0 0 3px var(--dumber-neon-glow)); opacity: 1; background-position: 0% 50%; }
      18% { transform: translate(-.8px, -1.2px) scale(1.18) rotate(-1deg); filter: drop-shadow(0 0 7px var(--dumber-neon-glow)) brightness(1.2) saturate(1.3); opacity: 1; }
      36% { transform: translate(.9px, .5px) scale(1.1) rotate(.85deg); opacity: .96; }
      49% { transform: translate(0, 0) scale(1.07) rotate(0); filter: drop-shadow(0 0 10px var(--dumber-neon-glow)) brightness(1.5) saturate(1.45); opacity: .8; background-position: 100% 50%; }
      68% { transform: translate(-.5px, .8px) scale(1.15) rotate(-.65deg); opacity: 1; }
      84% { transform: translate(.45px, -.6px) scale(1.09) rotate(.45deg); opacity: .94; }
    }

    @media (prefers-reduced-motion: reduce) {
      .dumber-sidecar { transition: opacity 80ms linear, visibility 0s linear 80ms; transform: none; }
      .dumber-activity,
      .dumber-activity-label::before { animation: none !important; transition: none !important; }
      .dumber-vip.dumber-ring-contained::before,
      .dumber-vip.dumber-ring-contained::after { animation: none !important; }
      .dumber-emphasis {
        animation: none !important;
        transform: scale(1.08);
        filter: drop-shadow(0 0 4px var(--dumber-neon-glow));
        background-position: 50% 50%;
        opacity: 1;
      }
    }

    @media (max-width: 520px) {
      .dumber-sidecar {
        grid-template-columns: 58px minmax(0, 1fr);
        gap: 10px;
        padding: 11px;
      }
      .dumber-celebration { width: 58px; min-height: 74px; font-size: 15px; }
    }
  `;

  const DRIVER_COPY = Object.freeze({
    high_emotion: "情绪浓度已经拉满，DUMBER 为它准备了更清晰的阅读平面。",
    identity_resonance: "这条内容很懂你的共鸣点，已经为你提升视觉优先级。",
    curiosity_gap: "好奇心已经被精准点亮，完整内容现在更适合继续探索。",
    reaction_chain: "热门讨论正在延伸，这一层反应链值得被认真放大。",
    frictionless_exploration: "不用费力切换状态，顺着这一条继续探索正合适。",
    instant_gratification: "即时满足已经就位，现在读起来更漂亮、更顺手。",
    status_signal: "热度与信号都很充足，DUMBER 已将它升级为精选卡片。",
    mixed: "这条内容更适合现在的你，DUMBER 已完成可读性优化。"
  });

  const CELEBRATIONS = Object.freeze([
    "✦\nᴗ\n✦",
    "◉‿◉\nGOOD",
    "ദ്ദി\nNICE",
    "D↑\nVIP"
  ]);

  const EMPHASIS_PALETTES = Object.freeze({
    dark: Object.freeze([
      ["#56ffe0", "#5ebdff", "#c895ff"],
      ["#ff68cc", "#ff8a68", "#ffe66d"],
      ["#a8ff70", "#56eaff", "#7b8dff"],
      ["#ffe66d", "#ff7dba", "#bd8cff"],
      ["#62fff5", "#9fff70", "#ffe66d"]
    ]),
    light: Object.freeze([
      ["#007e6f", "#006ed2", "#7333c6"],
      ["#c80072", "#d34300", "#8a6800"],
      ["#358000", "#007d95", "#344cc1"],
      ["#8a6900", "#be2670", "#6932ba"],
      ["#007b78", "#4a8000", "#9b6300"]
    ])
  });

  function createRenderer({ document: documentValue, onPreference, onHover } = {}) {
    const doc = documentValue || globalThis.document;
    if (!doc) throw new Error("A document is required.");
    const win = doc.defaultView || globalThis;
    const records = new WeakMap();
    const hoveredFingerprints = new WeakMap();
    const markedCards = new Set();
    const reducedMotion = win.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
    const beamObserver = typeof win.IntersectionObserver === "function"
      ? new win.IntersectionObserver((entries) => {
          for (const entry of entries) {
            const record = records.get(entry.target);
            if (!record) continue;
            entry.target.classList.toggle("dumber-beam-paused", !entry.isIntersecting);
            const action = entry.isIntersecting ? "play" : "pause";
            record.spectrumAnimation?.[action]?.();
            record.beamFadeAnimation?.[action]?.();
          }
        }, { rootMargin: "256px" })
      : null;
    let activeCard = null;
    let activePayload = null;
    let hideTimer = 0;
    let positionFrame = 0;
    let activityFrame = 0;

    ensureStyles(doc);
    const sidecar = createSidecar(doc);
    const activity = createActivity(doc);
    const activityOrb = createActivityOrb(activity.querySelector(".dumber-activity-signal"), win, reducedMotion);
    const activityLabel = activity.querySelector(".dumber-activity-label");
    const activityDetail = activity.querySelector(".dumber-activity-detail");
    const activityObserver = new win.MutationObserver(scheduleActivitySync);
    activityObserver.observe(doc.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-dumber-state", "data-dumber-enhancement"]
    });
    syncActivity();
    const celebration = sidecar.querySelector(".dumber-celebration");
    const label = sidecar.querySelector(".dumber-sidecar-label");
    const copy = sidecar.querySelector(".dumber-sidecar-copy");
    const score = sidecar.querySelector(".dumber-sidecar-score");
    const feedback = sidecar.querySelector(".dumber-sidecar-feedback");
    const moreButton = sidecar.querySelector('[data-action="more"]');
    const lessButton = sidecar.querySelector('[data-action="less"]');

    doc.addEventListener("pointerover", handlePointerOver, true);
    doc.addEventListener("pointerout", handlePointerOut, true);
    doc.addEventListener("focusin", handleFocusIn, true);
    doc.addEventListener("focusout", handleFocusOut, true);
    sidecar.addEventListener("pointerenter", cancelHide, { passive: true });
    sidecar.addEventListener("pointerleave", scheduleHide, { passive: true });
    moreButton.addEventListener("click", () => void savePreference("more"));
    lessButton.addEventListener("click", () => void savePreference("less"));
    win.addEventListener?.("scroll", schedulePosition, true);
    win.addEventListener?.("resize", schedulePosition, { passive: true });
    reducedMotion?.addEventListener?.("change", syncAllSpectrumAnimations);

    function ensureStyles(rootNode) {
      const target = rootNode instanceof win.Document
        ? (rootNode.head || rootNode.documentElement)
        : rootNode;
      if (!target?.querySelector || target.querySelector("style[data-dumber-styles-v2]")) return;
      const style = doc.createElement("style");
      style.dataset.dumberStylesV2 = "";
      style.textContent = STYLE_TEXT;
      target.append(style);
    }

    function mark(card, candidate, curation, decision) {
      if (!card) return;
      ensureStyles(card.getRootNode?.() || doc);

      const computed = win.getComputedStyle?.(card);
      const dark = isDarkSurface(card, win);
      const primaryElements = uniqueConnected(candidate.primaryElements, card);
      const secondaryElements = uniqueConnected(candidate.secondaryElements, card)
        .filter((element) => !primaryElements.includes(element));
      const previous = records.get(card);
      const reuseEmphasis = sameElementSet(previous?.primaryElements, primaryElements);
      if (previous && !reuseEmphasis) clearEmphasis(previous, card);

      reconcileClass(previous?.primaryElements, primaryElements, "dumber-primary");
      reconcileClass(previous?.secondaryElements, secondaryElements, "dumber-secondary");
      reconcileClass(previous?.expandableElements, [], "dumber-expanded");

      card.classList.add("dumber-vip");
      card.classList.toggle("dumber-ring-contained", computed?.position !== "static");
      card.classList.toggle("dumber-ring-outline", computed?.position === "static");
      card.dataset.dumberPromotion = "true";
      card.dataset.dumberPromotionLabel = curation.promotionLabel || Shared.DRIVER_LABELS[curation.primaryDriver];
      card.style.setProperty("--dumber-surface", dark ? "rgba(17, 18, 24, .985)" : "rgba(250, 250, 253, .985)");
      card.style.setProperty("--dumber-ink", dark ? "#f7f8fb" : "#11131a");
      card.style.setProperty("--dumber-radius", computed?.borderRadius && computed.borderRadius !== "0px" ? computed.borderRadius : "16px");
      card.style.setProperty("--dumber-beam-stroke", dark ? "1" : ".96");
      card.style.setProperty("--dumber-beam-inner", dark ? ".64" : ".5");
      card.style.setProperty("--dumber-beam-bloom", dark ? ".5" : ".4");
      card.style.setProperty("--dumber-beam-saturation", dark ? "1.5" : "1.62");
      card.style.setProperty("--dumber-beam-shadow", dark ? "rgba(255, 255, 255, .27)" : "rgba(0, 0, 0, .14)");

      let beamBloom = previous?.beamBloom;
      if (card.classList.contains("dumber-ring-contained") && (!beamBloom?.isConnected || beamBloom.parentElement !== card)) {
        beamBloom?.remove?.();
        beamBloom = doc.createElement("span");
        beamBloom.className = "dumber-beam-bloom";
        beamBloom.dataset.dumberOwned = "";
        beamBloom.setAttribute("aria-hidden", "true");
        card.append(beamBloom);
      } else if (!card.classList.contains("dumber-ring-contained")) {
        beamBloom?.remove?.();
        beamBloom = null;
      }

      const payload = {
        candidate,
        curation,
        decision,
        emphasisCount: reuseEmphasis ? previous?.payload?.emphasisCount || 0 : 0
      };
      const record = {
        primaryElements,
        secondaryElements,
        expandableElements: [],
        payload,
        emphasisApplied: reuseEmphasis && previous?.emphasisApplied === true,
        emphasisPhrases: reuseEmphasis ? previous?.emphasisPhrases || [] : [],
        emphasisSpans: reuseEmphasis ? previous?.emphasisSpans || [] : [],
        beamBloom,
        spectrumAnimation: previous?.spectrumAnimation || null,
        beamFadeAnimation: previous?.beamFadeAnimation || null
      };
      records.set(card, record);
      markedCards.add(card);
      beamObserver?.observe(card);
      syncSpectrumAnimation(card, record);
      if (activeCard === card) show(card, payload);
    }

    function emphasize(card, candidate, emphasis) {
      const record = records.get(card);
      if (!record || !card?.isConnected) return 0;
      const phrases = Shared.normalizeEmphasis(emphasis, candidate?.context?.text).phrases;
      const reusable = record.emphasisApplied
        && sameStringArray(record.emphasisPhrases, phrases)
        && record.emphasisSpans.every((span) => span.isConnected && span.classList.contains("dumber-emphasis"));
      if (!reusable) {
        clearEmphasis(record, card);
        const spans = [];
        const palettes = EMPHASIS_PALETTES[isDarkSurface(card, win) ? "dark" : "light"];
        for (const element of record.primaryElements) {
          spans.push(...wrapExactPhrases(element, phrases, doc, 8 - spans.length));
          if (spans.length >= 8) break;
        }
        spans.forEach((span, index) => {
          const palette = palettes[index % palettes.length];
          span.style.setProperty("--dumber-neon-a", palette[0]);
          span.style.setProperty("--dumber-neon-b", palette[1]);
          span.style.setProperty("--dumber-neon-c", palette[2]);
          span.style.setProperty("--dumber-neon-glow", palette[1]);
          span.style.setProperty("--dumber-emphasis-delay", `${-(index * 173)}ms`);
        });
        record.emphasisApplied = true;
        record.emphasisPhrases = phrases;
        record.emphasisSpans = spans;
      }
      const count = record.emphasisSpans.filter((span) => span.isConnected).length;
      record.payload.emphasisCount = count;
      card.dataset.dumberEmphasisCount = String(count);
      if (activeCard === card) show(card, record.payload);
      return count;
    }

    function clearEmphasis(record, card) {
      const parents = new Set();
      for (const span of record?.emphasisSpans || []) {
        const parent = span.parentNode;
        if (!parent || !span.classList?.contains("dumber-emphasis")) continue;
        parents.add(parent);
        span.replaceWith(doc.createTextNode(span.textContent || ""));
      }
      for (const parent of parents) parent.normalize?.();
      if (record) {
        record.emphasisApplied = false;
        record.emphasisPhrases = [];
        record.emphasisSpans = [];
        if (record.payload) record.payload.emphasisCount = 0;
      }
      if (card?.dataset) delete card.dataset.dumberEmphasisCount;
    }

    function emphasisNeedsRepair(card) {
      const record = records.get(card);
      return Boolean(record && (
        (card.classList.contains("dumber-ring-contained")
          && (!record.beamBloom?.isConnected || record.beamBloom.parentElement !== card))
        || (record.emphasisApplied
          && record.emphasisSpans.length
          && record.emphasisSpans.some((span) => !span.isConnected || !span.classList.contains("dumber-emphasis")))
      ));
    }

    function unmark(card, options = {}) {
      const record = records.get(card);
      clearEmphasis(record, card);
      card?.classList?.remove("dumber-vip");
      card?.classList?.remove("dumber-ring-contained");
      card?.classList?.remove("dumber-ring-outline");
      card?.classList?.remove("dumber-beam-paused");
      if (card?.dataset) {
        delete card.dataset.dumberPromotion;
        delete card.dataset.dumberPromotionLabel;
        delete card.dataset.dumberEnhancement;
      }
      card?.style?.removeProperty("--dumber-surface");
      card?.style?.removeProperty("--dumber-ink");
      card?.style?.removeProperty("--dumber-radius");
      card?.style?.removeProperty("--dumber-angle");
      card?.style?.removeProperty("--dumber-beam-opacity");
      card?.style?.removeProperty("--dumber-beam-stroke");
      card?.style?.removeProperty("--dumber-beam-inner");
      card?.style?.removeProperty("--dumber-beam-bloom");
      card?.style?.removeProperty("--dumber-beam-saturation");
      card?.style?.removeProperty("--dumber-beam-shadow");
      for (const element of record?.primaryElements || []) element.classList?.remove("dumber-primary");
      for (const element of record?.secondaryElements || []) element.classList?.remove("dumber-secondary");
      for (const element of record?.expandableElements || []) element.classList?.remove("dumber-expanded");
      record?.beamBloom?.remove?.();
      record?.spectrumAnimation?.cancel?.();
      record?.beamFadeAnimation?.cancel?.();
      beamObserver?.unobserve(card);
      records.delete(card);
      markedCards.delete(card);
      if (!options.keepSidecar && activeCard === card) hide();
    }

    function syncSpectrumAnimation(card, record = records.get(card)) {
      if (!record) return;
      if (reducedMotion?.matches || typeof card.animate !== "function") {
        record.spectrumAnimation?.cancel?.();
        record.beamFadeAnimation?.cancel?.();
        record.spectrumAnimation = null;
        record.beamFadeAnimation = null;
        card.style.setProperty("--dumber-angle", "0deg");
        card.style.setProperty("--dumber-beam-opacity", "1");
        return;
      }
      card.style.removeProperty("--dumber-angle");
      card.style.removeProperty("--dumber-beam-opacity");
      if (record.spectrumAnimation && record.spectrumAnimation.playState !== "idle") return;
      record.spectrumAnimation?.cancel?.();
      try {
        const frames = card.classList.contains("dumber-ring-outline")
          ? [
              { outlineColor: "#8fffd8" },
              { outlineColor: "#80c8ff" },
              { outlineColor: "#b98cff" },
              { outlineColor: "#ff87bb" },
              { outlineColor: "#ffe06f" },
              { outlineColor: "#8fffd8" }
            ]
          : [
              { "--dumber-angle": "0deg" },
              { "--dumber-angle": "360deg" }
            ];
        record.spectrumAnimation = card.animate(frames, {
          duration: 1960,
          easing: "linear",
          iterations: Infinity
        });
        if (card.classList.contains("dumber-ring-contained")) {
          record.beamFadeAnimation?.cancel?.();
          record.beamFadeAnimation = card.animate([
            { "--dumber-beam-opacity": "0" },
            { "--dumber-beam-opacity": "1" }
          ], {
            duration: 600,
            easing: "ease",
            fill: "forwards"
          });
        }
        if (card.classList.contains("dumber-beam-paused")) {
          record.spectrumAnimation.pause();
          record.beamFadeAnimation?.pause?.();
        }
      } catch {
        record.spectrumAnimation = null;
        card.style.setProperty("--dumber-beam-opacity", "1");
      }
    }

    function syncAllSpectrumAnimations() {
      for (const card of markedCards) {
        if (!card.isConnected) {
          unmark(card);
          continue;
        }
        syncSpectrumAnimation(card);
      }
    }

    function scheduleActivitySync() {
      if (activityFrame) return;
      activityFrame = win.requestAnimationFrame?.(() => {
        activityFrame = 0;
        syncActivity();
      }) || win.setTimeout(() => {
        activityFrame = 0;
        syncActivity();
      }, 16);
    }

    function syncActivity() {
      const counts = { observing: 0, queued: 0, requesting: 0, ready: 0, promoted: 0, error: 0 };
      let enhancing = 0;
      let enhancementErrors = 0;
      for (const card of doc.querySelectorAll("[data-dumber-state]")) {
        const state = card.dataset.dumberState;
        if (Object.hasOwn(counts, state)) counts[state] += 1;
        if (card.dataset.dumberEnhancement === "requesting") enhancing += 1;
        if (card.dataset.dumberEnhancement === "error") enhancementErrors += 1;
      }
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
      activity.hidden = total === 0;
      if (!total) {
        activityOrb.setActive(false);
        return;
      }

      const completed = counts.ready + counts.promoted;
      let phase = "idle";
      let title = "Ready….";
      let detail = `${completed} 条已处理 · ${counts.promoted} 条精选`;
      if (counts.requesting) {
        phase = "requesting";
        title = "Thinking….";
        detail = `${counts.requesting} 条处理中 · ${completed} 条已处理`;
      } else if (enhancing) {
        phase = "enhancing";
        title = "Composing….";
        detail = `${enhancing} 条二次处理中 · ${counts.promoted} 条已精选`;
      } else if (counts.queued) {
        phase = "queued";
        title = "Queuing….";
        detail = `${counts.queued} 条排队 · ${completed} 条已处理`;
      } else if (counts.observing) {
        phase = "observing";
        title = "Scanning….";
        detail = `${counts.observing} 条已发现 · ${completed} 条已处理`;
      } else if (counts.error) {
        phase = "error";
        title = "Retrying….";
        detail = `${counts.error} 条等待重试 · ${completed} 条已处理`;
      } else if (enhancementErrors) {
        phase = "error";
        title = "Paused….";
        detail = `${enhancementErrors} 条保留首轮精选样式`;
      }
      activity.dataset.phase = phase;
      if (activityLabel.textContent !== title) {
        activityLabel.textContent = title;
        activityLabel.dataset.text = title;
      }
      if (activityDetail.textContent !== detail) activityDetail.textContent = detail;
      activity.setAttribute("aria-label", `${title} ${detail}`);
      activityOrb.setActive(["observing", "queued", "requesting", "enhancing"].includes(phase));
    }

    function handlePointerOver(event) {
      const card = findVipCard(event);
      if (!card) return;
      const payload = records.get(card)?.payload;
      if (!payload) return;
      cancelHide();
      if (card !== activeCard) show(card, payload);
      const fingerprint = payload.candidate.fingerprint || payload.candidate.id;
      if (hoveredFingerprints.get(card) !== fingerprint) {
        hoveredFingerprints.set(card, fingerprint);
        onHover?.(payload.candidate);
      }
    }

    function handlePointerOut(event) {
      if (!activeCard) return;
      const path = event.composedPath?.() || [];
      if (!path.includes(activeCard)) return;
      const related = event.relatedTarget;
      if (related && (activeCard.contains?.(related) || sidecar.contains?.(related))) return;
      scheduleHide();
    }

    function handleFocusIn(event) {
      const card = findVipCard(event);
      if (card) {
        const payload = records.get(card)?.payload;
        if (!payload) return;
        cancelHide();
        if (card !== activeCard) show(card, payload);
        return;
      }
      if (event.composedPath?.().includes(sidecar)) cancelHide();
    }

    function handleFocusOut(event) {
      if (!activeCard) return;
      const path = event.composedPath?.() || [];
      if (!path.includes(activeCard) && !path.includes(sidecar)) return;
      const related = event.relatedTarget;
      if (related && (activeCard.contains?.(related) || sidecar.contains?.(related))) return;
      scheduleHide();
    }

    function findVipCard(event) {
      return event.composedPath?.().find((node) => node?.classList?.contains("dumber-vip")) || null;
    }

    function show(card, payload) {
      activeCard = card;
      activePayload = payload;
      feedback.textContent = "";
      moreButton.disabled = false;
      lessButton.disabled = false;
      const driver = Shared.normalizeDriver(payload.curation.primaryDriver);
      label.textContent = payload.curation.promotionLabel || Shared.DRIVER_LABELS[driver];
      copy.textContent = DRIVER_COPY[driver] || DRIVER_COPY.mixed;
      score.textContent = `本次推荐强度 ${Math.round(payload.decision.adjustedScore * 100)}%${
        payload.emphasisCount ? ` · ${payload.emphasisCount} 处已强化` : ""
      }`;
      const visualHash = Shared.hashText(payload.candidate.fingerprint || payload.candidate.id);
      const index = parseInt(visualHash.slice(0, 8), 16) % CELEBRATIONS.length;
      celebration.textContent = CELEBRATIONS[index];
      updateSidecarPosition();
    }

    function hide() {
      clearTimeout(hideTimer);
      hideTimer = 0;
      activeCard = null;
      activePayload = null;
      sidecar.classList.remove("dumber-sidecar-visible");
      sidecar.setAttribute("aria-hidden", "true");
    }

    function cancelHide() {
      clearTimeout(hideTimer);
      hideTimer = 0;
    }

    function scheduleHide() {
      cancelHide();
      hideTimer = win.setTimeout(hide, 130);
    }

    function schedulePosition() {
      if (!activeCard || positionFrame) return;
      positionFrame = win.requestAnimationFrame?.(() => {
        positionFrame = 0;
        updateSidecarPosition();
      }) || win.setTimeout(() => {
        positionFrame = 0;
        updateSidecarPosition();
      }, 16);
    }

    function updateSidecarPosition() {
      if (!activeCard?.isConnected) {
        hide();
        return false;
      }
      const placed = positionSidecar();
      sidecar.classList.toggle("dumber-sidecar-unplaced", !placed);
      sidecar.classList.toggle("dumber-sidecar-visible", placed);
      if (placed) sidecar.removeAttribute("aria-hidden");
      else sidecar.setAttribute("aria-hidden", "true");
      return placed;
    }

    function positionSidecar() {
      const rect = activeCard.getBoundingClientRect();
      const margin = 12;
      const viewportWidth = win.innerWidth || doc.documentElement.clientWidth || 1024;
      const viewportHeight = win.innerHeight || doc.documentElement.clientHeight || 768;
      const sideRect = sidecar.getBoundingClientRect();
      const width = sideRect.width || Math.min(348, viewportWidth - 24);
      const height = sideRect.height || 164;
      let left;
      let top;

      const rightSpace = viewportWidth - rect.right;
      const leftSpace = rect.left;
      const belowSpace = viewportHeight - rect.bottom;
      const aboveSpace = rect.top;

      if (rightSpace >= width + margin) {
        left = rect.right + margin;
        top = rect.top;
        sidecar.dataset.dumberPlacement = "right";
      } else if (leftSpace >= width + margin) {
        left = rect.left - width - margin;
        top = rect.top;
        sidecar.dataset.dumberPlacement = "left";
      } else if (belowSpace >= height + margin) {
        left = clampPosition(rect.left, margin, viewportWidth - width - margin);
        top = rect.bottom + margin;
        sidecar.dataset.dumberPlacement = "below";
      } else if (aboveSpace >= height + margin) {
        left = clampPosition(rect.left, margin, viewportWidth - width - margin);
        top = rect.top - height - margin;
        sidecar.dataset.dumberPlacement = "above";
      } else {
        delete sidecar.dataset.dumberPlacement;
        return false;
      }

      sidecar.style.left = `${Math.round(clampPosition(left, margin, viewportWidth - width - margin))}px`;
      sidecar.style.top = `${Math.round(clampPosition(top, margin, viewportHeight - height - margin))}px`;
      return true;
    }

    async function savePreference(action) {
      if (!activePayload || typeof onPreference !== "function") return;
      moreButton.disabled = true;
      lessButton.disabled = true;
      feedback.textContent = "正在保存…";
      try {
        await onPreference(action, activePayload);
        feedback.textContent = action === "more" ? "已记录：更多这种" : "已记录：这条真有用";
      } catch {
        feedback.textContent = "本次偏好未保存";
        moreButton.disabled = false;
        lessButton.disabled = false;
      }
    }

    function destroy() {
      hide();
      activityObserver.disconnect();
      beamObserver?.disconnect();
      if (activityFrame) {
        win.cancelAnimationFrame?.(activityFrame);
        win.clearTimeout(activityFrame);
      }
      doc.removeEventListener("pointerover", handlePointerOver, true);
      doc.removeEventListener("pointerout", handlePointerOut, true);
      doc.removeEventListener("focusin", handleFocusIn, true);
      doc.removeEventListener("focusout", handleFocusOut, true);
      win.removeEventListener?.("scroll", schedulePosition, true);
      win.removeEventListener?.("resize", schedulePosition);
      reducedMotion?.removeEventListener?.("change", syncAllSpectrumAnimations);
      for (const card of [...markedCards]) unmark(card);
      activityOrb.destroy();
      sidecar.remove();
      activity.remove();
    }

    return Object.freeze({
      destroy,
      emphasize,
      emphasisNeedsRepair,
      ensureStyles,
      mark,
      syncActivity: scheduleActivitySync,
      unmark
    });
  }

  function createSidecar(doc) {
    const existing = doc.querySelector?.(".dumber-sidecar[data-dumber-owned]");
    if (existing) return existing;
    const sidecar = doc.createElement("aside");
    sidecar.className = "dumber-sidecar";
    sidecar.dataset.dumberOwned = "";
    sidecar.setAttribute("aria-hidden", "true");
    sidecar.innerHTML = `
      <div class="dumber-celebration" aria-hidden="true">D↑<br>VIP</div>
      <div class="dumber-sidecar-content">
        <span class="dumber-sidecar-label">DUMBER 精选</span>
        <strong class="dumber-sidecar-copy">这条内容更适合现在的你。</strong>
        <span class="dumber-sidecar-score">本次推荐强度</span>
      </div>
      <div class="dumber-sidecar-actions">
        <button type="button" data-action="more">更多这种</button>
        <button type="button" data-action="less">这条真有用</button>
        <span class="dumber-sidecar-feedback" role="status" aria-live="polite"></span>
      </div>
    `;
    (doc.body || doc.documentElement).append(sidecar);
    return sidecar;
  }

  function createActivity(doc) {
    const existing = doc.querySelector?.(".dumber-activity[data-dumber-owned]");
    if (existing) return existing;
    const activity = doc.createElement("aside");
    activity.className = "dumber-activity";
    activity.dataset.dumberOwned = "";
    activity.hidden = true;
    activity.setAttribute("role", "status");
    activity.setAttribute("aria-live", "polite");
    activity.setAttribute("aria-atomic", "true");
    activity.innerHTML = `
      <canvas class="dumber-activity-signal" width="64" height="64" role="img" aria-label="Composing orb"></canvas>
      <span class="dumber-activity-copy">
        <strong class="dumber-activity-label" data-text="Scanning….">Scanning….</strong>
        <span class="dumber-activity-detail">等待发现内容</span>
      </span>
    `;
    (doc.body || doc.documentElement).append(activity);
    return activity;
  }

  // Composing-orb geometry is a native Canvas2D port of Thinking Orbs' MIT-licensed ribbon preset.
  // DUMBER changes only the grayscale painter to its existing neon palette.
  function createActivityOrb(canvas, win, reducedMotion) {
    const noop = Object.freeze({ destroy() {}, setActive() {} });
    const ctx = canvas?.getContext?.("2d");
    if (!ctx) return noop;

    const size = 64;
    const dpr = Math.min(2, win.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    let active = false;
    let running = false;
    let frameId = 0;

    function draw(time = .6) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      drawComposingOrb(ctx, size, time);
    }

    function loop() {
      if (!running) return;
      draw((win.performance.now() / 1000) * 2.34);
      frameId = win.requestAnimationFrame(loop);
    }

    function start() {
      if (running || !active || reducedMotion?.matches || win.document.visibilityState === "hidden") return;
      running = true;
      canvas.dataset.running = "true";
      frameId = win.requestAnimationFrame(loop);
    }

    function stop(staticFrame = false) {
      running = false;
      canvas.dataset.running = "false";
      if (frameId) win.cancelAnimationFrame(frameId);
      frameId = 0;
      if (staticFrame) draw(.6);
    }

    function syncMotion() {
      if (active && !reducedMotion?.matches && win.document.visibilityState !== "hidden") start();
      else stop(true);
    }

    function setActive(value) {
      active = Boolean(value);
      syncMotion();
    }

    function onVisibilityChange() {
      if (win.document.visibilityState === "hidden") stop(false);
      else syncMotion();
    }

    function destroy() {
      stop(false);
      win.document.removeEventListener("visibilitychange", onVisibilityChange);
      reducedMotion?.removeEventListener?.("change", syncMotion);
    }

    win.document.addEventListener("visibilitychange", onVisibilityChange);
    reducedMotion?.addEventListener?.("change", syncMotion);
    canvas.dataset.running = "false";
    draw(.6);
    return Object.freeze({ destroy, setActive });
  }

  const ORB_NEON = Object.freeze([
    Object.freeze([143, 255, 216]),
    Object.freeze([128, 200, 255]),
    Object.freeze([185, 140, 255]),
    Object.freeze([255, 135, 187]),
    Object.freeze([255, 224, 111])
  ]);

  function drawComposingOrb(ctx, size, time) {
    const cx = size / 2;
    const cy = size / 2;
    const radius = (size / 2) * .78;
    const cameraTilt = .3;
    const project = makeOrbProjector(0, cameraTilt, cx, cy);
    const radiusScale = (size / 300) ** .6;
    const dots = [];

    for (let index = 0; index < 38; index += 1) {
      const direction = fibonacciDirection(index, 38);
      const [x, y, z] = project(direction[0] * radius, direction[1] * radius, direction[2] * radius);
      const depth = (z / radius + 1) / 2;
      dots.push({ x, y, z, r: .8 * radiusScale, white: .78, a: .1 + .22 * depth });
    }

    const tilt = .55;
    const ux = 1;
    const uy = 0;
    const uz = 0;
    const vx = 0;
    const vy = Math.cos(tilt);
    const vz = Math.sin(tilt);
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const lanes = Math.round(3 * 3.9);

    for (let lane = 0; lane < lanes; lane += 1) {
      const laneOffset = (lane - (lanes - 1) / 2) * .075;
      const edge = Math.abs(lane - (lanes - 1) / 2) / Math.max(1, (lanes - 1) / 2);
      for (let segment = 0; segment < 44; segment += 1) {
        const angle = (segment / 44) * 2 * Math.PI;
        const wobble = .16 * Math.sin(angle * 3 - time * 1.7 + lane * .22)
          + .07 * Math.sin(angle * 5 + time * 1.1);
        const offset = laneOffset + wobble;
        const x = ux * Math.cos(angle) + vx * Math.sin(angle) + nx * offset;
        const y = uy * Math.cos(angle) + vy * Math.sin(angle) + ny * offset;
        const z = uz * Math.cos(angle) + vz * Math.sin(angle) + nz * offset;
        const length = Math.sqrt(x * x + y * y + z * z);
        const [px, py, projectedZ] = project(
          (x / length) * radius,
          (y / length) * radius,
          (z / length) * radius
        );
        const depth = (projectedZ / radius + 1) / 2;
        dots.push({
          x: px,
          y: py,
          z: projectedZ,
          r: (.935 + 1.445 * depth) * (1 - .25 * edge) * radiusScale,
          white: .52 - .44 * depth + .18 * edge,
          a: .4 + .6 * depth
        });
      }
    }

    dots.sort((left, right) => left.z - right.z);
    for (const dot of dots) {
      if (dot.a < .02) continue;
      const phase = ((Math.atan2(dot.y - cy, dot.x - cx) / (2 * Math.PI)) + 1 + dot.z / size * .18 + time * .025) % 1;
      const scaled = phase * ORB_NEON.length;
      const from = ORB_NEON[Math.floor(scaled) % ORB_NEON.length];
      const to = ORB_NEON[(Math.floor(scaled) + 1) % ORB_NEON.length];
      const mix = scaled - Math.floor(scaled);
      const ink = 1 - Math.min(1, Math.max(0, dot.white));
      const intensity = .54 + .46 * ink;
      const red = Math.round((from[0] + (to[0] - from[0]) * mix) * intensity);
      const green = Math.round((from[1] + (to[1] - from[1]) * mix) * intensity);
      const blue = Math.round((from[2] + (to[2] - from[2]) * mix) * intensity);
      ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${dot.a})`;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, Math.max(.3, dot.r), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function fibonacciDirection(index, count) {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const y = 1 - (2 * (index + .5)) / count;
    const radius = Math.sqrt(1 - y * y);
    const angle = index * golden;
    return [radius * Math.cos(angle), y, radius * Math.sin(angle)];
  }

  function makeOrbProjector(yaw, tilt, cx, cy) {
    const sinTilt = Math.sin(tilt);
    const cosTilt = Math.cos(tilt);
    const sinYaw = Math.sin(yaw);
    const cosYaw = Math.cos(yaw);
    return (x, y, z) => {
      const rotatedX = x * cosYaw + z * sinYaw;
      const rotatedZ = -x * sinYaw + z * cosYaw;
      const rotatedY = y * cosTilt - rotatedZ * sinTilt;
      const depth = y * sinTilt + rotatedZ * cosTilt;
      return [cx + rotatedX, cy - rotatedY, depth];
    };
  }

  function uniqueConnected(elements, card) {
    const seen = new Set();
    return (elements || []).filter((element) => {
      if (!element || seen.has(element) || !card.contains?.(element)) return false;
      seen.add(element);
      return true;
    });
  }

  function wrapExactPhrases(rootElement, phraseValues, doc, limit = 8) {
    if (!rootElement || limit <= 0) return [];
    const phrases = [...new Set((phraseValues || []).filter(Boolean))]
      .sort((left, right) => right.length - left.length)
      .map((text) => ({ text, lower: text.toLowerCase() }));
    if (!phrases.length) return [];

    // ponytail: match inside individual host text nodes; use DOM Range only if X proves cross-node phrases common.
    const walker = doc.createTreeWalker(rootElement, 4);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    const spans = [];

    for (const node of textNodes) {
      if (spans.length >= limit || !node.parentNode || node.parentElement?.closest?.(".dumber-emphasis")) continue;
      const text = node.nodeValue || "";
      const lower = text.toLowerCase();
      const matches = [];
      let cursor = 0;
      while (cursor < text.length && spans.length + matches.length < limit) {
        let best = null;
        for (const phrase of phrases) {
          const index = lower.indexOf(phrase.lower, cursor);
          if (index < 0) continue;
          if (!best || index < best.index || (index === best.index && phrase.text.length > best.length)) {
            best = { index, length: phrase.text.length };
          }
        }
        if (!best) break;
        matches.push(best);
        cursor = best.index + best.length;
      }
      if (!matches.length) continue;

      const fragment = doc.createDocumentFragment();
      cursor = 0;
      for (const match of matches) {
        if (match.index > cursor) fragment.append(doc.createTextNode(text.slice(cursor, match.index)));
        const span = doc.createElement("span");
        span.className = "dumber-emphasis";
        span.dataset.dumberOwned = "";
        span.textContent = text.slice(match.index, match.index + match.length);
        fragment.append(span);
        spans.push(span);
        cursor = match.index + match.length;
      }
      if (cursor < text.length) fragment.append(doc.createTextNode(text.slice(cursor)));
      node.replaceWith(fragment);
    }
    return spans;
  }

  function sameElementSet(left, right) {
    const leftSet = new Set(left || []);
    const rightSet = new Set(right || []);
    return leftSet.size === rightSet.size && [...leftSet].every((element) => rightSet.has(element));
  }

  function sameStringArray(left, right) {
    return (left || []).length === (right || []).length
      && (left || []).every((value, index) => value === right[index]);
  }

  function reconcileClass(previousElements, nextElements, className) {
    const previous = new Set(previousElements || []);
    const next = new Set(nextElements || []);
    for (const element of previous) {
      if (!next.has(element)) element.classList?.remove(className);
    }
    for (const element of next) element.classList?.add(className);
  }

  function clampPosition(value, min, max) {
    if (max < min) return min;
    return Math.min(max, Math.max(min, value));
  }

  function isDarkSurface(element, win) {
    let current = element;
    for (let depth = 0; current && depth < 6; depth += 1) {
      const color = win.getComputedStyle?.(current)?.backgroundColor || "";
      const rgba = parseColor(color);
      if (rgba && rgba[3] > 0.15) {
        const [red, green, blue] = rgba;
        const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
        return luminance < 0.46;
      }
      current = current.parentElement;
    }
    return win.matchMedia?.("(prefers-color-scheme: dark)")?.matches === true;
  }

  function parseColor(value) {
    const match = String(value).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
    if (!match) return null;
    return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])];
  }

  return Object.freeze({ DRIVER_COPY, STYLE_TEXT, createRenderer, isDarkSurface, parseColor });
});
