import assert from 'node:assert/strict';
import test from 'node:test';

// Science #215: a finite exact assay of the *mathematical* edge-sensor rule.
// Neither the synthetic edges nor the readings are source-admitted transfers.
// Forest, integral row-rank, and exhaustive binary histories are separate oracles.
function incidence(nodes, edges) {
  const position = new Map(nodes.map((name, index) => [name, index]));
  const B = nodes.map(() => edges.map(() => 0n));
  edges.forEach(([from, to], j) => {
    B[position.get(from)][j] -= 1n;
    B[position.get(to)][j] += 1n;
  });
  return B;
}
function rank(rows, columns) {
  // Exact fraction-free elimination; deliberately bounded to the tiny assays below.
  const a = rows.map(row => row.map(BigInt));
  let r = 0;
  for (let col = 0; col < columns && r < a.length; col++) {
    const pivot = a.findIndex((row, i) => i >= r && row[col] !== 0n);
    if (pivot < 0) continue;
    [a[r], a[pivot]] = [a[pivot], a[r]];
    for (let i = r + 1; i < a.length; i++) {
      if (a[i][col] === 0n) continue;
      const p = a[r][col];
      const q = a[i][col];
      for (let j = col; j < columns; j++) a[i][j] = p * a[i][j] - q * a[r][j];
    }
    r++;
  }
  return r;
}
function complementIsForest(nodes, edges, sensors) {
  const parent = new Map(nodes.map(node => [node, node]));
  const root = node => {
    while (parent.get(node) !== node) node = parent.get(node);
    return node;
  };
  edges.forEach(([u, v], i) => {
    if (sensors.has(i)) return;
    const ru = root(u); const rv = root(v);
    if (ru === rv) parent.set('__cycle__', true);
    else parent.set(ru, rv);
  });
  return !parent.has('__cycle__');
}
function signature(B, flow, sensors = []) {
  return [...B.map(row => row.reduce((s, entry, j) => s + entry * flow[j], 0n)),
    ...sensors.map(j => flow[j])].join(',');
}
function fullBinaryUniqueness(B, edgeCount, sensors) {
  const signatures = new Set();
  for (let mask = 0; mask < 2 ** edgeCount; mask++) {
    const flow = Array.from({length: edgeCount}, (_, j) => BigInt((mask >> j) & 1));
    const s = signature(B, flow, sensors);
    if (signatures.has(s)) return false;
    signatures.add(s);
  }
  return true;
}
function checkAllSensorSets(nodes, edges, expectedSufficient) {
  const m = edges.length;
  const B = incidence(nodes, edges);
  let sufficient = 0;
  const sufficientByCount = Array(m + 1).fill(0);
  for (let mask = 0; mask < 2 ** m; mask++) {
    const sensors = Array.from({length:m},(_,i)=>i).filter(i => (mask >> i) & 1);
    const P = sensors.map(i => Array.from({length:m}, (_,j)=>BigInt(i===j)));
    const forest = complementIsForest(nodes, edges, new Set(sensors));
    const exactRank = rank([...B, ...P], m) === m;
    const binaryUnique = fullBinaryUniqueness(B, m, sensors);
    assert.equal(exactRank, forest, 'rank/forest mismatch: ' + mask);
    assert.equal(binaryUnique, forest, 'exhaustive/forest mismatch: ' + mask);
    if (forest) { sufficient++; sufficientByCount[sensors.length]++; }
  }
  assert.equal(sufficient, expectedSufficient);
  return {B, sufficientByCount};
}

test('DAG diamond: measured stock, known ports and aggregate throughput do not identify route', () => {
  const {B,sufficientByCount} = checkAllSensorSets(['A','B','C','D'],
    [['A','B'],['A','C'],['B','D'],['C','D']], 15);
  const fB = [1n,0n,1n,0n], fC=[0n,1n,0n,1n];
  assert.equal(signature(B, fB), signature(B, fC));
  assert.equal(fB.reduce((a,b)=>a+b), fC.reduce((a,b)=>a+b));
  assert.notEqual(signature(B, fB,[3]),signature(B,fC,[3]));
  assert.equal(rank(B,4),3);
  assert.equal(rank([...B,[1n,1n,1n,1n]],4),3);
  assert.equal(rank([...B,[0n,0n,0n,1n]],4),4);
  assert.deepEqual(sufficientByCount,[0,4,6,4,1]);
});

test('two cycles: two arbitrarily chosen meters can miss one entire independent flux', () => {
  const {B,sufficientByCount} = checkAllSensorSets(['A','B','C','D','E'],
    [['A','B'],['B','C'],['C','A'],['A','D'],['D','E'],['E','A']], 49);
  const first=[1n,1n,1n,0n,0n,0n], second=[0n,0n,0n,1n,1n,1n];
  assert.equal(signature(B,first),signature(B,second));
  assert.equal(first.reduce((a,b)=>a+b),second.reduce((a,b)=>a+b));
  assert.equal(signature(B,[0n,0n,0n,0n,0n,0n],[0,1]),signature(B,second,[0,1]));
  assert.notEqual(signature(B,first,[2,5]),signature(B,second,[2,5]));
  assert.equal(rank(B,6),4);
  assert.equal(rank([...B,[1n,1n,1n,1n,1n,1n]],6),5);
  assert.equal(rank([...B,[1n,0n,0n,0n,0n,0n],[0n,1n,0n,0n,0n,0n]],6),5);
  assert.equal(rank([...B,[0n,0n,1n,0n,0n,0n],[0n,0n,0n,0n,0n,1n]],6),6);
  assert.deepEqual(sufficientByCount,[0,0,9,18,15,6,1]);
});

test('parallel original exchanges: two reports of one exchange must not invent extra edges', () => {
  const {B,sufficientByCount}=checkAllSensorSets(['A','B'],[['A','B'],['A','B']],3);
  assert.equal(signature(B,[1n,0n]),signature(B,[0n,1n]));
  assert.notEqual(signature(B,[1n,0n],[0]),signature(B,[0n,1n],[0]));
  assert.deepEqual(sufficientByCount,[0,2,1]);
});

test('self-loop: exact stocks cannot see even one real internal edge transfer', () => {
  const {B,sufficientByCount}=checkAllSensorSets(['A'],[['A','A']],1);
  assert.equal(signature(B,[0n]),signature(B,[1n]));
  assert.notEqual(signature(B,[0n],[0]),signature(B,[1n],[0]));
  assert.deepEqual(sufficientByCount,[0,1]);
});
