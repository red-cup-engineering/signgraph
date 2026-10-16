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

test("invalid source testimony cannot impersonate a sovereign witness or an admitted register", () => {
  for (const invalid of [
    { cell: "contract", stance: "agree" }, { source: "", cell: "contract", stance: "agree" },
    { source: "ANT-A", cell: "", stance: "agree" },
    { source: "ANT-A", cell: "contract" },
    { source: "ANT-A", cell: "contract", stance: "agree", capability: "self-granted" },
    { source: "ANT-A", cell: "contract", stance: "agree", witness: "" },
  ]) {
    assert.throws(() => pricedNerve([invalid]), /invalid federated source\/cell\/stance statement/u);
  }
  assert.throws(() => pricedNerve({source:"ANT-A"}), /cover must be an array/u);
});

test("hundreds of distinct actor stances preserve the original merge result under linear grouping", () => {
  const actors = Array.from({length:300}, (_, i) =>
    at(`ANT-${i}`, "contract", i % 2 ? "decline" : "accept"));
  const read = pricedNerve(actors);
  assert.equal(read.top, 2);
  assert.equal(read.mass, 300, "the counting merge retains every authentic contradictory source");
  assert.deepEqual(read.cells, ["contract"]);
  assert.deepEqual(pricedNerve(actors.reverse()), read);
});

test("large gyrobifastidial federations tally each independent SSE once", () => {
  const independent = Array.from({ length: 1200 }, (_, i) =>
    at(`SSE-${i}`, "contract", i % 3 ? "refine" : "counter"));
  const registered = pricedNerve(independent);
  assert.equal(registered.top, 2);
  assert.equal(registered.mass, 800);
  assert.equal(registered.rank, 1199);
  assert.deepEqual(pricedNerve([...independent].reverse()), registered);
  // FOUR remains a *claim*, not an invalid multi-value register. Repetition
  // and changed arrival order cannot inflate its single-source local tally.
  const testimony = [
    at("SSE-west", "border", "potential"),
    at("SSE-west", "border", "potential"),
    at("SSE-west", "border", "active"),
    at("SSE-east", "border", "absurd"),
  ];
  const evidence = pricedNerve(testimony, { readings: true });
  assert.equal(evidence.top, 1);
  assert.equal(evidence.mass, 1);
  assert.deepEqual(pricedNerve([...testimony].reverse(), { readings: true }), evidence);
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
