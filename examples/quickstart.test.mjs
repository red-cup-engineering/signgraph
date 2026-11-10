import assert from "node:assert/strict";
import test from "node:test";
import { cell } from "@red-cup-engineering/signcell/cell";
import { composeAndReopen } from "@red-cup-engineering/signgraph/paths";

test("One round retains both generating edges and records their ordered composite.", () => {
  const edges = [cell("spring", "feeds", "brook"), cell("brook", "joins", "river")];
  const paths = composeAndReopen(edges);
  assert.deepEqual(paths.reopened, edges);
  assert.deepEqual(paths.residue, [["feeds", "joins"]]);
});
