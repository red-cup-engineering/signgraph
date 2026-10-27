import assert from 'node:assert/strict';
import test from 'node:test';
import { projectSignGraphAlexandrov, compareSignGraphAlexandrov } from '../src/alexandrov.mjs';
import { createSignGraph } from '../src/semantic-graph.mjs';
import { createTypedMark, referenceOf } from '@red-cup-engineering/signcell/typed-mark';
import { defineType } from '@red-cup-engineering/signcell/type-system';
const ok = r => { assert.equal(r.ok,true); return r.value; };
const t=ok(defineType({id:'alex.test.actor.v1',name:'actor',description:'typed actor',schema:{},parents:[]}));
const w=ok(defineType({id:'alex.test.witness.v1',name:'witness',description:'typed witness',schema:{},parents:[]}));
const a=['A','B','C'].map(x=>ok(createTypedMark(t,x))), wt=ok(createTypedMark(w,'evidence'));
const refs=a.map(referenceOf);
const source=ok(createSignGraph({cells:[...a,wt],relations:[{id:'forward',subjectTypes:[t.id],objectTypes:[t.id],witnessTypes:[w.id]}],edges:[{subject:refs[0],predicate:'forward',object:refs[1],witness:referenceOf(wt)},{subject:refs[1],predicate:'forward',object:refs[2],witness:referenceOf(wt)}]}));
test('Alexandrov principal opens recover directed witnessed paths',()=>{const view=projectSignGraphAlexandrov(source,{nodeType:t.id,predicate:'forward'});assert.equal(view.specializes(refs[0],refs[2]),true);assert.equal(view.specializes(refs[2],refs[0]),false);assert.equal(view.isOpen([refs[2]]),true);assert.equal(view.isOpen([refs[0]]),false);assert.equal(view.witnessedRoute(refs[0],refs[2]).hops.length,2);assert.equal(view.t0,true);});

test('independent actors remain distinct and no missing edge is promoted',()=>{const view=projectSignGraphAlexandrov(source,{nodeType:t.id,predicate:'forward'});assert.equal(view.points.length,3);assert.equal(view.t0,true);assert.notEqual(refs[0].id,refs[1].id);assert.equal(view.isOpen([]),true);assert.equal(view.isOpen(refs),true);assert.equal(view.witnessedRoute(refs[2],refs[0]).reachable,false);assert.equal(view.witnessedRoute(refs[2],refs[2]).hops.length,0);assert.equal(view.directEdges.length,2);});
test('tampered source, absent predicate, and outside reference are refused',()=>{const fake=JSON.parse(JSON.stringify(source));fake.id='fake';assert.throws(()=>projectSignGraphAlexandrov(fake,{nodeType:t.id,predicate:'forward'}),TypeError);assert.throws(()=>projectSignGraphAlexandrov(source,{nodeType:t.id,predicate:'missing'}),TypeError);const view=projectSignGraphAlexandrov(source,{nodeType:t.id,predicate:'forward'});assert.throws(()=>view.principalOpen(referenceOf(wt)),TypeError);});

test('mutual reachability changes T0, not distinct source identities, and paths retain parallel witnesses',()=>{const extra=ok(createTypedMark(w,'second'));const e=(from,to,witness)=>({subject:refs[from],predicate:'forward',object:refs[to],witness});const s=ok(createSignGraph({cells:[...a,wt,extra],relations:[{id:'forward',subjectTypes:[t.id],objectTypes:[t.id],witnessTypes:[w.id]}],edges:[e(0,1,referenceOf(wt)),e(0,1,referenceOf(extra)),e(1,2,referenceOf(wt)),e(2,1,referenceOf(wt))]}));const view=projectSignGraphAlexandrov(s,{nodeType:t.id,predicate:'forward'});assert.equal(view.t0,false);assert.equal(view.components.length,2);assert.equal(view.specializes(refs[1],refs[2]),true);assert.equal(view.specializes(refs[2],refs[1]),true);assert.notEqual(refs[1].id,refs[2].id);assert.equal(view.witnessedRoute(refs[0],refs[1]).hops[0].edges.length,2);});

test('directed Post/Box adjunction, upper hull and topological closure are distinct',()=>{
 const view=projectSignGraphAlexandrov(source,{nodeType:t.id,predicate:'forward'});
 const subsets=Array.from({length:8},(_,mask)=>refs.filter((_,i)=>mask&(1<<i)));
 const idSet=xs=>new Set(xs.map(p=>p.id));
 const subset=(left,right)=>[...idSet(left)].every(id=>idSet(right).has(id));
 for(const s of subsets)for(const target of subsets){
  assert.equal(subset(view.upperHull(s),target),subset(s,view.futureNecessary(target)),
   'forward open hull is left adjoint to future necessity');
 }
 assert.deepEqual(view.upperHull([refs[0]]).map(p=>p.id),refs.map(p=>p.id).sort());
 assert.deepEqual(view.topologicalClosure([refs[2]]).map(p=>p.id),refs.map(p=>p.id).sort());
 assert.deepEqual(view.upperHull([refs[2]]).map(p=>p.id),[refs[2].id]);
 assert.deepEqual(view.futureNecessary([refs[1],refs[2]]).map(p=>p.id),
   [refs[1].id,refs[2].id].sort());
 assert.deepEqual(view.topologicalClosure([refs[0]]).map(p=>p.id),[refs[0].id]);
});

