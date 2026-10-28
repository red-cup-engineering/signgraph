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
export function conditionalTemporalFlowAliasing(transfers, {
  microintervalCount, windowLengths,
}={}) {
  if (!Array.isArray(transfers) || transfers.length>4096)
    throw new TypeError("temporal flow requires at most 4096 source-admitted transfers");
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
  for(const e of transfers){
    const exchange=e?.exchange?.id,from=e?.from?.id,to=e?.to?.id;
    if(![exchange,from,to].every(id=>typeof id==="string"&&id.length>0) ||
       seenExchanges.has(exchange))
      throw new TypeError("temporal flow needs distinct original exchange and endpoint IDs");
    seenExchanges.add(exchange);
    const a=root(from),b=root(to);
    if(a!==b)parent.set(a,b);
  }
  const components=new Set([...parent.keys()].map(root)).size;
  const cycleRank=transfers.length-parent.size+components;
  if(cycleRank<0)throw new Error("temporal flow invalid source incidence rank");
  const unknownDimension=cycleRank*(microintervalCount-windowLengths.length);
  return Object.freeze({
    kind:"signgraph.conditionalTemporalFlowAliasing.v1",
    exchangeCount:transfers.length,endpointCount:parent.size,
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
