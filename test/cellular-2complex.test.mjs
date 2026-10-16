import test from "node:test";
import assert from "node:assert/strict";
import { cellular2Complex, cellular3Complex, burgersOfComplex, cohomologyOfEdgeGraph, affineHolonomyOfComplex } from "../src/cohomology.mjs";

const triangle = () => cellular2Complex({
  vertices: ["a", "b", "c"],
  edges: [
    { id: "ab", from: "a", to: "b" },
    { id: "bc", from: "b", to: "c" },
    { id: "ca", from: "c", to: "a" },
  ],
  faces: [{ id: "disc", boundary: ["ab", "bc", "ca"].map(edge => ({ edge, direction: 1 })) }],
});

// One-vertex CW torus: ABA⁻¹B⁻¹ is a closed attaching walk with
// integer incidence 0. Thus every face has zero translational curl,
// although independent noncontractible cycles still exist.
const torus = () => cellular2Complex({
  vertices: ["p"],
  edges: [{ id: "a", from: "p", to: "p" }, { id: "b", from: "p", to: "p" }],
  faces: [{ id: "torus", boundary: [
    { edge: "a", direction: 1 }, { edge: "b", direction: 1 },
    { edge: "a", direction: -1 }, { edge: "b", direction: -1 },
  ] }],
});

// Fixture transcribed from Obsmetrologia/AperiodicOrder/Tiling/J26.lean,
// oriented as received on 2026-10-15. The test is an independent
// Engineering receiving witness; Science owns the canonical cell.
const J26_EDGES = [
  ["q0q1", "q0", "q1"], ["q1q2", "q1", "q2"],
  ["q2q3", "q2", "q3"], ["q3q0", "q3", "q0"],
  ["q1a", "q1", "a"], ["ab", "a", "b"], ["bq2", "b", "q2"],
  ["aq0", "a", "q0"], ["bq3", "b", "q3"],
  ["q2c", "q2", "c"], ["cd", "c", "d"], ["dq3", "d", "q3"],
  ["cq1", "c", "q1"], ["dq0", "d", "q0"],
];
const J26_WALKS = {
  leftTop: ["q0", "q1", "a"],
  leftBottom: ["q3", "b", "q2"],
  leftSide0: ["q1", "q2", "b", "a"],
  leftSide1: ["a", "b", "q3", "q0"],
  rightTop: ["q1", "c", "q2"],
  rightBottom: ["q0", "q3", "d"],
  rightSide0: ["q2", "c", "d", "q3"],
  rightSide1: ["c", "q1", "q0", "d"],
};
const J26_VERTICES = ["q0", "q1", "q2", "q3", "a", "b", "c", "d"];
const J26 = () => {
  const edges = J26_EDGES.map(([id, from, to]) => ({ id, from, to }));
  const faces = Object.entries(J26_WALKS).map(([id, walk]) => ({
    id, boundary: walk.map((from, i) => {
      const to = walk[(i + 1) % walk.length];
      const e = edges.find(e => (e.from === from && e.to === to) ||
        (e.from === to && e.to === from));
      assert.ok(e, `J26 face ${id}: ${from} -> ${to} has a declared edge`);
      return { edge: e.id, direction: e.from === from ? 1 : -1 };
    }),
  }));
  return { vertices: J26_VERTICES, edges, faces };
};

test("filled face changes graph cycle rank: disc H1=0, closed torus H1=2", () => {
  const disc = triangle();
  assert.deepEqual(disc.betti, { h0: 1, h1: 0, h2: 0 });
  assert.equal(disc.graphOnlyH1, 1);
  assert.deepEqual(disc.rank, { zero: 2, one: 1 });
  assert.equal(disc.totalFaceBoundaryCloses, false);
  const t = torus();
  assert.deepEqual(t.betti, { h0: 1, h1: 2, h2: 1 });
  assert.deepEqual(t.rank, { zero: 0, one: 0 });
  assert.equal(t.graphOnlyH1, 2);
  assert.equal(t.totalFaceBoundaryCloses, true);
});

test("J26 is a sphere-like full cellular complex, not seven unfilled defects", () => {
  const j = J26(), complex = cellular2Complex(j);
  assert.equal(cohomologyOfEdgeGraph(j.vertices, j.edges.map(e => [e.from, e.to])).firstCohomology.rank, 7);
  assert.deepEqual(complex.rank, { zero: 7, one: 7 });
  assert.deepEqual(complex.betti, { h0: 1, h1: 0, h2: 1 });
  assert.equal(complex.graphOnlyH1, 7);
  assert.ok(complex.totalFaceBoundaryCloses);
  assert.deepEqual(complex.totalFaceBoundary, new Array(14).fill(0));
  for (const row of complex.coboundary.one)
    for (let v = 0; v < j.vertices.length; v++)
      assert.equal(row.reduce((n, c, e) => n + c * complex.coboundary.zero[e][v], 0), 0);
});

