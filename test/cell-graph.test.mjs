import test from "node:test";
import assert from "node:assert/strict";
import { samePoint } from "@red-cup-engineering/computer-data-engineering-services-section/four";
import { toInt } from "@red-cup-engineering/exact-number-data-service/exact-number";
import { cell, coincides, sameCell, valueOf } from "@red-cup-engineering/signcell/cell";
import { at, transpose } from "@red-cup-engineering/metrologic/chu";
import { cellGraph, relationGraphOfCells, flowNetworkOfCells, flowNetwork } from "../src/cell-graph.mjs";

const cellOf = (subject, predicate, object) => cell(subject, predicate, object);

test("cellGraph: a cell reads present at an observation that names it, absent otherwise", () => {
  const a = cellOf("alice", "knows", "bob");
  const b = cellOf("bob", "knows", "carol");
  const graph = cellGraph([a, b], [
    { name: "subject-is-alice", evaluate: (c) => (c.subject === "alice" ? "potential" : "active") },
  ]);
  assert.ok(samePoint(at(graph, a, "subject-is-alice"), "potential"));
  assert.ok(samePoint(at(graph, b, "subject-is-alice"), "active"));
});

test("cellGraph: transpose swaps points and states, preserving the value at the swapped coordinate", () => {
  const a = cellOf("alice", "knows", "bob");
  const graph = cellGraph([a], [
    { name: "always-potential", evaluate: () => "potential" },
  ]);
  const flipped = transpose(graph);
  assert.ok(samePoint(at(flipped, "always-potential", a), "potential"));
});


test("flowNetworkOfCells keeps source-to-proof direction that symmetric relation graphs necessarily forget",()=>{
  const evidence=cellOf("source-receipt","is-premise-of","derived-proof");
  const converse=cellOf("derived-proof","is-premise-of","source-receipt");
  const forward=flowNetworkOfCells([evidence]);
  const backward=flowNetworkOfCells([converse]);
  assert.deepEqual(
    relationGraphOfCells([evidence]).weights,
    relationGraphOfCells([converse]).weights,
    "symmetric relation weights cannot prove causal orientation",
  );
  assert.deepEqual(forward.edges.map(e=>[e.from,e.to]),[["source-receipt","derived-proof"]]);
  assert.deepEqual(backward.edges.map(e=>[e.from,e.to]),[["derived-proof","source-receipt"]]);
  assert.notDeepEqual(forward.edges,backward.edges);
  assert.equal(forward.edges[0].fromIndex,0);
  assert.equal(forward.edges[0].toIndex,1);
});

test("oriented 1-chains preserve boundary conservation and distinguish causal cycles",()=>{
  const cells=[
    cellOf("original-data","supports","model"),
    cellOf("model","supports","evaluation"),
    cellOf("evaluation","supports","original-data"),
  ];
  const graph=flowNetworkOfCells(cells);
  const boundary=Array(graph.terms.length).fill(0);
  for(const edge of graph.edges){
    boundary[edge.fromIndex]-=1;
    boundary[edge.toIndex]+=1;
  }
  assert.deepEqual(boundary,[0,0,0],"directed cycle is a 1-chain with zero boundary");
  assert.equal(graph.edges.length,3);
  assert.equal(graph.kind,"signgraph.flowNetwork");
  assert.equal(Object.isFrozen(graph.edges),true);
});

test("flow network of raw SignCells is the existing section flow reading, not a second graph type",()=>{
  const cells=[
    cellOf("forecast","supports","proof"),
    cellOf("forecast","supports","proof"),
    cellOf("proof","refers","proof"),
  ];
  const direct=flowNetworkOfCells(cells);
  const section=flowNetwork({entries:cells.map(value=>({cell:value}))});
  assert.deepEqual(direct,section);
  assert.equal(direct.terms.length,2);
  assert.equal(direct.edges.length,2,"parallel evidence remains separate incidence edges");
  assert.ok(direct.edges.every(edge=>edge.from==="forecast"&&edge.to==="proof"));
});

test("empty SignCells cannot fabricate a graph with an independently received proof",()=>{
  assert.throws(()=>flowNetworkOfCells([]),TypeError);
});


test("weighted SignGraph preserves undirected multiplicity while retaining directed events",()=>{
  const values=[
    cellOf("alpha","relates","beta"),
    cellOf("beta","relates","alpha"),
    cellOf("alpha","relates","beta"),
    cellOf("beta","self","beta"),
    cellOf("beta","relates","gamma"),
  ];
  const graph=relationGraphOfCells(values);
  assert.deepEqual(graph.terms,["alpha","beta","gamma"]);
  assert.deepEqual(graph.weights.map(row=>row.map(toInt)),[
    [0,3,0],[3,0,1],[0,1,0],
  ]);
  const flow=flowNetworkOfCells(values);
  assert.deepEqual(flow.edges.map(edge=>[edge.fromIndex,edge.toIndex]),[
    [0,1],[1,0],[0,1],[1,2],
  ]);
  assert.equal(Object.isFrozen(graph.weights[0]),true);
});

