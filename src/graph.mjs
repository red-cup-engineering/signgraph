import { conditionalFlowCutErrorBudgets } from "./flow-resolution-budget.mjs";
import { conditionalTemporalFlowAliasing } from "./temporal-flow-aliasing.mjs";
import { createGraph, shortestPath } from "@red-cup-engineering/metrologic/models/graphs/directed-multigraph";
import { glueSignGraphs, querySignGraph } from "./semantic-graph.mjs";

const receiveGraph = graph => {
  const result = glueSignGraphs(graph);
  if (!result.ok) {
    const error = new TypeError("SignGraph topology refused source graph: " + result.refusal.message);
    error.code = result.refusal.code;
    throw error;
  }
  return result.value.graph;
};

/** Build only from an already readmitted, closed SignCell graph. */
function topologyOf(source) {
  const topology = createGraph();
  for (const at of source.cells) {
    topology.addNode(at.id, Object.freeze({ kind: at.kind, type: at.type }));
  }
  for (const entry of source.edges) {
    topology.addEdge({
      from: entry.edge.subject.id, to: entry.edge.object.id,
      kind: entry.edge.predicate,
      data: Object.freeze({ id: entry.id, witness: entry.edge.witness.id }),
    });
  }
  // The mathematical graph builder stays local; no caller can introduce
  // unattested edges after the SignCell admission boundary.
  const { addNode: _addNode, addEdge: _addEdge, ...readers } = topology;
  return Object.freeze(readers);
}

/**
 * A read-only topology of an ORIGINAL admitted SignCell SemanticGraph.
 * Generic mathematical graphs may introduce endpoint nodes on insertion;
 * this one must instead be closed and admitted before any edge is projected.
 * Parallel edges, predicate direction and witness marks remain distinct.
 */
export function projectSignGraphTopology(graph) {
  return topologyOf(receiveGraph(graph));
}

/**
 * Find a shortest *structural* path through the original admitted graph.
 * Every step retains ALL original EAVT-addressed, typed, witnessed edges for
 * its endpoints and requested predicate. In particular, parallel and contrary
 * testimony is not collapsed into a fabricated transitive assertion.
 *
 * This is a pure route projection, NOT a SignChain proof, a claim of truth,
 * authorization to execute a workflow, or a checkpoint of one.
 */
export function findSignGraphRoute(graph, sourceReference, targetReference, supplied = {}) {
  const options = sourcePlacementRecord(supplied,"route options");
  if (!options || typeof options !== "object" || Array.isArray(options) ||
      Object.keys(options).some(key => key !== "predicate"))
    throw new TypeError("SignGraph route options permit only predicate");
  const predicate = options.predicate;
  if (predicate !== undefined && (typeof predicate !== "string" || predicate.length === 0))
    throw new TypeError("SignGraph route predicate must be a nonempty relation name");

  const admitted = receiveGraph(graph);
  // SignCell's original membership, type and query admission applies equally
  // to zero-length routes and unreachable endpoints; ids alone do not admit.
  querySignGraph(admitted, sourceReference);
  querySignGraph(admitted, targetReference);
  const topology = topologyOf(admitted);
  const route = shortestPath(topology, sourceReference.id, targetReference.id, { kind: predicate });
  const referenceById = new Map(admitted.cells.map(cell => [cell.id,
    Object.freeze({ id: cell.id, type: cell.type })]));
  const edgeById = new Map(admitted.edges.map(entry => [entry.id, entry]));
  const nodes = Object.freeze((route?.path ?? []).map(id => referenceById.get(id)));
  const hops = Object.freeze(nodes.slice(1).map((target, index) => {
    const source = nodes[index];
    const edges = topology.outgoing(source.id, { kind: predicate })
      .filter(edge => edge.to === target.id)
      .map(edge => edgeById.get(edge.data.id));
    return Object.freeze({ source, target, edges: Object.freeze(edges) });
  }));
  return Object.freeze({
    kind: "signgraph.shortestWitnessedRoute.v1",
    graph: admitted.id,
    source: referenceById.get(sourceReference.id),
    target: referenceById.get(targetReference.id),
    predicate: predicate ?? null,
    reachable: route !== null,
    distance: route?.cost ?? null,
    nodes,
    hops,
  });
}


/**
 * Project the original *witnessed* Channel -> Message -> Exchange -> Resource
 * path and the oriented resource boundary from Exchange -> From / To.
 *
 * This is a composition of the existing indexed, closed, typed SignGraph,
 * never a new message store, economic ledger, unit arithmetic, or effect.
 * Two independently witnessed reports of one exchange retain both reports,
 * but identify one exchange. Exact effect/amount/settlement admission is
 * delegated to its source owners and to the receiving SignCraft layer.
 *
 * All caller role names must be independently declared predicates of the
 * original graph. "inside" optionally projects endpoint -> compartment,
 * a one-level spatial reading, not a fabricated hierarchy or sheaf.
 */
