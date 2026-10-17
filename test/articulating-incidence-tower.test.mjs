import test from "node:test";
import assert from "node:assert/strict";
import {
  utterance,articulatingUtter,articulatingPair,traceOfArticulating,
} from "@red-cup-engineering/signcell/utterance";
import {
  unfoldArticulatingIncidenceTower,
} from "../src/mark-gluing.mjs";

const make=parts=>{
  let a=articulatingUtter(parts[0]);
  for(const u of parts.slice(1))a=articulatingPair(u,a);
  return a;
};
const source=(n,label=i=>"p"+i)=>make(
  Array.from({length:n},(_,i)=>utterance(label(i),"c"+i))
);

test("a native Articulating source generates a coherent, finite cellular prefix tower",()=>{
  const original=source(5);
  const before=JSON.stringify(original);
  const x=unfoldArticulatingIncidenceTower(original);
  assert.equal(x.kind,"signgraph.markGeneratedArticulatingTower.v1");
  assert.equal(x.status,"constructed");
  assert.deepEqual(x.source.finiteOrdinal,
    {kind:"finite-successor",length:5,pairMoves:4});
  assert.deepEqual(x.stages.map(s=>[s.vertices.length,s.edges.length,
    s.cohomology.h0,s.cohomology.h1,s.cohomology.treeEuler]),[
    [2,1,1,0,1],[4,3,1,0,1],[6,5,1,0,1],
    [8,7,1,0,1],[10,9,1,0,1],
  ]);
  assert.equal(x.transports.length,4);
  assert.equal(JSON.stringify(original),before);
});

test("actual Articulating successor construction has inclusion and retraction chain maps",()=>{
  const x=unfoldArticulatingIncidenceTower(source(3));
  for(const step of x.transports){
    assert.equal(step.ascending.commutesWithBoundary,true);
    assert.equal(step.descending.commutesWithBoundary,true);
    assert.equal(step.retractionAfterInclusionIsIdentity,true);
    assert.equal(step.inclusionAfterRetractionIsIdentity,false);
    assert.equal(step.descending.contractedPositions.length,2);
    assert.equal(step.ascending.vertices.length+2,step.descending.vertices.length);
    assert.equal(step.ascending.edges.length+2,step.descending.edges.length);
    for(let i=0;i<step.ascending.vertices.length;i++)
      assert.equal(step.descending.vertices[step.ascending.vertices[i]],i);
    for(let i=0;i<step.ascending.edges.length;i++)
      assert.equal(step.descending.edges[step.ascending.edges[i]],i);
    assert.deepEqual(step.descending.edges.slice(-2),[null,null]);
  }
  assert.match(x.limitLaw,/no aperiodic/);
  assert.match(x.equivalenceAuthority,/none/);
});

test("repeated equal Mark contents are different source OCCURRENCES, never a silent quotient",()=>{
  const same=utterance("same","same");
  const original=make([same,same,same]);
  const x=unfoldArticulatingIncidenceTower(original);
  assert.equal(new Set(x.source.markCarrierIds.map(row=>row.token)).size,1);
  assert.equal(x.stages.at(-1).vertices.length,6);
  assert.equal(x.stages.at(-1).edges.length,5);
  assert.equal(x.stages.at(-1).cohomology.h1,0);
  assert.equal(x.stages.at(-1).sourceRoleIncidence.boundary.position,"token");
  assert.deepEqual(traceOfArticulating(original).trace,[same,same,same]);
});

test("a Mark datum can itself be a structured Utterance without a new source primitive",()=>{
  const inside=utterance("older","claim");
  const external=utterance(inside,"fresh");
  const carrier=make([inside,external]);
  const x=unfoldArticulatingIncidenceTower(carrier);
  assert.equal(x.stages.length,2);
  assert.equal(x.stages[1].sourceRoleIncidence.boundary.mark.value.kind,"utterance.carrier");
  assert.equal(x.stages[1].cohomology.h0,1);
  assert.equal(x.stages[1].cohomology.h1,0);
});

test("foreign, cyclic and truncated sources cannot masquerade as a complete source tower",()=>{
  assert.throws(()=>unfoldArticulatingIncidenceTower({kind:"articulating.pair"}),
    /native ordered Mark roles|finite and acyclic/);
  assert.throws(()=>unfoldArticulatingIncidenceTower(source(3),{maxLayers:2}),
    /finite layer budget/);
  assert.throws(()=>unfoldArticulatingIncidenceTower(source(1),{maxLayers:0}),
    /maxLayers must be 1-16/);
  assert.throws(()=>unfoldArticulatingIncidenceTower(source(1),{unprovedIdentity:true}),
    /only its finite maxLayers/);
});
