import assert from "node:assert/strict";
import test from "node:test";
import { cell, coincides, valueOf } from "@red-cup-engineering/signcell/cell";
import * as signCellPredication from "@red-cup-engineering/signcell/predication";
import * as signChainTheory from "@red-cup-engineering/signchain/typed-theory";
import { SPECIALIZES, tokenFrame } from "@red-cup-engineering/signcell/token-frame";
import { possibilize, valuationOf } from "@red-cup-engineering/signchain/token-fiber";
import { inherited, inheritedClaim, queryInheritedTellings } from "../src/token-sheaf.mjs";
import { predicateFiber, specialization } from "../src/fiber.mjs";

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

test("native original SignCell predication identity crosses SignChain theory into a typed SignGraph site", () => {
  const { predicationSite, isAdmittedPredicationBase } = signCellPredication;
  const { theoryOfBase } = signChainTheory;
  // Fail closed rather than skip a source-admission requirement because an
  // older dependency distribution happens not to expose the real producer.
  assert.equal(typeof predicationSite, "function", "installed SignCell predication producer missing");
  assert.equal(typeof isAdmittedPredicationBase, "function",
    "installed SignCell lacks predication-base construction admission");
  assert.equal(typeof theoryOfBase, "function", "installed SignChain typed-theory receiver missing");

  const source = cell("source", "reports", "target", { for: ["original-witness"] });
  const base = predicationSite([source]).base;
  assert.equal(isAdmittedPredicationBase(base), true);
  const received = theoryOfBase(base);
  assert.equal(received.kind, "typedTheory.carrier");
  assert.equal(received.rules.length, 3, "only the three actual source-generated predication moves");

  const entities = [source.subject, source.object], selected = [[source.subject, source.object]];
  const fiber = predicateFiber(source.predicate, entities,
    (subject, object) =>
      coincides(subject, source.subject) && coincides(object, source.object)
        ? valueOf(source) : "absurd", selected);
  const gen = specialization([source.object, source.subject], selected);
  const local = gen.pullback(fiber);
  assert.equal(local.at(source.subject, source.object), valueOf(source));
  assert.equal(local.at(source.object, source.subject), "absurd",
    "neither the graph nor a composed rule invents the converse testimony");

  const replica = JSON.parse(JSON.stringify(base));
  assert.equal(isAdmittedPredicationBase(replica), false);
  assert.throws(() => theoryOfBase(replica), /originally constructed SignCell/u);
});
