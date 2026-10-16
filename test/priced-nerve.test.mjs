import assert from "node:assert/strict";
import test from "node:test";
import { pricedNerve } from "../src/cohomology.mjs";

const at = (source, cell, stance) => ({ source, cell, stance });

test("two independent sovereign contexts can disagree without erasing either testimony", () => {
  const west = at("enterprise:west", "contract", "accept");
  const east = at("enterprise:east", "contract", "decline");
  const forward = pricedNerve([west, east]);
  const reversed = pricedNerve([east, west]);
  assert.deepEqual(forward, reversed, "arrival order is not a federation law");
  assert.equal(forward.top, 2, "two incompatible one-valued stances obstruct both measurements");
  assert.equal(forward.mass, 2);
  assert.deepEqual(forward.cells, ["contract"]);
  assert.equal(pricedNerve([west, at("enterprise:east", "contract", "accept")]).mass, 0,
    "independent consistent contexts glue without a manufactured coordination price");
});

test("one context cannot claim two incompatible values of one single-valued register", () => {
  const accept = at("enterprise:west", "contract", "accept");
  const decline = at("enterprise:west", "contract", "decline");
  for (const rows of [[accept, decline], [decline, accept],
    [accept, accept, decline]]) {
    assert.throws(() => pricedNerve(rows), /one source cannot assign two values/u,
      "a local non-function does not masquerade as a zero-cost cover");
  }
  assert.equal(pricedNerve([accept, accept]).mass, 0,
    "duplicate same-side evidence remains idempotent");
});

test("federated cell iteration is deterministic Unicode order, not host locale collation", () => {
  const labels = ["Ö", "z", "Z", "a", "A"];
  const statements = labels.map(cell => at("independent-ANT", cell, "admit"));
  const read = pricedNerve(statements);
  assert.equal(read.top, 0);
  assert.deepEqual(read.obstructions, [], "disjoint single-source cells do not create a conflict");
  const mixed = labels.flatMap(cell => [
    at("ANT-A", cell, "admit"), at("ANT-B", cell, "decline"),
  ]);
  assert.deepEqual(pricedNerve(mixed).cells, ["A", "Z", "a", "z", "Ö"],
    "every host gives the same canonical code-unit order to the federation's contested cells");
  assert.deepEqual(pricedNerve(mixed.reverse()).cells, ["A", "Z", "a", "z", "Ö"]);
});

test("a FOUR-valued claim may carry both sides locally; that is not an invalid register", () => {
  const forIt = at("enterprise:west", "can-cross", "potential");
  const against = at("enterprise:west", "can-cross", "active");
  const opposed = pricedNerve([forIt, against], { readings: true });
  assert.equal(opposed.top, 1);
  assert.equal(opposed.mass, 1);
  assert.deepEqual(pricedNerve([against, forIt], { readings: true }), opposed);
  assert.equal(pricedNerve([forIt, forIt], { readings: true }).mass, 0);
});
