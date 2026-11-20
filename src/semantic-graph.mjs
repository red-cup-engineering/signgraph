import {
  createRelationalField, defineRelation, queryRelationalField, queryRelationalFieldPage,
} from "./typed-relations.mjs";
import {
  semanticId, coincides, hasFields, readSourceArray, readSourceRecord, bytesCompare, utf8Bytes,
} from "@red-cup-engineering/semiotic-content-address-system";
import { createGraph, reachable, topologicalOrder } from "@red-cup-engineering/metrologic/models/graphs/directed-multigraph";
import { admit, admitTypedMarkCarrier, referenceOf, typedMarkReferenceType } from "@red-cup-engineering/typed-content";

const accepted = (value) => Object.freeze({ ok: true, value });
const refused = (code, message) => Object.freeze({ ok: false, refusal: Object.freeze({ code, message }) });
const kinds = ["subjectTypes", "objectTypes", "witnessTypes"];
const roles = ["subject", "object", "witness"];
const members = ["cells", "relations", "edges"];
const graphIndex = new WeakMap();
const name = value => typeof value === "string" && value.trim() !== "";

/** Portable order is independent of process locale and runtime ICU data. */
const compareIds = (left, right) => bytesCompare(utf8Bytes(left.normalize("NFC")), utf8Bytes(right.normalize("NFC")));
const ordered = values => Object.freeze([...values].sort((left, right) => compareIds(left.id, right.id)));

function checkedTypes(input) {
  const types = readSourceArray(input, "predicate types");
  if (types.length === 0 || types.some(type => !name(type)) || new Set(types).size !== types.length)
    throw new TypeError("relations require nonempty unique endpoint and witness type sets");
  return Object.freeze(types.toSorted());
}

function checkedReference(cells, input, allowedTypes, role) {
  const reference = readSourceRecord(input, role);
  if (!hasFields(reference, ["id", "type"]) || !name(reference.id) || !name(reference.type))
    return refused("invalid-" + role, `${role} must be a typed semantic reference`);
  const cell = cells.get(reference.id);
  if (!cell) return refused("unknown-cell", `${role} ${reference.id} is not a cell in this graph`);
  if (reference.type !== cell.type) return refused("type-mismatch", `${role} reference type does not match its cell`);
  if (allowedTypes && !allowedTypes.includes(cell.type))
    return refused("type-mismatch", `${role} type ${cell.type} is outside this predicate declaration`);
  return accepted(referenceOf(cell));
}

