import assert from "node:assert/strict";
import test from "node:test";
import { cell } from "@red-cup-engineering/signcell/cell";
import { composeAndReopen } from "@red-cup-engineering/signgraph/paths";

test("SG-PATH-QUICKSTART", () => {
  const edges = [cell("spring", "feeds", "brook"), cell("brook", "joins", "river")];
  const paths = composeAndReopen(edges);
  assert.deepEqual(paths.reopened, edges);
  assert.deepEqual(paths.residue, [["feeds", "joins"]]);
});
