/**
 * Exact geometric receiving for the existing oriented SignGraph three-cells.
 *
 * The carrier is a finite cellular complex; a spatial realization is EXTRA
 * evidence. Coordinates are integers in a scaled orthogonal Cartesian frame
 * x_i -> sqrt(metric.diagonal_i) * x_i / metric.denominator. The diagonal
 * metric is positive and all tests use BigInt; no floating-point comparisons,
 * approximate half-spaces or invented elastic constants.
 *
 * A single declared volume must use every oriented exterior facet exactly
 * once. Supporting planes, face coplanarity, regular polygon geometry, edge
 * congruence and orientation are checked independently. This is not a
 * theorem of a gap-free tessellation of multiple solids.
 */
import { rationalOfBigInts } from "@red-cup-engineering/metrologic/number/exact-number";

const MAX_COORD = 1000000;
const sub = (a, b) => a.map((x, i) => x - b[i]);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0n);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const determinant = (a, b, c) => dot(a, cross(b, c));
const equal = (a, b) => a.every((x, i) => x === b[i]);

function admittedMetric(metric) {
  if (!metric || Array.isArray(metric) || !Array.isArray(metric.diagonal) ||
      metric.diagonal.length !== 3 ||
      !metric.diagonal.every(n => Number.isSafeInteger(n) && n > 0 && n <= MAX_COORD) ||
      !Number.isSafeInteger(metric.denominator) ||
      metric.denominator < 1 || metric.denominator > MAX_COORD)
    throw new TypeError("embedding: require a positive bounded diagonal metric and coordinate denominator");
  return {
    diagonal: metric.diagonal.map(BigInt),
    denominator: BigInt(metric.denominator),
  };
}
function admitted(positions, metric, vertexCount) {
  if (!Array.isArray(positions) || positions.length !== vertexCount ||
      !positions.every(p => Array.isArray(p) && p.length === 3 &&
        p.every(n => Number.isSafeInteger(n) && Math.abs(n) <= MAX_COORD)))
    throw new TypeError("embedding: require one exact bounded 3D coordinate per vertex");
  return { points: positions.map(p => p.map(BigInt)), ...admittedMetric(metric) };
}
function normSquare(v, diagonal) {
  return v.reduce((total, x, i) => total + diagonal[i] * x * x, 0n);
}
function faceVertexIndices(complex, face) {
  return face.boundary.map(({ edgeIndex, direction }) =>
    direction === 1 ? complex.edges[edgeIndex].fromIndex : complex.edges[edgeIndex].toIndex);
}

/** Exact length-square in the declared Cartesian metric. */
export function metricSquareOfVector(vector, metric) {
  if (!Array.isArray(vector) || vector.length !== 3 || !vector.every(Number.isSafeInteger))
    throw new TypeError("embedding: metric vector requires three exact safe-integer coordinates");
  // Unlike geometry positions, a measured Burgers displacement can span
  // many unit cells. The exact BigInt metric must not falsely cap it at
  // the single-cell vertex position budget.
  const { diagonal, denominator } = admittedMetric(metric);
  return rationalOfBigInts(normSquare(vector.map(BigInt), diagonal), denominator * denominator);
}

/** Receive an oriented, closed single-volume polyhedron as a regular,
 * strictly convex Euclidean J26 candidate. On nonconforming inputs return
 * specific measurements and failed obligations instead of declaring them
 * valid by fiat. The result is a proof-carrying finite calculation whose
 * physical interpretation remains an additional empirical claim.
 */
