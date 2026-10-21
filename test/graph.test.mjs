import assert from "node:assert/strict";
import test from "node:test";
import { createTypedMark, referenceOf } from "@red-cup-engineering/signcell/typed-mark";
import { defineType } from "@red-cup-engineering/signcell/type-system";
import { createSignGraph } from "../src/semantic-graph.mjs";
import { projectSignGraphTopology, findSignGraphRoute, channelResourceIncidence } from "../src/graph.mjs";

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
  const unfiltered = findSignGraphRoute(graph, refs[0], refs[2]);
  assert.equal(unfiltered.hops[0].edges.length, 3);
  assert.deepEqual(new Set(unfiltered.hops[0].edges.map(entry => entry.edge.predicate)),
    new Set(["links", "disputes"]),
    "a structural route retains contradictory named predicates without resolving them");
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


const flowRoles = Object.freeze({
  contains:"carries", reports:"reports", resource:"resource",
  from:"from", to:"to", quantity:"quantity", settlement:"claimed-receipt",
  inside:"inside",
});
function resourceChannelFixture({ ambiguous = false, omitQuantity = false, omitMembership = false } = {}) {
  const labels = ["channel","message-1","message-2","exchange-1","exchange-2",
    "water","energy","alice","bob","cell-a","cell-b","quantity-1","quantity-2",
    "receipt","witness-1","witness-2","other-channel","other-message","third"];
  const cells = labels.map(text => accepted(createTypedMark(t,text)));
  const at = Object.fromEntries(labels.map((key,i) => [key,referenceOf(cells[i])]));
  const edge = (from,predicate,to,witness="witness-1") => ({
    subject:at[from],predicate:flowRoles[predicate],object:at[to],witness:at[witness],
  });
  const edges = [
    edge("channel","contains","message-1"),
    edge("channel","contains","message-2"),
    edge("message-1","reports","exchange-1"),
    edge("message-1","reports","exchange-2"),
    edge("message-2","reports","exchange-1","witness-2"),
    edge("exchange-1","resource","water"),
    edge("exchange-1","from","alice"),
    edge("exchange-1","from","alice","witness-2"),
    edge("exchange-1","to","bob"),
    edge("exchange-1","quantity","quantity-1"),
    edge("exchange-1","settlement","receipt"),
    edge("exchange-2","resource","energy"),
    edge("exchange-2","from","bob"),
    edge("exchange-2","to","alice"),
    ...(!omitQuantity ? [edge("exchange-2","quantity","quantity-2")] : []),
    ...(!omitMembership ? [
      edge("alice","inside","cell-a"),edge("bob","inside","cell-b"),
    ] : []),
    edge("other-channel","contains","other-message"),
    ...(ambiguous ? [edge("exchange-2","from","third")] : []),
  ];
  const relation = id => ({ id,subjectTypes:[t.id],objectTypes:[t.id],witnessTypes:[t.id] });
  const graph = accepted(createSignGraph({
    cells, relations:Object.values(flowRoles).map(relation), edges,
  }));
  return {graph,at};
}

test("witnessed channels keep reports distinct but count each source exchange only once", () => {
  const {graph,at}=resourceChannelFixture();
  const reading=channelResourceIncidence(graph,{channel:at.channel,relations:flowRoles});
  assert.equal(reading.kind,"signgraph.channelResourceIncidence.v1");
  assert.equal(reading.graph,graph.id);
  assert.equal(reading.messages.length,2);
  assert.equal(reading.transfers.length,2,"one original exchange reported twice is still one transfer incidence");
  assert.deepEqual(reading.obstructions,[]);
  const water=reading.transfers.find(x=>x.resource.id===at.water.id);
  assert.ok(water);
  assert.equal(water.reportedBy.length,2,"distinct channel messages are not erased");
  assert.deepEqual(new Set(water.reportedBy.map(x=>x.message.id)),
    new Set([at["message-1"].id,at["message-2"].id]));
  assert.equal(water.evidence.from[0].edges.length,2,"parallel witnesses of one source are retained");
  assert.ok(water.evidence.from[0].edges.every(e=>graph.edges.some(original=>original.id===e.id)),
    "every observation is one original EAVT-addressed edge");
  assert.equal(water.from.id,at.alice.id);
  assert.equal(water.to.id,at.bob.id);
  assert.equal(water.sourceCell.id,at["cell-a"].id);
  assert.equal(water.targetCell.id,at["cell-b"].id);
  assert.equal(water.crossesCellBoundary,true);
  assert.equal(water.quantity.id,at["quantity-1"].id);
  assert.equal(water.settlementClaims.length,1);
  assert.equal(reading.effect,"not-executed");
  assert.equal(reading.settlement,"not-authenticated");
  assert.equal(reading.messageOrder,"not-derived");
  assert.equal(Object.isFrozen(water),true);
  const other=channelResourceIncidence(graph,{channel:at["other-channel"],relations:flowRoles});
  assert.equal(other.messages.length,1);
  assert.deepEqual(other.transfers,[]);
  assert.deepEqual(other.obstructions,[]);
});

