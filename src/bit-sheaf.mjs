/**
 * The finite bit-coordinate sheaf over an addressed digital byte carrier.
 * Data owns MSB-first bit identity. Intervals restrict and
 * compatible overlapping local sections uniquely glue on a declared cover.
 * Distinct raw content identities never glue. This is a geometric data
 * operation, not an authentication of supplied patches or sovereign authority.
 * Cf. Obsmetrologia.Site.Basic / ProtectedCover.
 */
import { isNiUri } from "@red-cup-engineering/signcell/ni";

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

/** Admit one section of an addressed bit carrier from bits the caller has
 * already read (MSB-first, as Data reads them) starting at `fromBit`.
 * Reading bits out of a resource or byte content is the caller's job. */
export function bitPatchOfBits(section,{fromBit=0}={}) {
  if (section === null || typeof section !== "object")
    fail("a canonical NI address and bit values are required");
  return admitPatch({address:patchField(section,"address"),
    totalBits:patchField(section,"totalBits"),fromBit,bits:patchField(section,"bits")});
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

// A protected support is a requirement about an existing patch cover, not an
// inferred claim about the contents or legal authority of the supplied bytes.
function admitProtectedInterval(pair,start,end) {
  if (!Array.isArray(pair) || pair.length!==2)
    throw new RangeError("bit sheaf: protected interval outside target");
  const left=Object.getOwnPropertyDescriptor(pair,"0"),right=Object.getOwnPropertyDescriptor(pair,"1");
  if (!left || !right || !Object.hasOwn(left,"value") || !Object.hasOwn(right,"value"))
    fail("protected intervals require own data coordinates");
  const a=left.value,b=right.value;
  if (!natural(a) || !natural(b) || a>=b || a<start || b>end)
    throw new RangeError("bit sheaf: protected interval outside target");
  return Object.freeze([a,b]);
}

function admittedRequiredIntervals(single,many,start,end) {
  const inputs=[];
  if(single!==undefined) inputs.push(single);
  if(many!==undefined) {
    if(!Array.isArray(many) || many.length>MAX_BIT_SECTION)
      fail("protected intervals require a bounded array");
    for(let i=0;i<many.length;i++) {
      const slot=Object.getOwnPropertyDescriptor(many,String(i));
      if(!slot || !Object.hasOwn(slot,"value"))
        fail("protected intervals require own data entries");
      inputs.push(slot.value);
    }
  }
  if(inputs.length>MAX_BIT_SECTION)
    throw new RangeError("bit sheaf: too many protected intervals");
  return inputs.map(pair=>admitProtectedInterval(pair,start,end));
}

/** For all required supports, find an actual whole covering patch.
 * Sorted sweep: O((P+R) log(P+R)) for P patches and R requirements,
 * rather than independently scanning every patch for every requirement.
 * The patch indices are witnesses about supplied local sections only. */
function requiredCoverWitnesses(admitted,supports) {
  if(supports.length===0) return [];
  const patches=admitted.map((p,i)=>({start:p.fromBit,end:p.fromBit+p.bits.length,i}))
    .sort((a,b)=>a.start-b.start || a.i-b.i);
  const required=supports.map(([a,b],i)=>({a,b,i})).sort((a,b)=>a.a-b.a || a.i-b.i);
  const witnesses=new Array(supports.length);
  let current=0,furthest=-1,witness=-1;
  for(const support of required) {
    while(current<patches.length && patches[current].start<=support.a) {
      const p=patches[current++];
      if(p.end>furthest || (p.end===furthest && (witness===-1 || p.i<witness))) {
        furthest=p.end;
        witness=p.i;
      }
    }
    witnesses[support.i]=furthest>=support.b
      ?Object.freeze({protectedInterval:supports[support.i],patchIndex:witness})
      :null;
  }
  return witnesses;
}

/** Select a minimum-cardinality subfamily after full gluing has already
 * admitted ALL patches (including conflicting observations). A demand for every
 * target bit plus each unsplittable required interval becomes interval-cover
 * containment. In ascending demand-start order, choose the available patch
 * with farthest right endpoint whenever no previously chosen patch covers the
 * demand. Exchange argument: at the first uncovered demand, replacing any
 * feasible patch with the farthest-reaching eligible patch cannot harm any
 * later demand (every later start is at least the current start). Thus the
 * selected count is optimal for equal per-patch cost, not weighted costs.
 *
 * Crucial: a minimum subset is NEVER used to suppress contradictory input
 * patches. This is a post-admission transport/reuse witness only.
 */
function minimumCoverIndices(admitted,required,start,end) {
  const demands=[];
  for(let at=start;at<end;at++) demands.push([at,at+1]);
  demands.push(...required);
  demands.sort((a,b)=>a[0]-b[0] || b[1]-a[1]);
  const patches=admitted.map((p,i)=>({start:p.fromBit,end:p.fromBit+p.bits.length,i}))
    .sort((a,b)=>a.start-b.start || a.i-b.i);
  const selected=[];
  let current=0,bestEnd=-1,bestIndex=-1,selectedReach=-1;
  for(const [a,b] of demands) {
    while(current<patches.length && patches[current].start<=a) {
      const p=patches[current++];
      if(p.end>bestEnd || (p.end===bestEnd && (bestIndex===-1 || p.i<bestIndex))) {
        bestEnd=p.end;
        bestIndex=p.i;
      }
    }
    if(selectedReach>=b) continue;
    if(bestEnd<b)
      throw new Error("bit sheaf: admitted global section lacks a required source patch");
    selected.push(bestIndex);
    selectedReach=bestEnd;
  }
  return Object.freeze(selected);
}

/** Glue compatible coordinates on a finite cover. Every protected support
 * must be contained WHOLE in an actual patch; a jointly reconstructable bit
 * sequence is not enough when a requirement forbids splitting one region.
 * These are caller-declared cover constraints, never grants of authority. */
export function glueBitPatches(patches,{fromBit,bitCount,protectedInterval,protectedIntervals,minimumCover=false}={}) {
  if (!Array.isArray(patches) || patches.length<1 || patches.length>MAX_BIT_SECTION)
    fail("a nonempty bounded family of patches is required");
  if (typeof minimumCover!=="boolean")
    fail("minimumCover must be a boolean");
  const admitted=patches.map(admitPatch);
  const {address,totalBits}=admitted[0];
  if (admitted.some(p=>p.address!==address || p.totalBits!==totalBits))
    return obstruction("different-source-content");
  const start=fromBit??Math.min(...admitted.map(p=>p.fromBit));
  const end=bitCount===undefined
    ?Math.max(...admitted.map(p=>p.fromBit+p.bits.length)):start+bitCount;
  finiteInterval(start,end-start,totalBits);
  const required=admittedRequiredIntervals(protectedInterval,protectedIntervals,start,end);
  const witnesses=requiredCoverWitnesses(admitted,required);
  for(let i=0;i<witnesses.length;i++) {
    if(witnesses[i]===null)
      return obstruction("protected-region-split",{protectedInterval:required[i],requirementIndex:i});
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
  const selected=minimumCover?minimumCoverIndices(admitted,required,start,end):null;
  return Object.freeze({...patch(address,totalBits,start,values),
    kind:"signgraph.bitSheaf:section",coverCount:admitted.length,
    ...(required.length ? {protectedCoverage:Object.freeze(witnesses)} : {}),
    ...(selected ? {minimumCover:Object.freeze({
      patchIndices:selected, cardinality:selected.length,
      scope:"finite-equal-cost-bit-cover-with-whole-required-intervals",
    })} : {})});
}
