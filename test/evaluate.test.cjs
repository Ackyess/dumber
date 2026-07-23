const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const script = join(__dirname, "../scripts/evaluate.mjs");
const seedGold = join(__dirname, "../evaluation/seed.synthetic.jsonl");
const seedPred = join(__dirname, "../evaluation/seed.predictions.jsonl");

test("evaluation seed is fully covered but is not eligible for the 300-case roadmap gate", () => {
  const result = run(["--gold", seedGold, "--pred", seedPred]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.coverage, 1);
  assert.equal(report.precision, 1);
  assert.equal(report.roadmapGateEligible, false);
  assert.equal(report.roadmapPrecisionGatePassed, false);
});

test("evaluation rejects duplicate prediction ids", () => {
  const directory = mkdtempSync(join(tmpdir(), "dumber-eval-"));
  const duplicate = join(directory, "duplicate.jsonl");
  const row = JSON.stringify({
    id: "syn-x-001",
    promote: true,
    dopamineScore: 0.9,
    durableValue: 0.2,
    primaryDriver: "high_emotion",
    promotionLabel: "高情绪浓度"
  });
  writeFileSync(duplicate, `${row}\n${row}\n`, "utf8");

  const result = run(["--gold", seedGold, "--pred", duplicate]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /duplicate id/);
});

function run(args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
}