/** Admit a closed graph: identity-checked cells, declared predicate types, and member witnessed endpoints. */
export function createSignGraph(input) {
  let cellSources, relationSources, edgeSources;
  try {
    const source = readSourceRecord(input, "graph source");
    if (!hasFields(source, members)) return refused("invalid-graph", "graph needs cells, relations, and edges");
    [cellSources, relationSources, edgeSources] = members.map(key => readSourceArray(source[key], key));
  } catch (error) {
    return refused("invalid-graph", error.message);
  }

  const cells = new Map(), relations = new Map(), declarations = [], edges = [];
  for (const supplied of cellSources) {
    const checked = admitTypedMarkCarrier(supplied);
    if (!checked.ok) return refused("invalid-cell", checked.refusal.message);
    const cell = checked.value;
    if (cells.has(cell.id)) return refused("duplicate-cell", `cell ${cell.id} appears more than once`);
    cells.set(cell.id, cell);
  }
  try {
    for (const entry of relationSources) {
      const source = readSourceRecord(entry, "predicate declaration");
      const { id } = source;
      if (!hasFields(source, ["id", ...kinds]) || !name(id))
        return refused("invalid-relation", "relations require an id and three type sets");
      if (relations.has(id)) return refused("duplicate-relation", `relation ${id} appears more than once`);
      const types = Object.fromEntries(kinds.map(kind => [kind, checkedTypes(source[kind])]));
      const declared = defineRelation({
        id, domain: typedMarkReferenceType, codomain: typedMarkReferenceType, witness: typedMarkReferenceType,
      });
      if (!declared.ok) return refused("invalid-relation", declared.refusal.message);
      relations.set(id, Object.freeze({ id, ...types }));
      declarations.push(declared.value);
    }
  } catch (error) {
    return refused("invalid-relation", error.message);
  }
  try {
    for (const entry of edgeSources) {
      const edge = readSourceRecord(entry, "graph edge");
      if (!hasFields(edge, ["predicate", ...roles]) || !name(edge.predicate))
        return refused("invalid-edge", "edge requires a predicate and typed subject, object, and witness");
      const relation = relations.get(edge.predicate);
      if (!relation) return refused("unknown-predicate", `edge predicate ${edge.predicate} is undeclared`);
      const normalized = { predicate: relation.id };
      for (const [index, role] of roles.entries()) {
        const checked = checkedReference(cells, edge[role], relation[kinds[index]], role);
        if (!checked.ok) return checked;
        normalized[role] = checked.value;
      }
      edges.push(normalized);
    }
  } catch (error) {
    return refused("invalid-edge", error.message);
  }
  const checked = createRelationalField(declarations, edges);
  if (!checked.ok) return refused("invalid-edge", checked.refusal.message);
  const field = checked.value;
  if (field.statements.length !== edges.length) return refused("duplicate-edge", "the same witnessed edge appears more than once");
  const addressed = ordered(field.statements.map(({ id, statement }) => Object.freeze({ id, edge: statement })));
  const content = {
    kind: "sign.graph", cells: ordered(cells.values()), relations: ordered(relations.values()), edges: addressed,
  };
  const graph = Object.freeze({ ...content, id: semanticId(content) });
  graphIndex.set(graph, { cells, relations, field, edges: new Map(addressed.map(entry => [entry.id, entry])) });
  return accepted(graph);
}

/** Receive a portable cut by reconstructing its cells, incidences, and advertised EAVT addresses. */
export function admitSignGraph(input) {
  if (graphIndex.has(input)) return accepted(input);
  try {
    const graph = readSourceRecord(input, "graph cut");
    if (!hasFields(graph, ["id", "kind", ...members]) || graph.kind !== "sign.graph" || !name(graph.id))
      return refused("invalid-graph", "expected a sign.graph cut with addressed edges");
    const { id, ...content } = graph;
    const edges = readSourceArray(content.edges, "addressed edges").map(entry => {
      const row = readSourceRecord(entry, "addressed edge");
      if (!hasFields(row, ["id", "edge"]) || !name(row.id)) throw new TypeError("expected an addressed edge");
      return row.edge;
    });
    const admitted = createSignGraph({ cells: content.cells, relations: content.relations, edges });
    if (!admitted.ok) return admitted;
    if (admitted.value.id !== id || semanticId(content) !== id)
      return refused("identity-mismatch", "graph cut contents or edge addresses differ from the advertised identity");
    return admitted;
  } catch (error) {
    return refused("invalid-graph", error.message);
  }
}

const throwRefusal = result => {
  if (result.ok) return result.value;
  const error = new TypeError(result.refusal.message);
  error.code = result.refusal.code;
  throw error;
};

/** Receive a structural graph or throw its typed refusal at a read boundary. */
export function receiveSignGraph(input) {
  return throwRefusal(admitSignGraph(input));
}

/** Read a typed member even when no incidence mentions it. */
export function signGraphReference(graph, subject) {
  const index = graphIndex.get(receiveSignGraph(graph));
  try {
    const reference = admit(typedMarkReferenceType, readSourceRecord(subject, "query subject"));
    if (reference.ok) return throwRefusal(checkedReference(index.cells, reference.value, undefined, "subject"));
  } catch (error) {
    if (error.code) throw error;
  }
  return throwRefusal(refused("invalid-subject", "query subject must be a typed semantic reference"));
}

