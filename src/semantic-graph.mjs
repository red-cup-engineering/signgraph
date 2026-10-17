import { createRelationalField, defineRelation, queryRelationalField, queryRelationalFieldPage } from "@red-cup-engineering/signcell/type-system/relations";
import { semanticId, coincides } from "@red-cup-engineering/computer-content-address-engineering-services-section/semiotic-content-address";
import { admit } from "@red-cup-engineering/signcell/type-system";
import { semanticGraphType } from "./semantic-graph-schema.mjs";
import { admitTypedMarkCarrier, referenceOf, typedMarkReferenceType } from "@red-cup-engineering/signcell/typed-mark";
const accepted = (value) => Object.freeze({ ok: true, value });
const refused = (code, message) => Object.freeze({ ok: false, refusal: Object.freeze({ code, message }) });
const ordered = values => Object.freeze([...values].sort((left, right) => left.id.localeCompare(right.id)));
const names = values => Array.isArray(values) && values.length > 0 && values.every(value => typeof value === "string" && value.trim() !== "") && new Set(values).size === values.length;
const graphFields = new WeakMap();
// The existing SignCell relational index already selects and pages by EAVT address.
// Retain the original immutable addressed rows so query consumers do not scan every
// edge or manufacture fresh result wrappers after the upstream index has answered.
const graphEdgesById = new WeakMap();
function validRelation(relation) { return relation && typeof relation === "object" && typeof relation.id === "string" && relation.id.trim() !== "" && names(relation.subjectTypes) && names(relation.objectTypes) && names(relation.witnessTypes); }
function checkedReference(cells, reference, allowedTypes, role) {
  if (!reference || typeof reference !== "object") return refused("invalid-edge", `${role} must be a typed semantic reference`);
  const cell = cells.get(reference.id);
  if (!cell) return refused("unknown-cell", `${role} ${reference.id} is not a cell in this graph`);
  if (reference.type !== cell.type) return refused("type-mismatch", `${role} reference type does not match its cell`);
  if (!allowedTypes.includes(cell.type)) return refused("type-mismatch", `${role} type ${cell.type} is outside this predicate declaration`);
  return accepted(referenceOf(cell));
}
/** Admit a closed graph: identity-checked cells, declared predicate types, and member witnessed endpoints. */
export function createSignGraph(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.cells) || !Array.isArray(input.relations) || !Array.isArray(input.edges)) return refused("invalid-graph", "graph needs cells, relations, and edges");
  const cells = new Map();
  for (const supplied of input.cells) {
    const checked = admitTypedMarkCarrier(supplied);
    if (!checked.ok) return refused("invalid-cell", checked.refusal.message);
    if (cells.has(checked.value.id)) return refused("duplicate-cell", `cell ${checked.value.id} appears more than once`);
    cells.set(checked.value.id, checked.value);
  }
  const relations = new Map();
  for (const relation of input.relations) {
    if (!validRelation(relation)) return refused("invalid-relation", "relations require an id and nonempty unique endpoint and witness type sets");
    if (relations.has(relation.id)) return refused("duplicate-relation", `relation ${relation.id} appears more than once`);
    relations.set(relation.id, Object.freeze({ id: relation.id, subjectTypes: Object.freeze([...relation.subjectTypes].sort()), objectTypes: Object.freeze([...relation.objectTypes].sort()), witnessTypes: Object.freeze([...relation.witnessTypes].sort()) }));
  }
  const declarations = [];
  for (const relation of relations.values()) {
    const declared = defineRelation({ id: relation.id, domain: typedMarkReferenceType, codomain: typedMarkReferenceType, witness: typedMarkReferenceType });
    if (!declared.ok) return refused("invalid-relation", declared.refusal.message);
    declarations.push(declared.value);
  }
  const edges = [], keys = new Set();
  for (const edge of input.edges) {
    if (!edge || typeof edge !== "object" || typeof edge.predicate !== "string") return refused("invalid-edge", "edge must have typed subject, predicate, object, and witness references");
    const relation = relations.get(edge.predicate);
    if (!relation) return refused("unknown-predicate", `edge predicate ${edge.predicate} is undeclared`);
    const subject = checkedReference(cells, edge.subject, relation.subjectTypes, "subject"); if (!subject.ok) return subject;
    const object = checkedReference(cells, edge.object, relation.objectTypes, "object"); if (!object.ok) return object;
    const witness = checkedReference(cells, edge.witness, relation.witnessTypes, "witness"); if (!witness.ok) return witness;
    const normalized = Object.freeze({ subject: subject.value, predicate: relation.id, object: object.value, witness: witness.value });
    const key = semanticId(normalized);
    if (keys.has(key)) return refused("duplicate-edge", `edge ${key} appears more than once`);
    keys.add(key); edges.push(normalized);
  }
  const field = createRelationalField(declarations, edges);
  if (!field.ok) return refused("invalid-edge", field.refusal.message);
  const addressed = ordered(field.value.statements.map(statement => Object.freeze({ id: statement.id, edge: statement.statement })));
  const content = Object.freeze({ kind: "sign.graph", cells: ordered([...cells.values()]), relations: ordered([...relations.values()]), edges: addressed });
  const graph = Object.freeze({ ...content, id: semanticId(content) });
  const carrier = admit(semanticGraphType, graph);
  if (!carrier.ok) return refused("invalid-graph", "graph did not satisfy its shipped carrier schema");
  graphFields.set(graph, field.value);
  graphEdgesById.set(graph, new Map(addressed.map(entry => [entry.id, entry])));
  return accepted(graph);
}
const throwRefusal = result => {
  if (result.ok) return result.value;
  const error = new TypeError(result.refusal.message);
  error.code = result.refusal.code;
  throw error;
};
function admittedGraphScope(graph, subject) {
  // Reuse complete portable readmission, not a second page-only trust path.
  const verified = graphFields.has(graph) ? graph : throwRefusal(glueSignGraphs(graph)).graph;
  const reference = admit(typedMarkReferenceType, subject);
  if (!reference.ok) throwRefusal(refused("invalid-subject", "query subject must be a typed semantic reference"));
  const cells = new Map(verified.cells.map(cell => [cell.id, cell]));
  const selected = throwRefusal(checkedReference(cells, reference.value, verified.cells.map(cell => cell.type), "subject"));
  return { graph: verified, reference: selected };
}
/** A query must preserve the selected typed subject and source provenance.
 * No legacy id-only shortcut or mutation-tolerant unadmitted read is offered.
 * Delegate candidate selection to the one SignCell relational-field index. */
