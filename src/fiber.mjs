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
import { canonicalCarrier, coincides, coincidenceKey, knowledgeReading } from "@red-cup-engineering/signcell/cell";
import { evidenceAt } from "./valuation.mjs";
import { reindex, existsAlong, forallAlong } from "@red-cup-engineering/metrologic/hyperdoctrine/adjoints";
import { isReading, knowledgeBottom, samePoint, fusionReading, residuumReading } from "@red-cup-engineering/computer-data-engineering-services-section/four";
import { orderOps } from "@red-cup-engineering/metrologic/hyperdoctrine/order";

// Construction-origin receipts for this installed SignGraph module. These are
// intentionally not serializable identity schemes, external attestation, actor
// authority or evidence of a physical observation.
const admittedFibers = new WeakSet();
const admittedGenerators = new WeakSet();
const admittedOrders = new WeakSet();
const demandFiber = (fiber) => {
  if (!fiber || typeof fiber !== "object" || !admittedFibers.has(fiber))
    throw new TypeError("fiber: original SignGraph predicate fiber is required");
  return fiber;
};
const demandGenerator = (generator) => {
  if (!generator || typeof generator !== "object" || !admittedGenerators.has(generator))
    throw new TypeError("fiber: original SignGraph generator is required");
  return generator;
};
const demandOrder = (order) => {
  if (!order || typeof order !== "object" || !admittedOrders.has(order))
    throw new TypeError("fiber: original SignGraph FOUR order is required");
  return order;
};

/** An order over readings: join, meet, bottom, top. */
const order = (name) => {
  const { join, meet, bottom, top } = orderOps(name);
  const admitted = Object.freeze({ kind: "signgraph.order", name, join, meet, bottom, top });
  admittedOrders.add(admitted);
  return admitted;
};
/** A graph order is Metrologic's canonical FOUR order, carried at a graph site. */
export const knowledgeOrder = () => order("knowledge");
export const truthOrder = () => order("truth");

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
  const admitted = Object.freeze({ kind: "signgraph.fiber", label: canonicalCarrier(label), entities: domain, pairs: Object.freeze(slots), at });
  admittedFibers.add(admitted);
  return admitted;
}

/** The fiber a valuation carries over one predicate, read in the knowledge order. */
export const fiberOfValuation = (valuation, predicate, entities) => predicateFiber(predicate, entities, (subject, object) => knowledgeReading(evidenceAt(valuation, { subject, predicate, object })));

// Reindexing a fiber along an explicit generator is lawful; silently mixing
// different entity contexts is not. Entity ordering is immaterial because the
// fibers are content-addressed, and sparse pair support still reads ⊥ₖ.
const requireSharedContext = (left, right) => {
  // Inspect the in-process source owner before reading a caller's kind,
  // label, entities or programmable at() method. A JSON lookalike cannot
  // fabricate an admitted FOUR reading or a proof of fiber compatibility.
  if (!admittedFibers.has(left) || !admittedFibers.has(right)) {
    throw new TypeError("fiber: two original predicate fibers are required");
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
  const { leq } = orderOps("truth");
  return (pairs ?? allPairs(left.entities)).every(([s, o]) => leq(left.at(s, o), right.at(s, o)));
};

// SignGraph owns only the SCA-coordinate presentation of a finite site. The
// mathematical reindexing and existential/universal adjoints are Metrologic's;
// no second implementation of the hyperdoctrine is retained here.
const pairAddress = (pair) => coincidenceKey(pair);
const indexedFiber = (fiber, pairs) => {
  demandFiber(fiber);
  return new Map(pairs.map(([s, o]) => [pairAddress([s, o]), fiber.at(s, o)]));
};
const onPairs = (fiber, pairs, readings) => {
  demandFiber(fiber);
  return predicateFiber(fiber.label, fiber.entities, (s, o) => readings.get(pairAddress([s, o])), pairs);
};

/** Translate a graph generator into one Metrologic index morphism u: local -> ambient.
 * The map is formed from canonical SCA coordinate identities, not string-concatenated
 * subjects and objects or caller-owned references. In particular, a projection's
 * off-diagonal values are the EMPTY-FIBER bottom/top given by Metrologic, never
 * made-up witnesses. Graph-specific fiber presentation stays with SignGraph. */
function finiteGenerator(name, ambient, local, imageOf) {
  const source = local.map(pairAddress);
  const target = ambient.map(pairAddress);
  if (new Set(source).size !== source.length || new Set(target).size !== target.length)
    throw new RangeError("signgraph generator: a site cannot repeat a pair");
  const images = new Map(local.map((pair) => [pairAddress(pair), pairAddress(imageOf(pair))]));
  const morphism = Object.freeze({
    source, target,
    map: (key) => images.get(key),
  });
  const admitted = Object.freeze({
    kind: "signgraph.generator", generator: name, domain: ambient, codomain: local,
    pullback: (fiber) => {
      demandFiber(fiber);
      return onPairs(fiber, local, reindex(morphism, indexedFiber(fiber, ambient)));
    },
    exists: (ord, fiber) => {
      demandOrder(ord); demandFiber(fiber);
      return onPairs(fiber, ambient, existsAlong(morphism, indexedFiber(fiber, local), ord.name));
    },
    forall: (ord, fiber) => {
      demandOrder(ord); demandFiber(fiber);
      return onPairs(fiber, ambient, forallAlong(morphism, indexedFiber(fiber, local), ord.name));
    },
  });
  admittedGenerators.add(admitted);
  return admitted;
}

/** Converse is a bijective finite reindexing (both adjoints are its inverse). */
export function converse(entities) {
  const pairs = allPairs(entities);
  return finiteGenerator("converse", pairs, pairs, ([s, o]) => [o, s]);
}

/** Diagonal projection: each row of a relation has the subject as its image. */
export function subjectProjection(entities) {
  const pairs = allPairs(entities);
  return finiteGenerator("subject-projection", pairs, pairs, ([s]) => [s, s]);
}

/** Diagonal projection: each column has the object as its image. */
export function objectProjection(entities) {
  const pairs = allPairs(entities);
  return finiteGenerator("object-projection", pairs, pairs, ([, o]) => [o, o]);
}

/** Restriction to a caller-admitted support: inclusion's two adjoints. */
export function specialization(entities, support, ambient = allPairs(entities)) {
  return finiteGenerator("specialization", ambient, Object.freeze([...support]), (pair) => pair);
}

/** Whether a generator's pullback commutes with fusion, and with residuum. */
export const generatorPreservesFusion = (gen, left, right) => {
  demandGenerator(gen);
  return sameFiber(gen.pullback(fiberFusion(left, right, gen.domain)), fiberFusion(gen.pullback(left), gen.pullback(right), gen.codomain), gen.codomain);
};
export const generatorPreservesResiduum = (gen, left, right) => {
  demandGenerator(gen);
  return sameFiber(gen.pullback(fiberResiduum(left, right, gen.domain)), fiberResiduum(gen.pullback(left), gen.pullback(right), gen.codomain), gen.codomain);
};

/** Frobenius reciprocity: ∃(pullback(α) ⊗ φ) = α ⊗ ∃(φ). */
export const generatorSatisfiesFrobenius = (gen, ord, alpha, phi) => {
  demandGenerator(gen); demandOrder(ord);
  return sameFiber(gen.exists(ord, fiberFusion(gen.pullback(alpha), phi, gen.codomain)), fiberFusion(alpha, gen.exists(ord, phi), gen.domain), gen.domain);
};
