importScripts("shared.js", "curator.js");

"use strict";

const Shared = DumberShared;
const Curator = DumberCurator;
const CACHE_LIMIT = 1200;
const CACHE_TTL_MS = 45 * 24 * 60 * 60 * 1000;

let cachePromise = null;
let settingsPromise = null;
let metricsPromise = null;
let cacheWriteChain = Promise.resolve();
let metricsMutationChain = Promise.resolve();
let profileMutationChain = Promise.resolve();
let dataGeneration = 0;
let clearingData = false;
let clearPromise = null;
const activeControllers = new Set();

const batcher = Curator.createSingleFlightBatcher({
  maxBatchSize: 8,
  delayMs: 0,
  worker: processQueuedBatch
});

chrome.runtime.onInstalled.addListener(() => {
  void migrateInstallation();
});

chrome.runtime.onStartup?.addListener(() => {
  void migrateInstallation();
});

chrome.storage.onChanged?.addListener((changes, area) => {
  if (area !== "local" || !changes[Shared.SETTINGS_KEY]) return;
  settingsPromise = Promise.resolve(Shared.sanitizeSettings(changes[Shared.SETTINGS_KEY].newValue));
});

void getSettings().catch(() => undefined);
void ensureCache().catch(() => undefined);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const supported = new Set([
    "curate",
    "testConnection",
    "preferenceAction",
    "runtimeEvents",
    "getDashboard",
    "exportLocalData",
    "clearLocalData"
  ]);
  if (!supported.has(message?.type)) return false;

  Promise.resolve(handleMessage(message))
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({
      ok: false,
      error: error?.message || "DUMBER 后台处理失败。",
      errorCode: error?.code || ""
    }));
  return true;
});

async function handleMessage(message) {
  switch (message.type) {
    case "curate":
      return {
        curations: await curateItems(message.items, message.extractorVersion)
      };
    case "testConnection":
      return testConnection();
    case "preferenceAction":
      return updatePreference(message.action, message.context);
    case "runtimeEvents":
      return recordRuntimeEvents(message.events);
    case "getDashboard":
      return getDashboard();
    case "exportLocalData":
      return exportLocalData();
    case "clearLocalData":
      return clearLocalData();
    default:
      throw new Error("不支持的后台消息。 ");
  }
}

async function migrateInstallation() {
  const stored = await chrome.storage.local.get([
    Shared.SETTINGS_KEY,
    Shared.PROFILE_KEY,
    Shared.METRICS_KEY,
    ...Shared.LEGACY_CACHE_KEYS
  ]);
  const settings = Shared.sanitizeSettings(stored[Shared.SETTINGS_KEY]);
  const profile = Shared.normalizeProfile(stored[Shared.PROFILE_KEY]);
  const metrics = Shared.normalizeMetrics(stored[Shared.METRICS_KEY]);

  await chrome.storage.local.set({
    [Shared.SETTINGS_KEY]: settings,
    [Shared.PROFILE_KEY]: profile,
    [Shared.METRICS_KEY]: metrics
  });
  settingsPromise = Promise.resolve(settings);
  if (Shared.LEGACY_CACHE_KEYS.some((key) => stored[key] !== undefined)) {
    await chrome.storage.local.remove(Shared.LEGACY_CACHE_KEYS);
  }
}

async function getSettings() {
  if (!settingsPromise) {
    const loading = (async () => {
      const stored = await chrome.storage.local.get(Shared.SETTINGS_KEY);
      const settings = Shared.sanitizeSettings(stored[Shared.SETTINGS_KEY]);
      if (stored[Shared.SETTINGS_KEY]?.schemaVersion !== Shared.SETTINGS_SCHEMA_VERSION) {
        await chrome.storage.local.set({ [Shared.SETTINGS_KEY]: settings });
      }
      return settings;
    })();
    const guarded = loading.catch((error) => {
      if (settingsPromise === guarded) settingsPromise = null;
      throw error;
    });
    settingsPromise = guarded;
  }
  return settingsPromise;
}

