import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeFeatherGGraphCollection, encodeFeatherGGraphCollection, decodeFeatherGEmbeddingCsv,
} from '../src/feather-g-codec.mjs';

const edge = (id, from, p, to) => ({
  occurrence: id, sourceRecord:`source:${id}`,
  cell: {
    subject:{performed:from,side:'token',display:'same'}, predicate:p,
    object:{performed:to,side:'token',display:'same'},
  },
});
const fork = [
  edge('a>b','act:a','continued-by','act:b'),
  edge('a>c','act:a','continued-by','act:c'),
  edge('b>c','act:b','contacts','act:c'),
];
const selectors = {axialPredicate:'continued-by', transversePredicate:'contacts'};

test('reference FEATHER-G JSON graph collection becomes an inert SignGraph structural projection', () => {
  const decoded=decodeFeatherGGraphCollection('{"0":[[1,0],[1,2]],"1":[[0,1],[1,2],[2,0]]}');
  assert.equal(decoded.kind,'signgraph.featherG.structuralCollection.v1');
  assert.equal(decoded.graphs[0].directed,false);
  assert.deepEqual(decoded.graphs[0].vertices,[0,1,2]);
  assert.deepEqual(decoded.graphs[0].incidences.map(e=>e.endpoints),[[0,1],[1,2]]);
  assert.match(decoded.graphs[0].sourceQualification,/native source and witnesses absent/);
  assert.ok(Object.isFrozen(decoded.graphs[0].incidences[0]));
});

test('graph import refuses lost vertices, duplicates, loops, gaps and invalid wire payloads',()=>{
  const invalid=[
    {'0':[]}, {'0':[[0,0]]}, {'0':[[0,1],[1,0]]},
    {'0':[[0,2]]}, {'1':[[0,1]]},
    {'0':[[0,1.5]]}, {'0':[[0,-1]]}, {'0':[[0,1]], '2':[[0,1]]},
  ];
  for (const input of invalid) assert.throws(()=>decodeFeatherGGraphCollection(input),/FEATHER-G codec/);
  assert.throws(()=>decodeFeatherGGraphCollection('{'),/FEATHER-G codec/);
});

test('native source-position feather readout projects to FEATHER-G without claiming source preservation in graph JSON',()=>{
  const original=JSON.stringify(fork);
  const encoded=encodeFeatherGGraphCollection([{source:fork,selectors}],{projection:'undirected-simple'});
  assert.equal(encoded.kind,'signgraph.featherG.exportProjection.v1');
  assert.deepEqual(encoded.graphs['0'],[[0,1],[0,2],[1,2]]);
  assert.equal(encoded.receipts[0].edgeGroups.length,3);
  assert.ok(encoded.receipts[0].edgeGroups.every(g=>g.originalDirectedOccurrences[0].sourceRecord));
  assert.match(encoded.receipts[0].sourceQualification,/conditional/);
  assert.equal(JSON.stringify(fork),original);
  const reread=decodeFeatherGGraphCollection(JSON.stringify(encoded.graphs));
  assert.equal(reread.graphs[0].incidences.length,3);
  assert.notEqual(reread.kind,encoded.kind);
});

test('parallel source predications are distinct in sidecar, collapsed explicitly in undirected FEATHER-G projection',()=>{
  const source=[...fork,edge('c>b','act:c','contacts','act:b')];
  const projected=encodeFeatherGGraphCollection([{source,selectors}],{projection:'undirected-simple'});
  assert.equal(projected.graphs['0'].length,3);
  assert.equal(projected.receipts[0].edgeGroups.find(e=>e.originalDirectedOccurrences.length===2)?.originalDirectedOccurrences.length,2);
  assert.match(projected.receipts[0].projectionLoss.join(' '),/parallel/);
});

test('export requires explicit loss selection and refuses unrepresentable loops',()=>{
  assert.throws(()=>encodeFeatherGGraphCollection([{source:fork,selectors}]),/explicitly select/);
  assert.deepEqual(encodeFeatherGGraphCollection([{source:[edge('a>b','a','continued-by','b'),edge('c>d','c','contacts','d')],selectors}],{projection:'undirected-simple'}).graphs['0'],[[0,1],[2,3]]);
  assert.throws(()=>encodeFeatherGGraphCollection([{source:[edge('a>a','a','contacts','a')],selectors}],{projection:'undirected-simple'}),/FEATHER-G codec/);
});

