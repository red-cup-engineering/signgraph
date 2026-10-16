import test from "node:test";
import assert from "node:assert/strict";
import { makeNiUri } from "@red-cup-engineering/uri-services-section/ni-uri";
import { bitPatchOfBytes, restrictBitPatch, glueBitPatches } from "../src/bit-sheaf.mjs";

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
  assert.throws(()=>restrictBitPatch(full,{fromBit:7,bitCount:2}),/outside/);
});

test("protected region selects a subcoverage; it does not assert sovereign authority",()=>{
  const full=bitPatchOfBytes(Uint8Array.from([0xA5]));
  const a=restrictBitPatch(full,{fromBit:0,bitCount:5});
  const b=restrictBitPatch(full,{fromBit:3,bitCount:5});
  assert.equal(glueBitPatches([a,b],{protectedInterval:[2,6]}).reason,"protected-region-split");
  assert.equal(glueBitPatches([full],{protectedInterval:[2,6]}).kind,"signgraph.bitSheaf:section");
  assert.throws(()=>glueBitPatches([full],{protectedInterval:[2,10]}),/outside target/);
});
