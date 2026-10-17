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
// Admission snapshots the exact patch coordinates and bit slots before any
// gluing or restriction. Accessors would make an NI/cover assertion change
// between admission and use; patch data cannot depend on caller side effects.
function patchField(p, name) {
  const field = Object.getOwnPropertyDescriptor(p, name);
  if (!field || !Object.hasOwn(field, "value"))
    fail("patch coordinates and bits require own data fields");
  return field.value;
}
function admitPatch(p) {
  if (p === null || typeof p !== "object")
    fail("a canonical NI address and bit values are required");
  const address = patchField(p, "address");
  const fromBit = patchField(p, "fromBit");
  const totalBits = patchField(p, "totalBits");
  const source = patchField(p, "bits");
  if (!isNiUri(address) || !Array.isArray(source))
    fail("a canonical NI address and bit values are required");
  finiteInterval(fromBit, source.length, totalBits);
  const bits = new Array(source.length);
  for (let i = 0; i < bits.length; i++) {
    const field = Object.getOwnPropertyDescriptor(source, String(i));
    if (!field || !Object.hasOwn(field, "value") ||
        (field.value !== 0 && field.value !== 1))
      fail("each bit must be 0 or 1 in an own data slot");
    bits[i] = field.value;
  }
  return patch(address, totalBits, fromBit, bits);
}
const patch = (address,totalBits,fromBit,bits) =>
  Object.freeze({ kind:"signgraph.bitPatch",address,totalBits,fromBit,bits:Object.freeze([...bits]) });

/** Restrict a Data-owned mark resource without re-encoding or re-reading raw
 * bytes. This receives Data's admitted carrier, not a caller-built patch.
 * Its original NI identity is preserved across multiple host-owned charts. */
export function bitPatchOfResource(resource,{fromBit=0,bitCount}={}) {
  if (resource?.kind !== "lspace.mark-resource")
    fail("a Data-owned mark resource is required");
  const totalBits = resource.bitLength;
  const count = bitCount ?? Math.min(MAX_BIT_SECTION,totalBits-fromBit);
  finiteInterval(fromBit,count,totalBits);
  return patch(resource.address,totalBits,fromBit,
    bitValues(resource,{offset:fromBit,count}));
}

/** Name the whole byte content and obtain the same native patch from it. */
export function bitPatchOfBytes(bytes,selection={}) {
  if (!(bytes instanceof Uint8Array)) fail("Uint8Array media bytes required");
  return bitPatchOfResource(markResource(bytes),selection);
}

/** Functorial restriction to a contained interval of the same address. */
export function restrictBitPatch(source,{fromBit,bitCount}) {
  const admitted=admitPatch(source);
  finiteInterval(fromBit,bitCount,admitted.totalBits);
  if (fromBit<admitted.fromBit || fromBit+bitCount>admitted.fromBit+admitted.bits.length)
    throw new RangeError("bit sheaf: restriction outside the patch");
  const start=fromBit-admitted.fromBit;
  return patch(admitted.address,admitted.totalBits,fromBit,admitted.bits.slice(start,start+bitCount));
}
const obstruction=(reason,extras={})=>Object.freeze({kind:"signgraph.bitSheaf:obstruction",reason,...extras});

/** Glue compatible local coordinates on a finite cover. A protected interval
 * must be contained WHOLE in one patch; this encodes a declared subcoverage
 * constraint, not the institutional power to declare the protected region. */
export function glueBitPatches(patches,{fromBit,bitCount,protectedInterval}={}) {
  if (!Array.isArray(patches) || patches.length<1 || patches.length>MAX_BIT_SECTION)
    fail("a nonempty bounded family of patches is required");
  const admitted=patches.map(admitPatch);
  const {address,totalBits}=admitted[0];
  if (admitted.some(p=>p.address!==address || p.totalBits!==totalBits))
    return obstruction("different-source-content");
  const start=fromBit??Math.min(...admitted.map(p=>p.fromBit));
  const end=bitCount===undefined
    ?Math.max(...admitted.map(p=>p.fromBit+p.bits.length)):start+bitCount;
  finiteInterval(start,end-start,totalBits);
  if (protectedInterval!==undefined) {
    if (!Array.isArray(protectedInterval) || protectedInterval.length!==2 ||
        !natural(protectedInterval[0]) || !natural(protectedInterval[1]) ||
        protectedInterval[0]>=protectedInterval[1] ||
        protectedInterval[0]<start || protectedInterval[1]>end)
      throw new RangeError("bit sheaf: protected interval outside target");
    const [a,b]=protectedInterval;
    if (!admitted.some(p=>p.fromBit<=a && p.fromBit+p.bits.length>=b))
      return obstruction("protected-region-split",{protectedInterval:Object.freeze([...protectedInterval])});
  }
  const values=new Array(end-start);
  for (const local of admitted) {
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
    kind:"signgraph.bitSheaf:section",coverCount:admitted.length});
}
