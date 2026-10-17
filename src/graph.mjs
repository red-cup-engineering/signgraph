import { createGraph } from "@red-cup-engineering/metrologic/models/graphs/directed-multigraph";
import { glueSignGraphs } from "./semantic-graph.mjs";

/**
 * A read-only topology of an ORIGINAL admitted SignCell SemanticGraph.
 *
 * The exact SignCell producer owns admission of closed cell membership,
 * typed predicates, signed evidence references and all ni:/EAVT addresses.
 * Project only after replaying that existing admission. Otherwise generic
 * Metrologic createGraph() would silently create missing endpoint nodes,
 * manufacturing apparent market/enterprise relations from a forged cut.
 *
 * A witness mark stays a vertex even when it is not a subject or object.
 * Edge direction and parallel witness identities stay as admitted; no
 * causal claim, payment, authority or evidence polarity is newly inferred.
 */
export function projectSignGraphTopology(graph) {
  const result = glueSignGraphs(graph);
  if (!result.ok) {
    const error = new TypeError("SignGraph topology refused source graph: " + result.refusal.message);
    error.code = result.refusal.code;
    throw error;
  }
  const source = result.value.graph;
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
  // Construction is internal; no builder authority escapes into the
  // immutable SignCell -> SignGraph -> SignCraft dataflow.
  const { addNode: _addNode, addEdge: _addEdge, ...readers } = topology;
  return Object.freeze(readers);
}
