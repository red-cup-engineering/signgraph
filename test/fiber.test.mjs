import test from "node:test";
import assert from "node:assert/strict";
import { at as chuAt, chuSpace } from "@red-cup-engineering/metrologic/chu";
import { readingFamilies, fusionReading, residuumReading } from "@red-cup-engineering/computer-data-engineering-services-section/four";
import { allPairs, converse, fiberFusion, fiberResiduum, fiberLeqTruth, predicateFiber, specialization } from "../src/fiber.mjs";

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

test("sparse FOUR fibers yield complete pointwise fusion and residuation over the addressed context", () => {
  // In the native bilattice, absurd⊗absurd = active and
  // absurd⊸absurd = potential. A sparse left-hand support must not
  // hide either result on otherwise unlisted pairs.
  const entities = ["A", "B"];
  const left = predicateFiber("jurisdiction", entities, () => "potential", [["A", "B"]]);
  const right = predicateFiber("jurisdiction", ["B", "A"], () => "active", [["B", "A"]]);
  const fused = fiberFusion(left, right);
  const reversed = fiberFusion(right, left);
  const residual = fiberResiduum(left, right);
  assert.deepEqual(fused.pairs, allPairs(entities));
  assert.deepEqual(residual.pairs, allPairs(entities));
  assert.equal(fused.at("A", "A"), "active");
  assert.equal(residual.at("A", "A"), "potential");
  for (const [s, o] of allPairs(entities)) {
    assert.equal(fused.at(s, o), fusionReading(left.at(s, o), right.at(s, o)));
    assert.equal(reversed.at(s, o), fused.at(s, o), "fusion commutes despite differing source supports");
    assert.equal(residual.at(s, o), residuumReading(left.at(s, o), right.at(s, o)));
  }
  // Caller-specified restriction still selects a lawful smaller site.
  const restricted = fiberFusion(left, right, [["A", "B"]]);
  assert.deepEqual(restricted.pairs, [["A", "B"]]);
  assert.equal(restricted.at("A", "A"), "absurd");
});

test("truth-order comparison covers omitted local pairs and refuses mislabeled predicates", () => {
  const small = predicateFiber("jurisdiction", ["A", "B"], () => "absurd", [["A", "B"]]);
  const whole = predicateFiber("jurisdiction", ["A", "B"],
    (s, o) => s === "A" && o === "B" ? "absurd" : "active");
  // On (B,A), absurd ≤t active is false even though the left local
  // support hides that coordinate. A scoped query may still restrict.
  assert.equal(fiberLeqTruth(small, whole), false);
  assert.equal(fiberLeqTruth(small, whole, [["A", "B"]]), true);
  const foreignLabel = predicateFiber("sovereignty", ["A", "B"], () => "potential");
  for (const operation of [fiberFusion, fiberResiduum, fiberLeqTruth]) {
    assert.throws(() => operation(small, foreignLabel), /distinct predicate labels/);
    assert.throws(() => operation(foreignLabel, small), /distinct predicate labels/);
  }
});


test("indexed fiber reads by canonical content identities without flattening subject/object boundaries", () => {
  // Distinct coordinates may contain separator-like bytes, nested properties,
  // or reordered map keys. A string-concatenated index would be unsound.
  const a = { z: "a\\u0000b", x: 1 };
  const b = { x: 1, z: "a\\u0000b" };
  const c = "a";
  const d = "b\\u0000c";
  let reads = 0;
  const section = predicateFiber("jurisdiction", [a, c, d], (subject, object) => {
    reads += 1;
    return typeof subject === "object" && object === d ? "stable" : "potential";
  }, [[a, d], [c, d]]);
  assert.equal(reads, 2, "each present coordinate is read exactly once");
  assert.equal(section.at(b, d), "stable", "canonical object key ordering preserves identity");
  assert.equal(section.at(c, d), "potential");
  assert.equal(section.at(d, c), "absurd", "unlisted is knowledge-bottom, not false");
  assert.equal(section.at({ z: "changed", x: 1 }, d), "absurd");
  assert.deepEqual(section.pairs, [[{ x: 1, z: "a\\u0000b" }, d], [c, d]]);
  assert.equal(Object.isFrozen(section.entities[0]), true);
  assert.equal(Object.isFrozen(section.pairs[0]), true);
});