test("Burgers face closure distinguishes a local dislocation from an exact potential", () => {
  const disc = triangle();
  const local = burgersOfComplex(disc, [[2, 0], [0, 0], [0, 0]]);
  assert.equal(local.classification, "local-defect");
  assert.deepEqual(local.faceResidues[0].burgers, [2, 0]);
  assert.equal(local.localFlat, false);
  assert.equal(local.exact, false);

  const exact = burgersOfComplex(disc, [[2, 1], [-4, 3], [2, -4]]);
  assert.equal(exact.classification, "exact");
  assert.ok(exact.localFlat && exact.exact);
  assert.deepEqual(exact.faceResidues[0].burgers, [0, 0]);
});

test("a noncontractible Burgers class need not contain any local face defect", () => {
  const t = torus();
  const observed = burgersOfComplex(t, [[2, 0], [0, -3]]);
  assert.equal(observed.classification, "global-holonomy");
  assert.ok(observed.localFlat);
  assert.equal(observed.exact, false);
  assert.equal(observed.nontrivialGlobalClass, true);
  assert.deepEqual(observed.faceResidues[0].burgers, [0, 0]);
  assert.equal(observed.cycleResidues.length, 2);
});

test("J26 Bianchi-type charge conservation holds for every received edge labeling", () => {
  const j = J26(), complex = cellular2Complex(j);
  for (let seed = 0; seed < 23; seed++) {
    const edgeValues = j.edges.map((_, i) => [
      (i * 17 + seed * 13) % 11 - 5,
      (i * 19 + seed * 7) % 17 - 8,
    ]);
    const out = burgersOfComplex(complex, edgeValues);
    assert.ok(out.conservation.applicable && out.conservation.holds);
    assert.deepEqual(out.totalFaceBurgers, [0, 0]);
  }
  const displaced = burgersOfComplex(complex, j.edges.map((_, i) => i === 0 ? [1, 0] : [0, 0]));
  assert.equal(displaced.classification, "local-defect");
  const nonzero = displaced.faceResidues.filter(face => !face.flat);
  assert.deepEqual(nonzero.map(face => face.burgers), [[1, 0], [-1, 0]]);
  // A compatible edge cochain is a global gradient because b1(J26)=0.
  const P = Object.fromEntries(j.vertices.map((v, i) => [v, [i * 3 - 9, i * i]]));
  const exactEdges = j.edges.map(e => P[e.to].map((v, i) => v - P[e.from][i]));
  const exact = burgersOfComplex(complex, exactEdges);
  assert.equal(exact.classification, "exact");
  assert.ok(exact.faceResidues.every(face => face.flat));
});

test("orientation and gauge transformations preserve exact homology and physical classification", () => {
  const original = J26(), c = cellular2Complex(original);
  const values = original.edges.map((_, i) => [i % 5 - 2, (i * 5) % 7 - 3]);
  const initial = burgersOfComplex(c, values);
  const backwards = {
    ...original,
    edges: original.edges.map((e, i) => i === 2 ? { ...e, from: e.to, to: e.from } : e),
    faces: original.faces.map(f => ({ ...f, boundary: f.boundary.map(step =>
      step.edge === original.edges[2].id ? { ...step, direction: -step.direction } : step) })),
  };
  const reversed = burgersOfComplex(cellular2Complex(backwards),
    values.map((v, i) => i === 2 ? v.map(x => -x) : v));
  assert.deepEqual(cellular2Complex(backwards).betti, c.betti);
  assert.deepEqual(reversed.faceResidues.map(f => f.burgers), initial.faceResidues.map(f => f.burgers));
  assert.equal(reversed.classification, initial.classification);
  const phi = Object.fromEntries(original.vertices.map((id, i) => [id, [i + 2, 3 * i]]));
  const gauged = values.map((v, i) => [
    v[0] + phi[original.edges[i].to][0] - phi[original.edges[i].from][0],
    v[1] + phi[original.edges[i].to][1] - phi[original.edges[i].from][1],
  ]);
  const changed = burgersOfComplex(c, gauged);
  assert.equal(changed.classification, initial.classification);
  assert.deepEqual(changed.faceResidues.map(f => f.burgers), initial.faceResidues.map(f => f.burgers));
});

