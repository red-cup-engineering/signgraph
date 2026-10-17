import test from "node:test";
import assert from "node:assert/strict";
import { mark } from "@red-cup-engineering/signcell/mark";
import { utterance } from "@red-cup-engineering/signcell/utterance";
import { spectrumOfMarkSubstitution } from "../src/substitution-spectrum.mjs";

const a=mark("a"),b=mark("b"),c=mark("c");
const fib=()=>[
  utterance(a,[a,b]),utterance(b,[a]),
];
const padovan=()=>[
  utterance(a,[b]),utterance(b,[c]),utterance(c,[a,b]),
];
const tribonacci=()=>[
  utterance(a,[a,b]),utterance(b,[a,c]),utterance(c,[a]),
];

test("Fibonacci follows its actual Mark-word substitution, not an assumed growth number",()=>{
  const result=spectrumOfMarkSubstitution(fib());
  assert.equal(result.status,"derived");
  assert.equal(result.substitution.alphabetSize,2);
  assert.deepEqual(result.substitution.matrix,[[1,1],[1,0]]);
  assert.deepEqual(result.substitution.characteristicPolynomialDescending,[1,-1,-1]);
  assert.equal(result.substitution.polynomialDegree,2);
  assert.equal(result.chu.r.length,4);
});

test("Padovan and Tribonacci are different source relations despite both having three letters",()=>{
  const pad=spectrumOfMarkSubstitution(padovan());
  const trib=spectrumOfMarkSubstitution(tribonacci());
  assert.equal(pad.substitution.alphabetSize,3);
  assert.equal(trib.substitution.alphabetSize,3);
  assert.deepEqual(pad.substitution.matrix,[[0,1,0],[0,0,1],[1,1,0]]);
  assert.deepEqual(trib.substitution.matrix,[[1,1,0],[1,0,1],[1,0,0]]);
  assert.deepEqual(pad.substitution.characteristicPolynomialDescending,[1,0,-1,-1]);
  assert.deepEqual(trib.substitution.characteristicPolynomialDescending,[1,-1,-1,-1]);
  assert.notDeepEqual(pad.substitution.matrix,trib.substitution.matrix);
  assert.notDeepEqual(pad.chu.r,trib.chu.r);
  assert.match(pad.scope,/no minimal-polynomial, Pisot, transfinite/);
});

test("FOUR positive-incidence is a lossy shadow, never the substitution's whole word",()=>{
  const u=[
    utterance(a,[a,b,a]),
    utterance(b,[b]),
  ];
  const actual=spectrumOfMarkSubstitution(u);
  assert.deepEqual(actual.substitution.matrix,[[2,1],[0,1]]);
  assert.deepEqual(actual.substitution.characteristicPolynomialDescending,[1,-3,2]);
  assert.deepEqual(actual.informationLoss.multipleSymbolEntries,[{i:0,j:0,count:2}]);
  assert.equal(actual.chu.r[0].reading,"potential");
  assert.equal(actual.chu.r[1].reading,"potential");
  const permuted=spectrumOfMarkSubstitution([utterance(a,[a,a,b]),utterance(b,[b])]);
  assert.deepEqual(actual.substitution.matrix,permuted.substitution.matrix);
  assert.notDeepEqual(actual.source.utteranceIds,permuted.source.utteranceIds,
    "word order survives in the source even after abelianization loses it");
});

test("foreign Mark claims and duplicate alphabet presentations cannot silently form a typed rule",()=>{
  assert.throws(()=>spectrumOfMarkSubstitution([utterance(a,[c])]),/known original Mark/);
  assert.throws(()=>spectrumOfMarkSubstitution([utterance(a,[a]),utterance(a,[a])]),/duplicate original presentations/);
  assert.throws(()=>spectrumOfMarkSubstitution([utterance(a,["a"])]),/known original Mark/);
  assert.throws(()=>spectrumOfMarkSubstitution([{token:"a",claim:"b"}]),/original SignCell Utterance/);
});

test("the original source is retained without assigning physical dimensions or aperiodicity",()=>{
  const source=padovan();
  const prior=JSON.stringify(source);
  const built=spectrumOfMarkSubstitution(source);
  assert.equal(JSON.stringify(source),prior);
  assert.equal(built.source.utteranceIds.length,3);
  assert.equal(built.source.alphabetMarkIds.length,3);
  assert.equal(built.informationLoss.claim.includes("word order"),true);
  assert.equal(Object.hasOwn(built,"eigenvalues"),false);
  assert.equal(Object.hasOwn(built,"closureRegime"),false);
  assert.equal(Object.hasOwn(built,"cohomologyRank"),false);
});