async function curateItems(rawItems, extractorVersionValue) {
  const generation = dataGeneration;
  const items = sanitizeItems(rawItems).slice(0, 24);
  if (!items.length) return [];

  const settings = await getSettings();
  const validation = Shared.validateSettings(settings);
  if (!validation.ok) throw new Error(validation.problems[0]);
  await assertEndpointPermission(settings);

  const extractorVersion = Shared.normalizeText(extractorVersionValue).slice(0, 120)
    || Shared.EXTRACTOR_VERSION;
  const cache = await ensureCache();
  assertGeneration(generation);
  const now = Date.now();
  const results = new Map();
  const missing = [];
  let cacheHits = 0;

  for (const item of items) {
    const key = Shared.createCacheKey({
      apiBaseUrl: settings.apiBaseUrl,
      model: settings.model,
      promptVersion: Shared.PROMPT_VERSION,
      extractorVersion,
      hash: item.hash
    });
    const cached = cache.entries[key];
    if (cached?.curation && now - cached.at <= CACHE_TTL_MS) {
      cacheHits += 1;
      results.set(item.id, {
        ...cached.curation,
        id: item.id,
        cacheHit: true
      });
    } else {
      if (cached) delete cache.entries[key];
      missing.push({ item, key });
    }
  }

  void mutateMetrics((metrics) => {
    metrics.analyzed += items.length;
    metrics.cacheHits += cacheHits;
  }, generation).catch(() => undefined);

  const groupKey = requestGroupKey(settings, extractorVersion);
  const fresh = await Promise.all(missing.map(async ({ item, key }) => {
    const curation = await batcher.enqueue(key, {
      settings,
      extractorVersion,
      item,
      noCache: false,
      generation
    }, groupKey);
    return {
      ...curation,
      id: item.id,
      cacheHit: false
    };
  }));

  for (const curation of fresh) results.set(curation.id, curation);
  assertGeneration(generation);
  return items.map((item) => results.get(item.id) || {
    ...Shared.createNeutralCuration(item.id),
    cacheHit: false
  });
}

async function testConnection() {
  const generation = dataGeneration;
  const settings = await getSettings();
  const validation = Shared.validateSettings(settings);
  if (!validation.ok) throw new Error(validation.problems[0]);
  await assertEndpointPermission(settings);

  const item = {
    id: "connection-test",
    hash: `connection-${Date.now()}`,
    context: {
      contentType: "connection-test",
      text: "一条情绪浓度很高、好奇驱动很强、正适合继续探索的热门讨论。"
    }
  };
  const key = `test:${Date.now()}:${Shared.hashText(settings.model)}`;
  const startedAt = performance.now();
  const curation = await batcher.enqueue(key, {
    settings,
    extractorVersion: Shared.EXTRACTOR_VERSION,
    item,
    noCache: true,
    generation
  }, requestGroupKey(settings, Shared.EXTRACTOR_VERSION));
  assertGeneration(generation);
  return {
    curation: { ...curation, id: item.id },
    latencyMs: Math.max(0, Math.round(performance.now() - startedAt))
  };
}

async function processQueuedBatch(entries) {
  const first = entries[0]?.value;
  if (!first) return new Map();
  const generation = first.generation;
  assertGeneration(generation);
  const settings = first.settings;
  const apiItems = entries.map((entry, index) => ({
    id: `item-${index}-${Shared.hashText(entry.key)}`,
    context: entry.value.item.context
  }));
  const startedAt = performance.now();

  void mutateMetrics((metrics) => {
    metrics.apiItems += entries.length;
  }, generation).catch(() => undefined);

  try {
    const curations = await requestCurations(settings, apiItems, generation);
    assertGeneration(generation);
    const byId = new Map(curations.map((curation) => [curation.id, curation]));
    const cache = await ensureCache();
    const output = new Map();

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const modelId = apiItems[index].id;
      const raw = byId.get(modelId) || Shared.createNeutralCuration(modelId);
      const curation = {
        promote: raw.promote,
        dopamineScore: raw.dopamineScore,
        durableValue: raw.durableValue,
        primaryDriver: raw.primaryDriver,
        promotionLabel: raw.promotionLabel
      };
      output.set(entry.key, curation);
      if (!entry.value.noCache) {
        cache.entries[entry.key] = { curation, at: Date.now() };
      }
    }

    trimCache(cache);
    await persistCache(cache, generation);
    void mutateMetrics((metrics) => {
      metrics.apiLatencies.push(Math.max(0, Math.round(performance.now() - startedAt)));
      metrics.apiLatencies = metrics.apiLatencies.slice(-120);
    }, generation).catch(() => undefined);
    return output;
  } catch (error) {
    if (!isCancellation(error) && generation === dataGeneration) {
      void mutateMetrics((metrics) => {
        metrics.requestFailures += 1;
        metrics.apiLatencies.push(Math.max(0, Math.round(performance.now() - startedAt)));
        metrics.apiLatencies = metrics.apiLatencies.slice(-120);
      }, generation).catch(() => undefined);
    }
    throw error;
  }
}

