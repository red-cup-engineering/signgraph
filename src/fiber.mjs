/**
 * SignGraph — predicate fibers and their quantifiers: the hyperdoctrine over a site.
 *
 * Over one predicate, a fiber reads a point of FOUR at each (subject, object)
 * pair of an entity list. The cell moves act on fibers three ways (Lawvere
 * 1969): pullback, and its left and right adjoints ∃ and ∀, which fold the
 * moved-over pairs by an order's join and meet. Converse swaps the pair; the
 * projections collapse it onto its subject or object; specialization restricts
 * to a support. Fibers combine cellwise by SignChain's linear fusion and
 * residuum, and the generators' laws (pullback commuting with both, Frobenius
 * reciprocity for ∃) are checked on fibers.
 */
import { coincides, coincidenceKey, knowledgeReading } from "@red-cup-engineering/signcell/cell";
import { canonicalCarrier } from "@red-cup-engineering/computer-content-address-engineering-services-section/semiotic-content-address";
import { evidenceAt } from "./valuation.mjs";
import { isReading, knowledgeBottom, knowledgeTop, truthBottom, truthTop, readingOfSides, samePoint, fusionReading, knowledgeJoinReading, knowledgeMeetReading, residuumReading, truthJoinReading, truthMeetReading } from "@red-cup-engineering/computer-data-engineering-services-section/four";

/** An order over readings: join, meet, bottom, top. */
const order = (name, join, meet, bottom, top) => Object.freeze({ kind: "signgraph.order", name, join, meet, bottom, top });
/** The knowledge order: absurd bottom, stable top. */
export const knowledgeOrder = () => order("knowledge", knowledgeJoinReading, knowledgeMeetReading, knowledgeBottom(), knowledgeTop());
/** The truth order: active bottom, potential top. */
export const truthOrder = () => order("truth", truthJoinReading, truthMeetReading, truthBottom(), truthTop());

const samePair = (left, right) => coincides(left[0], right[0]) && coincides(left[1], right[1]);

/** Every ordered (subject, object) pair over an entity list. */
export const allPairs = (entities) => Object.freeze(entities.flatMap((subject) => entities.map((object) => Object.freeze([subject, object]))));

/** A fiber over `label`: `read(subject, object)` at each listed pair; unlisted pairs read absurd. */
export function predicateFiber(label, entities, read, pairs = allPairs(entities)) {
  if (!Array.isArray(entities) || !Array.isArray(pairs) || typeof read !== "function") {
    throw new TypeError("predicateFiber: entities, pairs, and reading function are required");
  }
  // A fiber is indexed by content identities, not mutable caller-owned
  // object pointers or pair arrays.
  const domain = Object.freeze(entities.map((entity) => canonicalCarrier(entity)));
  const keys = domain.map((entity) => coincidenceKey(entity));
  if (new Set(keys).size !== keys.length) throw new RangeError("predicateFiber: duplicate entity identity");
  const keySet = new Set(keys), seen = new Map();
  const slots = pairs.map((pair) => {
    if (!Array.isArray(pair) || pair.length !== 2) throw new TypeError("predicateFiber: each pair needs two coordinates");
    const slot = Object.freeze([canonicalCarrier(pair[0]), canonicalCarrier(pair[1])]);
    const subject = coincidenceKey(slot[0]), object = coincidenceKey(slot[1]);
    if (!keySet.has(subject) || !keySet.has(object)) {
      throw new RangeError("predicateFiber: pair lies outside its declared entity context");
    }
    let row = seen.get(subject);
    if (row === undefined) { row = new Set(); seen.set(subject, row); }
    if (row.has(object)) throw new RangeError("predicateFiber: duplicate subject/object pair");
    row.add(object);
    return slot;
  });
  // Index exactly the admitted content-addressed pairs. Repeated local/global
  // restriction readings must not scan all n² cells of a finite Chu/FCA site:
  // that previously made pointwise fusion, residuation and sheaf projections
  // superlinear in the *number of queries*, even after pairing was settled.
  // A nested map preserves distinct (subject, object) coordinates without
  // inventing a separator that could collide inside canonical CBOR bytes.
  const readings = new Map();
  for (const pair of slots) {
    const reading = read(pair[0], pair[1]) ?? knowledgeBottom();
    if (!isReading(reading)) throw new TypeError("predicateFiber: a pair must read a FOUR value");
    const subject = coincidenceKey(pair[0]), object = coincidenceKey(pair[1]);
    let row = readings.get(subject);
    if (row === undefined) { row = new Map(); readings.set(subject, row); }
    row.set(object, reading);
  }
  const at = (subject, object) =>
    readings.get(coincidenceKey(subject))?.get(coincidenceKey(object)) ?? knowledgeBottom();
  return Object.freeze({ kind: "signgraph.fiber", label: canonicalCarrier(label), entities: domain, pairs: Object.freeze(slots), at });
}

/** The fiber a valuation carries over one predicate, read in the knowledge order. */
export const fiberOfValuation = (valuation, predicate, entities) => predicateFiber(predicate, entities, (subject, object) => knowledgeReading(evidenceAt(valuation, { subject, predicate, object })));

// Reindexing a fiber along an explicit generator is lawful; silently mixing
// different entity contexts is not. Entity ordering is immaterial because the
// fibers are content-addressed, and sparse pair support still reads ⊥ₖ.
const requireSharedContext = (left, right) => {
  if (left?.kind !== "signgraph.fiber" || right?.kind !== "signgraph.fiber") {
    throw new TypeError("fiber: two predicate fibers are required");
  }
  // A fiber is indexed by its predicate as well as its entity context. To
  // tensor distinct predicates a caller would need an explicitly typed
  // resulting predicate; reusing the left label would misname the result.
  if (!coincides(left.label, right.label)) {
    throw new RangeError("fiber: distinct predicate labels cannot compose without a resulting predicate");
  }
  const rightKeys = new Set(right.entities.map(coincidenceKey));
  if (left.entities.length !== right.entities.length ||
      left.entities.some((entity) => !rightKeys.has(coincidenceKey(entity)))) {
    throw new RangeError("fiber: distinct entity contexts cannot compose");
  }
};

