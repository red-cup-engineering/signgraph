/**
 * Hypothetical cut-error budgets for ORIGINAL source-admitted Resource exchanges.
 * Caller MUST first run channelResourceIncidence / channelFlowWitnessPlacement
 * against the original SignCell graph. This pure helper grants no admission,
 * sensor custody, calibration, physical effect, clock or measurement reading.
 *
 * Science #215, section7.23. Exact nonnegative integer atoms avoid floating-point
 * rounding of worst-case ceilings. One resource / one declared unit at a time.
 */
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const plain = value => value !== null && typeof value === "object" &&
  !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype ||
  Object.getPrototypeOf(value) === null);

function exactBudgets(raw, permitted, label, shared) {
  if (!plain(raw) || Object.keys(raw).length > 8192)
    throw new TypeError(`${label}: expected bounded ID-to-exact-error-ceiling object`);
  const entries = new Map();
  for (const id of Object.keys(raw).sort(compare)) {
    if (!permitted.has(id))
      throw new TypeError(`${label}: error ceiling names no proposed original observation`);
    const q = raw[id];
    if (!plain(q) || Object.keys(q).sort().join(",") !== "atoms,unit" ||
      typeof q.atoms !== "string" || !/^(0|[1-9][0-9]{0,79})$/.test(q.atoms) ||
      typeof q.unit !== "string" || !q.unit.trim() ||
      q.unit !== q.unit.normalize("NFC"))
      throw new TypeError(`${label}: error ceiling must have exact nonnegative atoms and normalized unit`);
    if (shared.unit !== null && shared.unit !== q.unit)
      throw new TypeError(`${label}: mixed units require original unit conversion, not a graph guess`);
    shared.unit = q.unit;
    entries.set(id, BigInt(q.atoms));
  }
  return entries;
}

/** Only invoked after original source-admission and conditional structural assay.
 * Do not expose this function as a second graph API; graph.mjs calls it on
 * admitted Resource-specific transfer records, with no copied state.
 */
export function conditionalFlowCutErrorBudgets(transfers, {
  proposedWitnessExchangeIds,
  proposedObservedCompartmentIds,
  hypotheticalErrorCeilings,
  structuralIdentifiable,
}) {
  const edges = [...transfers].sort((a,b) => compare(a.exchange.id,b.exchange.id));
  const meterIds = new Set(edges
    .filter(e => proposedWitnessExchangeIds.has(e.exchange.id))
    .map(e => e.exchange.id));
  const endpoints = new Set(edges.flatMap(e => [e.from.id,e.to.id]));
  const observed = proposedObservedCompartmentIds === null ? endpoints :
    new Set([...endpoints].filter(id => proposedObservedCompartmentIds.has(id)));
  if (!plain(hypotheticalErrorCeilings) ||
      Object.keys(hypotheticalErrorCeilings).sort().join(",") !== "edge,vertex")
    throw new TypeError("hypotheticalErrorCeilings requires exactly vertex and edge maps");
  const shared = {unit:null};
  const vertices = exactBudgets(hypotheticalErrorCeilings.vertex, observed,
    "hypothetical vertex divergence", shared);
  const meters = exactBudgets(hypotheticalErrorCeilings.edge, meterIds,
    "hypothetical independent edge meter", shared);
  const unmetered = edges.filter(e => !meterIds.has(e.exchange.id));
  const metered = edges.filter(e => meterIds.has(e.exchange.id));
  const adjacency = new Map();
  for (const e of unmetered) {
    if (!adjacency.has(e.from.id)) adjacency.set(e.from.id,[]);
    if (!adjacency.has(e.to.id)) adjacency.set(e.to.id,[]);
    adjacency.get(e.from.id).push(e);
    adjacency.get(e.to.id).push(e);
  }
  const reachable = (start, removedId) => {
    const seen = new Set([start]);
    const pending = [start];
    for (let i=0;i<pending.length;i++) for (const e of adjacency.get(pending[i]) ?? []) {
      if (e.exchange.id === removedId) continue;
      const other = e.from.id === pending[i] ? e.to.id : e.from.id;
      if (!seen.has(other)) {seen.add(other);pending.push(other);}
    }
    return seen;
  };
  const sideBudget = (side) => {
    const missing = [];
    let total = 0n;
    for (const v of [...side].sort(compare)) {
      if (!observed.has(v)) return null; // not an eligible cut side
      if (!vertices.has(v)) missing.push(`vertex:${v}`);
      else total += vertices.get(v);
    }
    for (const e of metered) {
      if (side.has(e.from.id) === side.has(e.to.id)) continue;
      if (!meters.has(e.exchange.id)) missing.push(`edge:${e.exchange.id}`);
      else total += meters.get(e.exchange.id);
    }
    return {atoms:missing.length ? null : total,
      missing:missing.sort(compare),side:[...side].sort(compare)};
  };
  const results = unmetered.map(e => {
    if (!structuralIdentifiable) return Object.freeze({exchange:e.exchange,
      status:"structurally-undetermined",radius:null});
    const left = reachable(e.from.id,e.exchange.id);
    const right = reachable(e.to.id,e.exchange.id);
    if ([...left].some(v=>right.has(v))) return Object.freeze({exchange:e.exchange,
      status:"structurally-undetermined",radius:null});
    const possibilities = [sideBudget(left),sideBudget(right)]
      .filter(Boolean)
      .sort((a,b) => a.atoms === null ? (b.atoms === null ?
        compare(a.side.join("\u0000"),b.side.join("\u0000")) : 1) :
        b.atoms === null ? -1 : a.atoms < b.atoms ? -1 : a.atoms > b.atoms ? 1 :
        compare(a.side.join("\u0000"),b.side.join("\u0000")));
    const winner = possibilities[0];
    if (!winner) return Object.freeze({exchange:e.exchange,
      status:"structurally-undetermined",radius:null});
    if (winner.atoms === null) return Object.freeze({exchange:e.exchange,
      status:"calibration-unprovided",radius:null,
      missingAssumptions:Object.freeze(winner.missing)});
    return Object.freeze({exchange:e.exchange,status:"conditional-error-radius",
      radius:Object.freeze({atoms:String(winner.atoms),unit:shared.unit}),
      cutSideEndpointIds:Object.freeze(winner.side)});
  });
  return Object.freeze({
    kind:"signgraph.conditionalFlowCutErrorBudgets.v1",
    standing:"hypothetical-calibration-design-only",
    unit:shared.unit,
    unmeteredExchanges:Object.freeze(results),
    sourceCompleteness:"not-attested",
    actualReadings:"not-supplied",
    actualTransfers:"not-established",
    observedClockAndPorts:"not-established",
  });
}
