const test = require("node:test");
const assert = require("node:assert/strict");
const Shared = require("../src/shared.js");

const {
  CANDIDATE_MAX_DURABLE,
  CANDIDATE_MIN_DOPAMINE,
  DEFAULT_SETTINGS,
  EMPHASIS_PROMPT_VERSION,
  EXTRACTOR_VERSION,
  PIPELINE_PROMPT_VERSION,
  PROMPT_VERSION,
  SETTINGS_SCHEMA_VERSION,
  applyPreferenceAction,
  createCacheKey,
  createContentFingerprint,
  getPromotionDecision,
  hashText,
  normalizeApiUrl,
  normalizeCurations,
  normalizeEmphasis,
  normalizeMetrics,
  normalizeProfile,
  parseJsonContent,
  promotionDurableLimit,
  sanitizeSettings,
  toOriginPattern,
  validateSettings
} = Shared;

test("ships DeepSeek Flash BYOK defaults without a credential", () => {
  assert.equal(DEFAULT_SETTINGS.apiBaseUrl, "https://api.deepseek.com");
  assert.equal(DEFAULT_SETTINGS.apiKey, "");
  assert.equal(DEFAULT_SETTINGS.model, "deepseek-v4-flash");
  assert.equal(DEFAULT_SETTINGS.schemaVersion, SETTINGS_SCHEMA_VERSION);
  assert.equal(DEFAULT_SETTINGS.requestTimeoutMs, 28000);
  assert.equal(DEFAULT_SETTINGS.xEnabled, true);
  assert.equal(DEFAULT_SETTINGS.bilibiliEnabled, false);
});

test("migrates official xAI settings to DeepSeek without carrying its key", () => {
  const migrated = sanitizeSettings({
    schemaVersion: 2,
    apiBaseUrl: "https://api.x.ai/v1",
    apiKey: "xai-local-key",
    model: "grok4.5"
  });
  assert.equal(migrated.apiBaseUrl, "https://api.deepseek.com");
  assert.equal(migrated.apiKey, "");
  assert.equal(migrated.model, "deepseek-v4-flash");
});

test("switches a Grok proxy model while retaining its local gateway key", () => {
  const migrated = sanitizeSettings({
    schemaVersion: 2,
    apiBaseUrl: "https://gateway.example/v1",
    apiKey: "gateway-local-key",
    model: "grok-4.5"
  });
  assert.equal(migrated.apiBaseUrl, "https://gateway.example/v1");
  assert.equal(migrated.apiKey, "gateway-local-key");
  assert.equal(migrated.model, "deepseek-v4-flash");
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
  assert.equal(settings.bilibiliEnabled, false);
});

test("migrates the former maximum-detection floor to the stronger range", () => {
  const migrated = sanitizeSettings({
    schemaVersion: 3,
    apiKey: "local-key",
    model: "deepseek-v4-flash",
    promotionThreshold: 0.5
  });
  assert.equal(migrated.promotionThreshold, CANDIDATE_MIN_DOPAMINE);
  assert.equal(migrated.apiKey, "local-key");
});

test("normalizes OpenAI-compatible API roots", () => {
  assert.equal(
    sanitizeSettings({ schemaVersion: SETTINGS_SCHEMA_VERSION, apiBaseUrl: "https://api.deepseek.com/v1" }).apiBaseUrl,
    "https://api.deepseek.com"
  );
  assert.equal(
    normalizeApiUrl("https://api.deepseek.com"),
    "https://api.deepseek.com/v1/chat/completions"
  );
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

test("keeps only exact source phrases for second-stage emphasis", () => {
  assert.equal(PIPELINE_PROMPT_VERSION.includes(EMPHASIS_PROMPT_VERSION), true);
  assert.deepEqual(normalizeEmphasis({
    phrases: ["太疯狂", "must see", "模型编造", "太疯狂", "X"]
  }, "这条消息真的太疯狂了，YOU MUST SEE THIS。"), {
    phrases: ["太疯狂", "MUST SEE"]
  });
});

test("maximum detection catches observed low-value X patterns despite false provider flags", () => {
  const raw = [
    ["complaint", 0.3, 0.2],
    ["hypothetical", 0.4, 0.3],
    ["reaction", 0.5, 0.2],
    ["context-reply", 0.2, 0.7],
    ["rumor", 0.6, 0.1]
  ].map(([id, dopamineScore, durableValue]) => ({
    id,
    promote: false,
    dopamineScore,
    durableValue,
    primaryDriver: "curiosity_gap"
  }));
  const curations = normalizeCurations({ curations: raw }, raw.map(({ id }) => id));

  assert.equal(curations.length, raw.length);
  assert.equal(curations.every((curation) => curation.promote), true);
  assert.equal(curations.every((curation) => getPromotionDecision(
    curation,
    { promotionThreshold: CANDIDATE_MIN_DOPAMINE },
    {},
    {}
  ).promote), true);
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
    fingerprint: "item-fingerprint",
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
    durableValue: 0.2,
    primaryDriver: "curiosity_gap"
  }, settings, profile, context);

  assert.ok(decision.boost > 0);
  assert.equal(decision.promote, true);
  assert.equal(profile.totalActions, 1);
});