function queryScope(graph, subject, pattern) {
  const verified = receiveSignGraph(graph);
  const reference = signGraphReference(verified, subject);
  const selected = typeof pattern === "string" ? { predicate: pattern } : readSourceRecord(pattern, "query pattern");
  if (Object.hasOwn(selected, "subject") && !coincides(selected.subject, reference))
    throwRefusal(refused("invalid-query", "query pattern cannot replace the admitted typed subject"));
  return { verified, index: graphIndex.get(verified), selection: { ...selected, subject: reference } };
}

/** Perform the same admission as the unbounded query, including the source subject. */
export function validateSignGraphQuery(graph, subject, pattern = {}) {
  const { index, selection } = queryScope(graph, subject, pattern);
  queryRelationalFieldPage(index.field, selection, { limit: 1 });
}

/** Read matching source incidences, including every selected witness, in EAVT address order. */
export function querySignGraph(graph, subject, pattern = {}) {
  const { index, selection } = queryScope(graph, subject, pattern);
  return Object.freeze(queryRelationalField(index.field, selection).map(row => index.edges.get(row.id)));
}

/**
 * Construct the shared predicate reader for a typed graph and its declared
 * specializations [special, general] and converses [predicate, inverse].
 * Queries return the original addressed source edge alongside its orientation
 * in the requested predicate. Exact source reads remain available above.
 */
export function createSignGraphPredicateReader(graph, declarations = {}) {
  const admitted = receiveSignGraph(graph);
  const { relations, field, edges: sources } = graphIndex.get(admitted);
  const stated = readSourceRecord(declarations, "predicate reader declarations");
  if (!hasFields(stated, [], ["specializations", "converses"])) throw new TypeError("SignGraph: invalid predicate reader declarations");
  const { specializations = [], converses = [] } = stated;
  const contains = (wide, narrow) => narrow.every(type => wide.includes(type));
  const equal = (left, right) => left.length === right.length && contains(left, right);
  const states = new Map();
  const moves = createGraph();
  const key = (predicate, reversed) => JSON.stringify([predicate, reversed]);
  for (const predicate of relations.keys()) for (const reversed of [false, true]) {
    const id = key(predicate, reversed);
    states.set(id, { predicate, reversed });
    moves.addNode(id);
  }
  for (const [kind, pairs] of [["specialization", specializations], ["converse", converses]]) {
    for (const declaration of readSourceArray(pairs)) {
      const [left, right, ...extra] = readSourceArray(declaration);
      const a = relations.get(left), b = relations.get(right);
      if (!a || !b || extra.length) throw new TypeError(`SignGraph: invalid ${kind} declaration`);
      if (kind === "specialization") {
        if (!contains(b.subjectTypes, a.subjectTypes) || !contains(b.objectTypes, a.objectTypes))
          throw new TypeError("SignGraph: specialization widens its predicate's endpoint types");
        if (!contains(b.witnessTypes, a.witnessTypes))
          throw new TypeError("SignGraph: specialization widens its predicate's witness types");
        for (const reversed of [false, true])
          moves.addEdge({ from: key(right, reversed), to: key(left, reversed) });
      } else {
        if (!equal(a.subjectTypes, b.objectTypes) || !equal(a.objectTypes, b.subjectTypes) ||
            !equal(a.witnessTypes, b.witnessTypes))
          throw new TypeError("SignGraph: converse requires reversed endpoint types and equivalent witness types");
        for (const reversed of [false, true]) {
          moves.addEdge({ from: key(left, reversed), to: key(right, !reversed) });
          moves.addEdge({ from: key(right, !reversed), to: key(left, reversed) });
        }
      }
    }
  }
  return (subject, predicate, pattern = {}) => {
    const reference = signGraphReference(admitted, subject);
    const selector = readSourceRecord(pattern);
    if (!relations.has(predicate) || Object.keys(selector).some(name => !["object", "witness"].includes(name)))
      throw new TypeError("SignGraph: predicate read requires a declared predicate and optional object and witness selectors");
    const start = key(predicate, false);
    const results = new Map();
    for (const id of new Set([start, ...reachable(moves, start)])) {
      const { predicate: stored, reversed } = states.get(id);
      const sourcePattern = reversed
        ? { predicate: stored, object: reference, ...(Object.hasOwn(selector, "object") ? { subject: selector.object } : {}) }
        : { predicate: stored, subject: reference, ...(Object.hasOwn(selector, "object") ? { object: selector.object } : {}) };
      if (Object.hasOwn(selector, "witness")) sourcePattern.witness = selector.witness;
      for (const row of queryRelationalField(field, sourcePattern)) {
        const source = sources.get(row.id), edge = source.edge;
        const reverse = reversed && edge.subject.id !== edge.object.id;
        results.set(key(row.id, reverse), Object.freeze({
          source, reversed: reverse,
          edge: Object.freeze({
            predicate, witness: edge.witness,
            subject: reversed ? edge.object : edge.subject,
            object: reversed ? edge.subject : edge.object,
          }),
        }));
      }
    }
    return Object.freeze([...results.values()].sort((a, b) => compareIds(a.source.id, b.source.id)));
  };
}

