/**
 * SignGraph — the cohomology of cells read as a graph: the foam's wall graph.
 *
 * Each cell (s, p, o) is a 1-cell from entity s to entity o. The zeroth
 * coboundary δ⁰ : ℤ^entities → ℤ^cells is the incidence map, (δ⁰f)(s→o) =
 * f(o) − f(s). Its kernel H⁰ is the locally constant 0-cochains — one per
 * connected component, with the component indicators as basis — and its
 * cokernel H¹ has rank the cycle rank |cells| − |entities| + |components|, the
 * first Betti number: the cycles no 0-cochain bounds. Components are found by
 * union–find; nothing here needs linear algebra.
 *
 * This is GRAPH-ONLY H¹ of an already admitted predication-cell
 * 1-skeleton. It is not the H¹ of a proposed quotient-identification
 * nerve (whose redundant identifications are a separately counted
 * WIT/Quot.sound residual), nor the H¹ of an explicitly face-filled
 * cell complex or of an actual valued Čech sheaf. cellular2Complex
 * separately attaches genuine oriented faces with boundary²=0,
 * and an attachment can remove graph-only H¹.
 *
 * Formal Mark-origin ports and their source-identification witnesses
 * are distinct from physical manifold or foam geometry. Their earliest
 * finite bridge is SignCell formalBoundaryOfUtterance → SignGraph
 * mark-gluing → this cohomology consumer, not an independent Mark
 * identity imposed from already known space.
 */
import { charPoly, fromInts, rank, toCount, toInt } from "@red-cup-engineering/exact-number-data-service/exact-number";

/** The rank of an integer matrix of host numbers, exactly. */
const integerRank = (matrix) => (matrix.length === 0 ? 0 : toCount(rank(fromInts(matrix))));
/** The characteristic polynomial det(xI − A) of a host-integer matrix, highest degree first, exactly. */
const characteristicPolynomial = (matrix) => (matrix.length === 0 ? Object.freeze([1]) : Object.freeze(charPoly(fromInts(matrix)).map(toInt).reverse()));
import { coincides, coincidenceKey } from "@red-cup-engineering/signcell/cell";
import { sixfoldMotion, sixfoldIdentity, sixfoldCompose, sixfoldInverse } from "./paths.mjs";
import { readingOfRecord, record, sidesOfReading, topMass } from "@red-cup-engineering/computer-data-engineering-services-section/four";
import { coverNerve, h1Rank } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/coordination-cohomology";

const uniqueBy = (values, same) => {
  const out = [];
  for (const value of values) if (!out.some((item) => same(item, value))) out.push(value);
  return Object.freeze(out);
};

/** Whether two ranks are equal (a witness) or not (an obstruction). */
export const rankIdentity = (left, right) => Object.freeze({ kind: left === right ? "signgraph.rankIdentity:witness" : "signgraph.rankIdentity-obstruction", left, right });
/** Whether a rank vanishes. */
export const rankVanishing = (rank) => Object.freeze({ kind: rank === 0 ? "signgraph.rankVanishing:witness" : "signgraph.rankVanishing-obstruction", rank });
/** How two ranks compare. */
export const rankComparison = (left, right) => Object.freeze({ kind: `signgraph.rankComparison.${left === right ? "same" : left < right ? "below" : "above"}`, left, right });

/** The cohomology of a list of cells (any SignCells or triples) as a graph on their entities,
 *  with any further isolated entities. */
