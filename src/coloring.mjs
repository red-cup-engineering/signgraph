/**
 * Colourings of a labelled directed graph that reveal its structure.
 *
 * A graph is `{ nodes, edges }`: node names and edges `{ from, to, label? }` (a label such as a
 * predicate name; absent is the empty label).
 *
 *   refineColors   colour refinement, the 1-dimensional Weisfeiler-Leman algorithm (Weisfeiler and
 *                  Leman 1968; Grohe et al. 2021): start from an initial colouring, then repeatedly
 *                  recolour each node by its colour and the multiset of (direction, label,
 *                  neighbour colour) until the partition stops splitting. Two nodes end with one
 *                  colour exactly when no finite amount of local looking tells them apart: the
 *                  coarsest equitable partition. It depends on the edges and the initial colours
 *                  alone, never on names or order. Colour names are numbered within one run (`c0`,
 *                  `c1`, ...) in the order of their descriptions. Returns `{ color, rounds, classes }`.
 *   numberClasses  number the classes of a colouring by size, largest first.
 *   properColoring a proper colouring of the underlying undirected graph, computed by Metrologic's
 *                  `properColoring` (Lean `Calculus/Order/GraphColoring`, `ChromaticNumber`) on the
 *                  graph's adjacency matrix. This module has no colouring algorithm of its own.
 */
import { properColoring as properColoringOfWeights } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/coloring";
import { intOne, intZero } from "@red-cup-engineering/metrologic/number/exact-number";

const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Colour refinement from an initial colouring, to the stable partition.
 * @param {{ nodes: string[], edges: Array<{from: string, to: string, label?: string}>, initial?: Map<string, string>, maxRounds?: number }} input
 * @returns {{ color: Map<string, string>, rounds: number, classes: number }}
 */
export function refineColors({ nodes, edges, initial = new Map(), maxRounds = 64 }) {
  const out = new Map(), inn = new Map();
  const add = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  for (const e of edges) { add(out, e.from, e); add(inn, e.to, e); }
  let color = new Map(nodes.map((n) => [n, initial.get(n) ?? "·"]));
  let classes = new Set(color.values()).size, rounds = 0;
  for (; rounds < maxRounds; rounds++) {
    const described = new Map();
    for (const n of nodes) {
      const parts = [
        ...(out.get(n) ?? []).map((e) => `>${e.label ?? ""}:${color.get(e.to) ?? "·"}`),
        ...(inn.get(n) ?? []).map((e) => `<${e.label ?? ""}:${color.get(e.from) ?? "·"}`),
      ].sort(byName);
      described.set(n, `${color.get(n)}|${parts.join(",")}`);
    }
    const names = [...new Set(described.values())].sort(byName), number = new Map(names.map((d, i) => [d, `c${i}`]));
    color = new Map(nodes.map((n) => [n, number.get(described.get(n))]));
    if (names.length === classes) break; // stable: refining no longer splits a class
    classes = names.length;
  }
  return { color, rounds: rounds + 1, classes };
}

/** Number the classes of a colouring by size (largest first). Returns `{ index, sizes, keys }`. */
export function numberClasses(color) {
  const count = new Map();
  for (const c of color.values()) count.set(c, (count.get(c) ?? 0) + 1);
  const order = [...count.keys()].sort((a, b) => count.get(b) - count.get(a) || byName(String(a), String(b)));
  const index = new Map(order.map((c, i) => [c, i]));
  return { index: new Map([...color].map(([t, c]) => [t, index.get(c)])), sizes: order.map((c) => count.get(c)), keys: order };
}

/**
 * A proper colouring of the underlying undirected graph (nodes joined by an edge get different
 * colours) with at most `colorCount` colours, through Metrologic's `properColoring`. The default
 * `colorCount` is the maximum degree plus one, which always admits a colouring. Self-loops are
 * ignored. Returns `{ color: Map<node, number>, colors }`, or `null` when no colouring with
 * `colorCount` colours exists.
 * @param {{ nodes: string[], edges: Array<{from: string, to: string}> }} graph
 * @param {number} [colorCount]
 */
export function properColoring({ nodes, edges }, colorCount) {
  const at = new Map(nodes.map((n, i) => [n, i]));
  const weights = nodes.map(() => nodes.map(() => intZero));
  const degree = nodes.map(() => new Set());
  for (const e of edges) {
    if (e.from === e.to || !at.has(e.from) || !at.has(e.to)) continue;
    const a = at.get(e.from), b = at.get(e.to);
    weights[a][b] = intOne; weights[b][a] = intOne;
    degree[a].add(b); degree[b].add(a);
  }
  const k = colorCount ?? Math.max(0, ...degree.map((d) => d.size)) + 1;
  const result = properColoringOfWeights(weights, k);
  if (!result.colors) return null;
  const color = new Map(nodes.map((n, i) => [n, result.colors[i]]));
  return { color, colors: color.size ? Math.max(...color.values()) + 1 : 0 };
}
