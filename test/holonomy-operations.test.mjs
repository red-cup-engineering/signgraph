import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { operations, LIMITS, executeOperation } from "../src/operations.mjs";

const triangle = () => ({
  vertices: ["a", "b", "c"],
  edges: [
    { id: "ab", from: "a", to: "b" },
    { id: "bc", from: "b", to: "c" },
    { id: "ca", from: "c", to: "a" },
  ],
  faces: [{ id: "f", boundary: ["ab", "bc", "ca"].map(edge => ({ edge, direction: 1 })) }],
});

test("three reusable operations share one structural admission, with machine-readable schemas", () => {
  assert.deepEqual(Object.values(operations).map(op => op.id), [
    "signgraph.holonomy.topology",
    "signgraph.holonomy.burgers",
    "signgraph.holonomy.geometry",
    "signgraph.holonomy.affine",
    "signgraph.j26.puncture",
    "signgraph.mark-incidence.observed-head-gluing",
    "signgraph.mark-incidence.articulating-tower",
  ]);
  for (const op of Object.values(operations).filter(op =>
      op.id.startsWith("signgraph.holonomy."))) {
    assert.equal(op.inputSchema.type, "object");
    assert.equal(op.inputSchema.additionalProperties, false);
    assert.deepEqual(op.inputSchema.required.slice(0, 3), ["vertices", "edges", "faces"]);
    assert.equal(typeof op.execute, "function");
  }
  assert.deepEqual(operations.articulatingTower.inputSchema.required,["articulating"]);
  assert.equal(operations.articulatingTower.inputSchema.additionalProperties,false);
  const receipt = executeOperation("signgraph.holonomy.topology", triangle());
  assert.deepEqual(receipt.betti, { h0: 1, h1: 0, h2: 0 });
  assert.deepEqual(receipt.rank, { zero: 2, one: 1 });
  assert.equal(receipt.graphOnlyH1, 1);
  assert.equal(receipt.coefficientDomain, "Q");
  assert.deepEqual(receipt.shape, { vertices: 3, edges: 3, faces: 1, faceSteps: 3 });
  assert.ok(Object.isFrozen(receipt));
});

test("operator receives actionable local Burgers charges and a constructive exactness witness", () => {
  const input = triangle();
  const bad = executeOperation("signgraph.holonomy.burgers", {
    ...input, edgeDisplacements: [[1, 0], [0, 0], [0, 0]],
  });
  assert.equal(bad.classification, "local-defect");
  assert.deepEqual(bad.faceResidues[0].burgers, [1, 0]);
  assert.equal(bad.exact, false);
  const clean = executeOperation("signgraph.holonomy.burgers", {
    ...input, edgeDisplacements: [[1, 2], [3, 4], [-4, -6]],
  });
  assert.equal(clean.classification, "exact");
  assert.equal(clean.faceResidues[0].flat, true);
  assert.ok(clean.potential.length === 3);
});

test("rational b1=0 does not suppress finite-order global affine holonomy", () => {
  // A one-cell CW model of RP². The face attaches by aa,
  // so H1(Q)=0 while π1 = C2 has nontrivial order-two monodromy.
  const projectivePlane = {
    vertices: ["p"],
    edges: [{ id: "a", from: "p", to: "p" }],
    faces: [{ id: "disk", boundary: [
      { edge: "a", direction: 1 }, { edge: "a", direction: 1 },
    ] }],
  };
  const rank = executeOperation("signgraph.holonomy.topology", projectivePlane);
  assert.deepEqual(rank.betti, { h0: 1, h1: 0, h2: 0 });
  assert.equal(rank.rationalH1Vanishing, true);
  const receipt = executeOperation("signgraph.holonomy.affine", {
    ...projectivePlane,
    edgeMotions: [{ rotation: 3, translation: [0, 0] }],
  });
  assert.equal(receipt.classification, "global-affine-holonomy");
  assert.equal(receipt.localFlat, true);
  assert.equal(receipt.nontrivialGlobalMonodromy, true);
  assert.deepEqual(receipt.faceHolonomies[0].holonomy,
    { rotation: 0, translation: [0, 0] });
  assert.equal(receipt.cycleHolonomies.length, 1);
  assert.equal(receipt.cycleHolonomies[0].holonomy.rotation, 3);
});

