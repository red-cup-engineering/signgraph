import assert from "node:assert/strict";
import test from "node:test";
import { defineType } from "@red-cup-engineering/signcell/type-system";
import { semanticId } from "@red-cup-engineering/computer-content-address-engineering-services-section/semiotic-content-address";
import { createTypedMark, referenceOf } from "@red-cup-engineering/signcell/typed-mark";
import { createSignGraph, edgesFrom, querySignGraph, querySignGraphPage, validateSignGraphPage, validateSignGraphQuery } from "../src/semantic-graph.mjs";

const value = result => { assert.equal(result.ok, true, JSON.stringify(result)); return result.value; };
const markType = value(defineType({ id: "test.opaque-query-mark@1", name: "Opaque query mark", description: "Caller-owned uninterpreted carrier content.", schema: {}, parents: [] }));
function example() {
  const marks = ["subject", { ocean: [null, "ta\u0302che"] }, "witness-a", "witness-b"].map(content => value(createTypedMark(markType, content)));
  const [subject, object, witnessA, witnessB] = marks.map(referenceOf);
  const relation = id => ({ id, subjectTypes: [markType.id], objectTypes: [markType.id], witnessTypes: [markType.id] });
  const graph = value(createSignGraph({ cells: marks, relations: [relation("supports"), relation("refutes")], edges: [
    { subject, predicate: "supports", object, witness: witnessA },
    { subject, predicate: "supports", object, witness: witnessB },
    { subject, predicate: "refutes", object, witness: witnessA },
  ] }));
  return { graph, subject, object, witnessA, witnessB };
}
const wire = value => JSON.parse(JSON.stringify(value));
function readdress(graph) {
  graph.id = semanticId({ kind: graph.kind, cells: graph.cells, relations: graph.relations, edges: graph.edges });
  return graph;
}

test("a received graph query preserves opaque marks and every addressed conflicting witness", () => {
  const input = example(), request = wire(input), before = JSON.stringify(request);
  assert.equal(validateSignGraphQuery(request.graph, request.subject), undefined);
  const all = querySignGraph(request.graph, request.subject);
  assert.deepEqual(all, edgesFrom(input.graph, input.subject));
  assert.deepEqual(new Set(all.map(entry => entry.edge.predicate)), new Set(["supports", "refutes"]));
  const scoped = querySignGraph(request.graph, request.subject, { predicate: "supports", object: request.object });
  assert.equal(scoped.length, 2);
  assert.deepEqual(new Set(scoped.map(entry => entry.edge.witness.id)), new Set([input.witnessA.id, input.witnessB.id]));
  assert.ok(scoped.every(entry => input.graph.edges.some(original => original.id === entry.id)));
  assert.equal(JSON.stringify(request), before, "pure admission/query does not mutate caller carriers");
  assert.equal(Object.isFrozen(scoped), true);
  assert.equal(Object.isFrozen(scoped[0].edge.witness), true);
  assert.deepEqual(querySignGraph(request.graph, request.subject, { predicate: "absent" }), []);
});

test("query validation throws on forged graph, edge, mark, endpoint and witness identities", () => {
  const input = example();
  const changedGraph = wire(input.graph); changedGraph.id = "ni:forged";
  const changedEdge = wire(input.graph); changedEdge.edges[0].id = "ni:forged"; readdress(changedEdge);
  const changedMark = wire(input.graph); changedMark.cells[0].content = "forged content"; readdress(changedMark);
  const missingWitness = wire(input.graph); missingWitness.edges[0].edge.witness.id = "ni:missing"; readdress(missingWitness);
  const changedType = wire(input.graph); changedType.edges[0].edge.object.type = "unadmitted-type"; readdress(changedType);
  for (const graph of [changedGraph, changedEdge, changedMark, missingWitness, changedType]) {
    assert.throws(() => validateSignGraphQuery(graph, input.subject), TypeError);
    assert.throws(() => querySignGraph(graph, input.subject), TypeError);
  }
  assert.throws(() => validateSignGraphQuery(changedGraph, input.subject), error => error.code === "identity-mismatch");
  assert.throws(() => validateSignGraphQuery(missingWitness, input.subject), error => error.code === "unknown-cell");
});

test("typed query subjects are admitted members and invalid selectors cannot silently become a paid empty result", () => {
  const input = example();
  for (const subject of [null, { id: input.subject.id }, { ...input.subject, extra: "not a reference" }])
    assert.throws(() => validateSignGraphQuery(input.graph, subject), error => error.code === "invalid-subject");
  assert.throws(() => validateSignGraphQuery(input.graph, { id: "ni:missing", type: markType.id }), error => error.code === "unknown-cell");
  assert.throws(() => validateSignGraphQuery(input.graph, { ...input.subject, type: "wrong-type" }), error => error.code === "type-mismatch");
  for (const pattern of [null, [], { subject: undefined }, { unknown: true }])
    assert.throws(() => validateSignGraphQuery(input.graph, input.subject, pattern), TypeError);
});