test('identity continuity compares two source-addressed topologies, not presumed time or authority',()=>{
 const original=source;
 const edge=(i,j)=>({subject:refs[i],predicate:'forward',object:refs[j],witness:referenceOf(wt)});
 const declaration={id:'forward',subjectTypes:[t.id],objectTypes:[t.id],witnessTypes:[w.id]};
 const alternate=ok(createSignGraph({cells:[...a,wt],relations:[declaration],edges:[edge(0,2),edge(1,2)]}));
 const added=ok(createSignGraph({cells:[...a,wt],relations:[declaration],edges:[
  edge(0,1),edge(1,2),edge(0,2)]}));
 const lost=compareSignGraphAlexandrov(original,alternate,{nodeType:t.id,predicate:'forward'});
 assert.equal(lost.sourceToTargetContinuous,false);
 assert.equal(lost.targetToSourceContinuous,true);
 assert.equal(lost.identityHomeomorphism,false);
 assert.equal(lost.lostComparabilities,1);
 assert.equal(lost.gainedComparabilities,0);
 assert.equal(lost.lostExamples[0].originalRoute.reachable,true);
 assert.equal(lost.lostExamples[0].originalRoute.hops.length,1);
 const sameOrder=compareSignGraphAlexandrov(original,added,{nodeType:t.id,predicate:'forward'});
 assert.equal(sameOrder.identityHomeomorphism,true);
 assert.equal(sameOrder.lostComparabilities,0);
 assert.equal(sameOrder.gainedComparabilities,0);
 assert.equal(sameOrder.gainedDirectWitnesses.length,1,
   'same topology can have different original witnessed direct edges');
 const reverse=compareSignGraphAlexandrov(alternate,original,{nodeType:t.id,predicate:'forward'});
 assert.equal(reverse.sourceToTargetContinuous,true);
 assert.equal(reverse.targetToSourceContinuous,false);
});
test('different actor carrier refuses identity transport; never identify a foreign Actor by a label',()=>{
 const fewer=ok(createSignGraph({cells:[a[0],a[1],wt],
 relations:[{id:'forward',subjectTypes:[t.id],objectTypes:[t.id],witnessTypes:[w.id]}],
 edges:[{subject:refs[0],predicate:'forward',object:refs[1],witness:referenceOf(wt)}]}));
 assert.throws(()=>compareSignGraphAlexandrov(source,fewer,{nodeType:t.id,predicate:'forward'}),
   /same source-admitted typed points/);
});

test('topology selectors and typed references refuse executable getters before observing them',()=>{
 let executed=0;
 const option={predicate:'forward'};
 Object.defineProperty(option,'nodeType',{enumerable:true,get(){executed++;return t.id;}});
 assert.throws(()=>projectSignGraphAlexandrov(source,option),/options require exactly/u);
 const view=projectSignGraphAlexandrov(source,{nodeType:t.id,predicate:'forward'});
 const reference={type:t.id};
 Object.defineProperty(reference,'id',{enumerable:true,get(){executed++;return refs[0].id;}});
 for(const use of [
   ()=>view.principalOpen(reference),()=>view.specializes(reference,refs[1]),
   ()=>view.isOpen([reference]),()=>view.upperHull([reference]),
   ()=>view.futureNecessary([reference]),()=>view.topologicalClosure([reference]),
   ()=>view.witnessedRoute(reference,refs[1]),
 ])assert.throws(use,/source-admitted typed reference/u);
 assert.equal(executed,0);
 assert.equal(view.principalOpen(refs[2]).length,1,
   'original source-admitted references still read their actual topology');
});
test('topological identity cannot be borrowed from a prototype or hidden coordinate',()=>{
 const view=projectSignGraphAlexandrov(source,{nodeType:t.id,predicate:'forward'});
 assert.throws(()=>view.principalOpen(Object.create({id:refs[0].id,type:t.id})),/source-admitted/u);
 const hidden={type:t.id};
 Object.defineProperty(hidden,'id',{value:refs[0].id,enumerable:false});
 assert.throws(()=>view.principalOpen(hidden),/source-admitted/u);
 const nullProto=Object.assign(Object.create(null),{id:refs[0].id,type:t.id});
 assert.deepEqual(view.principalOpen(nullProto),view.principalOpen(refs[0]));
});
