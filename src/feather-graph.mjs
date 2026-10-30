/**
 * Source-positioned feather presentations over ORIGINAL performed predications.
 *
 * Obsmetrologia's relation-only feather-graph programme begins with performed
 * source positions, not a primitive vertex set. This is a deliberately finite,
 * conditional SignGraph readout: the caller supplies a source record for each
 * original directed predication. No claim that Articulating.Beneath has already
 * been reified as an admitted object-language predication is made here.
 *
 * Each cell's subject/object is an original SourcePosition-like role
 * { performed, side: 'token'|'claim', display? }. A display is a lossy Mark
 * readout, NEVER identity. The view derives sites from these positions.
 * Predicates are ORIGINAL cell contents; the two selectors merely ask which
 * caller-claimed predicate contents mean continuation and transverse contact.
 * No path composite is admitted as a new source relation.
 */

const freeze = Object.freeze;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const named = value => typeof value === 'string' && value.length > 0;
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const MAX_PREDICATIONS = 2048;
const MAX_FORK_PAIRS = 8192;
// A transported readout never acquires the in-process derivation witness by copying its JSON.
const generatedReadouts = new WeakSet();

function fail(message) { throw new TypeError(`feather graph: ${message}`); }
/** Original source-position/claim admission shared with the downstream
 * Keratin workbench. The elected owner is Feather, the earliest reader of
 * performed directed predications; consumers supply their own error prefix.
 * A fixed null-prototype snapshot prevents the post-admission read of
 * inherited source fields, even when an optional coordinate is absent.
 */
export function featherSourceFields(record, keys, context, refuse = fail) {
  if (!isRecord(record) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(record)))
    refuse(`${context}: undeclared fields or invalid object; requires plain source record`);
  const descriptors = Object.getOwnPropertyDescriptors(record);
  const names = Reflect.ownKeys(descriptors);
  if (names.some(key => typeof key !== 'string' || !keys.includes(key) ||
      !descriptors[key].enumerable || !Object.hasOwn(descriptors[key], 'value')))
    refuse(`${context}: undeclared fields or invalid object; requires inert own data`);
  const source = Object.create(null);
  for (const name of names)
    Object.defineProperty(source, name, {value: descriptors[name].value, enumerable: true});
  return Object.freeze(source);
}
/** Bounded, ordinary dense original source lists: refuse accessor entries,
 * source-specific iterators, invisible annotations, subclasses and sparsity
 * before any first-party graph algorithm traverses their entries.
 */
export function featherSourceArray(values, context, maximum = 256, refuse = fail) {
  if (!Array.isArray(values) || Object.getPrototypeOf(values) !== Array.prototype ||
      values.length > maximum)
    refuse(`${context}: list exceeds work limit ${maximum}`);
  const descriptors = Object.getOwnPropertyDescriptors(values);
  if (Reflect.ownKeys(descriptors).length !== values.length + 1)
    refuse(`${context}: array must be dense, undecorated inert data`);
  for (let i = 0; i < values.length; i++) {
    const slot = descriptors[String(i)];
    if (!slot || !slot.enumerable || !Object.hasOwn(slot, 'value'))
      refuse(`${context}: array slots must be inert data`);
  }
  return values;
}
function positionOf(value) {
  const position = featherSourceFields(value, ['performed', 'side', 'display'], 'source-position role');
  if (!named(position.performed) || !['token', 'claim'].includes(position.side))
    fail('each endpoint must be a source-position role {performed,side}');
  if (Object.hasOwn(position, 'display') && typeof position.display !== 'string')
    fail('a Mark display must be an opaque text readout, not an identity');
  const key = JSON.stringify([position.performed, position.side]);
  return freeze({ key, performed: position.performed, side: position.side,
    ...(Object.hasOwn(position, 'display') ? {display: position.display} : {}) });
}

/**
 * Derive one finite relation-only view from original directed predications.
 *
 * The selectors classify source-reported predicates; this function does NOT
 * authenticate source histories or prove a semantic continuation bridge.
 * Forks are two directly presented continuations with incomparable endpoints
 * in the supplied axial relation. A transverse contact is recorded ONLY if a
 * separate source predication actually supplies it. Route equality is unknown.
 */
