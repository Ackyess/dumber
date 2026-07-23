const test = require("node:test");
const assert = require("node:assert/strict");

require("../src/shared.js");
require("../src/adapters/index.js");
require("../src/adapters/x.js");

const adapter = globalThis.DumberAdapters.get("x");

test("x adapter never activates on direct messages", () => {
  assert.equal(adapter.matches({ hostname: "x.com", pathname: "/home" }, {}), true);
  assert.equal(adapter.matches({ hostname: "x.com", pathname: "/messages" }, {}), false);
  assert.equal(adapter.matches({ hostname: "x.com", pathname: "/messages/123" }, {}), false);
});
