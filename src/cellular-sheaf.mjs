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
import { canonicalCarrier, coincidenceKey } from "@red-cup-engineering/signcell/cell";
import { isExactEntry, ratPairOfEntry, ratRank, ratSolve } from "@red-cup-engineering/exact-number-data-service/rational-matrix";
import { rationalToFiniteNumber } from "@red-cup-engineering/exact-number-data-service/exact-number-host";
import { rationalOfBigInts } from "@red-cup-engineering/exact-number-data-service/exact-number";
import { rankVanishing } from "./cohomology.mjs";

const freezeMatrix = (matrix) => Object.freeze(matrix.map((row) => Object.freeze([...row])));

/**
 * Read a supplied sheaf record by own enumerable data descriptor ONLY.
 * This is a structural input boundary; it does not canonicalize opaque Cell
 * identities (SignCell), interpret numbers (Exact Number), or authenticate a
 * source actor. JavaScript Proxy traps still need a host security boundary.
 */
export function sheafSourceField(record, name, optional = false) {
  if (!record || typeof record !== "object" || Array.isArray(record) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(record)))
    throw new TypeError("cellularSheaf: source must be a plain data record");
  const field = Object.getOwnPropertyDescriptor(record, name);
  if (!field) {
    if (optional) return undefined;
    throw new TypeError("cellularSheaf: missing own source " + name);
  }
  if (!field.enumerable || !Object.hasOwn(field, "value"))
    throw new TypeError("cellularSheaf: source " + name + " must be inert own data");
  return field.value;
}

/** A dense, unadorned, bounded-by-actual-length copy of source array slots. */
export function sheafSourceArray(value, label) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype)
    throw new TypeError("cellularSheaf: " + label + " must be an ordinary data array");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== value.length + 1)
    throw new TypeError("cellularSheaf: " + label + " cannot be sparse or decorated");
  return Object.freeze(Array.from({length:value.length},(_,index)=>{
    const entry = descriptors[String(index)];
    if (!entry || !entry.enumerable || !Object.hasOwn(entry,"value"))
      throw new TypeError("cellularSheaf: " + label + " array slots must be inert own data");
    return entry.value;
  }));
}


/** Source-inert exact scalar retention. Does not redefine the original
 * Exact Number rationals or authorize an observer's reported coefficient.
 */
export const sheafSourceScalar = entry => {
  if (typeof entry === "number") { numberOfEntry(entry); return entry; }
  if (entry === null || typeof entry !== "object") {
    ratPairOfEntry(entry); return entry;
  }
  if (![Object.prototype, null].includes(Object.getPrototypeOf(entry)))
    throw new TypeError("cellularSheaf: exact source scalar must be plain data");
  const descriptors = Object.getOwnPropertyDescriptors(entry);
  const names = Reflect.ownKeys(descriptors);
  if (names.some(name => typeof name !== "string" ||
      !descriptors[name].enumerable || !Object.hasOwn(descriptors[name], "value")))
    throw new TypeError("cellularSheaf: exact source scalar cannot contain accessors or hidden data");
  const inert = Object.create(null);
  for (const name of names) {
    const part = descriptors[name].value;
    if (!["string","number","bigint","boolean"].includes(typeof part))
      throw new TypeError("cellularSheaf: exact source scalar contains executable content");
    Object.defineProperty(inert, name, {value: part, enumerable: true});
  }
  const [numerator, denominator] = ratPairOfEntry(inert);
  return rationalOfBigInts(numerator, denominator);
};

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
  // Data owns correct nearest-even binary64 projection, including huge
  // cancelling numerators/denominators and subnormal/overflow refusals.
  // SignGraph owns the typed sheaf; it must not recode the conversion.
  return rationalToFiniteNumber(...ratPairOfEntry(entry));
};

/** A bounded numeric sheaf must refuse both overflow and underflow to zero:
 * either would change its incidence, Gram kernel or reported Dirichlet energy.
 * This is a numerical receiving guard; exact rational algebra stays in Data. */
const numericProduct = (a, b, caller) => {
  const term = a * b;
  if (!Number.isFinite(term) || (a !== 0 && b !== 0 && term === 0)) {
    throw new RangeError(`${caller}: numerical product overflowed or underflowed host arithmetic`);
  }
  return term;
};

