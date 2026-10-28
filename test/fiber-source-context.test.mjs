import test from "node:test";
import assert from "node:assert/strict";
import {
  converse, fiberLeqTruth, knowledgeOrder, predicateFiber, specialization, truthOrder,
} from "../src/fiber.mjs";

test("truth comparisons refuse undeclared coordinates, not equal implicit unknowns", () => {
  const fiber = predicateFiber("attested", ["a", "b"], () => "absurd");
  assert.equal(fiberLeqTruth(fiber, fiber, [["a", "b"]]), true);
  for (const foreign of [[["outside", "outside"]], [["a", "outside"]], [["outside", "b"]]]) {
    assert.throws(() => fiberLeqTruth(fiber, fiber, foreign), /comparison pair lies outside declared entity context/);
  }
  // Validate all requested coordinates before reporting a purported success.
  assert.throws(() => fiberLeqTruth(fiber, fiber, [["a", "b"], ["a", "outside"]]),
    /comparison pair lies outside declared entity context/);
});

test("finite graph generators bind a source context, not just overlapping pairs", () => {
  const gen = specialization(["a", "b", "c"], [["a", "b"]], [["a", "b"]]);
  const valid = predicateFiber("attested", ["c", "a", "b"], () => "active", [["a", "b"]]);
  assert.equal(gen.pullback(valid).at("a", "b"), "active", "permuted same context is lawful");
  assert.equal(gen.exists(knowledgeOrder(), valid).at("a", "b"), "active");
  assert.equal(gen.forall(truthOrder(), valid).at("a", "b"), "active");

  const foreign = predicateFiber("attested", ["a", "b", "d"], () => "active", [["a", "b"]]);
  for (const evaluate of [
    () => gen.pullback(foreign),
    () => gen.exists(knowledgeOrder(), foreign),
    () => gen.forall(truthOrder(), foreign),
  ]) assert.throws(evaluate, /fiber entity context differs from declared generator context/);
});

test("a strict-subset generator must reject wider admitted sites", () => {
  const gen = converse(["a", "b"]);
  const wider = predicateFiber("attested", ["a", "b", "c"], () => "stable");
  for (const evaluate of [
    () => gen.pullback(wider),
    () => gen.exists(knowledgeOrder(), wider),
    () => gen.forall(knowledgeOrder(), wider),
  ]) assert.throws(evaluate, /fiber entity context differs from declared generator context/);
});

test("finite generator source, target and images are qualified at construction", () => {
  const entities = ["a", "b"];
  const cases = [
    { name: "foreign source", run: () => specialization(entities, [["foreign", "b"]]),
      error: /source site pair outside declared entity context/ },
    { name: "foreign target", run: () => specialization(entities, [["a", "b"]],
      [["foreign", "b"], ["a", "b"]]),
      error: /target site pair outside declared entity context/ },
    { name: "missing target image", run: () => specialization(entities, [["a", "b"]], [["a", "a"]]),
      error: /source image absent from target site/ },
  ];
  for (const scenario of cases) assert.throws(scenario.run, scenario.error, scenario.name);
  const empty = specialization(entities, []);
  assert.equal(empty.codomain.length, 0, "a genuine empty local site is legitimate");
  const valid = specialization(["b", "a"], [["a", "b"]], [["a", "b"]]);
  assert.deepEqual(valid.codomain, [["a", "b"]]);
  assert.deepEqual(valid.domain, [["a", "b"]]);
});

test("finite generators require unique content-identified source entities", () => {
  const entities = [{ a: 1, b: 2 }, { b: 2, a: 1 }];
  assert.throws(() => specialization(entities, []), /duplicate entity identity/);
});