export function cohomologyOfCells(cells, extraEntities = []) {
  // This is a pure reading over original SignCell predication coordinates,
  // not a replacement content codec, authenticated source, or event log.
  // Once admitted, each own source position is inspected exactly once.
  const data = (value, role, required = true) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new TypeError("signgraph cohomology requires original source triples");
    const descriptor = Object.getOwnPropertyDescriptor(value, role);
    if (!descriptor) {
      if (!required) return undefined;
      throw new TypeError("signgraph cohomology is missing source " + role);
    }
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, "value"))
      throw new TypeError("signgraph cohomology source " + role + " must be inert data");
    return descriptor.value;
  };
  const entities = [], positions = new Map();
  const include = (term) => {
    // Exactly the same SignCell/SCA coincidence used by the typed Cell,
    // SignChain telling log and the original SignGraph oriented flow.
    const key = coincidenceKey(term);
    const found = positions.get(key);
    if (found !== undefined) return found;
    const index = entities.length;
    entities.push(term); positions.set(key, index);
    return index;
  };
  const originals = cells.map(value => {
    const subject = data(value, "subject");
    const predicate = data(value, "predicate", false);
    const object = data(value, "object");
    return Object.freeze({
      subject, predicate, object,
      sourceIndex: include(subject), targetIndex: include(object),
    });
  });
  for (const entity of extraEntities) include(entity);
  Object.freeze(entities);
  const incidence = Object.freeze(originals.map(value => {
    const row = entities.map(() => 0);
    row[value.targetIndex] += 1;
    row[value.sourceIndex] -= 1;
    return Object.freeze(row);
  }));
  const parent = entities.map((_, index) => index);
  const find = (index) => (parent[index] === index ? index : (parent[index] = find(parent[index])));
  for (const value of originals)
    parent[find(value.sourceIndex)] = find(value.targetIndex);
  const roots = [...new Set(entities.map((_, index) => find(index)))];
  const h1 = originals.length - entities.length + roots.length;
  return Object.freeze({
    kind: "signgraph.cohomology",
    entities,
    cells: Object.freeze(originals.map(value => Object.freeze({
      subject: value.subject, predicate: value.predicate, object: value.object,
    }))),
    incidence,
    zeroCohomology: Object.freeze({
      rank: roots.length,
      cocycleBasis: Object.freeze(roots.map(root => Object.freeze(
        entities.map((_, index) => find(index) === root ? 1 : 0)))),
    }),
    firstCohomology: Object.freeze({ rank: h1, vanishing: rankVanishing(h1) }),
  });
}

/** The cohomology of a valuation's cells (a SignCell cell set). */
export const cohomologyOfValuation = (valuation, extraEntities = []) => cohomologyOfCells(valuation, extraEntities);

/** The connected components of a cohomology reading: the entities of each H⁰ basis vector. */
export const componentsOf = (cohomology) => Object.freeze(cohomology.zeroCohomology.cocycleBasis.map((row) => Object.freeze(cohomology.entities.filter((_, index) => row[index] === 1))));

/** The cohomology of a plain graph given as nodes and [from, to] edges. */
export const cohomologyOfEdgeGraph = (nodes, edges) => cohomologyOfCells(edges.map(([from, to]) => ({ subject: from, predicate: "edge", object: to })), nodes);

/** The first Betti number of a list of cells. */
export const firstCohomologyRankOfCells = (cells, extraEntities = []) => cohomologyOfCells(cells, extraEntities).firstCohomology.rank;

// — the graph Laplacian of a cohomology reading —

const transpose = (matrix, columns) => Object.freeze(Array.from({ length: columns }, (_, j) => Object.freeze(matrix.map((row) => row[j]))));
const multiply = (left, right) => Object.freeze(left.map((row) => Object.freeze(right[0] === undefined ? [] : right[0].map((_, j) => {
  const value = row.reduce((sum, entry, k) => sum + entry * right[k][j], 0);
  if (!Number.isSafeInteger(value)) throw new RangeError("signgraph laplacian: an entry left the exact integer range");
  return value;
}))));

/** The graph Laplacian of a cohomology reading: L = Iᵀ·I over its incidence I (cells × entities), its
 *  characteristic polynomial, the ranks of I and L, and the rank identities H⁰ = |entities| − rank I and
 *  H¹ = |cells| − rank I. */
export function cohomologyLaplacian(cohomology) {
  const incidence = cohomology.incidence;
  const entityLaplacian = incidence.length === 0 ? Object.freeze([]) : multiply(transpose(incidence, cohomology.entities.length), incidence);
  const incidenceRank = integerRank(incidence);
  return Object.freeze({
    kind: "signgraph.laplacian",
    incidence,
    entityLaplacian,
    characteristicPolynomial: characteristicPolynomial(entityLaplacian),
    incidenceRank,
    laplacianRank: integerRank(entityLaplacian),
    zeroCohomologyKernelRank: rankIdentity(cohomology.zeroCohomology.rank, cohomology.entities.length - incidenceRank),
    firstCohomologyCokernelRank: rankIdentity(cohomology.firstCohomology.rank, cohomology.cells.length - incidenceRank),
  });
}

/** The cohomology receipt of a list of cells: H⁰ and H¹ ranks, H¹'s vanishing, and the Laplacian. */
export function cohomologyReceiptOfCells(cells, extraEntities = []) {
  const cohomology = cohomologyOfCells(cells, extraEntities);
  return Object.freeze({
    h0: cohomology.zeroCohomology.rank,
    h1: cohomology.firstCohomology.rank,
    vanishing: cohomology.firstCohomology.vanishing,
    laplacian: cohomologyLaplacian(cohomology),
  });
}