test("channel-resource incidence reports ambiguous endpoints instead of inventing source-target pairings", () => {
  const {graph,at}=resourceChannelFixture({ambiguous:true,omitQuantity:true});
  const original=JSON.stringify(graph);
  const reading=channelResourceIncidence(graph,{channel:at.channel,relations:flowRoles});
  assert.equal(reading.transfers.length,1);
  assert.equal(reading.obstructions.length,1);
  const issue=reading.obstructions[0];
  assert.equal(issue.exchange.id,at["exchange-2"].id);
  assert.deepEqual(issue.failures.map(f=>[f.role,f.kind,f.count]),[["from","ambiguous",2]]);
  assert.equal(issue.evidence.from.length,2);
  assert.equal(issue.evidence.quantity.length,0,"missing observation must remain unknown, not a zero");
  assert.equal(JSON.stringify(graph),original,"projection does not modify source");
  const broken=resourceChannelFixture({omitMembership:true});
  const missing=channelResourceIncidence(broken.graph,{channel:broken.at.channel,relations:flowRoles});
  assert.deepEqual(missing.transfers,[]);
  assert.equal(missing.obstructions.length,2);
  assert.ok(missing.obstructions.every(x=>x.failures.some(f=>f.kind==="missing"&&f.role.endsWith("Cell"))));
});

test("channel-resource reading re-admits original graph and refuses forged or unlicensed coordinates", () => {
  const {graph,at}=resourceChannelFixture();
  const copy=JSON.parse(JSON.stringify(graph));
  const original=channelResourceIncidence(graph,{channel:at.channel,relations:flowRoles});
  assert.deepEqual(channelResourceIncidence(copy,{channel:at.channel,relations:flowRoles}),original);
  copy.edges[0].id="ni:forged";
  assert.throws(()=>channelResourceIncidence(copy,{channel:at.channel,relations:flowRoles}),TypeError);
  for(const member of [{id:at.channel.id},{id:"ni:unadmitted",type:t.id}])
    assert.throws(()=>channelResourceIncidence(graph,{channel:member,relations:flowRoles}),TypeError);
  assert.throws(()=>channelResourceIncidence(graph,{channel:at.channel,
    relations:{...flowRoles,contains:"not-declared"}}),/undeclared/);
  assert.throws(()=>channelResourceIncidence(graph,{channel:at.channel,
    relations:{...flowRoles,contains:"reports"}}),/distinct roles/);
  assert.throws(()=>channelResourceIncidence(graph,{channel:at.channel,
    relations:flowRoles,maxMessages:1}),/message budget/);
  assert.throws(()=>channelResourceIncidence(graph,{channel:at.channel,
    relations:flowRoles,maxExchanges:1}),/exchange budget/);
  assert.throws(()=>channelResourceIncidence(graph,{channel:at.channel,
    relations:flowRoles,maxEdges:1}),/witnessed-edge budget/);
  assert.throws(()=>channelResourceIncidence(graph,{channel:at.channel,
    relations:flowRoles,maxEdges:131073}),/witnessed-edge budget/);
  assert.throws(()=>channelResourceIncidence(graph,{channel:at.channel,
    relations:{...flowRoles,inject:"untrusted"}}),/relation roles/);
  // No type-based inference of eligibility from words such as "channel".
  const wrongRelation=accepted(createSignGraph({
    cells:graph.cells,
    relations:Object.values(flowRoles).map(id=>({id,
      subjectTypes:id==="carries"?["not-a-channel-type"]:[t.id],
      objectTypes:[t.id],witnessTypes:[t.id],
    })),edges:[],
  }));
  assert.throws(()=>channelResourceIncidence(wrongRelation,{channel:at.channel,
    relations:flowRoles}),/channel type/);
});
