/**
 * SignGraph — cellular sheaves on a graph and their sheaf Laplacian: the numeric counterpart of
 * the machine-checked Lawvere/Tarski Laplacian.
 *
 * A cellular sheaf F on a graph assigns a stalk ℝ^d to each vertex and to each edge, and to each
 * incidence v ⊴ e a restriction map F_{v⊴e} : F(v) → F(e). The coboundary δ⁰ : C⁰ → C¹ is
 * (δx)_e = F_{to⊴e} x_to − F_{from⊴e} x_from, H⁰ = ker δ⁰ is the space of global sections and
 * H¹ = C¹ / im δ⁰. The sheaf Laplacian is L = δᵀδ (symmetric, positive semidefinite), and
 * ker L = ker δ = H⁰ (Obsmetrologia Dynamics/Flow/Laplacianizability — the Hodge isomorphism
 * H• ≅ ker Δ, whose inner-product moduli this module supplies — and LawvereKernelH0).
 * Over ℚ the ranks are exact (Cohomology/CoordinationCohomology: Ȟ⁰ = |V| − ρ, Ȟ¹ = |E| − ρ
 * around the incidence rank ρ); with every stalk ℝ¹ and identity restrictions this is the
 * integer incidence of `cohomology.mjs`. The heat flow x ← x − αLx (α from a Gershgorin bound)
 * converges monotonically to the harmonic section, the orthogonal projection of x₀ onto H⁰
 * (LawvereLaplacianSpectralGap); a pinned vertex value is admitted evidence (a boundary
 * condition); an edge whose residual crosses its tolerance is a firing step, the others are
 * smooth steps (ClosureFlowDynamics).
 *
 * Deterministic: only + − × ÷ and Math.sqrt (IEEE correctly rounded), in a fixed summation
 * order; no transcendental functions.
 */
import { coincidenceKey } from "@red-cup-engineering/signcell/cell";
import { isExactEntry, ratPairOfEntry, ratRank } from "@red-cup-engineering/exact-number-data-service/rational-matrix";
import { rankVanishing } from "./cohomology.mjs";

const freezeMatrix = (matrix) => Object.freeze(matrix.map((row) => Object.freeze([...row])));

const dimensionOf = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`cellularSheaf: ${label} must be a non-negative integer dimension`);
  return value;
};

/** The host number of a matrix entry: exact values read as their nearest double, finite floats as themselves. */
const numberOfEntry = (entry) => {
  if (typeof entry === "number") {
    if (!Number.isFinite(entry)) throw new RangeError("cellularSheaf: a restriction entry is not finite");
    return entry;
  }
  const [n, d] = ratPairOfEntry(entry);
  return Number(n) / Number(d);
};

/** Build a frozen, validated cellular sheaf on a graph.
 *  vertices: [{ id, dim }]; edges: [{ id, from, to, dim, restrict: { from: M, to: M } }] with M an
 *  edge.dim × vertex.dim array of rows. Ids are compared by SignCell coincidence. */
export function cellularSheaf({ vertices, edges }) {
  const vertexIndex = new Map();
  const vertexOffsets = [];
  let c0 = 0;
  const vs = vertices.map((vertex, index) => {
    const key = coincidenceKey(vertex.id);
    if (vertexIndex.has(key)) throw new RangeError("cellularSheaf: duplicate vertex id");
    vertexIndex.set(key, index);
    const dim = dimensionOf(vertex.dim, "a vertex dim");
    vertexOffsets.push(c0);
    c0 += dim;
    return Object.freeze({ id: vertex.id, dim });
  });
  const edgeKeys = new Set();
  const edgeOffsets = [];
  let c1 = 0;
  const from = [], to = [];
  const es = edges.map((edge) => {
    const key = coincidenceKey(edge.id);
    if (edgeKeys.has(key)) throw new RangeError("cellularSheaf: duplicate edge id");
    edgeKeys.add(key);
    const fi = vertexIndex.get(coincidenceKey(edge.from)), ti = vertexIndex.get(coincidenceKey(edge.to));
    if (fi === undefined || ti === undefined) throw new RangeError("cellularSheaf: an edge names a vertex that is not in the sheaf");
    const dim = dimensionOf(edge.dim, "an edge dim");
    const check = (matrix, vertexDim, side) => {
      if (!Array.isArray(matrix) || matrix.length !== dim || !matrix.every((row) => Array.isArray(row) && row.length === vertexDim)) {
        throw new RangeError(`cellularSheaf: restriction ${side} of an edge must be ${dim} × ${vertexDim}`);
      }
      for (const row of matrix) for (const entry of row) numberOfEntry(entry);
      return freezeMatrix(matrix);
    };
    const restrict = Object.freeze({ from: check(edge.restrict?.from, vs[fi].dim, "from"), to: check(edge.restrict?.to, vs[ti].dim, "to") });
    from.push(fi); to.push(ti);
    edgeOffsets.push(c1);
    c1 += dim;
    return Object.freeze({ id: edge.id, from: edge.from, to: edge.to, dim, restrict });
  });
  const exact = es.every((edge) => [edge.restrict.from, edge.restrict.to].every((matrix) => matrix.every((row) => row.every(isExactEntry))));
  return Object.freeze({
    kind: "signgraph.cellularSheaf",
    vertices: Object.freeze(vs), edges: Object.freeze(es),
    vertexOffsets: Object.freeze(vertexOffsets), edgeOffsets: Object.freeze(edgeOffsets),
    fromIndex: Object.freeze(from), toIndex: Object.freeze(to),
    c0, c1, exact,
  });
}