test("the exact weighted reader counts large parallel evidence without per-matrix rescanning",()=>{
  const n=300;
  const nodes=Array.from({length:n},(_,i)=>"vertex"+String(i).padStart(3,"0"));
  const cells=nodes.map(node=>cellOf(node,"self",node));
  for(let i=0;i<4000;i++)
    cells.push(cellOf(nodes[i % n],"edge",nodes[(i+1) % n]));
  const graph=relationGraphOfCells(cells);
  assert.equal(graph.terms.length,n);
  assert.equal(graph.weights.length,n);
  assert.equal(graph.weights[0].length,n);
  assert.equal(toInt(graph.weights[0][1]),Math.ceil(4000/n));
  assert.equal(toInt(graph.weights[0][0]),0);
});

test("cellGraph presents one stable SignCell point despite contrary later testimony", () => {
  const supported = cell("engine", "claims-role", "server", { for: ["witness-A"] });
  const opposed = cell("engine", "claims-role", "server", { against: ["witness-B"] });
  assert.ok(sameCell(supported, opposed), "triple identity survives evidence changes");
  const observations = [];
  const graph = cellGraph([supported, opposed], [
    { name: "joined-knowledge", evaluate: (point) => {
      observations.push(point);
      return valueOf(point);
    } },
  ]);
  assert.equal(observations.length, 1, "two tellings are joined before graph evaluation");
  assert.deepEqual(observations[0].for, ["witness-A"]);
  assert.deepEqual(observations[0].against, ["witness-B"]);
  assert.ok(samePoint(at(graph, supported, "joined-knowledge"), "stable"));
  assert.ok(samePoint(at(graph, opposed, "joined-knowledge"), "stable"));
});

test("canonical coincidence-indexed flow agrees on Unicode, byte terms and repeated predication presentations",()=>{
  const first={name:"é",bits:new Uint8Array([1,2,3])};
  const same={bits:new Uint8Array([1,2,3]),name:"é"};
  const other={name:"other",bits:new Uint8Array([4])};
  const source=[
    cell(first,"reports",other,{for:["first"]}),
    cell(same,"reports",other,{against:["second"]}),
    cell(other,"reports",same,{for:["reverse"]}),
    cell(first,"is",same,{for:["identity"]}),
  ];
  const undirected=relationGraphOfCells(source);
  const oriented=flowNetworkOfCells(source);
  assert.equal(undirected.terms.length,2,"NFC and key-order equivalent references have one vertex");
  assert.deepEqual(undirected.weights.map(row=>row.map(toInt)),[[0,3],[3,0]]);
  assert.deepEqual(oriented.edges.map(edge=>[edge.fromIndex,edge.toIndex]),[[0,1],[0,1],[1,0]]);
  assert.equal(oriented.edges[0].fromIndex,oriented.edges[1].fromIndex);
  assert.equal(oriented.edges[0].toIndex,oriented.edges[1].toIndex);
  assert.equal(oriented.edges.length,3,"reflexive equivalence is excluded only from boundary edges");
  assert.equal(oriented.terms[0].name,"é","first source presentation remains readable");
});

test("canonical vertex index matches independent coincidence scans on varied finite source graphs",()=>{
  const terms=[
    "a","b","c","d", {left:1,right:[2,3]}, {right:[2,3],left:1},
    "é","é", {bytes:new Uint8Array([0,255])},{bytes:new Uint8Array([0,255])}
  ];
  for(let size=1;size<=70;size+=7){
    const source=Array.from({length:size},(_,i)=>cell(
      terms[(i*13+2)%terms.length], "typed", terms[(i*7+5)%terms.length],
      {for:[i]}));
    const expectedTerms=[];
    const expectedEdges=[];
    const counts=[];
    const indexOf=value=>{
      let result=expectedTerms.findIndex(term=>coincides(term,value));
      if(result<0){result=expectedTerms.length;expectedTerms.push(value);}
      return result;
    };
    for(const entry of source){
      const a=indexOf(entry.subject),b=indexOf(entry.object);
      if(a!==b)expectedEdges.push([a,b]);
    }
    const actual=flowNetworkOfCells(source);
    assert.deepEqual(actual.edges.map(e=>[e.fromIndex,e.toIndex]),expectedEdges);
    assert.equal(actual.terms.length,expectedTerms.length);
    for(let i=0;i<expectedTerms.length;i++)
      assert.ok(coincides(expectedTerms[i],actual.terms[i]));
    const adjacency=Array.from({length:expectedTerms.length},()=>Array(expectedTerms.length).fill(0));
    for(const [a,b] of expectedEdges){adjacency[a][b]++;adjacency[b][a]++;}
    assert.deepEqual(actual.graph.weights.map(row=>row.map(toInt)),adjacency);
  }
});

