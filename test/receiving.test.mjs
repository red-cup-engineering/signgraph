import test from "node:test";
import assert from "node:assert/strict";
import { cohomologyOfCells } from "@red-cup-engineering/signgraph/cohomology";
import { site } from "@red-cup-engineering/signgraph/site";
import { posit } from "@red-cup-engineering/signgraph/valuation";
import { defineType } from "@red-cup-engineering/typed-content";
import { admitStatement, defineRelation } from "@red-cup-engineering/signgraph/typed-relations";
import { cell } from "@red-cup-engineering/signcell";

test("closing a triangle raises the cycle rank while keeping an independent component", () => {
  const edge = (source, target) => cell(source, "bond", target, { for: ["round"] });
  const path = [edge("a", "b"), edge("b", "c")];
  const cells = [...path, edge("c", "a"), edge("d", "e")];
  assert.equal(cohomologyOfCells(path).firstCohomology.rank, 0);
  const ring = cohomologyOfCells(cells);
  assert.equal(ring.zeroCohomology.rank, 2);
  assert.equal(ring.firstCohomology.rank, 1);
  assert.deepEqual(cohomologyOfCells(JSON.parse(JSON.stringify(cells))), ring);
  const carrier = site(cells);
  assert.deepEqual(posit(carrier, cells).traces, posit(carrier, JSON.parse(JSON.stringify(cells))).traces);
});

test("a typed score statement retains its source identity and rejects a wrong witness type", () => {
  const text = defineType({
    id: "urn:test:game-text", name: "Game text", description: "Score coordinate",
    schema: { type: "string" }, parents: [],
  });
  assert.equal(text.ok, true);
  const declared = defineRelation({ id: "earned", domain: text.value, codomain: text.value, witness: text.value });
  assert.equal(declared.ok, true);
  const statement = { subject: "pantry", predicate: "earned", object: "score", witness: "round" };
  const { id } = admitStatement(declared.value, statement).value;
  assert.equal(id, "ni:///sha-256;vof5Ma2ukEv1-92oNglhbT-BkrhR2rBXSp28682SsGc");
  assert.equal(admitStatement(declared.value, { ...statement, witness: 42 }).refusal.code, "invalid-witness");
});
