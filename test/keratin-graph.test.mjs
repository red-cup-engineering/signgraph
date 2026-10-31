import test from 'node:test';
import assert from 'node:assert/strict';
import {keratinGraphOfPredications,keratinPositionKey,keratinLinearSheaf,assessKeratinLinearObservations,analyzeKeratinGraph,keratinGraphToDot} from '../src/keratin-graph.mjs';
import { apply, applyTranspose, coboundary, diffuse, hodgeCheck, solveNormal, weightedSheafDirichlet, weightedSheafLaplacian } from '../src/cellular-sheaf.mjs';

const p = (s, display='same') => ({performed:s,side:'token',display});
const edge = (id, from, predicate, to) => ({occurrence:id,sourceRecord:`source:${id}`,cell:{subject:p(from),predicate,object:p(to)}});
const source=[
  edge('a>b','a','continued-by','b'),
  edge('a>c','a','continued-by','c'),
  edge('b>c','b','contacts','c'),
];
const id=s=>keratinPositionKey(s);
const stalks=['a','b','c'].map(s=>({position:id(s),states:['0','1']}));
const parity = bit=>bit===0?[['0','0'],['1','1']]:[['0','1'],['1','0']];
const contacts=odd=>[
  {occurrence:'a>b',allowed:parity(0)},
  {occurrence:'a>c',allowed:parity(0)},
  {occurrence:'b>c',allowed:parity(odd?1:0)},
];
const boundary=[{occurrence:'a>b',direction:1},{occurrence:'b>c',direction:1},{occurrence:'a>c',direction:-1}];
const selectors={axialPredicate:'continued-by',transversePredicate:'contacts'};
const specimen=(opts={})=>keratinGraphOfPredications({
  source,selectors,stalks,contacts:contacts(true),
  holes:[{id:'shroud-gap',sourceRecord:'s:boundary',boundary}],
  observers:[{id:'partial',visiblePositions:[id('a'),id('b')],visibleOccurrences:['a>b']}],
  ...opts,
});

test('a witnessed feather fork carries explicit directed finite stalks and an unfilled hole candidate',()=>{
  const g=specimen();
  assert.equal(g.feather.forks[0].reading,'source-reported-transverse-contact');
  assert.equal(g.topology.betti.h1,1);
  assert.equal(g.aggregateIndependentBoundaries,1);
  assert.equal(g.candidateHoles[0].reading,'candidate-unfilled-nontrivial-cycle');
  assert.equal(g.topology.faces?.length??0,0);
  assert.equal(g.contacts.length,3);
  assert.match(g.status,/downstream finite model/);
});

test('odd parity around declared hole: nonempty local fibers yet no global section, exact contact obstruction',()=>{
  const g=specimen();const r=analyzeKeratinGraph(g);
  assert.equal(r.sectionStatus,'exact');
  assert.equal(r.sectionCount,0);
  assert.deepEqual(r.unsatisfiableContactCore,['a>b','a>c','b>c']);
  assert.equal(r.emptyStalks.length,0);
  assert.equal(r.graphOnlyH1,1);
  assert.equal(r.observers[0].localSections,2);
  assert.equal(r.observers[0].globallyLiftableReports,0);
  assert.equal(r.observers[0].unliftableLocalReports,2);
});

test('explicitly supplied face changes H1 without fixing an incompatible sheaf assignment',()=>{
  const r=analyzeKeratinGraph(specimen({faces:[{id:'disc',sourceRecord:'s:face',boundary}]}));
  assert.equal(r.actualComplexBetti.h1,0);
  assert.equal(r.graphOnlyH1,1);
  assert.equal(r.candidateHoles[0].individuallyIndependentH1,false);
  assert.equal(r.independentDeclaredUnfilledBoundaries,0);
  assert.equal(r.sectionCount,0);
});

test('compatible contacts have two sections; a sourced lock eliminates one but never adds it back',()=>{
  const g=specimen({contacts:contacts(false),locks:[{id:'lock1',position:id('a'),sourceRecord:'source:lock1',excludes:['0']} ]});
  const s=analyzeKeratinGraph(g);
  assert.equal(s.sectionCount,1);
  assert.equal(s.sampleSections[0][id('a')],'1');
  assert.deepEqual(s.localStalks.find(e=>e.position===id('a')).excluded,['0']);
  assert.equal(s.observers[0].localSections,1);
  assert.equal(s.observers[0].unliftableLocalReports,0);
  const noLock=analyzeKeratinGraph(specimen({contacts:contacts(false)}));
  assert.equal(noLock.sectionCount,2);
});

test('two locks cannot undo exclusions; locally emptied stalk is distinguished from global cycle obstruction',()=>{
  const g=specimen({contacts:contacts(false),locks:[
    {id:'lock1',position:id('a'),sourceRecord:'s:1',excludes:['0']},
    {id:'lock2',position:id('a'),sourceRecord:'s:2',excludes:['1']},
  ]});
  const r=analyzeKeratinGraph(g);
  assert.equal(r.sectionCount,0);assert.deepEqual(r.emptyStalks,[id('a')]);
  assert.equal(r.unsatisfiableContactCore,null);
});

test('observer qualification is external, and invisible contact cannot leak through endpoint selection',()=>{
  assert.throws(()=>specimen({observers:[{id:'bad',visiblePositions:[id('a'),id('b')],visibleOccurrences:['b>c']}]}),/observer cannot see/);
});

