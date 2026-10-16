import test from "node:test";
import assert from "node:assert/strict";
import { compose, composeAndReopen, atomic } from "../src/paths.mjs";

test("a single closed edge can traverse itself as the second power of a path", () => {
  const loop = Object.freeze({ subject: "settlement:a", predicate: "returns-to", object: "settlement:a" });
  const paths = compose([loop]);
  assert.equal(paths.length, 2);
  assert.equal(paths[0], loop);
  assert.deepEqual(paths[1], {
    subject: loop.subject,
    predicate: ["returns-to", "returns-to"],
    object: loop.object,
  });
  assert.ok(Object.isFrozen(paths[1].predicate));
  const opened = composeAndReopen([loop]);
  assert.deepEqual(opened.reopened, [loop]);
  assert.deepEqual(opened.residue, [["returns-to", "returns-to"]]);
});

test("a non-loop cannot fabricate self-composition; adjacent directed edges still compose", () => {
  const a = { subject: "a", predicate: "goes-to", object: "b" };
  const b = { subject: "b", predicate: "goes-to", object: "c" };
  assert.deepEqual(compose([a]), [a]);
  assert.deepEqual(compose([a, b]), [a, b,
    { subject: "a", predicate: ["goes-to", "goes-to"], object: "c" }]);
  assert.deepEqual(atomic(compose([a, b])), [a, b]);
});

test("an orientation reversal is not invented merely from a repeated source edge", () => {
  const one = { subject: "east", predicate: "witnesses", object: "west" };
  const two = { subject: "west", predicate: "returns", object: "east" };
  const paths = compose([one, two]);
  assert.deepEqual(paths.slice(2), [
    { subject: "east", predicate: ["witnesses", "returns"], object: "east" },
    { subject: "west", predicate: ["returns", "witnesses"], object: "west" },
  ]);
  assert.equal(paths.some(p => p.subject === "west" && p.object === "east" && Array.isArray(p.predicate)), false);
});
