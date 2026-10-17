import assert from "node:assert/strict";
import test from "node:test";
import { projectSignGraphTopology } from "../src/graph.mjs";

test("semantic graph topology projection keeps addressed witness data", () => {
  const projected = projectSignGraphTopology({
    cells: [{ id: "ni:cell", kind: "sign.cell", type: "test.cell" }],
    edges: [{ id: "ni:edge", edge: { subject: { id: "ni:cell" }, predicate: "supports", object: { id: "ni:cell" }, witness: { id: "ni:witness" } } }],
  });
  assert.deepEqual(projected.nodes(), [{ id: "ni:cell", data: { kind: "sign.cell", type: "test.cell" } }]);
  assert.deepEqual(projected.edges(), [{ from: "ni:cell", to: "ni:cell", kind: "supports", data: { id: "ni:edge", witness: "ni:witness" } }]);
});

test("topology returns no mutation powers or unaddressed graph edges", () => {
  const projected = projectSignGraphTopology({
    cells: [{ id:"ni:cell",kind:"sign.cell",type:"test.cell" }],
    edges:[{id:"ni:edge",edge:{subject:{id:"ni:cell"},predicate:"supports",object:{id:"ni:cell"},witness:{id:"ni:witness"}}}],
  });
  assert.equal(Object.isFrozen(projected),true);
  assert.equal("addNode" in projected,false);
  assert.equal("addEdge" in projected,false);
  const readNodes = projected.nodes();
  readNodes.push({id:"forged"});
  assert.equal(projected.order(),1);
  assert.equal(projected.size(),1);
  assert.equal(projected.node("forged"),undefined);
  assert.equal(projected.edges()[0].data.witness,"ni:witness");
});

test("topology refuses an unaddressed edge instead of making a proof-like graph", () => {
  const graph={cells:[{id:"ni:c",kind:"sign.cell",type:"test.cell"}],
    edges:[{id:"ni:e",edge:{subject:{id:"ni:c"},predicate:"claims",object:{id:"ni:c"}}}]};
  assert.throws(()=>projectSignGraphTopology(graph),/addressed, witnessed edges/);
  assert.throws(()=>projectSignGraphTopology({cells:null,edges:[]}),/admitted cells/);
});

test("different genuine witnesses remain different parallel edges", () => {
  const sample={cells:[{id:"ni:a",kind:"sign.cell",type:"a"},{id:"ni:b",kind:"sign.cell",type:"b"}],
    edges:[{id:"ni:w1",edge:{subject:{id:"ni:a"},predicate:"follows",object:{id:"ni:b"},witness:{id:"ni:first"}}},
      {id:"ni:w2",edge:{subject:{id:"ni:a"},predicate:"follows",object:{id:"ni:b"},witness:{id:"ni:second"}}}]};
  const graph=projectSignGraphTopology(sample);
  assert.equal(graph.order(),2);
  assert.equal(graph.size(),2);
  assert.deepEqual(graph.outgoing("ni:a").map(x=>x.data.witness),["ni:first","ni:second"]);
});