test('candidate hole boundaries must be real closed walks of source occurrences, not inferred cycles',()=>{
  assert.throws(()=>specimen({holes:[{id:'fake',sourceRecord:'x',boundary:[{occurrence:'a>b',direction:1}]}]}),/not closed|not composable/);
  assert.throws(()=>specimen({holes:[{id:'fake',sourceRecord:'x',boundary:[{occurrence:'invented',direction:1}]}]}),/original occurrence/);
});

test('source identity and strict tables reject forged vertex, missing contact, wrong state and duplicate witness',()=>{
  assert.throws(()=>specimen({stalks:stalks.slice(0,2)}),/every original position/);
  assert.throws(()=>specimen({contacts:contacts(true).slice(0,2)}),/every original relation/);
  assert.throws(()=>specimen({contacts:[...contacts(true).slice(0,2),{occurrence:'b>c',allowed:[['9','0']]}]}),/ordered endpoint/);
  assert.throws(()=>specimen({locks:[{id:'x',position:id('z'),sourceRecord:'s',excludes:[]}]}),/cannot introduce/);
});

test('a bounded workspace still returns actual topology when section enumeration is intractable',()=>{
  const g=specimen();const r=analyzeKeratinGraph(g,{maxAssignments:2});
  assert.equal(r.sectionCount,null);assert.match(r.sectionStatus,/not-evaluated/);
  assert.equal(r.actualComplexBetti.h1,1);
  assert.equal(r.observers[0].globallyLiftableReports,null);
  assert.throws(()=>analyzeKeratinGraph(structuredClone(g)),/in-process generated/);
});

