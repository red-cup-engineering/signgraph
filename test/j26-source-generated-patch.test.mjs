import test from "node:test";
import assert from "node:assert/strict";
import { gyrobifastigiumJ26 } from "@red-cup-engineering/metrologic/articulation/predicating/geometry/spatial/gyrobifastigium-j26";
import { j26CellularSurface, j26FacePatch } from "../src/j26-surface.mjs";

const reversePairs = (left, right) =>
  left.map((from,i)=>[from,right[(right.length-i)%right.length]]);
const face=(id)=>gyrobifastigiumJ26.faces.find(f=>f.name===id).vertices;
const connection=(id,lt,lf,rt,rf)=>({
  id,left:{tile:lt,face:lf},right:{tile:rt,face:rf},
  vertexPairs:reversePairs(face(lf),face(rf)),
});

test("Metrologic's current J26 produces a real closed 3-cell and exactly 14 signed oppositions",()=>{
  const surface=j26CellularSurface();
  assert.equal(surface.kind,"signgraph.j26.cellular-surface.v1");
  assert.equal(surface.vertices.length,8);
  assert.equal(surface.edges.length,14);
  assert.equal(surface.faces.length,8);
  assert.equal(surface.faceAdjacency.length,14);
  assert.equal(surface.complex.volumes.length,1);
  assert.equal(surface.complex.totalFaceBoundaryCloses,true);
  assert.deepEqual(surface.complex.totalFaceBoundary,new Array(14).fill(0));
  assert.deepEqual(surface.complex.surfaceBetti,{h0:1,h1:0,h2:1});
  assert.deepEqual(surface.complex.betti,{h0:1,h1:0,h2:0,h3:0});
  assert.equal(surface.faces.filter(f=>f.kind==="triangle").length,4);
  assert.equal(surface.faces.filter(f=>f.kind==="square").length,4);
});

test("a single misoriented face cannot become an admitted J26 volume",()=>{
  const flipped={...gyrobifastigiumJ26,
    faces:gyrobifastigiumJ26.faces.map(face=>face.name==="rightTop"
      ? {...face,vertices:[...face.vertices].reverse()} : face)};
  assert.throws(()=>j26CellularSurface(flipped),/traverse each edge oppositely/);
});

test("no contact exists until two tiles have an explicit reversed face identification",()=>{
  const isolated=j26FacePatch({tiles:["north","south"]});
  assert.equal(isolated.adjacency.length,0);
  assert.equal(isolated.exposed.length,16);
  const patch=j26FacePatch({tiles:["north","south"],interfaces:[
    connection("f1","north","leftTop","south","leftTop"),
  ]});
  assert.equal(patch.kind,"signgraph.j26.combinatorial-patch.v1");
  assert.deepEqual(patch.adjacency,[{interface:"f1",from:"north",to:"south"}]);
  assert.equal(patch.exposed.length,14);
  assert.equal(patch.interfaces[0].vertexPairs.length,3);
});

test("three tiles admit separate triangular and square contacts, not fictional causal arrows",()=>{
  const patch=j26FacePatch({tiles:["A","B","C"],interfaces:[
    connection("tri","A","leftTop","B","leftTop"),
    connection("square","B","rightSide0","C","leftSide0"),
  ]});
  assert.equal(patch.interfaces.length,2);
  assert.equal(patch.exposed.length,20);
  assert.deepEqual(patch.adjacency.map(edge=>edge.interface),["tri","square"]);
});

test("incompatible, reused, invented or self-facing contacts refuse, rather than manufacturing a tiling",()=>{
  const valid=connection("f1","A","leftTop","B","leftTop");
  const reversedWrong={...valid,vertexPairs:face("leftTop").map(v=>[v,v])};
  const badType=connection("wrong","A","leftTop","B","leftSide0");
  for(const bad of [
    reversedWrong,badType,
    {...valid,right:{tile:"A",face:"rightTop"}},
    {...valid,right:{tile:"outside",face:"leftTop"}},
    {...valid,right:{tile:"B",face:"ghost"}},
    {...valid,vertexPairs:[[ "q0","q0" ],["q1","q0"],["a","q1"]]},
  ]) assert.throws(()=>j26FacePatch({tiles:["A","B"],interfaces:[bad]}),TypeError);
  assert.throws(()=>j26FacePatch({tiles:["A","A"]}),/duplicate tile/);
  assert.throws(()=>j26FacePatch({tiles:["A","B"],interfaces:[valid,{...valid,id:"f2"}]}),
    /already consumed/);
  assert.throws(()=>j26FacePatch({tiles:["A","B"],interfaces:[valid,valid]}),/duplicate interface/);
});
