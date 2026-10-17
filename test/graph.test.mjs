import assert from "node:assert/strict";
import test from "node:test";
import { createTypedMark, referenceOf } from "@red-cup-engineering/signcell/typed-mark";
import { defineType } from "@red-cup-engineering/signcell/type-system";
import { createSignGraph } from "@red-cup-engineering/signcell/semantic-graph";
import { projectSignGraphTopology } from "../src/graph.mjs";

const accepted = (r) => { assert.equal(r.ok, true, JSON.stringify(r)); return r.value; };
const t = accepted(defineType({
  id: "signgraph.topology.test.mark.v1", name: "Pure topology source",
  description: "Original type-defined Mark, not a topology-derived declaration",
  schema: {}, parents: [],
}));
function sourceGraph() {
  const marks = ["source","destination","witness-A","witness-B"]
    .map(text => accepted(createTypedMark(t,text)));
  const [a,b,w1,w2] = marks.map(referenceOf);
  const graph = accepted(createSignGraph({
    cells: marks,
    relations:[{ id:"supports", subjectTypes:[t.id],objectTypes:[t.id],witnessTypes:[t.id] }],
    edges:[
      { subject:a,predicate:"supports",object:b,witness:w1 },
      { subject:a,predicate:"supports",object:b,witness:w2 },
    ],
  }));
  return { graph,marks,refs:{a,b,w1,w2} };
}
const wire = value => JSON.parse(JSON.stringify(value));

test("the original SignCell source, not an independent graph parser, licenses every topology edge", () => {
  const {graph,marks,refs}=sourceGraph();
  const before=JSON.stringify(graph);
  const topology=projectSignGraphTopology(graph);
  assert.equal(JSON.stringify(graph),before,"query must not mutate the original admitted graph");
  assert.equal(topology.order(),4,"source, target AND witness Marks are real graph vertices");
  assert.equal(topology.size(),2);
  assert.deepEqual(topology.nodes().map(x=>x.id).sort(),marks.map(x=>x.id).sort());
  assert.deepEqual(topology.outgoing(refs.a.id).map(x=>x.to),[refs.b.id,refs.b.id]);
  assert.deepEqual(new Set(topology.edges().map(x=>x.data.witness)),
    new Set([refs.w1.id,refs.w2.id]));
  assert.deepEqual(new Set(topology.edges().map(x=>x.data.id)),
    new Set(graph.edges.map(x=>x.id)),"retain EAVT original edge identities");
  assert.equal(topology.incoming(refs.a.id).length,0,"orientation is not symmetric");
});

test("projected graph has no mutable builder powers and can be read repeatedly", () => {
  const original=sourceGraph();
  const projected=projectSignGraphTopology(wire(original.graph));
  assert.equal(Object.isFrozen(projected),true);
  assert.equal("addNode" in projected,false);
  assert.equal("addEdge" in projected,false);
  projected.nodes().push({id:"ni:///sha-256;forged"});
  projected.edges().push({from:"forged",to:"forged"});
  assert.equal(projected.order(),4);
  assert.equal(projected.size(),2);
  assert.equal(projected.node("ni:///sha-256;forged"),undefined);
});

test("forged addresses, nonmembers, tampered types and stale graph cuts cannot manufacture topology", () => {
  const {graph}=sourceGraph();
  const examples=[];
  const wrongGraph=wire(graph);wrongGraph.id="ni:unreceived";examples.push(wrongGraph);
  const fakeWitness=wire(graph);fakeWitness.edges[0].edge.witness.id="ni:unknown";examples.push(fakeWitness);
  const fakeEndpoint=wire(graph);fakeEndpoint.edges[0].edge.object.id="ni:unknown";examples.push(fakeEndpoint);
  const wrongType=wire(graph);wrongType.edges[0].edge.subject.type="another-type";examples.push(wrongType);
  const fakeEdge=wire(graph);fakeEdge.edges[0].id="ni:invented";examples.push(fakeEdge);
  const alteredMark=wire(graph);alteredMark.cells[0].content="altered";examples.push(alteredMark);
  const droppedMark=wire(graph);droppedMark.cells.pop();examples.push(droppedMark);
  for (const example of examples)
    assert.throws(()=>projectSignGraphTopology(example),TypeError,
      "source SignCell admission must refuse rather than draw a plausible false graph");
  assert.throws(()=>projectSignGraphTopology({cells:[{id:"ni:fake"}],edges:[]}),TypeError);
  assert.throws(()=>projectSignGraphTopology(null),TypeError);
});