/** The constant sheaf ℝ^dim on a graph: identity restrictions. edges: [{ id, from, to }] or [from, to]. */
export function constantSheaf(vertexIds, edgeList, dim = 1) {
  const identity = Array.from({ length: dim }, (_, i) => Array.from({ length: dim }, (_, j) => (i === j ? 1 : 0)));
  return cellularSheaf({
    vertices: vertexIds.map((id) => ({ id, dim })),
    edges: edgeList.map((edge, index) => {
      const [fromId, toId, id] = Array.isArray(edge) ? [edge[0], edge[1], index] : [edge.from, edge.to, edge.id ?? index];
      return { id, from: fromId, to: toId, dim, restrict: { from: identity, to: identity } };
    }),
  });
}

/** A finite numeric 0-cochain over vertex stalks, in vertex order. Absent vertices read zero.
 * Repeated identical local readings are idempotent; disagreeing readings of one stalk cannot be
 * silently glued by last-write-wins. Witnesses/FOUR belong in the separate sign evidence fibers. */
export function cochain(sheaf, entries) {
  const out = new Array(sheaf.c0).fill(0);
  const seen = new Map();
  for (const { vertex, value } of entries) {
    const index = sheaf.vertices.findIndex((candidate) => coincidenceKey(candidate.id) === coincidenceKey(vertex));
    if (index < 0) throw new RangeError("cochain: unknown vertex");
    const values = Array.isArray(value) ? value : [value];
    if (values.length !== sheaf.vertices[index].dim) throw new RangeError("cochain: value has the wrong dimension");
    if (values.some((v) => typeof v !== "number" || !Number.isFinite(v))) {
      throw new RangeError("cochain: stalk values must be finite numbers");
    }
    if (seen.has(index)) {
      if (values.some((v, k) => v !== seen.get(index)[k])) {
        throw new RangeError("cochain: conflicting duplicate vertex readings");
      }
      continue;
    }
    seen.set(index, [...values]);
    values.forEach((v, k) => { out[sheaf.vertexOffsets[index] + k] = v; });
  }
  return out;
}

// — sparse matrices: rows of [column, value] pairs, columns ascending —

const sparse = (rows, cols, entries) => Object.freeze({ kind: "signgraph.sparseMatrix", rows, cols, entries: Object.freeze(entries.map((row) => Object.freeze(row.map((pair) => Object.freeze(pair))))) });

const rowOf = (map) => [...map.entries()].sort((a, b) => a[0] - b[0]);

/** The coboundary δ⁰ : C⁰ → C¹ as a sparse block matrix. */
export function coboundary(sheaf) {
  const entries = [];
  sheaf.edges.forEach((edge, e) => {
    const f = sheaf.fromIndex[e], t = sheaf.toIndex[e];
    for (let r = 0; r < edge.dim; r += 1) {
      const row = new Map();
      const add = (matrix, vertexIndex, sign) => matrix[r].forEach((entry, k) => {
        const column = sheaf.vertexOffsets[vertexIndex] + k;
        row.set(column, (row.get(column) ?? 0) + sign * numberOfEntry(entry));
      });
      add(edge.restrict.from, f, -1);
      add(edge.restrict.to, t, 1);
      entries.push(rowOf(row).filter(([, value]) => value !== 0));
    }
  });
  return sparse(sheaf.c1, sheaf.c0, entries);
}

/** Apply a sparse matrix to a vector, summing each row in column order. */
export function apply(matrix, x) {
  if (x.length !== matrix.cols) throw new RangeError("apply: vector length does not match the matrix");
  return matrix.entries.map((row) => { let sum = 0; for (const [column, value] of row) sum += value * x[column]; return sum; });
}

const gramLaplacian = (sheaf, entries) => {
  const rows = Array.from({ length: sheaf.c0 }, () => new Map());
  for (const row of entries) {
    for (const [i, a] of row) for (const [j, b] of row) rows[i].set(j, (rows[i].get(j) ?? 0) + a * b);
  }
  return sparse(sheaf.c0, sheaf.c0, rows.map(rowOf));
};

/** The sheaf Laplacian L = δᵀδ on C⁰, sparse and symmetric. */
export function sheafLaplacian(sheaf) {
  return gramLaplacian(sheaf, coboundary(sheaf).entries);
}

/** Each edge metric W is dim × dim, finite, symmetric positive definite. The lower factor C satisfies
 * W = CCᵀ, so Cᵀ whitens that edge's residual. Only round-off asymmetry (32 × machine epsilon relative to each pair)
 * is averaged; an indefinite or singular metric is refused, never repaired with a ridge. */