// — the cover nerve: Euler counts of a federated cover —

/** The cover nerve of a cohomology reading. */
export const coverNerveOfCohomology = (cohomology) => coverNerve(cohomology.entities.length, cohomology.cells.length, cohomology.zeroCohomology.rank);

// — the priced nerve of a federated cover (Obsmetrologia CurrencyCocone, QuantumContextuality) —

/** One source's contribution to a logical cell in a federated cover; its stance is the local section value. */
export const federatedCoverStatementSchema = Object.freeze({
  $id: "https://schemas.561.group/signgraph/federated-cover-statement.schema.json",
  title: "FederatedCoverStatement",
  description: "One source contribution to a logical cell in a federated cover; stance is the local section value.",
  type: "object",
  additionalProperties: false,
  required: ["source", "cell", "stance"],
  properties: {
    source: { type: "string", minLength: 1 },
    cell: { type: "string", minLength: 1 },
    stance: { type: "string", minLength: 1 },
    witness: { type: "string", minLength: 1 },
  },
});

/**
 * One cell of a federated cover, priced. Each source is a context and its local record tells each of
 * the cell's measurements true, false, both or neither (QuantumContextuality `localRecord`). A cell
 * read as a register holds one value, so each stance stated at it is a Boolean measurement "the cell
 * is this value": the source tells true of the stances it states and false of the rest. A cell read
 * as a claim is one measurement and each stance is a reading, the source's local record itself (its
 * readings joined in knowledge). The counting merge at a measurement is the record of the contexts
 * telling true and telling false (`mergeTally`); it is held ⊤ exactly when both tallies are positive
 * (`incons_iff_one_le_topMass`). The base is the context incidence: sources and measurements as
 * 0-cells, each source's incidence with each measurement it covers as a 1-cell.
 */
function pricedCell(cellName, group, readings) {
  // Index each local section ONCE, rather than re-filtering the whole
  // federation for every participating SSE (formerly quadratic per cell).
  const bySource = new Map();
  for (const { source, stance } of group) {
    let local = bySource.get(source);
    if (local === undefined) { local = []; bySource.set(source, local); }
    // A register is a partial FUNCTION source × cell → stance. Different
    // stances from one SSE are not independent opinions or gluing witnesses;
    // FOUR claims deliberately use readings mode instead.
    if (!readings && local.length > 0 && local[0] !== stance)
      throw new TypeError("signgraph: one source cannot assign two values to the same register cell");
    local.push(stance);
  }
  const sources = [...bySource.keys()].sort();
  const names = readings ? [cellName] : [...new Set(group.map((statement) => statement.stance))].sort();
  // Each source is one context, regardless of how often it repeated a stance.
  // Count its local record once and derive both tally legs without a second
  // sources × measurements scan (or quadratic repeated includes checks).
  const positives = new Map(names.map(name => [name, 0]));
  let negativeClaims = 0;
  if (readings) {
    for (const local of bySource.values()) {
      let forIt = false, againstIt = false;
      for (const name of local) {
        const [f, a] = sidesOfReading(name);
        forIt ||= f; againstIt ||= a;
      }
      if (forIt) positives.set(cellName, positives.get(cellName) + 1);
      if (againstIt) negativeClaims++;
    }
  } else {
    for (const local of bySource.values()) {
      const name = local[0]; // single-valued by the admission above
      positives.set(name, positives.get(name) + 1);
    }
  }
  const measurements = Object.freeze(names.map(name => {
    const trueCount = positives.get(name);
    const falseCount = readings ? negativeClaims : sources.length - trueCount;
    const tally = record(trueCount, falseCount);
    return Object.freeze({ measurement: name, record: tally, reading: readingOfRecord(tally), mass: topMass(tally) });
  }));
  const top = measurements.filter((measurement) => measurement.mass > 0).length;
  const mass = measurements.reduce((sum, measurement) => sum + measurement.mass, 0);
  const base = coverNerve(sources.length + names.length, sources.length * names.length, 1);
  return Object.freeze({ kind: "signgraph.pricedCell", cell: cellName, sources: Object.freeze(sources), measurements, top, mass, rank: h1Rank(base), base });
}

