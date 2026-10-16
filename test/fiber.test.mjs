import test from "node:test";
import assert from "node:assert/strict";
import { at as chuAt, chuSpace } from "@red-cup-engineering/metrologic/chu";
import { readingFamilies } from "@red-cup-engineering/computer-data-engineering-services-section/four";
import { converse, fiberFusion, fiberResiduum, fiberLeqTruth, predicateFiber, specialization } from "../src/fiber.mjs";

test("a predicate fiber owns its addressed context, independent of mutable source references", () => {
  const s = { id: "s" }, o = { id: "o" }, label = { p: "links" }, entities = [s, o], pairs = [[s, o]];
  const fiber = predicateFiber(label, entities, () => "potential", pairs);
  s.id = "changed"; o.id = "changed"; label.p = "changed"; pairs[0][0] = o; entities.push("unexpected");
  assert.equal(fiber.at({ id: "s" }, { id: "o" }), "potential");
  assert.equal(fiber.at({ id: "changed" }, { id: "o" }), "absurd");
  assert.equal(fiber.label.p, "links");
  assert.equal(fiber.entities.length, 2);
  assert.deepEqual(fiber.pairs[0], [{ id: "s" }, { id: "o" }]);
  assert.equal(Object.isFrozen(fiber.pairs[0]), true);
  assert.equal(Object.isFrozen(fiber.entities[0]), true);
});

test("duplicate and out-of-context source pairs refuse instead of first-wins false gluing", () => {
  const a = { a: 1, b: 2 }, equivalent = { b: 2, a: 1 };
  assert.throws(() => predicateFiber("p", [a, equivalent], () => "potential"), /duplicate entity identity/);
  assert.throws(() => predicateFiber("p", [a, "o"], () => "potential", [[a, "o"], [equivalent, "o"]]), /duplicate subject\/object pair/);
  assert.throws(() => predicateFiber("p", ["s", "o"], () => "potential", [["missing", "o"]]), /outside its declared entity context/);
  assert.throws(() => predicateFiber("p", ["s", "o"], () => "unrecognized", [["s", "o"]]), /FOUR value/);
  assert.equal(predicateFiber("p", ["s"], () => undefined, [["s", "s"]]).at("s", "s"), "absurd");
});

test("finite FOUR fiber preserves both Chu incidence coordinates and local restrictions", () => {
  const entities = ["a", "b"], corners = readingFamilies.knowledge;
  const read = (s, o) => corners[entities.indexOf(s) * 2 + entities.indexOf(o)];
  const fiber = predicateFiber("reports", entities, read), space = chuSpace(entities, entities, read);
  for (const s of entities) for (const o of entities) assert.equal(fiber.at(s, o), chuAt(space, s, o));
  assert.deepEqual(entities.flatMap(s => entities.map(o => fiber.at(s, o))), corners);
  assert.equal(converse(entities).pullback(fiber).at("b", "a"), fiber.at("a", "b"));
  const local = specialization(entities, [["a", "b"]]).pullback(fiber);
  assert.deepEqual(local.pairs, [["a", "b"]]);
  assert.equal(local.at("a", "b"), "potential");
  assert.equal(local.at("b", "a"), "absurd");
});

test("cellwise FOUR operations refuse foreign entity contexts while retaining sparse unknowns", () => {
  // An identical-looking claim in a different territory cannot silently
  // enter this fiber by treating absent subject/object pairs as unknown.
  const local = predicateFiber("jurisdiction", ["A", "B"], () => "potential");
  const foreign = predicateFiber("jurisdiction", ["A", "C"], () => "active");
  for (const operation of [fiberFusion, fiberResiduum, fiberLeqTruth]) {
    assert.throws(() => operation(local, foreign), /distinct entity contexts cannot compose/);
    assert.throws(() => operation(foreign, local), /distinct entity contexts cannot compose/);
  }
  // No positional coercion: a lawful permutation of the same addressed
  // domain is compatible, including in an order comparison.
  const reindexed = predicateFiber("jurisdiction", ["B", "A"], () => "active");
  assert.equal(fiberFusion(local, reindexed).kind, "signgraph.fiber");
  assert.equal(fiberResiduum(local, reindexed).kind, "signgraph.fiber");
  assert.equal(typeof fiberLeqTruth(local, reindexed), "boolean");

  // A sparse support within the SAME context remains lawful; unlisted pairs
  // still mean ⊥ₖ rather than false testimony or a fabricated witness.
  const sparse = predicateFiber("jurisdiction", ["A", "B"], () => "active", [["A", "B"]]);
  assert.equal(sparse.at("B", "A"), "absurd");
  assert.equal(fiberFusion(local, sparse).kind, "signgraph.fiber");
  assert.equal(fiberResiduum(local, sparse).kind, "signgraph.fiber");
  assert.equal(typeof fiberLeqTruth(local, sparse), "boolean");
  assert.throws(() => fiberFusion(local, {}), /two predicate fibers are required/);
});
