import assert from "node:assert/strict";
import test from "node:test";
import {conditionalFlowCutErrorBudgets} from "../src/flow-resolution-budget.mjs";
const t = (id, from, to) => ({exchange:{id},from:{id:from},to:{id:to}});
const exact = (ids, atoms="1", unit="kg") => Object.fromEntries(ids.map(id=>[id,{atoms,unit}]));
const query = (transfers, {meters=[],observed=null,vertex={},edge={},identifiable=true}={}) =>
  conditionalFlowCutErrorBudgets(transfers,{
    proposedWitnessExchangeIds:new Set(meters),
    proposedObservedCompartmentIds:observed===null?null:new Set(observed),
    hypotheticalErrorCeilings:{vertex,edge},
    structuralIdentifiable:identifiable,
  });
test("eight-vertex source chain yields attained center 4 +/- 4, never unique 4",()=>{
  const vertices=Array.from({length:8},(_,i)=>"v"+i);
  const transfers=Array.from({length:7},(_,i)=>t("e"+i,vertices[i],vertices[i+1]));
  const got=query(transfers,{vertex:exact(vertices)});
  assert.equal(got.standing,"hypothetical-calibration-design-only");
  assert.equal(got.actualReadings,"not-supplied");
  assert.deepEqual(got.unmeteredExchanges.map(e=>e.radius.atoms),["1","2","3","4","3","2","1"]);
  const plus=[5,6,7,8,7,6,5],minus=[3,2,1,0,1,2,3],nominal=[-4,0,0,0,0,0,0,4];
  const incidence=f=>vertices.map((_,i)=>(i===0?0:f[i-1])-(i===7?0:f[i]));
  for(const f of [plus,minus])assert.ok(incidence(f).every((v,i)=>Math.abs(nominal[i]-v)<=1));
  assert.equal(Math.abs(4-plus[3]),4);
  assert.equal(Math.abs(4-minus[3]),4);
});
test("proposed meters contribute their own cut error; unknown budget never becomes zero",()=>{
  const transfers=[t("e1","A","B"),t("e2","B","C"),t("e3","C","D")];
  const known=query(transfers,{observed:["B"],meters:["e1","e3"],
    vertex:exact(["B"],"2"),edge:exact(["e1","e3"],"3")});
  assert.equal(known.unmeteredExchanges.length,1);
  assert.deepEqual(known.unmeteredExchanges[0].radius,{atoms:"5",unit:"kg"});
  const missing=query(transfers,{observed:["B"],meters:["e1","e3"],vertex:exact(["B"],"2")});
  assert.equal(missing.unmeteredExchanges[0].status,"calibration-unprovided");
  assert.equal(missing.unmeteredExchanges[0].radius,null);
  assert.deepEqual(missing.unmeteredExchanges[0].missingAssumptions,["edge:e1"]);
});
test("cycles, self-loops, no measured vertex and unspecified calibration are explicit refusals",()=>{
  const loop=[t("ab","A","B"),t("ba","B","A")];
  assert.ok(query(loop,{identifiable:false,vertex:exact(["A","B"])}).unmeteredExchanges.every(e=>
    e.status==="structurally-undetermined"&&e.radius===null));
  const one=[t("a","A","B")];
  assert.equal(query(one,{observed:[],vertex:{}}).unmeteredExchanges[0].status,"structurally-undetermined");
  assert.equal(query(one).unmeteredExchanges[0].status,"calibration-unprovided");
  assert.equal(query([t("loop","A","A")],{identifiable:false,vertex:exact(["A"])}).unmeteredExchanges[0].status,"structurally-undetermined");
});
test("admitted identity, exact units and nonnegative atoms are mandatory",()=>{
  const transfers=[t("ab","A","B")];
  for (const vertex of [ {X:{atoms:"1",unit:"kg"}}, {A:{atoms:"-1",unit:"kg"}},
    {A:{atoms:"1e1",unit:"kg"}}, {A:{atoms:1,unit:"kg"}}, {A:{atoms:"1",unit:""}} ])
    assert.throws(()=>query(transfers,{vertex}),TypeError);
  assert.throws(()=>query(transfers,{vertex:{A:{atoms:"1",unit:"kg"},B:{atoms:"2",unit:"g"}}}),/mixed units/);
  assert.throws(()=>query(transfers,{meters:["ab"],edge:{X:{atoms:"1",unit:"kg"}}}),TypeError);
  const huge="9".repeat(80);
  assert.equal(query(transfers,{vertex:exact(["A","B"],huge)}).unmeteredExchanges[0].radius.atoms,huge);
});
test("two physically distinct Resources are computed in separate, source-scoped units",()=>{
  const water=query([t("water-ex","A","B")],{vertex:exact(["A","B"],"2","kg")});
  const cash=query([t("cash-ex","A","B")],{vertex:exact(["A","B"],"5","USD")});
  assert.equal(water.unmeteredExchanges[0].radius.unit,"kg");
  assert.equal(cash.unmeteredExchanges[0].radius.unit,"USD");
});
test("seeded conservation-plus-cut oracle bounds perturbations with a crossed metered edge",()=>{
  // Independent incidence arithmetic, not the helper's graph traversal.
  let state=20261027;
  const next=()=>(state=(Math.imul(state,1664525)+1013904223)>>>0);
  for (let trial=0;trial<1500;trial++) {
    const count=3+next()%8;
    const edgeList=Array.from({length:count-1},(_,i)=>t("e"+i,"v"+i,"v"+(i+1)));
    edgeList.push(t("bridge","v0","v"+(count-1)));
    const meters=["bridge"], allV=Array.from({length:count},(_,i)=>"v"+i);
    const vertexBudgets=Object.fromEntries(allV.map(id=>[id,{atoms:String(1+next()%4),unit:"atoms"}]));
    const edgeBudgets={bridge:{atoms:String(1+next()%4),unit:"atoms"}};
    const flow=Object.fromEntries(edgeList.map(e=>[e.exchange.id,next()%40]));
    const delta=Object.fromEntries(allV.map(id=>[id,0]));
    for(const e of edgeList){delta[e.from.id]-=flow[e.exchange.id];delta[e.to.id]+=flow[e.exchange.id];}
    const observed=Object.fromEntries(allV.map(id=>[id,delta[id]+
      ((next()%2===0?-1:1)*(next()%(Number(vertexBudgets[id].atoms)+1)))]));
    const reading=flow.bridge+((next()%2===0?-1:1)*(next()%(Number(edgeBudgets.bridge.atoms)+1)));
    const calc=query(edgeList,{meters,vertex:vertexBudgets,edge:edgeBudgets});
    for(const e of calc.unmeteredExchanges){
      assert.equal(e.status,"conditional-error-radius");
      const side=new Set(e.cutSideEndpointIds);
      let lhs=0;for(const v of side)lhs+=observed[v];
      const bridge=edgeList.at(-1);
      const orientation=(side.has(bridge.to.id)?1:0)-(side.has(bridge.from.id)?1:0);
      lhs-=orientation*reading;
      const thisEdge=edgeList.find(p=>p.exchange.id===e.exchange.id);
      const eSigma=(side.has(thisEdge.to.id)?1:0)-(side.has(thisEdge.from.id)?1:0);
      const estimate=lhs*eSigma;
      assert.ok(BigInt(Math.abs(estimate-flow[e.exchange.id]))<=BigInt(e.radius.atoms),
        "trial="+trial+" "+e.exchange.id+" bound="+e.radius.atoms);
    }
  }
});
