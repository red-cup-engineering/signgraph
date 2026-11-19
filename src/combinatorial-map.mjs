/**
 * Combinatorial maps: a graph with a rotation system (the cyclic order of the edges at each
 * vertex), its faces, its dual and its genus; and the exact closure content of a face.
 *
 * A graph is `{ nodes, edges }` with edges `{ from, to, label? }`. Edge `i` has two darts: `2i`
 * (from -> to) and `2i + 1` (to -> from); the opposite of dart `d` is `d ^ 1`. A rotation maps each
 * node to the array of darts leaving it, in counter-clockwise order. A face is an orbit of
 * `phi(d) = sigma^-1(opposite(d))`, so a bounded face of a plane embedding is traced counter-
 * clockwise with the face on the left.
 *
 *   rotationFromPositions(graph, positions)   order each vertex's darts by angle
 *   combinatorialMap(graph, rotation)         { darts, faces, genus, ... }
 *   dualMap(map)                              { graph, rotation, ... }: faces become vertices
 *   latticeFrame(lattice, positions)          corner turns of a face, snapped to a lattice
 *   faceClosure(map, frame)                   [{ face, turn, burgers }] through Metrologic
 *
 * Positions are a `Map` or an object from node to `[x, y]` or `{ x, y }`.
 */
import { holonomy } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/affine-holonomy";

const point = (positions, node) => {
  const p = positions instanceof Map ? positions.get(node) : positions[node];
  if (!p) throw new RangeError(`combinatorial-map: no position for node ${String(node)}`);
  return Array.isArray(p) ? p : [p.x, p.y];
};

const endpoints = (graph, d) => {
  const e = graph.edges[d >> 1];
  return d & 1 ? [e.to, e.from] : [e.from, e.to];
};

/** Direction angle of dart `d`, from its tail towards its head. */
const dartAngle = (graph, positions, d) => {
  const [tail, head] = endpoints(graph, d);
  const a = point(positions, tail), b = point(positions, head);
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
};

/**
 * The rotation system of a straight-line drawing: at each node, its darts in counter-clockwise
 * order of direction (ties, such as loops, by dart number).
 * @returns {Map<any, number[]>}
 */
export function rotationFromPositions(graph, positions) {
  const rotation = new Map(graph.nodes.map((n) => [n, []]));
  graph.edges.forEach((e, i) => {
    rotation.get(e.from).push(2 * i);
    rotation.get(e.to).push(2 * i + 1);
  });
  for (const darts of rotation.values()) {
    const angle = new Map(darts.map((d) => [d, dartAngle(graph, positions, d)]));
    darts.sort((a, b) => angle.get(a) - angle.get(b) || a - b);
  }
  return rotation;
}

/**
 * Trace the faces of the map and compute its genus from Euler's formula `V - E + F = 2c - 2g`
 * (`c` connected components).
 * @returns {{ graph, rotation, darts: Array<{id, edge, from, to}>, faces: Array<{id: number, darts: number[], nodes: any[]}>, faceOf: Map<number, number>, components: number, genus: number }}
 */
export function combinatorialMap(graph, rotation) {
  const position = new Map(), next = new Map();
  for (const [node, darts] of rotation) {
    darts.forEach((d, i) => {
      position.set(d, [node, i]);
      next.set(d, darts[(i + 1) % darts.length]);
    });
  }
  const prev = new Map();
  for (const [d, n] of next) prev.set(n, d);
  const darts = graph.edges.flatMap((e, i) => [
    { id: 2 * i, edge: i, from: e.from, to: e.to },
    { id: 2 * i + 1, edge: i, from: e.to, to: e.from },
  ]);
  for (const d of darts) {
    if (!position.has(d.id) || position.get(d.id)[0] !== d.from) {
      throw new RangeError(`combinatorial-map: dart ${d.id} is missing from the rotation at ${String(d.from)}`);
    }
  }
  const phi = (d) => prev.get(d ^ 1);
  const faceOf = new Map(), faces = [];
  for (const { id } of darts) {
    if (faceOf.has(id)) continue;
    const cycle = [];
    for (let d = id; !faceOf.has(d); d = phi(d)) { faceOf.set(d, faces.length); cycle.push(d); }
    faces.push({ id: faces.length, darts: cycle, nodes: cycle.map((d) => darts[d].from) });
  }
  // A vertex with no edges is a sphere of its own: one face, no darts.
  const isolated = graph.nodes.filter((n) => !rotation.get(n)?.length);
  for (const n of isolated) faces.push({ id: faces.length, darts: [], nodes: [n] });
  const parent = new Map(graph.nodes.map((n) => [n, n]));
  const find = (n) => (parent.get(n) === n ? n : (parent.set(n, find(parent.get(n))), parent.get(n)));
  for (const e of graph.edges) parent.set(find(e.from), find(e.to));
  const components = new Set(graph.nodes.map(find)).size;
  const euler = graph.nodes.length - graph.edges.length + faces.length;
  return { graph, rotation, darts, faces, faceOf, components, genus: (2 * components - euler) / 2 };
}

