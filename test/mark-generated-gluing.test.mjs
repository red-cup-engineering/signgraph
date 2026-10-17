import test from "node:test";
import assert from "node:assert/strict";
import { utterance } from "@red-cup-engineering/signcell/utterance";
import { glueMarkUtteranceCells, glueAdjudicatedMarkUtteranceCells, gradientOfGluedMarkCells, assembleMarkWallCellIncidence } from "../src/mark-gluing.mjs";
import { cell } from "@red-cup-engineering/signcell/cell";

const triangleSource=[
  utterance("a","b"),utterance("b","c"),utterance("c","a"),
];
const joins=[
  {left:[0,"claim"],right:[1,"token"]},
  {left:[1,"claim"],right:[2,"token"]},
  {left:[2,"claim"],right:[0,"token"]},
];
const fill=[{id:"triangle",boundary:[
  {utterance:0,direction:1},
  {utterance:1,direction:1},
  {utterance:2,direction:1},
]}];

test("SignCell generates independent Mark ports; matching glyphs are NOT prior identifications",()=>{
  const prior=JSON.stringify(triangleSource);
  const result=glueMarkUtteranceCells({utterances:triangleSource});
  assert.equal(result.source.ports.length,6);
  assert.deepEqual(result.source.ports.map(p=>p.orientation),[-1,1,-1,1,-1,1]);
  assert.equal(result.identificationLedger.gross,0);
  assert.equal(result.identificationLedger.classes,6);
  assert.deepEqual(result.topology.betti,{h0:3,h1:0,h2:0});
  assert.equal(result.topology.graphOnlyH1,0);
  assert.equal(JSON.stringify(triangleSource),prior);
});

test("three independent Quot-style endpoint identifications create geometric H1 without identification residue",()=>{
  const state=glueMarkUtteranceCells({
    utterances:triangleSource,identifications:joins,
  });
  assert.equal(state.identificationLedger.gross,3);
  assert.equal(state.identificationLedger.merges,3);
  assert.equal(state.identificationLedger.residue,0);
  assert.equal(state.identificationLedger.classes,3);
  assert.deepEqual(state.topology.betti,{h0:1,h1:1,h2:0});
  assert.equal(state.topology.graphOnlyH1,1);
  assert.equal(state.distinction.identificationResidue,0);
  assert.equal(state.distinction.assembledGraphH1,1);
  assert.equal(state.distinction.equalNumerically,false);
  assert.equal(state.identificationLedger.authority.includes("not an authenticated"),true);
});

test("explicit 2-cell gluing kills the assembled 1-cycle but changes no identification residue",()=>{
  const empty=glueMarkUtteranceCells({utterances:triangleSource,identifications:joins});
  const filled=glueMarkUtteranceCells({utterances:triangleSource,identifications:joins,faces:fill});
  assert.equal(empty.topology.betti.h1,1);
  assert.deepEqual(filled.topology.betti,{h0:1,h1:0,h2:0});
  assert.equal(filled.topology.graphOnlyH1,1);
  assert.equal(filled.topology.boundaryOne.length,1);
  assert.deepEqual(filled.topology.boundaryOne[0],[1,1,1]);
  for(const v of filled.topology.vertices.keys())assert.equal(
    filled.topology.boundaryOne[0].reduce((sum,coeff,e)=>
      sum+coeff*filled.topology.boundaryZero[e][v],0),0);
  assert.equal(filled.identificationLedger.residue,empty.identificationLedger.residue);
});

test("one redundant presented identification adds exactly one residual bit; ordering changes no count",()=>{
  const duplicate=joins[0];
  const a=glueMarkUtteranceCells({utterances:triangleSource,
    identifications:[...joins,duplicate]});
  const b=glueMarkUtteranceCells({utterances:triangleSource,
    identifications:[duplicate,joins[0],joins[2],joins[1]]});
  for(const v of [a,b]){
    assert.equal(v.identificationLedger.gross,4);
    assert.equal(v.identificationLedger.merges,3);
    assert.equal(v.identificationLedger.residue,1);
    assert.deepEqual(v.topology.betti,{h0:1,h1:1,h2:0});
    assert.equal(v.identificationLedger.residue,
      v.identificationLedger.gross-(v.identificationLedger.initialPorts-
       v.identificationLedger.classes));
  }
  assert.deepEqual(a.topology.vertices,b.topology.vertices);
  assert.equal(a.identificationLedger.trace.at(-1).effect,"residual-identification");
  assert.equal(b.identificationLedger.trace.at(-1).effect,"component-merge");
});

