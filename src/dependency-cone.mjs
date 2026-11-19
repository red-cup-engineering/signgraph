import { createGraph, reachable, subgraph, topologicalOrder, topologicalTiers } from "@red-cup-engineering/metrologic/models/graphs/directed-multigraph";
import { costQuantale } from "@red-cup-engineering/metrologic/models/order/quantale";
import { readSourceArray, readSourceRecord } from "@red-cup-engineering/semiotic-content-address-system";
import { schemaOperationsCompose } from "@red-cup-engineering/signchain/contracts/contract-operation";
import { projectSignGraph } from "./graph.mjs";

function nodeId(topology, source) {
  const { id, type } = readSourceRecord(source, "SignGraph typed reference");
  if (typeof id !== "string" || typeof type !== "string" || topology.node(id)?.data?.type !== type)
    throw new TypeError("SignGraph: reference must name a graph member of the given type");
  return id;
}

function coneOf(source, root, predicates) {
  const selected = readSourceArray(predicates, "SignGraph cone predicates");
  if (selected.length === 0) throw new TypeError("SignGraph: a cone needs at least one predicate");
  const graph = projectSignGraph(source, selected);
  const start = nodeId(graph, root);
  const members = new Set([start, ...reachable(graph, start)]);
  const cone = subgraph(graph, members);
  const { order } = topologicalOrder(cone);
  if (!order) throw new RangeError("SignGraph: a dependency cone cannot contain a cycle");
  return { graph, cone, start, members, order };
}

/** Edges point from dependent work to prerequisites. A satisfied
 * prerequisite contributes no wait. A blocked open one propagates Infinity. */
export function readDependencyHorizon(source, root, options) {
  const { predicates, satisfied = [], blocked = [] } = readSourceRecord(options);
  const { graph, cone, start, order } = coneOf(source, root, predicates);
  const ids = values => new Set(readSourceArray(values).map(ref => nodeId(graph, ref)));
  const complete = ids(satisfied), unavailable = ids(blocked);
  if ([...complete].some(id => unavailable.has(id)))
    throw new TypeError("SignGraph: a prerequisite cannot be both satisfied and blocked");

  const heights = new Map();
  for (const id of order.toReversed()) {
    let height = unavailable.has(id) ? Infinity : 0;
    if (!complete.has(id)) {
      for (const edge of cone.outgoing(id)) {
        if (!complete.has(edge.to)) height = Math.max(height, 1 + heights.get(edge.to));
      }
    }
    heights.set(id, height);
  }
  const height = heights.get(start);
  return Object.freeze({ height, horizon: ["Now", "Soon", "Later", "Eventually"][Math.min(height, 3)] });
}

/**
 * Edges point from a container or work item to its components. Each
 * addressed attempt is counted once, including attempts that failed.
 * To finish the cone, each required node needs a successful attempt.
 * Leaves are required by default. An explicitly required empty set has
 * zero completion cost. Internal attempts can be required by naming them
 * in required, or contribute when a successful internal attempt is known.
 */
export function rollupAttemptCosts(source, root, options) {
  const { predicates, attempts, required } = readSourceRecord(options);
  const { graph, cone, members } = coneOf(source, root, predicates);
  const byId = new Map(), cheapest = new Map();
  for (const sourceAttempt of readSourceArray(attempts, "SignGraph attempts")) {
    const { id, work, cost, successful } = readSourceRecord(sourceAttempt, "SignGraph attempt");
    if (typeof id !== "string" || !id || typeof successful !== "boolean")
      throw new TypeError("SignGraph: attempts require an identity and a successful flag");
    const node = nodeId(graph, work);
    costQuantale.le(cost, costQuantale.top);
    const prior = byId.get(id);
    if (prior && (prior.node !== node || prior.cost !== cost || prior.successful !== successful))
      throw new TypeError("SignGraph: conflicting reports of attempt " + id);
    byId.set(id, { node, cost, successful });
  }

  let upperBound = costQuantale.unit, count = 0;
  for (const id of [...byId.keys()].sort()) {
    const { node, cost, successful } = byId.get(id);
    if (!members.has(node)) continue;
    upperBound = costQuantale.tensor(upperBound, cost);
    count += 1;
    if (successful) cheapest.set(node, costQuantale.meet(cheapest.get(node) ?? costQuantale.top, cost));
  }
  const obligations = required === undefined
    ? new Set([...members].filter(id => cone.outgoing(id).length === 0 || cheapest.has(id)))
    : new Set(readSourceArray(required).map(ref => nodeId(cone, ref)));
  const missing = [...obligations].filter(id => !cheapest.has(id)).sort();
  const cheapestSuccess = missing.length === 0
    ? costQuantale.tensorAll([...obligations].sort().map(id => cheapest.get(id))) : null;
  return Object.freeze({ upperBound, cheapestSuccess, attempts: count, missing: Object.freeze(missing) });
}