const edgeMetricFactors = (sheaf, metrics) => {
  if (!Array.isArray(metrics) || metrics.length !== sheaf.edges.length) {
    throw new RangeError("weightedSheaf: one metric is required per edge, in sheaf edge order");
  }
  return sheaf.edges.map((edge, e) => {
    const metric = metrics[e], d = edge.dim;
    if (!Array.isArray(metric) || metric.length !== d || !metric.every((row) => Array.isArray(row) && row.length === d)) {
      throw new RangeError("weightedSheaf: an edge metric has the wrong stalk dimension");
    }
    const W = metric.map((row) => row.map((entry) => {
      const value = numberOfEntry(entry);
      if (!Number.isFinite(value)) throw new RangeError("weightedSheaf: a metric entry is not finite");
      return value;
    }));
    for (let i = 0; i < d; i += 1) for (let j = 0; j < i; j += 1) {
      const a = W[i][j], b = W[j][i];
      if (Math.abs(a - b) > 32 * Number.EPSILON * Math.max(Math.abs(a), Math.abs(b))) {
        throw new RangeError("weightedSheaf: an edge metric is not symmetric");
      }
      W[i][j] = W[j][i] = a === b ? a : a / 2 + b / 2;
    }
    const C = Array.from({ length: d }, () => new Array(d).fill(0));
    for (let i = 0; i < d; i += 1) for (let j = 0; j <= i; j += 1) {
      let value = W[i][j];
      for (let k = 0; k < j; k += 1) value -= C[i][k] * C[j][k];
      if (!Number.isFinite(value) || (i === j && value <= 0)) {
        throw new RangeError("weightedSheaf: an edge metric is not positive definite in host arithmetic");
      }
      C[i][j] = i === j ? Math.sqrt(value) : value / C[j][j];
      if (!Number.isFinite(C[i][j])) throw new RangeError("weightedSheaf: an edge metric factor is not finite");
    }
    return C;
  });
};

/** The metric sheaf Laplacian L = δᵀWδ, with a full SPD metric for each edge stalk.
 * Uses (Cᵀδ)ᵀ(Cᵀδ) where W = CCᵀ; the existing coboundary preserves self-edge cancellation and
 * non-identity restrictions. Sparse columns and all sums follow sheaf edge/stalk order. */
export function weightedSheafLaplacian(sheaf, metrics) {
  const factors = edgeMetricFactors(sheaf, metrics), delta = coboundary(sheaf);
  const entries = [];
  sheaf.edges.forEach((edge, e) => {
    const C = factors[e], offset = sheaf.edgeOffsets[e];
    for (let i = 0; i < edge.dim; i += 1) {
      const row = new Map();
      for (let j = i; j < edge.dim; j += 1) for (const [column, value] of delta.entries[offset + j]) {
        row.set(column, (row.get(column) ?? 0) + C[j][i] * value);
      }
      entries.push(rowOf(row).filter(([, value]) => value !== 0));
    }
  });
  return gramLaplacian(sheaf, entries);
}

/** Dirichlet energy xᵀLx = Σ_e (δx)_eᵀ W_e (δx)_e, with no factor of 1/2.
 * Returns the unweighted edge residual and its metric energy for attribution; these are numeric
 * energies, not probabilities. SPD weights preserve ker L = ker δ = H⁰. */
export function weightedSheafDirichlet(sheaf, metrics, x) {
  if (x?.length !== sheaf.c0 || Array.from(x).some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    throw new RangeError("weightedSheafDirichlet: a finite 0-cochain of the sheaf dimension is required");
  }
  const factors = edgeMetricFactors(sheaf, metrics), deltaX = apply(coboundary(sheaf), x);
  let energy = 0;
  const perEdge = sheaf.edges.map((edge, e) => {
    const residual = deltaX.slice(sheaf.edgeOffsets[e], sheaf.edgeOffsets[e] + edge.dim), C = factors[e];
    let edgeEnergy = 0;
    for (let i = 0; i < edge.dim; i += 1) {
      let value = 0;
      for (let j = i; j < edge.dim; j += 1) value += C[j][i] * residual[j];
      edgeEnergy += value * value;
    }
    energy += edgeEnergy;
    return Object.freeze({ id: edge.id, energy: edgeEnergy, residual: Object.freeze(residual) });
  });
  return Object.freeze({ energy, perEdge: Object.freeze(perEdge) });
}

/** L x. */
export const applyLaplacian = (sheaf, x) => apply(sheafLaplacian(sheaf), x);

// — exact cohomology over ℚ —

/** The exact cohomology receipt: dim H⁰ = dim C⁰ − rank δ, dim H¹ = dim C¹ − rank δ over ℚ. Needs exact restriction entries. */
export function cellularSheafCohomology(sheaf) {
  if (!sheaf.exact) throw new RangeError("cellularSheafCohomology: restriction entries must be exact (integers, bigints, rational carriers or \"a/b\")");
  const rankValue = sheaf.c1 === 0 || sheaf.c0 === 0 ? 0 : ratRank(exactCoboundary(sheaf));
  const h0 = sheaf.c0 - rankValue, h1 = sheaf.c1 - rankValue;
  return Object.freeze({ kind: "signgraph.cellularSheafCohomology", h0, h1, vanishing: rankVanishing(h1), rank: rankValue, c0: sheaf.c0, c1: sheaf.c1 });
}

