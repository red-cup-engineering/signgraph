import test from "node:test";
import assert from "node:assert/strict";
import { isUtterance } from "@red-cup-engineering/signcell/utterance";
import {
  markdownFrontmatterClaims, javascriptModuleClaims, eavtRelations,
  utteredRelationObservations,
} from "../src/relation-adapters.mjs";

test("existing author, code, and ERP adapters all produce original Mark Utterances", () => {
  const sourceKinds = [
    [markdownFrontmatterClaims([{id:"doc:1",frontmatter:{contains:["actor:1"]}}],{
      relations:{contains:"authored-tag"}}), "markdown-frontmatter"],
    [javascriptModuleClaims([{id:"module:1",imports:["engine:1"]}]), "javascript-module"],
    [eavtRelations([{e:"agent:1",a:"located-in",v:"harbor",t:"row:1"}]), "eavt"],
  ];
  for (const [rows,kind] of sourceKinds) {
    const result = utteredRelationObservations(rows);
    assert.equal(result.kind,"signgraph.utteredRelationObservations.v1");
    assert.equal(result.entries.length,1);
    const [{sourceOrdinal,observation,utterance}]=result.entries;
    assert.equal(sourceOrdinal,0);
    assert.equal(isUtterance(utterance),true);
    assert.equal(utterance.token.mark.value.subject,rows[0].subject);
    assert.deepEqual(utterance.token.mark.value.object,rows[0].object);
    assert.equal(utterance.claim.mark.value,rows[0].predicate);
    assert.deepEqual(observation.evidence,rows[0].evidence);
    assert.equal(observation.evidence.substrate,kind);
    assert.equal(Object.isFrozen(result.entries),true);
    assert.match(result.attribution,/no semantic identification/);
  }
});

test("repeated equal observations retain both source occurrences without inventing a witness", () => {
  const rows=eavtRelations([
    {e:"npc:1",a:"entered",v:"world:1",t:"ledger:one"},
    {e:"npc:1",a:"entered",v:"world:1",t:"ledger:two"},
  ]);
  const result=utteredRelationObservations(rows);
  assert.deepEqual(result.entries.map(x=>x.sourceOrdinal),[0,1]);
  assert.deepEqual(result.entries[0].utterance,result.entries[1].utterance,
    "equal Mark presentations may coincide without occurrence identification");
  assert.notDeepEqual(result.entries[0].observation.evidence,result.entries[1].observation.evidence);
  assert.equal(Object.hasOwn(result,"authorized"),false);
  assert.equal(Object.hasOwn(result,"settled"),false);
});

test("malformed observations refuse at one adapter instead of producing ungrounded typed claims",()=>{
  for(const invalid of [
    null, {}, {subject:"actor",predicate:"",object:"area",evidence:{}},
    {subject:"actor",object:"area",evidence:{}},
    {subject:"actor",predicate:"in",evidence:{}},
  ])assert.throws(()=>utteredRelationObservations([invalid]),/requires subject\/predicate\/object\/evidence/);
  assert.throws(()=>utteredRelationObservations({}),/Relation records must be an array/);
});
