const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { performance } = require("node:perf_hooks");

const Shared = require("../src/shared.js");
const sharedSource = fs.readFileSync(path.join(__dirname, "../src/shared.js"), "utf8");
const curatorSource = fs.readFileSync(path.join(__dirname, "../src/curator.js"), "utf8");
const backgroundSource = fs.readFileSync(path.join(__dirname, "../src/background.js"), "utf8");

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function createStorageArea(initial = {}) {
  const data = clone(initial);
  return {
    data,
    async get(keys) {
      if (keys === null || keys === undefined) return clone(data);
      if (typeof keys === "string") return { [keys]: clone(data[keys]) };
      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map((key) => [key, clone(data[key])]));
      }
      if (typeof keys === "object") {
        return Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [
          key,
          data[key] === undefined ? clone(fallback) : clone(data[key])
        ]));
      }
      return {};
    },
    async set(values) {
      for (const [key, value] of Object.entries(values || {})) data[key] = clone(value);
    },
    async remove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
    }
  };
}

function createHarness(fetchImpl, { permissionGranted = true } = {}) {
  const settings = Shared.sanitizeSettings({
    schemaVersion: Shared.SETTINGS_SCHEMA_VERSION,
    apiBaseUrl: "https://api.example.test/v1",
    apiKey: "fixture-key",
    model: "fixture-model",
    requestTimeoutMs: 4000
  });
  const local = createStorageArea({ [Shared.SETTINGS_KEY]: settings });
  const session = createStorageArea();
  let messageListener = null;

  const chrome = {
    runtime: {
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} },
      onMessage: { addListener(listener) { messageListener = listener; } }
    },
    permissions: {
      async contains() { return permissionGranted; }
    },
    storage: { local, session }
  };

  const context = vm.createContext({
    AbortController,
    DOMException,
    Headers,
    Response,
    URL,
    clearTimeout,
    console,
    fetch: fetchImpl,
    importScripts() {},
    performance,
    setTimeout,
    chrome
  });
  vm.runInContext(sharedSource, context, { filename: "src/shared.js" });
  vm.runInContext(curatorSource, context, { filename: "src/curator.js" });
  vm.runInContext(backgroundSource, context, { filename: "src/background.js" });
  assert.equal(typeof messageListener, "function");

  async function send(message) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) reject(new Error(`background response timeout for ${message.type}`));
      }, 5000);
      const keepChannel = messageListener(message, {}, (response) => {
        settled = true;
        clearTimeout(timeout);
        resolve(clone(response));
      });
      if (keepChannel !== true) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`message ${message.type} did not keep the response channel open`));
      }
    });
  }

  return { chrome, local, send, session };
}

function successResponseForRequest(init, overrides = {}) {
  const payload = JSON.parse(init.body);
  const requested = JSON.parse(payload.messages[1].content).items;
  const curations = requested.map((item) => ({
    id: item.id,
    promote: true,
    dopamineScore: 0.91,
    durableValue: 0.17,
    primaryDriver: "curiosity_gap",
    promotionLabel: "强好奇驱动",
    ...overrides
  }));
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ curations }) } }]
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function streamingSuccessResponseForRequest(init) {
  const body = await successResponseForRequest(init).json();
  const content = body.choices[0].message.content;
  const middle = Math.ceil(content.length / 2);
  const events = [content.slice(0, middle), content.slice(middle)]
    .map((part) => `data: ${JSON.stringify({ choices: [{ delta: { content: part } }] })}\n\n`)
    .join("");
  return new Response(`${events}data: [DONE]\n\n`, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" }
  });
}

function curationMessage(id = "client-1", hash = "content-hash") {
  return {
    type: "curate",
    extractorVersion: Shared.EXTRACTOR_VERSION,
    items: [{
      id,
      hash,
      context: { text: "这是一条具有强烈好奇驱动和即时吸引力的测试内容。" }
    }]
  };
}