/** δ⁰ as a dense matrix of exact "n/d" strings. */
function exactCoboundary(sheaf) {
  const rows = [];
  sheaf.edges.forEach((edge, e) => {
    for (let r = 0; r < edge.dim; r += 1) {
      const row = Array.from({ length: sheaf.c0 }, () => [0n, 1n]);
      const add = (matrix, vertexIndex, sign) => matrix[r].forEach((entry, k) => {
        const [n, d] = ratPairOfEntry(entry);
        const cell = row[sheaf.vertexOffsets[vertexIndex] + k];
        const sn = BigInt(sign) * n;
        cell[0] = cell[0] * d + sn * cell[1];
        cell[1] *= d;
      });
      add(edge.restrict.from, sheaf.fromIndex[e], -1);
      add(edge.restrict.to, sheaf.toIndex[e], 1);
      rows.push(row.map(([n, d]) => `${n}/${d}`));
    }
  });
  return rows;
}

// — the heat flow —

const norm = (vector) => { let sum = 0; for (const v of vector) sum += v * v; return Math.sqrt(sum); };

/** The Gershgorin bound on L's spectrum: the largest absolute row sum (λ_max ≤ this). */
export function gershgorinBound(laplacian) {
  let bound = 0;
  for (const row of laplacian.entries) { let sum = 0; for (const [, value] of row) sum += Math.abs(value); if (sum > bound) bound = sum; }
  return bound;
}

/** Heat flow x ← x − αLx from x₀, with optional pinned vertex values (boundary conditions, admitted
 *  evidence: `fixed` is [{ vertex, value }], held constant). α defaults to 1 / Gershgorin bound, which is
 *  conservative and energy-stable. Explicit steps must satisfy α·Gershgorin(L) < 2. Stops when the free gradient
 *  ‖L x‖ falls to `tolerance`, or after `maxSteps`. Returns
 *  { section, residual: ‖δx‖, gradient, steps, converged, firings, crossings }: `firings` are the steps at which
 *  some edge's residual ‖(δx)_e‖ crossed `tolerance`; `crossings` names those edges and directions. */
export function diffuse(sheaf, x0, { step, tolerance = 1e-12, maxSteps = 100000, fixed = [] } = {}) {
  if (x0?.length !== sheaf.c0) throw new RangeError("diffuse: x0 has the wrong length");
  if (Array.from(x0).some((v) => typeof v !== "number" || !Number.isFinite(v))) {
    throw new RangeError("diffuse: initial stalk values must be finite numbers");
  }
  if (typeof tolerance !== "number" || !Number.isFinite(tolerance) || tolerance < 0) {
    throw new RangeError("diffuse: tolerance must be finite and non-negative");
  }
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 0) {
    throw new RangeError("diffuse: maxSteps must be a non-negative safe integer");
  }
  if (!Array.isArray(fixed)) throw new TypeError("diffuse: fixed must be an array of vertex readings");
  const delta = coboundary(sheaf), laplacian = sheafLaplacian(sheaf);
  const bound = gershgorinBound(laplacian);
  if (!Number.isFinite(bound)) throw new RangeError("diffuse: Laplacian bound is not finite");
  const alpha = step ?? (bound === 0 ? 0 : 1 / bound);
  // Since 0 ≤ λ_max(L) ≤ bound, 0 < alpha*bound < 2 guarantees contraction of
  // every nonzero Laplacian mode. A zero Laplacian needs no step at all.
  if (typeof alpha !== "number" || !Number.isFinite(alpha) ||
      (bound > 0 ? !(alpha > 0 && alpha * bound < 2) : alpha < 0)) {
    throw new RangeError("diffuse: step must satisfy 0 < step * Gershgorin bound < 2 (or be non-negative for a zero Laplacian)");
  }
  const pinned = new Array(sheaf.c0).fill(false);
  const seen = new Map();
  const x = [...x0];
  for (const { vertex, value } of fixed) {
    const index = sheaf.vertices.findIndex((candidate) => coincidenceKey(candidate.id) === coincidenceKey(vertex));
    if (index < 0) throw new RangeError("diffuse: unknown pinned vertex");
    const values = Array.isArray(value) ? value : [value];
    if (values.length !== sheaf.vertices[index].dim) throw new RangeError("diffuse: pinned value has the wrong dimension");
    if (values.some((v) => typeof v !== "number" || !Number.isFinite(v))) {
      throw new RangeError("diffuse: pinned stalk values must be finite numbers");
    }
    const prior = seen.get(index);
    if (prior !== undefined) {
      if (values.some((v, k) => v !== prior[k])) throw new RangeError("diffuse: conflicting duplicate pinned vertex readings");
      continue;
    }
    seen.set(index, [...values]);
    values.forEach((v, k) => { x[sheaf.vertexOffsets[index] + k] = v; pinned[sheaf.vertexOffsets[index] + k] = true; });
  }
  const finiteNorm = (values) => {
    if (values.some((v) => !Number.isFinite(v))) throw new RangeError("diffuse: non-finite numeric state");
    const length = norm(values);
    if (!Number.isFinite(length)) throw new RangeError("diffuse: non-finite numeric residual");
    return length;
  };
  const edgeResiduals = (vector) => {
    const d = apply(delta, vector);
    return sheaf.edges.map((edge, e) => finiteNorm(d.slice(sheaf.edgeOffsets[e], sheaf.edgeOffsets[e] + edge.dim)));
  };
  const freeGradient = (vector) => {
    const g = apply(laplacian, vector);
    if (g.some((v) => !Number.isFinite(v))) throw new RangeError("diffuse: non-finite numeric gradient");
    return g.map((v, i) => (pinned[i] ? 0 : v));
  };
  let settled = edgeResiduals(x).map((r) => r <= tolerance);
  const firings = [], crossings = [];
  let steps = 0, gradient = freeGradient(x), converged = finiteNorm(gradient) <= tolerance;
  while (!converged && steps < maxSteps) {
    for (let i = 0; i < x.length; i += 1) x[i] -= alpha * gradient[i];
    if (x.some((v) => !Number.isFinite(v))) throw new RangeError("diffuse: non-finite numeric state");
    steps += 1;
    const residuals = edgeResiduals(x);
    let fired = false;
    residuals.forEach((r, e) => {
      const now = r <= tolerance;
      if (now !== settled[e]) { fired = true; crossings.push(Object.freeze({ step: steps, edge: sheaf.edges[e].id, direction: now ? "settled" : "violated" })); settled[e] = now; }
    });
    if (fired) firings.push(steps);
    gradient = freeGradient(x);
    converged = finiteNorm(gradient) <= tolerance;
  }
  const residual = finiteNorm(apply(delta, x));
  // Stationarity under pinned Dirichlet conditions is not necessarily a global
  // section: incompatible pins can converge with nonzero coboundary.
  return Object.freeze({
    section: Object.freeze(x), residual, gradient: finiteNorm(gradient),
    compatible: residual <= tolerance, steps, converged,
    firings: Object.freeze(firings), crossings: Object.freeze(crossings),
  });
}

