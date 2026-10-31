import test from 'node:test';
import assert from 'node:assert/strict';
import { featherGraphOfPredications, positGraphOfFeather, featherSourceFields, featherSourceArray } from '../src/feather-graph.mjs';

const pos = (performed, display = 'same', side = 'token') => ({performed, side, display});
const edge = (id, from, predicate, to, fromMark = 'same', toMark = 'same') => ({
  occurrence: id, sourceRecord: `source:${id}`,
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
    all.push(edge(`${i}>${j}`, `act:${i}`, 'continued-by', `act:${j}`));
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

test('shared Feather/Keratin source admission cannot be bypassed with a caller refusal callback',()=>{
  let invoked=0;
  const input={performed:'source:performed'};
  Object.defineProperty(input,'side',{
    enumerable:true,get(){invoked++;return 'token';},
  });
  const nonThrowing=()=>{};
  assert.throws(()=>featherSourceFields(input,['performed','side'],'role',nonThrowing),
    /feather graph: role:.*inert own data/,
    'a callback is not a source-admission authority');
  const list=['source:one'];
  Object.defineProperty(list,Symbol.iterator,{
    value(){invoked++;return ['forged'][Symbol.iterator]();},
  });
  assert.throws(()=>featherSourceArray(list,'witnesses',16,nonThrowing),
    /feather graph: witnesses: array must be dense/);
  assert.throws(()=>featherSourceFields(null,['id'],'role','keratin graph'),
    /keratin graph: role:.*plain source record/,
    'Keratin supplies only a diagnostic namespace, not a second admission implementation');
  assert.equal(invoked,0);
});

test('source-origin Feather admissions refuse executable selector, occurrence, Cell and position fields',()=>{
  let invoked=0;
  const bad=fn=>assert.throws(fn,/feather graph:/);
  const decorated=[...fork];
  Object.defineProperty(decorated,Symbol.iterator,{
    get(){invoked++;return Array.prototype[Symbol.iterator];},
  });
  bad(()=>featherGraphOfPredications(decorated,selectors));
  const hostileSelectors={...selectors};
  Object.defineProperty(hostileSelectors,'axialPredicate',{
    enumerable:true,get(){invoked++;return 'continued-by';},
  });
  bad(()=>featherGraphOfPredications(fork,hostileSelectors));

  const occurrence={...fork[0]};
  Object.defineProperty(occurrence,'sourceRecord',{
    enumerable:true,get(){invoked++;return 'forged:source';},
  });
  bad(()=>featherGraphOfPredications([occurrence],selectors));
  const nested={...fork[0],cell:{...fork[0].cell}};
  Object.defineProperty(nested.cell,'predicate',{
    enumerable:true,get(){invoked++;return 'continued-by';},
  });
  bad(()=>featherGraphOfPredications([nested],selectors));
  const endpoint={...fork[0],cell:{...fork[0].cell,subject:{...fork[0].cell.subject}}};
  Object.defineProperty(endpoint.cell.subject,'performed',{
    enumerable:true,get(){invoked++;return 'false:performed';},
  });
  bad(()=>featherGraphOfPredications([endpoint],selectors));
  const concealed={...fork[0],cell:{...fork[0].cell}};
  Object.defineProperty(concealed.cell,'authority',{value:'invalid',enumerable:false});
  bad(()=>featherGraphOfPredications([concealed],selectors));
  assert.equal(invoked,0,'no user getter or iterator may construct a source-position graph');
  assert.equal(featherGraphOfPredications(fork,selectors).forks.length,1,
    'the original valid performed fork and its independent contact remain unchanged');
});

test('original Feather posit budget applies to total witnesses across ALL source records and both testimony sides',()=>{
  const feather=featherGraphOfPredications(fork,selectors);
  const all=Array.from({length:8192},(_,i)=>`witness:${i}`);
  const first={occurrence:'b>c',sourceRecord:'bulk:one',for:all,against:[]};
  const second={occurrence:'b>c',sourceRecord:'bulk:two',for:[],against:['independent']};
  const exact=positGraphOfFeather(feather,[first]);
  assert.equal(exact.testimony.length,1);
  assert.equal(exact.testimony[0].for.length,8192,
    'the existing finite source budget remains inclusive');
  assert.throws(()=>positGraphOfFeather(feather,[first,second]),
    /aggregate witness budget/,
    'row-local checks cannot admit 8193 witness slots');
  assert.throws(()=>positGraphOfFeather(feather,[{...first,against:['opposed']}]),
    /aggregate witness budget/,
    'contrary testimony in the same row consumes the same budget');
  const split=positGraphOfFeather(feather,[
    {...first,for:all.slice(0,4096)},
    {...second,for:all.slice(4096),against:[]},
  ]);
  assert.equal(split.testimony.reduce((n,row)=>n+row.for.length+row.against.length,0),8192);
  assert.equal(split.feather,feather,
    'bounded multiple-source testimony still preserves the original feather reading');
});

test('original Feather posit testimony is bounded inert source data, never a caller iterator',()=>{
  const feather=featherGraphOfPredications(fork,selectors);
  const one={occurrence:'b>c',sourceRecord:'performed:1',for:['report:1'],against:[]};
  let invoked=0;
  const bad=fn=>assert.throws(fn,/feather graph:/);
  const posit={...one};
  Object.defineProperty(posit,'for',{
    enumerable:true,get(){invoked++;return ['invented'];},
  });
  bad(()=>positGraphOfFeather(feather,[posit]));
  const evidence=[...one.for];
  Object.defineProperty(evidence,Symbol.iterator,{
    value(){invoked++;return ['invented'][Symbol.iterator]();},
  });
  bad(()=>positGraphOfFeather(feather,[{...one,for:evidence}]));
  const decorated=[one];
  Object.defineProperty(decorated,Symbol.iterator,{
    get(){invoked++;return Array.prototype[Symbol.iterator];},
  });
  bad(()=>positGraphOfFeather(feather,decorated));
  const hidden={...one};
  Object.defineProperty(hidden,'office',{value:'unearned',enumerable:false});
  bad(()=>positGraphOfFeather(feather,[hidden]));
  bad(()=>positGraphOfFeather(feather,Array(8193).fill(one)),
    'source rows beyond the existing finite candidate budget refuse before iteration');
  bad(()=>positGraphOfFeather(feather,[{...one,for:Array(8193).fill('repeat')}]));
  assert.equal(invoked,0,'no source testimony getter or iterator executes');
  const original=positGraphOfFeather(feather,[one]);
  assert.deepEqual(original.testimony[0].for,['report:1']);
  assert.deepEqual(original.testimony[0].against,[]);
  assert.equal(original.feather,feather);
});

test('source-owned Feather snapshots preserve legitimate null-prototype data declarations',()=>{
  const nullRecord=entries=>Object.assign(Object.create(null),entries);
  const input=fork.map(occurrence=>nullRecord({
    occurrence:occurrence.occurrence,
    sourceRecord:occurrence.sourceRecord,
    cell:nullRecord({
      subject:nullRecord(occurrence.cell.subject),
      predicate:occurrence.cell.predicate,
      object:nullRecord(occurrence.cell.object),
    }),
  }));
  const option=nullRecord(selectors);
  const original=featherGraphOfPredications(fork,selectors);
  const received=featherGraphOfPredications(input,option);
  assert.deepEqual(received.positions,original.positions);
  assert.deepEqual(received.predications,original.predications);
  assert.deepEqual(received.forks,original.forks);
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
  const entries=Array.from({length:130},(_,i)=>edge(`r>${i}`,'root','continued-by',`leaf:${i}`));
  assert.throws(()=>featherGraphOfPredications(entries,selectors),/8192 finite fork-pair/);
});
