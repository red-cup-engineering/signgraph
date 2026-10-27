import assert from "node:assert/strict";
import test from "node:test";
import { createTypedMark, referenceOf } from "@red-cup-engineering/signcell/typed-mark";
import { defineType, isSubtypeOf } from "@red-cup-engineering/signcell/type-system";
import { createSignGraph } from "../src/semantic-graph.mjs";
import { projectSignGraphTopology, findSignGraphRoute, channelResourceIncidence, channelTransportPossibilities, channelStockFlowAmbiguity, channelFlowWitnessPlacement } from "../src/graph.mjs";

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
function resourceChannelFixture({ ambiguous = false, conflictingQuantity = false, repeatedQuantityWitness = false, omitQuantity = false, omitMembership = false, nested = false, cyclic = false, divided = false } = {}) {
  const labels = ["channel","message-1","message-2","exchange-1","exchange-2",
    "water","energy","alice","bob","cell-a","cell-b","quantity-1","quantity-2",
    "receipt","witness-1","witness-2","other-channel","other-message","third","tissue-1","tissue-2"];
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
    ...(repeatedQuantityWitness ? [edge("exchange-1","quantity","quantity-1","witness-2")] : []),
    edge("exchange-1","settlement","receipt"),
    edge("exchange-2","resource","energy"),
    edge("exchange-2","from","bob"),
    edge("exchange-2","to","alice"),
    ...(!omitQuantity ? [edge("exchange-2","quantity","quantity-2")] : []),
    ...(conflictingQuantity ? [edge("exchange-2","quantity","quantity-1","witness-2")] : []),
    ...(!omitMembership ? [
      edge("alice","inside","cell-a"),edge("bob","inside","cell-b"),
    ] : []),
    ...(nested ? [
      edge("cell-a","inside","tissue-1"),edge("cell-b","inside","tissue-1"),
    ] : []),
    ...(cyclic ? [edge("tissue-1","inside","cell-a")] : []),
    ...(divided ? [edge("cell-a","inside","tissue-2")] : []),
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

test("contested quantities obstruct only their source exchange and retain all original witnesses", () => {
  const {graph,at} = resourceChannelFixture({conflictingQuantity:true});
  const reading = channelResourceIncidence(graph,{channel:at.channel,relations:flowRoles});
  assert.equal(reading.transfers.length,1,"a contested quantity must not invalidate an unrelated source exchange");
  assert.equal(reading.transfers[0].exchange.id,at["exchange-1"].id);
  assert.equal(reading.transfers[0].reportedBy.length,2,"independent messages about one valid exchange remain independent evidence");
  assert.equal(reading.obstructions.length,1);
  const blocked=reading.obstructions[0];
  assert.equal(blocked.exchange.id,at["exchange-2"].id);
  assert.deepEqual(blocked.failures.map(f=>[f.role,f.kind,f.count]),[["quantity","ambiguous",2]]);
  assert.deepEqual(new Set(blocked.evidence.quantity.map(x=>x.target.id)),
    new Set([at["quantity-1"].id,at["quantity-2"].id]));
  assert.ok(blocked.evidence.quantity.every(x=>
    x.edges.length===1 && graph.edges.some(source=>source.id===x.edges[0].id)));
  assert.equal(blocked.reportedBy.length,1);
  assert.deepEqual(channelResourceIncidence(JSON.parse(JSON.stringify(graph)),{
    channel:at.channel,relations:flowRoles,
  }),reading,"wire roundtrip must preserve the separated evidence and obstruction");
});

test("parallel witnesses of one quantity identity do not fabricate a conflict or second transfer",()=>{
  const {graph,at}=resourceChannelFixture({repeatedQuantityWitness:true});
  const reading=channelResourceIncidence(graph,{channel:at.channel,relations:flowRoles});
  assert.equal(reading.obstructions.length,0);
  assert.equal(reading.transfers.length,2);
  const water=reading.transfers.find(arc=>arc.exchange.id===at["exchange-1"].id);
  assert.ok(water);
  assert.equal(water.evidence.quantity.length,1,"same source quantity does not become two candidate amounts");
  assert.equal(water.evidence.quantity[0].edges.length,2,
    "distinct original witnesses of that one quantity must not be discarded");
  assert.ok(water.evidence.quantity[0].edges.every(edge=>
    graph.edges.some(original=>original.id===edge.id)));
  assert.equal(water.reportedBy.length,2,"two reports still identify one source exchange");
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



test("multicellular lineage preserves witnessed local crossings and common outer compartments", () => {
  const {graph,at}=resourceChannelFixture({nested:true});
  const result=channelResourceIncidence(graph,{
    channel:at.channel,relations:flowRoles,maxContainmentDepth:2,
  });
  assert.equal(result.obstructions.length,0);
  assert.equal(result.transfers.length,2);
  const water=result.transfers.find(x=>x.resource.id===at.water.id);
  assert.equal(water.compartmentLevels[0].depth,1);
  assert.equal(water.compartmentLevels[0].crosses,true);
  assert.equal(water.compartmentLevels[1].crosses,false);
  assert.equal(water.compartmentLevels[1].from.id,at["tissue-1"].id);
  assert.equal(water.compartmentLevels[1].to.id,at["tissue-1"].id);
  assert.equal(water.sourceLineage.levels.length,2);
  assert.equal(water.sourceLineage.levels[1].edges.length,1);
  assert.equal(water.sourceLineage.stop,"depth-limit");
  assert.equal(water.standing,"witnessed-graph-incidence-only");
  assert.ok(water.compartmentLevels[1].sourceEvidence.every(edge=>graph.edges.some(original=>original.id===edge.id)));
});

test("uncertain ancestors, plural parentage and cycles are not fabricated geometry",()=>{
  const simple=resourceChannelFixture();
  const open=channelResourceIncidence(simple.graph,{
    channel:simple.at.channel,relations:flowRoles,maxContainmentDepth:2,
  });
  assert.equal(open.obstructions.length,0);
  assert.ok(open.transfers.every(x=>x.compartmentLevels[1].crosses===null));
  assert.ok(open.transfers.every(x=>x.sourceLineage.stop==="unwitnessed-parent"));
  const divided=resourceChannelFixture({nested:true,divided:true});
  const multiple=channelResourceIncidence(divided.graph,{
    channel:divided.at.channel,relations:flowRoles,maxContainmentDepth:2,
  });
  assert.equal(multiple.transfers.length,0);
  assert.ok(multiple.obstructions.every(x=>x.failures.some(f=>f.role==="originLineage"||f.role==="destinationLineage")));
  assert.ok(multiple.obstructions.every(x=>x.failures.some(f=>f.kind==="ambiguous")));
  const cycle=resourceChannelFixture({nested:true,cyclic:true});
  const blocked=channelResourceIncidence(cycle.graph,{
    channel:cycle.at.channel,relations:flowRoles,maxContainmentDepth:3,
  });
  assert.equal(blocked.transfers.length,0);
  assert.ok(blocked.obstructions.every(x=>x.failures.some(f=>f.kind==="cycle")));
  assert.throws(()=>channelResourceIncidence(cycle.graph,{
    channel:cycle.at.channel,relations:flowRoles,maxContainmentDepth:9,
  }),/containment depth/);
});

test("typed Resource Things specialize channels, messages, exchanges and stock without role confusion", () => {
  // This fixture uses the ORIGINAL SignCell type system, not a new Graph/Craft
  // role ontology. Semantic role declarations supply the actual graph types.
  const mk = (id, parents = []) => accepted(defineType({
    id: "test.flow." + id + "@1", name: "Flow " + id,
    description: "Source-qualified distinct " + id + " data kind",
    schema: {}, parents,
  }));
  const thing = mk("Thing"), resource = mk("Resource", [thing]);
  assert.equal(isSubtypeOf(resource,thing),true);
  const channelType = mk("Channel", [resource]);
  const messageType = mk("Message", [resource]);
  const exchangeType = mk("Exchange", [resource]);
  const stockType = mk("Stock", [resource]);
  const actorType = mk("Actor", [resource]);
  const compartmentType = mk("Compartment", [thing]);
  const quantityType = mk("Quantity", [thing]);
  const witnessType = mk("Witness", [thing]);
  assert.equal(isSubtypeOf(messageType,thing),true);
  assert.equal(isSubtypeOf(exchangeType,resource),true);
  assert.equal(isSubtypeOf(compartmentType,resource),false);
  const marks = {
    channel: accepted(createTypedMark(channelType,"c:1")),
    message: accepted(createTypedMark(messageType,"m:1")),
    exchange: accepted(createTypedMark(exchangeType,"x:1")),
    stock: accepted(createTypedMark(stockType,"r:water")),
    source: accepted(createTypedMark(actorType,"a:source")),
    target: accepted(createTypedMark(actorType,"a:target")),
    insideA: accepted(createTypedMark(compartmentType,"cell:A")),
    insideB: accepted(createTypedMark(compartmentType,"cell:B")),
    amount: accepted(createTypedMark(quantityType,{atoms:"7",unit:"u:water"})),
    witness: accepted(createTypedMark(witnessType,"w:1")),
  };
  const at = Object.fromEntries(Object.entries(marks).map(([key,mark])=>[key,referenceOf(mark)]));
  const specs = [
    ["contains",channelType,messageType],
    ["reports",messageType,exchangeType],
    ["resource",exchangeType,stockType],
    ["from",exchangeType,actorType],
    ["to",exchangeType,actorType],
    ["quantity",exchangeType,quantityType],
    ["inside",actorType,compartmentType],
  ];
  const relation = ([id,domain,codomain]) => ({
    id,subjectTypes:[domain.id],objectTypes:[codomain.id],
    witnessTypes:[at.witness.type],
  });
  const relations = specs.map(relation);
  const link = (s,p,o) => ({subject:at[s],predicate:p,object:at[o],witness:at.witness});
  const edges = [
    link("channel","contains","message"),
    link("message","reports","exchange"),
    link("exchange","resource","stock"),
    link("exchange","from","source"),
    link("exchange","to","target"),
    link("exchange","quantity","amount"),
    link("source","inside","insideA"),
    link("target","inside","insideB"),
  ];
  const created = createSignGraph({cells:Object.values(marks),relations,edges});
  assert.equal(created.ok,true,JSON.stringify(created.refusal));
  const read = channelResourceIncidence(created.value,{
    channel:at.channel,
    relations:{contains:"contains",reports:"reports",resource:"resource",from:"from",
      to:"to",quantity:"quantity",inside:"inside"},
  });
  assert.equal(read.messages.length,1);
  assert.equal(read.transfers.length,1);
  assert.equal(read.transfers[0].resource.type,at.stock.type);
  assert.equal(read.transfers[0].quantity.type,at.amount.type);
  assert.equal(read.transfers[0].crossesCellBoundary,true);
  assert.equal(read.obstructions.length,0);

  const wrongSource = createSignGraph({
    cells:Object.values(marks),relations,
    edges:[link("stock","contains","message")],
  });
  assert.equal(wrongSource.ok,false,"a Resource Stock cannot masquerade as the declared Channel");
  assert.equal(wrongSource.refusal.code,"type-mismatch");
  assert.throws(()=>channelResourceIncidence(created.value,{
    channel:at.stock,
    relations:{contains:"contains",reports:"reports",resource:"resource",from:"from",to:"to"},
  }),/channel type/);
});


// Original SignGraph #26: unused channel routes and shared capacity sources.
// No amount in this fixture is a real reservation, transfer or authorization.
const optionKinds = Object.fromEntries(["channel","option","pool","resource","endpoint","compartment",
  "quantity","adverse","message","exchange","witness"].map(name => [name,
  accepted(defineType({id:`test.transport.${name}.v1`,name:`Transport ${name}`,
    description:`Source-specific ${name} mark`,schema:{},parents:[]}))]));
const optionRoles = Object.freeze({offers:"offers",resource:"resource",from:"from",to:"to",
  uses:"uses",capacityResource:"capacityResource",capacity:"capacity",inside:"inside",
  cost:"cost",opposes:"opposes",revokes:"revokes"});
const atTime = "2026-10-21T15:00:00.000Z";
function transportFixture({opposed=false,revoked=false,sharedCapMissing=false,
  sharedCapInvalidUnit=false,sharedCapNonStringUnit=false,sharedCapNonNfcUnit=false,sharedCapZero=false,sharedCapExpired=false,
  sharedCapFuture=false,sharedCapNoExpiry=false,sharedCapUndated=false,
  dualCapacity=false,foreignResource=false,noUses=false,costZero=false,
  priceDated=false,priceNonNfcUnit=false,noCompartments=false,ambiguousCompartments=false}={}) {
  const shared = {atoms:sharedCapZero?"0":"5",
    unit:sharedCapInvalidUnit?"":sharedCapNonStringUnit?42:sharedCapNonNfcUnit?"litre\u0301s":"liters",
    ...(!sharedCapUndated ? {
      observedAt:sharedCapFuture?"2026-10-22T00:00:00.000Z":"2026-10-20T00:00:00.000Z",
    } : {}),
    ...(!sharedCapNoExpiry && !sharedCapUndated ? {
      expiresAt:sharedCapExpired?"2026-10-20T12:00:00.000Z":"2026-10-22T00:00:00.000Z",
    } : {})};
  const items = {
    channel:["channel","channel:source"],a:["option","unused:option:a"],b:["option","unused:option:b"],
    shared:["pool","shared:bottleneck"],poolA:["pool","branch:a"],poolB:["pool","branch:b"],
    water:["resource","resource:water"],energy:["resource","resource:energy"],
    alice:["endpoint","actor:alice"],bob:["endpoint","actor:bob"],
    cellA:["compartment","cell:A"],cellB:["compartment","cell:B"],cellC:["compartment","cell:C"],
    capShared:["quantity",shared],capAlternative:["quantity",{atoms:"9",unit:"liters"}],
    capA:["quantity",{atoms:"5",unit:"liters"}],capB:["quantity",{atoms:"5",unit:"liters"}],
    price:["quantity",{atoms:costZero?"0":"1",unit:priceNonNfcUnit?"cre\u0301dits":"credits",
      ...(priceDated ? {observedAt:"2026-10-20T00:00:00.000Z"} : {})}],
    adversary:["adverse","counter-testimony"],revocation:["adverse","withdrawal testimony"],
    message:["message","reported-message:1"],exchange:["exchange","reported-exchange:1"],
    witnessA:["witness","source:one"],witnessB:["witness","source:two"],
  };
  const cells=Object.fromEntries(Object.entries(items).map(([key,[type,value]])=>
    [key,accepted(createTypedMark(optionKinds[type],value))]));
  const at=Object.fromEntries(Object.entries(cells).map(([key,value])=>[key,referenceOf(value)]));
  const predicates = {
    offers:[["channel"],["option"]], resource:[["option","exchange"],["resource"]],
    from:[["option","exchange"],["endpoint"]], to:[["option","exchange"],["endpoint"]],
    uses:[["option"],["pool"]],capacityResource:[["pool"],["resource"]],
    capacity:[["pool"],["quantity"]],cost:[["option"],["quantity"]],
    inside:[["endpoint"],["compartment"]],
    opposes:[["option"],["adverse"]],revokes:[["option"],["adverse"]],
    contains:[["channel"],["message"]],reports:[["message"],["exchange"]],
    quantity:[["exchange"],["quantity"]],
  };
  const relations=Object.entries(predicates).map(([id,[s,o]])=>({id,
    subjectTypes:s.map(name=>optionKinds[name].id),objectTypes:o.map(name=>optionKinds[name].id),
    witnessTypes:[optionKinds.witness.id]}));
  const link=(s,p,o,w="witnessA")=>({subject:at[s],predicate:p,object:at[o],witness:at[w]});
  const edges=[
    link("channel","offers","a"),link("channel","offers","a","witnessB"),
    link("channel","offers","b"),
    link("a","resource","water"),link("a","from","alice"),link("a","to","bob"),
    link("b","resource","water"),link("b","from","bob"),link("b","to","alice"),
    ...(!noCompartments?[link("alice","inside","cellA"),link("bob","inside","cellB")]:[]),
    ...(ambiguousCompartments?[link("alice","inside","cellC")]:[]),
    ...(!noUses?[link("a","uses","shared"),link("a","uses","poolA"),
      link("b","uses","shared"),link("b","uses","poolB")]:[]),
    link("shared","capacityResource",foreignResource?"energy":"water"),
    ...(!sharedCapMissing?[link("shared","capacity","capShared")]:[]),
    ...(dualCapacity?[link("shared","capacity","capAlternative")]:[]),
    link("poolA","capacityResource","water"),link("poolA","capacity","capA"),
    link("poolB","capacityResource","water"),link("poolB","capacity","capB"),
    link("a","cost","price"),
    ...(opposed?[link("b","opposes","adversary")]:[]),
    ...(revoked?[link("b","revokes","revocation")]:[]),
    // One actually reported Exchange, entirely separate from two offers.
    link("channel","contains","message"),link("message","reports","exchange"),
    link("exchange","resource","water"),link("exchange","from","alice"),
    link("exchange","to","bob"),link("exchange","quantity","capA"),
  ];
  // Equal original typed Marks have one content address, even when two
  // distinct capacity sources point to the same exact quantity value.
  const uniqueCells = [...new Map(Object.values(cells).map(cell=>[cell.id,cell])).values()];
  return {graph:accepted(createSignGraph({cells:uniqueCells,relations,edges})),at};
}
const readOptions=(fixture,extra={})=>channelTransportPossibilities(fixture.graph,{
  channel:fixture.at.channel,relations:optionRoles,quantityType:optionKinds.quantity.id,
  observedAt:atTime,...extra});

test("source-witnessed unused offers preserve both alternatives and one shared capacity identity",()=>{
  const fixture=transportFixture();
  const reading=readOptions(fixture);
  assert.equal(reading.kind,"signgraph.channelTransportPossibilities.v1");
  assert.equal(reading.possibilities.length,2);
  assert.deepEqual(reading.obstructions,[]);
  assert.equal(reading.capacitySources.length,3,"the same shared source is not cloned per route");
  const a=reading.possibilities.find(option=>option.option.id===fixture.at.a.id);
  const b=reading.possibilities.find(option=>option.option.id===fixture.at.b.id);
  assert.equal(a.evidence.offers.length,2,"two report witnesses do not double the offer");
  const sharedA=a.capacitySources.find(x=>x.source.id===fixture.at.shared.id);
  const sharedB=b.capacitySources.find(x=>x.source.id===fixture.at.shared.id);
  assert.equal(sharedA,sharedB,"both routes must use the identical source-backed bottleneck reading");
  assert.deepEqual(sharedA.capacity,{atoms:"5",unit:"liters",
    observedAt:"2026-10-20T00:00:00.000Z",expiresAt:"2026-10-22T00:00:00.000Z"});
  assert.equal(sharedA.evidence.capacity[0].edges[0].id,
    fixture.graph.edges.find(x=>x.edge.subject.id===fixture.at.shared.id&&x.edge.predicate==="capacity").id);
  assert.equal(a.standing,"source-offered-only-not-authorized");
  assert.equal(a.sourceCell.id,fixture.at.cellA.id);
  assert.equal(a.targetCell.id,fixture.at.cellB.id);
  assert.equal(b.sourceCell.id,fixture.at.cellB.id);
  assert.equal(b.targetCell.id,fixture.at.cellA.id);
  assert.equal(a.crossesCellBoundary,true);
  assert.equal(reading.competence,"not-established");
  assert.equal(reading.effects,"not-performed");
  const historical=channelResourceIncidence(fixture.graph,{channel:fixture.at.channel,
    relations:{contains:"contains",reports:"reports",resource:"resource",from:"from",to:"to",quantity:"quantity"}});
  assert.equal(historical.transfers.length,1,"only the actual original Exchange is counted historically");
  assert.equal(reading.possibilities.length,2,"an unused option remains discoverable");
  assert.deepEqual(readOptions({graph:JSON.parse(JSON.stringify(fixture.graph)),at:fixture.at}),reading,
    "wire round trip keeps original source identities and exact quantity strings");
});

test("contrary and revoked testimony obstruct individual candidates and retain source evidence",()=>{
  for (const key of ["opposed","revoked"]) {
    const f=transportFixture({[key]:true});
    const r=readOptions(f);
    assert.equal(r.possibilities.length,1);
    assert.equal(r.obstructions.length,1);
    assert.equal(r.obstructions[0].option.id,f.at.b.id);
    const role=key==="opposed"?"opposes":"revokes";
    assert.ok(r.obstructions[0].failures.some(x=>x.role===role));
    assert.ok(r.obstructions[0].evidence[role].every(x=>x.edges.every(e=>
      f.graph.edges.some(original=>original.id===e.id))));
    assert.equal(r.obstructions[0].reservation,"not-checked");
  }
});

test("missing, ambiguous or malformed capacity cannot silently become zero or authorization",()=>{
  for (const [modifier,kind] of [
    ["sharedCapMissing","missing"],["sharedCapInvalidUnit","unqualified-exact-quantity"],
    ["sharedCapNonStringUnit","unqualified-exact-quantity"],
    ["dualCapacity","ambiguous"],["foreignResource","resource-mismatch"],
    ["noUses","missing"],["sharedCapZero","reported-zero-capacity"],
    ["noCompartments","missing"],["ambiguousCompartments","ambiguous"],
  ]) {
    const f=transportFixture({[modifier]:true});
    const r=readOptions(f);
    assert.equal(r.possibilities.length,0,modifier);
    assert.equal(r.obstructions.length,2,modifier);
    assert.ok(r.obstructions.every(o=>o.failures.some(e=>e.kind===kind)),modifier);
    assert.equal(r.effects,"not-performed");
  }
  const f=transportFixture({costZero:true});
  const r=readOptions(f);
  assert.equal(r.possibilities.length,2,"zero exact cost is valid, unlike zero capacity");
  assert.equal(r.possibilities.find(option=>option.option.id===f.at.a.id).cost.atoms,"0");
});

test("native typed Marks canonicalize unit text before transport retains source identity",()=>{
  const decomposition = transportFixture({sharedCapNonNfcUnit:true});
  const source = readOptions(decomposition);
  assert.equal(source.possibilities.length,2);
  assert.equal(source.obstructions.length,0);
  const shared=source.capacitySources.find(entry=>entry.source.id===decomposition.at.shared.id);
  assert.equal(shared.capacity.unit,"litre\u0301s".normalize("NFC"));
  const sameQuantity=accepted(createTypedMark(optionKinds.quantity,{
    atoms:"5",unit:"litre\u0301s".normalize("NFC"),
    observedAt:"2026-10-20T00:00:00.000Z",expiresAt:"2026-10-22T00:00:00.000Z",
  }));
  assert.equal(shared.quantity.id,sameQuantity.id,
    "canonical Unicode is the original typed Mark identity, not a new capacity source");
  assert.equal(source.effects,"not-performed");

  const costFixture = transportFixture({priceNonNfcUnit:true});
  const cost = readOptions(costFixture);
  assert.equal(cost.possibilities.length,2);
  assert.equal(cost.obstructions.length,0);
  assert.equal(cost.possibilities.find(option=>option.option.id===costFixture.at.a.id).cost.unit,
    "cre\u0301dits".normalize("NFC"));
  assert.equal(readOptions(transportFixture()).possibilities.length,2,
    "ordinary canonical units remain source-eligible without inventing conversion");
});

test("expired, future or unclocked source claims cannot impersonate presently admissible routes",()=>{
  for (const [modifier,kind] of [["sharedCapExpired","expired"],["sharedCapFuture","not-yet-observed"]]) {
    const f=transportFixture({[modifier]:true});
    const r=readOptions(f);
    assert.equal(r.possibilities.length,0,modifier);
    assert.ok(r.obstructions.every(o=>o.failures.some(x=>x.kind===kind)),modifier);
  }
  const f=transportFixture();
  const clockUnknown=readOptions(f,{observedAt:null});
  assert.equal(clockUnknown.possibilities.length,0);
  assert.ok(clockUnknown.obstructions.every(o=>o.failures.some(x=>x.kind==="clock-unavailable")));
  assert.throws(()=>readOptions(f,{observedAt:"2026-10-21T15:00:00-05:00"}),/UTC instant/);
});

test("dated capacity and dated cost without expiry refuse clockless evaluation",()=>{
  // Previous provider accepted an October 20 reported capacity as presently
  // eligible with observedAt:null merely because no expiresAt was declared.
  const capacity = transportFixture({sharedCapNoExpiry:true});
  const noClock = readOptions(capacity,{observedAt:null});
  assert.equal(noClock.possibilities.length,0);
  assert.equal(noClock.obstructions.length,2);
  assert.ok(noClock.obstructions.every(o=>o.failures.some(f=>
    f.role==="capacity" && f.kind==="clock-unavailable")));
  const withClock = readOptions(capacity);
  assert.equal(withClock.possibilities.length,2);
  assert.equal(withClock.capacitySources.find(s=>s.source.id===capacity.at.shared.id)
    .capacity.expiresAt,null,"a missing expiry remains missing, not fabricated");

  // Make all capacity claims timeless to isolate an otherwise unused dated
  // cost: the same source-clock law must apply without inferring payment.
  const cost = transportFixture({sharedCapUndated:true,priceDated:true});
  const unqualifiedCost = readOptions(cost,{observedAt:null});
  assert.equal(unqualifiedCost.possibilities.length,1,
    "only the route with the dated cost must refuse");
  assert.equal(unqualifiedCost.obstructions.length,1);
  assert.ok(unqualifiedCost.obstructions[0].failures.some(f=>
    f.role==="cost" && f.kind==="clock-unavailable"));
  assert.equal(readOptions(cost).possibilities.length,2);
});

test("shared-bottleneck experiment rejects 15 false independent-route admissions across 49 demand pairs",()=>{
  const f=transportFixture(), r=readOptions(f), options=r.possibilities;
  assert.equal(options.length,2);
  const sourceDemandAdmits=(demands)=>{
    const total=new Map();
    for(let k=0;k<demands.length;k++) {
      for(const source of options[k].capacitySources){
        const key=source.source.id;
        const previous=total.get(key)?.amount??0n;
        total.set(key,{amount:previous+BigInt(demands[k]),capacity:BigInt(source.capacity.atoms),
          resource:source.resource.id,unit:source.capacity.unit});
      }
    }
    return [...total.values()].every(x=>x.amount<=x.capacity);
  };
  let falseAdmissions=0, naiveAdmits=0, correctAdmits=0;
  for(let x=0;x<=6;x++)for(let y=0;y<=6;y++){
    const requests=[x,y];
    const naive=requests.every((d,i)=>options[i].capacitySources.every(
      s=>BigInt(d)<=BigInt(s.capacity.atoms)));
    const correct=sourceDemandAdmits(requests);
    if(naive)naiveAdmits++;
    if(correct)correctAdmits++;
    if(naive&&!correct)falseAdmissions++;
    assert.ok(!correct||naive,"aggregate admission can never exceed local feasibility");
  }
  assert.equal(naiveAdmits,36);
  assert.equal(correctAdmits,21);
  assert.equal(falseAdmissions,15);
  assert.equal(sourceDemandAdmits([4,4]),false);
  assert.equal(sourceDemandAdmits([3,2]),true);
  // This test's aggregation is an oracle, not a SignGraph reservation API.
});

test("source-refusal, relation spoofing, and finite budget protect the graph boundary",()=>{
  const f=transportFixture();
  const corrupt=JSON.parse(JSON.stringify(f.graph));corrupt.edges[0].id="ni:forged";
  assert.throws(()=>readOptions({graph:corrupt,at:f.at}),TypeError);
  assert.throws(()=>readOptions({graph:f.graph,at:{...f.at,channel:f.at.shared}}),/channel is not/);
  assert.throws(()=>readOptions(f,{relations:{...optionRoles,grants:"grants"}}),/roles/);
  assert.throws(()=>readOptions(f,{relations:{...optionRoles,uses:"offers"}}),/roles/);
  assert.throws(()=>readOptions(f,{maxOptions:1}),/option bound/);
  assert.throws(()=>readOptions(f,{maxSources:2}),/capacity-source bound/);
  assert.throws(()=>readOptions(f,{maxEdges:3}),/witnessed-edge bound/);
  assert.equal(readOptions(f,{quantityType:"undocumented type"}).possibilities.length,0);
  // A misdeclared Quantity type cannot establish exact measured capacity.
  assert.equal(channelTransportPossibilities(f.graph,{channel:f.at.channel,
    relations:optionRoles,quantityType:optionKinds.endpoint.id,observedAt:atTime}).possibilities.length,0);
});


function stockAmbiguityFixture({broken=false,otherResource=false,disputed=false,selfLoop=false}={}) {
  const roles={contains:"contains",reports:"reports",resource:"resource",from:"from",to:"to"};
  const names=["channel","m1","m2","e1","e2","e3","water","energy","A","B","C","D","w1","w2"];
  const marks=names.map(s=>accepted(createTypedMark(t,s)));
  const at=Object.fromEntries(names.map((name,i)=>[name,referenceOf(marks[i])]));
  const edge=(from,predicate,to,witness="w1")=>({
    subject:at[from],predicate:roles[predicate],object:at[to],witness:at[witness],
  });
  const edges=[
    edge("channel","contains","m1"),edge("channel","contains","m2"),
    edge("m1","reports","e1"),edge("m1","reports","e2"),
    edge("m1","reports","e3"),edge("m2","reports","e1","w2"),
    edge("e1","resource","water"),edge("e1","from","A"),edge("e1","to","B"),
    edge("e2","resource","water"),edge("e2","from","B"),edge("e2","to","C"),
    edge("e3","resource",otherResource?"energy":"water"),
    edge("e3","from",selfLoop?"A":"C"),
    edge("e3","to",selfLoop?"A":broken?"D":"A"),
    ...(disputed?[edge("e3","to","D","w2")]:[]),
  ];
  const graph=accepted(createSignGraph({cells:marks,
    relations:Object.values(roles).map(id=>({
      id,subjectTypes:[t.id],objectTypes:[t.id],witnessTypes:[t.id]})),edges}));
  return {graph,at,roles};
}

test("source-witnessed directed resource cycle makes stock-only circulation inference conditional",()=>{
  const {graph,at,roles}=stockAmbiguityFixture();
  const before=JSON.stringify(graph);
  const found=channelStockFlowAmbiguity(graph,{channel:at.channel,relations:roles});
  assert.equal(found.kind,"signgraph.channelStockFlowAmbiguity.v1");
  assert.equal(found.graph,graph.id);
  assert.equal(found.resources.length,1);
  assert.deepEqual(found.obstructions,[]);
  const water=found.resources[0];
  assert.equal(water.exchangeCount,3,"two message reports are not two exchanges");
  assert.equal(water.resource.id,at.water.id);
  assert.deepEqual(new Set(water.cycleTransfers.map(t=>t.exchange.id)),
    new Set([at.e1.id,at.e2.id,at.e3.id]));
  assert.equal(water.stockOnlyIdentifiability,"not-identifiable-if-these-cyclic-arcs-are-feasible");
  assert.equal(water.realizedFlux,"not-observed");
  assert.equal(found.actualCirculation,"not-established");
  assert.equal(found.independentEdgeFlux,"not-supplied");
  assert.equal(found.endogenousClock,"not-established");
  assert.ok(water.cycleTransfers.every(t=>t.evidence.from[0].edges.every(
    e=>graph.edges.some(original=>original.id===e.id))));
  assert.equal(JSON.stringify(graph),before);
  assert.deepEqual(channelStockFlowAmbiguity(wire(graph),{channel:at.channel,relations:roles}),found);
});
test("no directed same-resource witness is unknown, and invalid source never passes",()=>{
  for(const options of [{broken:true},{otherResource:true},{disputed:true}]) {
    const {graph,at,roles}=stockAmbiguityFixture(options);
    const found=channelStockFlowAmbiguity(graph,{channel:at.channel,relations:roles});
    assert.ok(found.resources.every(r=>r.cycleTransfers===null));
    assert.ok(found.resources.every(r=>
      r.stockOnlyIdentifiability==="undetermined-without-complete-source-and-effect-law"));
    if(options.disputed)assert.equal(found.obstructions.length,1);
    assert.equal(found.actualCirculation,"not-established");
  }
  const {graph,at,roles}=stockAmbiguityFixture({selfLoop:true});
  assert.equal(channelStockFlowAmbiguity(graph,{channel:at.channel,relations:roles})
    .resources[0].cycleTransfers.length,1);
  const forged=wire(graph);forged.edges[0].id="ni:forged";
  assert.throws(()=>channelStockFlowAmbiguity(forged,{channel:at.channel,relations:roles}),TypeError);
});

test("acyclic diamond preserves undetermined stock-only route identification even with balanced ports",()=>{
  // Science #215 §7.19: no directed cycle, but two different performed
  // edge-flow histories can produce identical signed node changes.
  const roles={contains:"contains",reports:"reports",resource:"resource",from:"from",to:"to"};
  const names=["channel","message","exchange-ab","exchange-bd","exchange-ac","exchange-cd",
    "resource","A","B","C","D","witness"];
  const marks=names.map(name=>accepted(createTypedMark(t,name)));
  const at=Object.fromEntries(names.map((name,i)=>[name,referenceOf(marks[i])]));
  const edge=(from,predicate,to)=>({
    subject:at[from],predicate:roles[predicate],object:at[to],witness:at.witness,
  });
  const directed=[["exchange-ab","A","B"],["exchange-bd","B","D"],
    ["exchange-ac","A","C"],["exchange-cd","C","D"]];
  const edges=[edge("channel","contains","message")];
  for(const [exchange,from,to] of directed)edges.push(
    edge("message","reports",exchange),
    edge(exchange,"resource","resource"),
    edge(exchange,"from",from),edge(exchange,"to",to));
  const graph=accepted(createSignGraph({
    cells:marks,
    relations:Object.values(roles).map(id=>({
      id,subjectTypes:[t.id],objectTypes:[t.id],witnessTypes:[t.id],
    })),edges,
  }));
  const reading=channelStockFlowAmbiguity(graph,{channel:at.channel,relations:roles});
  assert.equal(reading.resources.length,1);
  assert.equal(reading.resources[0].exchangeCount,4);
  assert.equal(reading.resources[0].cycleTransfers,null);
  assert.equal(reading.resources[0].stockOnlyIdentifiability,
    "undetermined-without-complete-source-and-effect-law");
  assert.equal(reading.actualCirculation,"not-established");
  // Ordered flow along A→B→D vs A→C→D, both with throughput two.
  const stockDelta=flows=>{
    const change=new Map(["A","B","C","D"].map(name=>[name,0]));
    for(let i=0;i<directed.length;i++){
      const [,source,target]=directed[i];
      change.set(source,change.get(source)-flows[i]);
      change.set(target,change.get(target)+flows[i]);
    }
    return [...change.values()];
  };
  const upper=[1,1,0,0],lower=[0,0,1,1];
  assert.deepEqual(stockDelta(upper),[-1,0,0,1]);
  assert.deepEqual(stockDelta(lower),[-1,0,0,1]);
  assert.equal(upper.reduce((n,q)=>n+q,0),lower.reduce((n,q)=>n+q,0));
  assert.notDeepEqual(upper,lower);
});


test("individual meter placement is hypothetical and deduplicates source-reported exchanges",()=>{
  const {graph,at,roles}=stockAmbiguityFixture();
  const query={channel:at.channel,relations:roles};
  const empty=channelFlowWitnessPlacement(graph,query);
  assert.equal(empty.kind,"signgraph.channelFlowWitnessPlacement.v1");
  assert.equal(empty.proposalOnly,true);
  assert.equal(empty.physicalMeterReadings,"not-supplied");
  assert.equal(empty.actorBodyAndClock,"not-established");
  assert.deepEqual(empty.obstructions,[]);
  assert.equal(empty.resources.length,1);
  const water=empty.resources[0];
  assert.equal(water.exchangeCount,3,"m2 reporting e1 must not be a fourth exchange");
  assert.equal(water.minimumIndependentEdgeMeterCount,1);
  assert.equal(water.unmeteredComplementIsUndirectedForest,false);
  assert.equal(water.unmeteredCycleClosingTransfers.length,1);
  const proposed=channelFlowWitnessPlacement(graph,{
    ...query,proposedWitnessExchangeIds:[at.e2.id],
  });
  assert.equal(proposed.resources[0].proposedIndividualEdgeMeters[0].id,at.e2.id);
  assert.equal(proposed.resources[0].unmeteredComplementIsUndirectedForest,true);
  assert.equal(proposed.resources[0].structuralCondition,
    "conditional-linear-observation-full-rank-if-all-premises-hold");
  assert.equal(proposed.originalGraphCompleteness,"not-attested");
  assert.equal(proposed.nodeStocksAndExternalPorts,"not-supplied");
  assert.deepEqual(channelFlowWitnessPlacement(wire(graph),{
    ...query,proposedWitnessExchangeIds:[at.e2.id],
  }),proposed);
  assert.throws(()=>channelFlowWitnessPlacement(graph,{
    ...query,proposedWitnessExchangeIds:[at.e1.id,at.e1.id],
  }),/unique original exchange IDs/);
  assert.throws(()=>channelFlowWitnessPlacement(graph,{
    ...query,proposedWitnessExchangeIds:["ni:forged"],
  }),/one admitted channel exchange/);
  assert.throws(()=>channelFlowWitnessPlacement(graph,{
    ...query,proposedWitnessExchangeIds:"metered",
  }),/unique original exchange IDs/);
  const invalid=wire(graph);invalid.edges[0].id="ni:forged";
  assert.throws(()=>channelFlowWitnessPlacement(invalid,query),TypeError);
});

test("two same-loop meters fail on figure-eight, two chord meters suffice structurally",()=>{
  const roles={contains:"contains",reports:"reports",resource:"resource",from:"from",to:"to"};
  const edgesOf=[["ab","A","B"],["bc","B","C"],["ca","C","A"],
    ["ad","A","D"],["de","D","E"],["ea","E","A"]];
  const names=["channel","m","water","w","A","B","C","D","E",...edgesOf.map(x=>x[0])];
  const marks=names.map(name=>accepted(createTypedMark(t,name)));
  const at=Object.fromEntries(names.map((name,i)=>[name,referenceOf(marks[i])]));
  const edge=(from,role,to)=>({subject:at[from],predicate:roles[role],
    object:at[to],witness:at.w});
  const edges=[edge("channel","contains","m")];
  for(const [id,from,to] of edgesOf)edges.push(edge("m","reports",id),
    edge(id,"resource","water"),edge(id,"from",from),edge(id,"to",to));
  const graph=accepted(createSignGraph({cells:marks,
    relations:Object.values(roles).map(id=>({
      id,subjectTypes:[t.id],objectTypes:[t.id],witnessTypes:[t.id],
    })),edges}));
  const query={channel:at.channel,relations:roles};
  const baseline=channelFlowWitnessPlacement(graph,query);
  assert.equal(baseline.resources[0].exchangeCount,6);
  assert.equal(baseline.resources[0].minimumIndependentEdgeMeterCount,2);
  assert.equal(baseline.resources[0].unmeteredCycleClosingTransfers.length,2);
  const poor=channelFlowWitnessPlacement(graph,{
    ...query,proposedWitnessExchangeIds:[at.ab.id,at.bc.id],
  });
  assert.equal(poor.resources[0].unmeteredComplementIsUndirectedForest,false,
    "two meter count is necessary but placement on one loop is insufficient");
  const right=channelFlowWitnessPlacement(graph,{
    ...query,proposedWitnessExchangeIds:[at.ca.id,at.ea.id],
  });
  assert.equal(right.resources[0].unmeteredComplementIsUndirectedForest,true);
  assert.equal(right.resources[0].unmeteredCycleClosingTransfers.length,0);
});

test("separate resources, self-loops, and truly parallel exchanges preserve the cycle rank",()=>{
  const separated=stockAmbiguityFixture({otherResource:true});
  const r=channelFlowWitnessPlacement(separated.graph,{
    channel:separated.at.channel,relations:separated.roles,
  });
  assert.equal(r.resources.length,2);
  assert.ok(r.resources.every(x=>x.minimumIndependentEdgeMeterCount===0));
  const loop=stockAmbiguityFixture({selfLoop:true});
  const q={channel:loop.at.channel,relations:loop.roles};
  const candidate=channelFlowWitnessPlacement(loop.graph,q);
  assert.equal(candidate.resources[0].minimumIndependentEdgeMeterCount,1);
  assert.equal(candidate.resources[0].unmeteredComplementIsUndirectedForest,false);
  assert.equal(channelFlowWitnessPlacement(loop.graph,{
    ...q,proposedWitnessExchangeIds:[loop.at.e3.id],
  }).resources[0].unmeteredComplementIsUndirectedForest,true);
  const roles={contains:"contains",reports:"reports",resource:"resource",from:"from",to:"to"};
  const names=["ch","m1","m2","ex1","ex2","r","A","B","w"];
  const marks=names.map(name=>accepted(createTypedMark(t,name)));
  const at=Object.fromEntries(names.map((name,i)=>[name,referenceOf(marks[i])]));
  const e=(s,p,o)=>({subject:at[s],predicate:roles[p],object:at[o],witness:at.w});
  const edges=[e("ch","contains","m1"),e("ch","contains","m2"),
    e("m1","reports","ex1"),e("m2","reports","ex1"),e("m2","reports","ex2")];
  for(const id of ["ex1","ex2"])edges.push(
    e(id,"resource","r"),e(id,"from","A"),e(id,"to","B"));
  const g=accepted(createSignGraph({cells:marks,
    relations:Object.values(roles).map(id=>({
      id,subjectTypes:[t.id],objectTypes:[t.id],witnessTypes:[t.id],
    })),edges}));
  const qq={channel:at.ch,relations:roles};
  const p=channelFlowWitnessPlacement(g,qq);
  assert.equal(p.resources[0].exchangeCount,2,"two EXCHANGES are distinct");
  assert.equal(p.resources[0].minimumIndependentEdgeMeterCount,1,
    "parallel original exchanges make an undirected two-edge cycle");
  assert.equal(channelFlowWitnessPlacement(g,{
    ...qq,proposedWitnessExchangeIds:[at.ex1.id],
  }).resources[0].unmeteredComplementIsUndirectedForest,true);
});


test("source-limited vertex observations require an anchored forest, not a plain forest",()=>{
  const {graph,at,roles}=stockAmbiguityFixture({broken:true});
  // This fixture is the original resource path A->B->C->D.
  const q={channel:at.channel,relations:roles};
  const all=channelFlowWitnessPlacement(graph,q);
  assert.equal(all.resources[0].minimumIndependentEdgeMeterCount,0);
  assert.equal(all.resources[0].unmeteredComplementIsUndirectedForest,true);
  assert.equal(all.vertexCoverageAssumption,
    "all-admitted-exchange-endpoints-hypothetically-observed");
  const onlyB=channelFlowWitnessPlacement(graph,{
    ...q,proposedObservedCompartmentIds:[at.B.id],
  });
  assert.equal(onlyB.resources[0].minimumEdgeMeterCountWithFullVertexCoverage,0);
  assert.equal(onlyB.resources[0].minimumIndependentEdgeMeterCount,2);
  assert.equal(onlyB.resources[0].unmeteredComplementIsUndirectedForest,true);
  assert.equal(onlyB.resources[0].unmeteredComplementHasAtMostOneUnobservedVertexPerTree,false);
  assert.equal(onlyB.resources[0].unmeteredCycleClosingTransfers.length,2);
  assert.equal(onlyB.resources[0].structuralCondition,"conditional-linear-observation-has-kernel");
  assert.equal(onlyB.vertexCoverageAssumption,"explicit-proposed-observed-endpoints-not-measured");

  const enough=channelFlowWitnessPlacement(graph,{
    ...q,proposedObservedCompartmentIds:[at.B.id],
    proposedWitnessExchangeIds:[at.e1.id,at.e3.id],
  });
  assert.equal(enough.resources[0].unmeteredComplementIsUndirectedForest,true);
  assert.equal(enough.resources[0].unmeteredComplementHasAtMostOneUnobservedVertexPerTree,true);
  assert.equal(enough.resources[0].structuralCondition,
    "conditional-linear-observation-full-rank-if-all-premises-hold");
  assert.deepEqual(enough.resources[0].proposedObservedCompartmentIds,[at.B.id]);
  assert.equal(enough.physicalMeterReadings,"not-supplied");

  const knownThree=channelFlowWitnessPlacement(graph,{
    ...q,proposedObservedCompartmentIds:[at.A.id,at.B.id,at.C.id],
  });
  assert.equal(knownThree.resources[0].minimumIndependentEdgeMeterCount,0);
  assert.equal(knownThree.resources[0].unmeteredComplementHasAtMostOneUnobservedVertexPerTree,true);
  const noStocks=channelFlowWitnessPlacement(graph,{
    ...q,proposedObservedCompartmentIds:[],
  });
  assert.equal(noStocks.resources[0].minimumIndependentEdgeMeterCount,3);
  assert.equal(noStocks.resources[0].unmeteredComplementHasAtMostOneUnobservedVertexPerTree,false);
  const everyEdge=channelFlowWitnessPlacement(graph,{
    ...q,proposedObservedCompartmentIds:[],
    proposedWitnessExchangeIds:[at.e1.id,at.e2.id,at.e3.id],
  });
  assert.equal(everyEdge.resources[0].unmeteredComplementHasAtMostOneUnobservedVertexPerTree,true);
  assert.deepEqual(channelFlowWitnessPlacement(wire(graph),{
    ...q,proposedObservedCompartmentIds:[at.B.id],
    proposedWitnessExchangeIds:[at.e1.id,at.e3.id],
  }),enough);
  assert.throws(()=>channelFlowWitnessPlacement(graph,{
    ...q,proposedObservedCompartmentIds:[at.B.id,at.B.id],
  }),/unique original endpoint IDs/);
  assert.throws(()=>channelFlowWitnessPlacement(graph,{
    ...q,proposedObservedCompartmentIds:["ni:forged"],
  }),/one admitted exchange endpoint/);
  assert.throws(()=>channelFlowWitnessPlacement(graph,{
    ...q,proposedObservedCompartmentIds:{observed:at.B.id},
  }),/unique original endpoint IDs/);
});

test("observed vertex coverage is original Resource-scoped, not inherited from a shared endpoint",()=>{
  const {graph,at,roles}=stockAmbiguityFixture({otherResource:true});
  const q={channel:at.channel,relations:roles};
  assert.throws(()=>channelFlowWitnessPlacement(graph,{
    ...q,proposedObservedCompartmentIds:[at.B.id],
  }),/multi-resource observations require resource-scoped endpoint IDs/);
  assert.throws(()=>channelFlowWitnessPlacement(graph,{
    ...q,proposedObservedCompartmentIds:[at.A.id,at.B.id,at.C.id],
  }),/multi-resource observations require resource-scoped endpoint IDs/);
  const waterAtB={...q,proposedObservedCompartmentIdsByResource:{
    [at.water.id]:[at.B.id],
  }};
  const r=channelFlowWitnessPlacement(graph,waterAtB);
  assert.equal(r.resources.length,2);
  assert.equal(r.proposalOnly,true);
  assert.equal(r.vertexCoverageAssumption,
    "explicit-resource-scoped-proposed-observed-endpoints-not-measured");
  const water=r.resources.find(row=>row.resource.id===at.water.id);
  const energy=r.resources.find(row=>row.resource.id===at.energy.id);
  assert.equal(water.exchangeCount,2);
  assert.equal(water.minimumIndependentEdgeMeterCount,1);
  assert.deepEqual(water.proposedObservedCompartmentIds,[at.B.id]);
  assert.equal(energy.exchangeCount,1);
  assert.equal(energy.minimumIndependentEdgeMeterCount,1);
  assert.deepEqual(energy.proposedObservedCompartmentIds,[]);
  assert.equal(energy.unmeteredComplementHasAtMostOneUnobservedVertexPerTree,false);
  assert.deepEqual(channelFlowWitnessPlacement(wire(graph),waterAtB),r);

  // C is an endpoint shared by water (B->C) and energy (C->A).
  // Observing energy at C adds no water stock equation, even though both
  // resources share the same original compartment identity.
  const energyAtC=channelFlowWitnessPlacement(graph,{
    ...q,proposedObservedCompartmentIdsByResource:{
      [at.energy.id]:[at.C.id],
    },
  });
  const w=energyAtC.resources.find(row=>row.resource.id===at.water.id);
  const e=energyAtC.resources.find(row=>row.resource.id===at.energy.id);
  assert.deepEqual(w.proposedObservedCompartmentIds,[]);
  assert.equal(w.minimumIndependentEdgeMeterCount,2);
  assert.equal(w.structuralCondition,"conditional-linear-observation-has-kernel");
  assert.deepEqual(e.proposedObservedCompartmentIds,[at.C.id]);
  assert.equal(e.minimumIndependentEdgeMeterCount,0);
  assert.equal(e.structuralCondition,
    "conditional-linear-observation-full-rank-if-all-premises-hold");
  const satisfied=channelFlowWitnessPlacement(graph,{
    ...q,proposedObservedCompartmentIdsByResource:{[at.energy.id]:[at.C.id]},
    proposedWitnessExchangeIds:[at.e1.id,at.e2.id],
  });
  assert.ok(satisfied.resources.every(row=>
    row.structuralCondition==="conditional-linear-observation-full-rank-if-all-premises-hold"));

  const both=channelFlowWitnessPlacement(graph,{
    ...q,proposedObservedCompartmentIdsByResource:{
      [at.water.id]:[at.A.id,at.B.id,at.C.id],
      [at.energy.id]:[at.C.id,at.A.id],
    },
  });
  assert.ok(both.resources.every(row=>row.minimumIndependentEdgeMeterCount===0));
  // The explicit no-stocks case is safe even for many resources.
  const none=channelFlowWitnessPlacement(graph,{
    ...q,proposedObservedCompartmentIds:[],
  });
  assert.ok(none.resources.every(row=>row.proposedObservedCompartmentIds.length===0));
  assert.equal(none.resources.find(row=>row.resource.id===at.water.id)
    .minimumIndependentEdgeMeterCount,2);
  assert.throws(()=>channelFlowWitnessPlacement(graph,{
    ...q,proposedObservedCompartmentIdsByResource:{[at.energy.id]:[at.B.id]},
  }),/does not belong to that resource/);
  assert.throws(()=>channelFlowWitnessPlacement(graph,{
    ...q,proposedObservedCompartmentIdsByResource:{"ni:forged":[at.C.id]},
  }),/does not name one admitted resource/);
  assert.throws(()=>channelFlowWitnessPlacement(graph,{
    ...q,proposedObservedCompartmentIdsByResource:{[at.water.id]:[at.B.id,at.B.id]},
  }),/unique resource-scoped endpoint IDs/);
  assert.throws(()=>channelFlowWitnessPlacement(graph,{
    ...q,proposedObservedCompartmentIdsByResource:{[at.water.id]:"B"},
  }),/resource-scoped endpoint IDs/);
  assert.throws(()=>channelFlowWitnessPlacement(graph,{
    ...q,proposedObservedCompartmentIds:[at.B.id],
    proposedObservedCompartmentIdsByResource:{[at.water.id]:[at.B.id]},
  }),/refuses mixed global and resource-scoped/);
  assert.equal(r.nodeStocksAndExternalPorts,"not-supplied");
});


test("source-admitted hypothetical calibration preserves real resource IDs and refuses missing custody",()=>{
  const {graph,at,roles}=stockAmbiguityFixture({broken:true});
  const proposed={channel:at.channel,relations:roles,
    proposedObservedCompartmentIds:[at.B.id],
    proposedWitnessExchangeIds:[at.e1.id,at.e3.id]};
  const ceilings={vertex:{[at.B.id]:{atoms:"2",unit:"kg"}},edge:{
    [at.e1.id]:{atoms:"3",unit:"kg"},[at.e3.id]:{atoms:"3",unit:"kg"}}};
  const arg={...proposed,hypotheticalErrorCeilings:{[at.water.id]:ceilings}};
  const result=channelFlowWitnessPlacement(graph,arg);
  assert.equal(result.proposalOnly,true);
  assert.equal(result.physicalMeterReadings,"not-supplied");
  assert.equal(result.actualCirculation,"not-established");
  assert.equal(result.resources[0].structuralCondition,
    "conditional-linear-observation-full-rank-if-all-premises-hold");
  const budget=result.resources[0].hypotheticalResolution;
  assert.equal(budget.actualReadings,"not-supplied");
  assert.equal(budget.actualTransfers,"not-established");
  assert.equal(budget.unmeteredExchanges.length,1);
  assert.equal(budget.unmeteredExchanges[0].exchange.id,at.e2.id);
  assert.equal(budget.unmeteredExchanges[0].status,"conditional-error-radius");
  assert.deepEqual(budget.unmeteredExchanges[0].radius,{atoms:"5",unit:"kg"});
  assert.deepEqual(channelFlowWitnessPlacement(wire(graph),arg),result);
  const uncalibrated=channelFlowWitnessPlacement(graph,{
    ...proposed,hypotheticalErrorCeilings:{[at.water.id]:{vertex:ceilings.vertex,edge:{}}}});
  assert.equal(uncalibrated.resources[0].hypotheticalResolution.unmeteredExchanges[0].status,
    "calibration-unprovided");
  assert.equal(Object.hasOwn(channelFlowWitnessPlacement(graph,proposed).resources[0],
    "hypotheticalResolution"),false);
  assert.throws(()=>channelFlowWitnessPlacement(graph,{
    ...proposed,hypotheticalErrorCeilings:{"foreign-resource":ceilings}}),/original resource/);
  assert.throws(()=>channelFlowWitnessPlacement(graph,{
    ...proposed,hypotheticalErrorCeilings:{[at.water.id]:{
      vertex:{[at.A.id]:{atoms:"1",unit:"kg"}},edge:{}}}}),/vertex error ceiling/);
  assert.throws(()=>channelFlowWitnessPlacement(graph,{
    ...proposed,hypotheticalErrorCeilings:{[at.water.id]:{
      vertex:{},edge:{"foreign-exchange":{atoms:"1",unit:"kg"}}}}}),/edge error ceiling/);
  assert.throws(()=>channelFlowWitnessPlacement(graph,{
    ...proposed,hypotheticalErrorCeilings:{[at.water.id]:{
      vertex:{[at.B.id]:{atoms:"1",unit:"kg"}},
      edge:{[at.e1.id]:{atoms:"1",unit:"gram"}}}}}),/mixed units/);
});

test("multi-resource observation and calibrated units remain independently scoped",()=>{
  const {graph,at,roles}=stockAmbiguityFixture({otherResource:true});
  const result=channelFlowWitnessPlacement(graph,{
    channel:at.channel,relations:roles,
    proposedObservedCompartmentIdsByResource:{
      [at.water.id]:[at.A.id,at.B.id,at.C.id],
      [at.energy.id]:[at.C.id,at.A.id],
    },
    hypotheticalErrorCeilings:{
      [at.water.id]:{vertex:{
        [at.A.id]:{atoms:"1",unit:"kg"},
        [at.B.id]:{atoms:"1",unit:"kg"},
        [at.C.id]:{atoms:"1",unit:"kg"}},edge:{}},
      [at.energy.id]:{vertex:{
        [at.C.id]:{atoms:"3",unit:"joule"},
        [at.A.id]:{atoms:"3",unit:"joule"}},edge:{}},
    },
  });
  assert.equal(result.resources.length,2);
  const byId=new Map(result.resources.map(r=>[r.resource.id,r]));
  assert.equal(byId.get(at.water.id).hypotheticalResolution.unit,"kg");
  assert.equal(byId.get(at.energy.id).hypotheticalResolution.unit,"joule");
  assert.ok(result.resources.every(r=>r.hypotheticalResolution.actualReadings==="not-supplied"));
});

test("hypothetical meter placement refuses executable proposal, scope and calibration getters",()=>{
 const {graph,at,roles}=stockAmbiguityFixture({broken:true});
 const base={channel:at.channel,relations:roles};
 let calls=0;
 const outer={...base};
 Object.defineProperty(outer,"proposedWitnessExchangeIds",{enumerable:true,get(){calls++;return [at.e1.id]}});
 assert.throws(()=>channelFlowWitnessPlacement(graph,outer),/inert own data/);
 const meters=[at.e1.id];
 Object.defineProperty(meters,"0",{enumerable:true,get(){calls++;return at.e1.id}});
 assert.throws(()=>channelFlowWitnessPlacement(graph,{...base,proposedWitnessExchangeIds:meters}),/inert own array slots/);
 const scope={};
 Object.defineProperty(scope,at.water.id,{enumerable:true,get(){calls++;return [at.B.id]}});
 assert.throws(()=>channelFlowWitnessPlacement(graph,{...base,proposedObservedCompartmentIdsByResource:scope}),/inert own data/);
 const quantity={unit:"kg"};
 Object.defineProperty(quantity,"atoms",{enumerable:true,get(){calls++;return "2"}});
 assert.throws(()=>channelFlowWitnessPlacement(graph,{...base,
   proposedObservedCompartmentIds:[at.B.id],proposedWitnessExchangeIds:[at.e1.id],
   hypotheticalErrorCeilings:{[at.water.id]:{vertex:{[at.B.id]:quantity},edge:{}}}
 }),/inert own data/);
 assert.equal(calls,0);
 const legitimate=channelFlowWitnessPlacement(graph,{...base,
   proposedObservedCompartmentIds:[at.B.id],proposedWitnessExchangeIds:[at.e1.id,at.e3.id]});
 assert.equal(legitimate.proposalOnly,true);
 assert.equal(legitimate.physicalMeterReadings,"not-supplied");
});
test("hypothetical options use immutable source cuts without allowing erased array positions",()=>{
 const {graph,at,roles}=stockAmbiguityFixture({broken:true});
 const input={channel:at.channel,relations:roles,
   proposedWitnessExchangeIds:[at.e1.id,at.e3.id],
   proposedObservedCompartmentIds:[at.B.id]};
 const result=channelFlowWitnessPlacement(graph,input);
 input.proposedWitnessExchangeIds[0]="unadmitted";
 input.proposedObservedCompartmentIds[0]="unadmitted";
 assert.equal(result.resources[0].proposedIndividualEdgeMeters[0].id,at.e1.id);
 assert.deepEqual(result.resources[0].proposedObservedCompartmentIds,[at.B.id]);
 const gaps=[at.e1.id];gaps.length=2;
 assert.throws(()=>channelFlowWitnessPlacement(graph,{channel:at.channel,relations:roles,
   proposedWitnessExchangeIds:gaps}),/dense undecorated source arrays/);
});

test("original channel incidence rejects caller option and relation accessors before graph admission",()=>{
 const {graph,at,roles}=stockAmbiguityFixture({broken:true});
 let calls=0;
 const outer={channel:at.channel};
 Object.defineProperty(outer,"relations",{enumerable:true,get(){calls++;return roles;}});
 assert.throws(()=>channelResourceIncidence(graph,outer),/inert own data/u);
 const withRole={...roles};
 Object.defineProperty(withRole,"reports",{enumerable:true,get(){calls++;return roles.reports;}});
 assert.throws(()=>channelResourceIncidence(graph,{channel:at.channel,relations:withRole}),/inert own data/u);
 const opts={channel:at.channel,relations:roles};
 Object.defineProperty(opts,"maxExchanges",{enumerable:true,get(){calls++;return 1024;}});
 assert.throws(()=>channelResourceIncidence(graph,opts),/inert own data/u);
 assert.equal(calls,0);
 const valid=channelResourceIncidence(graph,{channel:at.channel,relations:roles});
 assert.equal(valid.kind,"signgraph.channelResourceIncidence.v1");
 assert.equal(valid.channel.id,at.channel.id);
});

test("unused transport offer source options and relation roles do not run getters",()=>{
 let calls=0;
 const {graph,at,roles}=stockAmbiguityFixture();
 const fakeOptions={channel:at.channel,quantityType:"source.quantity"};
 Object.defineProperty(fakeOptions,"relations",{enumerable:true,get(){calls++;return roles;}});
 assert.throws(()=>channelTransportPossibilities(graph,fakeOptions),/inert own data/u);
 const nested={...roles};
 Object.defineProperty(nested,"offers",{enumerable:true,get(){calls++;return "source:offers";}});
 assert.throws(()=>channelTransportPossibilities(graph,{
   channel:at.channel,quantityType:"source.quantity",relations:nested
 }),/inert own data/u);
 assert.equal(calls,0);
});

test("channel stock-flow ambiguity remains available through the original admitted source cut",()=>{
 const {graph,at,roles}=stockAmbiguityFixture({broken:true});
 const opts={channel:at.channel,relations:roles};
 const result=channelStockFlowAmbiguity(graph,opts);
 assert.equal(result.kind,"signgraph.channelStockFlowAmbiguity.v1");
 assert.equal(result.channel.id,at.channel.id);
 assert.equal(result.actualCirculation,"not-established");
 assert.deepEqual(channelStockFlowAmbiguity(wire(graph),opts),result);
});
test("route and shared stock-flow source readers refuse option getters without execution",()=>{
 let count=0;
 const {graph,refs}=sourceGraph();
 const source={};
 Object.defineProperty(source,"predicate",{enumerable:true,get(){count++;return "supports"}});
 assert.throws(()=>findSignGraphRoute(graph,refs.a,refs.b,source),/inert own data/u);
 const {graph:stock,at,roles}=stockAmbiguityFixture({broken:true});
 const options={channel:at.channel};
 Object.defineProperty(options,"relations",{enumerable:true,get(){count++;return roles;}});
 assert.throws(()=>channelStockFlowAmbiguity(stock,options),/inert own data/u);
 assert.equal(count,0);
 const safe=findSignGraphRoute(graph,refs.a,refs.b,{predicate:"supports"});
 assert.equal(safe.reachable,true);
});