export function geometricReceiving(complex, positions, metric) {
  if (complex?.kind !== "signgraph.cellular3Complex" ||
      complex.volumes?.length !== 1 ||
      complex.faces.length < 4 || complex.edges.length < 6 ||
      complex.vertices.length < 4 || complex.vertices.length > 64 ||
      complex.edges.length > 128 || complex.faces.length > 64)
    throw new TypeError("embedding: require one bounded, oriented three-cell solid");
  const { points, diagonal, denominator } = admitted(positions, metric, complex.vertices.length);
  const coeff = complex.coboundary.two[0];
  if (!Array.isArray(coeff) || coeff.length !== complex.faces.length ||
      !coeff.every(value => value === 1 || value === -1))
    throw new TypeError("embedding: the volume must use each exterior face once, with orientation");
  const scaleSquare = denominator * denominator;
  const edgeNumerators = complex.edges.map(({ fromIndex, toIndex }) =>
    normSquare(sub(points[toIndex], points[fromIndex]), diagonal));
  const unit = edgeNumerators[0];
  const edgeCongruent = unit > 0n && edgeNumerators.every(x => x === unit);
  const edges = Object.freeze(complex.edges.map((edge, i) => Object.freeze({
    id: edge.id, squaredLength: rationalOfBigInts(edgeNumerators[i], scaleSquare),
    matchesReference: edgeNumerators[i] === unit && unit > 0n,
  })));
  let inwardCount = 0, outwardCount = 0, detSum = 0n;
  const faces = Object.freeze(complex.faces.map((face, index) => {
    const vertices = faceVertexIndices(complex, face);
    const unique = new Set(vertices);
    const [a, b, c] = vertices.map(v => points[v]);
    if (vertices.length < 3 || unique.size !== vertices.length)
      throw new TypeError("embedding: a geometric face needs at least three distinct vertices");
    const normal = cross(sub(b, a), sub(c, a));
    const nondegenerate = normal.some(x => x !== 0n);
    const planar = vertices.slice(3).every(v =>
      determinant(sub(b, a), sub(c, a), sub(points[v], a)) === 0n);
    const otherSigns = points.map((point, i) =>
      unique.has(i) ? null : dot(normal, sub(point, a))).filter(x => x !== null);
    const interiorSign = nondegenerate && otherSigns.length > 0 &&
      otherSigns.every(x => x > 0n) ? 1 :
      nondegenerate && otherSigns.length > 0 && otherSigns.every(x => x < 0n) ? -1 : 0;
    if (interiorSign === 1) inwardCount++;
    if (interiorSign === -1) outwardCount++;
    const outward = interiorSign !== 0 && coeff[index] * interiorSign === -1;
    const faceEdgeLengths = vertices.map((vertex, k) =>
      normSquare(sub(points[vertices[(k + 1) % vertices.length]], points[vertex]), diagonal));
    const equalSides = faceEdgeLengths.every(x => x === unit && unit > 0n);
    const squareDiagonals = vertices.length === 4 &&
      normSquare(sub(points[vertices[0]], points[vertices[2]]), diagonal) === 2n * unit &&
      normSquare(sub(points[vertices[1]], points[vertices[3]]), diagonal) === 2n * unit;
    const regular = (vertices.length === 3 && equalSides) ||
      (vertices.length === 4 && equalSides && squareDiagonals && planar);
    let signedDet = 0n;
    for (let k = 1; k + 1 < vertices.length; k++)
      signedDet += determinant(a, points[vertices[k]], points[vertices[k + 1]]);
    detSum += BigInt(coeff[index]) * signedDet;
    return Object.freeze({
      id: face.id,
      vertices: Object.freeze(vertices.map(i => complex.vertices[i])),
      polygon: vertices.length === 3 ? "triangle" : vertices.length === 4 ? "square-candidate" : "unsupported",
      planar, nondegenerate, strictlySupporting: interiorSign !== 0,
      orientation: interiorSign === 1 ? "inward" : interiorSign === -1 ? "outward" : "unresolved",
      outwardAfterVolumeIncidence: outward,
      regular,
      signedDeterminantContribution: signedDet.toString(),
    });
  }));
  const orientationValid = faces.every(f => f.outwardAfterVolumeIncidence);
  const supporting = faces.every(f => f.nondegenerate && f.planar && f.strictlySupporting);
  const regularFaces = faces.every(f => f.regular);
  const certified = edgeCongruent && supporting && regularFaces && orientationValid && detSum > 0n;
  const volCoeff = rationalOfBigInts(detSum, 6n * denominator * denominator * denominator);
  const areaSquareCount = faces.filter(f => f.polygon === "square-candidate").length;
  const areaTriangleCount = faces.filter(f => f.polygon === "triangle").length;
  const scaleArea = denominator * denominator;
  const result = {
    kind: "signgraph.exactGeometricReceiving",
    metric: Object.freeze({
      diagonal: Object.freeze(metric.diagonal.slice()),
      denominator: metric.denominator,
      interpretation: "Cartesian coordinate xi becomes sqrt(diagonal_i) * xi / denominator",
    }),
    edges,
    faces,
    orientation: Object.freeze({ inwardFaceCount: inwardCount, outwardFaceCount: outwardCount, valid: orientationValid }),
    volume: Object.freeze({
      coefficient: volCoeff,
      radicand: (diagonal[0] * diagonal[1] * diagonal[2]).toString(),
      exactForm: "coefficient * sqrt(radicand)",
      determinantSum: detSum.toString(),
      certified,
    }),
    area: Object.freeze({
      // Regular squares have area l²; equilateral triangles have
      // area (sqrt(3)/4) l². Only certify this when the faces are regular.
      squareCoefficient: rationalOfBigInts(BigInt(areaSquareCount) * unit, scaleArea),
      triangularCoefficient: rationalOfBigInts(BigInt(areaTriangleCount) * unit, 4n * scaleArea),
      radical: 3,
      certified: regularFaces && edgeCongruent,
    }),
    conformance: Object.freeze({
      allEdgesEqual: edgeCongruent,
      allFacesRegular: regularFaces,
      strictConvexSupportingPlanes: supporting,
      volumeBoundaryOutward: orientationValid,
      certifiedRegularConvexSolid: certified,
    }),
  };
  return Object.freeze(result);
}
