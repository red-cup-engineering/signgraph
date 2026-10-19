import test from "node:test";
import assert from "node:assert/strict";
import {
  utterance,articulatingUtter,articulatingPair,
} from "@red-cup-engineering/signcell/utterance";
import { generateHeadObservationGluing, derivePerformedObservationRoutes, composePerformedObservationRoutes } from "../src/mark-gluing.mjs";

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


test("coincident old Mark contents are NOT silently glued: only the actual newly generated head relation is used",()=>{
  const repeated=utterance("same","same");
  const sourceAct=articulatingPair(repeated,articulatingUtter(repeated));
  const result=generateHeadObservationGluing({articulating:sourceAct,steps:1});
  assert.equal(result.original.depth,3);
  assert.equal(result.identification.candidateQuotSoundUses,1);
  assert.deepEqual(result.identification.identifiedClaimPositions,[
    {left:"cell:1",right:"cell:2"},
  ]);
  assert.ok(result.projected.vertices.includes("cell:0"),
    "earlier identical content must keep its independent original occurrence");
  assert.ok(result.projected.vertices.includes("cell:1"));
  assert.equal(result.projected.cohomology.h1,1);
  assert.equal(result.identification.identificationNerveH1,0);
  assert.equal(result.identification.justifiedLeanWits,null);
});



test("composition and identities are consequences of performed head-re-attending, not caller-given arrows",()=>{
  const g=derivePerformedObservationRoutes({articulating:source(),steps:3});
  assert.equal(g.kind,"signgraph.generatedPerformedObservationRoutes/v1");
  assert.equal(g.nodes.length,4);
  assert.equal(new Set(g.nodes).size,4);
  assert.equal(g.edges.length,3);
  assert.equal(g.paths.length,10,"only contiguous paths of the native chain are generated");
  const p=(i,j)=>g.paths.find(x=>x.first===i&&x.last===j);
  assert(g.nodes.every((id,i)=>p(i,i).from===id&&p(i,i).to===id));
  assert.equal(composePerformedObservationRoutes(g,p(0,0),p(0,3)),p(0,3));
  assert.equal(composePerformedObservationRoutes(g,p(0,3),p(3,3)),p(0,3));
  assert.equal(composePerformedObservationRoutes(g,p(0,1),p(1,2)),p(0,2));
  const left=composePerformedObservationRoutes(g,
    composePerformedObservationRoutes(g,p(0,1),p(1,2)),p(2,3));
  const right=composePerformedObservationRoutes(g,
    p(0,1),composePerformedObservationRoutes(g,p(1,2),p(2,3)));
  assert.equal(left,right,"associativity is read from the actual generated sequence");
  assert.equal(left.address,p(0,3).address);
  assert.equal(g.observationalQuotient.justifiedLeanWits,null);
  assert.match(g.observationalQuotient.status,/pending native Lean/);
  assert(Object.isFrozen(g));
  assert(Object.isFrozen(g.edges[0]));
});

test("a source with zero re-attending generates only its own neutral path",()=>{
  const g=derivePerformedObservationRoutes({articulating:source(),steps:0});
  assert.deepEqual(g.edges,[]);
  assert.equal(g.nodes.length,1);
  assert.equal(g.paths.length,1);
  assert.equal(composePerformedObservationRoutes(g,g.paths[0],g.paths[0]),g.paths[0]);
  assert.equal(g.originalSourceId,g.continuedSourceId);
});

test("source-distinct performances survive coincident Mark head projections",()=>{
  const repeated=utterance("same","same");
  const a=articulatingPair(repeated,articulatingUtter(repeated));
  const g=derivePerformedObservationRoutes({articulating:a,steps:2});
  assert.equal(g.nodes.length,3);
  assert.equal(new Set(g.nodes).size,3);
  assert.notEqual(g.edges[0].address,g.edges[1].address);
  assert.equal(g.paths.filter(path=>path.first===path.last).length,3);
  assert.equal(g.observationalQuotient.candidateQuotSoundUses,2);
  assert.equal(g.observationalQuotient.justifiedLeanWits,null);
});

test("forged, reserialized or noncontiguous paths never manufacture new source movements",()=>{
  const g=derivePerformedObservationRoutes({articulating:source(),steps:3});
  const p=(i,j)=>g.paths.find(x=>x.first===i&&x.last===j);
  assert.throws(()=>composePerformedObservationRoutes(g,{...p(0,1)},p(1,2)),
    /original generated observation routes/);
  assert.throws(()=>composePerformedObservationRoutes({...g},p(0,1),p(1,2)),
    /original generated observation routes/);
  assert.throws(()=>composePerformedObservationRoutes(g,p(0,1),p(2,3)),
    /not composable/);
  assert.throws(()=>derivePerformedObservationRoutes({
    articulating:source(),steps:1,contexts:["actual"],morphisms:[["invented","edge"]],
  }),/requires only an original Articulating/);
});