test("background performs structured curation and serves the next request from cache", async () => {
  const calls = [];
  const harness = createHarness(async (url, init) => {
    calls.push({ url, payload: JSON.parse(init.body) });
    return successResponseForRequest(init);
  });

  const first = await harness.send(curationMessage("client-1", "same-hash"));
  const second = await harness.send(curationMessage("client-2", "same-hash"));

  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(first.curations[0].cacheHit, false);
  assert.equal(second.ok, true);
  assert.equal(second.curations[0].id, "client-2");
  assert.equal(second.curations[0].cacheHit, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.example.test/v1/chat/completions");
  assert.equal(calls[0].payload.response_format.type, "json_schema");
  assert.equal(calls[0].payload.stream, true);

  const dashboard = await harness.send({ type: "getDashboard" });
  assert.equal(dashboard.ok, true);
  assert.equal(dashboard.cache.entries, 1);
  assert.equal(dashboard.metrics.cacheHits, 1);
  assert.deepEqual(dashboard.queue, { pending: 0, active: 0, running: false });
});

test("background reconstructs OpenAI-compatible streaming responses", async () => {
  const harness = createHarness(async (_url, init) => streamingSuccessResponseForRequest(init));
  const response = await harness.send(curationMessage());

  assert.equal(response.ok, true, JSON.stringify(response));
  assert.equal(response.curations[0].promotionLabel, "强好奇驱动");
});

test("dashboard distinguishes saved credentials from a revoked endpoint permission", async () => {
  const harness = createHarness(
    async (_url, init) => successResponseForRequest(init),
    { permissionGranted: false }
  );

  const dashboard = await harness.send({ type: "getDashboard" });
  assert.equal(dashboard.ok, true);
  assert.equal(dashboard.credentialsConfigured, true);
  assert.equal(dashboard.endpointPermission, false);
  assert.equal(dashboard.configured, false);
});

test("background rejects curation before network access when endpoint permission is absent", async () => {
  let fetchCalls = 0;
  const harness = createHarness(
    async (_url, init) => {
      fetchCalls += 1;
      return successResponseForRequest(init);
    },
    { permissionGranted: false }
  );

  const response = await harness.send(curationMessage());
  assert.equal(response.ok, false);
  assert.equal(response.errorCode, "DUMBER_ENDPOINT_PERMISSION_REQUIRED");
  assert.match(response.error, /API 地址/);
  assert.equal(fetchCalls, 0);
});

test("background retries one 429 response and then succeeds", async () => {
  let calls = 0;
  const harness = createHarness(async (_url, init) => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ error: { message: "rate limited" } }), {
        status: 429,
        headers: { "Retry-After": "0", "Content-Type": "application/json" }
      });
    }
    return successResponseForRequest(init);
  });

  const response = await harness.send(curationMessage());
  assert.equal(response.ok, true, JSON.stringify(response));
  assert.equal(calls, 2);
  const dashboard = await harness.send({ type: "getDashboard" });
  assert.equal(dashboard.metrics.retries, 1);
  assert.equal(dashboard.metrics.apiRequests, 2);
});

test("background falls back to json_object only for explicit schema incompatibility", async () => {
  const formats = [];
  const harness = createHarness(async (_url, init) => {
    const payload = JSON.parse(init.body);
    formats.push(payload.response_format.type);
    if (formats.length === 1) {
      return new Response(JSON.stringify({
        error: { message: "response_format json_schema is unsupported by this model" }
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    return successResponseForRequest(init);
  });

  const response = await harness.send(curationMessage());
  assert.equal(response.ok, true, JSON.stringify(response));
  assert.deepEqual(formats, ["json_schema", "json_object"]);
});

test("clearing local data aborts an active request and prevents stale cache writes", async () => {
  let signalRequestStarted;
  const requestStarted = new Promise((resolve) => { signalRequestStarted = resolve; });
  const harness = createHarness((_url, init) => new Promise((_resolve, reject) => {
    signalRequestStarted();
    const abort = () => reject(new DOMException("Aborted", "AbortError"));
    if (init.signal.aborted) abort();
    else init.signal.addEventListener("abort", abort, { once: true });
  }));

  const curationPromise = harness.send(curationMessage());
  await requestStarted;
  const cleared = await harness.send({ type: "clearLocalData" });
  const curation = await curationPromise;

  assert.equal(cleared.ok, true);
  assert.equal(cleared.cache.entries, 0);
  assert.equal(curation.ok, false);
  assert.match(curation.error, /清除|取消/);
  assert.deepEqual(harness.local.data[Shared.CACHE_KEY].entries, {});
  assert.deepEqual(harness.session.data[Shared.CACHE_KEY].entries, {});
});

test("background rejects unknown preference actions without mutating the profile", async () => {
  const harness = createHarness(async (_url, init) => successResponseForRequest(init));
  const response = await harness.send({
    type: "preferenceAction",
    action: "approve",
    context: { platform: "x", primaryDriver: "curiosity_gap" }
  });

  assert.equal(response.ok, false);
  assert.match(response.error, /偏好操作/);
  assert.equal(harness.local.data[Shared.PROFILE_KEY], undefined);
});

test("background rejects incomplete model batches instead of caching neutral placeholders", async () => {
  const harness = createHarness(async (_url, init) => {
    const payload = JSON.parse(init.body);
    const [first] = JSON.parse(payload.messages[1].content).items;
    return new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            curations: [{
              id: first.id,
              promote: true,
              dopamineScore: 0.9,
              durableValue: 0.2,
              primaryDriver: "curiosity_gap",
              promotionLabel: "强好奇驱动"
            }]
          })
        }
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  });

  const response = await harness.send({
    type: "curate",
    extractorVersion: Shared.EXTRACTOR_VERSION,
    items: [
      curationMessage("client-1", "hash-1").items[0],
      curationMessage("client-2", "hash-2").items[0]
    ]
  });

  assert.equal(response.ok, false);
  assert.match(response.error, /缺少 1 条结果/);
  const cache = harness.local.data[Shared.CACHE_KEY];
  assert.ok(!cache || Object.keys(cache.entries).length === 0);
});