test("operation work limits and undeclared data fail before expensive rank elimination", () => {
  const base = triangle();
  assert.throws(() => executeOperation("signgraph.holonomy.topology", {
    ...base, vertices: Array.from({ length: LIMITS.vertices + 1 }, (_, i) => String(i)),
  }), /work budget/);
  assert.throws(() => executeOperation("signgraph.holonomy.topology", {
    ...base, faces: Array.from({ length: LIMITS.faces + 1 }, (_, i) => ({
      id: i, boundary: [{ edge: "ab", direction: 1 }],
    })),
  }), /work budget/);
  assert.throws(() => executeOperation("signgraph.holonomy.topology", {
    ...base, typo: true,
  }), /undeclared input fields/);
  assert.throws(() => executeOperation("signgraph.holonomy.topology", {
    ...base, vertices: ["x".repeat(100000)],
  }), /64KiB input work budget/);
  assert.throws(() => executeOperation("signgraph.holonomy.affine", {
    ...base, edgeMotions: [{ rotation: 0, translation: [0, 0] }],
  }), /for each edge/);
  assert.throws(() => executeOperation("signgraph.holonomy.burgers", {
    ...base, edgeDisplacements: null,
  }), /for each edge/);
  assert.throws(() => executeOperation("signgraph.holonomy.invalid", base), /not installed/);
});

test("trusted hosts can select higher finite capacity without weakening default admission", () => {
  const baseline = triangle();
  const extended = {
    ...baseline,
    vertices: [...baseline.vertices, ...Array.from({ length: LIMITS.vertices }, (_, i) => `isolated-${i}`)],
  };
  assert.throws(() => executeOperation("signgraph.holonomy.topology", extended), /work budget/);
  assert.equal(operations.topology.inputSchema.properties.vertices.maxItems, undefined);
  const admitted = executeOperation("signgraph.holonomy.topology", extended, {
    workBudget: { vertices: extended.vertices.length },
  });
  assert.deepEqual(admitted.betti, { h0: LIMITS.vertices + 1, h1: 0, h2: 0 });
  assert.throws(() => executeOperation("signgraph.holonomy.topology", baseline, {
    workBudget: { edges: 2 },
  }), /work budget/);
  assert.throws(() => executeOperation("signgraph.holonomy.topology", baseline, {
    workBudget: { vertices: 0 },
  }), /positive safe integers/);
  assert.throws(() => executeOperation("signgraph.holonomy.topology", baseline, {
    workBudget: { unlicensed: 100 },
  }), /undeclared fields/);
  assert.throws(() => executeOperation("signgraph.holonomy.topology", {
    ...baseline, workBudget: { vertices: 100000 },
  }), /undeclared input fields/);
  const longName = { vertices: ["v".repeat(70000)], edges: [], faces: [] };
  assert.throws(() => executeOperation("signgraph.holonomy.topology", longName), /64KiB/);
  assert.equal(executeOperation("signgraph.holonomy.topology", longName, {
    workBudget: { inputBytes: 80000 },
  }).betti.h0, 1);
});

const bin = fileURLToPath(new URL("../scripts/holonomy.mjs", import.meta.url));