export function channelResourceIncidence(graph, supplied = {}) {
  // The source-owner interface reads one original, inert declaration.
  // An executable getter cannot silently substitute a predicate after the
  // graph's relation admission has already checked another predicate.
  const options = sourcePlacementRecord(supplied,"channel incidence options");
  const {channel, maxMessages = 256, maxExchanges = 1024,
    maxEdges = 16384, maxContainmentDepth = 1} = options;
  const relations = sourcePlacementCopy(options.relations,"channel relations");
  const required = ["contains", "reports", "resource", "from", "to"];
  const allowed = [...required, "quantity", "settlement", "inside"];
  if (relations === null || typeof relations !== "object" || Array.isArray(relations) ||
      required.some(role => !Object.hasOwn(relations, role)) ||
      Object.keys(relations).some(role => !allowed.includes(role)))
    throw new TypeError("channel resource incidence requires declared contains/reports/resource/from/to relation roles");
  for (const [role, id] of Object.entries(relations))
    if (typeof id !== "string" || !id.trim())
      throw new TypeError(`channel resource incidence: relation ${role} must be a nonempty predicate`);
  if (new Set(Object.values(relations)).size !== Object.values(relations).length)
    throw new TypeError("channel resource incidence: distinct roles require distinct predicates");
  if (![maxMessages, maxExchanges].every(n => Number.isSafeInteger(n) && n > 0 && n <= 4096))
    throw new RangeError("channel resource incidence: resource budgets must be integers from 1 to 4096");
  if (!Number.isSafeInteger(maxEdges) || maxEdges < 1 || maxEdges > 131072)
    throw new RangeError("channel resource incidence: witnessed-edge budget must be 1 through 131072");
  if (!Number.isSafeInteger(maxContainmentDepth) || maxContainmentDepth < 1 || maxContainmentDepth > 8 ||
      (maxContainmentDepth > 1 && !relations.inside))
    throw new RangeError("channel resource incidence: containment depth must be 1 through 8 with an inside role");
  const received = receiveGraph(graph);
  const declarations = new Map(received.relations.map(relation => [relation.id, relation]));
  for (const id of Object.values(relations))
    if (!declarations.has(id)) throw new TypeError(`channel resource incidence: undeclared predicate ${id}`);
  // An id-only or foreign reference must not turn a failed source query into
  // a plausible empty channel. Original SignCell member admission applies.
  querySignGraph(received, channel);
  if (!declarations.get(relations.contains).subjectTypes.includes(channel.type))
    throw new TypeError("channel resource incidence: channel type is outside the contains declaration");

  const compare = (a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  // Group evidence by the ORIGINAL typed target reference; different witnesses
  // still identify different original EAVT relation statements.
  let observedEdges = 0;
  const targetGroups = (subject, role) => {
    const grouped = new Map();
    const entries = querySignGraph(received, subject, { predicate: relations[role] });
    observedEdges += entries.length;
    if (observedEdges > maxEdges) throw new RangeError("channel resource incidence: witnessed-edge budget exceeded");
    for (const entry of entries) {
      const target = entry.edge.object;
      const key = JSON.stringify([target.id, target.type]);
      if (!grouped.has(key)) grouped.set(key, { target, edges: [] });
      grouped.get(key).edges.push(entry);
    }
    return Object.freeze([...grouped.values()]
      .sort((a,b) => compare(a.target,b.target))
      .map(item => Object.freeze({
        target: item.target, edges: Object.freeze(item.edges),
      })));
  };
  const messages = targetGroups(channel, "contains");
  if (messages.length > maxMessages)
    throw new RangeError("channel resource incidence: message budget exceeded");
  const byExchange = new Map();
  const messageReadings = messages.map(({target: message,edges}) => {
    const exchanges = targetGroups(message, "reports");
    for (const link of exchanges) {
      const id = link.target.id;
      if (!byExchange.has(id)) byExchange.set(id, { exchange: link.target, reportedBy: [] });
      // The same exchange under two messages is ONE exchange, not two debits.
      byExchange.get(id).reportedBy.push(Object.freeze({ message, edges: link.edges }));
    }
    return Object.freeze({
      message, channelEdges: edges, reports: exchanges,
    });
  });
  if (byExchange.size > maxExchanges)
    throw new RangeError("channel resource incidence: exchange budget exceeded");

  const transfers = [], obstructions = [];
  for (const item of [...byExchange.values()].sort((a,b) => compare(a.exchange,b.exchange))) {
    const evidence = {
      resource: targetGroups(item.exchange, "resource"),
      from: targetGroups(item.exchange, "from"),
      to: targetGroups(item.exchange, "to"),
      ...(relations.quantity ? {quantity: targetGroups(item.exchange, "quantity")} : {}),
      ...(relations.settlement ? {settlement: targetGroups(item.exchange, "settlement")} : {}),
    };
    const failures = [];
    for (const role of ["resource","from","to"])
      if (evidence[role].length !== 1)
        failures.push(Object.freeze({ role, count: evidence[role].length,
          kind: evidence[role].length ? "ambiguous" : "missing" }));
    // A declared quantity must be unambiguous, but it may be absent: absent
    // measurement stays unknown and is NOT equivalent to a zero balance.
    if (evidence.quantity?.length > 1)
      failures.push(Object.freeze({role:"quantity", count:evidence.quantity.length,kind:"ambiguous"}));
    let sourceCell = null, targetCell = null;
    let sourceLineage = null, targetLineage = null;
    const compartmentLevels = [];
    if (relations.inside && evidence.from.length === 1 && evidence.to.length === 1) {
      // Each step is an ORIGINAL witnessed edge. Missing further parents are
      // unknown, not proof that a cell is a top-level root. An ambiguous/cyclic
      // path is an obstruction when its requested depth is reached.
      const lineage = (origin, firstRole, laterRole) => {
        let current = origin;
        const visited = new Set([origin.id]);
        const levels = [];
        let stop = "depth-limit";
        for (let depth = 0; depth < maxContainmentDepth; depth++) {
          const parents = targetGroups(current, "inside");
          if (depth === 0) evidence[firstRole] = parents;
          if (parents.length === 0) {
            stop = "unwitnessed-parent";
            if (depth === 0)
              failures.push(Object.freeze({role:firstRole,count:0,kind:"missing"}));
            break;
          }
          if (parents.length !== 1) {
            stop = "ambiguous-parent";
            failures.push(Object.freeze({
              role:depth === 0 ? firstRole : laterRole,
              count:parents.length,kind:"ambiguous",
            }));
            break;
          }
          const parent = parents[0].target;
          if (visited.has(parent.id)) {
            stop = "cyclic-containment";
            failures.push(Object.freeze({role:laterRole,kind:"cycle",at:parent}));
            break;
          }
          levels.push(Object.freeze({
            parent, from:current, edges:parents[0].edges,
          }));
          visited.add(parent.id);
          current = parent;
        }
        return Object.freeze({levels:Object.freeze(levels),stop});
      };
      sourceLineage = lineage(evidence.from[0].target, "originCell", "originLineage");
      targetLineage = lineage(evidence.to[0].target, "destinationCell", "destinationLineage");
      sourceCell = sourceLineage.levels[0]?.parent ?? null;
      targetCell = targetLineage.levels[0]?.parent ?? null;
      evidence.sourceLineage = sourceLineage;
      evidence.targetLineage = targetLineage;
      for (let depth = 1; depth <= maxContainmentDepth; depth++) {
        const origin = sourceLineage.levels[depth - 1] ?? null;
        const destination = targetLineage.levels[depth - 1] ?? null;
        compartmentLevels.push(Object.freeze({
          depth,
          from:origin?.parent ?? null,
          to:destination?.parent ?? null,
          sourceEvidence:origin?.edges ?? Object.freeze([]),
          targetEvidence:destination?.edges ?? Object.freeze([]),
          crosses:origin && destination ? origin.parent.id !== destination.parent.id : null,
          standing:origin && destination ? "source-witnessed-pair" : "unknown",
        }));
      }
    }
    const disclosedEvidence = Object.freeze(evidence);
    const reports = Object.freeze(item.reportedBy);
    if (failures.length) {
      obstructions.push(Object.freeze({exchange:item.exchange, reportedBy:reports,
        failures:Object.freeze(failures), evidence:disclosedEvidence}));
      continue;
    }
    transfers.push(Object.freeze({
      exchange:item.exchange, reportedBy:reports,
      resource:evidence.resource[0].target,
      from:evidence.from[0].target, to:evidence.to[0].target,
      quantity:evidence.quantity?.[0]?.target ?? null,
      settlementClaims:evidence.settlement ?? Object.freeze([]),
      sourceCell, targetCell, sourceLineage, targetLineage,
      compartmentLevels:Object.freeze(compartmentLevels),
      crossesCellBoundary:relations.inside ?
        sourceCell.id !== targetCell.id : null,
      evidence:disclosedEvidence,
      standing:"witnessed-graph-incidence-only",
    }));
  }
  return Object.freeze({
    kind:"signgraph.channelResourceIncidence.v1",
    graph:received.id, channel,
    messages:Object.freeze(messageReadings),
    transfers:Object.freeze(transfers),
    obstructions:Object.freeze(obstructions),
    messageOrder:"not-derived",
    effect:"not-executed",
    settlement:"not-authenticated",
  });
}

/**
 * Find one source-addressed directed cycle of POSSIBLE same-resource
 * exchange incidence. No stock reading, execution, accounting or authorization
 * is asserted here. This is the bounded witness of a nonnegative null-vector
 * of the oriented incidence matrix if the reported arcs are feasible.
 */
function firstSourceDirectedCycle(transfers) {
  const outgoing = new Map(), nodes = new Set();
  for (const transfer of transfers) {
    const from = transfer.from.id, to = transfer.to.id;
    nodes.add(from); nodes.add(to);
    if (!outgoing.has(from)) outgoing.set(from, []);
    outgoing.get(from).push(transfer);
  }
  for (const arcs of outgoing.values())
    arcs.sort((a,b) => a.exchange.id < b.exchange.id ? -1 : a.exchange.id > b.exchange.id ? 1 : 0);
  const seen = new Set(), active = new Map();
  for (const start of [...nodes].sort()) {
    if (seen.has(start)) continue;
    const stack = [{node:start,next:0,via:null}];
    seen.add(start); active.set(start,0);
    while (stack.length) {
      const frame = stack[stack.length-1];
      const arcs = outgoing.get(frame.node) ?? [];
      if (frame.next === arcs.length) {
        active.delete(frame.node);
        stack.pop();
        continue;
      }
      const edge = arcs[frame.next++];
      const target = edge.to.id, index = active.get(target);
      if (index !== undefined) {
        // Original typed exchange/endpoint/evidence objects survive unchanged.
        return Object.freeze([...stack.slice(index+1).map(f => f.via),edge]);
      }
      if (!seen.has(target)) {
        seen.add(target);
        stack.push({node:target,next:0,via:edge});
        active.set(target,stack.length-1);
      }
    }
  }
  return null;
}

/**
 * Qualify the LIMIT of a stock-only circulation inference over the original
 * authenticated, channel-scoped SignGraph incidence reader. A witnessed,
 * same-resource, directed exchange cycle supplies a nonzero nonnegative
 * incidence-kernel vector: zero edge flux and flux around that cycle would
 * have identical vertex-stock deltas under the SAME boundary injections.
 *
 * This does NOT show either history occurred. Without a witnessed directed
 * cycle, this projection also cannot prove uniqueness: unobserved exchange
 * edges, source obstructions, constitutive laws, port effects and measurement
 * coverage remain outside SignGraph. It never decodes a Quantity into units,
 * invents flows, books money, asserts clock phases, or grants effects.
 */
export function channelStockFlowAmbiguity(graph, options = {}) {
  // Original incidence now owns the inert options/roles source cut.
  const reading = channelResourceIncidence(graph, options);
  const grouped = new Map();
  for (const transfer of reading.transfers) {
    const id = transfer.resource.id;
    if (!grouped.has(id))
      grouped.set(id,{resource:transfer.resource,transfers:[]});
    grouped.get(id).transfers.push(transfer);
  }
  const resources = [...grouped.values()]
    .sort((a,b) => a.resource.id < b.resource.id ? -1 : a.resource.id > b.resource.id ? 1 : 0)
    .map(({resource,transfers}) => {
      const cycle = firstSourceDirectedCycle(transfers);
      return Object.freeze({
        resource, exchangeCount:transfers.length,
        cycleTransfers:cycle,
        stockOnlyIdentifiability:cycle ?
          "not-identifiable-if-these-cyclic-arcs-are-feasible" :
          "undetermined-without-complete-source-and-effect-law",
        realizedFlux:"not-observed",
        transferStanding:"source-witnessed-incidence-not-executed",
      });
    });
  return Object.freeze({
    kind:"signgraph.channelStockFlowAmbiguity.v1",
    graph:reading.graph, channel:reading.channel,
    resources:Object.freeze(resources),
    obstructions:reading.obstructions,
    stockObservations:"not-supplied",
    independentEdgeFlux:"not-supplied",
    boundaryEffects:"not-supplied",
    actualCirculation:"not-established",
    endogenousClock:"not-established",
  });
}


/**
 * Source-readmitted conditional temporal observation, grouped by original
 * Resource. No aggregate meter, period, clock or Actor effect is asserted.
 * Science #215 section 7.24; SignGraph #24; SignCraft #11.
 */
export function channelFlowTemporalAliasing(graph,options={}) {
  const o=sourcePlacementRecord(options,"temporal-flow options");
  const allowed=new Set(["channel","relations","maxMessages","maxExchanges","maxEdges",
    "maxContainmentDepth","proposedMicrointervalCount","proposedWindowLengths"]);
  if(Object.keys(o).some(k=>!allowed.has(k)))
    throw new TypeError("temporal flow refuses unknown source options");
  const microintervalCount=o.proposedMicrointervalCount;
  const windowLengths=sourcePlacementCopy(o.proposedWindowLengths,"windowLengths");
  conditionalTemporalFlowAliasing([],{microintervalCount,windowLengths});
  const reading=channelResourceIncidence(graph,{
    channel:o.channel,relations:sourcePlacementCopy(o.relations,"relations"),
    maxMessages:o.maxMessages,maxExchanges:o.maxExchanges,maxEdges:o.maxEdges,
    maxContainmentDepth:o.maxContainmentDepth,
  });
  const byResource=new Map();
  if(!reading.obstructions.length)for(const transfer of reading.transfers){
    const id=transfer.resource.id;
    if(!byResource.has(id))byResource.set(id,{resource:transfer.resource,transfers:[]});
    byResource.get(id).transfers.push(transfer);
  }
  return Object.freeze({
    kind:"signgraph.channelFlowTemporalAliasing.v1",
    graph:reading.graph,channel:reading.channel,
    resources:Object.freeze([...byResource.values()]
      .sort((a,b)=>a.resource.id<b.resource.id?-1:a.resource.id>b.resource.id?1:0)
      .map(({resource,transfers})=>Object.freeze({
        resource,...conditionalTemporalFlowAliasing(transfers,{microintervalCount,windowLengths}),
      }))),
    obstructions:reading.obstructions,
    standing:reading.obstructions.length?
      "source-obstructed-no-complete-incidence":"hypothetical-temporal-design-only",
    originalGraphCompleteness:"not-attested",
    observedStepStocksAndPorts:"not-supplied",
    observedWindowEdgeTotals:"not-supplied",
    actualActorCirculation:"not-established",derivedClock:"not-established",
  });
}

/**
 * Report the source-identified edges that close an UNDIRECTED cycle after
 * excluding proposed individually metered original exchanges. A self-loop
 * or second independent parallel exchange closes a cycle; a second MESSAGE
 * about the same exchange does not create another graph edge.
 *
 * This is a disjoint-set test of the cycle rank of the multigraph, NOT a
 * flow estimator or a statement that any observation has been performed.
 */
function undirectedCycleClosingTransfers(transfers, excluded, observedVertices = null) {
  const parent = new Map();
  // Synthetic algebraic anchor, NEVER a resource, Actor, real port or vertex.
  const anchor = Symbol("unobserved-vertex-boundary");
  const root = (original) => {
    if (!parent.has(original)) parent.set(original,original);
    let result = original;
    while (parent.get(result) !== result) result = parent.get(result);
    let id = original;
    while (id !== result) {
      const next = parent.get(id);
      parent.set(id,result);
      id = next;
    }
    return result;
  };
  // Unknown divergences are not zero. Connecting each missing endpoint to
  // one algebraic anchor makes every path between two missing endpoints a
  // dependency of the actually observed incidence rows.
  if (observedVertices !== null) {
    const endpoints = new Set();
    for (const t of transfers) {
      endpoints.add(t.from.id);
      endpoints.add(t.to.id);
    }
    for (const id of [...endpoints].sort())
      if (!observedVertices.has(id)) parent.set(root(id),root(anchor));
  }
  const closers = [];
  const ordered = [...transfers].sort((a,b) =>
    a.exchange.id < b.exchange.id ? -1 : a.exchange.id > b.exchange.id ? 1 : 0);
  for (const transfer of ordered) {
    if (excluded.has(transfer.exchange.id)) continue;
    const a = root(transfer.from.id), b = root(transfer.to.id);
    if (a === b) {
      closers.push(transfer);
    } else {
      parent.set(b,a);
    }
  }
  return Object.freeze(closers);
}

/**
 * CONDITIONAL design assay for independent edge-meter placement.
 *
 * Assuming one exact conserved resource per original Resource, a COMPLETE
 * original directed exchange multigraph, a SINGLE observation interval,
 * exact port-adjusted divergence on vertex set S, and independently measured
 * edge fluxes f_W, the linear map f -> ((Bf)|_S, f_W) is injective on all
 * real edge vectors exactly when unmetered edges form an undirected FOREST
 * with at most ONE unobserved endpoint per nontrivial tree component.
 * Equivalent: add an algebraic anchor linked to EACH unobserved endpoint
 * and test that the augmented multigraph is acyclic. Isolated vertices
 * impose no extra requirements. See Science #215 draft §7.21.
 *
 * proposedWitnessExchangeIds, proposedObservedCompartmentIds and optional
 * proposedObservedCompartmentIdsByResource (Resource ID -> endpoint IDs) are only a
 * proposed INSTRUMENTATION DESIGN. Nonempty global endpoint coverage is
 * refused with multiple Resources: an A water reading is not an A energy reading. If vertex IDs are omitted, the original
 * full-node mathematical assumption is retained for compatibility, and the
 * output names that hypothetical coverage. If supplied (even []), only
 * exactly named source-admitted exchange endpoints are assumed observed.
 * These IDs do NOT assert that meters exist, yield usable units, measure anything,
 * belong to the authenticated Actor, or establish causal resource transfer.
 * The source reader's obstructions remain explicit. Missing edges, unknown
 * graph completeness, unknown ports, real flux, timing and law of effect
 * remain outside this graph-only projection.
 *
 * No second graph, ledger, transaction, clock, allocator or authority.
 */
/** Admission only for hypothetical, caller-declared source coordinates.
 * This does not assign identity, numerical units, witness truth or authority.
 * Proxy descriptor traps require a host sandbox.
 */
function sourcePlacementRecord(input, label) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input)))
    throw new TypeError("SignGraph source "+label+" needs plain source data");
  const descriptors=Object.getOwnPropertyDescriptors(input);
  const names=Reflect.ownKeys(descriptors);
  if (names.length>8192 || names.some(k=>typeof k!=="string" ||
      !descriptors[k].enumerable || !Object.hasOwn(descriptors[k],"value")))
    throw new TypeError("SignGraph source "+label+" requires inert own data");
  return Object.freeze(Object.fromEntries(names.map(k=>[k,descriptors[k].value])));
}
function sourcePlacementCopy(value,label,depth=0,ancestors=new Set()) {
  if (value===null || typeof value!=="object") return value;
  if (depth>7 || ancestors.has(value))
    throw new TypeError("flow witness placement "+label+" needs bounded acyclic source data");
  ancestors.add(value);
  let result;
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value)!==Array.prototype)
      throw new TypeError("flow witness placement "+label+" requires ordinary arrays");
    const descriptors=Object.getOwnPropertyDescriptors(value);
    if (value.length>8192 || Reflect.ownKeys(descriptors).length!==value.length+1)
      throw new TypeError("flow witness placement "+label+" requires dense undecorated source arrays");
    result=Object.freeze(Array.from({length:value.length},(_,i)=>{
      const part=descriptors[String(i)];
      if (!part || !part.enumerable || !Object.hasOwn(part,"value"))
        throw new TypeError("flow witness placement "+label+" requires inert own array slots");
      return sourcePlacementCopy(part.value,label,depth+1,ancestors);
    }));
  } else {
    const record=sourcePlacementRecord(value,label);
    result=Object.freeze(Object.fromEntries(Object.entries(record)
      .map(([k,v])=>[k,sourcePlacementCopy(v,label,depth+1,ancestors)])));
  }
  ancestors.delete(value);
  return result;
}
export function channelFlowWitnessPlacement(graph, options = {}) {
  // Read the outer source declaration once, preserve the original Channel
  // reference for existing SignGraph admission, and detach only structural
  // proposal/relations/calibration data before any mathematical operation.
  const sourceOptions=sourcePlacementRecord(options,"options");
  const structural=new Set(["relations","proposedWitnessExchangeIds",
    "proposedObservedCompartmentIds","proposedObservedCompartmentIdsByResource",
    "hypotheticalErrorCeilings"]);
  const admittedOptions=Object.freeze(Object.fromEntries(Object.entries(sourceOptions)
    .map(([key,value])=>[key,structural.has(key)?sourcePlacementCopy(value,key):value])));
  const proposals = admittedOptions.proposedWitnessExchangeIds ?? [];
  const vertices = admittedOptions.proposedObservedCompartmentIds;
  const scopedVertices = admittedOptions.proposedObservedCompartmentIdsByResource;
  if (!Array.isArray(proposals) || proposals.length > 4096 ||
      proposals.some(id => typeof id !== "string" || !id.length) ||
      new Set(proposals).size !== proposals.length)
    throw new TypeError("flow witness placement requires unique original exchange IDs (at most 4096)");
  if (vertices !== undefined &&
      (!Array.isArray(vertices) || vertices.length > 8192 ||
       vertices.some(id => typeof id !== "string" || !id.length) ||
       new Set(vertices).size !== vertices.length))
    throw new TypeError("flow witness placement requires unique original endpoint IDs (at most 8192)");
  // A compartment ID is not a resource measurement. An endpoint shared by
  // water and energy cannot inherit water's proposed observation as energy.
  if (scopedVertices !== undefined &&
      (scopedVertices === null || typeof scopedVertices !== "object" ||
       Array.isArray(scopedVertices) ||
       ![Object.prototype, null].includes(Object.getPrototypeOf(scopedVertices))))
    throw new TypeError("flow witness placement requires resource-to-endpoint observation arrays");
  if (scopedVertices !== undefined && vertices !== undefined)
    throw new TypeError("flow witness placement refuses mixed global and resource-scoped endpoint coverage");
  const scopedEntries = scopedVertices === undefined ? null : Object.entries(scopedVertices);
  if (scopedEntries !== null &&
      (scopedEntries.length > 4096 ||
       scopedEntries.some(([id,ids]) =>
         !id.length || !Array.isArray(ids) || ids.length > 8192 ||
         ids.some(v => typeof v !== "string" || !v.length) ||
         new Set(ids).size !== ids.length) ||
       scopedEntries.reduce((total,[,ids])=>total+ids.length,0) > 8192))
    throw new TypeError("flow witness placement requires unique resource-scoped endpoint IDs (at most 8192 total)");
  const reading = channelResourceIncidence(graph, admittedOptions);
  const original = new Map(), grouped = new Map(), endpoints = new Set();
  for (const transfer of reading.transfers) {
    const exchangeId = transfer.exchange.id;
    if (original.has(exchangeId))
      throw new TypeError("one original exchange cannot be projected as two transfers");
    original.set(exchangeId,transfer);
    endpoints.add(transfer.from.id); endpoints.add(transfer.to.id);
    const resourceId = transfer.resource.id;
    if (!grouped.has(resourceId))
      grouped.set(resourceId,{resource:transfer.resource,transfers:[]});
    grouped.get(resourceId).transfers.push(transfer);
  }
  for (const exchangeId of proposals)
    if (!original.has(exchangeId))
      throw new TypeError("proposed meter does not name one admitted channel exchange");
  for (const id of vertices ?? [])
    if (!endpoints.has(id))
      throw new TypeError("proposed vertex reading does not name one admitted exchange endpoint");
  // Empty global coverage is unambiguous; positive cross-resource coverage
  // must be labelled by the ORIGINAL Resource identity, not by endpoint alone.
  if (vertices?.length > 0 && grouped.size > 1)
    throw new TypeError("multi-resource observations require resource-scoped endpoint IDs");
  if (scopedEntries !== null) {
    for (const [resourceId,ids] of scopedEntries) {
      const owned = grouped.get(resourceId);
      if (!owned)
        throw new TypeError("proposed resource observation does not name one admitted resource");
      const local = new Set();
      for (const t of owned.transfers) {
        local.add(t.from.id);
        local.add(t.to.id);
      }
      for (const id of ids)
        if (!local.has(id))
          throw new TypeError("proposed resource endpoint does not belong to that resource's admitted exchanges");
    }
  }
  const proposed = new Set(proposals);
  // Proposed error ceilings are design constraints, NEVER actual sensor readings.
  const ceilings = admittedOptions.hypotheticalErrorCeilings;
  const plain = value => value !== null && typeof value === "object" &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null);
  if (ceilings !== undefined) {
    if (!plain(ceilings) || Object.keys(ceilings).length > 4096)
      throw new TypeError("hypothetical error ceilings require bounded resource-ID maps");
    for (const [resourceId,budget] of Object.entries(ceilings))
      if (!grouped.has(resourceId) || !plain(budget) ||
          Object.keys(budget).sort().join(",") !== "edge,vertex" ||
          !plain(budget.vertex) || !plain(budget.edge))
        throw new TypeError("hypothetical error ceilings require original resource and vertex/edge maps");
  }
  const resources = [...grouped.values()]
    .sort((a,b) => a.resource.id < b.resource.id ? -1 : a.resource.id > b.resource.id ? 1 : 0)
    .map(({resource,transfers}) => {
      const observed = scopedEntries !== null
        ? new Set(Object.hasOwn(scopedVertices,resource.id) ? scopedVertices[resource.id] : [])
        : vertices === undefined ? null : new Set(vertices);
      if (ceilings !== undefined && Object.hasOwn(ceilings,resource.id)) {
        const original = ceilings[resource.id];
        const allowedVertices = new Set(transfers.flatMap(t => [t.from.id,t.to.id]));
        const allowedMeters = new Set(transfers.filter(t => proposed.has(t.exchange.id))
          .map(t => t.exchange.id));
        for (const id of Object.keys(original.vertex))
          if (!allowedVertices.has(id) || (observed !== null && !observed.has(id)))
            throw new TypeError("vertex error ceiling names no proposed source-admitted observation for resource");
        for (const id of Object.keys(original.edge))
          if (!allowedMeters.has(id))
            throw new TypeError("edge error ceiling names no proposed original resource exchange meter");
      }
      // Full-node special case (Science §7.20) differs from a sparse-row
      // observed incidence matrix (Science §7.21).
      const fullNodeMinimum = undirectedCycleClosingTransfers(transfers,new Set()).length;
      const minimum = undirectedCycleClosingTransfers(transfers,new Set(),observed).length;
      const remaining = undirectedCycleClosingTransfers(transfers,proposed,observed);
      const localEndpoints = new Set();
      for (const t of transfers) {
        localEndpoints.add(t.from.id);localEndpoints.add(t.to.id);
      }
      return Object.freeze({
        resource,
        exchangeCount:transfers.length,
        minimumIndependentEdgeMeterCount:minimum,
        minimumEdgeMeterCountWithFullVertexCoverage:fullNodeMinimum,
        proposedObservedCompartmentIds: Object.freeze([...localEndpoints]
          .filter(id => observed === null || observed.has(id)).sort()),
        proposedIndividualEdgeMeters:Object.freeze(transfers
          .filter(t => proposed.has(t.exchange.id)).map(t => t.exchange)),
        unmeteredCycleClosingTransfers:remaining,
        unmeteredComplementIsUndirectedForest:
          undirectedCycleClosingTransfers(transfers,proposed).length === 0,
        unmeteredComplementHasAtMostOneUnobservedVertexPerTree:remaining.length === 0,
        structuralCondition:remaining.length === 0 ?
          "conditional-linear-observation-full-rank-if-all-premises-hold" :
          "conditional-linear-observation-has-kernel",
        ...(ceilings === undefined ? {} : {
          hypotheticalResolution:conditionalFlowCutErrorBudgets(transfers,{
            proposedWitnessExchangeIds:proposed,
            proposedObservedCompartmentIds:observed,
            hypotheticalErrorCeilings:ceilings[resource.id] ?? {vertex:{},edge:{}},
          }),
        }),
      });
    });
  return Object.freeze({
    kind:"signgraph.channelFlowWitnessPlacement.v1",
    graph:reading.graph,channel:reading.channel,
    resources:Object.freeze(resources),obstructions:reading.obstructions,
    proposalOnly:true,
    vertexCoverageAssumption:scopedEntries !== null ?
      "explicit-resource-scoped-proposed-observed-endpoints-not-measured" :
      vertices === undefined ?
      "all-admitted-exchange-endpoints-hypothetically-observed" :
      "explicit-proposed-observed-endpoints-not-measured",
    originalGraphCompleteness:"not-attested",
    physicalMeterReadings:"not-supplied",
    nodeStocksAndExternalPorts:"not-supplied",
    actualCirculation:"not-established",
    actorBodyAndClock:"not-established",
  });
}


