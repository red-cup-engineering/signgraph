/**
 * A cellular sheaf on an admitted oriented 2-complex, over exact Q.
 *
 * This is not the ordinary cellular cohomology of the underlying graph:
 * each cell owns a stalk, each incidence a (possibly non-identity) restriction.
 * The two maps C^0 --d0--> C^1 --d1--> C^2 are built from these maps, and
 * d1*d0=0 is required before any cohomology class is reported.
 *
 * Cells and the cover are supplied by a source. No face, witness, or
 * inclusion is invented from a drawn line or an unordered relation.
 */
import { canonicalCarrier, coincidenceKey } from '@red-cup-engineering/signcell/cell';
import { cellular2Complex } from './cohomology.mjs';
import { cellularSheaf } from './cellular-sheaf.mjs';
import { ratPairOfEntry, ratRank } from '@red-cup-engineering/exact-number-data-service/rational-matrix';
import { rationalOfBigInts, ratZero, ratAdd, ratMultiply, ratNegate, ratIsZero, rationalParts } from '@red-cup-engineering/exact-number-data-service/exact-number';
import { rationalToFiniteNumber } from '@red-cup-engineering/exact-number-data-service/exact-number-host';

// Matrix exchange is a capability of actually admitted in-process cochain
// readings; JSON-shaped forged structs cannot turn into certified operators.
const admittedReadings = new WeakSet();
const rational = entry => rationalOfBigInts(...ratPairOfEntry(entry));
const fraction = value => {
  const [num, den] = rationalParts(value);
  return `${num}/${den}`;
};
const matrixOf = (rows, cols) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => ratZero));
const nonnegative = (n, label) => {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`cellular2Sheaf: invalid ${label}`);
  return n;
};
const basisOf = (items) => Object.freeze(items.flatMap(({ id, dim }) =>
  Array.from({ length: dim }, (_, coordinate) => Object.freeze({ cell: id, coordinate }))));
const frozenRows = rows => Object.freeze(rows.map(row => Object.freeze(row.map(fraction))));

/**
 * @param {object} input
 * @param {{id:unknown,dim:number}[]} input.vertices - degree-0 stalks
 * @param {{id:unknown,from:unknown,to:unknown,dim:number,restrict:{from:unknown[][],to:unknown[][]}}[]} input.edges - degree-1 stalks and maps from endpoints
 * @param {{id:unknown,dim:number,boundary:{edge:unknown,direction:1|-1,restrict:unknown[][]}[]}[]} input.faces - degree-2 stalks with a map FROM each incidence edge TO the face
 * @returns admitted complex, exact matrices, rational cohomology, and cell basis labels
 */
