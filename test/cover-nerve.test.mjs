import assert from "node:assert/strict";
import test from "node:test";

import { computeCoverNerve, linkGraphNerve } from "@red-cup-engineering/signgraph/cohomology";

test("cover-nerve readout reports a cycle and preserves isolated vertices", () => {
  const nerve = linkGraphNerve(["a", "b", "c", "d"], [
    { from: "a", to: "b" },
    { from: "b", to: "c" },
    { from: "c", to: "a" },
    { from: "c", to: "b" },
  ]);

  assert.deepEqual(computeCoverNerve(nerve), {
    h0rank: 2,
    h1rank: 1,
    coordinationFree: false,
    landauerBits: 1,
    coordinationCost: 1,
  });
});

test("cover-nerve readout checks Metrologic's bounds and preserves exact ranks", () => {
  assert.deepEqual(computeCoverNerve({ entities: 4, cells: 2, components: 2 }), {
    h0rank: 2,
    h1rank: 0,
    coordinationFree: true,
    landauerBits: 0,
    coordinationCost: 0,
  });
  assert.throws(
    () => computeCoverNerve({ entities: 4, cells: 1, components: 1 }),
    /union-find-invariant-fails/u,
  );
  const cells = Number.MAX_SAFE_INTEGER;
  assert.equal(computeCoverNerve({ entities: 3, cells, components: 2 }).h1rank, cells - 1);
});