/**
 * The dual map: one vertex per face (named `f<id>`), one edge per edge, dart `d` of the dual
 * leaving the face that contains `d`. The rotation at a face is the order of its darts around it, so
 * a face of length k becomes a vertex of degree k and the dual's faces are the original vertices
 * (`vertexOfFace` names each).
 * @returns {{ graph, rotation, map, vertexOfFace: Map<number, any> }}
 */
export function dualMap(map) {
  const name = (f) => `f${f}`;
  const graph = {
    nodes: map.faces.filter((f) => f.darts.length).map((f) => name(f.id)),
    edges: map.graph.edges.map((e, i) => ({ from: name(map.faceOf.get(2 * i)), to: name(map.faceOf.get(2 * i + 1)), label: e.label })),
  };
  const rotation = new Map(graph.nodes.map((n) => [n, []]));
  for (const f of map.faces) if (f.darts.length) rotation.set(name(f.id), [...f.darts]);
  const dual = combinatorialMap(graph, rotation);
  const vertexOfFace = new Map(dual.faces.map((f) => [f.id, map.darts[f.darts[0] ^ 1].from]));
  return { graph, rotation, map: dual, vertexOfFace };
}

/**
 * Corner turns snapped to a lattice. `lattice` is `"c4"` (quarter turns) or `"hex"` (sixth turns);
 * the returned frame's `turn(previousDart, dart)` is the exterior angle from one dart to the next,
 * in lattice steps, mod the frame order.
 */
export function latticeFrame(lattice, map, positions) {
  const order = { c4: 4, hex: 6 }[lattice];
  if (!order) throw new TypeError(`combinatorial-map: unknown lattice "${lattice}" (expected "c4" or "hex")`);
  const turn = (a, b) => {
    const exterior = dartAngle(map.graph, positions, b) - dartAngle(map.graph, positions, a);
    const steps = Math.round((exterior / (2 * Math.PI)) * order);
    return ((steps % order) + order) % order;
  };
  return { lattice, turn };
}

/**
 * The exact holonomy of each face boundary, through Metrologic's `affine-holonomy`. The face's walk
 * has one move per dart: the corner turn into that dart (`frame.turn(previous, dart)`, default one
 * step) then one unit step. A face with `turn = 0` and `burgers = [0, 0]` closes; `turn != 0` is a
 * disclination, `turn = 0` with a nonzero `burgers` a dislocation.
 * @param {object} map result of `combinatorialMap`
 * @param {{ lattice: "c4" | "hex", turn?: (previous: number, dart: number) => number }} frame
 * @returns {Array<{ face: number, turn: number, burgers: readonly [number, number] }>}
 */
export function faceClosure(map, frame) {
  const turnAt = frame.turn ?? (() => 1);
  return map.faces.filter((f) => f.darts.length).map((f) => {
    const walk = f.darts.map((d, i) => turnAt(f.darts[(i + f.darts.length - 1) % f.darts.length], d));
    const h = holonomy(walk, frame.lattice);
    return { face: f.id, turn: h.turn, burgers: h.burgers };
  });
}