export function cellular2Sheaf({ vertices, edges, faces }) {
  if (![vertices, edges, faces].every(Array.isArray))
    throw new TypeError('cellular2Sheaf: vertices, edges, faces must be arrays');
  const sheaf = cellularSheaf({ vertices, edges });
  if (!sheaf.exact) throw new RangeError('cellular2Sheaf: all restrictions must be exact rational entries');
  // Read original face/edge identities ONCE through the same SignCell content
  // owner as vertex/edge stalk IDs. Otherwise the returned complex, native
  // basis and Matrix Market receipt could disagree after caller mutation.
  const sourceFaces = faces.map(face => ({
    id: canonicalCarrier(face.id), dim: face.dim,
    boundary: face.boundary.map(step => ({
      edge: canonicalCarrier(step.edge),
      direction: step.direction,
      restrict: step.restrict,
    })),
  }));
  const complex = cellular2Complex({
    vertices: sheaf.vertices.map(v => v.id),
    edges: sheaf.edges.map(e => ({ id: e.id, from: e.from, to: e.to })),
    faces: sourceFaces.map(f => ({ id: f.id, boundary: f.boundary.map(step => ({ edge: step.edge, direction: step.direction })) })),
  });
  const edgeIndex = new Map(sheaf.edges.map((edge, i) => [coincidenceKey(edge.id), i]));
  let c2 = 0;
  const faceOffsets = [];
  const admittedFaces = sourceFaces.map((face, index) => {
    const dim = nonnegative(face.dim, 'face stalk dimension');
    faceOffsets.push(c2);
    c2 += dim;
    if (!Number.isSafeInteger(c2)) throw new RangeError('cellular2Sheaf: C2 dimension overflow');
    const boundary = face.boundary.map((step, j) => {
      const e = edgeIndex.get(coincidenceKey(step.edge));
      const width = sheaf.edges[e].dim;
      if (!Array.isArray(step.restrict) || step.restrict.length !== dim ||
          !step.restrict.every(row => Array.isArray(row) && row.length === width))
        throw new RangeError(`cellular2Sheaf: face ${index} incidence ${j} needs ${dim} x ${width} restriction`);
      return Object.freeze({ edge: step.edge, direction: step.direction,
        restrict: frozenRows(step.restrict.map(row => row.map(rational))) });
    });
    return Object.freeze({ id: face.id, dim, boundary: Object.freeze(boundary) });
  });
  // A zero composite alone does not make a cellular sheaf: on non-regular
  // attaching walks, different incidence paths can cancel in d1*d0 while
  // disagreeing as restriction maps. Admit the *poset* functoriality law
  // at every face: the edge→face map is unique for each (edge,face)
  // and every vertex→edge→face composite is independent of the edge.
  const compose = (faceMap, edgeMap, vertexDimension) => faceMap.map(row =>
    Array.from({ length: vertexDimension }, (_, j) => {
      let sum = ratZero;
      row.forEach((entry, k) => {
        sum = ratAdd(sum, ratMultiply(rational(entry), rational(edgeMap[k][j])));
      });
      return fraction(sum);
    }));
  for (const face of admittedFaces) {
    const byEdge = new Map(), byVertex = new Map();
    for (const step of face.boundary) {
      const e = edgeIndex.get(coincidenceKey(step.edge));
      const edge = sheaf.edges[e];
      const eid = coincidenceKey(edge.id), map = JSON.stringify(step.restrict);
      if (byEdge.has(eid) && byEdge.get(eid) !== map)
        throw new RangeError('cellular2Sheaf: ambiguous edge-to-face restriction for repeated incidence');
      byEdge.set(eid, map);
      for (const [side, vertexIndex] of [['from', sheaf.fromIndex[e]], ['to', sheaf.toIndex[e]]]) {
        const vid = coincidenceKey(sheaf.vertices[vertexIndex].id);
        const path = JSON.stringify(compose(step.restrict, edge.restrict[side], sheaf.vertices[vertexIndex].dim));
        if (byVertex.has(vid) && byVertex.get(vid) !== path)
          throw new RangeError('cellular2Sheaf: noncommuting restriction diagram at vertex-to-face paths');
        byVertex.set(vid, path);
      }
    }
  }
  const zero = matrixOf(sheaf.c1, sheaf.c0);
  sheaf.edges.forEach((edge, e) => {
    for (const [side, vertexIndex, sign] of [['from', sheaf.fromIndex[e], -1], ['to', sheaf.toIndex[e], 1]]) {
      const offset = sheaf.vertexOffsets[vertexIndex];
      edge.restrict[side].forEach((row, i) => row.forEach((entry, j) => {
        const k = sheaf.edgeOffsets[e] + i, l = offset + j;
        const q = rational(entry);
        zero[k][l] = ratAdd(zero[k][l], sign === 1 ? q : ratNegate(q));
      }));
    }
  });
  const one = matrixOf(c2, sheaf.c1);
  admittedFaces.forEach((face, f) => face.boundary.forEach(step => {
    const e = edgeIndex.get(coincidenceKey(step.edge));
    step.restrict.forEach((row, i) => row.forEach((entry, j) => {
      const k = faceOffsets[f] + i, l = sheaf.edgeOffsets[e] + j;
      const q = rational(entry);
      one[k][l] = ratAdd(one[k][l], step.direction === 1 ? q : ratNegate(q));
    }));
  }));
  // Actual commuting restriction diagrams, not a generic graph-only claim.
  for (let f = 0; f < c2; f++) for (let v = 0; v < sheaf.c0; v++) {
    let residue = ratZero;
    for (let e = 0; e < sheaf.c1; e++)
      residue = ratAdd(residue, ratMultiply(one[f][e], zero[e][v]));
    if (!ratIsZero(residue))
      throw new RangeError(`cellular2Sheaf: noncommuting restrictions, d1*d0 != 0 at (${f},${v})`);
  }
  const r0 = ratRank(zero), r1 = ratRank(one);
  const h0 = sheaf.c0 - r0, h1 = sheaf.c1 - r0 - r1, h2 = c2 - r1;
  if (h0 < 0 || h1 < 0 || h2 < 0)
    throw new RangeError('cellular2Sheaf: inconsistent rational cohomology dimensions');
  const result = Object.freeze({
    kind: 'signgraph.cellular2Sheaf', sheaf, complex,
    faces: Object.freeze(admittedFaces), c0: sheaf.c0, c1: sheaf.c1, c2,
    coboundary: Object.freeze({ zero: frozenRows(zero), one: frozenRows(one) }),
    basis: Object.freeze({
      zero: basisOf(sheaf.vertices), one: basisOf(sheaf.edges), two: basisOf(admittedFaces),
    }),
    rank: Object.freeze({ zero: r0, one: r1 }),
    cohomology: Object.freeze({ h0, h1, h2 }),
  });
  admittedReadings.add(result);
  return result;
}

/**
 * NIST Matrix Market coordinate exchange for an admitted differential.
 * Integer coefficients remain exact as decimal integers; rational coefficients
 * use the specified REAL field and are EXPLICITLY rounded to binary64. This
 * projection is not an exact cohomology proof. Unrepresentable values refuse.
 * Coordinates are 1-based, sorted by row and column; basis IDs remain in the
 * admitted sheaf, because Matrix Market carries matrices, not typed cells.
 */
export function matrixMarketCoboundary(reading, degree) {
  if (!admittedReadings.has(reading) || (degree !== 0 && degree !== 1))
    throw new TypeError('matrixMarketCoboundary: provide an admitted cellular2Sheaf and degree 0 or 1');
  const rows = degree === 0 ? reading.c1 : reading.c2;
  const cols = degree === 0 ? reading.c0 : reading.c1;
  const values = reading.coboundary[degree === 0 ? 'zero' : 'one'];
  const entries = [];
  let integer = true;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const [n, d] = ratPairOfEntry(values[i][j]);
    if (n === 0n) continue;
    if (d !== 1n) integer = false;
    entries.push([i + 1, j + 1, n, d]);
  }
  const field = integer ? 'integer' : 'real';
  const body = entries.map(([i, j, n, d]) => {
    const value = field === 'integer' ? n.toString() : rationalToFiniteNumber(n, d).toExponential(17);
    return `${i} ${j} ${value}`;
  });
  return `%%MatrixMarket matrix coordinate ${field} general\n% SignGraph d${degree}: typed basis and exact ranks remain in cellular2Sheaf\n${rows} ${cols} ${entries.length}\n${body.length ? `${body.join('\n')}\n` : ''}`;
}