test('DOT rendering draws only original predications as solid arrows and separately labels hole annotations',()=>{
  const g=specimen();const d=keratinGraphToDot(g,analyzeKeratinGraph(g));
  assert.match(d,/digraph KeratinGraph/);
  assert.match(d,/candidate boundary: shroud-gap/);
  assert.equal((d.match(/\[id="e\d"/g)||[]).length,3);
  assert.match(d,/style=dotted,arrowhead=none,constraint=false/);
});

test('linear keratin sheaf reuses native cellular restriction/cohomology arithmetic on the same occurrence geometry',async()=>{
  const {keratinLinearSheaf}=await import('../src/keratin-graph.mjs');
  const g=specimen();
  const vertexStalks=g.feather.positions.map(p=>({position:p.key,dim:1}));
  const relationStalks=g.feather.predications.map(e=>({
    occurrence:e.occurrence,dim:1,restrict:{from:[[1]],to:[[1]]},
  }));
  const ordinary=keratinLinearSheaf(g,{vertexStalks,relationStalks});
  assert.equal(ordinary.cohomologyStatus,'exact',
    'a small original rational sheaf remains fully evaluated');
  assert.equal(ordinary.cohomology.h0,1);
  assert.equal(ordinary.cohomology.h1,1);
  assert.equal(ordinary.sourceOccurrences.length,3);
  const twisted=keratinLinearSheaf(g,{vertexStalks,relationStalks:relationStalks.map(e=>
    e.occurrence==='b>c'?{...e,restrict:{from:[[1]],to:[[-1]]}}:e)});
  assert.equal(twisted.cohomology.h0,0);
  assert.equal(twisted.cohomology.h1,0);
  assert.equal(g.topology.betti.h1,1,'linear sheaf H1 differs from topological H1');
  assert.throws(()=>keratinLinearSheaf(g,{vertexStalks,relationStalks:relationStalks.slice(1)}),/missing original directed relation/);
});

test('large exact Keratin charts preserve original source geometry while rank is explicitly not evaluated',()=>{
  // 17 genuine performed positions with stalk dimension 16 give 272 C0
  // coordinates and 16 edges of dimension 16 give 256 C1 coordinates.
  // Their dense rank would materialize 69,632 rational coefficients,
  // exceeding the original cellular-sheaf owner's 65,536-slot budget.
  const sourceRows=Array.from({length:16},(_,i)=>
    edge('performed:'+i,'p'+i,'continued-by','p'+(i+1)));
  const graph=keratinGraphOfPredications({
    source:sourceRows,selectors,
    stalks:Array.from({length:17},(_,i)=>({position:id('p'+i),states:['0']})),
    contacts:sourceRows.map(row=>({occurrence:row.occurrence,allowed:[['0','0']]})),
  });
  const identity16=Array.from({length:16},(_,i)=>
    Array.from({length:16},(_,j)=>i===j?1:0));
  const linear=keratinLinearSheaf(graph,{
    vertexStalks:graph.feather.positions.map(p=>({position:p.key,dim:16})),
    relationStalks:graph.feather.predications.map(p=>({
      occurrence:p.occurrence,dim:16,restrict:{from:identity16,to:identity16},
    })),
  });
  assert.equal(linear.sheaf.exact,true);
  assert.equal(linear.sheaf.c0,272);
  assert.equal(linear.sheaf.c1,256);
  assert.equal(linear.cohomology,null,'not evaluated is NOT exact H1=0');
  assert.match(linear.cohomologyStatus,/^not-evaluated: rational rank work budget exceeded/);
  assert.equal(linear.sourceOccurrences.length,16);
  // The independently testable numerical H0 reader must remain usable on
  // this SAME source-positioned Keratin sheaf when exact rational H1 rank
  // exceeds its original preflight budget.
  const hodge=hodgeCheck(linear.sheaf,Array(linear.sheaf.c0).fill(0),
    {maxSteps:0});
  assert.equal(hodge.cohomologyStatus,linear.cohomologyStatus);
  assert.equal(hodge.h1,null,
    'unassayed exact rank is not a theorem of H1 vanishing');
  assert.equal(hodge.harmonic,true);
  assert.equal(hodge.sectionResidual,0);
  assert.equal(hodge.laplacianResidual,0);
  const nonharmonic=Array(linear.sheaf.c0).fill(0);
  nonharmonic[0]=1;
  const obstructed=hodgeCheck(linear.sheaf,nonharmonic,{maxSteps:0});
  assert.equal(obstructed.cohomologyStatus,linear.cohomologyStatus);
  assert.equal(obstructed.h1,null);
  assert.equal(obstructed.harmonic,false,
    'not evaluating H1 does not convert a nonzero coboundary to a section');
  const observed=graph.feather.positions.map((p,i)=>({
    position:p.key,value:Array(16).fill(0),
    sourceRecord:'meter:'+i,evidence:{for:['witness:'+i],against:[]},
  }));
  const result=assessKeratinLinearObservations(linear,observed);
  assert.equal(result.compatible,true,
    'bounded numeric coboundary remains usable even when exact rational cohomology is unassayed');
  assert.equal(result.residualNorm,0);
  assert.equal(result.positions.length,17);
  assert.equal(result.sourceAuthentication,'caller-supplied-not-adjudicated');
});

const linearSpec=(graph,{twisted=false}={})=>keratinLinearSheaf(graph,{
  vertexStalks:graph.feather.positions.map(p=>({position:p.key,dim:1})),
  relationStalks:graph.feather.predications.map(e=>({
    occurrence:e.occurrence,dim:1,
    restrict:{from:[[1]],to:[[twisted&&e.occurrence==='b>c'?-1:1]]},
  })),
});
const reading=(position,value,sourceRecord)=>({position:id(position),value,sourceRecord,evidence:{for:[sourceRecord],against:[]}});

test('witness-qualified Keratin linear observations retain genuine source-indexed weighted energy',()=>{
  const graph=specimen({contacts:contacts(false)});
  const linear=linearSpec(graph);
  const observed=graph.feather.positions.map((position,index)=>({
    position:position.key,value:index,
    sourceRecord:'meter:'+index,
    evidence:{for:['witness:'+index],against:[]},
  }));
  const report=assessKeratinLinearObservations(linear,observed);
  assert.equal(report.status,'incompatible-numeric-coboundary');
  assert.equal(report.compatible,false,
    'nonzero observed coboundary must remain a numeric obstruction');
  assert.equal(report.positions.length,3);
  const weights=linear.sheaf.edges.map(()=>[[2]]);
  const energy=weightedSheafDirichlet(linear.sheaf,weights,report.vector);
  const typedEnergy=weightedSheafDirichlet(linear.sheaf,weights,
    Float64Array.from(report.vector));
  assert.ok(Math.abs(typedEnergy.energy-energy.energy)<1e-12,
    'the original numeric TypedArray consumer retains the same source-qualified geometry');
  assert.ok(Math.abs(energy.energy-12)<1e-12,
    'all three original directed source contacts retain the triangle energy');
  const laplacian=weightedSheafLaplacian(linear.sheaf,weights);
  const Lx=apply(laplacian,report.vector);
  const quadratic=report.vector.reduce((sum,v,i)=>sum+v*Lx[i],0);
  assert.ok(Math.abs(energy.energy-quadratic)<1e-12,
    'the same original numeric cochain is received by both weighted kernels');
  assert.deepEqual(new Set(energy.perEdge.map(e=>e.id)),
    new Set(graph.feather.predications.map(p=>p.occurrence)),
    'weighted energy retains original source-indexed occurrence addresses');

  // An opposing original witness prevents a numerical cochain from being
  // issued. This is the genuine Keratin information→numeric gate, not an
  // implied right to a measured or physical energy claim.
  const opposed=observed.map((row,i)=>i===0?{
    ...row,evidence:{for:row.evidence.for,against:['counter:witness']},
  }:row);
  const refused=assessKeratinLinearObservations(linear,opposed);
  assert.equal(refused.vector,null);
  assert.equal(refused.status,'unassayed-incomplete-or-unqualified-source');

  let calls=0;
  const malicious=[[-1]];
  Object.defineProperty(malicious,'map',{value(){
    calls++;return [[1]];
  }});
  assert.throws(()=>weightedSheafDirichlet(linear.sheaf,
    [malicious,...weights.slice(1)],report.vector),
  /weighted edge metric cannot be sparse or decorated/);
  assert.equal(calls,0,
    'a numerical metric must not replace its declared source before Cholesky');
});

test('Keratin source-qualified numeric fibers receive heat flow and normal loads without fabricated witnesses',()=>{
  const graph=specimen({contacts:contacts(false)});
  const linear=linearSpec(graph);
  const original=graph.feather.positions.map((position,i)=>({
    position:position.key,value:i*2,sourceRecord:'reading:'+i,
    evidence:{for:['observed:'+i],against:[]},
  }));
  const observed=assessKeratinLinearObservations(linear,original);
  assert.deepEqual(observed.vector,[0,2,4]);
  assert.equal(observed.sourceAuthentication,'caller-supplied-not-adjudicated');

  // The SAME original issued sheaf accepts numeric source cuts, including
  // the established binary64 typed-cochain carrier, without a second graph.
  const flow=diffuse(linear.sheaf,observed.vector,{maxSteps:100});
  const typedFlow=diffuse(linear.sheaf,Float64Array.from(observed.vector),{maxSteps:100});
  assert.deepEqual(typedFlow,flow);
  assert.equal(flow.converged,true);
  assert.ok(flow.compatible);
  const harmonic=hodgeCheck(linear.sheaf,observed.vector,{maxSteps:100});
  assert.equal(harmonic.harmonic,true);
  assert.equal(harmonic.h1,linear.cohomology.h1);
  assert.deepEqual(harmonic.section,flow.section);

  // A mathematically issued load from the SAME oriented coboundary is
  // representable. The normal solver returns a finite response and an
  // independently checkable δᵀf reading without inventing source authority.
  const delta=coboundary(linear.sheaf);
  const load=applyTranspose(delta,[1,0,-1]);
  const balanced=solveNormal(linear.sheaf,load);
  assert.equal(balanced.consistent,true);
  const roundtrip=applyTranspose(delta,balanced.section);
  for(let i=0;i<load.length;i++)
    assert.ok(Math.abs(roundtrip[i]-load[i])<1e-9);
  assert.deepEqual(solveNormal(linear.sheaf,Float64Array.from(load)),balanced);

  let calls=0;
  const forgedLoad=[...load];
  Object.defineProperty(forgedLoad,Symbol.iterator,{value(){
    calls++;return [0,0,0][Symbol.iterator]();
  }});
  assert.throws(()=>solveNormal(linear.sheaf,forgedLoad),
    /solveNormal source load cannot be sparse or decorated/);
  const forgedPin={value:0};
  Object.defineProperty(forgedPin,'vertex',{enumerable:true,get(){
    calls++;return graph.feather.positions[0].key;
  }});
  assert.throws(()=>diffuse(linear.sheaf,observed.vector,{maxSteps:0,
    fixed:[forgedPin]}),
  /diffuse fixed reading: requires exact inert own source fields/);
  assert.equal(calls,0);

  const contrary=original.map((v,i)=>i===0
    ?{...v,evidence:{for:v.evidence.for,against:['counter:witness']}}:v);
  const unqualified=assessKeratinLinearObservations(linear,contrary);
  assert.equal(unqualified.vector,null);
  assert.throws(()=>solveNormal(linear.sheaf,unqualified.vector),
    /solveNormal: rhs has the wrong length/,
    'a refused observation cannot be smuggled into the normal solver as an empty or zero load');
});

test('a complete observed linear sheaf preserves source identity and never proves a separate discrete model',()=>{
  const graph=specimen(),linear=linearSpec(graph);
  assert.equal(analyzeKeratinGraph(graph).sectionCount,0,
    'the original odd-parity finite-state constraints have no global compatible state');
  const source=[reading('a',[4],'meter:A'),reading('b',4,'meter:B'),reading('c',4,'meter:C')];
  const projected=assessKeratinLinearObservations(linear,source);
  assert.equal(projected.status,'compatible-numeric-coboundary');
  assert.equal(projected.compatible,true);
  assert.deepEqual(projected.vector,[4,4,4]);
  assert.equal(projected.residualNorm,0);
  assert.deepEqual(projected.edgeResiduals.map(edge=>edge.occurrence),
    graph.feather.predications.map(edge=>edge.occurrence),
    'the residual names original performed relation occurrences');
  assert.deepEqual(projected.edgeResiduals.map(edge=>edge.sourceRecord),
    graph.feather.predications.map(edge=>edge.sourceRecord),
    'no spectral or geometric view invents source records');
  assert.equal(projected.sourceAuthentication,'caller-supplied-not-adjudicated');
  assert.equal(projected.physicalInterpretation,'not-established');
  assert.equal(Object.isFrozen(projected.positions),true);
  source[0].value[0]=100;
  assert.deepEqual(projected.vector,[4,4,4],
    'proof-bearing projection is a snapshot, not a mutable caller view');
  assert.equal(analyzeKeratinGraph(graph).sectionCount,0,
    'numeric compatibility in a DIFFERENT linear stalk sheaf does not erase the odd-parity obstruction');
});

test('missing source positions and contested local measurements never receive implicit zero extension',()=>{
  const linear=linearSpec(specimen());
  const empty=assessKeratinLinearObservations(linear,[]);
  assert.equal(empty.status,'unassayed-incomplete-or-unqualified-source');
  assert.deepEqual(empty.missingPositions,[id('a'),id('b'),id('c')]);
  assert.equal(empty.vector,null);
  assert.equal(empty.residualNorm,null);
  assert.equal(empty.compatible,null);
  const partial=assessKeratinLinearObservations(linear,[reading('a',0,'meter:a-zero')]);
  assert.deepEqual(partial.missingPositions,[id('b'),id('c')]);
  assert.equal(partial.vector,null,'unobserved b and c are NOT observed zero');
  const contradict=assessKeratinLinearObservations(linear,[
    reading('a',0,'meter:for'),reading('a',1,'meter:against'),
    reading('b',0,'meter:b'),reading('c',0,'meter:c'),
  ]);
  assert.deepEqual(contradict.missingPositions,[]);
  assert.equal(contradict.contestedPositions.length,1);
  assert.equal(contradict.contestedPositions[0].position,id('a'));
  assert.deepEqual(contradict.contestedPositions[0].reports.map(x=>x.sourceRecord),['meter:for','meter:against']);
  assert.equal(contradict.vector,null);
  assert.equal(contradict.compatible,null);
  const corroborated=assessKeratinLinearObservations(linear,[
    reading('a',0,'meter:first'),reading('a',0,'meter:second'),
    reading('b',0,'meter:b'),reading('c',0,'meter:c'),
  ]);
  assert.equal(corroborated.compatible,true);
  assert.deepEqual(corroborated.vector,[0,0,0]);
  assert.equal(corroborated.positions[0].reports.length,2,
    'independent agreeing witnesses survive without numerical double counting');
});

test('FOUR source testimony governs whether a complete numeric reading may become geometry',()=>{
  const linear=linearSpec(specimen());
  const held=[reading('a',0,'evidence:a'),reading('b',0,'evidence:b'),reading('c',0,'evidence:c')];
  assert.equal(assessKeratinLinearObservations(linear,held).compatible,true);
  const variants=[
    {reading:'unknown', evidence:{for:[],against:[]}},
    {reading:'denied', evidence:{for:[],against:['witness:negative']}},
    {reading:'contested', evidence:{for:['witness:positive'],against:['witness:negative']}},
  ];
  for(const variant of variants){
    const result=assessKeratinLinearObservations(linear,[
      {...held[0],evidence:variant.evidence}, held[1],held[2],
    ]);
    assert.equal(result.status,'unassayed-incomplete-or-unqualified-source');
    assert.deepEqual(result.missingPositions,[]);
    assert.deepEqual(result.contestedPositions,[]);
    assert.equal(result.unqualifiedPositions[0].position,id('a'));
    assert.equal(result.unqualifiedPositions[0].reports[0].reading,variant.reading,
      'Data FOUR meaning is preserved, not converted to a numeric vote');
    assert.equal(result.vector,null,'a denied, contested or unwitnessed value cannot produce an apparent zero');
    assert.equal(result.compatible,null);
  }
  const mixed=assessKeratinLinearObservations(linear,[
    held[0], {...held[0],sourceRecord:'source:opposition',evidence:{for:[],against:['witness:opposes']}},
    held[1],held[2],
  ]);
  assert.equal(mixed.unqualifiedPositions[0].reports[0].reading,'denied');
  assert.equal(mixed.compatible,null,
    'an independent opposing source cannot be silently outvoted by a positive source');
});

test('genuine witnessed values can conflict with local restriction geometry, without claiming physical forces',()=>{
  const graph=specimen(),ordinary=linearSpec(graph);
  const observed=[reading('a',1,'meter:a'),reading('b',1,'meter:b'),reading('c',1,'meter:c')];
  assert.equal(assessKeratinLinearObservations(ordinary,observed).compatible,true);
  const twisted=linearSpec(graph,{twisted:true});
  assert.equal(twisted.cohomology.h0,0);
  const obstruction=assessKeratinLinearObservations(twisted,observed);
  assert.equal(obstruction.compatible,false);
  assert.equal(obstruction.status,'incompatible-numeric-coboundary');
  assert.ok(obstruction.residualNorm>0);
  const edge=obstruction.edgeResiduals.find(x=>x.occurrence==='b>c');
  assert.deepEqual(edge.values,[-2]);
  assert.equal(edge.norm,2);
  assert.equal(obstruction.physicalInterpretation,'not-established');
  const tolerated=assessKeratinLinearObservations(twisted,observed,{tolerance:2});
  assert.equal(tolerated.compatible,true,
    'declared numerical tolerance changes only the conditional numeric judgment, not original testimony');
  assert.equal(tolerated.residualNorm,obstruction.residualNorm);
});

test('foreign, accessor-backed, nonfinite or surplus numeric assertions refuse before geometry',()=>{
  const graph=specimen(),linear=linearSpec(graph);
  assert.throws(()=>assessKeratinLinearObservations(structuredClone(linear),[]),
    /original in-process/);
  assert.throws(()=>assessKeratinLinearObservations(linear,[reading('foreign',0,'meter:foreign')]),
    /no original sheaf position/);
  for(const v of [NaN,Infinity,-Infinity,'0',[0,1],[]])
    assert.throws(()=>assessKeratinLinearObservations(linear,[reading('a',v,'meter:bad')]),
      /finite numeric stalk coordinates/);
  assert.throws(()=>assessKeratinLinearObservations(linear,[reading('a',0,'')]),
    /sourceRecord/);
  assert.throws(()=>assessKeratinLinearObservations(linear,[],{tolerance:-1}),
    /tolerance/);
  assert.throws(()=>assessKeratinLinearObservations(linear,[],{unqualifiedEffect:true}),
    /undeclared fields/);
  assert.throws(()=>assessKeratinLinearObservations(linear,[{...reading('a',0,'meter'),admitsPower:true}]),
    /undeclared fields/);
  assert.throws(()=>assessKeratinLinearObservations(linear,[{...reading('a',0,'meter'),evidence:{for:[],against:[],probability:1}}]),
    /undeclared fields/);
  assert.throws(()=>assessKeratinLinearObservations(linear,[{...reading('a',0,'meter'),evidence:{for:['witness','witness'],against:[]}}]),
    /duplicate identity/);
  assert.throws(()=>assessKeratinLinearObservations(linear,[{position:id('a'),value:0,sourceRecord:'meter'}]),
    /own data fields/);
  const evidence=reading('a',0,'meter');
  Object.defineProperty(evidence.evidence.for,'0',{get(){return 'forged';},enumerable:true});
  assert.throws(()=>assessKeratinLinearObservations(linear,[evidence]),/material source identities/);
  let calls=0;
  const accessor=reading('a',[0],'meter');
  Object.defineProperty(accessor,'value',{get(){calls++;return [0];},enumerable:true});
  assert.throws(()=>assessKeratinLinearObservations(linear,[accessor]),/inert own data/,
    'the original snapshot must refuse a getter before the obsolete later own-field reader');
  const array=reading('a',[0],'meter');
  Object.defineProperty(array.value,0,{get(){calls++;return 0;},enumerable:true});
  assert.throws(()=>assessKeratinLinearObservations(linear,[array]),/dense own data slots/);
  assert.equal(calls,0,'malicious getters were not invoked to obtain the numerical source');
});

test('Keratin linear sheaf and observation arrays refuse executable, decorated and oversized sources',()=>{
  const graph=specimen();
  const vertexStalks=graph.feather.positions.map(p=>({position:p.key,dim:1}));
  const relationStalks=graph.feather.predications.map(e=>({
    occurrence:e.occurrence,dim:1,restrict:{from:[[1]],to:[[1]]},
  }));
  assert.equal(keratinLinearSheaf(graph,{vertexStalks,relationStalks}).cohomology.h0,1,
    'ordinary original linear sheaf inputs remain admitted');
  let calls=0;
  const getterOptions={relationStalks};
  Object.defineProperty(getterOptions,'vertexStalks',{
    enumerable:true,get(){calls++;return vertexStalks;},
  });
  assert.throws(()=>keratinLinearSheaf(graph,getterOptions),/linear sheaf options.*inert/);
  const decoratedVertices=[...vertexStalks];
  Object.defineProperty(decoratedVertices,'authority',{value:'unearned'});
  assert.throws(()=>keratinLinearSheaf(graph,{vertexStalks:decoratedVertices,relationStalks}),
    /linear vertex stalks.*dense, undecorated/);
  const accessorRelations=[...relationStalks];
  Object.defineProperty(accessorRelations,'0',{
    enumerable:true,get(){calls++;return relationStalks[0];},
  });
  assert.throws(()=>keratinLinearSheaf(graph,{vertexStalks,relationStalks:accessorRelations}),
    /linear relation stalks.*inert data/);
  const oversizedRelations=Array(257).fill(relationStalks[0]);
  assert.throws(()=>keratinLinearSheaf(graph,{vertexStalks,relationStalks:oversizedRelations}),
    /linear relation stalks.*work limit 256/);

  const linear=linearSpec(graph);
  const accessorObservations=[reading('a',0,'meter')];
  Object.defineProperty(accessorObservations,'0',{
    enumerable:true,get(){calls++;return reading('a',0,'meter');},
  });
  assert.throws(()=>assessKeratinLinearObservations(linear,accessorObservations),
    /linear observations.*inert data/);
  const enormousNumeric=reading('a',[0],'meter');
  enormousNumeric.value.length=1000000;
  assert.throws(()=>assessKeratinLinearObservations(linear,[enormousNumeric]),
    /linear observation values.*work limit 16/);
  const decoratedNumeric=reading('a',[0],'meter');
  Object.defineProperty(decoratedNumeric.value,'surplus',{value:1});
  assert.throws(()=>assessKeratinLinearObservations(linear,[decoratedNumeric]),
    /linear observation values require dense own data slots/);
  const decoratedWitness=reading('a',0,'meter');
  Object.defineProperty(decoratedWitness.evidence.for,Symbol('secret'),{
    get(){calls++;return 'forged';},
  });
  assert.throws(()=>assessKeratinLinearObservations(linear,[decoratedWitness]),
    /linear observation for testimony requires material source identities/);
  assert.equal(calls,0,'hostile source getters never ran during bounded admission');
});

test('two duplicate candidate hole cycles can each be nontrivial while their aggregate boundary span has rank one',()=>{
  const g=specimen({holes:[
    {id:'candidate1',sourceRecord:'s:1',boundary},
    {id:'candidate2',sourceRecord:'s:2',boundary},
  ]});
  assert.equal(g.aggregateIndependentBoundaries,1);
  assert.equal(g.candidateHoles[0].individuallyIndependentH1,true);
  assert.equal(g.candidateHoles[1].individuallyIndependentH1,true);
});

test('wrong-graph analysis cannot tint a different Keratin Graph visualization',()=>{
  const left=specimen(), right=specimen();
  assert.throws(()=>keratinGraphToDot(right,analyzeKeratinGraph(left)),/this particular keratin graph/);
});

test('graph workbench refuses undeclared parameters and oversized computational budgets',()=>{
  assert.throws(()=>specimen({authenticatesItself:true}),/undeclared fields/);
  assert.throws(()=>analyzeKeratinGraph(specimen(),{maxAssignments:2000001}),/maxAssignments/);
  assert.throws(()=>analyzeKeratinGraph(specimen(),{surprise:true}),/undeclared fields/);
});

test('omitted Keratin source options cannot borrow executable or fabricated Object.prototype data',()=>{
  // A missing optional value means absent source evidence, not permission to
  // consult a host's prototype. Keep global test poisoning synchronous and
  // restore every original descriptor even if an assertion fails.
  const poison=(key,act)=>{
    const original=Object.getOwnPropertyDescriptor(Object.prototype,key);
    let called=0;
    Object.defineProperty(Object.prototype,key,{
      configurable:true,
      get(){called++;throw new Error('foreign inherited '+key+' is not source data');},
    });
    try{act();}
    finally{
      if(original)Object.defineProperty(Object.prototype,key,original);
      else delete Object.prototype[key];
    }
    assert.equal(called,0,'omitted '+key+' cannot invoke inherited source getter');
  };
  poison('faces',()=>{
    const graph=specimen();
    assert.equal(graph.filledFaces.length,0,'missing faces remain an empty optional family');
    assert.equal(graph.topology.betti.h1,1);
  });
  const graph=specimen();
  const linear=linearSpec(graph);
  poison('maxAssignments',()=>{
    const analysis=analyzeKeratinGraph(graph);
    assert.equal(analysis.sectionStatus,'exact');
  });
  poison('tolerance',()=>{
    const result=assessKeratinLinearObservations(linear,[]);
    assert.equal(result.status,'unassayed-incomplete-or-unqualified-source');
    assert.equal(result.vector,null);
  });
  poison('vertexStalks',()=>{
    assert.throws(()=>keratinLinearSheaf(graph,{}),
      /linear sheaf requires vertexStalks and relationStalks/);
  });
});

test('nested Keratin fields must be material records, not ambient inherited source facts',()=>{
  // The original fields() guard now returns a data-only snapshot. Every
  // nested consumer must actually USE it; checking descriptors and then
  // reading the original would silently pick up absent source coordinates
  // from host Object.prototype data.
  const base={source,selectors,stalks,contacts:contacts(true),faces:[],holes:[],locks:[],observers:[]};
  const graph=specimen();
  const vertexStalks=graph.feather.positions.map(p=>({position:p.key,dim:1}));
  const relationStalks=graph.feather.predications.map(e=>({
    occurrence:e.occurrence,dim:1,restrict:{from:[[1]],to:[[1]]},
  }));
  const cannotInherit=(key,value,invoke,reason)=>{
    const saved=Object.getOwnPropertyDescriptor(Object.prototype,key);
    Object.defineProperty(Object.prototype,key,{value,configurable:true});
    try { assert.throws(invoke,reason); }
    finally {
      if(saved)Object.defineProperty(Object.prototype,key,saved);
      else delete Object.prototype[key];
    }
  };
  cannotInherit('states',['0','1'],
    ()=>keratinGraphOfPredications({...base,stalks:[{position:id('a')},...stalks.slice(1)]}),
    /stalk states.*invalid named list/);
  cannotInherit('allowed',parity(0),
    ()=>keratinGraphOfPredications({...base,contacts:[{occurrence:'a>b'},...base.contacts.slice(1)]}),
    /contact admissibility must be a bounded array/);
  cannotInherit('excludes',['0'],
    ()=>keratinGraphOfPredications({...base,locks:[{id:'lock',position:id('a'),sourceRecord:'s:lock'}]}),
    /invalid named list/);
  cannotInherit('direction',1,
    ()=>keratinGraphOfPredications({...base,holes:[{id:'gap',sourceRecord:'s:gap',boundary:[
      {occurrence:'a>b'},...boundary.slice(1),
    ]}]}),
    /each oriented step must reference an original occurrence/);
  cannotInherit('visibleOccurrences',[],
    ()=>keratinGraphOfPredications({...base,observers:[{id:'scope',visiblePositions:[id('a')]}]}),
    /invalid named list/);
  const missingRestrict=[{occurrence:relationStalks[0].occurrence,dim:1},...relationStalks.slice(1)];
  cannotInherit('restrict',{from:[[1]],to:[[1]]},
    ()=>keratinLinearSheaf(graph,{vertexStalks,relationStalks:missingRestrict}),
    /linear restriction matrices.*plain source record/);
  assert.equal(keratinGraphOfPredications(base).kind,
    'signgraph.keratinGraph.finiteFiberHoleReading.v1',
    'legitimate material source declarations remain accepted');
});

test('Keratin never imports fabricated Feather source positions or selector laws',()=>{
  const good=specimen();
  assert.equal(good.feather.predications.length,source.length);
  let invoked=0;
  const occurrence={...source[0],cell:{...source[0].cell,subject:{...source[0].cell.subject}}};
  Object.defineProperty(occurrence.cell.subject,'performed',{
    enumerable:true,get(){invoked++;return 'forged:position';},
  });
  assert.throws(()=>specimen({source:[occurrence,...source.slice(1)]}),/feather graph:/,
    'original source-position admission happens before Keratin model construction');
  const input=[...source];
  Object.defineProperty(input,Symbol.iterator,{
    get(){invoked++;return Array.prototype[Symbol.iterator];},
  });
  assert.throws(()=>specimen({source:input}),/feather graph:/);
  const selector={...selectors};
  Object.defineProperty(selector,'transversePredicate',{
    enumerable:true,get(){invoked++;return 'contacts';},
  });
  assert.throws(()=>specimen({selectors:selector}),/feather graph:/);
  assert.equal(invoked,0,'source predicates and positions were never generated by caller callbacks');
  assert.equal(specimen().candidateHoles.length,good.candidateHoles.length,
    'existing valid original Feather→Keratin receiving stays source-consistent');
});

test('Keratin graph source admission rejects executable top-level and nested source records',()=>{
 let calls=0;
 const base={source,selectors,stalks,contacts:contacts(false),faces:[],holes:[],locks:[],observers:[]};
 const first={...base};Object.defineProperty(first,'selectors',
   {enumerable:true,get(){calls++;return selectors}});
 const badStalk={...stalks[0]};Object.defineProperty(badStalk,'position',
   {enumerable:true,get(){calls++;return id('a')}});
 const contact={...contacts(false)[0]};Object.defineProperty(contact,'allowed',
   {enumerable:true,get(){calls++;return parity(0)}});
 const badPair=['0','0'];Object.defineProperty(badPair,'1',
   {enumerable:true,get(){calls++;return '0'}});
 const cases=[first,{...base,stalks:[badStalk,...stalks.slice(1)]},
   {...base,contacts:[contact,...base.contacts.slice(1)]},
   {...base,contacts:[{...base.contacts[0],allowed:[badPair]},...base.contacts.slice(1)]}];
 for(const invalid of cases)assert.throws(()=>keratinGraphOfPredications(invalid),
   /keratin graph:.*inert/u);
 assert.equal(calls,0);
});


test('Keratin uses original Feather source cuts throughout discrete stalk, contact, hole and observer admission',()=>{
  const input={source,selectors,stalks,contacts:contacts(false),faces:[],holes:[],locks:[],observers:[]};
  let traps=0;
  const protectedArray = values => new Proxy([...values],{
    get(target,key,receiver){
      if(key===Symbol.iterator||key==='map'||key==='every'||key==='some'){
        traps++;
        throw new Error('foreign caller-owned source iteration');
      }
      return Reflect.get(target,key,receiver);
    },
  });
  const pair=['0','0'];
  const pairProxy=new Proxy(pair,{
    get(target,key,receiver){
      if(key==='0'){traps++;return 'forged';}
      return Reflect.get(target,key,receiver);
    },
  });
  const contactsCut=contacts(false).map((record,index)=>index===0
    ?{...record,allowed:protectedArray([pairProxy,parity(0)[1]])}
    :record);
  const graph=keratinGraphOfPredications({
    ...input,
    stalks:protectedArray(stalks),
    contacts:protectedArray(contactsCut),
    locks:protectedArray([{id:'cut:lock',position:id('a'),sourceRecord:'s:lock',excludes:protectedArray([])}]),
    holes:protectedArray([{id:'cut:hole',sourceRecord:'s:hole',boundary:protectedArray(boundary)}]),
    observers:protectedArray([{id:'cut:observer',
      visiblePositions:protectedArray([id('a'),id('b')]),
      visibleOccurrences:protectedArray(['a>b'])}]),
  });
  assert.equal(graph.kind,'signgraph.keratinGraph.finiteFiberHoleReading.v1');
  assert.equal(graph.stalks.length,3);
  assert.equal(graph.contacts.length,3);
  assert.equal(graph.candidateHoles.length,1);
  assert.equal(graph.observers.length,1);
  assert.equal(traps,0,'no unqualified source-array iterator, method or numeric slot may run');
});

test('Keratin linear consumers traverse original immutable source cuts for stalks, evidence and numbers',()=>{
  const graph=specimen({contacts:contacts(false)});
  let traps=0;
  const untrusted=original=>new Proxy([...original],{
    get(target,key,receiver){
      if(key===Symbol.iterator||key==='map'||key==='every'||key==='some'){
        traps++;throw new Error('unqualified array method');
      }
      return Reflect.get(target,key,receiver);
    },
  });
  const vertices=graph.feather.positions.map(p=>({position:p.key,dim:1}));
  const relations=graph.feather.predications.map(edge=>({
    occurrence:edge.occurrence,dim:1,restrict:{from:[[1]],to:[[1]]},
  }));
  const linear=keratinLinearSheaf(graph,{
    vertexStalks:untrusted(vertices),relationStalks:untrusted(relations),
  });
  assert.equal(linear.cohomology.h0,1);
  const rows=graph.feather.positions.map((point,i)=>({
    position:point.key,
    value:untrusted([0]),
    sourceRecord:'qualified:'+i,
    evidence:{for:untrusted(['witness:'+i]),against:untrusted([])},
  }));
  const result=assessKeratinLinearObservations(linear,untrusted(rows));
  assert.equal(result.compatible,true);
  assert.equal(result.status,'compatible-numeric-coboundary');
  assert.equal(traps,0,'the original linear sheaf and observed numeric consumers used detached source cuts');
});

test('Keratin graph rejects hostile indexed source arrays, hidden fields and boundary steps',()=>{
 let calls=0;
 const base={source,selectors,stalks,contacts:contacts(false),faces:[],holes:[],locks:[],observers:[]};
 const badArray=[...stalks];
 Object.defineProperty(badArray,'0',{enumerable:true,get(){calls++;return stalks[0]}});
 const hidden={...stalks[0]};Object.defineProperty(hidden,'authority',{value:'forged',enumerable:false});
 const steps=[...boundary];Object.defineProperty(steps,'0',{enumerable:true,get(){calls++;return boundary[0]}});
 const badDirection={occurrence:'a>b'};
 Object.defineProperty(badDirection,'direction',{enumerable:true,get(){calls++;return 1}});
 const cases=[
   {...base,stalks:badArray},
   {...base,stalks:[hidden,...stalks.slice(1)]},
   {...base,holes:[{id:'hole',sourceRecord:'source:hole',boundary:steps}]},
   {...base,holes:[{id:'hole',sourceRecord:'source:hole',boundary:[badDirection,...boundary.slice(1)]}]},
 ];
 for(const invalid of cases)
   assert.throws(()=>keratinGraphOfPredications(invalid),TypeError);
 assert.equal(calls,0);
 const legitimate=keratinGraphOfPredications(base);
 assert.equal(legitimate.kind,'signgraph.keratinGraph.finiteFiberHoleReading.v1');
});