test("invalid face attaching maps and inexact displacement input refuse rather than invent topology", () => {
  const input = { vertices: ["a", "b", "c"],
    edges: [{ id: "ab", from: "a", to: "b" }, { id: "bc", from: "b", to: "c" }],
    faces: [{ id: "f", boundary: [{ edge: "ab", direction: 1 }, { edge: "bc", direction: 1 }] }],
  };
  assert.throws(() => cellular2Complex(input), /not closed/);
  assert.throws(() => cellular2Complex({ ...input,
    faces: [{ id: "f", boundary: [{ edge: "bc", direction: 1 }, { edge: "ab", direction: 1 }] }] }), /disconnected/);
  assert.throws(() => cellular2Complex({ ...input,
    faces: [{ id: "f", boundary: [{ edge: "missing", direction: 1 }] }] }), /known edge/);
  assert.throws(() => cellular2Complex({ ...input,
    edges: [input.edges[0], input.edges[0]] }), /duplicate edge/);
  assert.throws(() => cellular2Complex({ ...input, vertices: ["a", "a"] }), /duplicate vertex/);
  const c = triangle();
  assert.throws(() => burgersOfComplex(c, [[0, 0]]), /one vector/);
  assert.throws(() => burgersOfComplex(c, [[.5, 0], [0, 0], [0, 0]]), /safe-integer/);
  assert.throws(() => burgersOfComplex(c, [[NaN, 0], [0, 0], [0, 0]]), /safe-integer/);
  assert.throws(() => burgersOfComplex(c, [[Number.MAX_SAFE_INTEGER, 0], [1, 0], [0, 0]]),
    /safe integer range/);
});

/** The authoritative Science J26 carries one interior volume, not only
 * the oriented exterior. The surface is S²-like; the filled 3-chain
 * has the rational cellular homology of a ball.
 */
const J26_VOLUME = () => {
  const surface = J26();
  return { ...surface, volumes: [{
    id: "j26-interior",
    boundary: surface.faces.map(face => ({ face: face.id, direction: 1 })),
  }] };
};

test("J26: exterior H2=Q becomes H2=0 when its real volume is received", () => {
  const full = J26_VOLUME(), shell = cellular2Complex(full),
    solid = cellular3Complex(full);
  assert.deepEqual(shell.betti, { h0: 1, h1: 0, h2: 1 });
  assert.deepEqual(solid.surfaceBetti, shell.betti);
  assert.deepEqual(solid.rank, { zero: 7, one: 7, two: 1 });
  assert.deepEqual(solid.betti, { h0: 1, h1: 0, h2: 0, h3: 0 });
  assert.equal(solid.volumes.length, 1);
  assert.equal(solid.coboundary.two[0].length, 8);
  assert.deepEqual(solid.coboundary.two[0], new Array(8).fill(1));
  for (let e = 0; e < full.edges.length; e++)
    assert.equal(solid.coboundary.two[0].reduce((total, coefficient, f) =>
      total + coefficient * solid.coboundary.one[f][e], 0), 0);

  const doubled = cellular3Complex({
    ...full, volumes: [
      full.volumes[0],
      { id: "opposite-j26-interior", boundary: full.faces.map(face => ({
        face: face.id, direction: -1,
      })) },
    ],
  });
  assert.deepEqual(doubled.betti, { h0: 1, h1: 0, h2: 0, h3: 1 },
    "oppositely oriented three-cells create a nontrivial top three-cycle");
  assert.deepEqual(doubled.rank, { zero: 7, one: 7, two: 1 });
});

