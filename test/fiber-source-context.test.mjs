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
