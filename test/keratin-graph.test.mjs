import test from 'node:test';
import assert from 'node:assert/strict';
import {keratinGraphOfPredications,keratinPositionKey,analyzeKeratinGraph,keratinGraphToDot} from '../src/keratin-graph.mjs';

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
