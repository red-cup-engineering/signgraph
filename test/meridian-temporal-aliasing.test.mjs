import assert from "node:assert/strict";
import test from "node:test";
import {conditionalTemporalFlowAliasing} from "../src/temporal-flow-aliasing.mjs";
const edge=(id,from,to)=>({exchange:{id},from:{id:from},to:{id:to}});
const query=(edges,T,windows)=>conditionalTemporalFlowAliasing(edges,{
  microintervalCount:T,windowLengths:windows,
});
test("an original cycle with coarse windows hides exact individual step histories",()=>{
  const cycle=[edge("ab","A","B"),edge("bc","B","C"),edge("ca","C","A")];
  const first=query(cycle,4,[4]);
  assert.equal(first.originalCycleRank,1);
  assert.equal(first.unresolvedEdgeHistoryDimension,3);
  assert.equal(query(cycle,4,[2,2]).unresolvedEdgeHistoryDimension,2);
  assert.equal(query(cycle,4,[1,1,1,1]).unresolvedEdgeHistoryDimension,0);
  assert.equal(first.actualFlowReadings,"not-supplied");
  assert.equal(first.derivedClock,"not-established");
});
test("two exact nonnegative time histories share every step stock and coarse edge total",()=>{
  const arcs=[["A","B"],["B","C"],["C","A"]];
  const histories=[[[2,2,2],[0,0,0]],[[0,0,0],[2,2,2]]];
  const observation=h=>({
    d:h.map(flux=>{
      const stock={A:0,B:0,C:0};
      arcs.forEach(([a,b],j)=>{stock[a]-=flux[j];stock[b]+=flux[j];});
      return [stock.A,stock.B,stock.C];
    }),
    edgeTotals:arcs.map((_,j)=>h.reduce((n,flux)=>n+flux[j],0)),
  });
  assert.deepEqual(observation(histories[0]),observation(histories[1]));
  assert.notDeepEqual(histories[0],histories[1]);
  assert.equal(query(arcs.map(([a,b],j)=>edge("e"+j,a,b)),2,[2])
    .unresolvedEdgeHistoryDimension,1);
});
test("forests, parallel edges and self-loops keep separate conditional ranks",()=>{
  const tree=query([edge("ab","A","B"),edge("bc","B","C")],4,[4]);
  assert.equal(tree.originalCycleRank,0);
  assert.equal(tree.unresolvedEdgeHistoryDimension,0);
  assert.equal(tree.realizedRhythm,"not-established");
  assert.equal(query([edge("loop","A","A")],3,[3]).originalCycleRank,1);
  assert.equal(query([edge("a","A","B"),edge("b","A","B")],3,[3])
    .unresolvedEdgeHistoryDimension,2);
});
test("invalid partition, invalid source ID and unbounded inputs refuse",()=>{
  const one=[edge("ab","A","B")];
  for(const windows of [[],[0,2],[3],[1,1,1],[1,0],[2,0]])
    assert.throws(()=>query(one,2,windows),TypeError);
  assert.throws(()=>query(one,0,[1]),RangeError);
  assert.throws(()=>query(one,4097,[4097]),RangeError);
  assert.throws(()=>query([edge("a","A","B"),edge("a","B","C")],2,[2]),TypeError);
  assert.throws(()=>query([{exchange:{id:"e"},from:{id:"A"}}],2,[2]),TypeError);
  assert.throws(()=>query(null,2,[2]),TypeError);
});
function rank(rows,columns){
  const m=rows.map(row=>row.map(BigInt));let r=0;
  for(let col=0;col<columns&&r<m.length;col++){
    let pivot=-1;for(let i=r;i<m.length;i++)if(m[i][col]!==0n){pivot=i;break;}
    if(pivot<0)continue;
    [m[r],m[pivot]]=[m[pivot],m[r]];
    for(let i=r+1;i<m.length;i++)if(m[i][col]!==0n){
      const p=m[r][col],q=m[i][col];
      for(let j=col;j<columns;j++)m[i][j]=p*m[i][j]-q*m[r][j];
    }
    r++;
  }
  return r;
}
function observedRank(edges,T,windows){
  const m=edges.length,columns=m*T,rows=[];
  const nodes=[...new Set(edges.flatMap(e=>[e.from.id,e.to.id]))];
  for(let t=0;t<T;t++)for(const v of nodes){
    const row=Array(columns).fill(0);
    edges.forEach((e,j)=>{if(e.from.id===v)row[t*m+j]--;
      if(e.to.id===v)row[t*m+j]++;});
    rows.push(row);
  }
  let start=0;
  for(const length of windows){
    for(let j=0;j<m;j++){
      const row=Array(columns).fill(0);
      for(let t=start;t<start+length;t++)row[t*m+j]=1;
      rows.push(row);
    }
    start+=length;
  }
  return rank(rows,columns);
}
test("independent exact integer observation rank matches the theorem on 224 multigraph/window cases",()=>{
  const choices=[edge("ab","A","B"),edge("bc","B","C"),
    edge("ca","C","A"),edge("loop","A","A"),edge("ab2","A","B")];
  let examined=0;
  for(let graph=0;graph<32;graph++){
    const edges=choices.filter((_,j)=>(graph>>j)&1);
    for(let T=1;T<=3;T++)for(let cuts=0;cuts<(1<<(T-1));cuts++){
      const windows=[];let start=0;
      for(let i=1;i<=T;i++)if(i===T||((cuts>>(i-1))&1)){
        windows.push(i-start);start=i;
      }
      const got=query(edges,T,windows);
      assert.equal(got.unresolvedEdgeHistoryDimension,
        edges.length*T-observedRank(edges,T,windows),
        "graph="+graph+",T="+T+",cuts="+cuts);
      examined++;
    }
  }
  assert.equal(examined,224);
});

