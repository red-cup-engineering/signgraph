import test from "node:test";
import assert from "node:assert/strict";
import { admitCellSequence, admitTripleSequence, cell, semanticId } from "@red-cup-engineering/signcell/cell";
import { isSpecializationMorphism, site, siteGeneratorsSchema, sourceIncidenceCells, sourceIncidenceTriples, specializationMorphism } from "../src/site.mjs";

const triple = (subject = "a", predicate = "is-related-to", object = "b") =>
  ({subject, predicate, object});

test("site admits extensional cells and specializations without transporting testimony", () => {
  const source = cell("a", "is-related-to", "b", {
    for: ["source-a"], against: ["source-b"],
  });
  const edge = specializationMorphism("subrelation", "is-related-to");
  const actual = site([source, triple()], [edge]);
  const roundtrip = site(JSON.parse(JSON.stringify([source, triple()])),
    JSON.parse(JSON.stringify([edge])));
  assert.equal(actual.cells.length, 1, "same source coordinate has one extensional point");
  assert.deepEqual(actual.cells[0], triple());
  assert.deepEqual(actual.specializations, [edge]);
  assert.equal(semanticId(actual), semanticId(roundtrip),
    "inert source readmission keeps the established site content address");
  assert.equal(actual.entities.length, 2);
  assert.equal(actual.predicates.length, 1);
});

test("specialization morphism detaches nested predicate terms from caller mutation", () => {
  const source = { tier: ["general"] }, target = { tier: ["specific"] };
  const morphism = specializationMorphism(target, source);
  const accepted = site([], [morphism]);
  source.tier.push("mutated");
  target.tier[0] = "corrupted";
  assert.deepEqual(accepted.specializations[0].domain, {tier:["general"]});
  assert.deepEqual(accepted.specializations[0].codomain, {tier:["specific"]});
  assert.ok(isSpecializationMorphism(accepted.specializations[0]));
});

test("site refuses executable generator predicates and coordinates without evaluating them", () => {
  let calls = 0;
  const getter = () => { calls++; throw new Error("executed caller code"); };
  const withKindGetter = triple();
  Object.defineProperty(withKindGetter, "kind", {enumerable:true, get:getter});
  const withCoordinateGetter = triple();
  Object.defineProperty(withCoordinateGetter, "subject", {enumerable:true, get:getter});
  const withMorphismGetter = {kind:"signgraph.specialization", codomain:"specific"};
  Object.defineProperty(withMorphismGetter, "domain", {enumerable:true, get:getter});
  for (const input of [withKindGetter, withCoordinateGetter, withMorphismGetter]) {
    assert.throws(() => site([input]), /signgraph site:|signcell:/);
  }
  assert.equal(calls, 0);
});

test("site refuses executable element positions in source arrays and evidence", () => {
  let calls = 0;
  const getter = () => { calls++; throw new Error("executed source getter"); };
  const input = [triple()];
  Object.defineProperty(input, 0, {enumerable:true, get:getter});
  assert.throws(() => site(input), /signgraph site:/);
  const evidence = cell("a", "p", "b", {for:["source"]});
  const forged = {...evidence, for: ["ok"]};
  Object.defineProperty(forged.for, 0, {enumerable:true, get:getter});
  assert.throws(() => site([forged]), /signcell:/);
  const decorated = [triple()];
  decorated.extra = "unsourced";
  assert.throws(() => site(decorated), /signgraph site:/);
  const sparse = Array(2);
  sparse[0] = triple();
  assert.throws(() => site(sparse), /signgraph site:/);
  assert.equal(calls, 0);
});

test("foreign generator shapes never become supported cells or morphisms", () => {
  const strange = [
    {...triple(), kind:"foreign"},
    {...triple(), extra:"hidden"},
    {subject:"a", predicate:"p"},
    {...triple(), for:[]},
    {...triple(), for:[], against:"not-an-array"},
    {kind:"signgraph.specialization",domain:"general",codomain:"specific",extra:"hidden"},
  ];
  for (const source of strange)
    assert.throws(() => site([source]), /signgraph site:|signcell:/);
  assert.equal(isSpecializationMorphism({
    kind:"signgraph.specialization",domain:"a",codomain:"b",unexpected:true}), false);
  const inherited = Object.create({subject:"stolen"});
  Object.assign(inherited, {predicate:"p",object:"b"});
  assert.throws(() => site([inherited]), /signcell:/);
});

test("empty site and mixed-list generator forms retain their historical interpretation", () => {
  assert.equal(site([]).cells.length, 0);
  const edge = specializationMorphism("specific", "general");
  const left = site([triple(), edge]);
  const right = site([triple()], [edge]);
  assert.equal(semanticId(left), semanticId(right));
  assert.equal(left.specializations.length, 1);
});

test("published generator schema and original source admission agree on the finite budget", () => {
  assert.equal(siteGeneratorsSchema.properties.cells.maxItems, 16384);
  assert.equal(siteGeneratorsSchema.properties.specializations.maxItems, 16384);
  const overBudget = Array.from({length: 16385}, () => triple());
  assert.throws(() => site(overBudget), /bounded plain source array/);
  assert.throws(() => site([], overBudget), /bounded plain source array/);
  assert.equal(siteGeneratorsSchema.additionalProperties, false,
    "generator documents cannot introduce undocumented runtime authority");
});

test("Graph receives ordered Cell sources from the original supplier without a second admission owner", () => {
  assert.equal(sourceIncidenceCells, admitCellSequence);
  assert.equal(sourceIncidenceTriples, admitTripleSequence);
  const source = cell(new Uint8Array([1, 2]), "reports", "target", {
    for: ["support"], against: ["opposition"], value: "absurd",
  });
  const accepted = site([source, source]);
  assert.equal(sourceIncidenceCells([source, source]).length, 2,
    "ordered source positions precede the site's explicit extensional quotient");
  assert.equal(accepted.cells.length, 1);
  assert.deepEqual(accepted.cells[0].subject, new Uint8Array([1, 2]));
  assert.ok(!Object.hasOwn(accepted.cells[0], "for"),
    "the topology is still a projection, never invented source testimony");
  assert.deepEqual(source.for, ["support"]);
  assert.deepEqual(source.against, ["opposition"]);
  assert.equal(source.value, "absurd");
});
