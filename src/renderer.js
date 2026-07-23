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
      inherits: false;
      initial-value: 0deg;
    }

    .dumber-vip {
      --dumber-angle: 0deg;
      --dumber-surface: rgba(250, 250, 253, .985);
      --dumber-ink: #11131a;
      --dumber-muted: #5d6270;
      --dumber-radius: 16px;
      box-sizing: border-box !important;
      border: 2px solid transparent !important;
      border-radius: var(--dumber-radius) !important;
      background:
        linear-gradient(var(--dumber-surface), var(--dumber-surface)) padding-box,
        conic-gradient(
          from var(--dumber-angle),
          #8fffd8,
          #80c8ff,
          #b98cff,
          #ff87bb,
          #ffe06f,
          #8fffd8
        ) border-box !important;
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, .34),
        0 0 26px rgba(156, 113, 255, .22),
        0 18px 48px rgba(18, 14, 36, .12) !important;
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
      font-size: 1.075em !important;
      font-weight: 600 !important;
      line-height: 1.58 !important;
      letter-spacing: .002em !important;
      text-wrap: pretty;
    }

    .dumber-vip.dumber-primary :is(a, span, div, p, strong, em),
    .dumber-vip .dumber-primary :is(a, span, div, p, strong, em) {
      color: inherit !important;
      line-height: inherit !important;
    }

    .dumber-vip.dumber-secondary,
    .dumber-vip .dumber-secondary {
      opacity: .66 !important;
      filter: saturate(.78) !important;
      transition: opacity 120ms ease !important;
    }

    .dumber-vip.dumber-secondary:hover,
    .dumber-vip.dumber-secondary:focus,
    .dumber-vip.dumber-secondary:focus-within,
    .dumber-vip .dumber-secondary:hover,
    .dumber-vip .dumber-secondary:focus,
    .dumber-vip .dumber-secondary:focus-within {
      opacity: .92 !important;
    }

    .dumber-vip.dumber-expanded,
    .dumber-vip .dumber-expanded {
      display: block !important;
      max-height: none !important;
      overflow: visible !important;
      white-space: normal !important;
      text-overflow: clip !important;
      -webkit-box-orient: initial !important;
      -webkit-line-clamp: unset !important;
      line-clamp: unset !important;
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

    @media (prefers-reduced-motion: reduce) {
      .dumber-sidecar { transition: opacity 80ms linear, visibility 0s linear 80ms; transform: none; }
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

    ensureStyles(doc);
    const sidecar = createSidecar(doc);
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
      const expandableElements = uniqueConnected(candidate.expandableElements, card);
      const previous = records.get(card);

      reconcileClass(previous?.primaryElements, primaryElements, "dumber-primary");
      reconcileClass(previous?.secondaryElements, secondaryElements, "dumber-secondary");
      reconcileClass(previous?.expandableElements, expandableElements, "dumber-expanded");

      card.classList.add("dumber-vip");
      card.dataset.dumberPromotion = "true";
      card.dataset.dumberPromotionLabel = curation.promotionLabel || Shared.DRIVER_LABELS[curation.primaryDriver];
      card.style.setProperty("--dumber-surface", dark ? "rgba(17, 18, 24, .985)" : "rgba(250, 250, 253, .985)");
      card.style.setProperty("--dumber-ink", dark ? "#f7f8fb" : "#11131a");
      card.style.setProperty("--dumber-muted", dark ? "#b8bdc9" : "#5d6270");
      card.style.setProperty("--dumber-radius", computed?.borderRadius && computed.borderRadius !== "0px" ? computed.borderRadius : "16px");

      const payload = { candidate, curation, decision };
      const record = {
        primaryElements,
        secondaryElements,
        expandableElements,
        payload,
        spectrumAnimation: previous?.spectrumAnimation || null
      };
      records.set(card, record);
      markedCards.add(card);
      syncSpectrumAnimation(card, record);
      if (activeCard === card) show(card, payload);
    }

    function unmark(card, options = {}) {
      const record = records.get(card);
      card?.classList?.remove("dumber-vip");
      if (card?.dataset) {
        delete card.dataset.dumberPromotion;
        delete card.dataset.dumberPromotionLabel;
      }
      card?.style?.removeProperty("--dumber-surface");
      card?.style?.removeProperty("--dumber-ink");
      card?.style?.removeProperty("--dumber-muted");
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
        record.spectrumAnimation = card.animate([
          { "--dumber-angle": "0deg" },
          { "--dumber-angle": "360deg" }
        ], {
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
      score.textContent = `本次推荐强度 ${Math.round(payload.decision.adjustedScore * 100)}%`;
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
      doc.removeEventListener("pointerover", handlePointerOver, true);
      doc.removeEventListener("pointerout", handlePointerOut, true);
      doc.removeEventListener("focusin", handleFocusIn, true);
      doc.removeEventListener("focusout", handleFocusOut, true);
      win.removeEventListener?.("scroll", schedulePosition, true);
      win.removeEventListener?.("resize", schedulePosition);
      reducedMotion?.removeEventListener?.("change", syncAllSpectrumAnimations);
      for (const card of [...markedCards]) unmark(card);
      sidecar.remove();
    }

    return Object.freeze({ destroy, ensureStyles, mark, unmark });
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

  function uniqueConnected(elements, card) {
    const seen = new Set();
    return (elements || []).filter((element) => {
      if (!element || seen.has(element) || !card.contains?.(element)) return false;
      seen.add(element);
      return true;
    });
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
