import test from "node:test";
import assert from "node:assert/strict";
import {
  utterance,articulatingUtter,articulatingPair,
} from "@red-cup-engineering/signcell/utterance";
import { operations,executeOperation } from "../src/operations.mjs";
import { unfoldArticulatingIncidenceTower } from "../src/mark-gluing.mjs";

const source=()=>{
  const u=utterance("root","foundation");
  const v=utterance(u,"claim-with-recursive-Mark-datum");
  const w=utterance("third","derivation");
  return articulatingPair(w,articulatingPair(v,articulatingUtter(u)));
};
const id="signgraph.mark-incidence.articulating-tower";

test("original SignGraph operation consumes finite Articulating source with no supplied geometry",()=>{
  const carrier=source();
  const input={articulating:carrier,maxLayers:3};
  const outcome=executeOperation(id,input);
  assert.deepEqual(outcome,unfoldArticulatingIncidenceTower(carrier,{maxLayers:3}));
  assert.equal(operations.articulatingTower.id,id);
  assert.equal(outcome.stages.length,3);
  assert.deepEqual(outcome.stages.map(s=>s.cohomology),[
    {h0:1,h1:0,treeEuler:1},{h0:1,h1:0,treeEuler:1},
    {h0:1,h1:0,treeEuler:1},
  ]);
  assert.equal(outcome.transports.length,2);
  assert.equal(outcome.transports[0].descending.commutesWithBoundary,true);
});

test("original operation refuses forged geometry, incomplete source and unbounded recursion",()=>{
  const carrier=source();
  assert.throws(()=>executeOperation(id,{articulating:carrier,edges:[{from:"x",to:"y"}]}),
    /original Articulating/);
  assert.throws(()=>executeOperation(id,{articulating:carrier,maxLayers:2}),
    /finite layer budget/);
  assert.throws(()=>executeOperation(id,{articulating:carrier,maxLayers:17}),
    /1-16 finite source layers/);
  assert.throws(()=>executeOperation(id,{articulating:{kind:"articulating.utter"}}),
    /native ordered Mark roles/);
  assert.throws(()=>executeOperation(id,{articulating:{foreign:"x".repeat(70000)}}),
    /64KiB original source budget/);
});


const headQuotientOperation="signgraph.mark-incidence.observed-head-gluing";

test("original SignGraph operation constructs a source-owned head quotient with WIT/geometry distinction",()=>{
  const input={articulating:source(),steps:2};
  const result=executeOperation(headQuotientOperation,input);
  assert.equal(operations.observedHeadGluing.id,headQuotientOperation);
  assert.equal(result.kind,"signgraph.markSourceHeadObservationGluing.v1");
  assert.equal(result.original.cohomology.h1,0);
  assert.equal(result.projected.cohomology.h1,2);
  assert.equal(result.identification.candidateQuotSoundUses,2);
  assert.equal(result.identification.identificationNerveH1,0);
  assert.equal(result.identification.justifiedLeanWits,null);
  assert.equal(result.identification.physicalDissipation,null);
});

test("original source-only quotient operation refuses externally supplied geometry or false range",()=>{
  assert.throws(()=>executeOperation(headQuotientOperation,{
    articulating:source(),steps:1,nets:[],
  }),/only admits Articulating/);
  assert.throws(()=>executeOperation(headQuotientOperation,{
    articulating:source(),steps:7,
  }),/zero to six/);
  assert.throws(()=>executeOperation(headQuotientOperation,{
    articulating:source(),steps:-1,
  }),/zero to six/);
});
