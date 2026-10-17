import test from "node:test";
import assert from "node:assert/strict";
import { cell } from "@red-cup-engineering/signcell/cell";
import { cohomologyReceiptOfCells } from "../src/cohomology.mjs";
import {
  apply, applyLaplacian, cellularSheaf, cellularSheafCohomology, coboundary, cochain, constantSheaf,
  compareFixedCountRigidity, planConnectedBarExchanges, diffuse, harmonicProjection, hodgeCheck, rigidityReceipt, rigiditySheaf, sheafLaplacian,
  weightedSheafDirichlet, weightedSheafLaplacian,
} from "../src/cellular-sheaf.mjs";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);



test("cochain: finite numeric vertex readings admit idempotent repetition, not false gluing", () => {
  const s = cellularSheaf({ vertices: [{ id: "a", dim: 2 }, { id: "b", dim: 1 }], edges: [] });
  assert.deepEqual(cochain(s, [{ vertex: "a", value: [1, 2] }, { vertex: "b", value: 3 }]), [1, 2, 3]);
  assert.deepEqual(cochain(s, [{ vertex: "a", value: [1, 2] }, { vertex: "a", value: [1, 2] }]), [1, 2, 0]);
  assert.throws(
    () => cochain(s, [{ vertex: "a", value: [1, 2] }, { vertex: "a", value: [1, 3] }]),
    /conflicting duplicate vertex readings/,
  );
  for (const invalid of [[1, Infinity], [NaN, 0], ["1", 2], [undefined, 1]]) {
    assert.throws(() => cochain(s, [{ vertex: "a", value: invalid }]), /finite numbers/);
  }
  assert.throws(() => cochain(s, [{ vertex: "b", value: -Infinity }]), /finite numbers/);
  assert.throws(() => cochain(s, [{ vertex: "missing", value: 1 }]), /unknown vertex/);
});

test("cellularSheaf: validates shapes, ids and endpoints", () => {
  const v = [{ id: "a", dim: 2 }, { id: "b", dim: 1 }];
  const ok = { id: "e", from: "a", to: "b", dim: 1, restrict: { from: [[1, 0]], to: [[1]] } };
  assert.equal(cellularSheaf({ vertices: v, edges: [ok] }).c0, 3);
  assert.throws(() => cellularSheaf({ vertices: v, edges: [{ ...ok, restrict: { from: [[1]], to: [[1]] } }] }), RangeError);
  assert.throws(() => cellularSheaf({ vertices: [...v, { id: "a", dim: 1 }], edges: [] }), RangeError);
  assert.throws(() => cellularSheaf({ vertices: v, edges: [{ ...ok, to: "z" }] }), RangeError);
  assert.ok(Object.isFrozen(cellularSheaf({ vertices: v, edges: [ok] })));
});

test("coboundary and Laplacian: (δx)_e = F_to x_to − F_from x_from, L = δᵀδ", () => {
  const s = constantSheaf(["a", "b", "c"], [["a", "b"], ["b", "c"]]);
  assert.deepEqual(apply(coboundary(s), [1, 3, 6]), [2, 3]);
  assert.deepEqual(applyLaplacian(s, [1, 3, 6]), [-2, -1, 3]);
  assert.deepEqual(applyLaplacian(s, [5, 5, 5]), [0, 0, 0]);
  const L = sheafLaplacian(s);
  assert.deepEqual(L.entries.map((row) => row.map(([, v]) => v)), [[1, -1], [-1, 2, -1], [-1, 1]]);
});

test("exact cohomology: agrees with cohomologyOfCells on the integer incidence", () => {
  const graphs = [
    { nodes: ["a", "b", "c"], edges: [["a", "b"], ["b", "c"], ["c", "a"]] },
    { nodes: ["a", "b", "c", "d", "e"], edges: [["a", "b"], ["b", "c"], ["d", "e"]] },
    { nodes: ["a", "b", "c", "d"], edges: [["a", "b"], ["a", "b"], ["b", "c"], ["c", "a"], ["c", "c"]] },
  ];
  for (const { nodes, edges } of graphs) {
    const reference = cohomologyReceiptOfCells(edges.map(([s, o]) => cell(s, "edge", o)), nodes);
    const r = cellularSheafCohomology(constantSheaf(nodes, edges));
    assert.equal(r.h0, reference.h0);
    assert.equal(r.h1, reference.h1);
    assert.equal(r.vanishing.kind, reference.vanishing.kind);
  }
});

