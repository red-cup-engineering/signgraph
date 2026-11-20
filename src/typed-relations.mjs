import {
  hasFields, readSourceRecord, exactIdentity, readSourceArray, coincidenceKey, semanticId,
} from "@red-cup-engineering/semiotic-content-address-system";
import {
  collectTypeSystem, admit, snapshotFiniteJson, typeSystemDocument, typeIdentity, sameType,
  isSubtypeOf,
} from "@red-cup-engineering/typed-content";
import {
  isUtterance, cell, cellSet, claimCoordinate,
} from "@red-cup-engineering/signcell";
import {
  makeContext,
} from "@red-cup-engineering/metrologic/closure/formal-context";

const relationAccepted = value => Object.freeze({ ok: true, value });
const relationMessage = error => error instanceof Error ? error.message : String(error);
const relationOrder = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
/** Typed relation admission and page projection. */

const relationFailure = (key, value, message) => Object.freeze({ ok: false, refusal: Object.freeze({ [key]: value, message }) });
const refused = (code, message) => relationFailure("code", code, message);
const thingError = (kind, message) => relationFailure("kind", kind, message);
const exact = (value, keys) => isRecord(value) && hasFields(value, keys);
const byId = (a, b) => relationOrder(a.id, b.id);
const relations = new WeakSet();
const fieldIndexes = new WeakMap();
const positions = ["subject", "predicate", "object", "witness"];

function defineRelation(input) {
  let relation;
  try {
    const { id, domain, codomain, witness } = readSourceRecord(input, "relation declaration");
    if (typeof id !== "string" || !id.trim()) throw new TypeError("relation id must be nonempty");
    relation = Object.freeze({ id, domain, codomain, witness });
  } catch (error) {
    return refused("invalid-relation", relationMessage(error));
  }
  const types = collectTypeSystem([relation.domain, relation.codomain, relation.witness]);
  if (!types.ok) return refused("invalid-relation-types", types.refusal.message);
  relations.add(relation);
  return relationAccepted(relation);
}

function checkStatement(relation, statement) {
  if (!exact(statement, positions)) return refused("invalid-statement", "expected subject, predicate, object, witness");
  if (statement.predicate !== relation.id) return refused("wrong-predicate", "statement names another predicate");
  const { subject: e, predicate: a, object: v, witness: t } = statement;
  for (const [position, type] of [["subject", relation.domain], ["object", relation.codomain], ["witness", relation.witness]]) {
    const checked = admit(type, statement[position]);
    if (!checked.ok)
      return refused(`invalid-${position}`, checked.refusal.issues.map(issue => `${issue.path || "/"} ${issue.message}`).join("; "));
  }
  return relationAccepted(Object.freeze({ id: exactIdentity({ e, a, v, t }), statement }));
}

function admitStatement(relation, input) {
  if (!relations.has(relation)) return refused("unknown-relation", "relation was not established by defineRelation");
  try { return checkStatement(relation, snapshotFiniteJson(input)); }
  catch (error) { return refused("invalid-statement", relationMessage(error)); }
}

function prepareCatalog(declarations) {
  const predicates = new Map();
  try {
    for (const relation of readSourceArray(declarations, "relation declarations")) {
      if (!relations.has(relation)) return refused("unknown-relation", "field contains an undeclared relation");
      if (predicates.has(relation.id)) return refused("duplicate-relation", `duplicate relation ${relation.id}`);
      predicates.set(relation.id, relation);
    }
    const types = collectTypeSystem([...predicates.values()].flatMap(({ domain, codomain, witness }) => [domain, codomain, witness]));
    const document = types.ok ? typeSystemDocument(types.value) : types;
    if (!document.ok) return refused("invalid-field-types", document.refusal.message);
    const ordered = Object.freeze([...predicates.values()].sort(byId));
    const catalogIdentity = exactIdentity({
      typeSystem: document.value.identity,
      relations: ordered.map(({ id, domain, codomain, witness }) => ({ id, domain: domain.id, codomain: codomain.id, witness: witness.id })),
    });
    return relationAccepted({ catalogIdentity, ordered, predicates });
  } catch (error) {
    return refused("invalid-field-types", relationMessage(error));
  }
}