test("bounded pages retain source identities and all witnesses across continuation without exposing payloads", () => {
  const input = example(), received = wire(input.graph);
  const first = querySignGraphPage(received, input.subject, {}, { limit: 1 });
  assert.equal(first.graph, input.graph.id);
  assert.equal(first.edges.length, 1);
  assert.equal(first.next.graph, input.graph.id);
  assert.equal(first.next.query, first.query);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.next), true);
  const second = querySignGraphPage(received, input.subject, {}, { limit: 1, cursor: wire(first.next) });
  const third = querySignGraphPage(received, input.subject, {}, { limit: 1, cursor: wire(second.next) });
  assert.equal(third.next, null);
  assert.deepEqual([...first.edges, ...second.edges, ...third.edges], querySignGraph(input.graph, input.subject));
  assert.ok(!JSON.stringify(first).includes("ocean"), "mark contents never enter a reference-only read");
  assert.equal(validateSignGraphPage(received, input.subject, {}, { limit: 1, cursor: first.next }), undefined);
  assert.deepEqual(querySignGraphPage(input.graph, input.subject, { predicate: "absent" }).edges, []);
  assert.equal(querySignGraphPage(input.graph, input.subject, { predicate: "absent" }).next, null);
});

test("page validation refuses stale or forged cursors and unsupported resource bounds before charging", () => {
  const input = example(), first = querySignGraphPage(input.graph, input.subject, {}, { limit: 1 });
  for (const options of [null, [], { limit: 0 }, { limit: 1001 }, { limit: 1.5 }, { limit: "1" }, { offset: 0 }])
    assert.throws(() => validateSignGraphPage(input.graph, input.subject, {}, options), error => error.code === "invalid-page");
  for (const cursor of ["opaque", {}, { ...first.next, extra: true }, { ...first.next, graph: "ni:stale" }, { ...first.next, query: "ni:wrong" }, { ...first.next, after: "ni:missing" }])
    assert.throws(() => querySignGraphPage(input.graph, input.subject, {}, { cursor }), error => error.code === "invalid-cursor");
  assert.throws(() => querySignGraphPage(input.graph, input.subject, { predicate: "supports" }, { cursor: first.next }), error => error.code === "invalid-cursor");
  const changed = wire(input.graph); changed.edges.pop(); readdress(changed);
  assert.throws(() => querySignGraphPage(changed, input.subject, {}, { cursor: first.next }), error => error.code === "invalid-cursor");
  const forged = wire(input.graph); forged.cells[0].content = "tampered";
  assert.throws(() => validateSignGraphPage(forged, input.subject, {}, { limit: 1 }), TypeError);
});

test("a received presentation is readmitted on each query after caller mutation", () => {
  const input = example(), received = wire(input.graph);
  querySignGraph(received, input.subject);
  received.edges[0].id = "ni:forged-after-first-read";
  assert.throws(() => querySignGraph(received, input.subject), error => error.code === "identity-mismatch");
  assert.throws(() => validateSignGraphPage(received, input.subject), error => error.code === "identity-mismatch");
});


test("paged paid queries share the indexed field without changing subject and witness semantics", () => {
  const { graph, subject, object } = example();
  const pattern = { subject, predicate: "supports" };
  const first = querySignGraphPage(graph, subject, pattern, { limit: 1 });
  assert.ok(first.next);
  const second = querySignGraphPage(graph, subject, pattern, { limit: 1, cursor: wire(first.next) });
  assert.equal(second.next, null);
  assert.deepEqual([...first.edges, ...second.edges], querySignGraph(graph, subject, pattern));
  assert.ok(first.edges.every(entry => graph.edges.some(original => original.id === entry.id)),
    "the page reuses the original EAVT addresses, not substitute cursor identities");
  assert.deepEqual(querySignGraphPage(graph, subject, { subject: object }).edges, [],
    "a conflicting selector cannot be rewritten into the requested subject");
  assert.throws(() => querySignGraphPage(graph, subject, { subject: object }, { cursor: first.next }),
    error => error.code === "invalid-cursor");
  assert.throws(() => querySignGraphPage(graph, subject, pattern,
    { cursor: { ...first.next, after: "" } }), error => error.code === "invalid-cursor");
  for (const selector of [{ subject: undefined }, { nonsense: "unexpected" }, []])
    assert.throws(() => validateSignGraphPage(graph, subject, selector), TypeError);
});