test("default strictness keeps durable value as a hard promotion gate", () => {
  const context = {
    platform: "x",
    author: "favorite",
    fingerprint: "valuable-item",
    primaryDriver: "curiosity_gap",
    topics: ["projects"]
  };
  let profile = normalizeProfile();
  for (let index = 0; index < 6; index += 1) {
    profile = applyPreferenceAction(profile, "more", context, index + 1);
  }
  const settings = sanitizeSettings({
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    model: "test",
    apiKey: "key",
    promotionThreshold: 0.72,
    personalizationEnabled: true
  });
  const base = {
    promote: true,
    dopamineScore: 0.95,
    primaryDriver: "curiosity_gap"
  };

  const valuable = getPromotionDecision({
    ...base,
    durableValue: 0.46
  }, settings, profile, context);
  const disposable = getPromotionDecision({
    ...base,
    durableValue: 0.45
  }, settings, profile, context);

  assert.ok(valuable.boost > 0);
  assert.equal(valuable.promote, false);
  assert.equal(valuable.durableEligible, false);
  assert.equal(disposable.promote, true);
});

test("strictness slider controls both stimulation and durable-value gates", () => {
  assert.equal(promotionDurableLimit(0.2), CANDIDATE_MAX_DURABLE);
  assert.equal(promotionDurableLimit(0.5), 0.6);
  assert.equal(promotionDurableLimit(0.72), 0.45);
  assert.equal(promotionDurableLimit(0.95), 0.25);

  const curation = {
    promote: true,
    dopamineScore: 0.2,
    durableValue: 0.7,
    primaryDriver: "instant_gratification"
  };
  const lenient = getPromotionDecision(curation, { promotionThreshold: 0.2 }, {}, {});
  const balanced = getPromotionDecision(curation, { promotionThreshold: 0.72 }, {}, {});
  assert.equal(lenient.promote, true);
  assert.equal(balanced.promote, false);
  assert.equal(lenient.durableLimit, 0.8);
  assert.equal(balanced.durableLimit, 0.45);
});

test("less feedback vetoes the same item immediately", () => {
  const context = {
    platform: "x",
    author: "example",
    fingerprint: "same-item",
    primaryDriver: "curiosity_gap",
    topics: ["science"]
  };
  const profile = applyPreferenceAction(normalizeProfile(), "less", context, 1000);
  const decision = getPromotionDecision({
    promote: true,
    dopamineScore: 0.95,
    durableValue: 0.1,
    primaryDriver: "curiosity_gap"
  }, {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    model: "test",
    apiKey: "key",
    promotionThreshold: 0.72
  }, profile, context);

  assert.equal(profile.items["same-item"].less, 1);
  assert.equal(decision.itemVeto, true);
  assert.equal(decision.promote, false);
});

test("settings clamp the supported promotion range", () => {
  assert.equal(sanitizeSettings({ promotionThreshold: 0.1 }).promotionThreshold, 0.2);
  assert.equal(sanitizeSettings({ promotionThreshold: 2 }).promotionThreshold, 0.95);
});

test("daily metrics reset when the date changes", () => {
  const metrics = normalizeMetrics({ day: "2020-01-01", promotions: 99 }, "2026-07-23");
  assert.equal(metrics.day, "2026-07-23");
  assert.equal(metrics.promotions, 0);
});