function addRow(catalog, rows, statement, advertisedId) {
  const relation = catalog.predicates.get(statement?.predicate);
  if (!relation) return refused("unknown-predicate", "statement predicate is not declared in this field");
  const checked = checkStatement(relation, statement);
  if (!checked.ok) return checked;
  if (advertisedId !== undefined && advertisedId !== checked.value.id)
    return refused("statement-identity-mismatch", "statement bytes do not match the advertised identity");
  rows.set(checked.value.id, checked.value);
}

function buildField(catalog, rows) {
  const field = Object.freeze({
    catalogIdentity: catalog.catalogIdentity,
    relations: catalog.ordered,
    statements: Object.freeze([...rows.values()].sort(byId)),
  });
  fieldIndexes.set(field, new Map());
  return relationAccepted(field);
}

function createRelationalField(declarations, values = []) {
  const catalog = prepareCatalog(declarations);
  if (!catalog.ok) return catalog;
  const rows = new Map();
  try {
    for (const value of values) {
      const issue = addRow(catalog.value, rows, snapshotFiniteJson(value));
      if (issue) return issue;
    }
    return buildField(catalog.value, rows);
  } catch (error) {
    return refused("invalid-statement", relationMessage(error));
  }
}

function relationalFieldDocument(field) {
  return Object.freeze({ version: 1, catalogIdentity: field.catalogIdentity, statements: field.statements });
}

function admitDocumentRows(catalog, rows, input) {
  const document = snapshotFiniteJson(input);
  if (!exact(document, ["version", "catalogIdentity", "statements"]) || document.version !== 1 ||
      typeof document.catalogIdentity !== "string" || !Array.isArray(document.statements))
    return refused("invalid-field-document", "expected version 1, catalogIdentity and statements");
  if (document.catalogIdentity !== catalog.catalogIdentity)
    return refused("catalog-mismatch", "replicas use different relation or type declarations");
  for (const entry of document.statements) {
    if (!exact(entry, ["id", "statement"]) || typeof entry.id !== "string")
      return refused("invalid-field-document", "expected an id and a statement");
    const issue = addRow(catalog, rows, entry.statement, entry.id);
    if (issue) return issue;
  }
}

function admitRelationalFieldDocument(declarations, input) {
  const catalog = prepareCatalog(declarations);
  if (!catalog.ok) return catalog;
  const rows = new Map();
  try {
    return admitDocumentRows(catalog.value, rows, input) ?? buildField(catalog.value, rows);
  } catch (error) {
    return refused("invalid-field-document", relationMessage(error));
  }
}

function mergeRelationalFields(declarations, ...fields) {
  const catalog = prepareCatalog(declarations);
  if (!catalog.ok) return catalog;
  const rows = new Map();
  try {
    for (const source of fields) {
      const field = readSourceRecord(source, "relational field");
      if (fieldIndexes.has(source) && field.catalogIdentity === catalog.value.catalogIdentity) {
        for (const entry of field.statements) rows.set(entry.id, entry);
      } else {
        const issue = admitDocumentRows(catalog.value, rows, relationalFieldDocument(field));
        if (issue) return issue;
      }
    }
    return buildField(catalog.value, rows);
  } catch (error) {
    return refused("invalid-field-document", relationMessage(error));
  }
}

const positionKey = (position, value) => position === "predicate" ? value : coincidenceKey(value);

function bucket(field, position, key) {
  const indexes = fieldIndexes.get(field);
  let index = indexes?.get(position);
  if (!index) {
    index = new Map();
    for (const entry of field.statements) {
      const rowKey = positionKey(position, entry.statement[position]);
      if (!index.has(rowKey)) index.set(rowKey, []);
      index.get(rowKey).push(entry);
    }
    indexes?.set(position, index);
  }
  return index.get(key) ?? [];
}