/**
 * Inspect the free path category of all declared predicate/type incidences.
 * Coproduct range alternatives are disjoint typed tags. Separate structural
 * sources and sinks may be requested for a chosen subset of predicates.
 */
export function inspectSignGraphKinds(graph, predicates = undefined) {
  const admitted = receiveSignGraph(graph);
  const kinds = new Set(admitted.cells.map(cell => cell.type));
  const morphisms = [];
  for (const { id, subjectTypes, objectTypes } of admitted.relations) {
    for (const from of subjectTypes) for (const to of objectTypes) {
      kinds.add(from); kinds.add(to);
      morphisms.push(Object.freeze({ predicate: id, from, to }));
    }
  }
  const nodes = [...kinds].sort().map(id => ({ id }));
  const graphOf = edges => createGraph({ nodes, edges: edges.map(({ from, to, predicate }) => ({ from, to, kind: predicate })) });
  const full = graphOf(morphisms);
  const readPredicates = predicates === undefined ? undefined : new Set(readSourceArray(predicates));
  if (readPredicates && [...readPredicates].some(predicate => !admitted.relations.some(relation => relation.id === predicate)))
    throw new TypeError("SignGraph: structural predicates must be declared");
  const selected = predicates === undefined ? full : graphOf(morphisms.filter(edge => readPredicates.has(edge.predicate)));
  function uniquePaths(start, order, adjacent, endpoint) {
    const counts = new Map([[start, 1]]);
    for (const node of order) {
      const count = counts.get(node) ?? 0;
      for (const edge of adjacent(node)) {
        const next = edge[endpoint];
        counts.set(next, Math.min(2, (counts.get(next) ?? 0) + count));
      }
    }
    return order.every(node => counts.get(node) === 1);
  }
  const sources = nodes.map(({ id }) => id).filter(id => selected.incoming(id).length === 0);
  const sinks = nodes.map(({ id }) => id).filter(id => selected.outgoing(id).length === 0);
  const { order } = topologicalOrder(full);
  /** Through a cycle, path multiplicity precludes a universal object. */
  const initial = order && order.length > 0 && uniquePaths(order[0], order, full.outgoing, "to") ? [order[0]] : [];
  const reverse = order?.toReversed();
  const terminal = reverse && reverse.length > 0 && uniquePaths(reverse[0], reverse, full.incoming, "from") ? [reverse[0]] : [];
  return Object.freeze({
    kinds: Object.freeze(nodes.map(({ id }) => id)),
    morphisms: Object.freeze(morphisms),
    initial: Object.freeze(initial), terminal: Object.freeze(terminal),
    sources: Object.freeze(sources), sinks: Object.freeze(sinks),
  });
}
/** Page the indexed source query. A cursor is valid for its original cut and query. */
export function querySignGraphPage(graph, subject, pattern = {}, options = {}) {
  const { verified, index, selection } = queryScope(graph, subject, pattern);
  let limit, cursor, after = null;
  try {
    const supplied = readSourceRecord(options, "page options");
    if (!hasFields(supplied, [], ["limit", "cursor"]))
      throw new TypeError("page options permit only limit and cursor");
    ({ limit, cursor = null } = supplied);
    if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1))
      throw new TypeError("page limit must be a positive representable integer");
  } catch (error) {
    throwRefusal(refused("invalid-page", error.message));
  }
  const query = semanticId({ subject: selection.subject, pattern });
  if (cursor !== null) {
    try {
      const source = readSourceRecord(cursor, "page cursor");
      if (!hasFields(source, ["graph", "query", "after"]) || source.graph !== verified.id ||
          source.query !== query || !name(source.after)) throw new TypeError("cursor must belong to this graph and query");
      after = source.after;
    } catch (error) {
      throwRefusal(refused("invalid-cursor", error.message));
    }
  }
  const page = queryRelationalFieldPage(index.field, selection, { limit: limit ?? Number.MAX_SAFE_INTEGER, after });
  const edges = Object.freeze(page.statements.map(entry => index.edges.get(entry.id)));
  const next = page.next === null ? null : Object.freeze({ graph: verified.id, query, after: page.next });
  return Object.freeze({ graph: verified.id, query, edges, next });
}