test("exact cohomology: rational restrictions and a twisted cycle", () => {
  const vs = ["a", "b", "c"].map((id) => ({ id, dim: 1 }));
  const edge = (id, from, to, f, t) => ({ id, from, to, dim: 1, restrict: { from: [[f]], to: [[t]] } });
  const twisted = cellularSheaf({ vertices: vs, edges: [edge(1, "a", "b", 1, 1), edge(2, "b", "c", 1, 1), edge(3, "c", "a", "1/2", 1)] });
  const r = cellularSheafCohomology(twisted);
  assert.equal(r.h0, 0); assert.equal(r.h1, 0);
  const flat = cellularSheaf({ vertices: vs, edges: [edge(1, "a", "b", "1/3", "1/3"), edge(2, "b", "c", 1, 1)] });
  assert.equal(cellularSheafCohomology(flat).h0, 1);
  const inexact = cellularSheaf({ vertices: vs, edges: [edge(1, "a", "b", 0.5, 1)] });
  assert.throws(() => cellularSheafCohomology(inexact), RangeError);
});

test("diffusion: converges to the harmonic section (component means) and lies in ker L", () => {
  const s = constantSheaf(["a", "b", "c", "d", "e"], [["a", "b"], ["b", "c"], ["d", "e"]]);
  const r = harmonicProjection(s, [1, 2, 6, 10, 20], { tolerance: 1e-12 });
  assert.ok(r.converged);
  [3, 3, 3, 15, 15].forEach((m, i) => near(r.section[i], m, 1e-9));
  near(r.residual, 0, 1e-9);
  assert.ok(r.firings.length > 0);
  const again = harmonicProjection(s, [1, 2, 6, 10, 20], { tolerance: 1e-12 });
  assert.deepEqual(again.section, r.section);
  assert.deepEqual(again.firings, r.firings);
});

test("Hodge degree 0: H¹ = 0 sheaf, diffusion limit is a global section in ker L", () => {
  const tree = constantSheaf(["a", "b", "c"], [["a", "b"], ["b", "c"]]);
  const h = hodgeCheck(tree, [4, -1, 9]);
  assert.equal(h.h1, 0);
  assert.ok(h.harmonic);
  near(h.sectionResidual, 0, 1e-9);
  near(h.laplacianResidual, 0, 1e-9);
  // a vector-valued sheaf with non-trivial restrictions: limit lies in ker δ
  const rot = cellularSheaf({
    vertices: [{ id: "a", dim: 2 }, { id: "b", dim: 2 }],
    edges: [{ id: "e", from: "a", to: "b", dim: 2, restrict: { from: [[0, -1], [1, 0]], to: [[1, 0], [0, 1]] } }],
  });
  const hr = hodgeCheck(rot, [1, 2, 3, 4]);
  assert.ok(hr.harmonic);
  near(hr.section[2], -hr.section[1], 1e-8); // x_b = R x_a = (-a1, a0)
  near(hr.section[3], hr.section[0], 1e-8);
});

test("diffuse: pinned testimony is order-independent, identical repetition is idempotent, and incompatibility remains visible", () => {
  const s = constantSheaf(["a", "b"], [["a", "b"]]);
  const boundary = [{ vertex: "a", value: 0 }, { vertex: "b", value: 10 }];
  const conflict = diffuse(s, [3, 7], { fixed: boundary });
  assert.equal(conflict.converged, true, "all pinned coordinates are stationary");
  assert.equal(conflict.compatible, false, "stationary incompatible pins are not a global section");
  near(conflict.residual, 10);
  assert.deepEqual(diffuse(s, [3, 7], { fixed: [...boundary].reverse() }).section, conflict.section);
  const repeated = diffuse(s, [3, 7], { fixed: [{ vertex: "a", value: 0 }, { vertex: "a", value: 0 }] });
  assert.deepEqual(repeated.section, diffuse(s, [3, 7], { fixed: [{ vertex: "a", value: 0 }] }).section);
  for (const fixed of [
    [{ vertex: "a", value: 0 }, { vertex: "a", value: 1 }],
    [{ vertex: "a", value: 1 }, { vertex: "a", value: 0 }],
  ]) assert.throws(() => diffuse(s, [3, 7], { fixed }), /conflicting duplicate pinned/);
  assert.throws(() => diffuse(s, [3, 7], { fixed: [{ vertex: "a", value: Infinity }] }), /pinned stalk values/);
});

