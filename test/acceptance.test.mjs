import assert from "node:assert/strict";
import test from "node:test";
import { cell } from "@red-cup-engineering/signcell/cell";
import { compose, sixfoldMotion } from "@red-cup-engineering/signgraph/paths";

test("SG-PATH-LOOP", () => {
  const loop = cell("station", "returns-to", "station");
  const paths = compose([loop]);
  assert.equal(paths.length, 2);
  assert.deepEqual(paths[1], { subject: loop.subject, predicate: ["returns-to", "returns-to"], object: loop.object });
});

test("SG-PATH-COORDINATE", () => {
  assert.throws(() => sixfoldMotion(1, [0, 0.5]), TypeError);
});
