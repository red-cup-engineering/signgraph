import assert from "node:assert/strict";
import test from "node:test";
import { createSemioticCell, utterance } from "@red-cup-engineering/signcell";
import { semanticId } from "@red-cup-engineering/semiotic-content-address-system";
import { createTypedMark, defineType, referenceOf } from "@red-cup-engineering/typed-content";
import {
  admitSignGraph, createSignGraph, createSignGraphPredicateReader, glueSignGraphs,
  querySignGraph, querySignGraphPage, validateSignGraphPage, validateSignGraphQuery,
} from "@red-cup-engineering/signgraph/semantic-graph";
import { findSignGraphRoute, projectSignGraphTopology } from "@red-cup-engineering/signgraph/graph";

function value(result) {
  assert.equal(result.ok, true, JSON.stringify(result.refusal));
  return result.value;
}

const type = name => value(defineType({
  id: "https://example.org/" + name, name, description: name, parents: [], schema: { type: "object" },
}));
const memberType = type("member"), reportType = type("report"), receiptType = type("receipt");
const display = utterance("same", "same");
const members = ["site one", "site two"].map(occurrence => {
  const source = createSemioticCell({ occurrence, source: display });
  return value(createTypedMark(memberType, { display: "same", source: source.id }));
});
const statements = ["for", "against"].map(lane => value(createTypedMark(reportType, { lane })));
const [subject, object] = members.map(referenceOf);
const declaration = (id, type = reportType) => ({
  id, subjectTypes: [memberType.id], objectTypes: [memberType.id], witnessTypes: [type.id],
});
const inputs = (relations = [declaration("relates")]) => ({
  cells: [...members, ...statements], relations,
  edges: statements.map(at => ({ subject, object, predicate: "relates", witness: referenceOf(at) })),
});

test("closed graph admission reads inert data and qualifies original EAVT addresses", () => {
  const source = inputs();
  let calls = 0;
  const executable = { ...source, get cells() { calls += 1; return source.cells; } };
  assert.equal(createSignGraph(executable).refusal.code, "invalid-graph");
  const edge = { ...source.edges[0], get witness() { calls += 1; return referenceOf(statements[0]); } };
  assert.equal(createSignGraph({ ...source, edges: [edge] }).refusal.code, "invalid-edge");
  assert.equal(calls, 0);
  const graph = value(createSignGraph(source));
  assert.notEqual(subject.id, object.id);
  assert.strictEqual(value(admitSignGraph(graph)), graph);
  assert.deepEqual(value(admitSignGraph(structuredClone(graph))), graph);
  const { id, ...forgery } = structuredClone(graph);
  forgery.edges[0].id = forgery.edges[1].id;
  assert.equal(admitSignGraph({ ...forgery, id }).refusal.code, "identity-mismatch");
  assert.equal(admitSignGraph({ ...forgery, id: semanticId(forgery) }).refusal.code, "identity-mismatch");
});

test("pages and routes retain parallel source testimony and reject moved subjects", () => {
  const graph = value(createSignGraph(inputs()));
  const cut = structuredClone(graph);
  const first = querySignGraphPage(cut, subject, "relates", { limit: 1 });
  const second = querySignGraphPage(cut, subject, "relates", { limit: 1, cursor: first.next });
  assert.equal(second.next, null);
  assert.deepEqual([...first.edges, ...second.edges], graph.edges);
  assert.throws(() => querySignGraphPage(cut, subject, {}, { cursor: first.next }), { code: "invalid-cursor" });
  for (const operation of [querySignGraph, querySignGraphPage, validateSignGraphQuery, validateSignGraphPage])
    assert.throws(() => operation(cut, subject, { subject: object }), { code: "invalid-query" });
  const route = findSignGraphRoute(cut, subject, object, { predicate: "relates" });
  assert.equal(route.distance, 1);
  assert.deepEqual(route.hops[0].edges, graph.edges);
  assert.equal(findSignGraphRoute(cut, object, subject).reachable, false);
  assert.equal(projectSignGraphTopology(cut).size(), 2);
  assert.throws(() => findSignGraphRoute(cut, subject, object, { predicate: "undeclared" }), /declared/);
});

test("typed predicate views preserve role constraints and gluing retains obstruction sources", () => {
  const graph = value(createSignGraph(inputs([declaration("relates"), declaration("reports", receiptType)])));
  assert.throws(() => createSignGraphPredicateReader(graph, { specializations: [["relates", "reports"]] }), /witness types/);
  assert.throws(() => createSignGraphPredicateReader(graph, { converses: [["relates", "reports"]] }), /witness types/);
  const other = value(createSignGraph({ cells: members, relations: [declaration("relates", receiptType)], edges: [] }));
  const glued = value(glueSignGraphs(graph, structuredClone(other)));
  assert.deepEqual(glued, value(glueSignGraphs(other, graph)));
  assert.deepEqual(glued.obstructions, [{
    code: "conflicting-relation", relation: "relates", graphs: [graph.id, other.id].sort(),
  }]);
  assert.deepEqual(glued.graph.edges, []);
});
