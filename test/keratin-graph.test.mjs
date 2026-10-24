import test from 'node:test';
import assert from 'node:assert/strict';
import {keratinGraphOfPredications,keratinPositionKey,keratinLinearSheaf,assessKeratinLinearObservations,analyzeKeratinGraph,keratinGraphToDot} from '../src/keratin-graph.mjs';

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

const linearSpec=(graph,{twisted=false}={})=>keratinLinearSheaf(graph,{
  vertexStalks:graph.feather.positions.map(p=>({position:p.key,dim:1})),
  relationStalks:graph.feather.predications.map(e=>({
    occurrence:e.occurrence,dim:1,
    restrict:{from:[[1]],to:[[twisted&&e.occurrence==='b>c'?-1:1]]},
  })),
});
const reading=(position,value,sourceRecord)=>({position:id(position),value,sourceRecord});

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
  assert.equal(empty.status,'unassayed-missing-or-contested-source');
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
  let calls=0;
  const accessor=reading('a',[0],'meter');
  Object.defineProperty(accessor,'value',{get(){calls++;return [0];},enumerable:true});
  assert.throws(()=>assessKeratinLinearObservations(linear,[accessor]),/own data fields/);
  const array=reading('a',[0],'meter');
  Object.defineProperty(array.value,0,{get(){calls++;return 0;},enumerable:true});
  assert.throws(()=>assessKeratinLinearObservations(linear,[array]),/dense own data slots/);
  assert.equal(calls,0,'malicious getters were not invoked to obtain the numerical source');
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