function query(field, pattern) {
  const selection = typeof pattern === "string" ? { predicate: pattern } : snapshotFiniteJson(pattern);
  if (!isRecord(selection) || !Object.keys(selection).every(key => positions.includes(key)) ||
      (Object.hasOwn(selection, "predicate") && typeof selection.predicate !== "string"))
    throw new TypeError("expected a predicate or statement pattern");
  const buckets = Object.entries(selection).map(([position, value]) => bucket(field, position, positionKey(position, value)));
  const [candidates = field.statements, ...rest] = buckets.sort((a, b) => a.length - b.length);
  const memberships = rest.map(items => new Set(items));
  return { candidates, matches: row => memberships.every(items => items.has(row)) };
}

function queryRelationalField(field, pattern) {
  const { candidates, matches } = query(field, pattern);
  return Object.freeze(candidates.filter(matches));
}

function locate(candidates, id, sorted) {
  if (!sorted) return candidates.findIndex(entry => entry.id === id);
  let start = 0, end = candidates.length;
  while (start < end) {
    const middle = start + Math.floor((end - start) / 2);
    if (candidates[middle].id < id) start = middle + 1;
    else end = middle;
  }
  return candidates[start]?.id === id ? start : -1;
}

/** Page in field order. A cursor identifies a statement in the same query. */
function queryRelationalFieldPage(field, pattern, options = {}) {
  const selection = snapshotFiniteJson(options);
  if (!isRecord(selection) || !Object.keys(selection).every(key => key === "limit" || key === "after"))
    throw new TypeError("field page options permit only limit and after");
  const { after = null, limit = Number.MAX_SAFE_INTEGER } = selection;
  if (!Number.isSafeInteger(limit) || limit < 1 || (after !== null && (typeof after !== "string" || !after)))
    throw new TypeError("expected a positive limit and optional statement cursor");

  const { candidates, matches } = query(field, pattern);
  const cursor = after === null ? -1 : locate(candidates, after, fieldIndexes.has(field));
  if (after !== null && (cursor < 0 || !matches(candidates[cursor])))
    throw Object.assign(new TypeError("field page cursor is absent from this query"), { code: "invalid-cursor" });

  const statements = [];
  for (let index = cursor + 1; index < candidates.length; index++) {
    if (!matches(candidates[index])) continue;
    if (statements.length === limit) return Object.freeze({ statements: Object.freeze(statements), next: statements.at(-1).id });
    statements.push(candidates[index]);
  }
  return Object.freeze({ statements: Object.freeze(statements), next: null });
}

function makeThing(input) {
  let source, type, attributes;
  try {
    source = readSourceRecord(input, "Thing");
    if (Object.keys(source).some(key => key !== "type" && key !== "attributes")) throw new TypeError("expected type and attributes");
  } catch (error) {
    return thingError("invalid-thing-input", relationMessage(error));
  }
  try { type = typeIdentity(source.type); }
  catch (error) { return thingError("invalid-thing-type", relationMessage(error)); }
  try {
    attributes = snapshotFiniteJson(source.attributes);
    if (!isRecord(attributes)) throw new TypeError("Thing attributes must be a JSON object");
  } catch (error) { return thingError("invalid-thing-attributes", relationMessage(error)); }
  const checked = admit(source.type, attributes);
  return checked.ok ? relationAccepted(Object.freeze({ id: semanticId({ type, attributes }), type, attributes })) : checked;
}

function deriveThingFromUtterance(input = {}) {
  try {
    const envelope = readSourceRecord(input, "Thing presentation");
    if (!exact(envelope, ["type", "source"])) throw new TypeError("expected type and source");
    const source = snapshotFiniteJson(envelope.source);
    if (!isUtterance(source)) throw new TypeError("expected a SignCell utterance");
    const result = makeThing({ type: envelope.type, attributes: source.claim.mark.value });
    return result.ok ? relationAccepted(Object.freeze({ kind: "signcell.thingFromUtterance.v1", source, thing: result.value })) : result;
  } catch (error) { return thingError("invalid-thing-source", relationMessage(error)); }
}

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const RDFS_SUBCLASS = "http://www.w3.org/2000/01/rdf-schema#subClassOf";
const CELL_LIMIT = 16384;

