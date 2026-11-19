/**
 * Exact conditional temporal-aliasing assay of original exchange incidence.
 * The sole caller must source-admit exchanges through channelResourceIncidence.
 * Science #215 §7.24: exact vertex divergence at every microinterval plus
 * exact individual edge totals over coarse disjoint windows leave a kernel
 * of dimension (|E|-|V|+components) * (microintervals-windows).
 *
 * Hypothetical observations are NOT a clock, flow reading or Actor-body.
 * No additional graph, Thing, scheduler, ledger or authority is constructed.
 */
/** Admit finite ordinary data arrays, not executable user-defined iterators or
 * silently missing slots. SignCell owns actual Cell identity; this is only
 * a guard around conditional finite incidence calculations.
 */
const inertTemporalArray=(input,label,max=4096)=>{
  if(!Array.isArray(input)||Object.getPrototypeOf(input)!==Array.prototype||
     input.length>max)
    throw new TypeError("temporal flow "+label+" requires a bounded ordinary data array");
  const descriptors=Object.getOwnPropertyDescriptors(input);
  if(Reflect.ownKeys(descriptors).length!==input.length+1)
    throw new TypeError("temporal flow "+label+" refuses sparse or decorated arrays");
  return Object.freeze(Array.from({length:input.length},(_,i)=>{
    const slot=descriptors[String(i)];
    if(!slot||!slot.enumerable||!Object.hasOwn(slot,"value"))
      throw new TypeError("temporal flow "+label+" requires inert array positions");
    return slot.value;
  }));
};
/** Read original source record positions exactly once, without executing a
 * caller getter. Proxy traps require host isolation and are not qualified.
 */
const inertTemporalField=(record,name,label,optional=false)=>{
  if(!record||typeof record!=="object"||Array.isArray(record)||
     ![Object.prototype,null].includes(Object.getPrototypeOf(record)))
    throw new TypeError("temporal flow "+label+" requires an ordinary source record");
  const slot=Object.getOwnPropertyDescriptor(record,name);
  if(!slot){
    if(optional)return undefined;
    throw new TypeError("temporal flow "+label+" missing "+name);
  }
  if(!slot.enumerable||!Object.hasOwn(slot,"value"))
    throw new TypeError("temporal flow "+label+" "+name+" must be inert own data");
  return slot.value;
};

export function conditionalTemporalFlowAliasing(transfers, options={}) {
  const source=inertTemporalArray(transfers,"transfers");
  const fields=Object.getOwnPropertyDescriptors(options);
  if(Reflect.ownKeys(fields).some(key=>typeof key!=="string"||
      !["microintervalCount","windowLengths"].includes(key)))
    throw new TypeError("temporal flow refuses undeclared design options");
  const microintervalCount=inertTemporalField(options,"microintervalCount","options",true);
  const windowLengths=inertTemporalArray(inertTemporalField(options,"windowLengths","options",true),"windows");
  if (!Number.isSafeInteger(microintervalCount) ||
      microintervalCount<1 || microintervalCount>4096)
    throw new RangeError("temporal flow requires 1..4096 proposed microintervals");
  if (!Array.isArray(windowLengths) || windowLengths.length<1 ||
      windowLengths.length>microintervalCount ||
      windowLengths.some(n=>!Number.isSafeInteger(n)||n<1) ||
      windowLengths.reduce((sum,n)=>sum+n,0)!==microintervalCount)
    throw new TypeError("coarse windows must partition each proposed microinterval exactly once");
  const parent=new Map(), seenExchanges=new Set();
  const root=id=>{
    if(!parent.has(id))parent.set(id,id);
    let at=id;while(parent.get(at)!==at)at=parent.get(at);
    let walk=id;while(walk!==at){
      const next=parent.get(walk);parent.set(walk,at);walk=next;
    }
    return at;
  };
  for(const e of source){
    const exchange=inertTemporalField(inertTemporalField(e,"exchange","transfer"),"id","exchange");
    const from=inertTemporalField(inertTemporalField(e,"from","transfer"),"id","source endpoint");
    const to=inertTemporalField(inertTemporalField(e,"to","transfer"),"id","target endpoint");
    if(![exchange,from,to].every(id=>typeof id==="string"&&id.length>0) ||
       seenExchanges.has(exchange))
      throw new TypeError("temporal flow needs distinct original exchange and endpoint IDs");
    seenExchanges.add(exchange);
    const a=root(from),b=root(to);
    if(a!==b)parent.set(a,b);
  }
  const components=new Set([...parent.keys()].map(root)).size;
  const cycleRank=source.length-parent.size+components;
  if(cycleRank<0)throw new Error("temporal flow invalid source incidence rank");
  const unknownDimension=cycleRank*(microintervalCount-windowLengths.length);
  return Object.freeze({
    kind:"signgraph.conditionalTemporalFlowAliasing.v1",
    exchangeCount:source.length,endpointCount:parent.size,
    weakComponentCount:components,originalCycleRank:cycleRank,
    proposedMicrointervalCount:microintervalCount,
    proposedWindowLengths:Object.freeze([...windowLengths]),
    unresolvedEdgeHistoryDimension:unknownDimension,
    temporalHistoryCondition:unknownDimension===0?
      "conditionally-identifiable-if-all-observation-premises-hold":
      "conditionally-ambiguous-even-if-all-observation-premises-hold",
    assumedVertexDivergences:"all-endpoints-every-microinterval-not-supplied",
    assumedOriginalEdgeTotals:"all-edges-per-declared-window-not-supplied",
    sourceCompleteness:"not-attested",actualFlowReadings:"not-supplied",
    realizedRhythm:"not-established",derivedClock:"not-established",
  });
}
