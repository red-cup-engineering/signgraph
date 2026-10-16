/**
 * SignGraph — paths: cells composed across shared entities.
 *
 * Read as an edge s →[p]→ o, a cell composes with any cell starting where it
 * ends: (a, p, b) · (b, q, c) = (a, [p, q], c), the composite labelled by the
 * predicate sequence it traversed. `compose` is one round of that (the
 * multiplication of the path monad), keeping the generators; `atomic` keeps
 * only the uncomposed edges (its unit, which forgets composites and so is not
 * injective); the residue of a round is the label sequences no single
 * predicate names — the part of a path that does not saturate back into a cell.
 */
import { coincides } from "@red-cup-engineering/signcell/cell";

const labels = (edge) => (Array.isArray(edge.predicate) ? edge.predicate : [edge.predicate]);

/** One round of composition: every edge, plus each composite of two distinct edges meeting at an entity. */
export function compose(edges) {
  const composites = [];
  edges.forEach((left, i) => edges.forEach((right, j) => {
    if (i !== j && coincides(left.object, right.subject)) composites.push(Object.freeze({ subject: left.subject, predicate: Object.freeze([...labels(left), ...labels(right)]), object: right.object }));
  }));
  return Object.freeze([...edges, ...composites]);
}

/** The atomic (single-predicate) edges of a path list. */
export const atomic = (edges) => Object.freeze(edges.filter((edge) => labels(edge).length === 1));

/** Compose once, then reopen to atoms; the residue is each composite's label sequence. */
export function composeAndReopen(edges) {
  const composed = compose(edges);
  return Object.freeze({ composed, reopened: atomic(composed), residue: Object.freeze(composed.filter((edge) => labels(edge).length > 1).map(labels)) });
}


/**
 * Exact affine transport on the sixfold Eisenstein lattice.
 *
 * A motion is (k,t) in Z² ⋊ C6, acting on points by x ↦ R^k x + t.
 * Its ordered product is (k,t)(l,u) = (k+l, t+R^k u), NOT naive
 * addition of Burgers vectors when rotational disclinations occur.
 * The rotation R(a,b)=(-b,a+b) and its sixfold period are exactly the
 * carrier of Obsmetrologia.AperiodicOrder.Defect.Disclination.
 *
 * Inferred topological charge is not by itself physical temperature or
 * an authenticated SignCell witness. This is exact coordinate transport.
 */
const sixfoldR = ([a, b]) => [-b, a + b];
const sixfoldRotate = (vector, turns) => {
  let out = vector;
  for (let j = 0; j < turns % 6; j++) out = sixfoldR(out);
  return out;
};
const sixfoldSafe = value => {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER))
    throw new RangeError("sixfold motion coordinate exceeds safe integer range");
  return Number(value);
};
export function sixfoldMotion(rotation, translation) {
  if (!Number.isSafeInteger(rotation) || !Array.isArray(translation) ||
      translation.length !== 2 || !translation.every(Number.isSafeInteger))
    throw new TypeError("sixfold motion requires an integer turn and two exact lattice coordinates");
  return Object.freeze({
    rotation: ((rotation % 6) + 6) % 6,
    translation: Object.freeze([...translation]),
  });
}
export const sixfoldIdentity = () => sixfoldMotion(0, [0, 0]);

/** Compose motions in path order. Rotation acts on the second translation. */
export function sixfoldCompose(first, second) {
  const a = sixfoldMotion(first?.rotation, first?.translation);
  const b = sixfoldMotion(second?.rotation, second?.translation);
  const v = sixfoldRotate(b.translation.map(BigInt), a.rotation);
  return sixfoldMotion(a.rotation + b.rotation, [
    sixfoldSafe(BigInt(a.translation[0]) + v[0]),
    sixfoldSafe(BigInt(a.translation[1]) + v[1]),
  ]);
}

/** Inverse edge transport: (k,t)^(-1) = (-k,-R^(-k)t). */
export function sixfoldInverse(value) {
  const a = sixfoldMotion(value?.rotation, value?.translation);
  const v = sixfoldRotate(a.translation.map(BigInt), (6 - a.rotation) % 6);
  return sixfoldMotion(-a.rotation, v.map(x => sixfoldSafe(-x)));
}

/** One move of the existing Lean developer: turn, then step along the new frame. */
export function sixfoldStep(turn) {
  if (!Number.isSafeInteger(turn) || turn < 0)
    throw new TypeError("sixfold step requires a nonnegative integer turn count");
  return sixfoldMotion(turn, sixfoldRotate([1n, 0n], turn).map(sixfoldSafe));
}

/** Develop the entire ordered turn word; lengths are not reduced to a turn sum. */
export function sixfoldDevelop(turns) {
  if (!Array.isArray(turns))
    throw new TypeError("sixfold development requires an ordered word");
  return turns.reduce((state, turn) => sixfoldCompose(state, sixfoldStep(turn)), sixfoldIdentity());
}