/**
 * The priced nerve of a federated cover: the currency legs CurrencyCocone `PricedNerve` reads over one
 * cover, each read here from the statements and none stated.
 *
 * - `top`, leg d: the held-⊤ measurements of the merge (`topCount` of `mergeRecord`). It vanishes exactly
 *   when the sources agree on every shared measurement (`mergeRecord_topfree_iff_compatible`), and a
 *   compatible family glues to the merge's readout (section G): zero is coordination-free at the level of
 *   values, not only of the nerve.
 * - `mass`, d with multiplicity: the counting merge's contradiction mass (`massSum`), never below `top`
 *   (`topCount_le_massSum`). The difference is the multiplicity the idempotent join erases. Dissent from
 *   the majority readout is bounded by it (`dissent_majority_le_topMass`), so it is the price of settling.
 * - `rank`, leg b: the cycle rank of the base context incidence (`CoverNerve.H1rank`). It bounds the least
 *   price a parity model can reach, not the price a given family pays, so it is reported beside the
 *   prices and never ordered against them here.
 *
 * The mint and jump legs (c) and the causal leg (e) need the settling flow and the causal order of the
 * statements, which a statement list does not carry; the colimit, max(mass, causal), is therefore read
 * here only from below, by the mass. With `readings`, every cell is a claim and every stance a reading
 * name; otherwise every cell is a register and every stance one of its values.
 */
export function pricedNerve(statements, { readings = false } = {}) {
  if (!Array.isArray(statements)) throw new TypeError("signgraph: a cover must be an array of witnessed source statements");
  const byCell = new Map();
  for (const statement of statements) {
    // Enforce the existing FederatedCoverStatement carrier before interpreting
    // a claim as a sovereign local section. An absent source is NOT a
    // contributor named "undefined", nor is an absent stance an agreement.
    if (statement === null || typeof statement !== "object" || Array.isArray(statement)
        || ["source", "cell", "stance"].some(key =>
          typeof statement[key] !== "string" || statement[key].length === 0)
        || (statement.witness !== undefined &&
          (typeof statement.witness !== "string" || statement.witness.length === 0))
        || Object.keys(statement).some(key => !["source", "cell", "stance", "witness"].includes(key)))
      throw new TypeError("signgraph: invalid federated source/cell/stance statement");
    // The same cell can have many independent witnesses. Append in O(1)
    // instead of cloning its growing history on every arrival (quadratic).
    let group = byCell.get(statement.cell);
    if (group === undefined) { group = []; byCell.set(statement.cell, group); }
    group.push(statement);
  }
  const cells = [...byCell.entries()].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)).map(([cellName, group]) => pricedCell(cellName, group, readings));
  const obstructions = Object.freeze(cells.filter((entry) => entry.top > 0));
  const sum = (leg) => cells.reduce((total, entry) => total + entry[leg], 0);
  const top = sum("top");
  return Object.freeze({
    kind: "signgraph.pricedNerve",
    top,
    mass: sum("mass"),
    rank: sum("rank"),
    vanishing: rankVanishing(top),
    cells: Object.freeze(obstructions.map((entry) => entry.cell)),
    obstructions,
  });
}

/**
 * The finite cover nerve of a link graph: vertices are the distinct nodes (case-folded paths,
 * first spelling kept), links are read undirected and deduplicated, and dangling links and
 * self-links are dropped. The nerve is read off the graph's own cohomology
 * (`cohomologyOfEdgeGraph`): vertices, edges, and connected components.
 * @param {string[]} nodes
 * @param {Array<{from: string, to: string}>} links
 */
export function linkGraphNerve(nodes, links) {
  const byKey = new Map();
  for (const node of nodes) { const key = node.toLowerCase(); if (!byKey.has(key)) byKey.set(key, node); }
  const edges = new Set(), pairs = [];
  for (const { from, to } of links) {
    const source = byKey.get(from.toLowerCase()), target = byKey.get(to.toLowerCase());
    if (source === undefined || target === undefined || source === target) continue;
    const [left, right] = source < target ? [source, target] : [target, source];
    const key = `${left}\u0000${right}`;
    if (edges.has(key)) continue;
    edges.add(key); pairs.push([left, right]);
  }
  const graph = cohomologyOfEdgeGraph([...byKey.values()], pairs);
  return coverNerve(graph.entities.length, graph.cells.length, graph.zeroCohomology.rank);
}


