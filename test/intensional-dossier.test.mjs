import assert from "node:assert/strict";
import test from "node:test";
import { cell } from "@red-cup-engineering/signcell/cell";
import { intensionalDossier, categoricalIntensions, composeCategoricalIntensionPaths } from "../src/mesh.mjs";

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
  assert.equal(graph.coverage.textualMentions,1);
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


// Finite FCA projection of Obsmetrologia.Site.Intension: source-bearing actual
// anchors are not inferred from a name, and Chalmers reference semantics is
// NOT supplied by finite claim incidences alone.
const claimCell=(term,predicate,positive=true,negative=false)=>cell(
  term,predicate,"x",{for:positive?["observed:"+predicate]:[],against:negative?["opposed:"+predicate]:[]}
);
const entry=(key,term,contexts)=>({
  source:{key,revision:"source-rev-1"},
  actualTerm:term,
  readings:Object.entries(contexts).map(([context,claims])=>({
    context,term,coverage:"complete",
    cells:claims.map(q=>claimCell(term,q)),
  })),
});
const form=(terms,contexts=["actual","counterfactual"])=>categoricalIntensions({
  actualContext:"actual",contexts,terms,
});
const arrow=(cat,from,to)=>cat.morphisms.find(m=>m.from===from.id && m.to===to.id);

test("Chalmers-named candidate is a real thin FCA category with source-distinguished objects",()=>{
  const cat=form([
    entry("a.md","A",{actual:["p"],counterfactual:["p","q"]}),
    entry("b.md","B",{actual:["p","q"],counterfactual:["p","q"]}),
    entry("c.md","C",{actual:["q"],counterfactual:["q"]}),
    entry("d.md","D",{actual:["p","q"],counterfactual:["p","q"]}),
  ]);
  assert.equal(cat.status,"finite-fca-comparison-only");
  assert.equal(cat.objects.length,4);
  const index=Object.fromEntries(cat.objects.map(o=>[o.source.key,o]));
  const {["a.md"]:a,["b.md"]:b,["c.md"]:c,["d.md"]:d}=index;
  assert(arrow(cat,a,b));
  assert(arrow(cat,b,d));
  assert(arrow(cat,d,b),"semantically coextensive but distinct source documents");
  assert(!arrow(cat,b,a));
  assert(cat.obstructions.some(o=>o.from===b.id&&o.to===a.id&&o.counterexample.context==="actual"));
  assert.notEqual(b.id,d.id,"the same FCA-closed profile cannot erase two source performances");
  for(const item of cat.objects) assert(arrow(cat,item,item),"all identities exist");
  const composite=composeCategoricalIntensionPaths(cat,arrow(cat,a,b),arrow(cat,b,d));
  assert.equal(composite.from,a.id);
  assert.equal(composite.to,d.id);
  assert(arrow(cat,a,d),"comparison morphisms compose by extensional inclusion");
  assert.notEqual(composite.pathAddress,arrow(cat,a,d).pathAddress,
    "different proof routes retain different content addresses");
  const associative1=composeCategoricalIntensionPaths(cat,composite,arrow(cat,d,b));
  const associative2=composeCategoricalIntensionPaths(cat,arrow(cat,a,b),
    composeCategoricalIntensionPaths(cat,arrow(cat,b,d),arrow(cat,d,b)));
  assert.equal(associative1.pathAddress,associative2.pathAddress,
    "flattened ordered proof steps make path composition strictly associative");
  assert.equal(associative1.to,b.id);
  assert.equal(cat.semanticQualification.includes("not established"),true);
});

test("missing counterfactual worlds are unresolved, not empty extensions or false morphisms",()=>{
  const good=entry("a.md","A",{actual:["p"],counterfactual:["p"]});
  const absent=entry("b.md","B",{actual:["p"]});
  const r=form([good,absent]);
  assert.equal(r.status,"unresolved");
  assert.equal(r.unknown.length,1);
  assert.equal(r.unknown[0].context,"counterfactual");
  assert.equal(r.morphisms,undefined);
  const unread=structuredClone(good);
  unread.readings[1].coverage="unknown";
  assert.equal(form([unread]).status,"unresolved");
});

