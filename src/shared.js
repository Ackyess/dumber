(function attachDumberShared(root, factory) {
  const api = factory();
  root.DumberShared = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis, function createDumberShared() {
  "use strict";

  const SETTINGS_KEY = "dumberSettings";
  const CACHE_KEY = "dumberPromotionCacheV3";
  const PROFILE_KEY = "dumberPreferenceProfile";
  const METRICS_KEY = "dumberRuntimeMetrics";
  const LEGACY_CACHE_KEYS = Object.freeze([
    "dumberVerdictCache",
    "dumberPromotionCacheV2"
  ]);

  const SETTINGS_SCHEMA_VERSION = 2;
  const CACHE_SCHEMA_VERSION = 3;
  const PROFILE_SCHEMA_VERSION = 2;
  const METRICS_SCHEMA_VERSION = 1;
  const PROMPT_VERSION = "curator-2026-07-23-v3";
  const EXTRACTOR_VERSION = "extractors-2026-07-23-v2";
  const VISUAL_SLA_MS = 1000;
  // ponytail: fixed high-precision veto; make it configurable only after a real regression set justifies it.
  const MAX_PROMOTABLE_DURABLE_VALUE = 0.45;

  const DRIVER_LABELS = Object.freeze({
    high_emotion: "高情绪浓度",
    identity_resonance: "高共鸣",
    curiosity_gap: "强好奇驱动",
    reaction_chain: "热门延伸讨论",
    frictionless_exploration: "无阻力探索",
    instant_gratification: "即时满足",
    status_signal: "热门刺激",
    mixed: "DUMBER 精选"
  });
  const DRIVER_KEYS = Object.freeze(Object.keys(DRIVER_LABELS));

  const DEFAULT_SETTINGS = Object.freeze({
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    enabled: true,
    apiBaseUrl: "https://api.x.ai/v1",
    apiKey: "",
    model: "",
    promotionThreshold: 0.72,
    xEnabled: true,
    bilibiliEnabled: false,
    personalizationEnabled: true,
    requestTimeoutMs: 28000
  });

  const DEFAULT_PROFILE = Object.freeze({
    schemaVersion: PROFILE_SCHEMA_VERSION,
    drivers: Object.freeze({}),
    accounts: Object.freeze({}),
    topics: Object.freeze({}),
    items: Object.freeze({}),
    totalActions: 0,
    updatedAt: 0
  });

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeText(value) {
    return String(value ?? "")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeMultilineText(value) {
    return String(value ?? "")
      .replace(/\r\n?/g, "\n")
      .replace(/[\t\f\v]+/g, " ")
      .split("\n")
      .map((line) => normalizeText(line))
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  function hashText(value) {
    // Two independent 32-bit streams substantially reduce accidental collisions
    // while keeping fingerprints synchronous in content scripts.
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;
    const text = String(value ?? "");
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      first ^= code;
      first = Math.imul(first, 0x01000193);
      second ^= code + index;
      second = Math.imul(second, 0x85ebca6b);
      second ^= second >>> 13;
    }
    return [first, second]
      .map((part) => (part >>> 0).toString(16).padStart(8, "0"))
      .join("");
  }

  function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }

  function compactRecord(value) {
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
      if (item === null || item === undefined || item === "") return [];
      if (Array.isArray(item)) {
        const values = item.map(normalizeText).filter(Boolean);
        return values.length ? [[key, values]] : [];
      }
      if (typeof item === "object") {
        const nested = compactRecord(item);
        return Object.keys(nested).length ? [[key, nested]] : [];
      }
      return [[key, typeof item === "string" ? normalizeText(item) : item]];
    }));
  }

  function normalizeApiBaseUrl(value) {
    const fallback = DEFAULT_SETTINGS.apiBaseUrl;
    const candidate = normalizeText(value) || fallback;
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new TypeError("API 地址必须使用 HTTP 或 HTTPS。");
    }
    if (url.username || url.password) {
      throw new TypeError("API 地址不能包含用户名或密码。");
    }
    if (url.protocol === "http:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
      throw new TypeError("非本机 API 必须使用 HTTPS。");
    }
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString().replace(/\/$/, "");
  }

  function normalizeApiUrl(value) {
    const url = new URL(normalizeApiBaseUrl(value));
    let path = url.pathname.replace(/\/+$/, "");
    if (!path.endsWith("/chat/completions")) {
      if (!path || path === "/") path = "/v1";
      path += "/chat/completions";
    }
    url.pathname = path;
    return url.toString();
  }

  function sanitizeSettings(value) {
    const source = value && typeof value === "object" ? value : {};
    const isCurrentSchema = source.schemaVersion === SETTINGS_SCHEMA_VERSION;
    let apiBaseUrl = DEFAULT_SETTINGS.apiBaseUrl;
    try {
      apiBaseUrl = normalizeApiBaseUrl(source.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl);
    } catch {
      apiBaseUrl = DEFAULT_SETTINGS.apiBaseUrl;
    }

    const legacyThreshold = source.promotionThreshold ?? source.threshold;
    const requestTimeoutMs = finiteNumber(source.requestTimeoutMs, DEFAULT_SETTINGS.requestTimeoutMs);
    return {
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      enabled: source.enabled !== false,
      apiBaseUrl,
      // v0.1 shipped a source-level development credential. Never migrate that credential.
      apiKey: isCurrentSchema ? normalizeText(source.apiKey).slice(0, 512) : "",
      model: normalizeText(source.model).slice(0, 160),
      promotionThreshold: clamp(
        finiteNumber(legacyThreshold, DEFAULT_SETTINGS.promotionThreshold),
        0.5,
        0.95
      ),
      xEnabled: source.xEnabled !== false,
      // Bilibili is deliberately parked while the X experience is hardened.
      bilibiliEnabled: false,
      personalizationEnabled: source.personalizationEnabled !== false,
      requestTimeoutMs: Math.round(clamp(
        requestTimeoutMs === 12000 ? DEFAULT_SETTINGS.requestTimeoutMs : requestTimeoutMs,
        4000,
        28000
      ))
    };
  }

  function validateSettings(value) {
    const source = value && typeof value === "object" ? value : {};
    const settings = sanitizeSettings(source);
    const problems = [];
    try {
      settings.apiBaseUrl = normalizeApiBaseUrl(source.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl);
      normalizeApiUrl(settings.apiBaseUrl);
    } catch (error) {
      problems.push(error.message);
    }
    if (!settings.model) problems.push("请填写模型名称。");
    if (!settings.apiKey) problems.push("请填写 API Key。");
    return { ok: problems.length === 0, problems, settings };
  }

  function normalizeDriver(value) {
    const driver = normalizeText(value).toLowerCase().replace(/[\s-]+/g, "_");
    return DRIVER_KEYS.includes(driver) ? driver : "mixed";
  }

  function positivePromotionLabel(value, driver) {
    const label = normalizeText(value).slice(0, 28);
    if (!label) return DRIVER_LABELS[driver] || DRIVER_LABELS.mixed;
    const forbidden = /(风险|警告|劝退|变蠢|愚蠢|处方|低价值|有害|停止|少看|戒断)|\b(?:warning|risk|stop|stupid|harmful|addiction|prescription|avoid|limit)\b/i;
    return forbidden.test(label) ? (DRIVER_LABELS[driver] || DRIVER_LABELS.mixed) : label;
  }

  function normalizeCurations(payload, knownIds) {
    const allowed = new Set((knownIds || []).map(String));
    const source = Array.isArray(payload?.curations) ? payload.curations : [];
    const seen = new Set();
    const normalized = [];

    for (const item of source) {
      const id = String(item?.id || "");
      if (!id || !allowed.has(id) || seen.has(id)) continue;
      seen.add(id);
      const primaryDriver = normalizeDriver(item.primaryDriver);
      normalized.push({
        id,
        promote: item.promote === true,
        dopamineScore: clamp(finiteNumber(item.dopamineScore, 0), 0, 1),
        durableValue: clamp(finiteNumber(item.durableValue, 0.5), 0, 1),
        primaryDriver,
        promotionLabel: positivePromotionLabel(item.promotionLabel, primaryDriver)
      });
    }
    return normalized;
  }

  function createNeutralCuration(id) {
    return {
      id: String(id),
      promote: false,
      dopamineScore: 0,
      durableValue: 0.5,
      primaryDriver: "mixed",
      promotionLabel: ""
    };
  }

  function parseJsonContent(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
    const text = Array.isArray(value)
      ? value.map((part) => typeof part === "string" ? part : part?.text || "").join("")
      : String(value ?? "");
    const stripped = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    return JSON.parse(stripped);
  }

  function createContentFingerprint(platform, context, extractorVersion = EXTRACTOR_VERSION) {
    const payload = compactRecord({ platform, extractorVersion, context });
    return hashText(stableStringify(payload));
  }

  function createCandidateId(platform, stableId, fingerprint) {
    return `${normalizeText(platform)}:${normalizeText(stableId) || "content"}:${fingerprint}`;
  }

  function createCacheKey({ apiBaseUrl, model, promptVersion, extractorVersion, hash }) {
    const namespace = hashText(stableStringify({
      schemaVersion: CACHE_SCHEMA_VERSION,
      endpoint: normalizeApiUrl(apiBaseUrl),
      model: normalizeText(model),
      promptVersion: normalizeText(promptVersion || PROMPT_VERSION),
      extractorVersion: normalizeText(extractorVersion || EXTRACTOR_VERSION)
    }));
    return `${CACHE_SCHEMA_VERSION}:${namespace}:${normalizeText(hash)}`;
  }

  function normalizePreferenceEntry(value) {
    if (typeof value === "number") {
      return { score: clamp(value, -0.3, 0.3), more: 0, less: 0, at: 0 };
    }
    const source = value && typeof value === "object" ? value : {};
    return {
      score: clamp(finiteNumber(source.score, 0), -0.3, 0.3),
      more: Math.max(0, Math.floor(finiteNumber(source.more, 0))),
      less: Math.max(0, Math.floor(finiteNumber(source.less, 0))),
      at: Math.max(0, Math.floor(finiteNumber(source.at, 0)))
    };
  }

  function normalizePreferenceBucket(value, limit = 160) {
    const source = value && typeof value === "object" ? value : {};
    return Object.fromEntries(Object.entries(source)
      .map(([key, entry]) => [normalizeText(key).slice(0, 180), normalizePreferenceEntry(entry)])
      .filter(([key]) => Boolean(key))
      .sort((left, right) => right[1].at - left[1].at)
      .slice(0, limit));
  }

  function normalizeProfile(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      schemaVersion: PROFILE_SCHEMA_VERSION,
      drivers: normalizePreferenceBucket(source.drivers, 24),
      accounts: normalizePreferenceBucket(source.accounts, 160),
      topics: normalizePreferenceBucket(source.topics, 160),
      items: normalizePreferenceBucket(source.items, 800),
      totalActions: Math.max(0, Math.floor(finiteNumber(source.totalActions, 0))),
      updatedAt: Math.max(0, Math.floor(finiteNumber(source.updatedAt, 0)))
    };
  }

  function sanitizePreferenceContext(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      platform: normalizeText(source.platform).slice(0, 32),
      primaryDriver: normalizeDriver(source.primaryDriver),
      author: normalizeText(source.author).toLowerCase().slice(0, 120),
      fingerprint: normalizeText(source.fingerprint).slice(0, 160),
      topics: Array.isArray(source.topics)
        ? [...new Set(source.topics.map((topic) => normalizeText(topic).toLowerCase()).filter(Boolean))].slice(0, 5)
        : []
    };
  }

  function preferenceAccountKey(context) {
    return context.author ? `${context.platform || "feed"}:${context.author}` : "";
  }

  function updatePreferenceEntry(bucket, key, delta, action, now) {
    if (!key) return;
    const current = normalizePreferenceEntry(bucket[key]);
    bucket[key] = {
      score: clamp(current.score + delta, -0.3, 0.3),
      more: current.more + (action === "more" ? 1 : 0),
      less: current.less + (action === "less" ? 1 : 0),
      at: now
    };
  }

  function applyPreferenceAction(profileValue, actionValue, contextValue, now = Date.now()) {
    const profile = normalizeProfile(profileValue);
    const action = actionValue === "less" ? "less" : "more";
    const direction = action === "more" ? 1 : -1;
    const context = sanitizePreferenceContext(contextValue);
    const next = {
      ...profile,
      drivers: { ...profile.drivers },
      accounts: { ...profile.accounts },
      topics: { ...profile.topics },
      items: { ...profile.items },
      totalActions: profile.totalActions + 1,
      updatedAt: now
    };

    updatePreferenceEntry(next.drivers, context.primaryDriver, direction * 0.08, action, now);
    updatePreferenceEntry(next.accounts, preferenceAccountKey(context), direction * 0.05, action, now);
    updatePreferenceEntry(next.items, context.fingerprint, direction * 0.3, action, now);
    for (const topic of context.topics.slice(0, 3)) {
      updatePreferenceEntry(next.topics, `${context.platform || "feed"}:${topic}`, direction * 0.025, action, now);
    }
    return normalizeProfile(next);
  }

  function preferenceBoost(profileValue, contextValue) {
    const profile = normalizeProfile(profileValue);
    const context = sanitizePreferenceContext(contextValue);
    const driver = profile.drivers[context.primaryDriver]?.score || 0;
    const account = profile.accounts[preferenceAccountKey(context)]?.score || 0;
    const topicScores = context.topics
      .map((topic) => profile.topics[`${context.platform || "feed"}:${topic}`]?.score || 0);
    const topic = topicScores.length
      ? topicScores.reduce((total, score) => total + score, 0) / topicScores.length
      : 0;
    return clamp((driver * 0.6) + (account * 0.3) + (topic * 0.1), -0.18, 0.18);
  }

  function getPromotionDecision(curation, settingsValue, profileValue, contextValue) {
    const settings = sanitizeSettings(settingsValue);
    const baseScore = clamp(finiteNumber(curation?.dopamineScore, 0), 0, 1);
    const durableValue = clamp(finiteNumber(curation?.durableValue, 0.5), 0, 1);
    const context = sanitizePreferenceContext({
      ...contextValue,
      primaryDriver: curation?.primaryDriver
    });
    const itemVeto = normalizeProfile(profileValue).items[context.fingerprint]?.score <= -0.25;
    const boost = settings.personalizationEnabled
      ? preferenceBoost(profileValue, context)
      : 0;
    const adjustedScore = clamp(baseScore + boost, 0, 1);
    const durableEligible = durableValue <= MAX_PROMOTABLE_DURABLE_VALUE;
    return {
      promote: curation?.promote === true
        && durableEligible
        && !itemVeto
        && adjustedScore >= settings.promotionThreshold,
      baseScore,
      boost,
      adjustedScore,
      durableValue,
      durableEligible,
      itemVeto,
      threshold: settings.promotionThreshold
    };
  }

  function localDateKey(dateValue = new Date()) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function createDailyMetrics(day = localDateKey()) {
    return {
      schemaVersion: METRICS_SCHEMA_VERSION,
      day,
      analyzed: 0,
      decisions: 0,
      promotions: 0,
      cacheHits: 0,
      apiItems: 0,
      apiRequests: 0,
      requestFailures: 0,
      retries: 0,
      hovers: 0,
      preferenceMore: 0,
      preferenceLess: 0,
      currentStreak: 0,
      bestStreak: 0,
      latencies: [],
      apiLatencies: [],
      recentEventIds: [],
      updatedAt: 0
    };
  }

  function normalizeMetrics(value, day = localDateKey()) {
    const source = value && typeof value === "object" && value.day === day
      ? value
      : createDailyMetrics(day);
    const count = (key) => Math.max(0, Math.floor(finiteNumber(source[key], 0)));
    return {
      schemaVersion: METRICS_SCHEMA_VERSION,
      day,
      analyzed: count("analyzed"),
      decisions: count("decisions"),
      promotions: count("promotions"),
      cacheHits: count("cacheHits"),
      apiItems: count("apiItems"),
      apiRequests: count("apiRequests"),
      requestFailures: count("requestFailures"),
      retries: count("retries"),
      hovers: count("hovers"),
      preferenceMore: count("preferenceMore"),
      preferenceLess: count("preferenceLess"),
      currentStreak: count("currentStreak"),
      bestStreak: count("bestStreak"),
      latencies: Array.isArray(source.latencies)
        ? source.latencies.map((item) => clamp(finiteNumber(item, 0), 0, 120000)).slice(-120)
        : [],
      apiLatencies: Array.isArray(source.apiLatencies)
        ? source.apiLatencies.map((item) => clamp(finiteNumber(item, 0), 0, 120000)).slice(-120)
        : [],
      recentEventIds: Array.isArray(source.recentEventIds)
        ? source.recentEventIds.map((item) => normalizeText(item)).filter(Boolean).slice(-240)
        : [],
      updatedAt: count("updatedAt")
    };
  }

  function percentile(values, ratio) {
    const sorted = (values || []).filter(Number.isFinite).slice().sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
    return sorted[index];
  }

  function redactSettings(value) {
    const settings = sanitizeSettings(value);
    return { ...settings, apiKey: settings.apiKey ? "[stored locally]" : "" };
  }

  function toOriginPattern(value) {
    const url = new URL(normalizeApiBaseUrl(value));
    // Chrome match patterns intentionally omit ports; a host pattern covers all
    // ports for that scheme and host (notably local development servers).
    return `${url.protocol}//${url.hostname}/*`;
  }

  function isRetryableStatus(status) {
    return status === 429 || (status >= 500 && status <= 599);
  }

  return Object.freeze({
    CACHE_KEY,
    CACHE_SCHEMA_VERSION,
    DEFAULT_PROFILE,
    DEFAULT_SETTINGS,
    DRIVER_KEYS,
    DRIVER_LABELS,
    EXTRACTOR_VERSION,
    LEGACY_CACHE_KEYS,
    MAX_PROMOTABLE_DURABLE_VALUE,
    METRICS_KEY,
    METRICS_SCHEMA_VERSION,
    PROFILE_KEY,
    PROFILE_SCHEMA_VERSION,
    PROMPT_VERSION,
    SETTINGS_KEY,
    SETTINGS_SCHEMA_VERSION,
    VISUAL_SLA_MS,
    applyPreferenceAction,
    clamp,
    compactRecord,
    createCacheKey,
    createCandidateId,
    createContentFingerprint,
    createDailyMetrics,
    createNeutralCuration,
    finiteNumber,
    getPromotionDecision,
    hashText,
    isRetryableStatus,
    localDateKey,
    normalizeApiBaseUrl,
    normalizeApiUrl,
    normalizeCurations,
    normalizeDriver,
    normalizeMetrics,
    normalizeMultilineText,
    normalizeProfile,
    normalizeText,
    parseJsonContent,
    percentile,
    positivePromotionLabel,
    preferenceBoost,
    redactSettings,
    sanitizePreferenceContext,
    sanitizeSettings,
    stableStringify,
    toOriginPattern,
    validateSettings
  });
});