function admittedQuery(graph, subject, pattern) {
  const scope = admittedGraphScope(graph, subject);
  const selected = typeof pattern === "string" ? { predicate: pattern } : pattern;
  if (!selected || typeof selected !== "object" || Array.isArray(selected) ||
      (Object.hasOwn(selected, "subject") && !coincides(selected.subject, scope.reference)))
    throwRefusal(refused("invalid-query", "query pattern cannot replace the admitted typed subject"));
  const field = graphFields.get(scope.graph);
  const matches = queryRelationalField(field, { ...selected, subject: scope.reference });
  const sourceEdges = graphEdgesById.get(scope.graph);
  return ordered(matches.map(row => sourceEdges.get(row.id)));
}
/** Admission for an external query: throws on the existing upstream refusal,
 * so an x402 validate binding can refuse the request before a payment challenge.
 * Carrier admission keeps content types unresolved, as admitTypedMarkCarrier
 * does; it establishes no external claim's truth or ownership.
 */
export function validateSignGraphQuery(graph, subject, pattern = {}) {
  admittedQuery(graph, subject, pattern);
}
/** Pure query of a received SignGraph. Return its original addressed edges,
 * including every selected witness, through the same admission as validation.
 * This is an edge read projection, never a new closed graph or a truth verdict.
 */
export function querySignGraph(graph, subject, pattern = {}) {
  return admittedQuery(graph, subject, pattern);
}
function admittedPage(graph, subject, pattern, options) {
  if (!options || typeof options !== "object" || Array.isArray(options) ||
      Object.keys(options).some(key => !["limit", "cursor"].includes(key)))
    throwRefusal(refused("invalid-page", "page options permit only limit and cursor"));
  const limit = options.limit === undefined ? 100 : options.limit;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
    throwRefusal(refused("invalid-page", "page limit must be an integer from 1 through 1000"));

  const { graph: verified, reference } = admittedGraphScope(graph, subject);
  const field = graphFields.get(verified);
  const query = semanticId({ subject, pattern });
  const cursor = options.cursor ?? null;
  if (cursor !== null && (!cursor || typeof cursor !== "object" || Array.isArray(cursor) ||
      Object.keys(cursor).length !== 3 ||
      !["graph", "query", "after"].every(key => Object.hasOwn(cursor, key) && typeof cursor[key] === "string") ||
      !cursor.after || cursor.graph !== verified.id || cursor.query !== query))
    throwRefusal(refused("invalid-cursor", "cursor must belong to this graph and query"));

  const selector = typeof pattern === "string" ? { predicate: pattern } : pattern;
  // A conflicting historical subject selector must not be overwritten to
  // fabricate a match. Validate it through the original field reader.
  if (!selector || typeof selector !== "object" || Array.isArray(selector) ||
      (Object.hasOwn(selector, "subject") && !coincides(selector.subject, reference))) {
    queryRelationalFieldPage(field, selector, { limit: 1 });
    if (cursor !== null)
      throwRefusal(refused("invalid-cursor", "cursor edge is absent from this query"));
    return Object.freeze({ graph: verified.id, query, edges: Object.freeze([]), next: null });
  }

  // Share indexed filtering/paging with all field consumers; avoid
  // materializing every matched EAVT entry before delivering one page.
  let page;
  try {
    page = queryRelationalFieldPage(field, { ...selector, subject: reference },
      { limit, after: cursor?.after ?? null });
  } catch (error) {
    if (error?.code === "invalid-cursor")
      throwRefusal(refused("invalid-cursor", "cursor edge is absent from this query"));
    throw error;
  }
  const sourceEdges = graphEdgesById.get(verified);
  const edges = Object.freeze(page.statements.map(entry => sourceEdges.get(entry.id)));
  const next = page.next === null ? null
    : Object.freeze({ graph: verified.id, query, after: page.next });
  return Object.freeze({ graph: verified.id, query, edges, next });
}
/** Bounded read of the same opaque graph, carrying original EAVT edge identities
 * and typed references rather than mark payloads. A cursor binds the source cut
 * and query; changed graphs or selectors must start again. Page boundaries may
 * separate witnesses, so only next:null establishes that this query is complete.
 * This projection neither admits a new closed graph nor determines claim truth.
 */
