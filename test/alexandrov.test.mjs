import assert from 'node:assert/strict';
import test from 'node:test';
import { projectSignGraphAlexandrov } from '../src/alexandrov.mjs';
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