/** Build a frozen, validated cellular sheaf on a graph.
 *  vertices: [{ id, dim }]; edges: [{ id, from, to, dim, restrict: { from: M, to: M } }] with M an
 *  edge.dim × vertex.dim array of rows. Ids are compared by SignCell coincidence. */
export function cellularSheaf(source) {
  const vertices = sheafSourceArray(sheafSourceField(source, "vertices"), "vertices");
  const edges = sheafSourceArray(sheafSourceField(source, "edges"), "edges");
  const vertexIndex = new Map();
  const vertexOffsets = [];
  let c0 = 0;
  const vs = vertices.map((vertex, index) => {
    const id = canonicalCarrier(sheafSourceField(vertex,"id"));
    const key = coincidenceKey(id);
    if (vertexIndex.has(key)) throw new RangeError("cellularSheaf: duplicate vertex id");
    vertexIndex.set(key, index);
    const dim = dimensionOf(sheafSourceField(vertex,"dim"), "a vertex dim");
    vertexOffsets.push(c0);
    c0 += dim;
    return Object.freeze({ id, dim });
  });
  const edgeKeys = new Set();
  const edgeOffsets = [];
  let c1 = 0;
  const from = [], to = [];
  const es = edges.map((edge) => {
    // Detached canonical source identities must agree with incidence indices
    // for the entire lifetime of this mathematical section receipt.
    const id = canonicalCarrier(sheafSourceField(edge,"id"));
    const fromId = canonicalCarrier(sheafSourceField(edge,"from")), toId = canonicalCarrier(sheafSourceField(edge,"to"));
    const key = coincidenceKey(id);
    if (edgeKeys.has(key)) throw new RangeError("cellularSheaf: duplicate edge id");
    edgeKeys.add(key);
    const fi = vertexIndex.get(coincidenceKey(fromId)), ti = vertexIndex.get(coincidenceKey(toId));
    if (fi === undefined || ti === undefined) throw new RangeError("cellularSheaf: an edge names a vertex that is not in the sheaf");
    const dim = dimensionOf(sheafSourceField(edge,"dim"), "an edge dim");
    const check = (matrix, vertexDim, side) => {
      if (!Array.isArray(matrix) || matrix.length !== dim) {
        throw new RangeError(`cellularSheaf: restriction ${side} of an edge must be ${dim} × ${vertexDim}`);
      }
      const rows = sheafSourceArray(matrix, "restriction " + side);
      const detachedRows = rows.map(row=>{
        if (!Array.isArray(row) || row.length !== vertexDim)
          throw new RangeError(`cellularSheaf: restriction ${side} of an edge must be ${dim} × ${vertexDim}`);
        return sheafSourceArray(row,"restriction row " + side);
      });
      // Exact Number retains the scalar mathematics; this source boundary
      // must additionally detach caller-owned rational records before any
      // later rank, coboundary or Matrix Market consumer can inspect them.
      // Inexact finite host floats keep their original numeric meaning.
      return freezeMatrix(detachedRows.map(row => row.map(sheafSourceScalar)));
    };
    const sourceRestrict = sheafSourceField(edge,"restrict");
    const restrict = Object.freeze({
      from: check(sheafSourceField(sourceRestrict,"from"), vs[fi].dim, "from"),
      to: check(sheafSourceField(sourceRestrict,"to"), vs[ti].dim, "to")
    });
    from.push(fi); to.push(ti);
    edgeOffsets.push(c1);
    c1 += dim;
    return Object.freeze({ id, from: fromId, to: toId, dim, restrict });
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

/** A finite numeric 0-cochain over vertex stalks, in vertex order.
 * The historical default mathematically extends absent values by zero;
 * no observer may interpret that default as a measured zero.
 * Observational receivers require { missing: "refuse" } and must supply one
 * independent measured value for every positive-dimensional source stalk.
 * Repeated identical readings are idempotent; disagreeing ones refuse.
 * Witnesses, source authority and FOUR remain with their original owners.
 */
export function cochain(sheaf, entries, options = {}) {
  const missing = sheafSourceField(options,"missing",true) ?? "zero";
  if (!["zero", "refuse"].includes(missing))
    throw new TypeError("cochain: missing policy must be zero or refuse");
  // Own one canonical index per admitted vertex rather than repeatedly
  // searching every stalk. The key is SignCell's coincidence identity, not
  // a copied serialization, string spelling or JavaScript object identity.
  const stalks = sheafSourceArray(sheafSourceField(sheaf,"vertices"),"cochain stalks");
  const offsets = sheafSourceArray(sheafSourceField(sheaf,"vertexOffsets"),"cochain offsets");
  const positions = new Map(stalks.map((v, i) => [coincidenceKey(sheafSourceField(v,"id")), i]));
  const out = new Array(sheafSourceField(sheaf,"c0")).fill(0);
  const seen = new Map();
  for (const entry of sheafSourceArray(entries,"cochain entries")) {
    const vertex = sheafSourceField(entry,"vertex");
    const value = sheafSourceField(entry,"value");
    const index = positions.get(coincidenceKey(vertex));
    if (index === undefined) throw new RangeError("cochain: unknown vertex");
    const values = Array.isArray(value) ? sheafSourceArray(value,"cochain values") : [value];
    if (values.length !== sheafSourceField(stalks[index],"dim")) throw new RangeError("cochain: value has the wrong dimension");
    if (values.some(v => typeof v !== "number" || !Number.isFinite(v)))
      throw new RangeError("cochain: stalk values must be finite numbers");
    if (seen.has(index)) {
      if (values.some((v, k) => v !== seen.get(index)[k]))
        throw new RangeError("cochain: conflicting duplicate vertex readings");
      continue;
    }
    seen.set(index, [...values]);
    values.forEach((v, k) => { out[offsets[index] + k] = v; });
  }
  if (missing === "refuse") {
    const missingCount = stalks.filter((v, i) => sheafSourceField(v,"dim") > 0 && !seen.has(i)).length;
    if (missingCount)
      throw new RangeError("cochain: incomplete observation omitted " + missingCount + " positive-dimensional stalks");
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
  return matrix.entries.map((row) => {
    let sum = 0;
    for (const [column, value] of row) {
      sum += numericProduct(value, x[column], "apply");
      if (!Number.isFinite(sum)) throw new RangeError("apply: numerical sum overflowed host arithmetic");
    }
    return sum;
  });
}

const gramLaplacian = (sheaf, entries) => {
  const rows = Array.from({ length: sheaf.c0 }, () => new Map());
  for (const row of entries) {
    for (const [i, a] of row) for (const [j, b] of row) {
      const value = (rows[i].get(j) ?? 0) + numericProduct(a, b, "cellularSheaf Gram");
      if (!Number.isFinite(value)) throw new RangeError("cellularSheaf: numerical Laplacian exceeded finite host arithmetic");
      rows[i].set(j, value);
    }
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
        const product = numericProduct(C[j][i], value, "weightedSheafLaplacian");
        const total = (row.get(column) ?? 0) + product;
        if (!Number.isFinite(total)) throw new RangeError("weightedSheafLaplacian: numerical sum overflowed host arithmetic");
        row.set(column, total);
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
    if (residual.some((value) => !Number.isFinite(value))) {
      throw new RangeError("weightedSheafDirichlet: numerical coboundary residual is not finite");
    }
    let edgeEnergy = 0;
    for (let i = 0; i < edge.dim; i += 1) {
      let value = 0;
      for (let j = i; j < edge.dim; j += 1) {
        value += numericProduct(C[j][i], residual[j], "weightedSheafDirichlet");
        if (!Number.isFinite(value)) throw new RangeError("weightedSheafDirichlet: numerical sum overflowed host arithmetic");
      }
      edgeEnergy += numericProduct(value, value, "weightedSheafDirichlet");
    }
    energy += edgeEnergy;
    if (!Number.isFinite(edgeEnergy) || !Number.isFinite(energy)) {
      throw new RangeError("weightedSheafDirichlet: numerical edge energy exceeded finite host arithmetic");
    }
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

/**
 * Construct an actual exact affine global section extending a finite set of
 * source-attributed local stalk coordinates on the original cellular sheaf.
 *
 * Unobserved coordinates remain free unknowns constrained by the sheaf's
 * restriction maps. The construction solves for a compatible global lift.
 *
 * Each edge contributes its δ⁰ restriction equations and each observed
 * coordinate contributes an exact equality. Data's rational solver returns
 * a particular section and its free directions, or a linear combination of
 * those rows proving that the observations cannot extend. The result retains
 * the cell identities and equation sources used in the calculation.
 */
export function extendCellularSheafSection(sheaf, observations = []) {
  if (sheaf?.kind !== "signgraph.cellularSheaf" ||
      !Array.isArray(sheaf.vertices) || !Array.isArray(sheaf.edges) ||
      sheaf.exact !== true)
    throw new TypeError("cellularSheaf extension needs an original exact rational sheaf");
  if (!Array.isArray(observations) || sheaf.c0 > 256 ||
      sheaf.c1 + observations.length > 256)
    throw new RangeError("cellularSheaf extension exceeds the exact 256-coordinate/equation envelope");
  const sites = new Map(sheaf.vertices.map((v,i) => [coincidenceKey(v.id), {
    vertex:v,index:i,offset:sheaf.vertexOffsets[i]
  }]));
  const measured = observations.map((row,i) => {
    if (!row || typeof row !== "object" || Array.isArray(row) ||
        Object.keys(row).some(key => !["vertex","coordinate","value","sourceRecord"].includes(key)))
      throw new TypeError("source-local section needs a typed source observation");
    const at=sites.get(coincidenceKey(row.vertex));
    if (!at || !Number.isSafeInteger(row.coordinate) ||
        row.coordinate < 0 || row.coordinate >= at.vertex.dim ||
        typeof row.sourceRecord !== "string" || !row.sourceRecord.trim() ||
        row.sourceRecord.length > 1024)
      throw new TypeError("source-local section needs one actual stalk coordinate and witness locator");
    const [numerator,denominator]=ratPairOfEntry(row.value);
    const column=at.offset+row.coordinate;
    return Object.freeze({
      vertex:at.vertex.id,coordinate:row.coordinate,
      value:denominator===1n?String(numerator):numerator+"/"+denominator,
      column,sourceRecord:row.sourceRecord,
      equationIndex:sheaf.c1+i,
    });
  });
  const differential=exactCoboundary(sheaf);
  const edgeEquationSources=sheaf.edges.flatMap((edge,e)=>
    Array.from({length:edge.dim},(_,coordinate)=>Object.freeze({
      equationIndex:sheaf.edgeOffsets[e]+coordinate,
      origin:"cellular-restriction",edge:edge.id,edgeCoordinate:coordinate
    })));
  const observedCoordinates=new Set(measured.map(row=>row.column));
  const coefficients=[
    ...differential,
    ...measured.map(row=>Array.from({length:sheaf.c0},(_,i)=>i===row.column?1:0))
  ];
  const rhs=[
    ...Array.from({length:sheaf.c1},()=>0),
    ...measured.map(row=>row.value)
  ];
  const answer=ratSolve(coefficients,rhs,{columns:sheaf.c0});
  const sourceRows=Object.freeze([
    ...edgeEquationSources,
    ...measured.map(x=>Object.freeze({equationIndex:x.equationIndex,
      origin:"source-observation",vertex:x.vertex,coordinate:x.coordinate,
      sourceRecord:x.sourceRecord}))
  ]);
  return Object.freeze({
    kind:"signgraph.cellularSheaf.sourceLocalExtension.v1",
    status:answer.status==="solution-family"?
      "mathematically-liftable":"mathematically-obstructed",
    sourceRows,
    observedCoordinateCount:measured.length,
    distinctObservedCoordinates:observedCoordinates.size,
    unobservedCoordinates:sheaf.c0-observedCoordinates.size,
    exactSection:answer.particular,
    extensionDirections:answer.kernelBasis,
    freeDimensions:answer.freeColumns.length,
    // The obstruction is a linear combination of sourceRows in order.
    obstruction:answer.obstruction,
    mathematicalAssay:"exact finite rational 1-skeleton restrictions",
  });
}


/**
 * Construct a finite genuine LOCAL-TO-GLOBAL section from an observed cover
 * of the same already-admitted exact cellular sheaf. A patch is a source's
 * COMPLETE stalk reading on its stated vertex subcomplex; it cannot silently
 * replace absent coordinates with zero or invent an unstated edge reading.
 *
 * The patch's source-induced subgraph has every original edge whose TWO
 * vertices appear in the patch. Its exact restriction equations must hold
 * before the patch counts as a section. A cover must jointly include every
 * original vertex and edge (not merely the vertex set). Only THEN are all
 * original local observations glued through the ONE original ratSolve-based
 * exact global extension. Incompatible overlaps produce an actual linear
 * combination of original equations and source observations.
 *
 * This computes finite rational descent on the supplied cellular chart.
 * A successful result contains the global section and its extension space;
 * a failed result identifies the incomplete cover or exact obstruction.
 *
 * patches: [{region,sourceRef,vertices:[{vertex,values:[rational,...]}]}]
 * Source owners, CAIRN rights and NI custody qualify patches BEFORE this
 * mathematical operation is invoked. Only original stalks/edges are used.
 */
export function glueCellularSheafPatches(sheaf, patches) {
  if(sheaf?.kind!=="signgraph.cellularSheaf" || sheaf.exact!==true ||
     !Array.isArray(sheaf.vertices) || !Array.isArray(sheaf.edges) ||
     !Array.isArray(patches) || patches.length<1 || patches.length>16 ||
     sheaf.c0>256 || sheaf.c1>256)
    throw new TypeError("cellularSheaf patch gluing requires a bounded existing exact source chart and source cover");

  const byVertex=new Map(sheaf.vertices.map(vertex=>[coincidenceKey(vertex.id),vertex]));
  const ids=new Set(),coveredVertices=new Set(),coveredEdges=new Set();
  const observations=[],localRegions=[];
  for(const [index,patch] of patches.entries()){
    if(!patch || typeof patch!=="object" || Array.isArray(patch) ||
       Object.keys(patch).some(key=>!["region","sourceRef","vertices"].includes(key)) ||
       typeof patch.region!=="string" || !/^[a-z][a-z0-9-]{0,95}$/u.test(patch.region) ||
       typeof patch.sourceRef!=="string" || !patch.sourceRef.trim() ||
       patch.sourceRef.length>1024 || !Array.isArray(patch.vertices) ||
       patch.vertices.length<1 || patch.vertices.length>sheaf.vertices.length)
      throw new TypeError("cellularSheaf patch needs named source, bounded region and actual local stalks");
    const id=JSON.stringify([patch.sourceRef,patch.region]);
    if(ids.has(id))throw new TypeError("cellularSheaf cover repeats one source region");
    ids.add(id);
    const selected=new Map(),localObservations=[];
    for(const reading of patch.vertices){
      if(!reading || typeof reading!=="object" || Array.isArray(reading) ||
         Object.keys(reading).some(k=>!["vertex","values"].includes(k)))
        throw new TypeError("cellularSheaf patch stalk needs one original vertex and its complete value vector");
      const key=coincidenceKey(reading.vertex),vertex=byVertex.get(key);
      if(!vertex || selected.has(key) || !Array.isArray(reading.values) ||
         reading.values.length!==vertex.dim)
        throw new TypeError("cellularSheaf patch repeats or omits an original stalk coordinate");
      selected.set(key,vertex);
      coveredVertices.add(key);
      for(const [coordinate,value] of reading.values.entries()){
        // The existing Data rational admission is the sole scalar validator:
        // a decimal floating approximation is not an exact source coordinate.
        const [numerator,denominator]=ratPairOfEntry(value);
        localObservations.push(Object.freeze({
          vertex:vertex.id,coordinate,
          value:denominator===1n?numerator.toString():numerator+"/"+denominator,
          sourceRecord:patch.sourceRef,
        }));
      }
    }
    const edges=sheaf.edges.filter(edge=>
      selected.has(coincidenceKey(edge.from))&&selected.has(coincidenceKey(edge.to)));
    for(const edge of edges)coveredEdges.add(coincidenceKey(edge.id));
    const localSheaf=cellularSheaf({
      vertices:[...selected.values()],edges,
    });
    if(localSheaf.c1+localObservations.length>256)
      throw new RangeError("cellularSheaf local patch exceeds exact source equation budget");
    const local=extendCellularSheafSection(localSheaf,localObservations);
    const region=Object.freeze({
      region:patch.region,sourceRef:patch.sourceRef,index,
      sourceVertices:Object.freeze([...selected.values()].map(x=>x.id)),
      sourceEdges:Object.freeze(edges.map(x=>x.id)),
      status:local.status,
      obstruction:local.status==="mathematically-obstructed"
        ?local.obstruction:null,
      sourceRows:local.status==="mathematically-obstructed"
        ?local.sourceRows:Object.freeze([]),
    });
    localRegions.push(region);
    observations.push(...localObservations);
    if(local.status==="mathematically-obstructed")return Object.freeze({
      kind:"signgraph.cellularSheaf.sourceCoverGluing.v1",
      status:"locally-obstructed",regions:Object.freeze(localRegions),
      failedRegion:patch.region,exactGlobalSection:null,
      obstruction:local.obstruction,sourceRows:local.sourceRows,
      mathematicalAssay:"induced 1-skeleton local sections and exact rational restrictions",
    });
  }
  const uncoveredVertices=sheaf.vertices
    .filter(vertex=>!coveredVertices.has(coincidenceKey(vertex.id)))
    .map(vertex=>vertex.id);
  const uncoveredEdges=sheaf.edges
    .filter(edge=>!coveredEdges.has(coincidenceKey(edge.id)))
    .map(edge=>edge.id);
  if(uncoveredVertices.length||uncoveredEdges.length)return Object.freeze({
    kind:"signgraph.cellularSheaf.sourceCoverGluing.v1",
    status:"incomplete-cover",regions:Object.freeze(localRegions),
    uncoveredVertices:Object.freeze(uncoveredVertices),
    uncoveredEdges:Object.freeze(uncoveredEdges),
    exactGlobalSection:null,
    mathematicalAssay:"induced 1-skeleton local sections and exact rational restrictions",
  });
  if(sheaf.c1+observations.length>256)
    throw new RangeError("cellularSheaf global patch gluing exceeds exact equation budget");
  const global=extendCellularSheafSection(sheaf,observations);
  return Object.freeze({
    kind:"signgraph.cellularSheaf.sourceCoverGluing.v1",
    status:global.status==="mathematically-liftable"?"globally-glued":"globally-obstructed",
    regions:Object.freeze(localRegions),
    uncoveredVertices:Object.freeze([]),uncoveredEdges:Object.freeze([]),
    exactGlobalSection:global.status==="mathematically-liftable"?global.exactSection:null,
    extensionDirections:global.extensionDirections,
    globalSourceRows:global.sourceRows,
    obstruction:global.obstruction,
    // Original observation indices in the global obstruction retain patch
    // source ref via sourceRecord; repeated observations are retained.
    mathematicalAssay:"induced 1-skeleton local sections and exact rational restrictions",
  });
}

/**
 * Fiberwise rational tensor of two to four cellular sheaves over the same
 * source-indexed 1-skeleton, with tensor products of vertex/edge stalks and
 * Kronecker products of their restriction maps.
 *
 * (F tensor G)(v) = F(v) tensor_Q G(v)
 * (F tensor G)(e) = F(e) tensor_Q G(e)
 * rho_(v,e) = rho_F(v,e) tensor rho_G(v,e).
 *
 * Factor source revisions remain explicit. The resulting cellular tensor
 * chart composes with exact section extension, cover gluing and pullback.
 */
export function tensorCellularSheaves(factors) {
  if (!Array.isArray(factors) || factors.length < 2 || factors.length > 4 ||
      factors.some(factor => factor?.sheaf?.kind !== "signgraph.cellularSheaf" ||
        factor.sheaf.exact !== true || typeof factor.sourceRef !== "string" ||
        !factor.sourceRef.trim()))
    throw new TypeError("cellularSheaf tensor requires 2..4 exact source-attributed factors");
  const source=factors[0].sheaf;
  // A sheaf's source identity is its witnessed vertex/edge incidence, not
  // its input-array enumeration. Multiple custodians may supply the same
  // lawful base chart in a different order. Align exact SignCell
  // coincidence keys rather than treating that order as physical geometry.
  const aligned=factors.map(factor=>{
    const other=factor.sheaf;
    if(other.vertices.length!==source.vertices.length ||
       other.edges.length!==source.edges.length)
      throw new RangeError("cellularSheaf tensor factors have different source graphs");
    const byVertex=new Map(other.vertices.map(vertex=>[coincidenceKey(vertex.id),vertex]));
    const byEdge=new Map(other.edges.map(edge=>[coincidenceKey(edge.id),edge]));
    const vertices=source.vertices.map(vertex=>byVertex.get(coincidenceKey(vertex.id)));
    if(vertices.some(vertex=>vertex===undefined))
      throw new RangeError("cellularSheaf tensor cannot silently reassign stalk source identities");
    const edges=source.edges.map(edge=>{
      const otherEdge=byEdge.get(coincidenceKey(edge.id));
      if(otherEdge===undefined ||
         coincidenceKey(otherEdge.from)!==coincidenceKey(edge.from) ||
         coincidenceKey(otherEdge.to)!==coincidenceKey(edge.to))
        throw new RangeError("cellularSheaf tensor requires the same oriented source incidence");
      return otherEdge;
    });
    return Object.freeze({
      vertices:Object.freeze(vertices),
      edges:Object.freeze(edges)
    });
  });
  const multiply = (left,right) => {
    const [a,b]=ratPairOfEntry(left),[c,d]=ratPairOfEntry(right);
    return rationalOfBigInts(a*c,b*d);
  };
  // Indexed tensor row order: (left row, right row); column order:
  // (left column, right column). No flattening of an arbitrary incidence
  // tensor into unrelated source records is permitted.
  const kron=(left,right)=>left.flatMap(aRow=>
    right.map(bRow=>aRow.flatMap(a=>bRow.map(b=>multiply(a,b)))));
  let product=source;
  for(const next of aligned.slice(1)){
    // Forecast tensor dimensions *before* allocating any Kronecker matrices.
    // For a large source-dimensional factor this prevents accidental
    // quadratic/cubic memory allocation before a late refusal.
    const vertexDims=product.vertices.map((v,i)=>v.dim*next.vertices[i].dim);
    const edgeDims=product.edges.map((edge,i)=>edge.dim*next.edges[i].dim);
    const totalVertices=vertexDims.reduce((n,dim)=>n+dim,0);
    const totalEdges=edgeDims.reduce((n,dim)=>n+dim,0);
    if(totalVertices>256 || totalEdges>256 ||
       !Number.isSafeInteger(totalVertices) || !Number.isSafeInteger(totalEdges))
      throw new RangeError("cellularSheaf tensor exceeds the bounded rational chart");
    const vertices=product.vertices.map((v,i)=>({
      id:v.id,dim:vertexDims[i]
    }));
    const edges=product.edges.map((edge,i)=>{
      const counterpart=next.edges[i];
      return {
        id:edge.id,from:edge.from,to:edge.to,
        dim:edgeDims[i],
        restrict:{
          from:kron(edge.restrict.from,counterpart.restrict.from),
          to:kron(edge.restrict.to,counterpart.restrict.to)
        }
      };
    });
    product=cellularSheaf({vertices,edges});
  }
  return Object.freeze({...product,
    tensor:Object.freeze({
      kind:"signgraph.cellularSheaf.stalkwiseTensor.v1",
      factors:Object.freeze(factors.map(f=>f.sourceRef)),
      base:"identical source-indexed oriented 1-skeleton",
      algebra:"exact rational stalk tensor with Kronecker restriction",
    })
  });
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

/** The degree-0 Hodge check: a free diffusion limit lies in ker L = ker δ⁰,
 *  hence is a global section whether or not H¹ vanishes. H¹ = coker δ⁰
 *  concerns degree-one cohomology, not an additional condition on H⁰.
 *  Numerically this reports residual-based approximate harmonicity, not a
 *  machine-checked proof of exact gluing. */
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


/**
 * Exact pullback of a cellular sheaf along an explicitly supplied,
 * incidence-preserving map of oriented 1-skeleta f : B -> G. It constructs
 * the pointwise inverse image f*F using the original stalks and restrictions.
 *
 * base={vertices:[id,...],edges:[{id,from,to},...]};
 * map={vertices:[{id,source},...],edges:[{id,source},...]};
 * Each original base cell has exactly one image of the SAME cell dimension.
 * Maps need not be injective; original source cell IDs never get rewritten.
 * An edge image must preserve both incident vertex images and orientation.
 *
 * This maps different source cell presentations onto the declared comparison
 * base for subsequent fiberwise tensor and exact section/gluing operations.
 * The supplied map selects cell identities and must preserve both endpoints
 * of each oriented edge.
 */
export function pullbackCellularSheaf(source, {base, map}={}) {
  if (source?.kind!=="signgraph.cellularSheaf" || source.exact!==true ||
      !base || typeof base!=="object" || Array.isArray(base) ||
      Object.keys(base).some(key=>!["vertices","edges"].includes(key)) ||
      !Array.isArray(base.vertices) || !Array.isArray(base.edges) ||
      base.vertices.length<1 || base.vertices.length>128 ||
      base.edges.length>256 || !map || typeof map!=="object" ||
      Array.isArray(map) || Object.keys(map).some(key=>!["vertices","edges"].includes(key)) ||
      !Array.isArray(map.vertices) || !Array.isArray(map.edges) ||
      map.vertices.length!==base.vertices.length ||
      map.edges.length!==base.edges.length)
    throw new TypeError("cellularSheaf pullback requires an exact source and bounded complete base-to-source cell map");

  const id=coincidenceKey;
  const srcVertices=new Map(source.vertices.map(v=>[id(v.id),v]));
  const srcEdges=new Map(source.edges.map(e=>[id(e.id),e]));
  const baseVertices=new Set(),baseEdges=new Set();
  for(const vertex of base.vertices) {
    const key=id(vertex);
    if(baseVertices.has(key))throw new TypeError("cellularSheaf pullback repeats a base vertex");
    baseVertices.add(key);
  }
  for(const edge of base.edges) {
    if(!edge || typeof edge!=="object" || Array.isArray(edge) ||
       Object.keys(edge).sort().join(",")!=="from,id,to" ||
       !baseVertices.has(id(edge.from)) || !baseVertices.has(id(edge.to)) ||
       baseEdges.has(id(edge.id)))
      throw new TypeError("cellularSheaf pullback needs one oriented original base edge and its endpoints");
    baseEdges.add(id(edge.id));
  }

  const admitted=(entries,baseKeys,sourceKeys,label)=>{
    const result=new Map();
    for(const row of entries) {
      if(!row || typeof row!=="object" || Array.isArray(row) ||
         Object.keys(row).sort().join(",")!=="id,source")
        throw new TypeError("cellularSheaf pullback needs exact "+label+" source cell images");
      const key=id(row.id), image=id(row.source);
      if(!baseKeys.has(key) || result.has(key) || !sourceKeys.has(image))
        throw new TypeError("cellularSheaf pullback has an unknown, duplicate, or missing "+label+" cell image");
      result.set(key,row.source);
    }
    if(result.size!==baseKeys.size)
      throw new TypeError("cellularSheaf pullback omits an original "+label+" cell image");
    return result;
  };
  const vertexImages=admitted(map.vertices,baseVertices,new Set(srcVertices.keys()),"vertex");
  const edgeImages=admitted(map.edges,baseEdges,new Set(srcEdges.keys()),"edge");
  const vertices=base.vertices.map(vertex=>{
    const original=srcVertices.get(id(vertexImages.get(id(vertex))));
    return {id:vertex,dim:original.dim};
  });
  const edges=base.edges.map(edge=>{
    const original=srcEdges.get(id(edgeImages.get(id(edge.id))));
    const mappedFrom=vertexImages.get(id(edge.from));
    const mappedTo=vertexImages.get(id(edge.to));
    if(id(mappedFrom)!==id(original.from) || id(mappedTo)!==id(original.to))
      throw new TypeError("cellularSheaf pullback edge must preserve exact oriented incidence of both source endpoints");
    return {id:edge.id,from:edge.from,to:edge.to,dim:original.dim,
      restrict:{from:original.restrict.from,to:original.restrict.to}};
  });
  const c0=vertices.reduce((total,vertex)=>total+vertex.dim,0);
  const c1=edges.reduce((total,edge)=>total+edge.dim,0);
  if(c0>256||c1>256 || !Number.isSafeInteger(c0) || !Number.isSafeInteger(c1))
    throw new RangeError("cellularSheaf pullback exceeds the bounded exact section dimension");
  const sheaf=cellularSheaf({vertices,edges});
  return Object.freeze({
    kind:"signgraph.cellularSheaf.pullback.v1",
    sheaf,
    baseVertices:Object.freeze([...base.vertices]),
    baseEdges:Object.freeze(base.edges.map(e=>e.id)),
    vertexImages:Object.freeze(base.vertices.map(vertex=>
      Object.freeze({id:vertex,source:vertexImages.get(id(vertex))}))),
    edgeImages:Object.freeze(base.edges.map(edge=>
      Object.freeze({id:edge.id,source:edgeImages.get(id(edge.id))}))),
    mathematicalScope:"strict oriented cellular 1-skeleton inverse image",
  });
}
