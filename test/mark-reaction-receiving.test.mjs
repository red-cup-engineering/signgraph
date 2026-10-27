import test from "node:test";
import assert from "node:assert/strict";
import { mark } from "@red-cup-engineering/signcell/mark";
import {
  utterance, articulatingUtter, articulatingPair
} from "@red-cup-engineering/signcell/utterance";
import { cell } from "@red-cup-engineering/signcell/cell";
import {
  selectSourceMarkReactions, receiveSourceMarkReactions
} from "../src/substitution-spectrum.mjs";

const a=mark("a"),b=mark("b"),c=mark("c");
const predicate="urn:561:test:source-mark-product-acceptance/v1";
const source=()=>articulatingPair(
  utterance(b,[b,b]),
  articulatingUtter(utterance(a,[a,a]))
);
const request=()=>({
  articulating:source(),seed:[a,b],target:[a,a,b,b],
  maxReactions:2,maxCandidates:64,maxWordLength:8,
  acceptancePredicate:predicate
});
const withReceipts=(reports,params={})=>
  receiveSourceMarkReactions({...request(),...params,receipts:reports});
const winningPaths=()=>selectSourceMarkReactions({
  articulating:source(),seed:[a,b],target:[a,a,b,b],
  maxReactions:2,maxCandidates:64,maxWordLength:8
}).selected;
const report=(winner,ev={})=>cell(
  winner.pathAddress,predicate,winner.wordAddress,ev
);

test("one source-target word has two independent REACTION PATHS, each with its own FOUR receiving",()=>{
  const [first,second]=winningPaths();
  assert.equal(first.wordAddress,second.wordAddress);
  assert.notEqual(first.pathAddress,second.pathAddress);
  const result=withReceipts([
    report(first,{for:["receiver-A"]}),
    report(second,{against:["receiver-B"]})
  ]);
  assert.equal(result.kind,"signgraph.sourceMarkReactionReceiving/v1");
  assert.equal(result.status,"has-reported-support");
  assert.equal(result.selection.status,"selected");
  assert.equal(result.selection.minimalSourceReactions,2);
  assert.deepEqual(result.evaluations.map(x=>x.reading),["potential","active"]);
  assert.deepEqual(result.evaluations.map(x=>x.status),["supported","opposed"]);
  assert.notEqual(result.evaluations[0].pathAddress,result.evaluations[1].pathAddress);
  assert.equal(result.evaluations[0].wordAddress,result.evaluations[1].wordAddress);
  assert.deepEqual(result.evaluations[0].observations[0].for,["receiver-A"]);
  assert.deepEqual(result.evaluations[1].observations[0].against,["receiver-B"]);
  assert.equal(result.selection.projectionCollisions.some(x=>
    x.wordAddress===first.wordAddress&&x.pathAddresses.length===2),true);
});

test("missing evidence is unobserved, while contradictory evidence remains contested",()=>{
  const [first,second]=winningPaths();
  const unknown=withReceipts([]);
  assert.equal(unknown.status,"unobserved");
  assert.deepEqual(unknown.evaluations.map(e=>e.record),[
    {pos:0,neg:0},{pos:0,neg:0}
  ]);
  const both=withReceipts([
    report(first,{for:["yes"],against:["no"]}),
    report(second)
  ]);
  assert.equal(both.status,"contested");
  assert.deepEqual(both.evaluations.map(e=>e.status),["contested","unobserved"]);
  assert.deepEqual(both.evaluations[0].record,{pos:1,neg:1});
  const refused=withReceipts([
    report(first,{against:["lab-1"]}),
    report(second,{against:["lab-2"]})
  ]);
  assert.equal(refused.status,"opposed");
});