test("false faces, imaginary source ports and undeclared identification fields refuse",()=>{
  assert.throws(()=>glueMarkUtteranceCells({
    utterances:triangleSource,faces:fill,
  }),/disconnected step|not closed/);
  assert.throws(()=>glueMarkUtteranceCells({utterances:triangleSource,
    identifications:[{left:[0,"token"],right:[42,"claim"]}],
  }),/source Utterance index/);
  assert.throws(()=>glueMarkUtteranceCells({utterances:triangleSource,
    identifications:[{left:[0,"token"],right:[1,"claim"],authenticated:true}],
  }),/only left\/right/);
  assert.throws(()=>glueMarkUtteranceCells({utterances:[["x"]]}),/native SignCell Utterance/);
  assert.throws(()=>glueMarkUtteranceCells({utterances:triangleSource,
    faces:[{id:"bad",boundary:[{utterance:3,direction:1}]}],
  }),/source Utterance index/);
});


test("measured unopposed SignChain identifications produce only CONDITIONAL glued geometry",()=>{
  const input={
    utterances:triangleSource,
    identifications:joins.map((j,i)=>({
      ...j,judgment:cell(
        "port:"+j.left[0]+":"+j.left[1],"identifies",
        "port:"+j.right[0]+":"+j.right[1],
        {for:[{kind:"witness",ordinal:i}]},
      ),
    })),
  };
  const outcome=glueAdjudicatedMarkUtteranceCells(input);
  assert.equal(outcome.kind,"signgraph.adjudicatedMarkCellGluing.v1");
  assert.equal(outcome.relationAdmission.quotientAdmitted,false);
  assert.equal(outcome.judgments.length,3);
  assert.ok(outcome.judgments.every(j=>j.evidence.posture==="supported-unopposed"));
  assert.equal(outcome.identificationLedger.residue,0);
  assert.equal(outcome.topology.betti.h1,1);
  assert.ok(input.identifications.every(j=>j.judgment.for.length===1));
});

test("SignChain denies unobserved, opposed, contested and merely written identification values",()=>{
  const j=joins[0];
  const one=evidence=>({utterances:triangleSource,identifications:[{
    ...j,judgment:cell("port:0:claim","identifies","port:1:token",evidence),
  }]});
  assert.throws(()=>glueAdjudicatedMarkUtteranceCells(one({})),/refuses gluing/);
  assert.throws(()=>glueAdjudicatedMarkUtteranceCells(one({against:["no"]})),/refuses gluing/);
  assert.throws(()=>glueAdjudicatedMarkUtteranceCells(one({
    for:["yes"],against:["no"],
  })),/refuses gluing/);
  assert.throws(()=>glueAdjudicatedMarkUtteranceCells(one({
    value:"potential",
  })),/refuses gluing/);
  assert.throws(()=>glueAdjudicatedMarkUtteranceCells(one({
    for:["yes"],value:"active",
  })),/refuses gluing/);
});

test("evidence on the wrong positional mark pair can never be reused as the required quotient proof",()=>{
  const j=joins[0];
  assert.throws(()=>glueAdjudicatedMarkUtteranceCells({
    utterances:triangleSource,identifications:[{
      ...j,judgment:cell("port:0:token","identifies","port:1:token",{for:["source"]}),
    }],
  }),/very same two positional source ports/);
});


test("actual Mark-generated cell gradient uses existing exact SignGraph d0 with zero d1d0",()=>{
  const glued=glueMarkUtteranceCells({
    utterances:triangleSource,identifications:joins,faces:fill,
  });
  const input={utterances:triangleSource,identifications:joins,faces:fill,
    potentials:[2,5,11]};
  assert.equal(glued.topology.vertices.length,3);
  const out=gradientOfGluedMarkCells(input);
  assert.equal(out.kind,"signgraph.markGeneratedGradient.v1");
  assert.equal(out.oriented1Cochain.length,3);
  assert.deepEqual(out.exactFaceCirculation,[0]);
  for(let i=0;i<3;i++)assert.equal(out.oriented1Cochain[i],
    glued.topology.boundaryZero[i].reduce((sum,c,j)=>sum+c*input.potentials[j],0));
  const shifted=gradientOfGluedMarkCells({...input,potentials:input.potentials.map(n=>n+91)});
  assert.deepEqual(shifted.oriented1Cochain,out.oriented1Cochain,
    "constant scalar gauge leaves every source-derived gradient unchanged");
  assert.deepEqual(shifted.exactFaceCirculation,[0]);
});

