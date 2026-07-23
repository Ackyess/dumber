const test = require("node:test");
const assert = require("node:assert/strict");
const Shared = require("../src/shared.js");

const {
  DEFAULT_SETTINGS,
  EXTRACTOR_VERSION,
  PROMPT_VERSION,
  SETTINGS_SCHEMA_VERSION,
  applyPreferenceAction,
  createCacheKey,
  createContentFingerprint,
  getPromotionDecision,
  hashText,
  normalizeApiUrl,
  normalizeCurations,
  normalizeMetrics,
  normalizeProfile,
  parseJsonContent,
  sanitizeSettings,
  toOriginPattern,
  validateSettings
} = Shared;

test("ships BYOK defaults without a credential or fixed model", () => {
  assert.equal(DEFAULT_SETTINGS.apiBaseUrl, "https://api.x.ai/v1");
  assert.equal(DEFAULT_SETTINGS.apiKey, "");
  assert.equal(DEFAULT_SETTINGS.model, "");
  assert.equal(DEFAULT_SETTINGS.schemaVersion, SETTINGS_SCHEMA_VERSION);
  assert.equal(DEFAULT_SETTINGS.requestTimeoutMs, 28000);
});

test("drops credentials from the legacy settings schema", () => {
  const migrated = sanitizeSettings({
    apiBaseUrl: "https://legacy.example/v1",
    apiKey: "legacy-secret",
    model: "legacy-model",
    threshold: 0.81
  });
  assert.equal(migrated.apiKey, "");
  assert.equal(migrated.model, "legacy-model");
  assert.equal(migrated.promotionThreshold, 0.81);
});

test("preserves a current-schema local credential and migrates the old timeout", () => {
  const settings = sanitizeSettings({
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    apiKey: "local-key",
    model: "curator-model",
    requestTimeoutMs: 12000
  });
  assert.equal(settings.apiKey, "local-key");
  assert.equal(settings.model, "curator-model");
  assert.equal(settings.requestTimeoutMs, 28000);
});

test("normalizes OpenAI-compatible API roots", () => {
  assert.equal(
    normalizeApiUrl("https://api.example.com/"),
    "https://api.example.com/v1/chat/completions"
  );
  assert.equal(
    normalizeApiUrl("https://api.x.ai/v1"),
    "https://api.x.ai/v1/chat/completions"
  );
  assert.equal(
    normalizeApiUrl("https://example.com/openai/v1/chat/completions"),
    "https://example.com/openai/v1/chat/completions"
  );
  assert.equal(
    normalizeApiUrl("http://localhost:11434/v1"),
    "http://localhost:11434/v1/chat/completions"
  );
  assert.equal(toOriginPattern("http://localhost:11434/v1"), "http://localhost/*");
  assert.equal(toOriginPattern("https://api.example.com:8443/v1"), "https://api.example.com/*");
});

test("rejects insecure remote endpoints and reports raw URL errors", () => {
  assert.throws(() => normalizeApiUrl("http://api.example.com/v1"), /HTTPS/);
  const invalid = validateSettings({
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    apiBaseUrl: "not a URL",
    apiKey: "local-key",
    model: "curator-model"
  });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.problems.length >= 1);
});

test("creates deterministic fingerprints independent of object key order", () => {
  const left = createContentFingerprint("x", { text: "same", author: "one" });
  const right = createContentFingerprint("x", { author: "one", text: "same" });
  assert.equal(left, right);
  assert.notEqual(left, createContentFingerprint("x", { text: "different", author: "one" }));
  assert.equal(hashText("same"), hashText("same"));
  assert.equal(hashText("same").length, 16);
});

test("normalizes only known curation ids and enforces positive UI labels", () => {
  const curations = normalizeCurations({
    curations: [
      {
        id: "known",
        promote: true,
        dopamineScore: 3,
        durableValue: -2,
        primaryDriver: "identity-resonance",
        promotionLabel: "风险警告"
      },
      {
        id: "unknown",
        promote: true,
        dopamineScore: 1,
        durableValue: 0,
        primaryDriver: "mixed",
        promotionLabel: "热门刺激"
      }
    ]
  }, ["known"]);

  assert.deepEqual(curations, [{
    id: "known",
    promote: true,
    dopamineScore: 1,
    durableValue: 0,
    primaryDriver: "identity_resonance",
    promotionLabel: "高共鸣"
  }]);

  const [english] = normalizeCurations({
    curations: [{
      id: "known",
      promote: true,
      dopamineScore: 0.8,
      durableValue: 0.2,
      primaryDriver: "curiosity_gap",
      promotionLabel: "Risk warning"
    }]
  }, ["known"]);
  assert.equal(english.promotionLabel, "强好奇驱动");
  assert.deepEqual(normalizeCurations({ verdicts: curations }, ["known"]), []);
});

test("parses fenced, multipart and already-decoded JSON content", () => {
  assert.deepEqual(parseJsonContent("```json\n{\"ok\":true}\n```"), { ok: true });
  assert.deepEqual(parseJsonContent([{ text: "{\"ok\":" }, { text: "true}" }]), { ok: true });
  const object = { ok: true };
  assert.equal(parseJsonContent(object), object);
});

test("versions cache keys by model, prompt and extractor", () => {
  const base = {
    apiBaseUrl: "https://api.example.com/v1",
    model: "model-a",
    promptVersion: PROMPT_VERSION,
    extractorVersion: EXTRACTOR_VERSION,
    hash: "abcd"
  };
  assert.notEqual(createCacheKey(base), createCacheKey({ ...base, model: "model-b" }));
  assert.notEqual(createCacheKey(base), createCacheKey({ ...base, promptVersion: "prompt-v2" }));
  assert.notEqual(createCacheKey(base), createCacheKey({ ...base, extractorVersion: "extractor-v2" }));
});

test("local preference actions alter only the relevant promotion score", () => {
  const initial = normalizeProfile();
  const context = {
    platform: "x",
    author: "example",
    primaryDriver: "curiosity_gap",
    topics: ["science"]
  };
  const profile = applyPreferenceAction(initial, "more", context, 1000);
  const settings = sanitizeSettings({
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    model: "test",
    apiKey: "key",
    promotionThreshold: 0.75,
    personalizationEnabled: true
  });
  const decision = getPromotionDecision({
    promote: true,
    dopamineScore: 0.72,
    primaryDriver: "curiosity_gap"
  }, settings, profile, context);

  assert.ok(decision.boost > 0);
  assert.equal(decision.promote, true);
  assert.equal(profile.totalActions, 1);
});

test("settings clamp the supported promotion range", () => {
  assert.equal(sanitizeSettings({ promotionThreshold: 0.1 }).promotionThreshold, 0.5);
  assert.equal(sanitizeSettings({ promotionThreshold: 2 }).promotionThreshold, 0.95);
});

test("daily metrics reset when the date changes", () => {
  const metrics = normalizeMetrics({ day: "2020-01-01", promotions: 99 }, "2026-07-23");
  assert.equal(metrics.day, "2026-07-23");
  assert.equal(metrics.promotions, 0);
});