/**
 * A cellular two-complex, not merely the graph of its one-skeleton.
 *
 * C0 --δ0--> C1 --δ1--> C2 over the integers, with δ1δ0 = 0
 * checked before any cohomology is reported. Each oriented 2-cell is
 * a closed, composable edge walk; reversing an edge uses direction -1.
 * Repetition is allowed (genuine attaching maps may wind), but every
 * intermediate vertex must match the preceding oriented endpoint.
 *
 * Exact rational ranks calculate b0=V-rank δ0,
 * b1=E-rank δ0-rank δ1, b2=F-rank δ1. A graph-only cycle is NOT an
 * H1 obstruction when an actual 2-face fills it.
 */
export function cellular2Complex({ vertices, edges, faces }) {
  if (![vertices, edges, faces].every(Array.isArray))
    throw new TypeError("cellular2Complex: vertices, edges and faces must be arrays");

  const uniqueIndices = (values, label) => {
    const index = new Map();
    values.forEach((id, i) => {
      if (id === null || id === undefined)
        throw new TypeError(`cellular2Complex: missing ${label} identity`);
      const key = coincidenceKey(id);
      if (index.has(key))
        throw new RangeError(`cellular2Complex: duplicate ${label} identity`);
      index.set(key, i);
    });
    return index;
  };
  const vIndex = uniqueIndices(vertices, "vertex");
  const eIndex = uniqueIndices(edges.map(e => e?.id), "edge");
  uniqueIndices(faces.map(f => f?.id), "face");

  const edgeList = edges.map(edge => {
    if (!edge || typeof edge !== "object")
      throw new TypeError("cellular2Complex: an edge must be an object");
    const from = vIndex.get(coincidenceKey(edge.from));
    const to = vIndex.get(coincidenceKey(edge.to));
    if (from === undefined || to === undefined)
      throw new RangeError("cellular2Complex: an edge has an unknown endpoint");
    return Object.freeze({ id: edge.id, from: edge.from, to: edge.to, fromIndex: from, toIndex: to });
  });
  // Rows of δ0: oriented edge difference f(to) - f(from).
  const edgeCoboundary = edgeList.map(({ fromIndex, toIndex }) => {
    const row = new Array(vertices.length).fill(0);
    row[fromIndex] -= 1; row[toIndex] += 1;
    return Object.freeze(row);
  });

  const faceList = [];
  const faceCoboundary = faces.map(face => {
    if (!face || !Array.isArray(face.boundary) || face.boundary.length === 0)
      throw new TypeError("cellular2Complex: a face requires a nonempty oriented edge walk");
    let first, previous;
    const boundary = face.boundary.map((step, i) => {
      const e = eIndex.get(coincidenceKey(step?.edge));
      if (e === undefined || (step.direction !== 1 && step.direction !== -1))
        throw new TypeError("cellular2Complex: a face step requires a known edge and sign ±1");
      const start = step.direction === 1 ? edgeList[e].fromIndex : edgeList[e].toIndex;
      const end = step.direction === 1 ? edgeList[e].toIndex : edgeList[e].fromIndex;
      if (i === 0) first = start;
      else if (previous !== start)
        throw new RangeError("cellular2Complex: oriented face walk has a disconnected step");
      previous = end;
      return Object.freeze({ edge: edgeList[e].id, edgeIndex: e, direction: step.direction });
    });
    if (previous !== first)
      throw new RangeError("cellular2Complex: oriented face walk is not closed");
    const row = new Array(edges.length).fill(0);
    for (const step of boundary) row[step.edgeIndex] += step.direction;
    faceList.push(Object.freeze({ id: face.id, boundary: Object.freeze(boundary) }));
    return Object.freeze(row);
  });

  // The attaching maps must really form a chain complex, not merely have
  // plausible dimensions. Check every entry of δ1δ0 before taking ranks.
  for (const row of faceCoboundary)
    for (let v = 0; v < vertices.length; v++) {
      const boundarySquared = row.reduce((s, value, e) => s + value * edgeCoboundary[e][v], 0);
      if (boundarySquared !== 0)
        throw new RangeError("cellular2Complex: boundary squared is not zero");
    }

  const r0 = integerRank(edgeCoboundary);
  const r1 = integerRank(faceCoboundary);
  const h0 = vertices.length - r0;
  const h1 = edges.length - r0 - r1;
  const h2 = faces.length - r1;
  if ([h0, h1, h2].some(h => h < 0))
    throw new RangeError("cellular2Complex: inconsistent exact chain ranks");

  // Sum of oriented faces: an actual 2-cycle iff every edge coefficient
  // cancels. This generalizes the J26 orientation witness, without assuming
  // it for other inputs or mistaking it for physical Burgers holonomy.
  const totalFaceBoundary = Object.freeze(edges.map((_, e) =>
    faceCoboundary.reduce((s, row) => s + row[e], 0)));

  return Object.freeze({
    kind: "signgraph.cellular2Complex",
    vertices: Object.freeze([...vertices]),
    edges: Object.freeze(edgeList),
    faces: Object.freeze(faceList),
    coboundary: Object.freeze({
      zero: Object.freeze(edgeCoboundary),
      one: Object.freeze(faceCoboundary),
    }),
    rank: Object.freeze({ zero: r0, one: r1 }),
    betti: Object.freeze({ h0, h1, h2 }),
    graphOnlyH1: edges.length - r0,
    totalFaceBoundary,
    totalFaceBoundaryCloses: totalFaceBoundary.every(value => value === 0),
    vanishing: rankVanishing(h1),
  });
}

