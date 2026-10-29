import test from "node:test";
import assert from "node:assert/strict";
import { cell, coincides } from "@red-cup-engineering/signcell/cell";
import { cohomologyOfCells, cohomologyOfEdgeGraph, componentsOf, MAX_COHOMOLOGY_DENSE_SLOTS } from "../src/cohomology.mjs";
import { flowNetworkOfCells } from "../src/cell-graph.mjs";

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
 assert.deepEqual(reverse.incidence,[[-1,1]]);
});

test("foreign accessor positions cannot introduce edges or execute as an incidence oracle",()=>{
 let calls=0;
 const input={predicate:"p",object:"b"};
 Object.defineProperty(input,"subject",{enumerable:true,get(){calls++;return "a";}});
 assert.throws(()=>cohomologyOfCells([input]),/inert (?:own )?data/u);
 const hidden={subject:"a",predicate:"p"};
 Object.defineProperty(hidden,"object",{enumerable:false,value:"b"});
 assert.throws(()=>cohomologyOfCells([hidden]),/inert (?:own )?data/u);
 assert.equal(calls,0);
});

test("original oriented flow and cohomology agree on every signed source incidence",()=>{
  const source=[
    cell("a","reports","b",{for:["one"]}),
    cell("b","reports","c",{against:["two"]}),
    cell("c","reports","a",{for:["three"]}),
    cell("a","reports","b",{against:["four"]}),
  ];
  const flow=flowNetworkOfCells(source);
  const topology=cohomologyOfCells(source,["isolated"]);
  assert.deepEqual(topology.entities.slice(0,flow.terms.length),flow.terms);
  assert.equal(topology.incidence.length,flow.edges.length);
  for(const [index,edge] of flow.edges.entries()){
    const expected=Array(topology.entities.length).fill(0);
    expected[edge.fromIndex]-=1;
    expected[edge.toIndex]+=1;
    assert.deepEqual(topology.incidence[index],expected,
      "the cohomology coboundary is the transpose of the SAME oriented source incidence");
  }
  assert.equal(topology.firstCohomology.rank,2,
    "cycle plus a genuine parallel relation: E - V + connected-components");
  assert.equal(topology.zeroCohomology.rank,2,
    "an independent original isolated source remains an H0 component");
  assert.equal(flow.edges.length,4,
    "parallel positive and opposing source occurrences are never collapsed into one edge");
});

test("cohomology source admission refuses getter-backed, hidden, foreign and oversized inputs",()=>{
  const valid=cell("a","p","b",{for:["observed"]});
  let calls=0;
  const getter=()=>{calls++;throw Error("unqualified source executed");};
  const input=[valid];Object.defineProperty(input,"0",{enumerable:true,get:getter});
  const foreign={subject:"a",predicate:"p",object:"b"};
  Object.defineProperty(foreign,"authority",{enumerable:true,get:getter});
  const extraEntities=["isolate"];Object.defineProperty(extraEntities,"0",
    {enumerable:true,get:getter});
  const hidden={...valid};Object.defineProperty(hidden,"newClaim",{value:"forged"});
  const bareWithoutPredicate={subject:"a",object:"b"};
  for(const [cells,extra] of [
    [input,[]],[[foreign],[]],[[hidden],[]],
    [[valid],extraEntities],[[bareWithoutPredicate],[]]
  ])assert.throws(()=>cohomologyOfCells(cells,extra),/signgraph site:/u);
  const oversized=Array(16385).fill(valid);
  Object.defineProperty(oversized,"0",{enumerable:true,get:getter});
  assert.throws(()=>cohomologyOfCells(oversized),/bounded plain source array/u);
  assert.equal(calls,0,"untrusted source positions cannot execute as mathematical evidence");
});

test("cohomology retains canonical source terms and isolated entities after caller mutation",()=>{
  const speaker={name:"source",path:["a","b"]};
  const recipient={name:"sink",path:["c"]};
  const alone={position:{name:"alone"}};
  const claim={subject:speaker,predicate:"depends",object:recipient};
  const inputs=[claim],extras=[alone];
  const topology=cohomologyOfCells(inputs,extras);
  const before=JSON.stringify(topology);
  speaker.path.push("corrupt");recipient.name="forged";
  alone.position.name="moved";claim.subject=recipient;
  inputs.push({subject:"new",predicate:"claims",object:"phantom"});
  assert.equal(JSON.stringify(topology),before,
    "a graph's published mathematical identity cannot be rewritten after readmission");
  assert.deepEqual(topology.incidence,[[-1,1,0]]);
  assert.equal(topology.firstCohomology.rank,0);
  assert.equal(topology.zeroCohomology.rank,2);
});

test("all 512 three-vertex directed graphs satisfy exact incidence and Euler H0/H1 laws",()=>{
  const terms=["a","b","c"];
  let checked=0;
  for(let mask=0;mask<512;mask++){
    const source=terms.flatMap((from,i)=>terms.flatMap((to,j)=>
      mask & (1 << (i*3+j)) ? [cell(from,"source-directed",to)] : []));
    const expected=reference(source,terms);
    const actual=cohomologyOfCells(source,terms);
    assert.deepEqual(actual.incidence,expected.incidence,
      "a source-directed edge has exactly one -1 and one +1, with loops cancelling");
    assert.deepEqual(actual.zeroCohomology.cocycleBasis,expected.zero);
    assert.equal(actual.zeroCohomology.rank,expected.h0);
    assert.equal(actual.firstCohomology.rank,expected.h1);
    assert.equal(actual.zeroCohomology.rank-actual.firstCohomology.rank,
      actual.entities.length-actual.cells.length,
      "Euler identity for a finite directed graph with distinct source occurrences");
    assert.ok(actual.incidence.every(row=>row.reduce((sum,value)=>sum+value,0)===0),
      "oriented incidence always has zero total boundary charge");
    checked++;
  }
  assert.equal(checked,512);
});

test("dense cohomology refuses an unbounded H0 basis rather than reporting false vanishing",()=>{
  assert.equal(MAX_COHOMOLOGY_DENSE_SLOTS,4_194_304);
  // Even an edge-free graph has one H0 indicator row per isolated vertex;
  // its basis alone is quadratic in the number of original terms.
  const isolated=Array.from({length:2049},(_,index)=>"isolated-"+index);
  assert.throws(()=>cohomologyOfCells([],isolated),
    /dense incidence\/basis budget exceeded; H0\/H1 not evaluated/u);
  const small=cohomologyOfCells([],["a","b","c"]);
  assert.equal(small.zeroCohomology.rank,3);
  assert.equal(small.firstCohomology.rank,0);
  assert.deepEqual(small.incidence,[]);
});
