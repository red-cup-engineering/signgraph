import test from "node:test";
import assert from "node:assert/strict";
import { makeNiUri } from "@red-cup-engineering/uri-services-section/ni-uri";
import { markResource, markSpace } from "@red-cup-engineering/computer-data-engineering-services-section/digital-mark-space";
import { bitPatchOfBytes, bitPatchOfResource, restrictBitPatch, glueBitPatches } from "../src/bit-sheaf.mjs";

test("raw byte identity is independent of media format and path; bit order is exact",()=>{
  const bytes=Uint8Array.from([0xA5,0x0F]),full=bitPatchOfBytes(bytes);
  assert.equal(full.address,makeNiUri(bytes));
  assert.deepEqual(full.bits,[1,0,1,0,0,1,0,1,0,0,0,0,1,1,1,1]);
  assert.deepEqual(bitPatchOfBytes(bytes,{fromBit:8,bitCount:8}).bits,[0,0,0,0,1,1,1,1]);
  bytes[0]=0;
  assert.deepEqual(full.bits.slice(0,8),[1,0,1,0,0,1,0,1]);
  assert.deepEqual(bitPatchOfBytes(new Uint8Array()).bits,[]);
});

test("restriction composes; a compatible cover uniquely reconstructs the global section",()=>{
  const full=bitPatchOfBytes(Uint8Array.from([0xA5]));
  const a=restrictBitPatch(full,{fromBit:0,bitCount:5});
  const b=restrictBitPatch(full,{fromBit:3,bitCount:5});
  assert.equal(glueBitPatches([a,b]).kind,"signgraph.bitSheaf:section");
  assert.deepEqual(glueBitPatches([a,b]).bits,full.bits);
  assert.deepEqual(glueBitPatches([b,a,a]).bits,full.bits);
  const once=restrictBitPatch(full,{fromBit:1,bitCount:6});
  assert.deepEqual(restrictBitPatch(once,{fromBit:3,bitCount:2}),
    restrictBitPatch(full,{fromBit:3,bitCount:2}));
});

test("overlap conflict, gaps, wrong address, invalid coordinates refuse",()=>{
  const full=bitPatchOfBytes(Uint8Array.from([0xA5]));
  const a=restrictBitPatch(full,{fromBit:0,bitCount:5});
  const b=restrictBitPatch(full,{fromBit:3,bitCount:5});
  assert.equal(glueBitPatches([a,{...b,bits:b.bits.map((x,i)=>i===0?1-x:x)}]).reason,"incompatible-overlap");
  assert.equal(glueBitPatches([a],{fromBit:0,bitCount:8}).reason,"uncovered-bit");
  assert.equal(glueBitPatches([a,bitPatchOfBytes(Uint8Array.from([0xA4]))]).reason,"different-source-content");
  assert.throws(()=>glueBitPatches([{...full,bits:[2]}]),/0 or 1/);
  assert.throws(()=>restrictBitPatch(full,{fromBit:7,bitCount:2}),/invalid or unbounded finite interval/);
  assert.throws(()=>restrictBitPatch(a,{fromBit:4,bitCount:2}),/restriction outside the patch/);
});

test("protected region selects a subcoverage; it does not assert sovereign authority",()=>{
  const full=bitPatchOfBytes(Uint8Array.from([0xA5]));
  const a=restrictBitPatch(full,{fromBit:0,bitCount:5});
  const b=restrictBitPatch(full,{fromBit:3,bitCount:5});
  assert.equal(glueBitPatches([a,b],{protectedInterval:[2,6]}).reason,"protected-region-split");
  assert.equal(glueBitPatches([full],{protectedInterval:[2,6]}).kind,"signgraph.bitSheaf:section");
  assert.throws(()=>glueBitPatches([full],{protectedInterval:[2,10]}),/outside target/);
});

test("Data-owned chart resources restrict and glue without a secondary binary encoding",()=> {
  const bytes=Uint8Array.of(0xa5,0x0f);
  const chart=markSpace([{bytes,mediaType:"image/png",source:{office:"territory-A"}}]);
  const admitted=chart.get(makeNiUri(bytes));
  const patch=bitPatchOfResource(admitted,{fromBit:4,bitCount:12});
  assert.deepEqual(patch,bitPatchOfBytes(bytes,{fromBit:4,bitCount:12}));
  assert.equal(glueBitPatches([
    bitPatchOfResource(admitted,{fromBit:0,bitCount:10}),
    bitPatchOfResource(admitted,{fromBit:8,bitCount:8}),
  ]).kind,"signgraph.bitSheaf:section");
  assert.throws(()=>bitPatchOfResource({...admitted}),/admitted mark resource/);
  assert.throws(()=>bitPatchOfResource({kind:"lspace.mark-resource",address:admitted.address,bitLength:16}),/admitted mark resource/);
});