/**
 * Translational Burgers readout of an integral Z² edge 1-cochain.
 * δ1b is its *local* face closure residue. When δ1b=0, b may still
 * represent a nonzero H1 class: a global cycle with no local defect.
 *
 * A spanning-forest potential is constructed from the same admitted edges.
 * Its residual is zero on every edge iff b=δ0φ; this witnesses exactness,
 * rather than inferring it from ranks alone. Its chosen root gauge is 0.
 * The exact integer carrier refuses values/results outside safe JSON
 * integers; irrational, rotating or incommensurate frames require a
 * separately specified affine transport, NOT a fabricated lattice vector.
 */
/**
 * Extend the existing oriented 2-complex by actual oriented 3-cell boundaries.
 *
 * Each volume specifies an integral 2-chain of previously admitted faces.
 * δ²δ¹=0 is checked as a non-negotiable chain-law admission condition.
 * This alone does not prove that an attaching map is an embedded ball,
 * orientable manifold or a physical gyrobifastigium: those are different
 * qualification obligations. It DOES distinguish the J26 exterior sphere
 * (b₂=1) from its filled 3-cell (b₂=0, b₃=0).
 */
export function cellular3Complex({ vertices, edges, faces, volumes }) {
  if (!Array.isArray(volumes))
    throw new TypeError("cellular3Complex: volumes must be an array");
  const surface = cellular2Complex({ vertices, edges, faces });
  const faceIndex = new Map(surface.faces.map((face, index) => [coincidenceKey(face.id), index]));
  const seen = new Set();
  const volumeList = [];
  const rows = volumes.map(volume => {
    if (volume === null || typeof volume !== "object" || Array.isArray(volume) ||
        volume.id === null || volume.id === undefined ||
        !Array.isArray(volume.boundary) || volume.boundary.length === 0)
      throw new TypeError("cellular3Complex: a volume needs an identity and nonempty oriented face boundary");
    const id = coincidenceKey(volume.id);
    if (seen.has(id)) throw new RangeError("cellular3Complex: duplicate volume id");
    seen.add(id);
    const row = new Array(surface.faces.length).fill(0);
    const boundary = volume.boundary.map(step => {
      const index = faceIndex.get(coincidenceKey(step?.face));
      if (index === undefined || (step.direction !== 1 && step.direction !== -1))
        throw new TypeError("cellular3Complex: an oriented volume step needs a known face and sign ±1");
      row[index] += step.direction;
      if (!Number.isSafeInteger(row[index]))
        throw new RangeError("cellular3Complex: an incidence coefficient exceeded exact integer range");
      return Object.freeze({ face: surface.faces[index].id, faceIndex: index, direction: step.direction });
    });
    // δ²δ¹=0, the discrete Stokes/Bianchi law, before claiming a complex.
    for (let e = 0; e < surface.edges.length; e++) {
      const residue = row.reduce((sum, coeff, f) =>
        sum + BigInt(coeff) * BigInt(surface.coboundary.one[f][e]), 0n);
      if (residue !== 0n)
        throw new RangeError("cellular3Complex: volume boundary is not a closed oriented 2-chain");
    }
    volumeList.push(Object.freeze({ id: volume.id, boundary: Object.freeze(boundary) }));
    return Object.freeze(row);
  });
  const r2 = integerRank(rows);
  const h2 = surface.betti.h2 - r2, h3 = volumes.length - r2;
  if (h2 < 0 || h3 < 0)
    throw new RangeError("cellular3Complex: inconsistent exact cellular ranks");
  return Object.freeze({
    ...surface,
    kind: "signgraph.cellular3Complex",
    volumes: Object.freeze(volumeList),
    coboundary: Object.freeze({ ...surface.coboundary, two: Object.freeze(rows) }),
    rank: Object.freeze({ ...surface.rank, two: r2 }),
    surfaceBetti: surface.betti,
    betti: Object.freeze({ ...surface.betti, h2, h3 }),
  });
}