test("diffuse: rejects unstable steps and non-finite inputs instead of certifying numeric settlement", () => {
  const s = constantSheaf(["a", "b"], [["a", "b"]]);
  const ordinary = diffuse(s, [0, 10]);
  assert.equal(ordinary.converged, true);
  assert.equal(ordinary.compatible, true);
  near(ordinary.section[0], 5); near(ordinary.section[1], 5);
  for (const step of [-1, 0, 1, 10, NaN, Infinity]) {
    assert.throws(() => diffuse(s, [0, 10], { step }), /Gershgorin bound/);
  }
  assert.ok(diffuse(s, [0, 10], { step: 0.8 }).converged);
  for (const value of [NaN, Infinity, "0"]) {
    assert.throws(() => diffuse(s, [value, 10]), /initial stalk values/);
  }
  assert.throws(() => diffuse(s, [0, 10], { tolerance: -1 }), /tolerance/);
  assert.throws(() => diffuse(s, [0, 10], { maxSteps: -1 }), /maxSteps/);
  assert.throws(() => diffuse(s, [0, 10], { maxSteps: 1.5 }), /maxSteps/);
  assert.throws(() => diffuse(s, [1e308, -1e308]), /non-finite numeric/);
});

test("diffusion with pinned vertices: boundary conditions are admitted evidence", () => {
  const s = constantSheaf(["a", "b", "c"], [["a", "b"], ["b", "c"]]);
  const r = diffuse(s, cochain(s, []), { fixed: [{ vertex: "a", value: 0 }, { vertex: "c", value: 10 }], tolerance: 1e-12 });
  assert.ok(r.converged);
  near(r.section[0], 0); near(r.section[1], 5); near(r.section[2], 10);
  const conflict = diffuse(s, [0, 0, 0], { fixed: [{ vertex: "a", value: 0 }, { vertex: "b", value: 1 }], maxSteps: 10 });
  assert.ok(conflict.residual > 0);
});

test("rigidity: triangle rigid, open square flexes, braced square has a self-stress, tetrahedron rigid", () => {
  const tri = rigidityReceipt([[0, 0], [4, 0], [1, 3]], [[0, 1], [1, 2], [0, 2]], 2);
  assert.equal(tri.cohomology.h0, 3); assert.equal(tri.cohomology.h1, 0); assert.ok(tri.infinitesimallyRigid);
  const square = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const ring = [[0, 1], [1, 2], [2, 3], [3, 0]];
  const open = rigidityReceipt(square, ring, 2);
  assert.equal(open.cohomology.h0, 4); assert.equal(open.mechanisms, 1); assert.ok(!open.infinitesimallyRigid);
  const braced = rigidityReceipt(square, [...ring, [0, 2], [1, 3]], 2);
  assert.equal(braced.cohomology.h0, 3); assert.equal(braced.cohomology.h1, 1); assert.ok(braced.infinitesimallyRigid);
  const tet = rigidityReceipt([[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]], [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]], 3);
  assert.equal(tet.cohomology.h0, 6); assert.equal(tet.cohomology.h1, 0); assert.ok(tet.infinitesimallyRigid);
  // rational coordinates stay exact
  const rat = rigidityReceipt([["0", "0"], ["1/2", "0"], ["1/3", "2/5"]], [[0, 1], [1, 2], [0, 2]], 2);
  assert.ok(rat.infinitesimallyRigid);
  // Maxwell: m = dN − C − E + stresses
  assert.equal(braced.mechanisms - braced.selfStresses, 2 * 4 - 3 - 6);
  assert.equal(open.mechanisms - open.selfStresses, 2 * 4 - 3 - 4);
});

