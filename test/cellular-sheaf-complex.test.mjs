import test from 'node:test';
import assert from 'node:assert/strict';
import { cellular2Sheaf, matrixMarketCoboundary } from '../src/cellular-sheaf-complex.mjs';

const edge = (id, from, to, scale = 1) => ({ id, from, to, dim: 1,
  restrict: { from: [[scale]], to: [[scale]] } });
const triangle = () => ({
  vertices: ['a', 'b', 'c'].map(id => ({ id, dim: 1 })),
  edges: [edge('ab', 'a', 'b', 2), edge('bc', 'b', 'c', 3), edge('ca', 'c', 'a', 4)],
});
const walk = (sign = 1) => (sign === 1 ? [
  ['ab', 1, '1/2'], ['bc', 1, '1/3'], ['ca', 1, '1/4'],
] : [
  ['ca', -1, '1/4'], ['bc', -1, '1/3'], ['ab', -1, '1/2'],
]).map(([e, direction, scale]) => ({ edge: e, direction, restrict: [[scale]] }));
const face = (id, boundary = walk()) => ({ id, dim: 1, boundary });

test('a genuinely filled cycle changes sheaf H1; exact face maps commute with oriented vertex maps', () => {
  const data = triangle();
  const graph = cellular2Sheaf({ ...data, faces: [] });
  assert.deepEqual(graph.cohomology, { h0: 1, h1: 1, h2: 0 });
  const disk = cellular2Sheaf({ ...data, faces: [face('filled')] });
  assert.deepEqual(disk.cohomology, { h0: 1, h1: 0, h2: 0 });
  assert.deepEqual(disk.rank, { zero: 2, one: 1 });
  assert.deepEqual(disk.coboundary.one, [['1/2', '1/3', '1/4']]);
  assert.equal(disk.basis.zero[2].cell, 'c');
  assert.equal(disk.basis.one[0].cell, 'ab');
  assert.equal(disk.basis.two[0].cell, 'filled');
  assert.equal(Object.isFrozen(disk.coboundary.one[0]), true);
});

test('the oppositely oriented second face gives a genuine H2 sphere class', () => {
  const result = cellular2Sheaf({ ...triangle(), faces: [face('front'), face('back', walk(-1))] });
  assert.deepEqual(result.cohomology, { h0: 1, h1: 0, h2: 1 });
  assert.deepEqual(result.coboundary.one[1], ['-1/2', '-1/3', '-1/4']);
});

test('noncommuting restrictions refuse instead of fabricating a higher sheaf', () => {
  const bad = walk();
  bad[2].restrict[0][0] = '1/2';
  assert.throws(() => cellular2Sheaf({ ...triangle(), faces: [face('bad', bad)] }), /noncommuting restriction/);
});

test('the sheaf diagram refuses cancellations masking incoherent path restrictions', () => {
  // One vertex and two loop edges. The commutator attaching walk has a
  // zero integer face boundary; thus d1=0 and d1*d0=0 regardless of d0.
  // Nevertheless the two routes p→a→f can disagree (from=1 vs to=2).
  const vertex = [{ id: 'p', dim: 1 }];
  const loops = ['a', 'b'].map(id => ({ id, from:'p', to:'p', dim:1,
    restrict:{ from:[[1]], to:[[2]] } }));
  const boundary = [['a',1],['b',1],['a',-1],['b',-1]].map(([id,direction]) =>
    ({edge:id,direction,restrict:[[1]]}));
  assert.throws(() => cellular2Sheaf({ vertices:vertex, edges:loops,
    faces:[{id:'commutator',dim:1,boundary}] }), /noncommuting restriction diagram/);
});

test('a repeated edge cannot acquire incompatible restrictions into the same face', () => {
  const vertices = [{id:'p',dim:1}];
  const edges = [{id:'loop',from:'p',to:'p',dim:1,
    restrict:{from:[[1]],to:[[1]]}}];
  const faces = [{id:'filled',dim:1,boundary:[
    {edge:'loop',direction:1,restrict:[[1]]},
    {edge:'loop',direction:-1,restrict:[[2]]},
  ]}];
  assert.throws(() => cellular2Sheaf({ vertices, edges, faces }),
    /ambiguous edge-to-face restriction/);
});

test('no hidden identity restrictions: typed stalk dimensions and incidence-maps are checked', () => {
  const base = triangle();
  assert.throws(() => cellular2Sheaf({ ...base, faces: [face('bad', walk().map((s,i) => i === 0 ? { ...s, restrict: [[1, 0]] } : s))] }), /needs 1 x 1 restriction/);
  assert.throws(() => cellular2Sheaf({ ...base, faces: [face('bad', [{ edge: 'ab', direction: 1, restrict: [[1]] }])] }), /not closed/);
  assert.throws(() => cellular2Sheaf({ ...base, faces: [], edges: [edge('ab','a','b',0.5), ...base.edges.slice(1)] }), /exact rational/);
});