export function burgersOfComplex(complex, edgeDisplacements) {
  if (!["signgraph.cellular2Complex", "signgraph.cellular3Complex"].includes(complex?.kind) ||
      !Array.isArray(edgeDisplacements) ||
      edgeDisplacements.length !== complex.edges.length)
    throw new TypeError("burgersOfComplex: require an admitted complex and one vector per oriented edge");
  // A 2D Eisenstein plane and a 3D lattice are both legitimate *integer*
  // translational carriers. The latter is NOT a Euclidean embedding of J26.
  const dimension = edgeDisplacements[0]?.length ?? 2;
  if (dimension !== 2 && dimension !== 3)
    throw new TypeError("burgersOfComplex: an exact Burgers vector has two or three coordinates");
  const values = edgeDisplacements.map(vector => {
    if (!Array.isArray(vector) || vector.length !== dimension ||
        !vector.every(Number.isSafeInteger))
      throw new TypeError("burgersOfComplex: every edge requires an exact safe-integer lattice vector of the same dimension");
    return vector.map(BigInt);
  });
  const safe = n => {
    if (n > BigInt(Number.MAX_SAFE_INTEGER) || n < BigInt(Number.MIN_SAFE_INTEGER))
      throw new RangeError("burgersOfComplex: a vector coordinate left the safe integer range");
    return Number(n);
  };
  const output = vector => Object.freeze(vector.map(safe));
  const zero = () => Array.from({ length: dimension }, () => 0n);
  const flat = vector => vector.every(v => v === 0n);
  const sumScaled = (left, n, right) => left.map((v, j) => v + n * right[j]);

  // Preserve the *unrounded* exact charge internally all the way to
  // volume Bianchi receiving. An unbounded charge is refused when exported,
  // never silently truncated to host-number arithmetic.
  const faceValues = complex.faces.map((_, f) =>
    complex.coboundary.one[f].reduce((v, coeff, e) =>
      sumScaled(v, BigInt(coeff), values[e]), zero()));
  const faces = complex.faces.map((face, f) => Object.freeze({
    id: face.id, burgers: output(faceValues[f]), flat: flat(faceValues[f]),
  }));
  const localFlat = faces.every(face => face.flat);

  const adjacent = complex.vertices.map(() => []);
  complex.edges.forEach(({ fromIndex, toIndex }, e) => {
    adjacent[fromIndex].push({ neighbor: toIndex, edge: e, sign: 1n });
    adjacent[toIndex].push({ neighbor: fromIndex, edge: e, sign: -1n });
  });
  const potential = complex.vertices.map(() => null);
  for (let root = 0; root < potential.length; root++) {
    if (potential[root] !== null) continue;
    potential[root] = zero();
    const queue = [root];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor];
      for (const { neighbor, edge, sign } of adjacent[current]) {
        if (potential[neighbor] !== null) continue;
        potential[neighbor] = sumScaled(potential[current], sign, values[edge]);
        queue.push(neighbor);
      }
    }
  }
  const cycles = complex.edges.map(({ id, fromIndex, toIndex }, e) => {
    const residual = potential[fromIndex].map((v, j) =>
      potential[toIndex][j] - v - values[e][j]);
    return Object.freeze({ edge: id, burgers: output(residual), flat: flat(residual) });
  });
  const exact = cycles.every(cycle => cycle.flat);
  const totalFaceBurgers = output(faceValues.reduce((acc, value) => sumScaled(acc, 1n, value), zero()));

  // The signed sum of each volume's face-level Burgers residues must
  // vanish by δ²δ¹=0, even if individual faces are strongly defective.
  // A zero volume balance is NOT a claim that all local faces are flat.
  const volumeResidues = complex.kind === "signgraph.cellular3Complex"
    ? complex.volumes.map((volume, index) => {
        const residual = complex.coboundary.two[index].reduce(
          (acc, coeff, f) => sumScaled(acc, BigInt(coeff), faceValues[f]), zero());
        return Object.freeze({ id: volume.id, burgers: output(residual), flat: flat(residual) });
      })
    : [];
  const volumeConservation = Object.freeze({
    applicable: complex.kind === "signgraph.cellular3Complex",
    holds: volumeResidues.every(volume => volume.flat),
  });

  return Object.freeze({
    kind: "signgraph.burgers",
    dimension,
    classification: !localFlat ? "local-defect" : !exact ? "global-holonomy" : "exact",
    localFlat,
    exact,
    nontrivialGlobalClass: localFlat && !exact,
    faceResidues: Object.freeze(faces),
    cycleResidues: Object.freeze(cycles.filter(cycle => !cycle.flat)),
    potential: Object.freeze(potential.map(output)),
    totalFaceBurgers,
    conservation: Object.freeze({
      applicable: complex.totalFaceBoundaryCloses,
      holds: !complex.totalFaceBoundaryCloses ||
        totalFaceBurgers.every(value => value === 0),
    }),
    volumeResidues: Object.freeze(volumeResidues),
    volumeConservation,
  });
}