export function querySignGraphPage(graph, subject, pattern = {}, options = {}) {
  return admittedPage(graph, subject, pattern, options);
}
/** Same refusal boundary as page computation, usable before an x402 challenge. */
export function validateSignGraphPage(graph, subject, pattern = {}, options = {}) {
  admittedPage(graph, subject, pattern, options);
}
/** Glue an entire family of graph cuts in one comparison. Identical relation
 * declarations, cells and edges agree by SCA identity; incompatible
 * declarations of the same predicate obstruct gluing on that predicate and
 * its edges, while compatible predicates still glue. The result is
 * permutation-invariant for this fixed family of cuts.
 *
 * IMPORTANT: with obstructions this is a *partial section projection*, not
 * an associative join of graphs. The returned graph has forgotten all
 * obstructed declarations and edges. Applying glueSignGraphs again to just
 * that projected graph can reintroduce a formerly obstructed predicate.
 * Retain the source cuts and obstruction receipt to revisit consistency;
 * do not treat a projection as a lossless CRDT state. */
export function glueSignGraphs(...graphs) {
  // Treat graph cuts as untrusted at the gluing boundary: reconstruct every
  // member and verify its content address before taking evidence from it.
  // A forged or stale graph must never enter a downstream decision projection.
  const verified = [];
  for (const graph of graphs) {
    if (!graph || !Array.isArray(graph.edges)) return refused("invalid-graph", "graph cut needs addressed edges");
    const carrier = admit(semanticGraphType, graph);
    if (!carrier.ok) return refused("invalid-graph", "graph cut does not satisfy its declared carrier");
    const checked = createSignGraph({
      cells: graph.cells,
      relations: graph.relations,
      edges: graph.edges.map(entry => entry.edge),
    });
    if (!checked.ok) return checked;
    // A graph's content address binds its actual stored representation,
    // including the EAVT-addressed member edges. Do not infer edge identity
    // from semanticId(edge): relationalField addresses {e,a,v,t}, not the
    // {subject,predicate,object,witness} representation of an edge.
    try {
      const suppliedContent = { kind: graph.kind, cells: graph.cells, relations: graph.relations, edges: graph.edges };
      if (semanticId(suppliedContent) !== graph.id || checked.value.id !== graph.id)
        return refused("identity-mismatch", "graph cut's contents do not match its advertised identity");
      const expected = new Map(checked.value.edges.map(entry => [semanticId(entry.edge), entry.id]));
      if (graph.edges.length !== expected.size ||
          graph.edges.some(entry => expected.get(semanticId(entry.edge)) !== entry.id))
        return refused("identity-mismatch", "graph cut contains an edge whose EAVT identity does not match its content");
    } catch {
      return refused("identity-mismatch", "graph cut contains unaddressable content");
    }
    verified.push(checked.value);
  }
  const cells = new Map(), declarations = new Map(), edges = new Map();
  for (const graph of verified) {
    for (const cell of graph.cells) { const prior = cells.get(cell.id); if (prior && semanticId(prior) !== semanticId(cell)) return refused("duplicate-cell", `cell ${cell.id} has conflicting content across graph cuts`); cells.set(cell.id, cell); }
    for (const relation of graph.relations) {
      const told = declarations.get(relation.id) ?? new Map(), key = semanticId(relation), cuts = told.get(key) ?? { relation, graphs: [] };
      cuts.graphs.push(graph.id); told.set(key, cuts); declarations.set(relation.id, told);
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
  return accepted(Object.freeze({ graph: glued.value, obstructions: Object.freeze(obstructions.sort((left, right) => left.relation.localeCompare(right.relation))) }));
}