test("fixed-count embedded exchange can change rigidity without changing the Euler index", () => {
  // Lenticule's five-joint exact counterexample: these snapshots both have
  // 7 undirected bars and 5 joints, but distinct rigidity-matrix ranks.
  const points = [[0, 0], [2, 0], [0, 3], [3, 4], [5, 2]];
  const rigid = { points, bars: [[0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [1, 4], [2, 4]] };
  const flexible = { points, bars: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3], [3, 4]] };
  const change = compareFixedCountRigidity({ before: rigid, after: flexible, dimension: 2 });
  assert.equal(change.vertices, 5);
  assert.equal(change.bars, 7);
  assert.equal(change.eulerIndex, -2);
  assert.equal(change.meanCoordination, 14 / 5);
  assert.equal(change.before.cohomology.rank, 7);
  assert.equal(change.after.cohomology.rank, 6);
  assert.equal(change.before.mechanisms, 0);
  assert.equal(change.after.mechanisms, 1);
  assert.equal(change.before.selfStresses, 0);
  assert.equal(change.after.selfStresses, 1);
  assert.equal(change.rankDelta, -1);
  assert.equal(change.mechanismsDelta, 1);
  assert.equal(change.rigidityChanged, true);
  assert.equal(change.before.infinitesimallyRigid, true);
  assert.equal(change.after.infinitesimallyRigid, false);
  assert.ok(Object.isFrozen(change));

  const same = compareFixedCountRigidity({ before: rigid, after: rigid, dimension: 2 });
  assert.equal(same.rankDelta, 0);
  assert.equal(same.mechanismsDelta, 0);
  assert.equal(same.rigidityChanged, false);

  const reverse = compareFixedCountRigidity({ before: flexible, after: rigid, dimension: 2 });
  assert.equal(reverse.rankDelta, 1);
  assert.equal(reverse.mechanismsDelta, -1);
  assert.equal(reverse.rigidityChanged, true);

  assert.throws(() => compareFixedCountRigidity({ before: rigid,
    after: { ...flexible, bars: flexible.bars.slice(1) }, dimension: 2 }), /conserved vertex and bar counts/);
  assert.throws(() => compareFixedCountRigidity({ before: rigid,
    after: { ...flexible, points: flexible.points.slice(1) }, dimension: 2 }), /invalid bar endpoints|conserved vertex and bar counts/);
  assert.throws(() => compareFixedCountRigidity({ before: rigid,
    after: { ...flexible, bars: [[0, 1], [1, 0]] }, dimension: 2 }), /duplicate undirected bar/);
  assert.throws(() => compareFixedCountRigidity({ before: rigid,
    after: { ...flexible, bars: [[0, 5], ...flexible.bars.slice(1)] }, dimension: 2 }), /invalid bar endpoints/);
  assert.throws(() => compareFixedCountRigidity({ before: rigid, after: flexible, dimension: 4 }),
    /dimension 2 or 3/);
});

test("rigidity numerics: normalized (unit direction) sheaf diffuses to a rigid motion", () => {
  const s = rigiditySheaf([[0, 0], [1, 0], [0, 1]], [[0, 1], [1, 2], [0, 2]], 2, { normalize: true });
  const translation = [1, 2, 1, 2, 1, 2];
  near(apply(coboundary(s), translation).reduce((a, b) => a + Math.abs(b), 0), 0, 1e-12);
  const r = harmonicProjection(s, [0, 0, 1, 0.2, 0, 1], { tolerance: 1e-10 });
  assert.ok(r.converged);
  near(r.residual, 0, 1e-8);
});

import { applyTranspose, bodyBarReceipt, bodyBarSheaf, solveNormal } from "../src/cellular-sheaf.mjs";