/** A failed component is retained in the readout while the endeavor
 * continues. A failed aim or the endeavor's own abandonment ends it. */
export function readEndeavor(source, root, options) {
  const { contains, aim, failed = [], abandoned = [] } = readSourceRecord(options);
  const { graph, start, members } = coneOf(source, root, contains);
  const goals = projectSignGraph(source, [aim]).outgoing(start).map(edge => edge.to);
  const failures = readSourceArray(failed).map(ref => nodeId(graph, ref));
  const abandonments = readSourceArray(abandoned).map(ref => nodeId(graph, ref));
  const failedAims = [...new Set(goals)].filter(goal => failures.includes(goal) || abandonments.includes(goal)).sort();
  const absorbed = [...new Set([...failures, ...abandonments])].filter(id => id !== start && members.has(id)).sort();
  return Object.freeze({
    continuing: !abandonments.includes(start) && failedAims.length === 0,
    failedAims: Object.freeze(failedAims),
    absorbed: Object.freeze(absorbed),
  });
}

/**
 * Read the admitted contains → realized-by nesting and the precedes graph
 * of the outer workflow's work items. Optional entry and exit are typed
 * references; otherwise the structural sources and sinks serve as candidates.
 * A declared boundary is checked when both workflows name one.
 */
export function readWorkflow(source, root, options) {
  const { contains, realizedBy, precedes, entry, exit, boundaries = [] } = readSourceRecord(options);
  const graph = projectSignGraph(source, [contains, realizedBy, precedes]);
  const start = nodeId(graph, root);
  const members = new Set(graph.outgoing(start, { kind: contains }).map(edge => edge.to));
  const boundaryById = new Map();
  for (const pair of readSourceArray(boundaries)) {
    const [reference, type, ...extra] = readSourceArray(pair);
    const id = nodeId(graph, reference);
    if (typeof type !== "string" || !type.trim() || extra.length ||
        (boundaryById.has(id) && boundaryById.get(id) !== type))
      throw new TypeError("SignGraph: each workflow may declare one boundary type");
    boundaryById.set(id, type);
  }
  for (const item of members) for (const edge of graph.outgoing(item, { kind: realizedBy })) {
    const domain = boundaryById.get(edge.to), codomain = boundaryById.get(start);
    if (domain !== undefined && codomain !== undefined && !schemaOperationsCompose({ codomain }, { domain })) {
      const error = new TypeError("SignGraph: nested workflow boundary does not match the outer workflow");
      error.code = "BOUNDARY_TYPE";
      throw error;
    }
  }

  // Multiple witnesses for the same precedence give one scheduling constraint.
  const graphOf = edges => createGraph({ nodes: [...members].map(id => ({ id })), edges });
  const orderGraph = graphOf(graph.edges({ kind: precedes }).filter(edge => members.has(edge.from) && members.has(edge.to))
    .map(({ from, to }) => ({ from, to })));
  const sources = [...members].filter(id => orderGraph.incoming(id).length === 0);
  const sinks = [...members].filter(id => orderGraph.outgoing(id).length === 0);
  const entries = entry === undefined ? sources : [nodeId(graph, entry)];
  const exits = exit === undefined ? sinks : [nodeId(graph, exit)];
  if ([...entries, ...exits].some(id => !members.has(id)))
    throw new TypeError("SignGraph: workflow entry and exit must be member work items");
  const reverse = graphOf(orderGraph.edges().map(({ from, to }) => ({ from: to, to: from })));
  const forwardReach = new Set([...entries, ...reachable(orderGraph, entries)]);
  const reverseReach = new Set([...exits, ...reachable(reverse, exits)]);
  const dead = [...members].filter(id => !forwardReach.has(id) || !reverseReach.has(id)).sort();
  const { tiers } = topologicalTiers(orderGraph);
  return Object.freeze({
    sources: Object.freeze(sources.sort()), sinks: Object.freeze(sinks.sort()), dead: Object.freeze(dead),
    sound: tiers !== undefined && entries.length === 1 && exits.length === 1 && dead.length === 0,
    patterns: Object.freeze({
      sequence: orderGraph.edges().filter(edge =>
        orderGraph.outgoing(edge.from).length === 1 && orderGraph.incoming(edge.to).length === 1).length,
      branch: [...members].filter(id => orderGraph.outgoing(id).length > 1).length,
      parallel: tiers?.filter(tier => tier.length > 1).length ?? null,
    }),
  });
}