/** The free heat-flow limit projects to H⁰; incompatible pinned conditions may obstruct global gluing. */
export const harmonicProjection = (sheaf, x0, options = {}) => diffuse(sheaf, x0, options);

/** The degree-0 Hodge check: for a sheaf, the diffusion limit of x₀ lies in ker L and, when H¹ = 0 (exact),
 *  is a global section (δ section ≈ 0). Returns the residuals and whether the limit is harmonic. */
export function hodgeCheck(sheaf, x0, options = {}) {
  const tolerance = options.tolerance ?? 1e-12;
  const limit = diffuse(sheaf, x0, { ...options, fixed: [] });
  const laplacianResidual = norm(applyLaplacian(sheaf, limit.section));
  return Object.freeze({
    kind: "signgraph.hodgeCheck",
    h1: sheaf.exact ? cellularSheafCohomology(sheaf).h1 : undefined,
    section: limit.section, sectionResidual: limit.residual, laplacianResidual, steps: limit.steps,
    harmonic: limit.converged && limit.residual <= tolerance * 1e3 && laplacianResidual <= tolerance,
  });
}

// — rigidity as cohomology —

/** The rigidity-matrix sheaf of a bar framework in dimension d (2 or 3 or any d ≥ 1): stalk ℝ^d per joint, stalk ℝ¹
 *  per bar, both restrictions the bar's direction row. Directions are the exact differences p_j − p_i by default
 *  (rank and kernel do not depend on a bar's positive scaling, so the cohomology is exact over ℚ for rational
 *  coordinates); `normalize: true` divides by the bar length (Math.sqrt), which needs float coordinates.
 *  points: array of coordinate arrays; bars: [[i, j], ...] (joint indices). dim H⁰ = infinitesimal motions
 *  (rigid iff d(d+1)/2 for a connected framework with ≥ d joints in general position), dim H¹ = self-stresses. */
export function rigiditySheaf(points, bars, dimension, { normalize = false } = {}) {
  for (const point of points) if (point.length !== dimension) throw new RangeError("rigiditySheaf: a point has the wrong dimension");
  return cellularSheaf({
    vertices: points.map((_, index) => ({ id: index, dim: dimension })),
    edges: bars.map(([i, j], index) => {
      let row;
      if (normalize) {
        const diff = points[j].map((c, k) => Number(c) - Number(points[i][k]));
        const length = norm(diff);
        if (length === 0) throw new RangeError("rigiditySheaf: a bar has zero length");
        row = diff.map((c) => c / length);
      } else {
        row = points[j].map((c, k) => {
          const [a, b] = ratPairOfEntry(c), [p, q] = ratPairOfEntry(points[i][k]);
          return `${a * q - p * b}/${b * q}`;
        });
      }
      return { id: index, from: i, to: j, dim: 1, restrict: { from: [row], to: [row] } };
    }),
  });
}

/** The rigidity reading of a framework: infinitesimal motions, trivial motions d(d+1)/2, self-stresses, rigidity. */
export function rigidityReceipt(points, bars, dimension, options = {}) {
  const cohomology = cellularSheafCohomology(rigiditySheaf(points, bars, dimension, options));
  const trivial = (dimension * (dimension + 1)) / 2;
  return Object.freeze({
    kind: "signgraph.rigidity", dimension, motions: cohomology.h0, trivialMotions: trivial, mechanisms: cohomology.h0 - trivial,
    selfStresses: cohomology.h1, infinitesimallyRigid: cohomology.h0 === trivial, cohomology,
  });
}


/** Compare two embedded simple bar-joint frameworks with equal counted
 * vertices and bars. Associative exchange conserves those *counts*; it does
 * not establish that the exact rigidity-matrix rank is conserved.
 *
 * Each snapshot owns its own vertex positions and undirected bar endpoints.
 * This is a geometric kinematic assay, NOT a claim that a chemical vitrimer
 * reaction can realize the edge swap, or that phase/strength is measured.
 * The calculation reuses the exact rational rigidity sheaf above.
 */
