import assert from "node:assert/strict";
import test from "node:test";
import { cell, coincides, valueOf } from "@red-cup-engineering/signcell/cell";
import * as signCellPredication from "@red-cup-engineering/signcell/predication";
import { utterance } from "@red-cup-engineering/signcell/utterance";
import { createTypeSystem, defineType, getType, isSubtypeOf, specializeType, typeIdentity } from "@red-cup-engineering/signcell/type-system";
import { admitTypeSystemDocument, typeSystemDocument } from "@red-cup-engineering/signcell/type-system/document";
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

  // The ordinary SignCell cell accepts plain data, but a predication base
  // requires original Token/Claim/Predicate hands. Do not mistake a generic
  // evidenced triple for an admitted specialized predication generator.
  const reporting = utterance("source", "reports");
  const reported = utterance("target", "received");
  const source = signCellPredication.cell(
    reporting.token,
    signCellPredication.predicateOfClaim(reporting.claim),
    reported.token,
    { for: ["original-witness"] },
  );
  assert.equal(signCellPredication.isCell(source), true,
    "original source-shaped Token/Claim predication must be admitted");
  assert.throws(() => predicationSite([
    cell("source", "reports", "target", { for: ["original-witness"] }),
  ]), /unsupported or malformed source generator/u,
  "ordinary Cell evidence cannot impersonate a typed predication source");
  const base = predicationSite([source]).base;
  assert.equal(isAdmittedPredicationBase(base), true);
  const received = theoryOfBase(base);
  assert.equal(received.kind, "typedTheory.carrier");
  assert.equal(received.rules.length, 3, "only the three actual source-generated predication moves");
  // Count and carrier kind alone are insufficient. A SignChain supplier that
  // silently swaps subject/object projections would still satisfy both.
  // Check each original source-generated morphism, trace and endpoint.
  const originalNode = [source.subject, source.predicate, source.object];
  const expectedRules = [
    ["typedTheory.inferenceMorphism.converse", originalNode,
      [source.object, source.predicate, source.subject]],
    ["typedTheory.inferenceMorphism.subjectProjection", originalNode, source.subject],
    ["typedTheory.inferenceMorphism.objectProjection", originalNode, source.object],
  ];
  assert.equal(typeof signCellPredication.baseObjectCoincides, "function",
    "installed source owner must qualify original base endpoints");
  for (const [index, [kind, domain, codomain]] of expectedRules.entries()) {
    const rule = received.rules[index];
    assert.equal(rule.kind, "typedTheory.inferenceRule");
    assert.equal(rule.trace.kind, "typedTheory.inferenceTrace");
    assert.equal(rule.trace.morphisms.length, 1, "one original generating move per rule");
    assert.equal(rule.trace.morphisms[0].kind, kind, "source morphism kind must survive");
    assert.equal(signCellPredication.baseObjectCoincides(rule.domain, domain), true,
      "source-generated domain must survive");
    assert.equal(signCellPredication.baseObjectCoincides(rule.codomain, codomain), true,
      "source-generated codomain must survive");
  }

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

test("portable Thing→Resource specialization re-enters the original typed graph without inferred authority", () => {
  const need = (result) => {
    assert.equal(result.ok,true, result.ok ? "" : JSON.stringify(result.refusal));
    return result.value;
  };
  const thing = need(defineType({id:"test-thing",name:"Thing",
    description:"Distinguishable source Thing.",parents:[],schema:true}));
  const resource = need(specializeType([thing],{id:"test-resource",name:"Resource",
    description:"Declared operational Resource subtype.",schema:true}));
  const ordinary = need(specializeType([thing],{id:"test-ordinary",name:"Ordinary Thing",
    description:"Not an operational Resource.",schema:true}));
  const catalog = need(createTypeSystem([thing,resource,ordinary]));
  const sourceDocument = need(typeSystemDocument(catalog));
  const wire = JSON.parse(JSON.stringify(sourceDocument));
  const received = need(admitTypeSystemDocument(wire));
  const source = getType(received,"test-resource"),
    root = getType(received,"test-thing"),
    unrelated = getType(received,"test-ordinary");
  assert.equal(isSubtypeOf(source,root),true);
  assert.equal(isSubtypeOf(unrelated,root),true);
  assert.equal(isSubtypeOf(unrelated,source),false,
    "the Resource label cannot silently specialize an unrelated Thing");
  assert.equal(need(typeSystemDocument(received)).identity,sourceDocument.identity);

  // Only a caller-presented, explicitly witnessed declaration becomes an
  // observed Cell. Neither Type/Resource membership nor an NI ID grants
  // execution, property, payment, or a physical exchange.
  const sourceId = typeIdentity(source), rootId = typeIdentity(root),
    otherId = typeIdentity(unrelated);
  const reported = cell(sourceId,"declared-subtype",rootId,{for:["source-type-declaration"]});
  const entities = [otherId,rootId,sourceId], selected = [[sourceId,rootId]];
  const fiber = predicateFiber(reported.predicate,entities,(subject,object) =>
    coincides(subject,reported.subject) && coincides(object,reported.object)
      ? valueOf(reported) : "absurd", selected);
  const local = specialization(entities,selected).pullback(fiber);
  assert.equal(local.at(sourceId,rootId),valueOf(reported));
  assert.equal(local.at(otherId,rootId),"absurd",
    "unrelated Thing is not reported as a Resource by graph geometry");

  wire.types[0].name="Forged Declaration";
  assert.equal(admitTypeSystemDocument(wire).ok,false,
    "changed metadata must not retain old NI source identity");
  assert.equal(need(typeSystemDocument(received)).identity,sourceDocument.identity,
    "external mutations cannot rewrite the already-admitted catalog");
});
