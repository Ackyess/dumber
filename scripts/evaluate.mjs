#!/usr/bin/env node
import { readFileSync } from "node:fs";
import process from "node:process";

const DRIVER_KEYS = new Set([
  "high_emotion",
  "identity_resonance",
  "curiosity_gap",
  "reaction_chain",
  "frictionless_exploration",
  "instant_gratification",
  "status_signal",
  "mixed"
]);

try {
  const args = parseArgs(process.argv.slice(2));
  if (!args.gold || !args.pred) {
    throw new Error("Usage: node scripts/evaluate.mjs --gold gold.jsonl --pred predictions.jsonl");
  }

  const gold = readJsonLines(args.gold, validateGoldCase);
  const predictionRows = readJsonLines(args.pred, validatePrediction);
  assertUniqueIds(gold, args.gold);
  assertUniqueIds(predictionRows, args.pred);

  const predictions = new Map(predictionRows.map((item) => [String(item.id), item]));
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let trueNegative = 0;
  let covered = 0;
  let driverAgreement = 0;
  const falsePositives = [];
  const falseNegatives = [];
  const missingPredictionIds = [];

  for (const item of gold) {
    const prediction = predictions.get(String(item.id));
    if (!prediction) {
      missingPredictionIds.push(item.id);
      continue;
    }
    covered += 1;
    const expected = item.expectedPromote;
    const actual = prediction.promote;
    if (expected && actual) truePositive += 1;
    else if (!expected && actual) {
      falsePositive += 1;
      falsePositives.push({ id: item.id, notes: item.notes, driver: prediction.primaryDriver });
    } else if (expected && !actual) {
      falseNegative += 1;
      falseNegatives.push({ id: item.id, notes: item.notes, driver: prediction.primaryDriver });
    } else trueNegative += 1;

    if (item.acceptableDrivers.includes(prediction.primaryDriver)) driverAgreement += 1;
  }

  const precision = divide(truePositive, truePositive + falsePositive);
  const recall = divide(truePositive, truePositive + falseNegative);
  const coverage = divide(covered, gold.length);
  const extraPredictionIds = predictionRows
    .map((item) => String(item.id))
    .filter((id) => !gold.some((item) => String(item.id) === id));
  const roadmapGateEligible = gold.length >= 300 && coverage === 1;
  const report = {
    cases: gold.length,
    predictions: predictionRows.length,
    covered,
    coverage,
    confusion: { truePositive, falsePositive, falseNegative, trueNegative },
    precision,
    recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    driverAgreement: divide(driverAgreement, covered),
    roadmapGateEligible,
    roadmapPrecisionGatePassed: roadmapGateEligible && precision >= 0.9,
    missingPredictionIds,
    extraPredictionIds,
    falsePositives,
    falseNegatives
  };
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error?.message || String(error));
  process.exit(2);
}

function divide(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function readJsonLines(path, validator) {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      let value;
      try {
        value = JSON.parse(line);
      } catch (error) {
        throw new Error(`${path}:${index + 1}: ${error.message}`);
      }
      validator(value, `${path}:${index + 1}`);
      return value;
    });
}

function validateGoldCase(value, location) {
  requireObject(value, location);
  requireId(value.id, location);
  if (value.platform !== "x") {
    throw new Error(`${location}: platform must be x`);
  }
  if (!value.context || typeof value.context !== "object" || Array.isArray(value.context)) {
    throw new Error(`${location}: context must be an object`);
  }
  if (typeof value.expectedPromote !== "boolean") {
    throw new Error(`${location}: expectedPromote must be boolean`);
  }
  if (!Array.isArray(value.acceptableDrivers) || !value.acceptableDrivers.length) {
    throw new Error(`${location}: acceptableDrivers must be a non-empty array`);
  }
  for (const driver of value.acceptableDrivers) {
    if (!DRIVER_KEYS.has(driver)) throw new Error(`${location}: unsupported driver ${driver}`);
  }
  if (typeof value.notes !== "string") throw new Error(`${location}: notes must be a string`);
  if (!value.provenance || typeof value.provenance !== "object" || Array.isArray(value.provenance)) {
    throw new Error(`${location}: provenance must be an object`);
  }
  if (!value.provenance.capturedAt || Number.isNaN(Date.parse(value.provenance.capturedAt))) {
    throw new Error(`${location}: provenance.capturedAt must be a valid date-time`);
  }
  if (typeof value.provenance.redistribution !== "string" || !value.provenance.redistribution.trim()) {
    throw new Error(`${location}: provenance.redistribution is required`);
  }
}

function validatePrediction(value, location) {
  requireObject(value, location);
  requireId(value.id, location);
  if (typeof value.promote !== "boolean") throw new Error(`${location}: promote must be boolean`);
  requireUnitScore(value.dopamineScore, "dopamineScore", location);
  requireUnitScore(value.durableValue, "durableValue", location);
  if (!DRIVER_KEYS.has(value.primaryDriver)) {
    throw new Error(`${location}: unsupported primaryDriver ${value.primaryDriver}`);
  }
  if (typeof value.promotionLabel !== "string" || !value.promotionLabel.trim()) {
    throw new Error(`${location}: promotionLabel must be a non-empty string`);
  }
}

function requireObject(value, location) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${location}: each row must be a JSON object`);
  }
}

function requireId(value, location) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${location}: id is required`);
}

function requireUnitScore(value, name, location) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${location}: ${name} must be between 0 and 1`);
  }
}

function assertUniqueIds(rows, path) {
  const seen = new Set();
  for (const row of rows) {
    const id = String(row.id);
    if (seen.has(id)) throw new Error(`${path}: duplicate id ${id}`);
    seen.add(id);
  }
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value?.startsWith("--")) throw new Error(`Unexpected argument: ${value || "<empty>"}`);
    const equalAt = value.indexOf("=");
    if (equalAt > 2) {
      result[value.slice(2, equalAt)] = value.slice(equalAt + 1);
      continue;
    }
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`Missing value for --${key}`);
    result[key] = next;
    index += 1;
  }
  return result;
}