/**
 * The same admitted two-complex can transport full sixfold affine frames.
 * Rotation and translation compose noncommutatively. In particular, a
 * rotational disclination cannot be measured by summing edge translations.
 *
 * Each oriented edge supplies its C6 ⋉ Z² transform. A reversed face
 * traversal uses the exact group inverse; a face's ordered word is its
 * local affine holonomy. Tree-gauge cycle receipts give global transport
 * obstructions only when every face's affine holonomy is trivial.
 *
 * The translational Burgers readout above is the abelian/zero-rotation
 * restriction. A nonzero rotation has no gauge-invariant standalone
 * translation component without choosing the reference frame.
 */
export function affineHolonomyOfComplex(complex, edgeMotions) {
  if (!["signgraph.cellular2Complex", "signgraph.cellular3Complex"].includes(complex?.kind) ||
      !Array.isArray(edgeMotions) || edgeMotions.length !== complex.edges.length)
    throw new TypeError("affineHolonomyOfComplex: require an admitted two-complex and one motion per edge");
  const motions = edgeMotions.map(g => sixfoldMotion(g?.rotation, g?.translation));
  const flat = g => g.rotation === 0 && g.translation[0] === 0 && g.translation[1] === 0;
  const compose = (word) => word.reduce(sixfoldCompose, sixfoldIdentity());
  const faces = complex.faces.map(face => {
    const holonomy = compose(face.boundary.map(step =>
      step.direction === 1 ? motions[step.edgeIndex] : sixfoldInverse(motions[step.edgeIndex])));
    return Object.freeze({ id: face.id, holonomy, flat: flat(holonomy) });
  });
  const localFlat = faces.every(face => face.flat);

  const adjacent = complex.vertices.map(() => []);
  complex.edges.forEach(({ fromIndex, toIndex }, e) => {
    adjacent[fromIndex].push({ neighbor: toIndex, motion: motions[e] });
    adjacent[toIndex].push({ neighbor: fromIndex, motion: sixfoldInverse(motions[e]) });
  });
  const potential = complex.vertices.map(() => null);
  for (let root = 0; root < potential.length; root++) {
    if (potential[root] !== null) continue;
    potential[root] = sixfoldIdentity();
    const queue = [root];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const at = queue[cursor];
      for (const { neighbor, motion } of adjacent[at]) {
        if (potential[neighbor] !== null) continue;
        potential[neighbor] = sixfoldCompose(potential[at], motion);
        queue.push(neighbor);
      }
    }
  }
  // Root-based loop: tree(root→from) · edge(from→to) · tree(to→root).
  // A nontrivial loop need not be pure translation, and at nontrivial
  // face holonomy the cycle readout is NOT a cohomology class.
  const cycles = complex.edges.map(({ id, fromIndex, toIndex }, e) => {
    const holonomy = sixfoldCompose(
      sixfoldCompose(potential[fromIndex], motions[e]),
      sixfoldInverse(potential[toIndex]));
    return Object.freeze({ edge: id, holonomy, flat: flat(holonomy) });
  });
  const exact = cycles.every(cycle => cycle.flat);
  return Object.freeze({
    kind: "signgraph.affineHolonomy",
    classification: !localFlat ? "local-affine-defect" :
      !exact ? "global-affine-holonomy" : "affine-flat",
    localFlat,
    exact,
    nontrivialGlobalMonodromy: localFlat && !exact,
    faceHolonomies: Object.freeze(faces),
    cycleHolonomies: Object.freeze(cycles.filter(cycle => !cycle.flat)),
    potential: Object.freeze(potential),
  });
}