async function requestCurations(settings, items, generation) {
  let result = await executePayload(settings, Curator.createRequestPayload(settings, items, true), generation);
  if (!result.response.ok && result.response.status === 400 && isSchemaCompatibilityError(result.body)) {
    result = await executePayload(settings, Curator.createRequestPayload(settings, items, false), generation);
  }

  if (!result.response.ok) {
    const detail = Curator.responseErrorMessage(result.body, result.response.status);
    throw new Error(`模型请求失败：${detail}`);
  }

  try {
    const expectedIds = items.map((item) => item.id);
    const curations = Curator.parseCurationResponse(result.body, expectedIds);
    if (curations.length !== expectedIds.length) {
      const returnedIds = new Set(curations.map((curation) => curation.id));
      const missing = expectedIds.filter((id) => !returnedIds.has(id));
      throw new Error(`缺少 ${missing.length} 条结果`);
    }
    return curations;
  } catch (error) {
    throw new Error(`模型返回的结构化结果无法解析：${error.message}`);
  }
}


function isSchemaCompatibilityError(body) {
  const detail = Shared.normalizeText(Curator.responseErrorMessage(body, 400)).toLowerCase();
  return /response[_ -]?format|json[_ -]?schema|structured output|schema.*support|unsupported.*schema/.test(detail);
}

async function executePayload(settings, payload, generation) {
  const { response, rawBody } = await fetchWithRetry(settings, payload, generation);
  let body = {};
  if (rawBody) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = { message: rawBody.slice(0, 500) };
    }
  }
  return { response, body };
}

