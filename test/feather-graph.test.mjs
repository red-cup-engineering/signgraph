import test from 'node:test';
import assert from 'node:assert/strict';
import { featherGraphOfPredications, positGraphOfFeather } from '../src/feather-graph.mjs';

const pos = (performed, display = 'same', side = 'token') => ({performed, side, display});
const edge = (id, from, predicate, to, fromMark = 'same', toMark = 'same') => ({
  occurrence: id, sourceRecord: \`source:\${id}\`,
  cell: {subject: pos(from, fromMark), predicate, object: pos(to, toMark)},
});
const selectors = {axialPredicate: 'continued-by', transversePredicate: 'contacts'};
const fork = [
  edge('a>b', 'act:a', 'continued-by', 'act:b'),
  edge('a>c', 'act:a', 'continued-by', 'act:c'),
  edge('b>c', 'act:b', 'contacts', 'act:c'),
];

test('one source-reported fork and separately recorded contact leave routes UNEQUATED', () => {
  const before = JSON.stringify(fork);
  const g = featherGraphOfPredications(fork, selectors);
  assert.equal(g.kind, 'signgraph.featherGraph.sourcePositionReadout.v1');
  assert.equal(g.positions.length, 3);
  assert.deepEqual(g.predications.map(p => p.occurrence), ['a>b', 'a>c', 'b>c']);
  assert.deepEqual(g.forks.map(f => [f.branches, f.contacts, f.reading]), [
    [['a>b', 'a>c'], ['b>c'], 'source-reported-transverse-contact'],
  ]);
  assert.deepEqual(g.routeComparisons.map(x => [x.direct, x.via, x.comparison]), [
    [['a>c'], ['a>b', 'b>c'], 'unmeasured'],
  ]);
  assert.equal(JSON.stringify(fork), before, 'source records are not changed');
  assert.ok(Object.isFrozen(g.forks[0]));
  assert.ok(Object.isFrozen(g.routeComparisons[0].via));
});

test('branch-only candidate has no invented transverse witness or equal route', () => {
  const g = featherGraphOfPredications(fork.slice(0,2), selectors);
  assert.equal(g.forks[0].reading, 'branch-only');
  assert.deepEqual(g.forks[0].contacts, []);
  assert.deepEqual(g.routeComparisons, []);
  assert.equal(g.predications.length, 2);
});

test('complete increasing relation, even with competing routes, is NOT a feather fork', () => {
  const all = [];
  for (let i=0;i<5;i++) for (let j=i+1;j<5;j++)
    all.push(edge(\`\${i}>\${j}\`, \`act:\${i}\`, 'continued-by', \`act:\${j}\`));
  const g = featherGraphOfPredications(all, selectors);
  assert.equal(g.predications.length, 10);
  assert.deepEqual(g.forks, [], 'comparable children are not siblings');
  assert.deepEqual(g.routeComparisons, []);
});

test('equal Mark display NEVER collapses distinct performed source positions', () => {
  const g=featherGraphOfPredications([
    edge('a>b','act:a','continued-by','act:b'),
    edge('a>c','act:a','continued-by','act:c'),
  ], selectors);
  assert.equal(new Set(g.positions.map(p=>p.display)).size,1);
  assert.equal(new Set(g.positions.map(p=>p.key)).size,3);
  assert.equal(g.forks.length,1);
});

test('transverse direction changes proof route without minting converse relations', () => {
  const g=featherGraphOfPredications([
    ...fork.slice(0,2),
    edge('c>b','act:c','contacts','act:b'),
  ],selectors);
  assert.deepEqual(g.routeComparisons.map(r=>[r.direct,r.via]),[[['a>b'],['a>c','c>b']]]);
  assert.equal(g.predications.some(x=>x.occurrence==='b>c'),false);
});

test('posit graph charges same feather graph, preserving contrary independent witnesses',()=>{
  const g=featherGraphOfPredications(fork,selectors);
  const posits=[
    {occurrence:'b>c',sourceRecord:'positive:7',for:['observer:east'],against:[]},
    {occurrence:'b>c',sourceRecord:'negative:8',for:[],against:['observer:west']},
  ];
  const p=positGraphOfFeather(g,posits);
  assert.equal(p.feather,g);
  assert.equal(p.feather.positions,g.positions);
  assert.deepEqual(p.testimony.map(x=>[x.for,x.against]),[[[],['observer:west']],[['observer:east'],[]]]);
  assert.match(p.judgment,/not-settled/);
  assert.ok(Object.isFrozen(p.testimony));
});

test('refuse forged additions, invalid provenance, cycles, collisions and copied authority',()=>{
  const bad=fn=>assert.throws(fn, /feather graph:/);
  bad(()=>featherGraphOfPredications([edge('x','a','continued-by','a')],selectors));
  bad(()=>featherGraphOfPredications([
    edge('a>b','a','continued-by','b'),edge('b>a','b','continued-by','a'),
  ],selectors));
  bad(()=>featherGraphOfPredications([fork[0],fork[0]],selectors));
  bad(()=>featherGraphOfPredications([{...fork[0],authenticated:true}],selectors));
  bad(()=>featherGraphOfPredications([{...fork[0],sourceRecord:''}],selectors));
  bad(()=>featherGraphOfPredications([
    edge('p>q','a','continued-by','b','first'),
    edge('p>r','a','continued-by','c','other'),
  ],selectors));
  bad(()=>featherGraphOfPredications(fork,{axialPredicate:'same',transversePredicate:'same'}));
  const g=featherGraphOfPredications(fork,selectors);
  bad(()=>positGraphOfFeather(structuredClone(g),[]));
  bad(()=>positGraphOfFeather(g,[{occurrence:'imaginary',sourceRecord:'s',for:['x'],against:[]}]));
  bad(()=>positGraphOfFeather(g,[{occurrence:'b>c',sourceRecord:'s',for:['x'],against:[],settled:true}]));
  bad(()=>positGraphOfFeather(g,[
    {occurrence:'b>c',sourceRecord:'same',for:['x'],against:[]},
    {occurrence:'b>c',sourceRecord:'same',for:[],against:['y']},
  ]));
});

test('literal __proto__ and delimiter-bearing source IDs do not collide in role keys',()=>{
  const g=featherGraphOfPredications([
    edge('one','a\u0000token','continued-by','__proto__'),
    edge('two','a','contacts','__proto__'),
  ],selectors);
  assert.equal(g.positions.length,3);
  assert.equal(g.predications.length,2);
});

test('finite readout refuses uncontrolled combinatorial fork explosion',()=>{
  const entries=Array.from({length:130},(_,i)=>edge(\`r>\${i}\`,'root','continued-by',\`leaf:\${i}\`));
  assert.throws(()=>featherGraphOfPredications(entries,selectors),/8192 finite fork-pair/);
});
