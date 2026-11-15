/**
 * Diagram text for a directed multigraph: Graphviz DOT and Mermaid flowcharts.
 *
 * A graph here is the Metrologic directed multigraph SignGraph computes over; its `toJson` gives the
 * nodes and edges in their canonical order, so the same graph always renders the same text.
 */
import { toJson } from "@red-cup-engineering/metrologic/models/graphs/directed-multigraph";

const quote = (text) => `"${String(text).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
const dotId = (text) => /^[A-Za-z_][A-Za-z0-9_]*$/u.test(text) ? text : quote(text);

/**
 * Graphviz DOT text for a graph.
 * @param {object} graph A directed multigraph.
 * @param {{label?: string, rankdir?: string, nodeLabel?: (node: object) => string|undefined, edgeLabel?: (edge: object) => string|undefined}} [options]
 *   The digraph's name, its rank direction, and the labels of nodes and edges; an edge of the default kind has no label.
 * @returns {string} The DOT document.
 */
export function toDot(graph, { label = "graph_data", rankdir, nodeLabel = () => undefined, edgeLabel = (edge) => edge.kind === "edge" ? undefined : edge.kind } = {}) {
  const { nodes, edges } = toJson(graph), lines = [`digraph ${dotId(label)} {`];
  if (rankdir !== undefined) lines.push(`  rankdir=${rankdir};`);
  for (const node of nodes) {
    const value = nodeLabel(node);
    lines.push(`  ${quote(node.id)}${value === undefined ? "" : ` [label=${quote(value)}]`};`);
  }
  for (const edge of edges) {
    const value = edgeLabel(edge);
    lines.push(`  ${quote(edge.from)} -> ${quote(edge.to)}${value === undefined ? "" : ` [label=${quote(value)}]`};`);
  }
  return `${lines.join("\n")}\n}\n`;
}

/**
 * Mermaid flowchart text for a graph.
 *
 * Diagram aliases are local positions, never identities of source addresses. Sanitizing unrelated
 * addresses with one pattern can identify distinct nodes ("a/b", "a b" and "a_b") and silently forge
 * connectivity, so each node takes one injective alias from the canonical node order and its complete
 * id survives in the displayed label.
 * @param {object} graph A directed multigraph.
 * @param {{direction?: "TD"|"TB"|"BT"|"LR"|"RL"}} [options] The flowchart direction.
 * @returns {string} The Mermaid document.
 * @throws {TypeError} When the direction is not one Mermaid knows.
 */
export function toMermaid(graph, { direction = "TD" } = {}) {
  if (!["TD", "TB", "BT", "LR", "RL"].includes(direction))
    throw new TypeError("Mermaid flowchart direction must be TD, TB, BT, LR or RL");
  const { nodes, edges } = toJson(graph);
  const alias = new Map(nodes.map((node, index) => [node.id, `m${index}`]));
  const lines = [`flowchart ${direction}`];
  for (const node of nodes) lines.push(`  ${alias.get(node.id)}[${quote(node.id)}]`);
  for (const edge of edges) lines.push(`  ${alias.get(edge.from)} ${edge.kind === "edge" ? "-->" : `-- ${edge.kind} -->`} ${alias.get(edge.to)}`);
  return `${lines.join("\n")}\n`;
}