test("three-dimensional J26 Burgers cochains obey discrete volume Stokes with live face defects", () => {
  const full = J26_VOLUME(), solid = cellular3Complex(full);
  for (let seed = 0; seed < 31; seed++) {
    const b = full.edges.map((_, i) => [
      (i * 11 + seed * 13) % 19 - 9,
      (i * 17 + seed * 7) % 23 - 11,
      (i * 19 + seed * 3) % 29 - 14,
    ]);
    const r = burgersOfComplex(solid, b);
    assert.equal(r.dimension, 3);
    assert.equal(r.volumeResidues.length, 1);
    assert.deepEqual(r.volumeResidues[0].burgers, [0, 0, 0]);
    assert.equal(r.volumeConservation.applicable, true);
    assert.equal(r.volumeConservation.holds, true);
  }
  const oneDisplaced = burgersOfComplex(solid,
    full.edges.map((_, i) => i === 0 ? [1, -3, 5] : [0, 0, 0]));
  assert.equal(oneDisplaced.classification, "local-defect");
  assert.deepEqual(oneDisplaced.faceResidues.filter(f => !f.flat).map(f => f.burgers),
    [[1, -3, 5], [-1, 3, -5]]);
  assert.deepEqual(oneDisplaced.volumeResidues[0].burgers, [0, 0, 0]);
  // Zero volume charge is NOT identical with zero face charge.
  assert.ok(oneDisplaced.faceResidues.some(f => !f.flat));

  const potential = Object.fromEntries(full.vertices.map((name, i) =>
    [name, [i * 2, i * i - 4, 3 - i * 7]]));
  const exact = burgersOfComplex(solid, full.edges.map(edge =>
    potential[edge.to].map((value, j) => value - potential[edge.from][j])));
  assert.equal(exact.classification, "exact");
  assert.ok(exact.faceResidues.every(f => f.flat));
  assert.deepEqual(exact.volumeResidues[0].burgers, [0, 0, 0]);
  assert.equal(exact.potential.length, 8);
});

test("reversing a J26 face and its volume incidence preserves solid homology and charge conservation", () => {
  const full = J26_VOLUME(), original = cellular3Complex(full);
  const flip = full.faces[2].id;
  const reversed = {
    ...full,
    faces: full.faces.map(face => face.id === flip ? {
      ...face, boundary: face.boundary.map(step => ({ ...step, direction: -step.direction })).reverse(),
    } : face),
    volumes: full.volumes.map(volume => ({
      ...volume, boundary: volume.boundary.map(step => step.face === flip ?
        { ...step, direction: -step.direction } : step),
    })),
  };
  // Reverse walk ordering as well as the edge directions, preserving
  // cyclic composability. This is a genuine change of chain basis.
  const rotated = cellular3Complex(reversed);
  assert.deepEqual(rotated.betti, original.betti);
  assert.deepEqual(rotated.rank, original.rank);
  const readings = full.edges.map((_, i) => [i - 7, 2 * i, 12 - 3 * i]);
  assert.deepEqual(burgersOfComplex(rotated, readings).volumeResidues,
    burgersOfComplex(original, readings).volumeResidues);
});

test("a volume must carry an admitted closed oriented face shell, not arbitrary 3D labels", () => {
  const full = J26_VOLUME();
  const bad = volume => cellular3Complex({ ...full, volumes: [volume] });
  assert.throws(() => bad({ id: "incomplete", boundary: full.volumes[0].boundary.slice(1) }),
    /not a closed oriented 2-chain/);
  assert.throws(() => bad({ id: "wrong-sign", boundary: full.volumes[0].boundary.map((step, i) =>
    i === 0 ? { ...step, direction: -1 } : step) }), /not a closed oriented 2-chain/);
  assert.throws(() => bad({ id: "absent", boundary: [{ face: "absent", direction: 1 }] }),
    /known face/);
  assert.throws(() => bad({ id: "zero", boundary: [] }), /nonempty oriented face boundary/);
  assert.throws(() => cellular3Complex({ ...full, volumes: [
    full.volumes[0], full.volumes[0],
  ] }), /duplicate volume/);
  assert.throws(() => cellular3Complex({ ...full, volumes: null }), /volumes must be an array/);
  const empty = cellular3Complex({ ...full, volumes: [] });
  assert.deepEqual(empty.betti, { h0: 1, h1: 0, h2: 1, h3: 0 },
    "without a 3-cell the exterior class is not silently killed");
  assert.throws(() => burgersOfComplex(cellular3Complex(full),
    full.edges.map(() => [1, 2, 3, 4])), /two or three coordinates/);
  assert.throws(() => burgersOfComplex(cellular3Complex(full),
    full.edges.map((_, i) => i === 0 ? [1, 2, 3] : [0, 0])), /same dimension/);
});

test("a filled J26 volume retains exact sixfold affine flatness without calling it 3D rotation", () => {
  const full = J26_VOLUME(), c = cellular3Complex(full);
  const none = affineHolonomyOfComplex(c,
    full.edges.map(() => ({ rotation: 0, translation: [0, 0] })));
  assert.equal(none.classification, "affine-flat");
  assert.ok(none.localFlat && none.exact);
  assert.ok(none.faceHolonomies.every(f => f.flat));
});