export function compareFixedCountRigidity({ before, after, dimension } = {}) {
  if (dimension !== 2 && dimension !== 3)
    throw new RangeError("fixed-count rigidity comparison requires dimension 2 or 3");
  const shape = (snapshot, label) => {
    if (!Array.isArray(snapshot?.points) || snapshot.points.length < dimension ||
        !Array.isArray(snapshot.bars))
      throw new TypeError(`${label}: explicit points and bars are required`);
    const n = snapshot.points.length, seen = new Set();
    for (const [ordinal, bar] of snapshot.bars.entries()) {
      if (!Array.isArray(bar) || bar.length !== 2 ||
          bar.some(i => !Number.isSafeInteger(i) || i < 0 || i >= n) ||
          bar[0] === bar[1])
        throw new RangeError(`${label}: invalid bar endpoints at index ${ordinal}`);
      const key = bar[0] < bar[1] ? `${bar[0]}:${bar[1]}` : `${bar[1]}:${bar[0]}`;
      if (seen.has(key)) throw new RangeError(`${label}: duplicate undirected bar`);
      seen.add(key);
    }
    return { n, m: snapshot.bars.length };
  };
  const a = shape(before, "before"), b = shape(after, "after");
  if (a.n !== b.n || a.m !== b.m)
    throw new RangeError("fixed-count rigidity comparison requires conserved vertex and bar counts");
  const first = rigidityReceipt(before.points, before.bars, dimension);
  const second = rigidityReceipt(after.points, after.bars, dimension);
  return Object.freeze({
    kind: "signgraph.fixedCountRigidityComparison",
    graphKind: "simple-embedded-bar-joint", dimension,
    vertices: a.n, bars: a.m, eulerIndex: a.n - a.m,
    meanCoordination: 2 * a.m / a.n,
    before: first, after: second,
    rankDelta: second.cohomology.rank - first.cohomology.rank,
    mechanismsDelta: second.mechanisms - first.mechanisms,
    rigidityChanged: first.infinitesimallyRigid !== second.infinitesimallyRigid,
    scope: "exact rational infinitesimal framework kinematics; no chemical pathway or kinetics established",
  });
}

/**
 * Fabricate a minimum-length sequence of graph-edge replacements between two
 * connected simple bar frameworks at ONE shared point configuration.
 *
 * This is a bounded COMBINATORIAL model of count-preserving associative
 * exchange: each step removes one obsolete edge and adds one requested edge,
 * keeps the number of vertices/bars constant, and preserves connectivity.
 * We select the first admissible pair deterministically, rather than assuming
 * that a chemical exchange, activation energy, rate, strain tolerance, or
 * stereochemical transition is possible. Those are external Science inputs.
 *
 * Unlike a before/after index check, this returns actual intermediate
 * bar lists and exact-rational rigidity readings for a consuming simulator.
 * Because every step adds one missing target bar and loses no target bar,
 * the number of steps is the minimum possible in this single-replacement
 * graph model; it says nothing about physically feasible shortest paths.
 */
export function planConnectedBarExchanges({ points, beforeBars, afterBars, dimension } = {}) {
  // Reuse the exact owner admission rather than duplicate coordinate/edge
  // parsing. A single points array prohibits an unnoticed embedding change.
  const initial = compareFixedCountRigidity({
    before: { points, bars: beforeBars }, after: { points, bars: afterBars }, dimension,
  });
  const n = initial.vertices, m = initial.bars;
  if (n > 64 || m > 128)
    throw new RangeError("connected bar exchange exceeds the bounded geometry profile");
  const canonical = ([a, b]) => a < b ? [a, b] : [b, a];
  const order = ([a, b], [c, d]) => a - c || b - d;
  const key = ([a, b]) => a + ":" + b;
  const sorted = bars => bars.map(canonical).sort(order);
  let current = sorted(beforeBars);
  const target = sorted(afterBars), desired = new Set(target.map(key));
  const connected = bars => {
    if (n === 0) return false;
    const neighbors = Array.from({ length: n }, () => []);
    for (const [a, b] of bars) { neighbors[a].push(b); neighbors[b].push(a); }
    const visited = new Set([0]), pending = [0];
    for (let pos = 0; pos < pending.length; pos++) {
      for (const other of neighbors[pending[pos]]) if (!visited.has(other)) {
        visited.add(other); pending.push(other);
      }
    }
    return visited.size === n;
  };
  if (!connected(current) || !connected(target))
    throw new RangeError("connected bar exchange requires connected input and target networks");
  const actual = new Set(current.map(key));
  const missing = target.filter(bar => !actual.has(key(bar)));
  if (missing.length > 32)
    throw new RangeError("connected bar exchange exceeds the bounded 32-swap profile");
  const exchanges = [];
  while (missing.length > 0) {
    const obsolete = current.filter(bar => !desired.has(key(bar)));
    let choice = null;
    for (const newBar of missing) {
      for (const oldBar of obsolete) {
        const candidate = current.filter(bar => key(bar) !== key(oldBar)).concat([newBar]).sort(order);
        if (connected(candidate)) { choice = { oldBar, newBar, candidate }; break; }
      }
      if (choice) break;
    }
    if (!choice) throw new RangeError("no connected count-preserving exchange can advance the source network");
    const step = compareFixedCountRigidity({
      before: { points, bars: current }, after: { points, bars: choice.candidate }, dimension,
    });
    exchanges.push(Object.freeze({
      broken: Object.freeze([...choice.oldBar]),
      formed: Object.freeze([...choice.newBar]),
      resultBars: Object.freeze(choice.candidate.map(bar => Object.freeze([...bar]))),
      rankDelta: step.rankDelta,
      mechanismsDelta: step.mechanismsDelta,
      rigidityChanged: step.rigidityChanged,
      rigidity: step.after,
    }));
    current = choice.candidate;
    const added = missing.findIndex(bar => key(bar) === key(choice.newBar));
    missing.splice(added, 1);
  }
  if (current.length !== target.length || current.some((bar, index) => key(bar) !== key(target[index])))
    throw new TypeError("bar exchange failed to realize the exact target network");
  return Object.freeze({
    kind: "signgraph.connectedBarExchangePath.v1",
    graphKind: "simple-embedded-bar-joint",
    dimension, vertices: n, bars: m,
    eulerIndex: n - m, meanCoordination: 2 * m / n,
    minimumSwapCount: exchanges.length,
    startRigidity: initial.before,
    finalRigidity: initial.after,
    exchanges: Object.freeze(exchanges),
    scope: "connected exact-rational graph kinematics; no chemical pathways, rates or physical rigidity assays",
  });
}