export function featherGraphOfPredications(source, options = {}) {
  if (!Array.isArray(source) || source.length === 0 || source.length > MAX_PREDICATIONS)
    fail(`requires 1-${MAX_PREDICATIONS} original predication occurrences`);
  // Protect source occurrence iteration AND selectors before the original
  // graph can read any purported performed source position or relation.
  featherSourceArray(source, 'original predications', MAX_PREDICATIONS);
  const selectors = featherSourceFields(options,
    ['axialPredicate', 'transversePredicate'], 'predicate selectors');
  const {axialPredicate, transversePredicate} = selectors;
  if (!named(axialPredicate) || !named(transversePredicate) || axialPredicate === transversePredicate)
    fail('distinct axialPredicate and transversePredicate selectors are required');
  const ids = new Set(), positions = new Map(), predications = [];
  const remember = role => {
    const prior = positions.get(role.key);
    if (prior && Object.hasOwn(prior, 'display') && Object.hasOwn(role, 'display') && prior.display !== role.display)
      fail('one performed source-position reports conflicting Mark displays');
    if (!prior || (!Object.hasOwn(prior, 'display') && Object.hasOwn(role, 'display')))
      positions.set(role.key, role);
    return role.key;
  };
  for (const rawOccurrence of source) {
    const original = featherSourceFields(rawOccurrence,
      ['occurrence', 'sourceRecord', 'cell'], 'source occurrence');
    const predication = featherSourceFields(original.cell,
      ['subject', 'predicate', 'object'], 'source predication cell');
    if (!named(original.occurrence) || !named(original.sourceRecord) ||
        !named(predication.predicate))
      fail('each occurrence needs identity, source record, and predicate');
    if (ids.has(original.occurrence)) fail('duplicate original occurrence identity');
    ids.add(original.occurrence);
    const subject = positionOf(predication.subject), object = positionOf(predication.object);
    remember(subject); remember(object);
    predications.push(freeze({
      occurrence: original.occurrence,
      sourceRecord: original.sourceRecord,
      subject: subject.key, predicate: predication.predicate, object: object.key,
    }));
  }
  predications.sort((a, b) => compare(a.occurrence, b.occurrence));
  const axial = predications.filter(item => item.predicate === axialPredicate);
  const transverse = predications.filter(item => item.predicate === transversePredicate);
  const axialByFrom = new Map(), successors = new Map();
  for (const edge of axial) {
    if (edge.subject === edge.object) fail('strict axial continuation cannot be reflexive');
    if (!axialByFrom.has(edge.subject)) axialByFrom.set(edge.subject, []);
    axialByFrom.get(edge.subject).push(edge);
    if (!successors.has(edge.subject)) successors.set(edge.subject, new Set());
    successors.get(edge.subject).add(edge.object);
  }
  // Ancestral continuity is acyclic; no supplied cycle may be silently read as
  // two incomparable branches. Every route below uses ORIGINAL edge IDs.
  const active = new Set(), visited = new Set();
  function visit(node) {
    if (active.has(node)) fail('cyclic axial relation cannot witness Articulating ancestry');
    if (visited.has(node)) return;
    active.add(node);
    for (const next of successors.get(node) ?? []) visit(next);
    active.delete(node); visited.add(node);
  }
  for (const node of positions.keys()) visit(node);
  const reachCache = new Map();
  function descendants(node) {
    if (reachCache.has(node)) return reachCache.get(node);
    const found = new Set(), pending = [...(successors.get(node) ?? [])];
    while (pending.length) {
      const next = pending.pop();
      if (found.has(next)) continue;
      found.add(next);
      pending.push(...(successors.get(next) ?? []));
    }
    reachCache.set(node, found);
    return found;
  }
  const contacts = new Map();
  for (const edge of transverse) {
    const pair = JSON.stringify([edge.subject, edge.object]);
    if (!contacts.has(pair)) contacts.set(pair, []);
    contacts.get(pair).push(edge);
  }
  const forks = [], routes = [];
  let pairs = 0;
  for (const [root, outgoing] of [...axialByFrom.entries()].sort(([a], [b]) => compare(a, b))) {
    for (let i = 0; i < outgoing.length; i++) for (let j = i + 1; j < outgoing.length; j++) {
      const first = outgoing[i], second = outgoing[j];
      if (first.object === second.object || descendants(first.object).has(second.object) ||
          descendants(second.object).has(first.object)) continue;
      if (++pairs > MAX_FORK_PAIRS) fail(`more than ${MAX_FORK_PAIRS} finite fork-pair candidates`);
      const leftToRight = contacts.get(JSON.stringify([first.object, second.object])) ?? [];
      const rightToLeft = contacts.get(JSON.stringify([second.object, first.object])) ?? [];
      const witnessedContacts = [...leftToRight, ...rightToLeft];
      forks.push(freeze({
        source: root,
        branches: freeze([first.occurrence, second.occurrence]),
        contacts: freeze(witnessedContacts.map(edge => edge.occurrence)),
        reading: witnessedContacts.length ? 'source-reported-transverse-contact' : 'branch-only',
      }));
      for (const edge of leftToRight) routes.push(freeze({
        from: root, to: second.object,
        direct: freeze([second.occurrence]),
        via: freeze([first.occurrence, edge.occurrence]),
        comparison: 'unmeasured',
      }));
      for (const edge of rightToLeft) routes.push(freeze({
        from: root, to: first.object,
        direct: freeze([first.occurrence]),
        via: freeze([second.occurrence, edge.occurrence]),
        comparison: 'unmeasured',
      }));
    }
  }
  const result = freeze({
    kind: 'signgraph.featherGraph.sourcePositionReadout.v1',
    sourceQualification: 'conditional: supplied source-record identifiers are not authenticated here',
    semanticStatus: 'candidate: ancestry-to-object-language predication bridge remains a Science proof obligation',
    selectors: freeze({axialPredicate, transversePredicate}),
    positions: freeze([...positions.values()].sort((a, b) => compare(a.key, b.key))),
    predications: freeze(predications),
    forks: freeze(forks),
    routeComparisons: freeze(routes),
    // No source positions, directed edges or route equalities have been added.
  });
  generatedReadouts.add(result);
  return result;
}