test("installed CLI batches successful and rejected JSONL requests without side effects", () => {
  const input = triangle();
  const messages = [
    { operation: "signgraph.holonomy.topology", input },
    { operation: "signgraph.holonomy.affine", input: {
      ...input, edgeMotions: [
        { rotation: 0, translation: [1, 0] },
        { rotation: 0, translation: [0, 1] },
        { rotation: 0, translation: [-1, -1] },
      ],
    }},
    { operation: "signgraph.holonomy.unknown", input },
    { operation: "signgraph.holonomy.topology", input },
  ].map(x => JSON.stringify(x)).join("\n") + "\n";
  const child = spawnSync(process.execPath, [bin], {
    input: messages, encoding: "utf8", timeout: 10000,
  });
  assert.equal(child.status, 1, child.stderr);
  const receipts = child.stdout.trim().split("\n").map(x => JSON.parse(x));
  assert.equal(receipts.length, 4);
  assert.deepEqual(receipts.map(x => x.ok), [true, true, false, true]);
  assert.equal(receipts[0].receipt.graphOnlyH1, 1);
  assert.equal(receipts[1].receipt.classification, "affine-flat");
  assert.match(receipts[2].error, /not installed/);
  assert.equal(receipts[3].receipt.betti.h1, 0);
  assert.equal(child.stderr, "");
  const help = spawnSync(process.execPath, [bin, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /signgraph\.holonomy\.affine/);
});

test("CLI input budget produces a failure receipt and still receives subsequent work", () => {
  const child = spawnSync(process.execPath, [bin], {
    input: JSON.stringify({ operation: "signgraph.holonomy.topology", input: { typo: "x".repeat(300000) } }) +
      "\n" + JSON.stringify({ operation: "signgraph.holonomy.topology", input: triangle() }),
    encoding: "utf8", timeout: 10000,
  });
  assert.equal(child.status, 1, child.stderr);
  const receipts = child.stdout.trim().split("\n").map(x => JSON.parse(x));
  assert.equal(receipts.length, 2);
  assert.match(receipts[0].error, /64KiB/);
  assert.equal(receipts[1].ok, true);
});

test("CLI enforces its 1024-request batch limit with a failing exit code", () => {
  const request = JSON.stringify({ operation: "signgraph.holonomy.topology", input: triangle() });
  const child = spawnSync(process.execPath, [bin], {
    input: Array(1025).fill(request).join("\n") + "\n",
    encoding: "utf8", timeout: 20000, maxBuffer: 6 * 1024 * 1024,
  });
  assert.equal(child.status, 1, child.stderr);
  const lines = child.stdout.trim().split("\n").map(line => JSON.parse(line));
  assert.equal(lines.length, 1025);
  assert.ok(lines.slice(0, 1024).every(line => line.ok));
  assert.equal(lines[1024].ok, false);
  assert.match(lines[1024].error, /1024 requests/);
});

/** A tetrahedral closed exterior plus its one three-cell.
 * The face orientations represent ∂[a,b,c,d].
 */
const tetrahedron = () => {
  const vertices = ["a", "b", "c", "d"];
  const edges = [
    { id: "ab", from: "a", to: "b" },
    { id: "ac", from: "a", to: "c" },
    { id: "ad", from: "a", to: "d" },
    { id: "bc", from: "b", to: "c" },
    { id: "bd", from: "b", to: "d" },
    { id: "cd", from: "c", to: "d" },
  ];
  const walks = [
    ["abc", ["a", "c", "b"]],
    ["abd", ["a", "b", "d"]],
    ["acd", ["a", "d", "c"]],
    ["bcd", ["b", "c", "d"]],
  ];
  const faces = walks.map(([id, sequence]) => ({
    id, boundary: sequence.map((from, i) => {
      const to = sequence[(i + 1) % sequence.length];
      const e = edges.find(e => e.from === from && e.to === to ||
        e.from === to && e.to === from);
      assert.ok(e);
      return { edge: e.id, direction: e.from === from ? 1 : -1 };
    }),
  }));
  return { vertices, edges, faces, volumes: [{
    id: "interior", boundary: faces.map(f => ({ face: f.id, direction: 1 })),
  }] };
};

test("the same operational input distinguishes exterior sphere from solid 3-cell", () => {
  const solid = tetrahedron();
  const surface = executeOperation("signgraph.holonomy.topology", {
    vertices: solid.vertices, edges: solid.edges, faces: solid.faces,
  });
  const filled = executeOperation("signgraph.holonomy.topology", solid);
  assert.deepEqual(surface.betti, { h0: 1, h1: 0, h2: 1 });
  assert.deepEqual(filled.exteriorBetti, surface.betti);
  assert.deepEqual(filled.rank, { zero: 3, one: 3, two: 1 });
  assert.deepEqual(filled.betti, { h0: 1, h1: 0, h2: 0, h3: 0 });
  assert.deepEqual(filled.shape, {
    vertices: 4, edges: 6, faces: 4, faceSteps: 12,
    volumes: 1, volumeSteps: 4,
  });
  const v = executeOperation("signgraph.holonomy.burgers", {
    ...solid, edgeDisplacements: solid.edges.map((_, i) =>
      i === 0 ? [2, -1, 4] : [0, 0, 0]),
  });
  assert.equal(v.classification, "local-defect");
  assert.equal(v.dimension, 3);
  assert.deepEqual(v.volumeResidues[0].burgers, [0, 0, 0]);
  assert.ok(v.faceResidues.some(face => !face.flat));
  const h = executeOperation("signgraph.holonomy.affine", {
    ...solid, edgeMotions: solid.edges.map(() => ({
      rotation: 0, translation: [0, 0],
    })),
  });
  assert.equal(h.classification, "affine-flat");
  assert.deepEqual(h.topology.betti, filled.betti);
});

test("volume operations refuse unclosed shells, oversized volumes and excess face steps", () => {
  const solid = tetrahedron();
  assert.throws(() => executeOperation("signgraph.holonomy.topology", {
    ...solid, volumes: [{ id: "wrong", boundary: solid.volumes[0].boundary.slice(1) }],
  }), /not a closed oriented 2-chain/);
  assert.throws(() => executeOperation("signgraph.holonomy.topology", {
    ...solid, volumes: Array.from({ length: LIMITS.volumes + 1 }, (_, i) => ({
      id: String(i), boundary: solid.volumes[0].boundary,
    })),
  }), /volume count work budget/);
  assert.throws(() => executeOperation("signgraph.holonomy.topology", {
    ...solid, volumes: [{ id: "too-many", boundary:
      Array(LIMITS.volumeSteps + 1).fill({ face: "abc", direction: 1 }) }],
  }), /volume boundary work budget/);
  assert.throws(() => executeOperation("signgraph.holonomy.topology", {
    ...solid, volumes: null,
  }), /array of volumes/);
});

test("installed CLI returns the 3D Stokes and homology receipts in JSONL", () => {
  const solid = tetrahedron();
  const input = [
    { operation: "signgraph.holonomy.topology", input: solid },
    { operation: "signgraph.holonomy.burgers", input: {
      ...solid, edgeDisplacements: solid.edges.map((_, i) =>
        i === 0 ? [1, 0, -3] : [0, 0, 0]),
    }},
  ].map(JSON.stringify).join("\n") + "\n";
  const child = spawnSync(process.execPath, [bin], {
    input, encoding: "utf8", timeout: 10000,
  });
  assert.equal(child.status, 0, child.stderr);
  const [topology, burgers] = child.stdout.trim().split("\n").map(JSON.parse);
  assert.equal(topology.ok, true);
  assert.equal(burgers.ok, true);
  assert.deepEqual(topology.receipt.betti, { h0: 1, h1: 0, h2: 0, h3: 0 });
  assert.equal(burgers.receipt.dimension, 3);
  assert.equal(burgers.receipt.volumeConservation.holds, true);
  assert.deepEqual(burgers.receipt.volumeResidues[0].burgers, [0, 0, 0]);
});


test("source-qualified J26 holes are a real original bounded operation with addressed Burgers", () => {
  const target = { removedFaces: ["leftTop", "leftBottom"], retention: "face-support" };
  const receipt = executeOperation("signgraph.j26.puncture", target);
  assert.equal(receipt.kind, "signgraph.j26.puncture-receipt.v1");
  assert.equal(receipt.source, "Obsmetrologia.AperiodicOrder.J26.faceVertices");
  assert.deepEqual(receipt.topology.betti, { h0: 1, h1: 1, h2: 0 });
  assert.equal(receipt.edges.length, 14);
  assert.equal(receipt.faces.length, 6);
  assert.deepEqual(receipt.droppedEdges, []);
  assert.deepEqual(receipt.retainedFaces, [
    "leftSide0", "leftSide1", "rightTop", "rightBottom", "rightSide0", "rightSide1",
  ]);
  assert.equal(operations.j26Puncture.inputSchema.additionalProperties, false);
  assert.deepEqual(operations.j26Puncture.inputSchema.required, ["removedFaces", "retention"]);
  assert.ok(Object.isFrozen(receipt) && Object.isFrozen(receipt.edges));
  const field = receipt.edges.map(edge => {
    const ends = new Set([edge.from, edge.to]);
    const direction = from => edge.from === from ? 1 : -1;
    const perturb = ends.has("q0") && ends.has("a") ? direction("q0")
      : ends.has("q3") && ends.has("b") ? direction("q3") : 0;
    return { edge: edge.id, vector: [0, 0, perturb] };
  });
  // Ordering is supplied by original source edge ID, NOT an invented
  // edge-field index. Reversing input receipt order leaves the math intact.
  const out = executeOperation("signgraph.j26.puncture", {
    ...target, edgeField: field.reverse(),
  });
  assert.deepEqual(out.topology.betti, receipt.topology.betti);
  assert.equal(out.burgers.classification, "global-holonomy");
  assert.equal(out.burgers.localFlat, true);
  assert.equal(out.burgers.exact, false);
  assert.equal(out.burgers.nontrivialGlobalClass, true);
  assert.equal(out.burgers.faceResidues.length, 6);
  assert.ok(out.burgers.faceResidues.every(face => face.flat));

  const allZero = receipt.edges.map(edge => ({ edge: edge.id, vector: [0, 0, 0] }));
  assert.equal(executeOperation("signgraph.j26.puncture", {
    ...target, edgeField: allZero,
  }).burgers.classification, "exact");
});

test("J26 original operation refuses anonymous, incomplete and unauthorized source fields", () => {
  const target = { removedFaces: ["leftTop", "leftSide1"], retention: "face-support" };
  const receipt = executeOperation("signgraph.j26.puncture", target);
  assert.deepEqual(receipt.topology.betti, { h0: 1, h1: 0, h2: 0 });
  assert.equal(receipt.edges.length, 13);
  const zeros = receipt.edges.map(edge => ({ edge: edge.id, vector: [0, 0, 0] }));
  for (const input of [
    { ...target, typo: true },
    { ...target, vertices: [] },
    { ...target, edgeField: zeros.slice(1) },
    { ...target, edgeField: [...zeros.slice(1), zeros[1]] },
    { ...target, edgeField: [{ ...zeros[0], edge: "invented-edge" }, ...zeros.slice(1)] },
    { ...target, edgeField: [{ ...zeros[0], vector: [0.5, 0, 0] }, ...zeros.slice(1)] },
    { removedFaces: ["leftTop"], retention: "inferred" },
    { removedFaces: ["leftTop"], retention: "skeleton", fakeRight: true },
  ]) assert.throws(() => executeOperation("signgraph.j26.puncture", input),
    TypeError);
  assert.throws(() => executeOperation("signgraph.j26.puncture", target,
    { workBudget: { vertices: 7 } }), /finite-complex work budget/);
  assert.throws(() => executeOperation("signgraph.j26.puncture",
    { ...target, edgeField: [...zeros, { edge: "overage", vector: [0, 0, 0] }] }),
    /exactly one identified entry/);
  assert.throws(() => executeOperation("signgraph.j26.puncture",
    { ...target, overflow: "x".repeat(66000) }), /only removedFaces/);
});

test("existing SignGraph holonomy JSONL CLI receives J26 source punctures directly", () => {
  const line = JSON.stringify({
    operation: "signgraph.j26.puncture",
    input: { removedFaces: ["leftTop", "leftSide1"], retention: "face-support" },
  });
  const child = spawnSync(process.execPath, [bin], {
    input: line + "\n", encoding: "utf8", timeout: 10000,
  });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stderr, "");
  const lines = child.stdout.trim().split("\n");
  assert.equal(lines.length, 1);
  const result = JSON.parse(lines[0]);
  assert.equal(result.ok, true);
  assert.equal(result.operation, "signgraph.j26.puncture");
  assert.equal(result.receipt.kind, "signgraph.j26.puncture-receipt.v1");
  assert.deepEqual(result.receipt.topology.betti, { h0: 1, h1: 0, h2: 0 });
  assert.equal(result.receipt.edges.length, 13);
  assert.equal(result.receipt.faces.length, 6);
});