test("public temporal math rejects executable source getters before graph qualification",()=>{
 let invoked=0;
 const valid=edge("a","A","B");
 const getterExchange={from:valid.from,to:valid.to};
 Object.defineProperty(getterExchange,"exchange",{enumerable:true,get(){invoked++;return valid.exchange;}});
 const getterEndpoint={exchange:valid.exchange,to:valid.to};
 Object.defineProperty(getterEndpoint,"from",{enumerable:true,get(){invoked++;return valid.from;}});
 const nested={};Object.defineProperty(nested,"id",{enumerable:true,get(){invoked++;return "A";}});
 for(const transfer of [getterExchange,getterEndpoint,{exchange:valid.exchange,from:nested,to:valid.to}])
   assert.throws(()=>query([transfer],2,[2]),TypeError);
 const decorated=[valid];decorated.grant="forged";
 assert.throws(()=>query(decorated,2,[2]),/sparse or decorated/u);
 const indexed=[valid];
 Object.defineProperty(indexed,"0",{enumerable:true,get(){invoked++;return valid;}});
 assert.throws(()=>query(indexed,2,[2]),/inert array positions/u);
 const windows=[2];Object.defineProperty(windows,"0",{enumerable:true,get(){invoked++;return 2;}});
 assert.throws(()=>query([valid],2,windows),/inert array positions/u);
 const options={windowLengths:[2]};
 Object.defineProperty(options,"microintervalCount",{enumerable:true,get(){invoked++;return 2;}});
 assert.throws(()=>conditionalTemporalFlowAliasing([valid],options),/inert own data/u);
 assert.equal(invoked,0);
});

test("one captured temporal input keeps original exchange identity under caller edits",()=>{
 const transfer=edge("ab","A","B"),windows=[2];
 const got=query([transfer],2,windows);
 const original={kind:got.kind,exchangeCount:got.exchangeCount,
   endpoints:got.endpointCount,rank:got.originalCycleRank,
   missing:got.unresolvedEdgeHistoryDimension,windows:[...got.proposedWindowLengths]};
 transfer.exchange.id="new-exchange";
 transfer.from.id="new-source";
 windows[0]=1;
 assert.deepEqual({
   kind:got.kind,exchangeCount:got.exchangeCount,endpoints:got.endpointCount,
   rank:got.originalCycleRank,missing:got.unresolvedEdgeHistoryDimension,
   windows:got.proposedWindowLengths
 },original);
 assert.equal(Object.isFrozen(got.proposedWindowLengths),true);
});


test("same conditional graph result does not reflect original performed source order or identity",()=>{
  // Science #215, §7.59: distinct actual Holofoam intervention histories can
  // share final numeric projections. These are deliberately *synthetic typed
  // exchanges*, not a fabricated mapping of interventions into Actor ports.
  const first=[edge("eA","A","B"),edge("eB","B","C"),edge("eC","C","A")];
  const reordered=[first[2],first[1],first[0]];
  const replaced=first.map((e,i)=>edge("replacement-"+i,e.from.id,e.to.id));
  const a=query(first,2,[2]),b=query(reordered,2,[2]),c=query(replaced,2,[2]);
  assert.notDeepEqual(first,reordered);
  assert.notDeepEqual(first,replaced);
  assert.deepEqual(a,b);
  assert.deepEqual(a,c);
  assert.equal(a.unresolvedEdgeHistoryDimension,1);
  for(const observed of [a,b,c]){
    assert.equal(observed.sourceCompleteness,"not-attested");
    assert.equal(observed.actualFlowReadings,"not-supplied");
    assert.equal(observed.realizedRhythm,"not-established");
    assert.equal(observed.derivedClock,"not-established");
  }
});

test("parameter intervention shape is refused as an original graph transfer, not converted into a meridian",()=>{
  // These admitted-looking v5 parameter fields alone include no exchange,
  // source/target endpoints, measured port debit or performed return event.
  const parameterEvents=[
    {kind:"metabolism",parameter:"uptake",value:.03},
    {kind:"metabolism",parameter:"diffusion",value:.24},
    {kind:"metabolism",parameter:"replenish",value:.05},
  ];
  assert.throws(()=>query(parameterEvents,2,[2]),/missing exchange/u);
});