test("solveNormal: min-norm solution of δᵀf = rhs; over-braced picks the harmonic representative", () => {
  // braced square (2D, 4 joints, 6 bars): one self-stress. Load the square in equilibrium: pull diagonal 0-2 apart.
  const pts = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const bars = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]];
  const s = rigiditySheaf(pts, bars, 2, { normalize: true });
  const load = [1, 1, 0, 0, -1, -1, 0, 0]; // equal and opposite along the diagonal
  const r = solveNormal(s, load);
  assert.ok(r.consistent && r.converged);
  const back = applyTranspose(coboundary(s), r.section);
  back.forEach((v, i) => near(v, load[i], 1e-9));
  // minimum norm: orthogonal to the self-stress, i.e. in the image of δ
  const again = solveNormal(s, load);
  assert.deepEqual(again.section, r.section); // deterministic
});

test("solveNormal: an unresolvable load is an obstruction in ker δ, not NaN", () => {
  // open square: a mechanism. A shear load is not carried.
  const pts = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const s = rigiditySheaf(pts, [[0, 1], [1, 2], [2, 3], [3, 0]], 2, { normalize: true });
  const shear = [0, -1, 0, 1, 0, 1, 0, -1]; // a net-zero force pattern of the shear mode: not in im δᵀ
  const r = solveNormal(s, shear);
  assert.ok(!r.consistent);
  assert.ok(Number.isFinite(r.residual) && r.residual > 0.1);
  near(norm2(apply(coboundary(s), r.obstruction)), 0, 1e-8); // the obstruction is a motion
});

const norm2 = (v) => Math.sqrt(v.reduce((a, b) => a + b * b, 0));

test("body-bar: a rigid pair joined by six generic bars is rigid; five leave one mechanism; collinear clusters are fine", () => {
  const bars = (list) => list.map(([a, b], i) => ({ id: i, kind: "bar", from: "A", to: "B", a, b }));
  // A at the origin; B displaced by (0,0,5); attachment points are collinear on each body's axis plus offsets.
  const six = bars([[[1, 0, 0], [1, 0, 5]], [[0, 1, 0], [1, 1, 6]], [[-1, 0, 0], [-2, 0, 5]], [[0, -1, 0], [0, -2, 5]], [[1, 1, 0], [0, 1, 4]], [[2, 0, 1], [2, 1, 5]]]);
  const full = bodyBarReceipt(["A", "B"], six);
  assert.equal(full.mechanisms, 0); assert.ok(full.rigid); assert.equal(full.pieces, 1);
  assert.ok(full.maxwell.holds);
  const five = bodyBarReceipt(["A", "B"], six.slice(0, 5));
  assert.equal(five.mechanisms, 1); assert.ok(!five.rigid); assert.ok(five.maxwell.holds);
  const seven = bodyBarReceipt(["A", "B"], [...six, { id: 9, kind: "bar", from: "A", to: "B", a: [3, 0, 0], b: [3, 2, 5] }]);
  assert.equal(seven.selfStresses, 1); assert.equal(seven.mechanisms, 0);
  const pin = bodyBarReceipt(["A", "B"], [{ id: "p", kind: "pin", from: "A", to: "B", at: [0, 0, 1] }]);
  assert.equal(pin.mechanisms, 3);
  const hinge = bodyBarReceipt(["A", "B"], [{ id: "h", kind: "hinge", from: "A", to: "B", at: [0, 0, 1], axis: [1, 0, 0] }]);
  assert.equal(hinge.mechanisms, 1);
  const apart = bodyBarReceipt(["A", "B"], []);
  assert.equal(apart.pieces, 2); assert.equal(apart.mechanisms, 0);
});

test("body-bar: equilibrium of a loaded rigid pair via solveNormal (unit rows are forces)", () => {
  // B hangs below A on three vertical bars; weight 3 on B, balanced by A.
  const tri = [[1, 0], [-1, 0], [0, 1]];
  const constraints = tri.map(([x, y], i) => ({ id: i, kind: "bar", from: "A", to: "B", a: [x, y, 0], b: [x, y, -2] }));
  const s = bodyBarSheaf(["A", "B"], constraints, { normalize: true });
  const loadOnB = [0, 0, -3, 0, 0, 0], loadOnA = [0, 0, 3, 0, 0, 0];
  // equilibrium: p + Rᵀf = 0 with f compression-positive: Rᵀf = −p
  const r = solveNormal(s, [...loadOnA, ...loadOnB].map((v) => -v));
  assert.ok(r.consistent);
  // tension is negative compression; moment balance puts the whole weight on the two bars at y = 0
  near(r.section[0], -1.5, 1e-9); near(r.section[1], -1.5, 1e-9); near(r.section[2], 0, 1e-9);
});