test('reference FEATHER-G CSV ids and declared embedding dimensions join to original graph indices',()=>{
  const graph=decodeFeatherGGraphCollection({'0':[[0,1]],'1':[[0,1],[1,2]]});
  const result=decodeFeatherGEmbeddingCsv('id,x_0,x_1\n0.0,0.12,-0.3\n1.0,0.5,0.75\n',
    {'0':[[0,1]],'1':[[0,1],[1,2]]},{order:1,evalPoints:1});
  assert.equal(result.graphs.graphs.length,graph.graphs.length);
  assert.deepEqual(result.embeddings[1].values,[0.5,0.75]);
  assert.match(result.qualification,/noninvertible/);
  assert.throws(()=>decodeFeatherGEmbeddingCsv('id,x_0,x_1\n1,0.2,0.4\n0,0.3,0.5', {'0':[[0,1]],'1':[[0,1]]},{order:1,evalPoints:1}),/wrong id/);
  assert.throws(()=>decodeFeatherGEmbeddingCsv('id,x_0,x_1\n0,NaN,0.4', {'0':[[0,1]]},{order:1,evalPoints:1}),/nonnumeric/);
  assert.throws(()=>decodeFeatherGEmbeddingCsv('id,x_0\n0,0.1', {'0':[[0,1]]},{order:1,evalPoints:1}),/model width/);
});

test('accepted readout may be used directly by numeric FEATHER-G descriptor reader',()=>{
  const readout=decodeFeatherGGraphCollection({'0':[[0,1]]});
  const descriptor=decodeFeatherGEmbeddingCsv('id,x_0,x_1\n0,1,0',readout,{order:1,evalPoints:1});
  assert.equal(descriptor.embeddings[0].graphIndex,0);
  const spoof=structuredClone(readout);
  assert.throws(()=>decodeFeatherGEmbeddingCsv('id,x_0,x_1\n0,1,0',spoof,{order:1,evalPoints:1}),/graph IDs/);
});

test('object wire admission rejects getters at every edge-list layer without executing them',()=>{
  let executed=0;
  const first={};
  Object.defineProperty(first,'0',{enumerable:true,get(){executed++;return [[0,1]];}});
  const nested=[[0,1]];
  Object.defineProperty(nested,'0',{enumerable:true,get(){executed++;return [0,1];}});
  const endpoint=[0,1];
  Object.defineProperty(endpoint,'1',{enumerable:true,get(){executed++;return 1;}});
  for(const candidate of [first,{'0':nested},{'0':[endpoint]}]){
    assert.throws(()=>decodeFeatherGGraphCollection(candidate),/FEATHER-G codec/u);
  }
  assert.equal(executed,0,'descriptor checks cannot call external getters');
});
test('object wire admission refuses sparse, decorated, symbol and nonplain edge collections',()=>{
  const sparse=new Array(2);sparse[0]=[0,1];
  const decorated=[[0,1]];decorated.extra='not-wire';
  const pair=[0,1];pair.extra=2;
  const hidden=[[0,1]];Object.defineProperty(hidden,'hidden',{value:2});
  const symbol={ '0':[[0,1]], [Symbol('event')]:1 };
  for(const invalid of [
    {'0':sparse},{'0':decorated},{'0':[pair]},{'0':hidden},
    symbol,new Date(),Object.create({'0':[[0,1]]}),
  ])assert.throws(()=>decodeFeatherGGraphCollection(invalid),/FEATHER-G codec/u);
});
test('ordinary parsed FEATHER-G inputs roundtrip without mutation or forged source identity',()=>{
  const source={'0':[[1,0],[1,2]],'1':[[0,1]]};
  const baseline=JSON.stringify(source);
  const first=decodeFeatherGGraphCollection(source);
  const fromText=decodeFeatherGGraphCollection(JSON.stringify(source));
  assert.deepEqual(first.graphs.map(g=>g.incidences.map(e=>e.endpoints)),
    fromText.graphs.map(g=>g.incidences.map(e=>e.endpoints)));
  assert.equal(JSON.stringify(source),baseline);
  source['0'][0][0]=999;
  assert.deepEqual(first.graphs[0].incidences[0].endpoints,[0,1]);
  assert.match(first.sourceQualification,/unwitnessed/u);
});

test('descriptor reader rejects forged structural kinds and export getters before execution',()=>{
  let calls=0;
  const counterfeit={graphs:[]};
  Object.defineProperty(counterfeit,'kind',{enumerable:true,
    get(){calls++;return 'signgraph.featherG.structuralCollection.v1';}});
  assert.throws(()=>decodeFeatherGEmbeddingCsv('id,x_0,x_1\n0,1,0',
    counterfeit,{order:1,evalPoints:1}),/graph IDs/);
  const exportInput={kind:'signgraph.featherG.exportProjection.v1'};
  Object.defineProperty(exportInput,'graphs',{enumerable:true,
    get(){calls++;return {'0':[[0,1]]};}});
  assert.throws(()=>decodeFeatherGEmbeddingCsv('id,x_0,x_1\n0,1,0',
    exportInput,{order:1,evalPoints:1}),/graph IDs/);
  assert.equal(calls,0);
  const ordinary={kind:'signgraph.featherG.exportProjection.v1',graphs:{'0':[[0,1]]}};
  assert.equal(decodeFeatherGEmbeddingCsv('id,x_0,x_1\n0,1,0',
    ordinary,{order:1,evalPoints:1}).embeddings.length,1);
});
