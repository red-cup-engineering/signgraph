import test from "node:test";
import assert from "node:assert/strict";
import { samePoint } from "@red-cup-engineering/computer-data-engineering-services-section/four";
import { orderOps } from "@red-cup-engineering/metrologic/hyperdoctrine/order";
import {
  allPairs, converse, knowledgeOrder, objectProjection, predicateFiber,
  specialization, subjectProjection, truthOrder,
} from "../src/fiber.mjs";

const entities = ["a", "b", "c"];
const points = ["absurd", "potential", "active", "stable"];
const rank = new Map(entities.map((entity, at) => [entity, at]));
const reading = (s, o, offset = 0) => points[(rank.get(s) * 3 + rank.get(o) + offset) % points.length];
const ambient = () => predicateFiber("attested", entities, (s, o) => reading(s, o));
const local = () => predicateFiber("attested", entities, (s, o) => reading(s, o, 1), [["a", "b"], ["b", "a"], ["b", "c"]]);
const scenarios = [
  { name: "converse", make: () => converse(entities), image: ([s, o]) => [o, s] },
  { name: "subject", make: () => subjectProjection(entities), image: ([s]) => [s, s] },
  { name: "object", make: () => objectProjection(entities), image: ([, o]) => [o, o] },
  { name: "specialization", make: () => specialization(entities, [["a", "b"], ["b", "c"]]), image: (pair) => pair },
];
const at = (fiber, pair) => fiber.at(pair[0], pair[1]);
const equal = (a, b) => samePoint(a, b);
const leq = (order, x, y, pairs) => pairs.every((pair) => equal(order.join(at(x, pair), at(y, pair)), at(y, pair)));

test("all finite graph generators transport FOUR along Metrologic adjoints at both orders", () => {
  const alpha = ambient(), beta = local();
  for (const scenario of scenarios) {
    const gen = scenario.make();
    const pulled = gen.pullback(alpha);
    for (const pair of gen.codomain)
      assert.ok(equal(at(pulled, pair), at(alpha, scenario.image(pair))), scenario.name + " pullback");

    for (const order of [knowledgeOrder(), truthOrder()]) {
      const exists = gen.exists(order, beta), forall = gen.forall(order, beta);
      for (const target of gen.domain) {
        const preimage = gen.codomain.filter((pair) =>
          pair[0] === undefined ? false : scenario.image(pair).every((term, position) => term === target[position]));
        const expectedExists = preimage.map((pair) => at(beta, pair)).reduce(order.join, order.bottom);
        const expectedForall = preimage.map((pair) => at(beta, pair)).reduce(order.meet, order.top);
        assert.ok(equal(at(exists, target), expectedExists), scenario.name + " existential " + order.name + " " + target);
        assert.ok(equal(at(forall, target), expectedForall), scenario.name + " universal " + order.name + " " + target);
      }
      assert.equal(leq(order, gen.exists(order, beta), alpha, gen.domain),
        leq(order, beta, gen.pullback(alpha), gen.codomain), scenario.name + " left adjunction");
      assert.equal(leq(order, alpha, gen.forall(order, beta), gen.domain),
        leq(order, gen.pullback(alpha), beta, gen.codomain), scenario.name + " right adjunction");
    }
  }
});

test("specialization refuses repeated or foreign SCA pairs instead of inventing a gluing", () => {
  const source = ambient();
  assert.throws(() => specialization(entities, [["a", "b"], ["a", "b"]]), /site cannot repeat a pair/);
  assert.throws(() => specialization(entities, [["unknown", "b"]]).pullback(source),
    /not in target/);
});

test("empty projection preimages are knowledge-unknown and truth-extremal, never testimonies", () => {
  const gen = subjectProjection(entities), source = local();
  for (const order of [knowledgeOrder(), truthOrder()]) {
    const existential = gen.exists(order, source);
    const universal = gen.forall(order, source);
    for (const [s, o] of allPairs(entities)) {
      if (s === o) continue;
      assert.ok(equal(existential.at(s, o), order.bottom));
      assert.ok(equal(universal.at(s, o), order.top));
    }
  }
});

test("SignGraph's orders are exact views of Metrologic's FOUR order operations", () => {
  for (const [name, select] of [["knowledge", knowledgeOrder], ["truth", truthOrder]]) {
    const actual = select(), upstream = orderOps(name);
    assert.equal(actual.kind, "signgraph.order");
    assert.equal(actual.name, name);
    for (const a of points) for (const b of points) {
      assert.ok(equal(actual.join(a, b), upstream.join(a, b)));
      assert.ok(equal(actual.meet(a, b), upstream.meet(a, b)));
    }
    assert.ok(equal(actual.bottom, upstream.bottom));
    assert.ok(equal(actual.top, upstream.top));
  }
});
