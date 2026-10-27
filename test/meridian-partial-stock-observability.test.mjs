import assert from 'node:assert/strict';
import test from 'node:test';

// Science #215 / #260: mathematical assay only; none of these graphs or
// stock/edge observations are authenticated Actor, port or resource events.
function incidence(nodes, edges) {
  const idx = new Map(nodes.map((node,i)=>[node,i]));
  const B = nodes.map(()=>edges.map(()=>0n));
  for(const [j,[a,b]] of edges.entries()) { B[idx.get(a)][j]-=1n; B[idx.get(b)][j]+=1n; }
  return B;
}
function rank(rows, columns) {
  const a=rows.map(row=>row.map(BigInt));let r=0;
  for(let col=0;col<columns&&r<a.length;col++) {
    const pivot=a.findIndex((row,i)=>i>=r&&row[col]!==0n);
    if(pivot<0)continue;
    [a[r],a[pivot]]=[a[pivot],a[r]];
    for(let i=r+1;i<a.length;i++) {
      if(a[i][col]===0n)continue;
      const p=a[r][col],q=a[i][col];
      for(let j=col;j<columns;j++)a[i][j]=p*a[i][j]-q*a[r][j];
    }
    r++;
  }
  return r;
}
function anchoredUnknownForest(nodes, edges, observed, unmetered) {
  const positions=new Map(nodes.map((node,i)=>[node,i]));
  const anchor=nodes.length;
  const parent=Array.from({length:anchor+1},(_,i)=>i);
  const root=n=> { while(parent[n]!==n) {parent[n]=parent[parent[n]];n=parent[n];}return n; };
  const connect=(a,b)=> {const x=root(a),y=root(b);if(x===y)return false;parent[x]=y;return true;};
  // Joining all unobserved vertices to a common anchor makes an unmeasured
  // transfer path BETWEEN two missing stock nodes into an explicit cycle.
  for(let i=0;i<nodes.length;i++)if(!observed.has(i))connect(i,anchor);
  for(const i of unmetered) {
    const [a,b]=edges[i];
    if(!connect(positions.get(a),positions.get(b)))return false;
  }
  return true;
}
function partialSignature(B,flow,observed,meters) {
  return [...observed.map(i=>B[i].reduce((a,x,j)=>a+x*flow[j],0n)),
          ...meters.map(j=>flow[j])].join(',');
}
function partialBinaryUniqueness(B,observed,meters) {
  const seen=new Set(),m=B[0]?.length??0;
  for(let fmask=0;fmask<2**m;fmask++) {
    const flow=Array.from({length:m},(_,i)=>BigInt((fmask>>i)&1));
    const key=partialSignature(B,flow,observed,meters);
    if(seen.has(key))return false;
    seen.add(key);
  }
  return true;
}
function checkPartialStockFamily(nodes, allEdges) {
  let cases=0,positive=0;
  for(let graphMask=0;graphMask<2**allEdges.length;graphMask++){
    const edges=allEdges.filter((_,i)=>(graphMask>>i)&1);
    const B=incidence(nodes,edges),m=edges.length;
    for(let smask=0;smask<2**nodes.length;smask++){
      const observed=nodes.map((_,i)=>i).filter(i=>(smask>>i)&1);
      const observedSet=new Set(observed);
      let minimum=m+1;
      for(let wmask=0;wmask<2**m;wmask++){
        const meters=edges.map((_,i)=>i).filter(i=>(wmask>>i)&1);
        const unmetered=edges.map((_,i)=>i).filter(i=>!((wmask>>i)&1));
        const rankFull=rank(observed.map(i=>unmetered.map(j=>B[i][j])),unmetered.length)===unmetered.length;
        const forest=anchoredUnknownForest(nodes,edges,observedSet,unmetered);
        const binary=partialBinaryUniqueness(B,observed,meters);
        assert.equal(forest,rankFull,`forest/rank graph ${graphMask} rows ${smask} meters ${wmask}`);
        assert.equal(binary,rankFull,`binary/rank graph ${graphMask} rows ${smask} meters ${wmask}`);
        if(forest){minimum=Math.min(minimum,meters.length);positive++;}
        cases++;
      }
      const fullRank=rank(observed.map(i=>B[i]),m);
      assert.equal(minimum,m-fullRank,`minimum meters graph ${graphMask} rows ${smask}`);
    }
  }
  return {cases,positive};
}
test('partial vertex stock and edge meters: all 5832 small directed graph/measurement combinations',()=>{
  const nodes=['A','B','C'];
  const edges=nodes.flatMap(a=>nodes.filter(b=>a!==b).map(b=>[a,b]));
  const checked=checkPartialStockFamily(nodes,edges);
  assert.equal(checked.cases,5832);
  assert.ok(checked.positive>0);
});
test('original parallel exchange IDs and self-loops retain the missing-stock refusal',()=>{
  const checked=checkPartialStockFamily(['A','B'],[['A','A'],['A','B'],['A','B']]);
  assert.equal(checked.cases,108); // four stock masks, 3^3 graph/witness cases
});
test('two unobserved tree vertices defeat §7.20 despite no undirected cycle',()=>{
  const nodes=['A','B','C'],edges=[['A','B'],['B','C']],B=incidence(nodes,edges);
  const f=[1n,0n],g=[2n,1n];
  assert.equal(partialSignature(B,f,[1],[]),partialSignature(B,g,[1],[]));
  assert.notDeepEqual(f,g);
  assert.equal(rank([B[1]],2),1);
  assert.equal(anchoredUnknownForest(nodes,edges,new Set([1]),[0,1]),false);
  assert.equal(anchoredUnknownForest(nodes,edges,new Set([0,1]),[0,1]),true);
  assert.equal(anchoredUnknownForest(nodes,edges,new Set([1]),[1]),true);
  assert.notEqual(partialSignature(B,f,[1],[0]),partialSignature(B,g,[1],[0]));
});
