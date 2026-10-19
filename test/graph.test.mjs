import assert from "node:assert/strict";
import test from "node:test";
import { createTypedMark, referenceOf } from "@red-cup-engineering/signcell/typed-mark";
import { defineType } from "@red-cup-engineering/signcell/type-system";
import { createSignGraph } from "../src/semantic-graph.mjs";
import { projectSignGraphTopology, findSignGraphRoute } from "../src/graph.mjs";

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

test("a structural route retains both parallel witnesses without promoting transitivity to truth", () => {
  const marks = ["start", "middle", "finish", "witness-a", "witness-b"]
    .map(text => accepted(createTypedMark(t, text)));
  const refs = marks.map(referenceOf);
  const relation = id => ({ id, subjectTypes:[t.id], objectTypes:[t.id], witnessTypes:[t.id] });
  const graph = accepted(createSignGraph({
    cells: marks,
    relations: [relation("links"), relation("disputes")],
    edges: [
      { subject: refs[0], predicate:"links", object:refs[1], witness:refs[3] },
      { subject: refs[0], predicate:"links", object:refs[1], witness:refs[4] },
      { subject: refs[0], predicate:"disputes", object:refs[1], witness:refs[4] },
      { subject: refs[1], predicate:"links", object:refs[2], witness:refs[3] },
    ],
  }));
  const original = JSON.stringify(graph);
  const route = findSignGraphRoute(wire(graph), refs[0], refs[2], { predicate: "links" });
  assert.equal(route.kind, "signgraph.shortestWitnessedRoute.v1");
  assert.equal(route.graph, graph.id);
  assert.equal(route.reachable, true);
  assert.equal(route.distance, 2);
  assert.deepEqual(route.nodes.map(node => node.id), refs.slice(0, 3).map(ref => ref.id));
  assert.equal(route.hops[0].edges.length, 2);
  assert.deepEqual(new Set(route.hops[0].edges.map(entry => entry.id)),
    new Set(graph.edges.filter(entry => entry.edge.subject.id === refs[0].id &&
      entry.edge.object.id === refs[1].id && entry.edge.predicate === "links").map(entry => entry.id)));
  assert.deepEqual(new Set(route.hops[0].edges.map(entry => entry.edge.witness.id)),
    new Set([refs[3].id, refs[4].id]));
  assert.equal(route.hops[1].edges.length, 1);
  assert.ok(!route.hops.some(hop => hop.edges.some(entry => entry.edge.predicate === "disputes")));
  assert.equal(Object.isFrozen(route.hops[0].edges), true);
  assert.equal(JSON.stringify(graph), original);
  // Traversal alone does not mint an asserted start-to-finish edge.
  assert.ok(!graph.edges.some(entry => entry.edge.subject.id === refs[0].id && entry.edge.object.id === refs[2].id));
});

test("a different valid graph admits zero-length and unreachable routes without invented evidence", () => {
  const {graph, refs} = sourceGraph();
  const zero = findSignGraphRoute(graph, refs.a, refs.a);
  assert.equal(zero.reachable, true);
  assert.equal(zero.distance, 0);
  assert.equal(zero.hops.length, 0);
  assert.equal(zero.nodes.length, 1);
  const reverse = findSignGraphRoute(graph, refs.b, refs.a);
  assert.equal(reverse.reachable, false);
  assert.equal(reverse.distance, null);
  assert.deepEqual(reverse.hops, []);
  const unfiltered = findSignGraphRoute(graph, refs.a, refs.b);
  assert.equal(unfiltered.hops[0].edges.length, 2);
});

test("typed route boundaries refuse forged cuts, untyped targets and malformed selectors", () => {
  const {graph, refs} = sourceGraph();
  assert.throws(() => findSignGraphRoute(graph, refs.a, {id:refs.b.id}),
    error => error.code === "invalid-subject");
  assert.throws(() => findSignGraphRoute(graph, refs.a, {id:"ni:foreign",type:t.id}),
    error => error.code === "unknown-cell");
  for (const options of [null, [], {predicate:""}, {predicate:5}, {limit:5}])
    assert.throws(() => findSignGraphRoute(graph, refs.a, refs.b, options), TypeError);
  const forged = wire(graph); forged.edges[0].id = "ni:forged";
  assert.throws(() => findSignGraphRoute(forged, refs.a, refs.b), TypeError);
});
