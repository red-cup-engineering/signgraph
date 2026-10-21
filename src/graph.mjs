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
export function findSignGraphRoute(graph, sourceReference, targetReference, options = {}) {
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
export function channelResourceIncidence(graph, {
  channel, relations, maxMessages = 256, maxExchanges = 1024, maxEdges = 16384,
} = {}) {
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
    if (relations.inside && evidence.from.length === 1 && evidence.to.length === 1) {
      const origins = targetGroups(evidence.from[0].target, "inside");
      const destinations = targetGroups(evidence.to[0].target, "inside");
      evidence.originCell = origins;
      evidence.destinationCell = destinations;
      if (origins.length !== 1)
        failures.push(Object.freeze({role:"originCell", count:origins.length,
          kind: origins.length ? "ambiguous" : "missing"}));
      if (destinations.length !== 1)
        failures.push(Object.freeze({role:"destinationCell", count:destinations.length,
          kind: destinations.length ? "ambiguous" : "missing"}));
      if (origins.length === 1) sourceCell = origins[0].target;
      if (destinations.length === 1) targetCell = destinations[0].target;
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
      sourceCell, targetCell,
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
