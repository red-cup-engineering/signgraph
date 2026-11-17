import assert from "node:assert/strict";
import test from "node:test";
import { cell } from "@red-cup-engineering/signcell";
import { defineType } from "@red-cup-engineering/typed-content";
import {
  admitRelationalFieldDocument, createRelationalField, defineRelation, queryRelationalFieldPage, relationalFieldDocument,
} from "@red-cup-engineering/signgraph/typed-relations";
import { prove, structureOf } from "@red-cup-engineering/signgraph/proof-path";

test("typed relation pages carry exact witness spelling after document restoration", () => {
  const text = defineType({
    id: "urn:types:text", name: "Text", description: "Nonempty source text",
    schema: { type: "string", minLength: 1 }, parents: [],
  }).value;
  const declaration = defineRelation({ id: "quotes", domain: text, codomain: text, witness: text });
  assert.ok(declaration.ok);
  const relations = [declaration.value];
  const observations = ["e\u0301", "é"].map(witness => ({
    subject: "reader", predicate: "quotes", object: "passage", witness,
  }));
  const result = createRelationalField(relations, observations);
  assert.ok(result.ok);
  const document = JSON.parse(JSON.stringify(relationalFieldDocument(result.value)));
  const restored = admitRelationalFieldDocument(relations, document);
  assert.ok(restored.ok);
  const pattern = { subject: "reader" };
  const first = queryRelationalFieldPage(restored.value, pattern, { limit: 1 });
  const second = queryRelationalFieldPage(restored.value, pattern, { after: first.next, limit: 1 });
  assert.equal(second.next, null);
  const received = [...first.statements, ...second.statements].map(({ statement }) => statement.witness);
  assert.deepEqual(new Set(received), new Set(observations.map(source => source.witness)));
  assert.throws(() => queryRelationalFieldPage(restored.value, { subject: "other" }, { after: first.next }),
    { code: "invalid-cursor" });
});

test("proof routes use SignCell coordinates and SignGraph's oriented structure", () => {
  const facts = [cell("spruce", "is-a", "tree"), cell("tree", "is-a", "plant")];
  const structure = structureOf(facts);
  const result = prove(structure, "plant", "spruce");
  assert.deepEqual(result.route.steps.map(({ kind, node }) => [kind, node]), [
    ["specialization", "tree"], ["specialization", "spruce"],
  ]);
  assert.equal(prove(structure, "spruce", "plant").path, null);
});