test("connected bar exchange actually fabricates a minimal count-preserving rigidity trajectory", () => {
  const points = [[0, 0], [2, 0], [0, 3], [3, 4], [5, 2]];
  const rigid = [[0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [1, 4], [2, 4]];
  const flexible = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3], [3, 4]];
  const path = planConnectedBarExchanges({ points, beforeBars: rigid, afterBars: flexible, dimension: 2 });
  assert.equal(path.kind, "signgraph.connectedBarExchangePath.v1");
  assert.equal(path.minimumSwapCount, 2);
  assert.equal(path.vertices, 5);
  assert.equal(path.bars, 7);
  assert.equal(path.eulerIndex, -2);
  assert.equal(path.meanCoordination, 14 / 5);
  assert.equal(path.startRigidity.cohomology.rank, 7);
  assert.equal(path.finalRigidity.cohomology.rank, 6);
  assert.deepEqual(path.exchanges.map(x => x.broken), [[1, 4], [2, 4]]);
  assert.deepEqual(path.exchanges.map(x => x.formed), [[2, 3], [3, 4]]);
  assert.equal(path.exchanges.reduce((rankChange, exchange) => rankChange + exchange.rankDelta, 0), -1);
  const edgeKey = ([a, b]) => [Math.min(a, b), Math.max(a, b)].join(":");
  const keys = list => new Set(list.map(edgeKey));
  const isConnected = bars => {
    const reached = new Set([0]), pending = [0];
    for (let at = 0; at < pending.length; at++) {
      for (const [u, v] of bars) {
        if (u === pending[at] && !reached.has(v)) { reached.add(v); pending.push(v); }
        if (v === pending[at] && !reached.has(u)) { reached.add(u); pending.push(u); }
      }
    }
    return reached.size === points.length;
  };
  let active = rigid;
  for (const step of path.exchanges) {
    assert.equal(step.resultBars.length, rigid.length);
    assert.equal(isConnected(step.resultBars), true);
    assert.ok(keys(active).has(edgeKey(step.broken)));
    assert.ok(!keys(active).has(edgeKey(step.formed)));
    const next = keys(step.resultBars);
    assert.ok(!next.has(edgeKey(step.broken)));
    assert.ok(next.has(edgeKey(step.formed)));
    assert.ok(Object.isFrozen(step) && Object.isFrozen(step.resultBars));
    active = step.resultBars;
  }
  assert.deepEqual(keys(active), keys(flexible));
  const back = planConnectedBarExchanges({ points, beforeBars: flexible, afterBars: rigid, dimension: 2 });
  assert.equal(back.minimumSwapCount, 2);
  assert.equal(back.startRigidity.cohomology.rank, 6);
  assert.equal(back.finalRigidity.cohomology.rank, 7);
  const same = planConnectedBarExchanges({
    points, beforeBars: rigid, afterBars: rigid.map(([u, v]) => [v, u]), dimension: 2,
  });
  assert.deepEqual(same.exchanges, []);
  assert.equal(same.startRigidity.cohomology.rank, same.finalRigidity.cohomology.rank);
  assert.throws(() => planConnectedBarExchanges({
    points, beforeBars: rigid, afterBars: flexible.slice(1), dimension: 2,
  }), /conserved vertex and bar counts/);
  assert.throws(() => planConnectedBarExchanges({
    points: [[0,0],[1,0],[0,1],[1,1]],
    beforeBars: [[0,1],[2,3]], afterBars: [[0,1],[1,2]], dimension: 2,
  }), /requires connected input and target networks/);
  assert.throws(() => planConnectedBarExchanges({
    points, beforeBars: rigid, afterBars: [...flexible.slice(0,-1), [1,0]], dimension: 2,
  }), /duplicate undirected bar/);
});