test("finite indexed predicate fiber supports repeated Chu/FCA locality readings on a whole addressed site", () => {
  // A finite tiling site can carry thousands of explicit incidences.
  // Repeated consumer reads of those cells must not scan all stored pairs.
  const N = 128, entities = Array.from({ length: N }, (_, i) => ({ tile: i, region: "A" }));
  let admitted = 0;
  const section = predicateFiber({ predicate: "meets" }, entities, (subject, object) => {
    admitted += 1;
    return subject.tile === object.tile ? "stable" :
      (subject.tile + 1) % N === object.tile ? "potential" : "absurd";
  });
  assert.equal(admitted, N * N);
  assert.equal(section.pairs.length, N * N);
  for (let i = 0; i < N * 16; i += 1) {
    const s = { region: "A", tile: i % N };
    const same = { tile: i % N, region: "A" };
    const next = { tile: (i + 1) % N, region: "A" };
    assert.equal(section.at(s, same), "stable");
    assert.equal(section.at(s, next), "potential");
  }
  assert.equal(section.at({ tile: 128, region: "A" }, entities[0]), "absurd");
  const local = predicateFiber({ predicate: "meets" }, entities, () => "stable",
    [[entities[0], entities[1]]]);
  assert.equal(local.at(entities[1], entities[0]), "absurd");
  assert.equal(fiberFusion(local, local, [[entities[0], entities[1]]]).pairs.length, 1);
});

test("typed FOUR fibers cannot be forged by copying a kind label and a callable at",()=>{
 const original=predicateFiber("territory",["a","b"],()=> "potential");
 let reads=0;
 const counterfeit=Object.freeze({kind:"signgraph.fiber",label:"territory",
   entities:["a","b"],pairs:[["a","a"]],
   at(){reads++;return "stable";}});
 for(const operation of [fiberFusion,fiberResiduum,fiberLeqTruth]){
   assert.throws(()=>operation(original,counterfeit),/original predicate fibers/u);
   assert.throws(()=>operation(counterfeit,original),/original predicate fibers/u);
 }
 assert.equal(reads,0);
 // A structured clone cannot confer construction origin by preserving fields.
 const copied={...original};
 assert.throws(()=>fiberFusion(original,copied),/original predicate fibers/u);
 const real=fiberFusion(original,original);
 assert.equal(real.kind,"signgraph.fiber");
 assert.equal(real.at("a","a"),fusionReading("potential","potential"));
});

test("predicate fiber site admission refuses executable array or pair slots",()=>{
 let reads=0;
 const entities=["a","b"];
 Object.defineProperty(entities,"0",{enumerable:true,get(){reads++;return "a"}});
 assert.throws(()=>allPairs(entities),/inert data/u);
 assert.throws(()=>predicateFiber("p",entities,()=> "potential"),/inert data/u);
 const pair=["a","b"];
 Object.defineProperty(pair,"0",{enumerable:true,get(){reads++;return "a"}});
 assert.throws(()=>predicateFiber("p",["a","b"],()=> "potential",[pair]),/inert data/u);
 const pairs=[["a","b"]];
 Object.defineProperty(pairs,"0",{enumerable:true,get(){reads++;return pair}});
 assert.throws(()=>predicateFiber("p",["a","b"],()=> "potential",pairs),/inert data/u);
 const decorated=[["a","b"]];decorated.foreign="undisclosed";
 assert.throws(()=>predicateFiber("p",["a","b"],()=> "potential",decorated),/dense undecorated/u);
 assert.equal(reads,0);
});