test("admission refuses getter-backed or sparse patches before sheaf gluing", () => {
  const full=bitPatchOfBytes(Uint8Array.of(0xa5));
  let reads=0;
  const forged={...full};
  Object.defineProperty(forged,"address",{
    enumerable:true,
    get() { reads++; return reads === 1 ? full.address : makeNiUri(Uint8Array.of(0x5a)); },
  });
  assert.throws(()=>glueBitPatches([full,forged]),/own data fields/);
  assert.throws(()=>restrictBitPatch(forged,{fromBit:0,bitCount:1}),/own data fields/);
  assert.equal(reads,0,"gluing never evaluates an untrusted address getter");

  const unstable=[...full.bits];
  Object.defineProperty(unstable, "0", {
    enumerable:true, configurable:true,
    get() { reads++; return reads % 2; },
  });
  assert.throws(()=>glueBitPatches([{...full,bits:unstable}]),/own data slot/);
  assert.equal(reads,0,"gluing never evaluates an untrusted bit getter");

  const sparse=[...full.bits];
  delete sparse[0];
  assert.throws(()=>glueBitPatches([{...full,bits:sparse}]),/own data slot/);
  assert.deepEqual(glueBitPatches([full]).bits,full.bits);
});


test("several protected supports must each have one whole-patch witness",()=>{
  const full=bitPatchOfBytes(Uint8Array.of(0xa5));
  const left=restrictBitPatch(full,{fromBit:0,bitCount:5});
  const right=restrictBitPatch(full,{fromBit:3,bitCount:5});
  const middle=restrictBitPatch(full,{fromBit:2,bitCount:4});
  const requirements=[[0,2],[2,6],[6,8]];
  const refused=glueBitPatches([left,right],{protectedIntervals:requirements});
  assert.equal(refused.reason,"protected-region-split");
  assert.equal(refused.requirementIndex,1);
  assert.deepEqual(refused.protectedInterval,[2,6]);
  // The same two patches reconstruct every bit, but cannot each witness
  // every indivisible requirement; this is a true local/global distinction.
  assert.deepEqual(glueBitPatches([left,right]).bits,full.bits);
  const patches=[left,right,middle];
  const admitted=glueBitPatches(patches,{protectedIntervals:requirements});
  assert.equal(admitted.kind,"signgraph.bitSheaf:section");
  assert.deepEqual(admitted.bits,full.bits);
  assert.deepEqual(admitted.protectedCoverage.map(v=>v.patchIndex),[0,2,1]);
  for(const {protectedInterval:[lo,hi],patchIndex} of admitted.protectedCoverage) {
    const patch=patches[patchIndex];
    assert(patch.fromBit<=lo && patch.fromBit+patch.bits.length>=hi);
  }
  assert(Object.isFrozen(admitted.protectedCoverage));
  assert.equal(glueBitPatches(patches,{
    protectedInterval:[0,2], protectedIntervals:[[2,6],[6,8]],
  }).protectedCoverage.length,3);
  assert.deepEqual(glueBitPatches([left,right],{protectedIntervals:[]}).bits,full.bits);
});

test("exhaustive finite two-support gluing agrees with an independent whole-patch oracle",()=>{
  const full=bitPatchOfBytes(Uint8Array.of(0xa5));
  const left=restrictBitPatch(full,{fromBit:0,bitCount:5});
  const right=restrictBitPatch(full,{fromBit:3,bitCount:5});
  const middle=restrictBitPatch(full,{fromBit:2,bitCount:4});
  const all=[];
  for(let a=0;a<8;a++) for(let b=a+1;b<=8;b++) all.push([a,b]);
  let checked=0;
  for(const patches of [[left,right],[left,right,middle]]) {
    for(const first of all) for(const second of all) {
      const supports=[first,second];
      const expected=supports.map(([a,b])=>patches.some(p=>
        p.fromBit<=a && p.fromBit+p.bits.length>=b));
      const answer=glueBitPatches(patches,{protectedIntervals:supports});
      if(expected.every(Boolean)) {
        assert.equal(answer.kind,"signgraph.bitSheaf:section");
        assert.deepEqual(answer.bits,full.bits);
        for(let i=0;i<2;i++) {
          const patch=patches[answer.protectedCoverage[i].patchIndex];
          assert(patch.fromBit<=supports[i][0]);
          assert(patch.fromBit+patch.bits.length>=supports[i][1]);
        }
      } else {
        assert.equal(answer.reason,"protected-region-split");
        assert.equal(answer.requirementIndex,expected.indexOf(false));
      }
      checked++;
    }
  }
  assert.equal(checked,2592);
});

test("required support declarations snapshot data and refuse sparse, accessor and unbounded forms",()=>{
  const full=bitPatchOfBytes(Uint8Array.of(0xa5));
  let reads=0;
  const intervals=[[0,2],[2,4]];
  Object.defineProperty(intervals,"1",{get(){reads++;return [2,4];}});
  assert.throws(()=>glueBitPatches([full],{protectedIntervals:intervals}),/own data entries/);
  const pair=[0,2];
  Object.defineProperty(pair,"1",{get(){reads++;return 2;}});
  assert.throws(()=>glueBitPatches([full],{protectedIntervals:[pair]}),/own data coordinates/);
  assert.equal(reads,0,"admission must not execute adversarial support getters");
  assert.throws(()=>glueBitPatches([full],{protectedIntervals:[[2,2]]}),/outside target/);
  assert.throws(()=>glueBitPatches([full],{protectedIntervals:new Array(32769)}),/bounded array/);
});
