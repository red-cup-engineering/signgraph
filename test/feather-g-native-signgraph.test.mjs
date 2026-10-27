import test from 'node:test';
import assert from 'node:assert/strict';
import { defineType } from '@red-cup-engineering/signcell/type-system';
import { createTypedMark, referenceOf } from '@red-cup-engineering/signcell/typed-mark';
import { createSignGraph } from '../src/semantic-graph.mjs';
import { encodeFeatherGGraphCollection, decodeFeatherGGraphCollection } from '../src/feather-g-codec.mjs';

const unwrap = result => { assert.equal(result.ok,true,JSON.stringify(result)); return result.value; };
const markType = unwrap(defineType({
  id:'test.feather-g-mark@1',name:'FEATHER-G codec mark',description:'Opaque, typed fixture source',schema:{},parents:[],
}));
function sourceGraph() {
  const cells = ['a','b','witness-positive','witness-negative','unrelated'].map(s=>unwrap(createTypedMark(markType,s)));
  const [a,b,pos,neg] = cells.map(referenceOf);
  const rel = id=>({id,subjectTypes:[markType.id],objectTypes:[markType.id],witnessTypes:[markType.id]});
  return unwrap(createSignGraph({cells, relations:[rel('supports'),rel('opposes')],edges:[
    {subject:a,predicate:'supports',object:b,witness:pos},
    {subject:a,predicate:'supports',object:b,witness:neg},
    {subject:b,predicate:'opposes',object:a,witness:neg},
  ]}));
}

test('true source-admitted SignGraph exports as an endpoint-induced FEATHER-G graph with full witness sidecar',()=>{
  const graph=sourceGraph();
  const result=encodeFeatherGGraphCollection([{graph}],{projection:'undirected-simple'});
  assert.deepEqual(result.graphs['0'],[[0,1]]);
  assert.equal(result.receipts[0].sourceId,graph.id);
  assert.equal(result.receipts[0].sourceKind,'sign.graph');
  assert.equal(result.receipts[0].edgeGroups[0].originalDirectedOccurrences.length,3);
  assert.equal(result.receipts[0].excludedSourceCells.length,3);
  const ids=result.receipts[0].edgeGroups[0].originalDirectedOccurrences.map(p=>p.identity);
  assert.deepEqual(new Set(ids),new Set(graph.edges.map(x=>x.id)));
  assert.deepEqual(decodeFeatherGGraphCollection(result.graphs).graphs[0].incidences.map(e=>e.endpoints),[[0,1]]);
});

test('tampered SignGraph does not receive FEATHER-G export, even when its edge structure looks plausible',()=>{
  const forged=structuredClone(sourceGraph());
  forged.edges[0].id='ni:forged';
  assert.throws(()=>encodeFeatherGGraphCollection([{graph:forged}],{projection:'undirected-simple'}),/readmission failed/);
});