test("no scalar potential is generated from Marks, and a fake field is refused",()=>{
  const input={utterances:triangleSource,identifications:joins,faces:fill};
  assert.throws(()=>gradientOfGluedMarkCells(input),/one bounded integer scalar/);
  assert.throws(()=>gradientOfGluedMarkCells({...input,potentials:[1,2]}),/one bounded integer scalar/);
  assert.throws(()=>gradientOfGluedMarkCells({...input,potentials:[1,2,0.5]}),/one bounded integer scalar/);
  assert.throws(()=>gradientOfGluedMarkCells({...input,potentials:[1,2,3],energy:-1}),
    /finite generated cell presentation/);
});


const typedAttachments=joins.map((join,i)=>({
  cell:i,wall:(i+1)%3,
  judgment:cell("cell:"+i,"attaches-to","wall:"+((i+1)%3),
    {for:[{source:"signed-attachment",i}]}),
}));
const typedFace=[{id:"typed-disc",boundary:[
  {edge:"utterance:0",direction:1},{edge:"attachment:0",direction:1},
  {edge:"utterance:1",direction:1},{edge:"attachment:1",direction:1},
  {edge:"utterance:2",direction:1},{edge:"attachment:2",direction:1},
]}];

test("Mark->Utterance yields a two-SORTED wall/cell incidence graph, never an assumed endpoint quotient",()=>{
  const input={utterances:triangleSource};
  const output=assembleMarkWallCellIncidence(input);
  assert.equal(output.kind,"signgraph.twoSortedMarkIncidenceComplex.v1");
  assert.deepEqual(output.sorts,{wall:3,cell:3,equatedAcrossSorts:false});
  assert.deepEqual(output.conditionalGeometry.betti,{h0:3,h1:0,h2:0});
  assert.equal(output.source.roleIncidences.length,3);
  assert.equal(output.source.roleIncidences[0].boundary.role,"candidate-wall");
  assert.equal(output.source.roleIncidences[0].interior.role,"candidate-cell");
  assert.ok(output.conditionalGeometry.vertices.includes("wall:0"));
  assert.ok(output.conditionalGeometry.vertices.includes("cell:0"));
  assert.notEqual(output.source.roleIncidences[0].boundary.position,
    output.source.roleIncidences[0].interior.position);
  assert.equal(output.relationAdmission.quotientAdmitted,false);
});

test("witnessed cell-to-wall attachments construct a six-step 1-cycle without equating roles",()=>{
  const result=assembleMarkWallCellIncidence({
    utterances:triangleSource,attachments:typedAttachments,
  });
  assert.deepEqual(result.sorts,{wall:3,cell:3,equatedAcrossSorts:false});
  assert.equal(result.attachments.length,3);
  assert.equal(result.conditionalGeometry.vertices.length,6);
  assert.equal(result.conditionalGeometry.edges.length,6);
  assert.equal(result.conditionalGeometry.graphOnlyH1,1);
  assert.deepEqual(result.conditionalGeometry.betti,{h0:1,h1:1,h2:0});
  assert.ok(result.attachments.every(x=>x.judgment.identification.quotientAdmitted===false));
});

test("a real oriented six-edge attaching face closes the typed incidence 1-cycle",()=>{
  const input={utterances:triangleSource,attachments:typedAttachments,faces:typedFace};
  const done=assembleMarkWallCellIncidence(input);
  assert.deepEqual(done.conditionalGeometry.betti,{h0:1,h1:0,h2:0});
  assert.equal(done.conditionalGeometry.graphOnlyH1,1);
  assert.deepEqual(done.conditionalGeometry.coboundary.one,[[1,1,1,1,1,1]]);
  assert.equal(done.source.roleIncidences.length,3);
  const bad=structuredClone(input);
  bad.faces[0].boundary.pop();
  assert.throws(()=>assembleMarkWallCellIncidence(bad),/not closed/);
});

test("a token wall cannot be claimed as a cell, and opposed or presumed attachment cannot glue",()=>{
  const input={utterances:triangleSource,attachments:typedAttachments};
  for(const evidence of [{},{against:["no"]},{for:["yes"],against:["no"]},{value:"potential"}]){
    const attempt=structuredClone(input);
    attempt.attachments[0].judgment=cell("cell:0","attaches-to","wall:1",evidence);
    assert.throws(()=>assembleMarkWallCellIncidence(attempt),/refuses incidence/);
  }
  const mistaken=structuredClone(input);
  mistaken.attachments[0].judgment=cell("wall:0","attaches-to","cell:1",{for:["looks-similar"]});
  assert.throws(()=>assembleMarkWallCellIncidence(mistaken),
    /precise source cell and wall/);
  const excessive=structuredClone(input);
  excessive.attachments[0].sourcePosition="silent-identity";
  assert.throws(()=>assembleMarkWallCellIncidence(excessive),
    /source cell, target wall/);
});
