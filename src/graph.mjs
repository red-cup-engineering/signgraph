import { createGraph } from "@red-cup-engineering/metrologic/models/graphs/directed-multigraph";

/**
 * Pure SignGraph topology projection over admitted SignCell graph coordinates.
 * Metrologic owns generic graph algorithms and their mutable construction
 * builder. SignGraph must expose only the readout: allowing addNode/addEdge
 * on this result could fabricate unaddressed edges or witnesses after source
 * admission, invalidating downstream AOE plan/evidence projections.
 *
 * Edges are exactly the original addressed statements; no causal dependency,
 * predicate truth or actor power is inferred from the graph.
 */
export function projectSignGraphTopology(graph) {
  if (!graph || !Array.isArray(graph.cells) || !Array.isArray(graph.edges))
    throw new TypeError("SignGraph topology requires admitted cells and addressed edges");
  const topology = createGraph();
  for (const at of graph.cells) {
    if (typeof at?.id !== "string" || !at.id)
      throw new TypeError("SignGraph topology requires an addressed cell");
    topology.addNode(at.id, Object.freeze({ kind: at.kind, type: at.type }));
  }
  for (const entry of graph.edges) {
    if (typeof entry?.id !== "string" || !entry.id ||
        typeof entry.edge?.subject?.id !== "string" ||
        typeof entry.edge?.object?.id !== "string" ||
        typeof entry.edge?.witness?.id !== "string" ||
        typeof entry.edge?.predicate !== "string")
      throw new TypeError("SignGraph topology requires addressed, witnessed edges");
    topology.addEdge({
      from: entry.edge.subject.id, to: entry.edge.object.id,
      kind: entry.edge.predicate,
      data: Object.freeze({ id: entry.id, witness: entry.edge.witness.id }),
    });
  }
  // Don't leak the imperative builder into the pure SignCell→SignGraph layer.
  // Keep the exact generic Metrologic graph readouts and algorithms intact.
  const { addNode: _addNode, addEdge: _addEdge, ...readers } = topology;
  return Object.freeze(readers);
}