/**
 * A posit graph is a charged reading OF the same feather predications, not a
 * rival vertex/edge carrier. Each independent original Positing/Meme testimony
 * targets an existing occurrence. Preserve for and against sources separately:
 * two opposed witnesses are not absence, and no claimed Charge is inferred.
 */
export function positGraphOfFeather(feather, posits) {
  if (!isRecord(feather) || !generatedReadouts.has(feather))
    fail('posit reading requires an existing feather graph and posit testimony list');
  // Keep source testimony finite before inspection. The original graph's
  // existing 8192 candidate budget also bounds caller-reported posit rows
  // and individual testimony lanes; no new independent witness is inferred.
  featherSourceArray(posits, 'posit testimony', MAX_FORK_PAIRS);
  const originals = new Set(feather.predications.map(item => item.occurrence));
  const told = new Set(), chargeOccurrences = [];
  for (const sourcePosit of posits) {
    const posit = featherSourceFields(sourcePosit,
      ['occurrence', 'sourceRecord', 'for', 'against'], 'posit testimony');
    const forSide = featherSourceArray(posit.for, 'posit for witnesses', MAX_FORK_PAIRS);
    const againstSide = featherSourceArray(posit.against, 'posit against witnesses', MAX_FORK_PAIRS);
    if (!originals.has(posit.occurrence) || !named(posit.sourceRecord) ||
        !forSide.every(named) || !againstSide.every(named))
      fail('each posit must charge an original predication with explicit for/against witnesses');
    const id = JSON.stringify([posit.occurrence, posit.sourceRecord]);
    if (told.has(id)) fail('duplicate original posit testimony');
    told.add(id);
    chargeOccurrences.push(freeze({
      occurrence: posit.occurrence, sourceRecord: posit.sourceRecord,
      for: freeze(forSide), against: freeze(againstSide),
    }));
  }
  chargeOccurrences.sort((a, b) => compare(a.occurrence, b.occurrence) || compare(a.sourceRecord, b.sourceRecord));
  return freeze({
    kind: 'signgraph.positGraph.featherReading.v1',
    feather, // Same sites, fork/contact incidence, and ORIGINAL route occurrences.
    testimony: freeze(chargeOccurrences),
    judgment: 'not-settled: source witness validation and SignChain FOUR adjudication are external',
  });
}
