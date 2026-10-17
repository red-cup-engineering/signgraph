import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
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

test("source-only geometry is an available bounded JSONL operation in the EXISTING holonomy runner",()=>{
  const command=fileURLToPath(new URL("../scripts/holonomy.mjs",import.meta.url));
  const request=JSON.stringify({operation:id,input:{articulating:source(),maxLayers:3}});
  const run=spawnSync(process.execPath,[command],{
    input:request+"\n",encoding:"utf8",maxBuffer:1024*1024,
  });
  assert.equal(run.status,0,run.stderr);
  const line=JSON.parse(run.stdout.trim());
  assert.equal(line.ok,true);
  assert.equal(line.operation,id);
  assert.equal(line.receipt.kind,"signgraph.markGeneratedArticulatingTower.v1");
  assert.deepEqual(line.receipt.stages.map(x=>x.cohomology.h1),[0,0,0]);
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