function projectTypedThingCells(input = {}) {
  let envelope, entries;
  try {
    envelope = readSourceRecord(input, "Thing projection");
    if (Object.keys(envelope).some(key => !["entries", "thingType", "resourceType", "field"].includes(key)))
      throw new TypeError("expected entries, thingType, resourceType and optional field");
  } catch (error) { return thingError("invalid-thing-cell-input", relationMessage(error)); }
  try {
    entries = readSourceArray(envelope.entries, "Thing presentations", 256);
    if (!entries.length) throw new TypeError("expected at least one presentation");
  } catch (error) { return thingError("invalid-thing-presentations", relationMessage(error)); }

  const { thingType, resourceType, field } = envelope;
  try {
    typeIdentity(thingType);
    typeIdentity(resourceType);
  } catch (error) { return thingError("invalid-thing-hierarchy", relationMessage(error)); }
  if (sameType(thingType, resourceType) || !isSubtypeOf(resourceType, thingType))
    return thingError("invalid-resource-specialization", "Resource must be a distinct subtype of Thing");

  const presentations = [], cells = [], rdf = new Map(), types = new Map(), things = new Map(), resources = new Map();
  const budget = new RangeError("Thing projection exceeds the cell limit");
  function add(subject, predicate, object, witness, rdfTriple = false) {
    if (cells.length >= CELL_LIMIT) throw budget;
    cells.push(cell(subject, predicate, object, { for: [witness] }));
    if (rdfTriple) {
      const triple = Object.freeze([subject, predicate, object]);
      rdf.set(JSON.stringify(triple), triple);
    }
  }
  try {
    for (const [presentationIndex, entry] of entries.entries()) {
      let type;
      try { ({ type } = readSourceRecord(entry, "Thing presentation")); }
      catch (error) { return thingError("invalid-thing-presentation", relationMessage(error)); }
      const result = deriveThingFromUtterance(entry);
      if (!result.ok) return result;
      if (!isSubtypeOf(type, thingType)) return thingError("not-a-thing-subtype", "type does not specialize Thing");

      const { source, thing } = result.value;
      const sourcePresentationId = semanticId(source);
      const resource = isSubtypeOf(type, resourceType);
      presentations.push(Object.freeze({ kind: "signcell.thing-cell-presentation/v1", thing, source, sourcePresentationId, presentationIndex, resource }));
      things.set(thing.id, thing);
      if (resource) resources.set(thing.id, thing);
      const witness = { kind: "signcell.thing-source/v1", sourcePresentationId };
      add(thing.id, "signcell:presented-by", sourcePresentationId, witness);
      for (const key of Object.keys(thing.attributes).sort())
        add(thing.id, `signcell:attribute:${key}`, thing.attributes[key], witness);

      const catalog = collectTypeSystem([type]);
      if (!catalog.ok) return catalog;
      for (const ancestor of catalog.value.types) {
        const id = typeIdentity(ancestor);
        types.set(id, ancestor);
        add(thing.id, RDF_TYPE, id, witness, true);
      }
    }
    for (const [id, type] of types) {
      for (const parent of type.parents) {
        const parentId = typeIdentity(parent);
        add(id, RDFS_SUBCLASS, parentId, { kind: "signcell.declared-type-parent/v1", declaration: id, parent: parentId }, true);
      }
    }
    if (field !== undefined) {
      let relationInput;
      try { relationInput = readSourceRecord(field, "Thing relations"); }
      catch (error) { return thingError("invalid-thing-relational-field", relationMessage(error)); }
      if (!exact(relationInput, ["declarations", "document"]))
        return thingError("invalid-thing-relational-field", "expected relation declarations and a field document");
      const admitted = admitRelationalFieldDocument(relationInput.declarations, relationInput.document);
      if (!admitted.ok) return thingError("invalid-thing-relational-field", admitted.refusal.message);
      for (const { id, statement: { subject, predicate, object, witness } } of admitted.value.statements) {
        if (!things.has(subject) || !things.has(object))
          return thingError("foreign-thing-relation", "relation endpoints must identify admitted Things");
        add(subject, predicate, object, { kind: "signcell.original-thing-relation/v1", field: admitted.value.catalogIdentity, statement: id, witness });
      }
    }
  } catch (error) {
    if (error !== budget) throw error;
    return thingError("thing-cell-budget-exceeded", error.message);
  }
  return relationAccepted(Object.freeze({
    kind: "signcell.typed-thing-cellular-presentation/v1",
    presentations: Object.freeze(presentations), things: Object.freeze([...things.values()]), resources: Object.freeze([...resources.values()]),
    cells: cellSet(cells),
    rdfTriples: Object.freeze([...rdf.keys()].sort().map(key => rdf.get(key))),
    status: "source-witnessed-cell-projection",
  }));
}

