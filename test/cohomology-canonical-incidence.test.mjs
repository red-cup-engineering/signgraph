import test from "node:test";
import assert from "node:assert/strict";
import { cell, coincides } from "@red-cup-engineering/signcell/cell";
import { cohomologyOfCells, cohomologyOfEdgeGraph, componentsOf } from "../src/cohomology.mjs";

// Independent deliberately slower coincidence reference. No second source
// identity enters the production implementation or its purported proof.
const reference = (cells, extra = []) => {
  const terms = [];
  const indexOf = value => {
    let i = terms.findIndex(other => coincides(value, other));
    if (i === -1) { i = terms.length; terms.push(value); }
    return i;
  };
  const endpoints = cells.map(value => [indexOf(value.subject), indexOf(value.object)]);
  for (const item of extra) indexOf(item);
  const incidence = endpoints.map(([from,to]) => {
    const row = new Array(terms.length).fill(0);
    row[from]--; row[to]++; return row;
  });
  const parent = terms.map((_,i)=>i);
  const find = i => parent[i]===i ? i : (parent[i]=find(parent[i]));
  for(const [a,b] of endpoints) parent[find(a)] = find(b);
  const roots = [...new Set(terms.map((_,i)=>find(i)))];
  const zero = roots.map(root => terms.map((_,i)=>Number(find(i)===root)));
  return {terms,incidence,zero,h0:roots.length,h1:cells.length-terms.length+roots.length};
};

test("source-directed incidence and cohomology agree with independent coincidence scans",()=>{
 const terms=[
   "one","two","three","e\u0301","é",
   {a:1,b:{q:2,z:3}},{b:{z:3,q:2},a:1},
   {bytes:new Uint8Array([0,128,255])},{bytes:new Uint8Array([0,128,255])}
 ];
 for(let size=0;size<=70;size+=7) {
   const source=Array.from({length:size},(_,i)=>cell(
     terms[(i*11+2)%terms.length],"typed-relation",terms[(i*7+5)%terms.length],
     {for:[i]}));
   // Isolated original source terms count as genuine zero-dimensional carriers.
   const extras=[{isolate:"original"},terms[0]];
   const expected=reference(source,extras),actual=cohomologyOfCells(source,extras);
   assert.deepEqual(actual.incidence,expected.incidence);
   assert.equal(actual.zeroCohomology.rank,expected.h0);
   assert.equal(actual.firstCohomology.rank,expected.h1);
   assert.deepEqual(actual.zeroCohomology.cocycleBasis,expected.zero);
   assert.equal(actual.entities.length,expected.terms.length);
   for(let i=0;i<expected.terms.length;i++)
     assert.ok(coincides(actual.entities[i],expected.terms[i]));
   assert.equal(Object.isFrozen(actual.entities),true);
   assert.ok(actual.cells.every(x=>Object.isFrozen(x)));
 }
});

test("loop, duplicate, reverse and disconnected incidence preserve H0/H1 and signed boundaries",()=>{
 const source=[
   cell("a","says","b"),cell("a","says","b"),
   cell("b","says","a"),cell("a","self","a"),
   cell("b","says","c")
 ];
 const actual=cohomologyOfCells(source,["isolated"]);
 assert.deepEqual(actual.incidence,[
   [-1,1,0,0],[-1,1,0,0],[1,-1,0,0],[0,0,0,0],[0,-1,1,0]
 ]);
 assert.equal(actual.zeroCohomology.rank,2);
 assert.equal(actual.firstCohomology.rank,3);
 assert.deepEqual(componentsOf(actual).map(x=>x.length),[3,1]);
 const reverse=cohomologyOfEdgeGraph(["a","b"],[["b","a"]]);
 assert.deepEqual(reverse.incidence,[[1,-1]]);
});

test("foreign accessor positions cannot introduce edges or execute as an incidence oracle",()=>{
 let calls=0;
 const input={predicate:"p",object:"b"};
 Object.defineProperty(input,"subject",{enumerable:true,get(){calls++;return "a";}});
 assert.throws(()=>cohomologyOfCells([input]),/inert data/u);
 const hidden={subject:"a",predicate:"p"};
 Object.defineProperty(hidden,"object",{enumerable:false,value:"b"});
 assert.throws(()=>cohomologyOfCells([hidden]),/inert data/u);
 assert.equal(calls,0);
});