/**
 * Offered, potentially UNUSED transport topology, distinct from performed
 * Message -> Exchange incidence.  A source-owned Channel offers an Option;
 * the Option witnesses resource, endpoints and one-or-more capacity sources;
 * each capacity source independently witnesses a resource and an exact
 * Quantity mark. Several Options may use the SAME capacity source. The
 * consumer must aggregate demands by that original source identity, not
 * treat every route as independently endowed with that capacity.
 *
 * This is a read-only graph projection, never organizational competence,
 * an available/reserved balance, an Act, a settlement, or a route optimizer.
 * Negative testimony is retained, not voted away. No new graph or ledger.
 */
export function channelTransportPossibilities(graph, supplied = {}) {
  const options = sourcePlacementRecord(supplied,"transport possibilities options");
  const {channel, quantityType, observedAt = null,
    maxOptions = 256, maxSources = 1024, maxEdges = 16384} = options;
  const relations = sourcePlacementCopy(options.relations,"transport relations");
  const mandatory = ["offers", "resource", "from", "to", "inside", "uses", "capacityResource", "capacity"];
  const optional = ["cost", "opposes", "revokes"];
  if (!relations || typeof relations !== "object" || Array.isArray(relations) ||
      mandatory.some(role => !Object.hasOwn(relations, role)) ||
      Object.keys(relations).some(role => ![...mandatory, ...optional].includes(role)) ||
      Object.values(relations).some(id => typeof id !== "string" || !id.trim()) ||
      new Set(Object.values(relations)).size !== Object.values(relations).length)
    throw new TypeError("transport possibilities require distinct, declared offer/resource/endpoint/capacity roles");
  if (typeof quantityType !== "string" || !quantityType.trim())
    throw new TypeError("transport possibilities require a declared original Quantity type");
  if (![maxOptions, maxSources, maxEdges].every(value =>
      Number.isSafeInteger(value) && value > 0 && value <= 131072))
    throw new RangeError("transport possibilities require finite positive bounds");
  if (maxOptions > 4096 || maxSources > 4096)
    throw new RangeError("transport possibilities allow at most 4096 options or sources");
  const timestamp = (value) => typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0,19) === value.slice(0,19);
  if (observedAt !== null && !timestamp(observedAt))
    throw new TypeError("transport possibilities observedAt must be a real UTC instant or null");

  const received = receiveGraph(graph);
  const declarations = new Map(received.relations.map(r => [r.id,r]));
  for (const relation of Object.values(relations))
    if (!declarations.has(relation))
      throw new TypeError(`transport possibilities: undeclared relation ${relation}`);
  querySignGraph(received, channel); // original SignCell typed membership, not id membership
  if (!declarations.get(relations.offers).subjectTypes.includes(channel.type))
    throw new TypeError("transport possibilities: channel is not an offered-route source type");
  const marks = new Map(received.cells.map(mark => [mark.id, mark]));
  const refKey = ref => JSON.stringify([ref.id, ref.type]);
  let observedEdges = 0;
  const targets = (from, role) => {
    if (!relations[role]) return Object.freeze([]);
    const edges = querySignGraph(received, from, {predicate:relations[role]});
    observedEdges += edges.length;
    if (observedEdges > maxEdges)
      throw new RangeError("transport possibilities: witnessed-edge bound exceeded");
    const grouped = new Map();
    for (const entry of edges) {
      const key = refKey(entry.edge.object);
      if (!grouped.has(key)) grouped.set(key, {target:entry.edge.object, edges:[]});
      grouped.get(key).edges.push(entry);
    }
    return Object.freeze([...grouped.values()]
      .sort((a,b) => a.target.id < b.target.id ? -1 : a.target.id > b.target.id ? 1 : 0)
      .map(item => Object.freeze({target:item.target,edges:Object.freeze(item.edges)})));
  };
  const failure = (role, kind, count = null) => Object.freeze({role,kind,count});
  const expectOne = (links, role, errors) => {
    if (links.length !== 1) errors.push(failure(role, links.length ? "ambiguous" : "missing", links.length));
    return links[0]?.target ?? null;
  };
  const quantityOf = (link, role, errors) => {
    if (!link) return null;
    const mark = marks.get(link.target.id);
    const content = mark?.content;
    if (mark?.type !== quantityType || !content || typeof content !== "object" || Array.isArray(content) ||
      typeof content.atoms !== "string" || !/^(0|[1-9][0-9]{0,79})$/u.test(content.atoms) ||
      typeof content.unit !== "string" || !content.unit.trim() ||
      content.unit !== content.unit.normalize("NFC") ||
      (content.observedAt !== undefined && !timestamp(content.observedAt)) ||
      (content.expiresAt !== undefined && !timestamp(content.expiresAt)) ||
      Object.keys(content).some(k => !["atoms", "unit", "observedAt", "expiresAt"].includes(k))) {
      errors.push(failure(role, "unqualified-exact-quantity"));
      return null;
    }
    const value = Object.freeze({atoms:content.atoms,unit:content.unit,
      observedAt:content.observedAt ?? null,expiresAt:content.expiresAt ?? null});
    if (value.observedAt !== null && value.expiresAt !== null &&
        Date.parse(value.observedAt) > Date.parse(value.expiresAt))
      errors.push(failure(role,"inverted-validity"));
    // A dated source report, even without an explicit expiry, cannot be
    // promoted to a presently eligible option without a qualified read time.
    // This applies to source-reported capacity and optional source-reported cost.
    if ((value.observedAt !== null || value.expiresAt !== null) && observedAt === null)
      errors.push(failure(role,"clock-unavailable"));
    if (observedAt !== null) {
      if (value.observedAt !== null && Date.parse(value.observedAt) > Date.parse(observedAt))
        errors.push(failure(role,"not-yet-observed"));
      if (value.expiresAt !== null && Date.parse(value.expiresAt) <= Date.parse(observedAt))
        errors.push(failure(role,"expired"));
    }
    // Zero is a witnessed zero, not absence. It cannot support positive demand.
    if (role === "capacity" && value.atoms === "0")
      errors.push(failure(role,"reported-zero-capacity"));
    return value;
  };

  // One source reading is shared by all options, never cloned into per-route
  // ownership. A disconnected or contradictory source remains an obstruction.
  const sourceCache = new Map();
  const sourceOf = reference => {
    const key = refKey(reference);
    if (sourceCache.has(key)) return sourceCache.get(key);
    if (sourceCache.size >= maxSources)
      throw new RangeError("transport possibilities: capacity-source bound exceeded");
    const evidence = Object.freeze({
      resource:targets(reference,"capacityResource"),
      capacity:targets(reference,"capacity"),
    });
    const errors = [];
    const resource = expectOne(evidence.resource,"capacityResource",errors);
    const quantity = expectOne(evidence.capacity,"capacity",errors);
    const capacity = quantityOf(evidence.capacity[0],"capacity",errors);
    const reading = Object.freeze({source:reference,resource,quantity,capacity,
      evidence,failures:Object.freeze(errors),
      standing:"source-reported-unreserved-capacity"});
    sourceCache.set(key,reading);
    return reading;
  };

  const offered = targets(channel,"offers");
  if (offered.length > maxOptions)
    throw new RangeError("transport possibilities: option bound exceeded");
  const possibilities = [], obstructions = [];
  for (const entry of offered) {
    const option = entry.target;
    const evidence = {offers:entry.edges,
      resource:targets(option,"resource"),from:targets(option,"from"),to:targets(option,"to"),
      uses:targets(option,"uses"),cost:targets(option,"cost"),
      opposes:targets(option,"opposes"),revokes:targets(option,"revokes")};
    const errors = [];
    const resource = expectOne(evidence.resource,"resource",errors);
    const from = expectOne(evidence.from,"from",errors);
    const to = expectOne(evidence.to,"to",errors);
    evidence.sourceCompartments = from ? targets(from,"inside") : Object.freeze([]);
    evidence.targetCompartments = to ? targets(to,"inside") : Object.freeze([]);
    const sourceCell = expectOne(evidence.sourceCompartments,"sourceCell",errors);
    const targetCell = expectOne(evidence.targetCompartments,"targetCell",errors);
    if (evidence.uses.length === 0) errors.push(failure("uses","missing",0));
    if (evidence.cost.length > 1) errors.push(failure("cost","ambiguous",evidence.cost.length));
    const cost = quantityOf(evidence.cost[0],"cost",errors);
    if (evidence.opposes.length) errors.push(failure("opposes","contrary-testimony",evidence.opposes.length));
    if (evidence.revokes.length) errors.push(failure("revokes","revoked-testimony",evidence.revokes.length));
    const sources = Object.freeze(evidence.uses.map(link => sourceOf(link.target)));
    if (resource !== null) for (const source of sources) {
      if (source.resource !== null && refKey(source.resource) !== refKey(resource))
        errors.push(failure("uses","resource-mismatch"));
      for (const failureEntry of source.failures)
        errors.push(Object.freeze({...failureEntry, source:source.source}));
    }
    const reading = Object.freeze({option,channel,resource,from,to,sourceCell,targetCell,
      crossesCellBoundary:sourceCell && targetCell ? sourceCell.id !== targetCell.id : null,
      cost,capacitySources:sources,evidence:Object.freeze(evidence),
      standing:"source-offered-only-not-authorized",
      effects:"not-performed",reservation:"not-checked"});
    if (errors.length) obstructions.push(Object.freeze({
      ...reading,failures:Object.freeze(errors),standing:"obstructed-offer"}));
    else possibilities.push(reading);
  }
  return Object.freeze({kind:"signgraph.channelTransportPossibilities.v1",
    graph:received.id,channel,observedAt,
    possibilities:Object.freeze(possibilities),obstructions:Object.freeze(obstructions),
    capacitySources:Object.freeze([...sourceCache.values()]),
    sourceTruth:"source-assertions-not-independently-adjudicated",
    competence:"not-established",reservation:"not-checked",effects:"not-performed"});
}