function deriveThingQualityContext({ things, field, predicate } = {}) {
  if (!Array.isArray(things) || !things.length || !fieldIndexes.has(field) || typeof predicate !== "string" || !predicate)
    return refused("invalid-quality-context", "expected Thing presentations, an admitted field and a predicate");
  if (!field.relations.some(relation => relation.id === predicate))
    return refused("unknown-quality-predicate", "quality predicate is not declared");

  const presentations = [], entities = new Map(), attributes = new Map(), supporting = [], opposing = [];
  for (const input of things) {
    const result = deriveThingFromUtterance(input);
    if (!result.ok) return refused("invalid-quality-thing", result.refusal.message ?? "Thing presentation was not admitted");
    const { thing, source } = result.value;
    if (!entities.has(thing.id)) entities.set(thing.id, thing);
    presentations.push(Object.freeze({ thingId: thing.id, source }));
  }
  for (const { id, statement: { subject, object, witness } } of queryRelationalField(field, predicate)) {
    if (!entities.has(subject)) return refused("foreign-quality-subject", "statement subject is not an admitted Thing");
    if (!isRecord(witness) || !/^ni:\/\/\/sha-256;[A-Za-z0-9_-]{43}$/u.test(witness.source) ||
        !["for", "against"].includes(witness.side) || !["observed", "inferred"].includes(witness.status))
      return refused("incomplete-quality-witness", "witness requires a source address, side and status");

    const coordinate = claimCoordinate(predicate, object);
    if (!attributes.has(coordinate)) attributes.set(coordinate, { coordinate, predicate, object, witnesses: [] });
    attributes.get(coordinate).witnesses.push(Object.freeze({ ...witness, thingId: subject, statementId: id, sourceWitness: witness }));
    (witness.side === "for" ? supporting : opposing).push([subject, coordinate]);
  }
  return relationAccepted(Object.freeze({
    kind: "signcell.thing-quality-context.v1", sourceField: field.catalogIdentity,
    things: Object.freeze([...entities.values()]), sourcePresentations: Object.freeze(presentations),
    qualities: Object.freeze([...attributes.values()].map(({ witnesses, ...quality }) => Object.freeze({ ...quality, witnesses: Object.freeze(witnesses) }))),
    context: makeContext([...entities.keys()], [...attributes.keys()], supporting, opposing),
    status: "source-qualified-candidate-not-an-authoritative-world-claim", authority: "not-conferred",
  }));
}

export {
  admitRelationalFieldDocument, admitStatement, createRelationalField, defineRelation,
  deriveThingFromUtterance, deriveThingQualityContext, makeThing, mergeRelationalFields,
  projectTypedThingCells, queryRelationalField, queryRelationalFieldPage, relationalFieldDocument,
};
