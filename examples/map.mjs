import { rotationFromPositions, combinatorialMap, dualMap, faceClosure, latticeFrame } from "../src/combinatorial-map.mjs";
import { refineColors, numberClasses, properColoring } from "../src/coloring.mjs";

const grid = (w, h, wrap) => {
  const id = (x, y) => `${x},${y}`, nodes = [], edges = [], positions = new Map();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { nodes.push(id(x, y)); positions.set(id(x, y), [x, y]); }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x + 1 < w || wrap) edges.push({ from: id(x, y), to: id((x + 1) % w, y) });
    if (y + 1 < h || wrap) edges.push({ from: id(x, y), to: id(x, (y + 1) % h) });
  }
  return { graph: { nodes, edges }, positions };
};
const pentagon = () => {
  const nodes = [0, 1, 2, 3, 4], positions = new Map(), edges = [];
  for (const n of nodes) positions.set(n, [Math.cos((2 * Math.PI * n) / 5), Math.sin((2 * Math.PI * n) / 5)]);
  for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) edges.push({ from: a, to: b });
  return { graph: { nodes, edges }, positions };
};
const k4 = () => {
  const positions = new Map([[0, [0, 0]], [1, [4, 0]], [2, [2, 4]], [3, [2, 1.3]]]);
  const edges = [[0, 1], [1, 2], [2, 0], [0, 3], [1, 3], [2, 3]].map(([from, to]) => ({ from, to }));
  return { graph: { nodes: [0, 1, 2, 3], edges }, positions };
};

// The torus has no straight-line drawing in the plane, so its rotation system is given directly:
// at every vertex the darts leave east, north, west, south, in counter-clockwise order.
const torusRotation = (graph, w, h) => {
  const rotation = new Map(graph.nodes.map((n) => [n, [null, null, null, null]]));
  const at = (x, y) => `${x},${y}`;
  graph.edges.forEach((e, i) => {
    const [x, y] = e.from.split(",").map(Number);
    const horizontal = e.to === at((x + 1) % w, y);
    rotation.get(e.from)[horizontal ? 0 : 1] = 2 * i;
    rotation.get(e.to)[horizontal ? 2 : 3] = 2 * i + 1;
  });
  return rotation;
};
const torusTurn = (graph) => {
  const dir = (d) => {
    const e = graph.edges[d >> 1], [x, y] = e.from.split(",").map(Number), horizontal = e.to.split(",")[1] === String(y);
    return (horizontal ? 0 : 1) + (d & 1 ? 2 : 0);
  };
  return (a, b) => (((dir(b) - dir(a)) % 4) + 4) % 4;
};

const report = (name, { graph, positions, rotation: given, turn }, lattice) => {
  const rotation = given ?? rotationFromPositions(graph, positions);
  const map = combinatorialMap(graph, rotation);
  const dual = dualMap(map);
  const degree = new Map(graph.nodes.map((n) => [n, rotation.get(n).length]));
  const dualDegreeOfVertex = new Map(dual.map.faces.map((f) => [dual.vertexOfFace.get(f.id), f.darts.length]));
  const same = graph.nodes.every((n) => degree.get(n) === dualDegreeOfVertex.get(n));
  const faceLengths = map.faces.map((f) => f.darts.length);
  const dualDegrees = dual.graph.nodes.map((n) => dual.rotation.get(n).length);
  console.log(`\n== ${name}: V=${graph.nodes.length} E=${graph.edges.length} F=${map.faces.length} genus=${map.genus}`);
  console.log("face lengths      ", JSON.stringify(faceLengths));
  console.log("dual vertex degree", JSON.stringify(dualDegrees), `(equal to the face lengths: ${JSON.stringify(dualDegrees) === JSON.stringify(faceLengths)})`);
  console.log("dual faces give back each original vertex's degree:", same, "| dual genus:", dual.map.genus);
  if (lattice) {
    const closures = faceClosure(map, turn ? { lattice, turn } : latticeFrame(lattice, map, positions));
    console.log(`face closures (${lattice}):`, closures.map((c) => `f${c.face}:turn${c.turn}${JSON.stringify(c.burgers)}`).join(" "));
  }
  return map;
};

report("planar graph: 3x3 grid", grid(3, 3, false), "c4");
report("K4 (planar, triangles)", k4(), null);
report("K5 on a pentagon", pentagon(), null);
const torus = grid(4, 4, true);
report("torus grid 4x4", { ...torus, rotation: torusRotation(torus.graph, 4, 4), turn: torusTurn(torus.graph) }, "c4");
const star = { graph: { nodes: ["a", "b", "c"], edges: [{ from: "a", to: "b", label: "p" }, { from: "b", to: "c", label: "p" }, { from: "c", to: "a", label: "q" }] } };
const r = refineColors({ nodes: star.graph.nodes, edges: star.graph.edges });
console.log("\nrefineColors on a labelled triangle:", JSON.stringify([...r.color]), "classes", r.classes);
console.log("numberClasses:", JSON.stringify(numberClasses(r.color).sizes));
const colored = properColoring(k4().graph);
console.log("properColoring(K4):", JSON.stringify([...colored.color]), "colors", colored.colors);

// A five-cycle on the hexagonal frame: its inner face is a five-site, a disclination; the
// outer face turns the other way and does not close either.
const cycle5 = pentagon();
cycle5.graph = { nodes: cycle5.graph.nodes, edges: [0, 1, 2, 3, 4].map((a) => ({ from: a, to: (a + 1) % 5 })) };
report("five-cycle on a hexagonal frame", cycle5, "hex");