test("ordered graph projection admits original bare triples and SignCells without erasing repeated occurrences",()=>{
  const bare={subject:"speaker",predicate:"reports",object:"listener"};
  const supported=cell("speaker","reports","listener",{for:["record:a"]});
  const opposed=cell("speaker","reports","listener",{against:["record:b"]});
  const source=[bare,supported,opposed];
  const directed=flowNetworkOfCells(source);
  const undirected=relationGraphOfCells(source);
  assert.equal(directed.edges.length,3,"three source positions remain three incidences");
  assert.deepEqual(directed.edges.map(x=>[x.from,x.to]),
    [["speaker","listener"],["speaker","listener"],["speaker","listener"]]);
  assert.equal(toInt(undirected.weights[0][1]),3);
  assert.deepEqual(directed.graph,undirected,
    "symmetric and directed readers share the original source ordering");
  assert.deepEqual(supported.for,["record:a"]);
  assert.deepEqual(opposed.against,["record:b"]);
  assert.deepEqual(bare,{subject:"speaker",predicate:"reports",object:"listener"});
});

test("oriented graph and its symmetric counterpart never evaluate source accessors",()=>{
  let calls=0;
  const poisoned=()=>{calls++;throw Error("unexpected source getter");};
  const good=cell("a","p","b");
  const sourceGet={predicate:"p",object:"b"};
  Object.defineProperty(sourceGet,"subject",{enumerable:true,get:poisoned});
  const extra={subject:"a",predicate:"p",object:"b"};
  Object.defineProperty(extra,"authority",{enumerable:true,get:poisoned});
  const evidenceGetter={...good};
  Object.defineProperty(evidenceGetter,"for",{enumerable:true,get:poisoned});
  const hidden={...good};
  Object.defineProperty(hidden,Symbol("unwitnessed"),{value:"forged"});
  const sparse=[good, ,good];
  const arrayGetter=[good];
  Object.defineProperty(arrayGetter,"0",{enumerable:true,get:poisoned});
  for(const input of [
    [sourceGet],[extra],[evidenceGetter],[hidden],sparse,arrayGetter,
    [{subject:"a",predicate:"p",object:"b",for:["w"]}],
    [Object.assign(Object.create({subject:"a"}),{predicate:"p",object:"b"})],
  ])for(const read of [relationGraphOfCells,flowNetworkOfCells])
    assert.throws(()=>read(input),/signcell:/u);
  assert.equal(calls,0,"no getter ran during graph source qualification");
});

test("graph terms and orientations are a single immutable source snapshot",()=>{
  const origin={name:"a",nested:{revision:[1]}};
  const destination={name:"b",nested:{revision:[2]}};
  const first={subject:origin,predicate:"rel",object:destination};
  const second={subject:destination,predicate:"rel",object:origin};
  const source=[first,second];
  const graph=flowNetworkOfCells(source);
  const before=JSON.stringify(graph);
  origin.name="corrupt";
  origin.nested.revision[0]=99;
  destination.nested.revision.push(999);
  first.subject=destination;
  second.object=destination;
  source.reverse();
  assert.equal(JSON.stringify(graph),before,
    "later changes to source records cannot rewrite canonical graph geometry");
  assert.deepEqual(graph.edges.map(e=>[e.fromIndex,e.toIndex]),[[0,1],[1,0]]);
  assert.ok(graph.edges.every(e=>graph.terms[e.fromIndex]===e.from &&
      graph.terms[e.toIndex]===e.to),
    "every directed endpoint is an actual admitted vertex from the same snapshot");
});

test("graph admission refuses over-budget source positions before inspecting them",()=>{
  const source=Array.from({length:16385},()=>cell("a","p","b"));
  let touched=0;
  Object.defineProperty(source,"0",{enumerable:true,get(){touched++;throw Error("executed");}});
  assert.throws(()=>relationGraphOfCells(source),/bounded plain source array/u);
  assert.throws(()=>flowNetworkOfCells(source),/bounded plain source array/u);
  assert.equal(touched,0);
});