/** Perform the same graph, subject, selector, and cursor admission as a page read. */
export function validateSignGraphPage(graph, subject, pattern = {}, options = {}) {
  querySignGraphPage(graph, subject, pattern, options);
}

/** Glue a family of qualified cuts at once with permutation-invariant results.
 *
 * Incompatible declarations obstruct their predicate and its edges. Keep
 * the complete source cuts with the obstruction receipt for successive joins.
 */
export function glueSignGraphs(...graphs) {
  if (graphs.length === 1) {
    const cut = admitSignGraph(graphs[0]);
    return cut.ok ? accepted(Object.freeze({ graph: cut.value, obstructions: Object.freeze([]) })) : cut;
  }
  const cells = new Map(), declarations = new Map(), edges = new Map();
  for (const input of graphs) {
    const checked = admitSignGraph(input);
    if (!checked.ok) return checked;
    const graph = checked.value;
    for (const cell of graph.cells) {
      const prior = cells.get(cell.id);
      if (prior && !coincides(prior, cell))
        return refused("duplicate-cell", `cell ${cell.id} has conflicting content across graph cuts`);
      cells.set(cell.id, cell);
    }
    for (const relation of graph.relations) {
      const told = declarations.get(relation.id) ?? new Map();
      const key = semanticId(relation), cuts = told.get(key) ?? { relation, graphs: [] };
      cuts.graphs.push(graph.id);
      told.set(key, cuts);
      declarations.set(relation.id, told);
    }
    for (const entry of graph.edges) edges.set(entry.id, entry.edge);
  }
  const relations = [], obstructions = [];
  for (const [id, told] of declarations) {
    if (told.size === 1) { relations.push([...told.values()][0].relation); continue; }
    obstructions.push(Object.freeze({ code: "conflicting-relation", relation: id, graphs: Object.freeze([...new Set([...told.values()].flatMap(cuts => cuts.graphs))].sort()) }));
  }
  const obstructed = new Set(obstructions.map(obstruction => obstruction.relation));
  const glued = createSignGraph({ cells: [...cells.values()], relations, edges: [...edges.values()].filter(edge => !obstructed.has(edge.predicate)) });
  if (!glued.ok) return glued;
  return accepted(Object.freeze({ graph: glued.value, obstructions: Object.freeze(obstructions.sort((left, right) => compareIds(left.relation, right.relation))) }));
}

