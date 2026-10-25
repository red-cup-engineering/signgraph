import assert from "node:assert/strict";
import test from "node:test";
import { cell } from "@red-cup-engineering/signcell/cell";
import { intensionalDossier } from "../src/mesh.mjs";

test("a spoken name yields every original sided, revisioned source claim without fictional Thing identity", () => {
  const a=cell("notes/a.md","application-of","MetroPlat",{for:["author:one"]});
  const negative=cell("notes/a.md","application-of","MetroPlat",{against:["author:two"]});
  const b=cell("notes/b.md","instance-of","MetroPlat",{for:["author:three"]});
  const graph=intensionalDossier({name:"MetroPlat",readings:[
    {key:"notes/a.md",revision:"ni:///sha-256;one",locale:"engineering",cells:[a,negative]},
    {key:"notes/b.md",revision:"ni:///sha-256;two",locale:"operations",cells:[b]},
  ],mentions:["notes/c.md","notes/a.md"]});
  assert.equal(graph.kind,"signgraph.intensional-dossier/v1");
  assert.equal(graph.primary.readings.length,2);
  assert.equal(graph.coverage.textualMentions,2,
    "a source reading does not erase a separate lexical passage at the same path");
  assert.deepEqual(graph.primary.passages.map(p=>p.path),["notes/c.md","notes/a.md"]);
  assert.equal(graph.graph.edges.filter(e=>e.kind==="mentions-name").length,2);
  assert.equal(graph.graph.edges.filter(e=>e.kind==="source-telling").length,3);
  assert.equal(graph.primary.readings[0].claims[0].for[0],"author:one");
  assert.equal(graph.primary.readings[0].claims[1].against[0],"author:two");
  assert.equal(graph.primary.readings[0].source.revision,"ni:///sha-256;one");
  assert.equal(graph.secondary.status,"unanchored");
  assert.equal(graph.actualThing.status,"not-derived");
  assert.ok(graph.graph.edges.some(e=>e.kind==="mentions-name"));
  assert.equal(graph.graph.edges.filter(e=>e.kind==="answers-to-name").length,2);
});
test("source performances are distinct even with identical claim profiles", () => {
  const tell=cell("source","asserts","X",{for:["recorded"]});
  const graph=intensionalDossier({name:"term",readings:[
    {key:"source.md",revision:"revision-1",cells:[tell]},
    {key:"source.md",revision:"revision-2",cells:[tell]},
  ]});
  assert.notEqual(graph.primary.readings[0].source.id,graph.primary.readings[1].source.id);
  assert.equal(graph.primary.readings[0].witnessedProfileSize,1);
  assert.equal(graph.primary.readings[1].witnessedProfileSize,1);
  assert.equal(graph.primary.concepts.subjects,2,
    "FCA reads two performed source editions without collapsing their source identity");
  assert.equal(graph.actualThing.status,"not-derived");
});
test("a mere text mention is never promoted into source testimony",()=>{
  const model=intensionalDossier({name:"SEAFOAM",mentions:["essay.md"],incomplete:true});
  assert.equal(model.coverage.sourceReadings,0);
  assert.equal(model.coverage.incomplete,true);
  assert.equal(model.graph.edges.filter(e=>e.kind==="source-telling").length,0);
  assert.equal(model.graph.edges.filter(e=>e.kind==="mentions-name").length,1);
  assert.equal(model.secondary.status,"unanchored");
});
test("bad source identity, malformed evidence and duplicate source editions refuse",()=>{
  const valid={key:"a.md",revision:"v1",cells:[cell("s","p","o")]};
  for(const readings of [[valid,valid],[{key:"",cells:[]}],[{key:"a.md",cells:[{predicate:"p",object:"o",for:true,against:[]}]}]]){
    assert.throws(()=>intensionalDossier({name:"term",readings}),TypeError);
  }
  assert.throws(()=>intensionalDossier({name:"",readings:[]}),TypeError);
  assert.throws(()=>intensionalDossier({name:"term",mentions:[null]}),TypeError);
});

test("located spoken prose remains primary source evidence, not an asserted proposition",()=>{
  const graph=intensionalDossier({name:"MetroPlat",mentions:[
    {path:"notes/speaker.md",revision:"rev-one",line:20,evidence:["MetroPlat installs apps"]},
    {path:"notes/speaker.md",revision:"rev-two",line:20,evidence:["MetroPlat is an application platform"]},
    {path:"notes/speaker.md",revision:"rev-one",line:20,evidence:["MetroPlat installs apps"]},
  ]});
  assert.equal(graph.coverage.textualMentions,2,"same passage deduplicates; changed editions remain");
  assert.equal(graph.primary.passages[0].line,20);
  assert.equal(graph.primary.passages[0].revision,"rev-one");
  assert.deepEqual(graph.primary.passages[0].evidence,["MetroPlat installs apps"]);
  assert.equal(graph.graph.edges.filter(e=>e.kind==="source-telling").length,0,
    "a full-text occurrence cannot silently become sworn evidence");
  assert.equal(graph.secondary.status,"unanchored");
  assert.throws(()=>intensionalDossier({name:"x",mentions:[{path:"a",line:-2}]}),TypeError);
});
