import assert from "node:assert/strict";
import { test } from "node:test";
import { markdownFrontmatterClaims, observeClaims } from "@red-cup-engineering/signgraph/relation-adapters";
import { createRelationalField, defineRelation, queryRelationalField } from "@red-cup-engineering/signgraph/typed-relations";
import { defineSchemaType } from "@red-cup-engineering/typed-content";

test("normalize only configured authored fields to canonical predicate identifiers", () => {
  const predicate="urn:example:predicate:instantiates";
  const records=[
    {id:"urn:example:note:one",frontmatter:{instantiates:"urn:example:concept",specialization:"not a relation"}},
    {id:"urn:example:note:two",frontmatter:{instantiates:["urn:example:concept"]}},
    {id:"urn:example:note:three",frontmatter:{specialization:"urn:example:concept"}},
    {id:"urn:example:note:four",frontmatter:Object.create({instantiates:"urn:example:concept"})},
  ];
  const claims=markdownFrontmatterClaims(records,{relations:{instantiates:"authored"},predicateIds:{instantiates:predicate}});
  assert.deepEqual(claims.map(({subject,predicate,object,datum,evidence})=>[subject,predicate,object,datum,evidence.field]),[
    [records[0].id,predicate,"urn:example:concept","authored","instantiates"],
    [records[1].id,predicate,"urn:example:concept","authored","instantiates"],
  ]);
  const source={name:"fixture"};
  const result=observeClaims({observe:x=>x},{source,claims});
  assert.deepEqual(result,{source,relations:claims});
  const identifier=defineSchemaType({$schema:"https://json-schema.org/draft/2020-12/schema",
    $id:"urn:example:graph:identifier",title:"Identifier",description:"Nonempty source or graph identifier",
    type:"string",minLength:1});
  const relation=defineRelation({id:predicate,domain:identifier,codomain:identifier,witness:identifier});
  assert.equal(relation.ok,true,JSON.stringify(relation.refusal));
  const edges=claims.map(({subject,predicate,object})=>({subject,predicate,object,witness:subject}));
  const field=createRelationalField([relation.value],edges);
  assert.equal(field.ok,true,JSON.stringify(field.refusal));
  const matches=queryRelationalField(field.value,{predicate,object:"urn:example:concept"});
  assert.deepEqual(new Set(matches.map(row=>row.statement.subject)),new Set([records[0].id,records[1].id]));
});

test("default name remains the predicate and mismatched identity configuration is refused", () => {
  const note={id:"a",frontmatter:{instantiates:"b"}};
  assert.deepEqual(markdownFrontmatterClaims([note],{relations:{instantiates:undefined}}),[
    {subject:"a",predicate:"instantiates",object:"b",evidence:{substrate:"markdown-frontmatter",resource:"a"}},
  ]);
  for (const predicateIds of [{specialization:"urn:other"},{instantiates:"   "},{instantiates:" id "},new Map()]) {
    assert.throws(()=>markdownFrontmatterClaims([note],{relations:{instantiates:undefined},predicateIds}),TypeError);
  }
});
