import test from "node:test";
import assert from "node:assert/strict";
import {
  sixfoldMotion, sixfoldIdentity, sixfoldCompose, sixfoldInverse,
  sixfoldStep, sixfoldDevelop,
} from "../src/paths.mjs";
import { cellular2Complex, burgersOfComplex, affineHolonomyOfComplex } from "../src/cohomology.mjs";

const id = () => sixfoldIdentity();
const loop = sep => [
  ...Array(5).fill(1), ...Array(sep).fill(0),
  ...Array(7).fill(1), 3, ...Array(sep).fill(0), 3,
];
const asArray = h => [h.rotation, ...h.translation];

test("Eisenstein sixfold frame really has order six, with noncommuting affine transports", () => {
  for (const h of [
    id(), sixfoldMotion(1, [2, 3]), sixfoldMotion(-2, [5, -4]),
    sixfoldMotion(8, [0, -7]), sixfoldMotion(5, [10, 2]),
  ]) {
    assert.deepEqual(sixfoldCompose(h, sixfoldInverse(h)), id());
    assert.deepEqual(sixfoldCompose(sixfoldInverse(h), h), id());
  }
  assert.deepEqual(sixfoldCompose(sixfoldStep(1), sixfoldStep(1)).rotation, 2);
  const rotation = sixfoldMotion(1, [0, 0]);
  const translation = sixfoldMotion(0, [1, 0]);
  assert.notDeepEqual(sixfoldCompose(rotation, translation),
    sixfoldCompose(translation, rotation), "R acts nontrivially on translation");
  for (const a of [id(), sixfoldMotion(1, [2, -3]), sixfoldMotion(5, [-1, 2])])
    for (const b of [id(), sixfoldMotion(2, [-4, 1]), sixfoldMotion(4, [0, 2])])
      for (const c of [id(), sixfoldMotion(3, [1, 3])])
        assert.deepEqual(sixfoldCompose(sixfoldCompose(a, b), c),
          sixfoldCompose(a, sixfoldCompose(b, c)), "affine product is associative");
});

test("the real Obsmetrologia 5–7 dipole gives Burgers (0,-sep), not rotation charge", () => {
  assert.deepEqual(asArray(sixfoldDevelop(Array(6).fill(1))), [0, 0, 0]);
  assert.deepEqual(asArray(sixfoldDevelop(Array(5).fill(1))), [5, -1, 0]);
  assert.deepEqual(asArray(sixfoldDevelop([...Array(5).fill(1), ...Array(7).fill(1)])), [0, 0, 0]);
  for (const sep of [0, 1, 2, 3, 7, 20]) {
    const result = sixfoldDevelop(loop(sep));
    assert.deepEqual(asArray(result), [0, 0, sep === 0 ? 0 : -sep], `dipole at separation ${sep}`);
    assert.equal(result.rotation, 0, "frame neutral despite nonzero Burgers charge");
  }
  const five = sixfoldDevelop(Array(5).fill(1));
  assert.equal(five.rotation, 5, "the five-site carries a persistent rotational charge");
  assert.throws(() => sixfoldStep(-1), /nonnegative/);
  assert.throws(() => sixfoldMotion(0, [1.5, 0]), /exact lattice/);
  assert.throws(() => sixfoldMotion(NaN, [0, 0]), /integer turn/);
});

const torus = () => cellular2Complex({
  vertices: ["x"],
  edges: [{ id: "a", from: "x", to: "x" }, { id: "b", from: "x", to: "x" }],
  faces: [{ id: "fundamental", boundary: [
    { edge: "a", direction: 1 }, { edge: "b", direction: 1 },
    { edge: "a", direction: -1 }, { edge: "b", direction: -1 },
  ] }],
});

test("an affine commutator detects rotationally induced face holonomy missed by vector addition", () => {
  const c = torus();
  // Abelian translation sees A+B-A-B=0; affine action rotates B.
  const trans = burgersOfComplex(c, [[0, 0], [1, 0]]);
  assert.ok(trans.faceResidues.every(x => x.flat));
  const aff = affineHolonomyOfComplex(c, [
    sixfoldMotion(1, [0, 0]), sixfoldMotion(0, [1, 0]),
  ]);
  assert.equal(aff.classification, "local-affine-defect");
  assert.equal(aff.faceHolonomies[0].holonomy.rotation, 0);
  assert.notDeepEqual(aff.faceHolonomies[0].holonomy.translation, [0, 0]);
});

test("pure translation on the torus has local-flat but globally nontrivial Burgers holonomy", () => {
  const c = torus(), result = affineHolonomyOfComplex(c, [
    sixfoldMotion(0, [2, 0]), sixfoldMotion(0, [0, -3]),
  ]);
  assert.equal(result.classification, "global-affine-holonomy");
  assert.ok(result.localFlat && !result.exact && result.nontrivialGlobalMonodromy);
  assert.deepEqual(result.faceHolonomies[0].holonomy, id());
  assert.equal(result.cycleHolonomies.length, 2);
});

