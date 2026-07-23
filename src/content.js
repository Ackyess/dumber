(() => {
  "use strict";

  const Shared = globalThis.DumberShared;
  const Adapters = globalThis.DumberAdapters;
  const Renderer = globalThis.DumberRenderer;
  if (!Shared || !Adapters || !Renderer) return;

  const adapter = Adapters.detect(location, document);
  if (!adapter) return;

  const platform = adapter.name;
  const roots = new Set();
  const rootObservers = new Map();
  const dirtyRoots = new Set();
  const trackedCards = new Set();
  const cardRecords = new WeakMap();
  const pending = new Map();
  const memoryCurations = new Map();
  const reportedDecisions = new Set();
  const metricEvents = [];
  const MAX_CARD_RETRIES = 1;

  let settings = Shared.DEFAULT_SETTINGS;
  let profile = Shared.DEFAULT_PROFILE;
  let scanTimer = 0;
  let flushTimer = 0;
  let metricsTimer = 0;
  let navigationTimer = 0;
  let activeRequestEpoch = -1;
  let runtimeEpoch = 0;
  let started = false;
  let currentUrl = location.href;

  const renderer = Renderer.createRenderer({
    document,
    onPreference: savePreference,
    onHover: (candidate) => queueMetric({
      type: "hover",
      id: `hover:${candidate.fingerprint}`
    })
  });

  const intersection = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      intersection.unobserve(entry.target);
      const record = cardRecords.get(entry.target);
      if (record?.candidate) enqueueCandidate(record.candidate);
    }
    scheduleFlush();
  }, {
    rootMargin: "360px 0px",
    threshold: 0.02
  });

  void initialize();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;

    if (changes[Shared.SETTINGS_KEY]) {
      const previousSignature = modelSignature(settings);
      settings = Shared.sanitizeSettings(changes[Shared.SETTINGS_KEY].newValue);
      const nextSignature = modelSignature(settings);
      if (!isEnabled()) {
        stop();
      } else {
        if (!started) start();
        if (previousSignature !== nextSignature) resetForModelChange();
        else reevaluateAll();
      }
    }

    if (changes[Shared.PROFILE_KEY]) {
      profile = Shared.normalizeProfile(changes[Shared.PROFILE_KEY].newValue);
      if (isEnabled()) reevaluateAll();
    }
  });

  window.addEventListener("pagehide", () => {
    void flushMetrics();
  }, { capture: true });

  async function initialize() {
    try {
      const stored = await chrome.storage.local.get([Shared.SETTINGS_KEY, Shared.PROFILE_KEY]);
      settings = Shared.sanitizeSettings(stored[Shared.SETTINGS_KEY]);
      profile = Shared.normalizeProfile(stored[Shared.PROFILE_KEY]);
      if (isEnabled()) start();
    } catch (error) {
      console.debug("[DUMBER] 初始化失败", error?.message || error);
    }
  }

  function isEnabled() {
    return settings.enabled
      && Boolean(settings.apiKey && settings.model)
      && (platform === "x" ? settings.xEnabled : settings.bilibiliEnabled);
  }

  function start() {
    if (started || !isEnabled()) return;
    started = true;
    runtimeEpoch += 1;
    currentUrl = location.href;
    registerRoot(document);
    scheduleScan(document, true);
    navigationTimer = window.setInterval(checkNavigation, 800);
  }

  function stop() {
    if (!started) return;
    started = false;
    runtimeEpoch += 1;
    void flushMetrics();
    clearTimeout(scanTimer);
    clearTimeout(flushTimer);
    clearTimeout(metricsTimer);
    clearInterval(navigationTimer);
    scanTimer = 0;
    flushTimer = 0;
    metricsTimer = 0;
    navigationTimer = 0;
    pending.clear();
    dirtyRoots.clear();
    intersection.disconnect();

    for (const observer of rootObservers.values()) observer.disconnect();
    rootObservers.clear();
    roots.clear();

    for (const card of trackedCards) {
      renderer.unmark(card);
      clearCardState(card);
    }
    trackedCards.clear();
  }

  function registerRoot(rootNode) {
    if (!rootNode || roots.has(rootNode)) return;
    roots.add(rootNode);
    renderer.ensureStyles(rootNode);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (platform === "bilibili") {
          for (const node of mutation.addedNodes) discoverShadowRoots(node);
        }
      }
      scheduleScan(rootNode);
    });
    observer.observe(rootNode, { childList: true, subtree: true, characterData: true });
    rootObservers.set(rootNode, observer);

    if (platform === "bilibili") discoverShadowRoots(rootNode);
    scheduleScan(rootNode);
  }

  function discoverShadowRoots(node) {
    if (!node) return;
    if (node.shadowRoot) registerRoot(node.shadowRoot);
    if (!node.querySelectorAll) return;
    for (const element of node.querySelectorAll("*")) {
      if (element.shadowRoot) registerRoot(element.shadowRoot);
    }
  }

  function scheduleScan(rootNode, immediate = false) {
    if (rootNode) dirtyRoots.add(rootNode);
    if (scanTimer && immediate) {
      clearTimeout(scanTimer);
      scanTimer = 0;
    }
    if (scanTimer || !started) return;
    scanTimer = window.setTimeout(() => {
      scanTimer = 0;
      if (!isEnabled()) return;
      const targets = dirtyRoots.size ? Array.from(dirtyRoots) : Array.from(roots);
      dirtyRoots.clear();
      for (const rootNode of targets) scanRoot(rootNode);
      pruneDisconnectedCards();
      pruneDisconnectedRoots();
    }, immediate ? 0 : 36);
  }

  function scanRoot(rootNode) {
    let candidates = [];
    try {
      candidates = adapter.scan(rootNode);
    } catch (error) {
      console.debug(`[DUMBER] ${platform} 适配器扫描失败`, error?.message || error);
      return;
    }
    for (const descriptor of candidates) consider(descriptor);
  }

  function consider(descriptor) {
    const card = descriptor?.card;
    if (!card || !card.isConnected) return;

    const context = sanitizeContext(descriptor.context);
    if (!hasUsefulContext(context)) return;

    const fingerprint = Shared.createContentFingerprint(platform, context, Shared.EXTRACTOR_VERSION);
    const id = Shared.createCandidateId(platform, descriptor.stableId, fingerprint);
    const candidate = {
      ...descriptor,
      context,
      fingerprint,
      id,
      hash: fingerprint,
      queuedAt: performance.now(),
      preferenceContext: Shared.sanitizePreferenceContext({
        ...descriptor.preferenceContext,
        platform,
        fingerprint
      })
    };

    const existing = cardRecords.get(card);
    if (existing?.candidate?.fingerprint === fingerprint) {
      candidate.queuedAt = existing.candidate.queuedAt;
      const previousCandidate = existing.candidate;
      existing.candidate = candidate;
      if (existing.state === "promoted") {
        const curation = memoryCurations.get(memoryKey(fingerprint));
        if (curation && renderingNeedsRepair(card, previousCandidate, candidate)) {
          applyCuration(candidate, curation, { report: false });
        }
      }
      return;
    }

    const keepPriorPromotion = existing?.state === "promoted"
      && sameStableIdentity(existing.candidate, candidate);
    if (existing) {
      intersection.unobserve(card);
      removeCandidateFromPending(existing.candidate);
      if (!keepPriorPromotion) renderer.unmark(card);
    }

    trackedCards.add(card);
    card.dataset.dumberFingerprint = fingerprint;
    card.dataset.dumberState = "observing";
    cardRecords.set(card, {
      candidate,
      state: "observing",
      errorAt: 0,
      requestEpoch: -1,
      retryCount: 0
    });

    const remembered = memoryCurations.get(memoryKey(fingerprint));
    if (remembered) {
      applyCuration(candidate, remembered, { report: false });
    } else if (isNearViewport(card)) {
      enqueueCandidate(candidate);
      scheduleFlush();
    } else {
      intersection.observe(card);
    }
  }

  function enqueueCandidate(candidate) {
    const record = cardRecords.get(candidate.card);
    if (!record || record.candidate.fingerprint !== candidate.fingerprint) return;
    if (record.state === "queued" || record.state === "requesting") return;

    candidate.queuedAt = performance.now();

    const entry = pending.get(candidate.fingerprint) || {
      request: candidate,
      candidates: new Set()
    };
    entry.candidates.add(candidate);
    pending.set(candidate.fingerprint, entry);
    record.state = "queued";
    candidate.card.dataset.dumberState = "queued";
  }

  function scheduleFlush() {
    if (!pending.size || flushTimer || activeRequestEpoch === runtimeEpoch || !started) return;
    flushTimer = window.setTimeout(() => {
      flushTimer = 0;
      void flush();
    }, 24);
  }

  async function flush() {
    if (activeRequestEpoch === runtimeEpoch || !pending.size || !isEnabled()) return;
    const epoch = runtimeEpoch;
    const signature = modelSignature(settings);
    activeRequestEpoch = epoch;

    const batch = Array.from(pending.values()).slice(0, 8);
    for (const entry of batch) pending.delete(entry.request.fingerprint);
    for (const entry of batch) {
      for (const candidate of entry.candidates) {
        const record = cardRecords.get(candidate.card);
        if (record?.candidate.fingerprint === candidate.fingerprint) {
          record.state = "requesting";
          record.requestEpoch = epoch;
          candidate.card.dataset.dumberState = "requesting";
        }
      }
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: "curate",
        extractorVersion: Shared.EXTRACTOR_VERSION,
        items: batch.map(({ request }) => ({
          id: request.id,
          hash: request.hash,
          context: request.context
        }))
      });
      if (!response?.ok) {
        const error = new Error(response?.error || "策展请求失败");
        error.code = response?.errorCode || "";
        throw error;
      }

      if (!isCurrentRequest(epoch, signature)) {
        releaseStaleBatch(batch, epoch);
        return;
      }

      const byId = new Map((response.curations || []).map((curation) => [curation.id, curation]));
      for (const entry of batch) {
        const curation = byId.get(entry.request.id) || Shared.createNeutralCuration(entry.request.id);
        rememberCuration(entry.request.fingerprint, curation, signature);
        for (const candidate of entry.candidates) applyCuration(candidate, curation);
      }
    } catch (error) {
      if (isCurrentRequest(epoch, signature)) {
        console.debug("[DUMBER] 策展请求失败", error?.message || error);
        for (const entry of batch) markEntryError(entry, epoch, error?.code);
      } else {
        releaseStaleBatch(batch, epoch);
      }
    } finally {
      if (activeRequestEpoch === epoch) activeRequestEpoch = -1;
      if (pending.size) scheduleFlush();
    }
  }

  function isCurrentRequest(epoch, signature) {
    return started
      && isEnabled()
      && epoch === runtimeEpoch
      && signature === modelSignature(settings);
  }

  function releaseStaleBatch(batch, epoch) {
    if (!started || !isEnabled()) return;
    for (const entry of batch) {
      for (const candidate of entry.candidates) {
        const record = cardRecords.get(candidate.card);
        if (!candidate.card.isConnected || record?.candidate.fingerprint !== candidate.fingerprint) continue;
        if (record.state !== "requesting" || record.requestEpoch !== epoch) continue;
        record.state = "observing";
        record.requestEpoch = -1;
        candidate.card.dataset.dumberState = "observing";
        if (isNearViewport(candidate.card)) enqueueCandidate(candidate);
        else intersection.observe(candidate.card);
      }
    }
  }

  function markEntryError(entry, epoch, errorCode = "") {
    const retryCandidates = [];
    for (const candidate of entry.candidates) {
      const record = cardRecords.get(candidate.card);
      if (!record || record.candidate.fingerprint !== candidate.fingerprint || record.requestEpoch !== epoch) continue;
      record.state = "error";
      record.errorAt = Date.now();
      record.requestEpoch = -1;
      record.retryCount = (record.retryCount || 0) + 1;
      candidate.card.dataset.dumberState = "error";
      if (record.retryCount <= MAX_CARD_RETRIES) {
        retryCandidates.push({ candidate, errorAt: record.errorAt });
      }
    }
    if (!retryCandidates.length) return;
    const retryAfterMs = errorCode === "DUMBER_ENDPOINT_PERMISSION_REQUIRED" ? 60000 : 15000;
    window.setTimeout(() => {
      if (!isEnabled()) return;
      for (const { candidate, errorAt } of retryCandidates) {
        const record = cardRecords.get(candidate.card);
        if (!candidate.card.isConnected
          || record?.candidate.fingerprint !== candidate.fingerprint
          || record.state !== "error"
          || record.errorAt !== errorAt) continue;
        record.state = "observing";
        enqueueCandidate(candidate);
      }
      scheduleFlush();
    }, retryAfterMs);
  }

  function applyCuration(candidate, curation, options = {}) {
    const card = candidate.card;
    const record = cardRecords.get(card);
    if (!started || !isEnabled() || !card?.isConnected || !record || record.candidate.fingerprint !== candidate.fingerprint) return;
    // A host framework may replace descendants while a request is in flight.
    // Always render against the newest descriptor for the same card/fingerprint.
    candidate = record.candidate;

    const decision = Shared.getPromotionDecision(
      curation,
      settings,
      profile,
      candidate.preferenceContext
    );

    if (decision.promote) {
      renderer.mark(card, candidate, curation, decision);
      record.state = "promoted";
      record.requestEpoch = -1;
      record.errorAt = 0;
      record.retryCount = 0;
      card.dataset.dumberState = "promoted";
    } else {
      renderer.unmark(card);
      record.state = "ready";
      record.requestEpoch = -1;
      record.errorAt = 0;
      record.retryCount = 0;
      card.dataset.dumberState = "ready";
    }

    const reportKey = `${modelSignature(settings)}:${candidate.fingerprint}`;
    if (options.report === false || reportedDecisions.has(reportKey)) return;
    reportedDecisions.add(reportKey);
    if (reportedDecisions.size > 2400) {
      reportedDecisions.delete(reportedDecisions.values().next().value);
    }
    queueMetric({
      type: "decision",
      id: `decision:${reportKey}`,
      promoted: decision.promote,
      latencyMs: Math.max(0, Math.round(performance.now() - candidate.queuedAt))
    });
  }

  function rememberCuration(fingerprint, curation, signature = modelSignature(settings)) {
    const key = memoryKey(fingerprint, signature);
    memoryCurations.delete(key);
    memoryCurations.set(key, curation);
    if (memoryCurations.size > 1000) {
      memoryCurations.delete(memoryCurations.keys().next().value);
    }
  }

  function reevaluateAll() {
    for (const card of trackedCards) {
      if (!card.isConnected) continue;
      const candidate = cardRecords.get(card)?.candidate;
      if (!candidate) continue;
      const curation = memoryCurations.get(memoryKey(candidate.fingerprint));
      if (curation) applyCuration(candidate, curation, { report: false });
    }
  }

  function resetForModelChange() {
    runtimeEpoch += 1;
    pending.clear();
    intersection.disconnect();
    reportedDecisions.clear();
    for (const card of trackedCards) {
      if (!card.isConnected) continue;
      renderer.unmark(card);
      const record = cardRecords.get(card);
      if (!record?.candidate) continue;
      record.state = "observing";
      record.requestEpoch = -1;
      record.errorAt = 0;
      record.retryCount = 0;
      record.candidate.queuedAt = performance.now();
      card.dataset.dumberState = "observing";
      intersection.observe(card);
    }
  }

  async function savePreference(action, payload) {
    const curation = payload.curation;
    const candidate = payload.candidate;
    const response = await chrome.runtime.sendMessage({
      type: "preferenceAction",
      action,
      context: {
        ...candidate.preferenceContext,
        primaryDriver: curation.primaryDriver
      }
    });
    if (!response?.ok) throw new Error(response?.error || "偏好保存失败");
    profile = Shared.normalizeProfile(response.profile);
    reevaluateAll();
    queueMetric({
      type: action === "less" ? "preferenceLess" : "preferenceMore",
      id: `preference:${action}:${candidate.fingerprint}:${Date.now()}`
    });
  }

  function queueMetric(event) {
    metricEvents.push(event);
    if (metricEvents.length >= 20) {
      void flushMetrics();
      return;
    }
    if (metricsTimer) return;
    metricsTimer = window.setTimeout(() => {
      metricsTimer = 0;
      void flushMetrics();
    }, 450);
  }

  async function flushMetrics() {
    clearTimeout(metricsTimer);
    metricsTimer = 0;
    if (!metricEvents.length) return;
    const events = metricEvents.splice(0, 40);
    try {
      await chrome.runtime.sendMessage({ type: "runtimeEvents", events });
    } catch {
      // Metrics are best-effort and must never interrupt rendering.
    }
    if (metricEvents.length && !metricsTimer) {
      metricsTimer = window.setTimeout(() => {
        metricsTimer = 0;
        void flushMetrics();
      }, 120);
    }
  }

  function checkNavigation() {
    if (location.href === currentUrl) return;
    currentUrl = location.href;
    for (const rootNode of roots) scheduleScan(rootNode, true);
  }

  function pruneDisconnectedCards() {
    for (const card of trackedCards) {
      if (card.isConnected) continue;
      const candidate = cardRecords.get(card)?.candidate;
      removeCandidateFromPending(candidate);
      renderer.unmark(card);
      clearCardState(card);
      trackedCards.delete(card);
    }
  }

  function pruneDisconnectedRoots() {
    for (const rootNode of roots) {
      if (rootNode === document) continue;
      const host = rootNode.host;
      if (!host || host.isConnected) continue;
      rootObservers.get(rootNode)?.disconnect();
      rootObservers.delete(rootNode);
      roots.delete(rootNode);
      dirtyRoots.delete(rootNode);
    }
  }

  function removeCandidateFromPending(candidate) {
    if (!candidate) return;
    const entry = pending.get(candidate.fingerprint);
    if (!entry) return;
    entry.candidates.delete(candidate);
    if (!entry.candidates.size) pending.delete(candidate.fingerprint);
  }

  function clearCardState(card) {
    if (!card?.dataset) return;
    delete card.dataset.dumberFingerprint;
    delete card.dataset.dumberState;
    cardRecords.delete(card);
  }

  function sanitizeContext(value) {
    const source = Shared.compactRecord(value);
    const output = {};
    for (const [key, item] of Object.entries(source)) {
      if (typeof item === "string") {
        output[key] = Shared.normalizeMultilineText(item).slice(0, key === "text" || key === "description" ? 1600 : 700);
      } else if (Array.isArray(item)) {
        output[key] = item.map((part) => Shared.normalizeText(part).slice(0, 120)).filter(Boolean).slice(0, 8);
      } else if (typeof item === "number" || typeof item === "boolean") {
        output[key] = item;
      }
    }
    return output;
  }

  function hasUsefulContext(context) {
    const text = [context.text, context.title, context.description, context.quoteText, context.linkTitle]
      .filter(Boolean)
      .join(" ");
    return Shared.normalizeText(text).length >= 8;
  }

  function modelSignature(value) {
    const sanitized = Shared.sanitizeSettings(value);
    return Shared.hashText(Shared.stableStringify({
      apiBaseUrl: sanitized.apiBaseUrl,
      model: sanitized.model,
      promptVersion: Shared.PROMPT_VERSION,
      extractorVersion: Shared.EXTRACTOR_VERSION
    }));
  }

  function memoryKey(fingerprint, signature = modelSignature(settings)) {
    return `${signature}:${fingerprint}`;
  }

  function isNearViewport(card) {
    if (typeof card?.getBoundingClientRect !== "function") return true;
    const rect = card.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
    return rect.bottom >= -360 && rect.top <= viewportHeight + 360;
  }

  function renderingNeedsRepair(card, previous, next) {
    if (!card.classList?.contains("dumber-vip")) return true;
    if (!sameElementSet(previous?.primaryElements, next?.primaryElements)) return true;
    if (!sameElementSet(previous?.secondaryElements, next?.secondaryElements)) return true;
    if (!sameElementSet(previous?.expandableElements, next?.expandableElements)) return true;
    return !elementsCarryClass(next?.primaryElements, "dumber-primary")
      || !elementsCarryClass(next?.secondaryElements, "dumber-secondary")
      || !elementsCarryClass(next?.expandableElements, "dumber-expanded");
  }

  function sameStableIdentity(left, right) {
    return Boolean(left?.stableId && right?.stableId && left.stableId === right.stableId);
  }

  function sameElementSet(left, right) {
    const leftSet = new Set((left || []).filter(Boolean));
    const rightSet = new Set((right || []).filter(Boolean));
    if (leftSet.size !== rightSet.size) return false;
    for (const element of leftSet) {
      if (!rightSet.has(element)) return false;
    }
    return true;
  }

  function elementsCarryClass(elements, className) {
    return (elements || []).filter(Boolean).every((element) => element.classList?.contains(className));
  }
})();