test("source address, actual-world fixing, and contrary witness are not lost in category closure",()=>{
  const a=entry("a.md","A",{actual:["p"],counterfactual:["p"]});
  a.readings[0].cells.push(claimCell("A","r",true,true));
  const b=entry("a-copy.md","A",{actual:["p","r"],counterfactual:["p"]});
  b.readings[0].cells.push(claimCell("A","r",false,true));
  const result=form([a,b]);
  const sourceIds=result.objects.map(o=>o.id);
  assert.notEqual(sourceIds[0],sourceIds[1]);
  assert(result.objects.flatMap(o=>o.concepts).flatMap(c=>c.originalCells)
    .some(c=>c.negative.includes("opposed:r")));
  const swapped=categoricalIntensions({actualContext:"actual",
    contexts:["counterfactual","actual"],terms:[b,a]});
  assert.equal(result.categoryId,swapped.categoryId,
    "input ordering must not determine canonical content address");
  const corrupted=structuredClone(a);
  corrupted.readings[0].term="someone else";
  corrupted.readings[0].cells=[];
  assert.throws(()=>form([corrupted]),/actual anchored term/);
  const foreign=structuredClone(a);
  foreign.readings[0].cells=[claimCell("not A","p")];
  assert.throws(()=>form([foreign]),/stated contextual term/);
});

test("all 256 two-source/two-context finite incidences agree with an independent FCA extent oracle",()=>{
  const contexts=["actual","counterfactual"],claims=["p","q"];
  let checks=0;
  const fcaClosure=(profile,profiles)=>{
    const universe=[...new Set(profiles.flat())];
    const sharing=profiles.map((candidate,i)=>profile.every(x=>candidate.includes(x))?i:-1)
      .filter(i=>i!==-1);
    return universe.filter(q=>sharing.every(i=>profiles[i].includes(q))).sort();
  };
  for(let mask=0;mask<256;mask++){
    const chosen=(termIndex,worldIndex)=>{
      const bits=2*(2*termIndex+worldIndex);
      return claims.filter((_,i)=>Boolean(mask&(1<<(bits+i))));
    };
    const a=entry("source-A.md","A",{
      actual:chosen(0,0),counterfactual:chosen(0,1),
    });
    const b=entry("source-B.md","B",{
      actual:chosen(1,0),counterfactual:chosen(1,1),
    });
    const cat=form([a,b]);
    const bySource=Object.fromEntries(cat.objects.map(o=>[o.source.key,o]));
    const A=bySource["source-A.md"],B=bySource["source-B.md"];
    const extA=contexts.map((_,wi)=>fcaClosure(chosen(0,wi),[chosen(0,wi),chosen(1,wi)]));
    const extB=contexts.map((_,wi)=>fcaClosure(chosen(1,wi),[chosen(0,wi),chosen(1,wi)]));
    for(let i=0;i<2;i++){
      const actualA=A.concepts.find(x=>x.context===contexts[i]).extent.map(x=>JSON.parse(x)[0]);
      const actualB=B.concepts.find(x=>x.context===contexts[i]).extent.map(x=>JSON.parse(x)[0]);
      assert.deepEqual(actualA,extA[i]);
      assert.deepEqual(actualB,extB[i]);
    }
    const includes=(e,f)=>e.every(x=>f.includes(x));
    assert.equal(Boolean(arrow(cat,A,B)), contexts.every((_,i)=>includes(extA[i],extB[i])));
    assert.equal(Boolean(arrow(cat,B,A)), contexts.every((_,i)=>includes(extB[i],extA[i])));
    checks++;
  }
  assert.equal(checks,256);
});