async function fetchWithRetry(settings, payload, generation) {
  const endpoint = Shared.normalizeApiUrl(settings.apiBaseUrl);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    assertGeneration(generation);
    const controller = new AbortController();
    let phase = "start";
    let timeout = setTimeout(() => controller.abort(), settings.requestTimeoutMs);
    activeControllers.add(controller);
    let response;
    try {
      void mutateMetrics((metrics) => {
        metrics.apiRequests += 1;
      }, generation).catch(() => undefined);
      const headers = {
        "Authorization": `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json"
      };
      if (new URL(endpoint).hostname === "api.x.ai") {
        headers["x-grok-conv-id"] = `dumber-${Shared.hashText(`${settings.model}:${Shared.PROMPT_VERSION}`)}`;
      }
      response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit"
      });
      clearTimeout(timeout);
      timeout = 0;

      if (attempt === 0 && Shared.isRetryableStatus(response.status)) {
        phase = "completion";
        timeout = setTimeout(() => controller.abort(), settings.requestTimeoutMs);
        await response.arrayBuffer();
        clearTimeout(timeout);
        timeout = 0;
        void mutateMetrics((metrics) => {
          metrics.retries += 1;
        }, generation).catch(() => undefined);
        await delay(retryDelay(response.headers.get("Retry-After")));
        assertGeneration(generation);
        continue;
      }

      phase = "completion";
      timeout = setTimeout(() => controller.abort(), settings.requestTimeoutMs);
      const rawBody = response.ok
        && response.headers.get("Content-Type")?.toLowerCase().includes("text/event-stream")
        ? await collapseEventStream(response)
        : await response.text();
      return { response, rawBody };
    } catch (error) {
      if (generation !== dataGeneration) throw createCancellationError();
      if (error?.name === "AbortError") {
        const seconds = Math.round(settings.requestTimeoutMs / 1000);
        throw new Error(phase === "start"
          ? `模型在 ${seconds} 秒内未开始响应。`
          : `模型已开始响应，但未在随后 ${seconds} 秒内完成。`);
      }
      throw new Error(`无法连接模型 API：${error?.message || "网络错误"}`);
    } finally {
      if (timeout) clearTimeout(timeout);
      activeControllers.delete(controller);
    }
  }
  throw new Error("模型请求未返回结果。");
}

async function collapseEventStream(response) {
  const parts = [];
  const rawBody = await response.text();
  for (const line of rawBody.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    let chunk;
    try {
      chunk = JSON.parse(data);
    } catch {
      throw new Error("模型返回了无法解析的流式数据。");
    }
    if (chunk?.error) throw new Error(Curator.responseErrorMessage(chunk, response.status));
    const content = chunk?.choices?.[0]?.delta?.content
      ?? chunk?.choices?.[0]?.message?.content;
    if (typeof content === "string") parts.push(content);
  }
  if (!parts.length) throw new Error("模型流未返回内容。");
  return JSON.stringify({
    choices: [{ message: { content: parts.join("") } }]
  });
}

function retryDelay(value) {
  const text = Shared.normalizeText(value);
  if (!text) return 350;
  const seconds = Number(text);
  if (Number.isFinite(seconds)) return Math.min(1500, Math.max(100, seconds * 1000));
  const timestamp = Date.parse(text);
  if (Number.isFinite(timestamp)) return Math.min(1500, Math.max(100, timestamp - Date.now()));
  return 350;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function sanitizeItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  const seenIds = new Set();
  return rawItems.flatMap((raw) => {
    const id = Shared.normalizeText(raw?.id).slice(0, 260);
    const hash = Shared.normalizeText(raw?.hash).slice(0, 160);
    const context = sanitizeInputContext(raw?.context);
    const useful = Shared.normalizeText([
      context.text,
      context.title,
      context.description,
      context.quoteText,
      context.linkTitle
    ].filter(Boolean).join(" "));
    if (!id || !hash || useful.length < 8 || seenIds.has(id)) return [];
    seenIds.add(id);
    return [{ id, hash, context }];
  });
}

function sanitizeInputContext(value) {
  const source = Shared.compactRecord(value);
  const context = {};
  for (const [key, item] of Object.entries(source).slice(0, 20)) {
    const safeKey = Shared.normalizeText(key).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
    if (!safeKey) continue;
    if (typeof item === "string") {
      context[safeKey] = Shared.normalizeMultilineText(item).slice(0, safeKey === "text" || safeKey === "description" ? 1600 : 700);
    } else if (Array.isArray(item)) {
      context[safeKey] = item.map((part) => Shared.normalizeText(part).slice(0, 120)).filter(Boolean).slice(0, 8);
    } else if (typeof item === "number" || typeof item === "boolean") {
      context[safeKey] = item;
    }
  }
  return context;
}

function requestGroupKey(settings, extractorVersion) {
  return Shared.hashText(Shared.stableStringify({
    apiBaseUrl: settings.apiBaseUrl,
    model: settings.model,
    apiKey: settings.apiKey,
    requestTimeoutMs: settings.requestTimeoutMs,
    promptVersion: Shared.PROMPT_VERSION,
    extractorVersion
  }));
}

async function ensureCache() {
  if (!cachePromise) {
    const loading = (async () => {
      const sessionRead = chrome.storage.session
        ? chrome.storage.session.get(Shared.CACHE_KEY).catch(() => ({}))
        : Promise.resolve({});
      const [sessionStored, localStored] = await Promise.all([
        sessionRead,
        chrome.storage.local.get(Shared.CACHE_KEY)
      ]);
      return normalizeCache(sessionStored[Shared.CACHE_KEY] || localStored[Shared.CACHE_KEY]);
    })();
    const guarded = loading.catch((error) => {
      if (cachePromise === guarded) cachePromise = null;
      throw error;
    });
    cachePromise = guarded;
  }
  return cachePromise;
}

function normalizeCache(value) {
  const source = value && value.schemaVersion === Shared.CACHE_SCHEMA_VERSION && value.entries
    ? value.entries
    : {};
  const entries = {};
  const now = Date.now();
  for (const [key, entry] of Object.entries(source)) {
    if (!entry?.curation || now - Number(entry.at || 0) > CACHE_TTL_MS) continue;
    const normalized = Shared.normalizeCurations({
      curations: [{ id: "stored", ...entry.curation }]
    }, ["stored"])[0];
    if (!normalized) continue;
    const { id: _id, ...curation } = normalized;
    entries[key] = { curation, at: Number(entry.at) || now };
  }
  return {
    schemaVersion: Shared.CACHE_SCHEMA_VERSION,
    entries
  };
}

async function persistCache(cache, generation = dataGeneration) {
  const payload = {
    schemaVersion: Shared.CACHE_SCHEMA_VERSION,
    entries: { ...cache.entries }
  };
  const operation = cacheWriteChain.then(async () => {
    assertGeneration(generation);
    const writes = [chrome.storage.local.set({ [Shared.CACHE_KEY]: payload })];
    if (chrome.storage.session) {
      writes.push(chrome.storage.session.set({ [Shared.CACHE_KEY]: payload }).catch(() => null));
    }
    await Promise.all(writes);
  });
  cacheWriteChain = operation.catch(() => undefined);
  return operation;
}

function trimCache(cache) {
  const entries = Object.entries(cache.entries);
  if (entries.length <= CACHE_LIMIT) return;
  entries
    .sort((left, right) => Number(right[1]?.at || 0) - Number(left[1]?.at || 0))
    .slice(CACHE_LIMIT)
    .forEach(([key]) => delete cache.entries[key]);
}

async function ensureMetrics() {
  if (!metricsPromise) {
    const loading = chrome.storage.local.get(Shared.METRICS_KEY)
      .then((stored) => Shared.normalizeMetrics(stored[Shared.METRICS_KEY]));
    const guarded = loading.catch((error) => {
      if (metricsPromise === guarded) metricsPromise = null;
      throw error;
    });
    metricsPromise = guarded;
  }
  let metrics = await metricsPromise;
  const today = Shared.localDateKey();
  if (metrics.day !== today) {
    metrics = Shared.normalizeMetrics(null, today);
    metricsPromise = Promise.resolve(metrics);
  }
  return metrics;
}

function mutateMetrics(mutator, generation = dataGeneration) {
  const operation = metricsMutationChain.then(async () => {
    assertGeneration(generation);
    const metrics = await ensureMetrics();
    assertGeneration(generation);
    mutator(metrics);
    metrics.updatedAt = Date.now();
    await chrome.storage.local.set({ [Shared.METRICS_KEY]: metrics });
    return metrics;
  });
  metricsMutationChain = operation.catch(() => undefined);
  return operation;
}

async function recordRuntimeEvents(rawEvents) {
  const generation = dataGeneration;
  const events = Array.isArray(rawEvents) ? rawEvents.slice(0, 100) : [];
  const metrics = await mutateMetrics((current) => {
    const seen = new Set(current.recentEventIds);
    for (const raw of events) {
      const type = Shared.normalizeText(raw?.type);
      const id = Shared.normalizeText(raw?.id).slice(0, 220);
      if (!type || !id || type === "noop" || seen.has(id)) continue;
      seen.add(id);
      current.recentEventIds.push(id);

      if (type === "decision") {
        current.decisions += 1;
        current.latencies.push(Shared.clamp(Number(raw.latencyMs) || 0, 0, 120000));
        current.latencies = current.latencies.slice(-120);
        if (raw.promoted === true) {
          current.promotions += 1;
          current.currentStreak += 1;
          current.bestStreak = Math.max(current.bestStreak, current.currentStreak);
        } else {
          current.currentStreak = 0;
        }
      } else if (type === "hover") {
        current.hovers += 1;
      } else if (type === "preferenceMore") {
        current.preferenceMore += 1;
      } else if (type === "preferenceLess") {
        current.preferenceLess += 1;
      }
    }
    current.recentEventIds = current.recentEventIds.slice(-240);
  }, generation);
  return { metrics };
}

function updatePreference(action, context) {
  if (action !== "more" && action !== "less") {
    throw new TypeError("不支持的偏好操作。");
  }
  const generation = dataGeneration;
  const operation = profileMutationChain.then(async () => {
    assertGeneration(generation);
    const stored = await chrome.storage.local.get(Shared.PROFILE_KEY);
    assertGeneration(generation);
    const profile = Shared.applyPreferenceAction(stored[Shared.PROFILE_KEY], action, context);
    await chrome.storage.local.set({ [Shared.PROFILE_KEY]: profile });
    return { profile };
  });
  profileMutationChain = operation.catch(() => undefined);
  return operation;
}

async function getDashboard() {
  await drainMutationChains();
  const [settings, profile, metrics, cache] = await Promise.all([
    getSettings(),
    chrome.storage.local.get(Shared.PROFILE_KEY).then((stored) => Shared.normalizeProfile(stored[Shared.PROFILE_KEY])),
    ensureMetrics(),
    ensureCache()
  ]);
  const credentialsConfigured = Boolean(settings.apiKey && settings.model);
  const endpointPermission = credentialsConfigured
    ? await hasEndpointPermission(settings)
    : false;
  return {
    configured: credentialsConfigured && endpointPermission,
    credentialsConfigured,
    endpointPermission,
    settings: Shared.redactSettings(settings),
    profile: {
      totalActions: profile.totalActions,
      updatedAt: profile.updatedAt
    },
    metrics: {
      ...metrics,
      cacheHitRate: metrics.analyzed ? metrics.cacheHits / metrics.analyzed : 0,
      visualP95: Shared.percentile(metrics.latencies, 0.95),
      apiP95: Shared.percentile(metrics.apiLatencies, 0.95)
    },
    cache: {
      entries: Object.keys(cache.entries).length
    },
    queue: batcher.state()
  };
}

async function hasEndpointPermission(settings) {
  if (typeof chrome.permissions?.contains !== "function") return true;
  try {
    return await chrome.permissions.contains({
      origins: [Shared.toOriginPattern(settings.apiBaseUrl)]
    });
  } catch {
    return false;
  }
}

async function assertEndpointPermission(settings) {
  if (await hasEndpointPermission(settings)) return;
  const error = new Error("请在设置页允许扩展访问当前 API 地址。");
  error.code = "DUMBER_ENDPOINT_PERMISSION_REQUIRED";
  throw error;
}

async function exportLocalData() {
  await drainMutationChains();
  const [settings, profile, metrics, cache] = await Promise.all([
    getSettings(),
    chrome.storage.local.get(Shared.PROFILE_KEY).then((stored) => Shared.normalizeProfile(stored[Shared.PROFILE_KEY])),
    ensureMetrics(),
    ensureCache()
  ]);
  return {
    data: {
      exportedAt: new Date().toISOString(),
      settings: Shared.redactSettings(settings),
      preferenceProfile: profile,
      runtimeMetrics: metrics,
      cacheSummary: {
        entries: Object.keys(cache.entries).length,
        schemaVersion: cache.schemaVersion
      }
    }
  };
}

function clearLocalData() {
  if (clearPromise) return clearPromise;
  clearPromise = performClearLocalData().finally(() => {
    clearPromise = null;
  });
  return clearPromise;
}

async function performClearLocalData() {
  clearingData = true;
  dataGeneration += 1;
  const cancellation = createCancellationError("本地数据已清除。");
  batcher.clear(cancellation);
  for (const controller of activeControllers) controller.abort();
  activeControllers.clear();

  try {
    await Promise.allSettled([cacheWriteChain, metricsMutationChain, profileMutationChain]);
    const profile = Shared.normalizeProfile();
    const metrics = Shared.normalizeMetrics();
    const cache = normalizeCache();
    cachePromise = Promise.resolve(cache);
    metricsPromise = Promise.resolve(metrics);

    await chrome.storage.local.set({
      [Shared.PROFILE_KEY]: profile,
      [Shared.METRICS_KEY]: metrics,
      [Shared.CACHE_KEY]: cache
    });
    if (chrome.storage.session) {
      await chrome.storage.session.set({ [Shared.CACHE_KEY]: cache }).catch(() => null);
    }
    await chrome.storage.local.remove(Shared.LEGACY_CACHE_KEYS);
    return { profile, metrics, cache: { entries: 0 } };
  } finally {
    clearingData = false;
  }
}

async function drainMutationChains() {
  if (clearPromise) await clearPromise;
  await Promise.all([cacheWriteChain, metricsMutationChain, profileMutationChain]);
}

function assertGeneration(generation) {
  if (clearingData || generation !== dataGeneration) throw createCancellationError();
}

function createCancellationError(message = "操作已取消。") {
  const error = new Error(message);
  error.name = "DumberCancellationError";
  return error;
}

function isCancellation(error) {
  return error?.name === "DumberCancellationError";
}