// A sparse local section is not the whole predicate fiber: in FOUR's linear
// algebra ⊥ₖ ⊗ ⊥ₖ = f and ⊥ₖ ⊸ ⊥ₖ = t. Evaluating only the
// left section's declared pairs silently discards non-bottom results outside
// it and makes the default pointwise operations dependent on operand order.
// Explicit pairs still select a caller-declared restricted site.
const cellwise = (operation) => (left, right, pairs) => {
  requireSharedContext(left, right);
  const domain = pairs ?? allPairs(left.entities);
  return predicateFiber(left.label, left.entities, (s, o) => operation(left.at(s, o), right.at(s, o)), domain);
};
const sameFiber = (left, right, pairs) => {
  requireSharedContext(left, right);
  return (pairs ?? allPairs(left.entities)).every(([s, o]) => samePoint(left.at(s, o), right.at(s, o)));
};

/** Cellwise linear fusion and residuum of two fibers. */
export const fiberFusion = cellwise(fusionReading);
export const fiberResiduum = cellwise(residuumReading);

/** Whether `left` is below `right` in the truth order at every pair. */
export const fiberLeqTruth = (left, right, pairs) => {
  requireSharedContext(left, right);
  return (pairs ?? allPairs(left.entities)).every(([s, o]) => samePoint(truthJoinReading(left.at(s, o), right.at(s, o)), right.at(s, o)));
};

const foldJoin = (ord, values) => values.reduce((acc, item) => ord.join(acc, item), ord.bottom);
const foldMeet = (ord, values) => values.reduce((acc, item) => ord.meet(acc, item), ord.top);
const generator = (name, domain, codomain, pullback, exists, forall) => Object.freeze({ kind: "signgraph.generator", generator: name, domain, codomain, pullback, exists, forall });

/** Converse: pullback, ∃ and ∀ all read the swapped pair. */
export function converse(entities) {
  const pairs = allPairs(entities);
  const swapped = (source) => predicateFiber(source.label, source.entities, (s, o) => source.at(o, s), pairs);
  return generator("converse", pairs, pairs, swapped, (_ord, source) => swapped(source), (_ord, source) => swapped(source));
}

/** Subject projection: pullback reads (s, s); ∃ and ∀ fold a subject's row onto its diagonal. */
export function subjectProjection(entities) {
  const pairs = allPairs(entities);
  return generator("subject-projection", pairs, pairs,
    (source) => predicateFiber(source.label, source.entities, (s) => source.at(s, s), pairs),
    (ord, source) => predicateFiber(source.label, source.entities, (s, o) => coincides(s, o) ? foldJoin(ord, source.entities.map((item) => source.at(s, item))) : ord.bottom, pairs),
    (ord, source) => predicateFiber(source.label, source.entities, (s, o) => coincides(s, o) ? foldMeet(ord, source.entities.map((item) => source.at(s, item))) : ord.top, pairs));
}

/** Object projection: pullback reads (o, o); ∃ and ∀ fold an object's column onto its diagonal. */
export function objectProjection(entities) {
  const pairs = allPairs(entities);
  return generator("object-projection", pairs, pairs,
    (source) => predicateFiber(source.label, source.entities, (_s, o) => source.at(o, o), pairs),
    (ord, source) => predicateFiber(source.label, source.entities, (s, o) => coincides(s, o) ? foldJoin(ord, source.entities.map((item) => source.at(item, o))) : ord.bottom, pairs),
    (ord, source) => predicateFiber(source.label, source.entities, (s, o) => coincides(s, o) ? foldMeet(ord, source.entities.map((item) => source.at(item, o))) : ord.top, pairs));
}

/** Specialization: restrict to a support of pairs; ∃ and ∀ extend back by the order's bottom and top. */
export function specialization(entities, support, ambient = allPairs(entities)) {
  const inSupport = (s, o) => support.some((pair) => samePair(pair, [s, o]));
  return generator("specialization", ambient, Object.freeze([...support]),
    (source) => predicateFiber(source.label, source.entities, (s, o) => source.at(s, o), support),
    (ord, source) => predicateFiber(source.label, source.entities, (s, o) => inSupport(s, o) ? source.at(s, o) : ord.bottom, ambient),
    (ord, source) => predicateFiber(source.label, source.entities, (s, o) => inSupport(s, o) ? source.at(s, o) : ord.top, ambient));
}

/** Whether a generator's pullback commutes with fusion, and with residuum. */
export const generatorPreservesFusion = (gen, left, right) => sameFiber(gen.pullback(fiberFusion(left, right, gen.domain)), fiberFusion(gen.pullback(left), gen.pullback(right), gen.codomain), gen.codomain);
export const generatorPreservesResiduum = (gen, left, right) => sameFiber(gen.pullback(fiberResiduum(left, right, gen.domain)), fiberResiduum(gen.pullback(left), gen.pullback(right), gen.codomain), gen.codomain);

/** Frobenius reciprocity: ∃(pullback(α) ⊗ φ) = α ⊗ ∃(φ). */
export const generatorSatisfiesFrobenius = (gen, ord, alpha, phi) => sameFiber(gen.exists(ord, fiberFusion(gen.pullback(alpha), phi, gen.codomain)), fiberFusion(alpha, gen.exists(ord, phi), gen.domain), gen.domain);