test("flat nonabelian transport is a vertex-frame gauge, not just equal numbers", () => {
  const c = cellular2Complex({
    vertices: ["a", "b", "c"],
    edges: [
      { id: "ab", from: "a", to: "b" },
      { id: "bc", from: "b", to: "c" },
      { id: "ca", from: "c", to: "a" },
    ],
    faces: [{ id: "disc", boundary: ["ab","bc","ca"].map(edge => ({ edge, direction: 1 })) }],
  });
  const frames = [
    sixfoldMotion(1, [2, -1]), sixfoldMotion(3, [-1, 4]),
    sixfoldMotion(2, [7, 3]),
  ];
  const moves = c.edges.map(e =>
    sixfoldCompose(sixfoldInverse(frames[e.fromIndex]), frames[e.toIndex]));
  const result = affineHolonomyOfComplex(c, moves);
  assert.equal(result.classification, "affine-flat");
  assert.equal(result.faceHolonomies[0].flat, true);
  assert.equal(result.cycleHolonomies.length, 0);

  // Passive vertex gauge changes closed-loop transport by conjugation
  // at its basepoint; triviality is invariant, not literal coordinates.
  const defectMoves = moves.map((m, i) => i === 0 ? sixfoldCompose(sixfoldMotion(1, [1, 0]), m) : m);
  const first = affineHolonomyOfComplex(c, defectMoves);
  const transformed = c.edges.map((e, i) => sixfoldCompose(
    sixfoldCompose(sixfoldInverse(frames[e.fromIndex]), defectMoves[i]),
    frames[e.toIndex]));
  const second = affineHolonomyOfComplex(c, transformed);
  assert.equal(first.localFlat, false);
  assert.equal(second.localFlat, false);
  assert.notDeepEqual(first.faceHolonomies[0].holonomy, id());
  assert.notDeepEqual(second.faceHolonomies[0].holonomy, id());
  assert.throws(() => affineHolonomyOfComplex(c, [sixfoldIdentity()]), /one motion per edge/);
});

test("nonabelian face holonomy is covariant under cyclic basepoint and vertex-frame gauge", () => {
  const base = {
    vertices: ["a", "b", "c"],
    edges: [
      { id: "ab", from: "a", to: "b" },
      { id: "bc", from: "b", to: "c" },
      { id: "ca", from: "c", to: "a" },
    ],
    faces: [{ id: "f", boundary: [
      { edge: "ab", direction: 1 }, { edge: "bc", direction: 1 },
      { edge: "ca", direction: 1 },
    ] }],
  };
  const moves = [
    sixfoldMotion(1, [2, 0]), sixfoldMotion(0, [1, -3]),
    sixfoldMotion(3, [0, 2]),
  ];
  const original = affineHolonomyOfComplex(cellular2Complex(base), moves).faceHolonomies[0].holonomy;

  const rotatedFace = cellular2Complex({ ...base, faces: [{
    id: "f", boundary: [...base.faces[0].boundary.slice(1), base.faces[0].boundary[0]],
  }] });
  const rotated = affineHolonomyOfComplex(rotatedFace, moves).faceHolonomies[0].holonomy;
  const expectedRotation = sixfoldCompose(
    sixfoldCompose(sixfoldInverse(moves[0]), original), moves[0]);
  assert.deepEqual(rotated, expectedRotation, "moving the loop basepoint conjugates its affine residue");

  const gauges = [sixfoldMotion(2, [3, 1]), sixfoldMotion(5, [-2, 4]), sixfoldMotion(1, [0, -1])];
  const other = base.edges.map((e, i) => sixfoldCompose(
    sixfoldCompose(sixfoldInverse(gauges[base.vertices.indexOf(e.from)]), moves[i]),
    gauges[base.vertices.indexOf(e.to)]));
  const gauged = affineHolonomyOfComplex(cellular2Complex(base), other).faceHolonomies[0].holonomy;
  const expectedGauge = sixfoldCompose(
    sixfoldCompose(sixfoldInverse(gauges[0]), original), gauges[0]);
  assert.deepEqual(gauged, expectedGauge, "vertex-frame changes conjugate the local charge");

  const reversed = { ...base,
    edges: base.edges.map(e => e.id === "bc" ? { ...e, from: e.to, to: e.from } : e),
    faces: base.faces.map(f => ({ ...f, boundary: f.boundary.map(st =>
      st.edge === "bc" ? { ...st, direction: -st.direction } : st) })) };
  const reversedMoves = moves.map((g,i) => i===1 ? sixfoldInverse(g) : g);
  const checked = affineHolonomyOfComplex(cellular2Complex(reversed), reversedMoves).faceHolonomies[0].holonomy;
  assert.deepEqual(checked, original, "reversing an edge and its transport preserves loop holonomy");
});