test("exact large rational restrictions preserve H⁰ even when numeric projection refuses", () => {
  const huge = 10n ** 400n;
  const restriction = `${huge + 1n}/${huge}`;
  const s = cellularSheaf({
    vertices: [{ id: "a", dim: 1 }, { id: "b", dim: 1 }],
    edges: [{ id: "e", from: "a", to: "b", dim: 1,
      restrict: { from: [[restriction]], to: [[1]] } }],
  });
  assert.equal(s.exact, true, "exact cohomology must not be excluded by host-double overflow");
  assert.equal(cellularSheafCohomology(s).h0, 1);
  assert.equal(cellularSheafCohomology(s).h1, 0);
  assert.throws(() => coboundary(s), /exact restriction cannot be represented in finite host arithmetic/);
  assert.throws(() => sheafLaplacian(s), /exact restriction cannot be represented in finite host arithmetic/);
});

test("numeric sheaf and weighted Dirichlet receipts reject overflow instead of fabricating Infinity", () => {
  const high = cellularSheaf({
    vertices: [{ id: "a", dim: 1 }, { id: "b", dim: 1 }],
    edges: [{ id: "e", from: "a", to: "b", dim: 1,
      restrict: { from: [[1e200]], to: [[1e200]] } }],
  });
  assert.throws(() => sheafLaplacian(high), /numerical Laplacian exceeded finite host arithmetic/);
  assert.throws(() => weightedSheafLaplacian(high, [[[1]]]), /numerical Laplacian exceeded finite host arithmetic/);

  const s = constantSheaf(["a", "b"], [["a", "b"]]);
  assert.equal(weightedSheafDirichlet(s, [[[1]]], [0, 2]).energy, 4);
  assert.throws(
    () => weightedSheafDirichlet(s, [[[1]]], [1e308, -1e308]),
    /numerical coboundary residual is not finite/,
  );
  assert.throws(
    () => weightedSheafDirichlet(s, [[[1e308]]], [0, 1e100]),
    /numerical edge energy exceeded finite host arithmetic/,
  );
});

test("tiny exact restrictions stay exact but cannot silently project to zero incidence", () => {
  // Underflow to a floating-point zero changes ker δ, while the exact
  // rational rank remains lawful. Exact H⁰/H¹ must remain available.
  const tiny = "1/" + "1" + "0".repeat(400);
  const s = cellularSheaf({
    vertices: [{ id: "a", dim: 1 }, { id: "b", dim: 1 }],
    edges: [{ id: "e", from: "a", to: "b", dim: 1,
      restrict: { from: [[tiny]], to: [[1]] } }],
  });
  assert.equal(s.exact, true);
  assert.equal(cellularSheafCohomology(s).h0, 1);
  assert.equal(cellularSheafCohomology(s).h1, 0);
  assert.throws(() => coboundary(s), /underflowed host arithmetic/);
  // An exactly zero coefficient is legitimately projected to zero.
  const zero = cellularSheaf({
    vertices: [{ id: "a", dim: 1 }, { id: "b", dim: 1 }],
    edges: [{ id: "e", from: "a", to: "b", dim: 1,
      restrict: { from: [["0/" + "1" + "0".repeat(400)]], to: [[1]] } }],
  });
  assert.deepEqual(apply(coboundary(zero), [3, 7]), [7]);
});

test("nonzero numerical sheaf products refuse host underflow rather than fabricate zero energy", () => {
  const thin = cellularSheaf({
    vertices: [{ id: "a", dim: 1 }, { id: "b", dim: 1 }],
    edges: [{ id: "e", from: "a", to: "b", dim: 1,
      restrict: { from: [[1e-200]], to: [[0]] } }],
  });
  assert.throws(() => sheafLaplacian(thin), /underflowed host arithmetic/);
  assert.throws(() => weightedSheafLaplacian(thin, [[[1]]]), /underflowed host arithmetic/);
  assert.throws(() => apply(coboundary(thin), [1e-200, 0]), /underflowed host arithmetic/);
  const ordinary = constantSheaf(["a", "b"], [["a", "b"]]);
  assert.equal(weightedSheafDirichlet(ordinary, [[[1]]], [0, 2]).energy, 4);
  assert.throws(() => weightedSheafDirichlet(ordinary, [[[1]]], [0, 1e-200]),
    /underflowed host arithmetic/);
});
