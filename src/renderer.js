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

    .dumber-vip {
      --dumber-angle: 0deg;
      --dumber-surface: rgba(250, 250, 253, .985);
      --dumber-ink: #11131a;
      --dumber-radius: 16px;
      border-radius: var(--dumber-radius) !important;
      background-color: var(--dumber-surface) !important;
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, .34),
        0 0 26px rgba(156, 113, 255, .22),
        0 18px 48px rgba(18, 14, 36, .12) !important;
    }

    .dumber-vip.dumber-ring-contained::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 2;
      box-sizing: border-box;
      padding: 2px;
      border-radius: inherit;
      background: conic-gradient(
          from var(--dumber-angle),
          #8fffd8,
          #80c8ff,
          #b98cff,
          #ff87bb,
          #ffe06f,
          #8fffd8
        );
      pointer-events: none;
      -webkit-mask:
        linear-gradient(#000 0 0) content-box,
        linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
    }

    .dumber-vip.dumber-ring-outline {
      outline: 2px solid #b98cff !important;
      outline-offset: -2px !important;
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
      grid-template-columns: 28px minmax(0, 1fr);
      align-items: center;
      gap: 10px;
      min-width: 214px;
      padding: 10px 12px;
      color: #f8f8fb;
      background: rgba(15, 15, 22, .94);
      border: 1px solid rgba(255, 255, 255, .18);
      border-radius: 14px;
      box-shadow: 0 12px 38px rgba(0, 0, 0, .3), 0 0 18px rgba(160, 114, 255, .14);
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

    .dumber-activity::after {
      content: "";
      position: absolute;
      inset: 0 0 auto;
      height: 2px;
      background: linear-gradient(90deg, #8fffd8, #80c8ff, #b98cff, #ff87bb, #ffe06f, #8fffd8);
      background-size: 200% 100%;
      opacity: .24;
    }

    .dumber-activity[data-phase="requesting"]::after,
    .dumber-activity[data-phase="enhancing"]::after,
    .dumber-activity[data-phase="queued"]::after {
      opacity: 1;
      animation: dumber-activity-scan 1100ms linear infinite;
    }

    .dumber-activity[data-phase="error"] {
      border-color: rgba(255, 143, 112, .55);
    }

    .dumber-activity-signal {
      position: relative;
      display: block;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: conic-gradient(from 0deg, #8fffd8, #80c8ff, #b98cff, #ff87bb, #ffe06f, #8fffd8);
      box-shadow: 0 0 14px rgba(143, 255, 216, .2);
    }

    .dumber-activity-signal::after {
      content: "";
      position: absolute;
      inset: 5px;
      border: 4px solid rgba(15, 15, 22, .92);
      border-radius: inherit;
      background: #caff7a;
    }

    .dumber-activity[data-phase="requesting"] .dumber-activity-signal,
    .dumber-activity[data-phase="enhancing"] .dumber-activity-signal,
    .dumber-activity[data-phase="queued"] .dumber-activity-signal {
      animation: dumber-activity-spin 950ms linear infinite;
    }

    .dumber-activity[data-phase="error"] .dumber-activity-signal::after {
      background: #ff8f70;
    }

    .dumber-activity-copy {
      display: grid;
      min-width: 0;
      gap: 3px;
    }

    .dumber-activity-label,
    .dumber-activity-detail {
      display: block;
      margin: 0;
      white-space: nowrap;
    }

    .dumber-activity-label {
      color: #fff;
      font-size: 12px;
      font-weight: 820;
      line-height: 1.2;
      letter-spacing: .01em;
    }

    .dumber-activity-detail {
      color: rgba(255, 255, 255, .62);
      font-size: 10px;
      font-weight: 560;
      line-height: 1.25;
    }

    @keyframes dumber-activity-spin {
      to { transform: rotate(360deg); }
    }

    @keyframes dumber-activity-scan {
      to { background-position: -200% 0; }
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
      .dumber-activity::after,
      .dumber-activity-signal { animation: none !important; transition: none !important; }
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
    let activeCard = null;
    let activePayload = null;
    let hideTimer = 0;
    let positionFrame = 0;
    let activityFrame = 0;

    ensureStyles(doc);
    const sidecar = createSidecar(doc);
    const activity = createActivity(doc);
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
        spectrumAnimation: previous?.spectrumAnimation || null
      };
      records.set(card, record);
      markedCards.add(card);
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
      return Boolean(record?.emphasisApplied
        && record.emphasisSpans.length
        && record.emphasisSpans.some((span) => !span.isConnected || !span.classList.contains("dumber-emphasis")));
    }

    function unmark(card, options = {}) {
      const record = records.get(card);
      clearEmphasis(record, card);
      card?.classList?.remove("dumber-vip");
      card?.classList?.remove("dumber-ring-contained");
      card?.classList?.remove("dumber-ring-outline");
      if (card?.dataset) {
        delete card.dataset.dumberPromotion;
        delete card.dataset.dumberPromotionLabel;
        delete card.dataset.dumberEnhancement;
      }
      card?.style?.removeProperty("--dumber-surface");
      card?.style?.removeProperty("--dumber-ink");
      card?.style?.removeProperty("--dumber-radius");
      card?.style?.removeProperty("--dumber-angle");
      for (const element of record?.primaryElements || []) element.classList?.remove("dumber-primary");
      for (const element of record?.secondaryElements || []) element.classList?.remove("dumber-secondary");
      for (const element of record?.expandableElements || []) element.classList?.remove("dumber-expanded");
      record?.spectrumAnimation?.cancel?.();
      records.delete(card);
      markedCards.delete(card);
      if (!options.keepSidecar && activeCard === card) hide();
    }

    function syncSpectrumAnimation(card, record = records.get(card)) {
      if (!record) return;
      if (reducedMotion?.matches || typeof card.animate !== "function") {
        record.spectrumAnimation?.cancel?.();
        record.spectrumAnimation = null;
        card.style.setProperty("--dumber-angle", "0deg");
        return;
      }
      card.style.removeProperty("--dumber-angle");
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
          duration: 14000,
          easing: "linear",
          iterations: Infinity
        });
      } catch {
        record.spectrumAnimation = null;
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
      if (!total) return;

      const completed = counts.ready + counts.promoted;
      let phase = "idle";
      let title = "AI 已就绪";
      let detail = `${completed} 条已处理 · ${counts.promoted} 条精选`;
      if (counts.requesting) {
        phase = "requesting";
        title = "AI 分析中";
        detail = `${counts.requesting} 条处理中 · ${completed} 条已处理`;
      } else if (enhancing) {
        phase = "enhancing";
        title = "AI 正在强化文案";
        detail = `${enhancing} 条二次处理中 · ${counts.promoted} 条已精选`;
      } else if (counts.queued) {
        phase = "queued";
        title = "等待 AI 分析";
        detail = `${counts.queued} 条排队 · ${completed} 条已处理`;
      } else if (counts.observing) {
        phase = "observing";
        title = "正在扫描信息流";
        detail = `${counts.observing} 条已发现 · ${completed} 条已处理`;
      } else if (counts.error) {
        phase = "error";
        title = "AI 暂时没响应";
        detail = `${counts.error} 条等待重试 · ${completed} 条已处理`;
      } else if (enhancementErrors) {
        phase = "error";
        title = "文案强化未完成";
        detail = `${enhancementErrors} 条保留首轮精选样式`;
      }
      activity.dataset.phase = phase;
      if (activityLabel.textContent !== title) activityLabel.textContent = title;
      if (activityDetail.textContent !== detail) activityDetail.textContent = detail;
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
      <span class="dumber-activity-signal" aria-hidden="true"></span>
      <span class="dumber-activity-copy">
        <strong class="dumber-activity-label">正在扫描信息流</strong>
        <span class="dumber-activity-detail">等待发现内容</span>
      </span>
    `;
    (doc.body || doc.documentElement).append(activity);
    return activity;
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
