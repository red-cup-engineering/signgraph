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