test('multidimensional vertex stalks keep their unobserved kernel rather than collapsing to scalar graph cohomology', () => {
  const vertices = ['a','b','c'].map(id => ({ id, dim: 2 }));
  const edges = [edge('ab','a','b'),edge('bc','b','c'),edge('ca','c','a')]
    .map(e => ({ ...e, restrict: { from: [[1,0]], to: [[1,0]] } }));
  const faces = [{ id: 'disk', dim: 1, boundary: walk().map(s => ({ ...s, restrict: [[1]] })) }];
  // The edge projections observe only the first coordinate of each vertex.
  // In the selected face every oriented edge map has coefficient 1.
  const built = cellular2Sheaf({ vertices, edges, faces });
  assert.deepEqual(built.cohomology, { h0: 4, h1: 0, h2: 0 });
  assert.equal(built.c0, 6); assert.equal(built.c1, 3); assert.equal(built.c2, 1);
});

test('Matrix Market exports the true coboundaries and 1-based coordinates, not graph-only adjacency', () => {
  const integer = cellular2Sheaf({ vertices: ['a','b','c'].map(id => ({id,dim:1})),
    edges: [edge('ab','a','b'),edge('bc','b','c'),edge('ca','c','a')],
    faces: [face('disk', walk().map(s => ({...s,restrict: [[1]]})))],
  });
  assert.equal(matrixMarketCoboundary(integer, 0), [
    '%%MatrixMarket matrix coordinate integer general',
    '% SignGraph d0: typed basis and exact ranks remain in cellular2Sheaf',
    '3 3 6',
    '1 1 -1', '1 2 1', '2 2 -1', '2 3 1', '3 1 1', '3 3 -1', '',
  ].join('\n'));
  assert.match(matrixMarketCoboundary(integer, 1), /^%%MatrixMarket matrix coordinate integer general\n[^\n]*\n1 3 3\n/);
  const rational = cellular2Sheaf({ ...triangle(), faces: [face('disk')] });
  const mm = matrixMarketCoboundary(rational, 1);
  assert.match(mm, /^%%MatrixMarket matrix coordinate real general\n/);
  assert.match(mm, /1 1 5\.00000000000000000e-1/);
  assert.equal(matrixMarketCoboundary(rational, 0).split('\n')[2], '3 3 6');
  assert.throws(() => matrixMarketCoboundary(rational, 2), /degree 0 or 1/);
});

test('Matrix Market refuses a nonzero exact coefficient which binary64 cannot carry', () => {
  const tiny = `1/${'1' + '0'.repeat(400)}`;
  const data = { vertices: [{ id:'a',dim:1 },{ id:'b',dim:1 }],
    edges:[edge('ab','a','b',1)], faces: [{ id:'disk',dim:1,boundary:[
      {edge:'ab',direction:1,restrict:[[tiny]]},
      {edge:'ab',direction:-1,restrict:[[tiny]]},
    ]}] };
  // All face incidence cancels to zero: a legitimate exact zero must NOT overflow.
  assert.equal(matrixMarketCoboundary(cellular2Sheaf(data), 1).split('\n')[2], '1 1 0');
  const unitLoop = {vertices:[{id:'p',dim:1}],edges:[{id:'a',from:'p',to:'p',dim:1,restrict:{from:[[1]],to:[[1]]}}],
    faces:[{id:'f',dim:1,boundary:[{edge:'a',direction:1,restrict:[[tiny]]}]}]};
  // A loop is an admitted closed walk: d0=0, but d1 retains the nonzero rational.
  assert.throws(() => matrixMarketCoboundary(cellular2Sheaf(unitLoop), 1), RangeError);
});

test('Matrix Market exchange requires a source-admitted original result, not a forged JSON lookalike',()=>{
  const good=cellular2Sheaf({...triangle(),faces:[face('certified')]});
  const forged={...good};
  assert.equal(forged.kind,good.kind);
  assert.throws(()=>matrixMarketCoboundary(forged,0),/admitted cellular2Sheaf/u);
  assert.throws(()=>matrixMarketCoboundary(JSON.parse(JSON.stringify(good)),1),/admitted cellular2Sheaf/u);
  assert.match(matrixMarketCoboundary(good,1),/^%%MatrixMarket matrix coordinate real/u);
});