test("merging two reports at SAME source path preserves both sides and deduplicates identical witnesses",()=>{
  const [first]=winningPaths();
  const reportPair=[
    report(first,{for:["A","A"]}),
    report(first,{against:["B"]}),
    report(first,{for:["A","C"]})
  ];
  const res=withReceipts(reportPair);
  const entry=res.evaluations[0];
  assert.equal(entry.status,"contested");
  assert.equal(entry.reading,"stable");
  assert.deepEqual(entry.record,{pos:2,neg:1});
  assert.equal(entry.observations.length,3,
    "individual source report presentations remain available");
  assert.deepEqual(entry.evidence.for,["A","C"]);
  assert.deepEqual(entry.evidence.against,["B"]);
  assert.equal(res.evaluations[1].status,"unobserved");
});

test("four-valued two-path receiving has 16 complete truth states without Boolean flattening",()=>{
  const [first,second]=winningPaths();
  const readings=[
    ["absurd",{}],
    ["potential",{for:["A"]}],
    ["active",{against:["B"]}],
    ["stable",{for:["A"],against:["B"]}]
  ];
  let checked=0;
  for(const [aValue,aEv] of readings)for(const [bValue,bEv] of readings){
    const res=withReceipts([report(first,aEv),report(second,bEv)]);
    assert.deepEqual(res.evaluations.map(x=>x.reading),[aValue,bValue]);
    const expected=aValue==="potential"||bValue==="potential"?"has-reported-support"
      :aValue==="stable"||bValue==="stable"?"contested"
      :aValue==="active"&&bValue==="active"?"opposed":"unobserved";
    assert.equal(res.status,expected);
    checked++;
  }
  assert.equal(checked,16);
});

test("false syntactic path, foreign word, predicate and posited override cannot obtain a receiving verdict",()=>{
  const [winner]=winningPaths();
  const violations=[
    cell("not-a-path",predicate,winner.wordAddress,{for:["A"]}),
    cell(winner.pathAddress,predicate,"foreign-word",{for:["A"]}),
    cell(winner.pathAddress,"foreign-predicate",winner.wordAddress,{for:["A"]}),
    report(winner,{for:["A"],value:"active"}),
    report(winner,{value:"potential"})
  ];
  for(const sourceReport of violations) {
    assert.throws(()=>withReceipts([sourceReport]),/foreign|measured/i);
  }
  assert.throws(()=>withReceipts([{subject:winner.pathAddress,other:"not a cell"}]));
  assert.throws(()=>withReceipts(new Array(1025).fill(report(winner,{for:["A"]}))),/0..1024/);
});

test("reaction enumeration incomplete means unproved reachability regardless of an alleged receipt",()=>{
  const args={maxCandidates:2};
  const res=withReceipts([] ,args);
  assert.equal(res.selection.status,"candidate-capacity-obstructed");
  assert.equal(res.status,"search-obstructed");
  assert.deepEqual(res.evaluations,[]);
  const [other]=winningPaths();
  assert.throws(()=>withReceipts([report(other,{for:["A"]})],args),/non-selected/);
});

test("no source or invented rule can be admitted by the receipt path",()=>{
  assert.throws(()=>withReceipts([], {articulating:[
    utterance(a,[a]),utterance(b,[b])
  ]}),/genuine Articulating/);
  assert.throws(()=>withReceipts([],{seed:[c]}),/no original source rule/);
  assert.throws(()=>receiveSourceMarkReactions({...request(),fabricatedPhysicalEnergy:1}),
    /native reaction inputs/);
  assert.throws(()=>receiveSourceMarkReactions({...request(),acceptancePredicate:""}),
    /nonempty acceptance predicate/);
});

test("unopposed source reports never become physical outputs or independent ACK claims",()=>{
  const [winner]=winningPaths();
  const result=withReceipts([report(winner,{for:["reporter"]})]);
  assert.equal(result.status,"has-reported-support");
  assert.equal(Object.hasOwn(result,"joules"),false);
  assert.equal(Object.hasOwn(result,"physicalDevice"),false);
  assert.equal(Object.hasOwn(result,"authenticatedActor"),false);
  assert.match(result.scope,/never imply physical reaction/);
  assert.equal(result.evaluations[0].record.pos,1);
});
