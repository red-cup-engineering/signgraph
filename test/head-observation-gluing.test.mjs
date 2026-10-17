import test from "node:test";
import assert from "node:assert/strict";
import {
  utterance,articulatingUtter,articulatingPair,
} from "@red-cup-engineering/signcell/utterance";
import { generateHeadObservationGluing } from "../src/mark-gluing.mjs";

const source=()=>articulatingUtter(utterance("excluding","excluded"));
const older=()=>articulatingPair(
  utterance("other","older"),source());

test("one source reattention plus a justified head-observation presentation generates the FIRST incidence cycle",()=>{
  const input={articulating:source(),steps:1};
  const old=JSON.stringify(input);
  const result=generateHeadObservationGluing(input);
  assert.equal(result.kind,"signgraph.markSourceHeadObservationGluing.v1");
  assert.equal(result.original.depth,2);
  assert.equal(result.original.vertices.length,4);
  assert.equal(result.original.edges.length,3);
  assert.equal(result.original.cohomology.h1,0);
  assert.equal(result.projected.vertices.length,3);
  assert.equal(result.projected.edges.length,3);
  assert.deepEqual(result.projected.cohomology,{h0:1,h1:1,h2:0});
  assert.deepEqual(result.identification.identifiedClaimPositions,[
    {left:"cell:0",right:"cell:1"},
  ]);
  assert.equal(result.identification.sourceProvenHeadRelations,1);
  assert.equal(result.identification.candidateQuotSoundUses,1);
  assert.equal(result.identification.identificationNerveH1,0);
  assert.equal(result.identification.justifiedLeanWits,null);
  assert.equal(result.identification.physicalDissipation,null);
  assert.equal(JSON.stringify(input),old);
});

test("two or four repeated source-only reattendings induce one NEW projected cycle per head observation",()=>{
  for(const steps of [0,2,4]){
    const result=generateHeadObservationGluing({articulating:source(),steps});
    assert.equal(result.original.cohomology.h1,0);
    assert.equal(result.projected.cohomology.h0,1);
    assert.equal(result.projected.cohomology.h1,steps);
    assert.equal(result.projected.edges.length,2*(steps+1)-1);
    assert.equal(result.projected.vertices.length,2*(steps+1)-steps);
    assert.equal(result.identification.instruments.length,steps);
    assert.equal(result.identification.independentMerges,steps);
    assert.equal(result.identification.identificationNerveH1,0);
    assert.equal(result.identification.justifiedLeanWits,null);
    assert.equal(result.projected.coboundary.zero.length,result.projected.edges.length);
  }
});

test("a prior Articulating with a different old head only quotients the NEW reattention family",()=>{
  const answer=generateHeadObservationGluing({articulating:older(),steps:2});
  assert.equal(answer.original.depth,4);
  assert.equal(answer.original.cohomology.h1,0);
  assert.equal(answer.projected.cohomology.h1,2);
  assert.deepEqual(answer.identification.identifiedClaimPositions,[
    {left:"cell:1",right:"cell:2"},{left:"cell:1",right:"cell:3"},
  ]);
  assert.notEqual(answer.originalSourceId,answer.continuedSourceId);
  assert.equal(answer.identification.justifiedLeanWits,null);
});

test("unearned independent head, extra quotient edges, impossible depth and malformed sources refuse",()=>{
  const root=source();
  assert.throws(()=>generateHeadObservationGluing({
    articulating:root,steps:1,relations:[["invented","graph-edge"]],
  }),/requires only an original Articulating/);
  assert.throws(()=>generateHeadObservationGluing({articulating:root,steps:7}),
    /zero to six/);
  assert.throws(()=>generateHeadObservationGluing({articulating:root,steps:-1}),
    /zero to six/);
  assert.throws(()=>generateHeadObservationGluing({
    articulating:{kind:"articulating.utter",utterance:"not-a-Mark"},steps:1,
  }),/native ordered Mark roles/);
  let previous=root;
  for(let i=0;i<15;i++)previous=articulatingPair(previous.utterance,previous);
  assert.throws(()=>generateHeadObservationGluing({articulating:previous,steps:1}),
    /sixteen-layer finite capacity/);
});
