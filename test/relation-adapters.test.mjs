import test from "node:test";
import assert from "node:assert/strict";
import { utterEvidenceSet, isUtterance } from "@red-cup-engineering/signcell/utterance";
import {
  markdownFrontmatterClaims, javascriptModuleClaims, eavtRelations,
} from "../src/relation-adapters.mjs";

const sources = [
  ["markdown-frontmatter", () => markdownFrontmatterClaims([
    { id:"doc:1", frontmatter:{ related:["world:harbor"] } },
  ], { relations:{ related:"authored-tag" } })],
  ["javascript-module", () => javascriptModuleClaims([
    { id:"module:1", imports:["engine:1"] },
  ])],
  ["eavt", () => eavtRelations([
    { e:"actor:1", a:"located-in", v:"world:harbor", t:"row:1" },
  ])],
];

test("existing graph observations compose with SignCell's ONE original Utterance constructor", () => {
  for (const [substrate,produce] of sources) {
    const rows=produce(), before=JSON.stringify(rows);
    const utterances=utterEvidenceSet(rows);
    assert.equal(utterances.length,1,substrate);
    assert.equal(isUtterance(utterances[0]),true,substrate);
    assert.deepEqual(utterances[0].token.mark.value,
      {subject:rows[0].subject,object:rows[0].object},substrate);
    assert.equal(utterances[0].claim.mark.value,rows[0].predicate,substrate);
    assert.equal(rows[0].evidence.substrate,substrate);
    assert.equal(JSON.stringify(rows),before,"original source observations are not rewritten");
    assert.equal(Object.hasOwn(utterances[0],"evidence"),false,
      "source metadata is distinct from unwitnessed Mark presentations");
  }
});

test("repeated EAVT statements preserve source occurrences without minting a second identity", () => {
  const rows=eavtRelations([
    {e:"npc:1",a:"entered",v:"world:1",t:"ledger:one"},
    {e:"npc:1",a:"entered",v:"world:1",t:"ledger:two"},
  ]);
  const utterances=utterEvidenceSet(rows);
  assert.deepEqual(utterances[0],utterances[1],
    "equal content does not merge or identify original occurrences");
  assert.notDeepEqual(rows[0].evidence,rows[1].evidence);
  assert.equal(utterances.length,rows.length);
  assert.deepEqual(rows.map((row,ordinal)=>({ordinal,witness:row.evidence.witness})),[
    {ordinal:0,witness:"ledger:one"},{ordinal:1,witness:"ledger:two"},
  ]);
});

test("upstream source guards and graph-specific EAVT selectors both refuse malformed observations", () => {
  assert.throws(()=>utterEvidenceSet([{object:"world:1",predicate:"entered"}]),
    /original evidence record needs a present subject and predicate/);
  assert.throws(()=>eavtRelations([{e:"npc:1",a:"entered",v:"world:1"}]),
    /EAVT rows require e, a, v, and t/);
  assert.throws(()=>markdownFrontmatterClaims([{}],{relations:{related:"x"}}),
    /Markdown records require id and frontmatter object/);
  assert.throws(()=>javascriptModuleClaims([{}]),/JavaScript module records require id/);
});
