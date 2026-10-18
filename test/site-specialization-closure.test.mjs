import test from "node:test";
import assert from "node:assert/strict";
import { coincidenceKey } from "@red-cup-engineering/signcell/cell";
import { closeSpecialization, specializationMorphism } from "../src/site.mjs";

const pairs = base => base.specialization.map(edge => [edge.domain, edge.codomain]);
const keyPair = ([a, b]) => JSON.stringify([coincidenceKey(a), coincidenceKey(b)]);

test("a two-hop original predicate specialization becomes a reachable third edge", () => {
  const a = "general", b = "special", c = "more-special";
  const direct = [specializationMorphism(b, a), specializationMorphism(c, b)];
  const base = Object.freeze({ kind: "signgraph.base", specialization: Object.freeze(direct) });
  const result = closeSpecialization(base);
  assert.equal(result.kind, base.kind);
  assert.equal(result.specialization.length, 3);
  assert.deepEqual(pairs(result), [[a, b], [b, c], [a, c]]);
  assert.equal(base.specialization.length, 2, "source is unchanged");
  assert.equal(Object.isFrozen(result.specialization), true);
  assert.equal(Object.isFrozen(result.specialization[2]), true);
});

test("cycles close to genuine reflexive paths; absent paths do not invent reflexivity", () => {
  const source = [
    specializationMorphism("b", "a"),
    specializationMorphism("a", "b"),
    specializationMorphism("other", "island"),
  ];
  const found = closeSpecialization({ specialization: source });
  const got = new Set(pairs(found).map(keyPair));
  for (const pair of [["a","a"], ["b","b"], ["a","b"], ["b","a"], ["island","other"]])
    assert.ok(got.has(keyPair(pair)), "source or derived path must remain: " + pair);
  assert.equal(got.has(keyPair(["island","island"])), false);
  assert.equal(got.has(keyPair(["other","other"])), false);
  assert.equal(got.size, found.specialization.length, "no duplicate closure edges");
});

test("canonical content coincidence does not identify unrelated terms or add source evidence", () => {
  const x = { b: [1, 2], a: "start" };
  const sameX = { a: "start", b: [1, 2] };
  const y = { a: "end", b: [2, 1] };
  const z = { a: "third", b: null };
  const original = [
    specializationMorphism(y, x),
    specializationMorphism(y, sameX),
    specializationMorphism(z, y),
  ];
  const output = closeSpecialization({ specialization: original });
  assert.equal(output.specialization.length, 3,
    "semantically coincident source arcs collapse only as graph arcs");
  assert.equal(output.specialization[0].domain, x,
    "retain original source representative, never synthesize a new Mark");
  assert.ok(new Set(output.specialization.map(e => keyPair([e.domain,e.codomain])))
    .has(keyPair([sameX, z])));
  assert.equal(original.length, 3);
});

test("reachability agrees with an independent finite matrix closure on all 512 three-node graphs", () => {
  const names = ["a", "b", "c"];
  let checked = 0;
  for (let mask = 0; mask < (1 << 9); mask++) {
    const matrix = names.map((_, i) => names.map((_, j) => Boolean(mask & (1 << (i * 3 + j)))));
    const base = { specialization: names.flatMap((from, i) =>
      names.flatMap((to, j) => matrix[i][j] ? [specializationMorphism(to, from)] : [])) };
    const result = closeSpecialization(base);
    const expected = matrix.map(row => [...row]);
    for (let mid = 0; mid < 3; mid++)
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
          expected[i][j] ||= expected[i][mid] && expected[mid][j];
    const actual = new Set(pairs(result).map(([from, to]) => from + "|" + to));
    const matching = new Set(names.flatMap((from,i)=>names.flatMap((to,j)=>
      expected[i][j] ? [from + "|" + to] : [])));
    assert.deepEqual([...actual].sort(), [...matching].sort(), "mask=" + mask);
    assert.equal(result.specialization.length, actual.size, "deduplicated mask=" + mask);
    checked++;
  }
  assert.equal(checked, 512);
});

test("a long sparse chain closes without the historical repeated all-edge rescans", () => {
  const count = 96;
  const nodes = Array.from({ length: count }, (_, i) => "predicate-" + i);
  const direct = nodes.slice(1).map((name, i) => specializationMorphism(name, nodes[i]));
  const closed = closeSpecialization({ specialization: direct });
  assert.equal(closed.specialization.length, count * (count - 1) / 2);
  assert.ok(closed.specialization.some(e => e.domain === nodes[0] && e.codomain === nodes.at(-1)));
  assert.equal(direct.length, count - 1);
});
