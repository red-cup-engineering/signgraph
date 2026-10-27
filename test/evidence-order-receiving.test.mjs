import assert from "node:assert/strict";
import test from "node:test";
import { cell, valueOf } from "@red-cup-engineering/signcell/cell";
import { SPECIALIZES, tokenFrame } from "@red-cup-engineering/signcell/token-frame";
import { possibilize, valuationOf } from "@red-cup-engineering/signchain/token-fiber";
import { inherited, inheritedClaim, queryInheritedTellings } from "../src/token-sheaf.mjs";

const predicate = "requires";
const object = "source-qualified-market-claim";
const claim = cell("service-type", predicate, object, { for: ["customer-requirement"] });

function receive(frame) {
  return {
    whole: inherited(frame, "service-instance"),
    one: inheritedClaim(frame, "service-instance", predicate, object),
    query: queryInheritedTellings(frame, { token: "service-instance", predicate, object }),
    modal: possibilize(frame, valuationOf(frame, predicate, object))
      .find(({ token }) => token === "service-instance").reading,
  };
}

test("an unwitnessed classification value cannot transmit a customer requirement", () => {
  const classification = cell("service-instance", SPECIALIZES, "service-type", { value: "potential" });
  const frame = tokenFrame([classification, claim]);
  const result = receive(frame);
  assert.equal(result.whole.cells.length, 0);
  assert.equal(result.one.cells.length, 0);
  assert.equal(result.query.total, 0);
  assert.equal(result.modal, "absurd");
  assert.deepEqual(inheritedClaim(frame, "service-type", predicate, object).cells, [claim],
    "the original customer's claim remains readable at its source");
  assert.equal(valueOf(frame.cells.find(at => at.predicate === SPECIALIZES)), "potential");
});

test("a lowered classification value cannot erase a witnessed requirement path", () => {
  const classification = cell("service-instance", SPECIALIZES, "service-type", { for: ["classification-sensor"], value: "absurd" });
  const frame = tokenFrame([classification, claim]);
  const result = receive(frame);
  assert.equal(result.whole.cells.length, 1);
  assert.equal(result.one.cells.length, 1);
  assert.equal(result.query.total, 1);
  assert.equal(result.modal, "potential");
  assert.deepEqual(result.one.cells[0].for, claim.for);
  assert.deepEqual(result.one.sources[0], [{ token: "service-type", cell: claim }]);
  assert.equal(valueOf(frame.cells.find(at => at.predicate === SPECIALIZES)), "absurd");
});

test("a positive written value does not overturn an explicit negative classification", () => {
  const classification = cell("service-instance", SPECIALIZES, "service-type", { against: ["counterexample"], value: "potential" });
  const frame = tokenFrame([classification, claim]);
  const result = receive(frame);
  assert.equal(result.whole.cells.length, 0);
  assert.equal(result.one.cells.length, 0);
  assert.equal(result.query.total, 0);
  assert.equal(result.modal, "absurd");
  assert.deepEqual(frame.cells.find(at => at.predicate === SPECIALIZES).against, ["counterexample"]);
});
