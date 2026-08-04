const test = require("node:test");
const assert = require("node:assert/strict");
const Shared = require("../src/shared.js");
const Curator = require("../src/curator.js");

const settings = {
  model: "test-model"
};

test("builds the new curation schema", () => {
  const payload = Curator.createRequestPayload(settings, [{
    id: "item-1",
    context: { text: "热门争议内容" }
  }]);
  const schema = payload.response_format.json_schema.schema;
  const properties = schema.properties.curations.items.properties;
  assert.deepEqual(Object.keys(properties), [
    "id",
    "promote",
    "dopamineScore",
    "durableValue",
    "primaryDriver"
  ]);
  assert.equal(schema.properties.curations.minItems, 1);
  assert.equal(schema.properties.curations.maxItems, 8);
  assert.equal(payload.messages[1].content.includes("item-1"), true);
  assert.equal(payload.stream, false);
  assert.match(Curator.SYSTEM_PROMPT, /Concrete projects/);
  assert.match(Curator.SYSTEM_PROMPT, /authority and celebrity signals/);
  assert.match(Curator.SYSTEM_PROMPT, /visible excerpt itself contains evidence/);
});

test("uses non-thinking JSON output for DeepSeek Flash", () => {
  const item = [{ id: "item-1", context: { text: "测试" } }];
  const payload = Curator.createRequestPayload({ model: "deepseek-v4-flash" }, item);
  assert.deepEqual(payload.thinking, { type: "disabled" });
  assert.deepEqual(payload.response_format, { type: "json_object" });

  const generic = Curator.createRequestPayload(settings, item);
  assert.equal(generic.thinking, undefined);
  assert.equal(generic.response_format.type, "json_schema");
});

test("builds and parses exact-phrase second-stage output", () => {
  const items = [{
    id: "item-1",
    context: { text: "这个惊人结论让所有人彻底疯狂", quoteText: "不应发送" }
  }];
  const payload = Curator.createEmphasisRequestPayload(settings, items);
  const request = JSON.parse(payload.messages[1].content);
  assert.deepEqual(request.items, [{ id: "item-1", text: "这个惊人结论让所有人彻底疯狂" }]);
  assert.equal(payload.response_format.json_schema.name, "dumber_emphases");
  assert.equal(
    payload.response_format.json_schema.schema.properties.emphases.items.properties.phrases.items.maxLength,
    Shared.EMPHASIS_MAX_LENGTH
  );
  assert.match(Curator.EMPHASIS_SYSTEM_PROMPT, /Never return a full clause or sentence/);

  const result = Curator.parseEmphasisResponse({
    choices: [{
      message: {
        content: JSON.stringify({
          emphases: [{ id: "item-1", phrases: ["惊人结论", "彻底疯狂", "模型编造"] }]
        })
      }
    }]
  }, items);
  assert.deepEqual(result, [{ id: "item-1", phrases: ["惊人结论", "彻底疯狂"] }]);
});

test("caps model context and omits non-semantic fields", () => {
  const payload = Curator.createRequestPayload(settings, [{
    id: "item-1",
    context: {
      text: "x".repeat(2000),
      quoteText: "q".repeat(1000),
      canonicalUrl: "https://x.com/example/status/1"
    }
  }]);
  const [item] = JSON.parse(payload.messages[1].content).items;
  assert.equal(item.context.text.length, 700);
  assert.equal(item.context.quoteText.length, 280);
  assert.equal(item.context.canonicalUrl, undefined);
});

test("parses structured model output", () => {
  const body = {
    choices: [{
      message: {
        content: JSON.stringify({
          curations: [{
            id: "item-1",
            promote: true,
            dopamineScore: 0.91,
            durableValue: 0.2,
            primaryDriver: "high_emotion"
          }]
        })
      }
    }]
  };
  const [result] = Curator.parseCurationResponse(body, ["item-1"]);
  assert.equal(result.promote, true);
  assert.equal(result.primaryDriver, "high_emotion");
  assert.equal(result.promotionLabel, "高情绪浓度");
});

test("single-flight batcher deduplicates keys and never overlaps workers", async () => {
  let activeWorkers = 0;
  let maximumActive = 0;
  const calls = [];
  const batcher = Curator.createSingleFlightBatcher({
    maxBatchSize: 2,
    delayMs: 1,
    worker: async (entries) => {
      activeWorkers += 1;
      maximumActive = Math.max(maximumActive, activeWorkers);
      calls.push(entries.map((entry) => entry.key));
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeWorkers -= 1;
      return new Map(entries.map((entry) => [entry.key, entry.value * 2]));
    }
  });

  const [one, duplicate, two, three] = await Promise.all([
    batcher.enqueue("one", 2),
    batcher.enqueue("one", 999),
    batcher.enqueue("two", 3),
    batcher.enqueue("three", 4)
  ]);

  assert.equal(one, 4);
  assert.equal(duplicate, 4);
  assert.equal(two, 6);
  assert.equal(three, 8);
  assert.equal(maximumActive, 1);
  assert.deepEqual(calls, [["one", "two"], ["three"]]);
});

test("single-flight batcher joins a duplicate that arrives while the worker is active", async () => {
  let releaseWorker;
  let workerCalls = 0;
  let workerStarted;
  const started = new Promise((resolve) => { workerStarted = resolve; });
  const gate = new Promise((resolve) => { releaseWorker = resolve; });
  const batcher = Curator.createSingleFlightBatcher({
    delayMs: 0,
    worker: async (entries) => {
      workerCalls += 1;
      workerStarted();
      await gate;
      return new Map(entries.map((entry) => [entry.key, entry.value]));
    }
  });

  const first = batcher.enqueue("active-key", "first");
  await started;
  const duplicate = batcher.enqueue("active-key", "ignored");
  assert.equal(batcher.state().active, 1);
  releaseWorker();

  assert.deepEqual(await Promise.all([first, duplicate]), ["first", "first"]);
  assert.equal(workerCalls, 1);
});

test("clearing the batcher rejects pending and active waiters", async () => {
  let workerStarted;
  const started = new Promise((resolve) => { workerStarted = resolve; });
  const batcher = Curator.createSingleFlightBatcher({
    delayMs: 0,
    worker: async () => {
      workerStarted();
      await new Promise((resolve) => setTimeout(resolve, 12));
      return new Map([["active", "late"]]);
    }
  });

  const active = batcher.enqueue("active", "value");
  await started;
  const pending = batcher.enqueue("pending", "value");
  batcher.clear(new Error("cleared"));

  await assert.rejects(active, /cleared/);
  await assert.rejects(pending, /cleared/);
  assert.deepEqual(batcher.state(), { pending: 0, active: 0, running: true });
});