// — the dual: loads, and the transpose of the coboundary —

/** Mᵀ y for a sparse matrix, summing in row order (deterministic). */
export function applyTranspose(matrix, y) {
  if (y.length !== matrix.rows) throw new RangeError("applyTranspose: vector length does not match the matrix");
  const out = new Array(matrix.cols).fill(0);
  matrix.entries.forEach((row, i) => { for (const [column, value] of row) out[column] += value * y[i]; });
  return out;
}

/** Solve δᵀ f = rhs for the 1-cochain f of minimum norm (the harmonic representative: f ∈ im δ, orthogonal to
 *  ker δᵀ = the self-stresses H¹), by conjugate gradients on the normal equations (CGLS) from f = 0.
 *  rhs is a 0-cochain (a load on each stalk). Finite in exact arithmetic (at most rank δ steps); uses only
 *  + − × ÷ in a fixed order. When rhs ∉ im δᵀ — it has a component in ker δ = H⁰, a load the sheaf cannot
 *  carry — the system is inconsistent and the unresolvable part is returned as `obstruction` (= rhs − δᵀ f,
 *  a 0-cochain in ker δ), never NaN. Returns { section: f, obstruction, residual: ‖obstruction‖, rhsNorm,
 *  steps, converged, consistent }. The option "floor" is a load scale below which a residual is round-off, not obstruction. */
export function solveNormal(sheaf, rhs, { tolerance = 1e-12, consistency = 1e-9, floor = 0, maxSteps = 4 * (sheaf.c0 + sheaf.c1) + 16 } = {}) {
  if (rhs.length !== sheaf.c0) throw new RangeError("solveNormal: rhs has the wrong length");
  const delta = coboundary(sheaf);
  const dot = (a, b) => { let sum = 0; for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i]; return sum; };
  const f = new Array(sheaf.c1).fill(0);
  const r = [...rhs];
  const rhsNorm = norm(rhs);
  let s = apply(delta, r), gamma = dot(s, s);
  const stop = (tolerance * Math.sqrt(gamma)) ** 2;
  let p = [...s], steps = 0, converged = gamma === 0;
  while (!converged && steps < maxSteps) {
    const q = applyTranspose(delta, p);
    const qq = dot(q, q);
    if (qq === 0) break;
    const alpha = gamma / qq;
    for (let i = 0; i < f.length; i += 1) f[i] += alpha * p[i];
    for (let i = 0; i < r.length; i += 1) r[i] -= alpha * q[i];
    s = apply(delta, r);
    const next = dot(s, s);
    steps += 1;
    if (next <= stop) { converged = true; break; }
    const beta = next / gamma;
    gamma = next;
    p = s.map((v, i) => v + beta * p[i]);
  }
  const residual = norm(r);
  return Object.freeze({
    kind: "signgraph.normalSolution", section: Object.freeze(f), obstruction: Object.freeze(r), residual, rhsNorm,
    steps, converged, consistent: converged && residual <= consistency * Math.max(rhsNorm, floor, 1e-300),
  });
}

// — rigid bodies joined by bars, pins and hinges —

const gcdBigInt = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b !== 0n) [a, b] = [b, a % b]; return a; };
const qReduce = ([n, d]) => { const g = gcdBigInt(n, d) || 1n; return d < 0n ? [-n / g, -d / g] : [n / g, d / g]; };
/** The two arithmetics a body-bar sheaf is built in: exact ℚ (pairs of BigInt) and host doubles. */
const EXACT = {
  of: (e) => ratPairOfEntry(e), zero: [0n, 1n], one: [1n, 1n],
  add: ([a, b], [c, d]) => qReduce([a * d + c * b, b * d]), sub: ([a, b], [c, d]) => qReduce([a * d - c * b, b * d]),
  mul: ([a, b], [c, d]) => qReduce([a * c, b * d]), abs: ([a, b]) => [a < 0n ? -a : a, b],
  less: ([a, b], [c, d]) => a * d < c * b, out: ([n, d]) => `${n}/${d}`,
};
const FLOAT = {
  of: (e) => numberOfEntry(e), zero: 0, one: 1, add: (a, b) => a + b, sub: (a, b) => a - b, mul: (a, b) => a * b, abs: Math.abs,
  less: (a, b) => a < b, out: (x) => x,
};
const cross3 = (F, a, b) => [F.sub(F.mul(a[1], b[2]), F.mul(a[2], b[1])), F.sub(F.mul(a[2], b[0]), F.mul(a[0], b[2])), F.sub(F.mul(a[0], b[1]), F.mul(a[1], b[0]))];
const unitScale = (F, v) => { const length = Math.sqrt(v.reduce((s, c) => s + c * c, 0)); if (length === 0) throw new RangeError("bodyBarSheaf: a degenerate direction"); return v.map((c) => c / length); };

