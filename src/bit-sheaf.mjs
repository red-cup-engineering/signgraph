/**
 * The finite bit-coordinate sheaf over an addressed digital byte carrier.
 * Data owns MSB-first bit identity. Intervals restrict and
 * compatible overlapping local sections uniquely glue on a declared cover.
 * Distinct raw content identities never glue. This is a geometric data
 * operation, not an authentication of supplied patches or sovereign authority.
 * Cf. Obsmetrologia.Site.Basic / ProtectedCover.
 */
import { isNiUri } from "@red-cup-engineering/uri-services-section/ni-uri";
import { markResource, bitValues } from "@red-cup-engineering/computer-data-engineering-services-section/digital-mark-space";

export const MAX_BIT_SECTION = 32768;
const natural = n => Number.isSafeInteger(n) && n >= 0;
const fail = message => { throw new TypeError("bit sheaf: " + message); };
function finiteInterval(start, count, total) {
  if (!natural(start) || !natural(count) || !natural(total) ||
      count > MAX_BIT_SECTION || start > total || count > total - start)
    throw new RangeError("bit sheaf: invalid or unbounded finite interval");
}
function admitPatch(p) {
  if (p === null || typeof p !== "object" || !isNiUri(p.address) || !Array.isArray(p.bits))
    fail("a canonical NI address and bit values are required");
  finiteInterval(p.fromBit, p.bits.length, p.totalBits);
  if (p.bits.some(b => b !== 0 && b !== 1)) fail("each bit must be 0 or 1");
  return p;
}
const patch = (address,totalBits,fromBit,bits) =>
  Object.freeze({ kind:"signgraph.bitPatch",address,totalBits,fromBit,bits:Object.freeze([...bits]) });

/** Name the *whole* byte content while extracting a bounded finite bit interval. */
export function bitPatchOfBytes(bytes,{fromBit=0,bitCount}={}) {
  if (!(bytes instanceof Uint8Array)) fail("Uint8Array media bytes required");
  // Data owns canonical NI naming, MSB-first raw-bit values and byte custody.
  // SignGraph owns only the finite geometric restriction / gluing operators.
  const source = markResource(bytes);
  const totalBits = source.bitLength;
  const count = bitCount ?? Math.min(MAX_BIT_SECTION,totalBits-fromBit);
  finiteInterval(fromBit,count,totalBits);
  return patch(source.address,totalBits,fromBit,
    bitValues(source,{offset:fromBit,count}));
}

/** Functorial restriction to a contained interval of the same address. */
export function restrictBitPatch(source,{fromBit,bitCount}) {
  admitPatch(source);
  finiteInterval(fromBit,bitCount,source.totalBits);
  if (fromBit<source.fromBit || fromBit+bitCount>source.fromBit+source.bits.length)
    throw new RangeError("bit sheaf: restriction outside the patch");
  const start=fromBit-source.fromBit;
  return patch(source.address,source.totalBits,fromBit,source.bits.slice(start,start+bitCount));
}
const obstruction=(reason,extras={})=>Object.freeze({kind:"signgraph.bitSheaf:obstruction",reason,...extras});

/** Glue compatible local coordinates on a finite cover. A protected interval
 * must be contained WHOLE in one patch; this encodes a declared subcoverage
 * constraint, not the institutional power to declare the protected region. */
export function glueBitPatches(patches,{fromBit,bitCount,protectedInterval}={}) {
  if (!Array.isArray(patches) || patches.length<1 || patches.length>MAX_BIT_SECTION)
    fail("a nonempty bounded family of patches is required");
  patches.forEach(admitPatch);
  const {address,totalBits}=patches[0];
  if (patches.some(p=>p.address!==address || p.totalBits!==totalBits))
    return obstruction("different-source-content");
  const start=fromBit??Math.min(...patches.map(p=>p.fromBit));
  const end=bitCount===undefined
    ?Math.max(...patches.map(p=>p.fromBit+p.bits.length)):start+bitCount;
  finiteInterval(start,end-start,totalBits);
  if (protectedInterval!==undefined) {
    if (!Array.isArray(protectedInterval) || protectedInterval.length!==2 ||
        !natural(protectedInterval[0]) || !natural(protectedInterval[1]) ||
        protectedInterval[0]>=protectedInterval[1] ||
        protectedInterval[0]<start || protectedInterval[1]>end)
      throw new RangeError("bit sheaf: protected interval outside target");
    const [a,b]=protectedInterval;
    if (!patches.some(p=>p.fromBit<=a && p.fromBit+p.bits.length>=b))
      return obstruction("protected-region-split",{protectedInterval:Object.freeze([...protectedInterval])});
  }
  const values=new Array(end-start);
  for (const local of patches) {
    const left=Math.max(start,local.fromBit),right=Math.min(end,local.fromBit+local.bits.length);
    for(let at=left;at<right;at++) {
      const i=at-start,v=local.bits[at-local.fromBit];
      if (values[i]!==undefined && values[i]!==v)
        return obstruction("incompatible-overlap",{atBit:at});
      values[i]=v;
    }
  }
  const missing=values.findIndex(v=>v===undefined);
  if (missing!==-1) return obstruction("uncovered-bit",{atBit:start+missing});
  return Object.freeze({...patch(address,totalBits,start,values),
    kind:"signgraph.bitSheaf:section",coverCount:patches.length});
}