/** The body-bar rigidity sheaf (Tay–Whiteley): each rigid body is a vertex with stalk ℝ⁶ = (v, ω), the velocity of
 *  its frame origin and its angular velocity; each constraint is an edge whose coboundary is the relative velocity
 *  it forbids. This is the rigidity sheaf of `rigiditySheaf` generalised from point joints to rigid clusters (a
 *  cluster of collinear or coplanar points has no spurious rotation). Constraints, with points in the common frame:
 *    { id, kind: "bar",   from, to, a, b }          a bar from point a on body `from` to point b on `to` (1 row)
 *    { id, kind: "pin",   from, to, at }            a ball joint at `at` (3 rows)
 *    { id, kind: "hinge", from, to, at, axis }      a hinge about `axis` through `at` (3 + 2 rows)
 *  With `normalize` (host doubles) a bar's row is a unit direction, so a row's cochain value is a force in the
 *  same unit as the loads; exact (default) rows are over ℚ and give exact cohomology. */
export function bodyBarSheaf(bodyIds, constraints, { normalize = false } = {}) {
  const F = normalize ? FLOAT : EXACT;
  const vec = (v) => v.map((c) => F.of(c));
  const unit = (v) => (normalize ? unitScale(F, v) : v);
  const basis = (k) => [0, 1, 2].map((i) => (i === k ? F.one : F.zero));
  const edges = constraints.map((c) => {
    let from, to, dim;
    const rowsOf = (v, w) => [...v, ...w].map(F.out);
    if (c.kind === "bar") {
      const a = vec(c.a), b = vec(c.b);
      const u = unit(b.map((x, k) => F.sub(x, a[k])));
      if (u.every((x) => !F.less(F.zero, F.abs(x)))) throw new RangeError("bodyBarSheaf: a bar has zero length");
      from = [rowsOf(u, cross3(F, a, u))]; to = [rowsOf(u, cross3(F, b, u))]; dim = 1;
    } else if (c.kind === "pin" || c.kind === "hinge") {
      const p = vec(c.at);
      const rows = [0, 1, 2].map((k) => rowsOf(basis(k), cross3(F, p, basis(k))));
      if (c.kind === "hinge") {
        const n = vec(c.axis);
        let k = 0;
        for (let i = 1; i < 3; i += 1) if (F.less(F.abs(n[i]), F.abs(n[k]))) k = i;
        const n1 = cross3(F, n, basis(k)), n2 = cross3(F, n, n1);
        for (const m of [n1, n2]) rows.push(rowsOf([F.zero, F.zero, F.zero], unit(m)));
      }
      from = rows; to = rows; dim = rows.length;
    } else throw new RangeError(`bodyBarSheaf: unknown constraint kind ${JSON.stringify(c.kind)}`);
    return { id: c.id, from: c.from, to: c.to, dim, restrict: { from, to } };
  });
  return cellularSheaf({ vertices: bodyIds.map((id) => ({ id, dim: 6 })), edges });
}

/** The rigidity reading of rigid bodies joined by constraints: infinitesimal motions (H⁰), mechanisms
 *  (motions − 6 per connected piece), self-stresses (H¹), and the Maxwell identity
 *  mechanisms − selfStresses = 6·(bodies − pieces) − constraint rows. Exact over ℚ. */
export function bodyBarReceipt(bodyIds, constraints, options = {}) {
  const sheaf = bodyBarSheaf(bodyIds, constraints, { ...options, normalize: false });
  const cohomology = cellularSheafCohomology(sheaf);
  const parent = bodyIds.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const index = new Map(bodyIds.map((id, i) => [coincidenceKey(id), i]));
  for (const c of constraints) parent[find(index.get(coincidenceKey(c.from)))] = find(index.get(coincidenceKey(c.to)));
  const pieces = new Set(bodyIds.map((_, i) => find(i))).size;
  const mechanisms = cohomology.h0 - 6 * pieces;
  const maxwell = Object.freeze({ bodies: bodyIds.length, pieces, rows: sheaf.c1, lhs: mechanisms - cohomology.h1, rhs: 6 * (bodyIds.length - pieces) - sheaf.c1 });
  return Object.freeze({
    kind: "signgraph.bodyBarRigidity", bodies: bodyIds.length, pieces, motions: cohomology.h0, mechanisms, selfStresses: cohomology.h1,
    rigid: mechanisms === 0, maxwell: Object.freeze({ ...maxwell, holds: maxwell.lhs === maxwell.rhs }), cohomology,
  });
}
