import {
  admitDelivery, admitSemioticCell, cell, isPoreOpen, receiptForDelivery,
} from "@red-cup-engineering/signcell";
import {
  exactIdentity, hasFields, readSourceArray, readSourceRecord, retainedCarrier,
} from "@red-cup-engineering/semiotic-content-address-system";
import { createGraph, topologicalTiers } from "@red-cup-engineering/metrologic/models/graphs/directed-multigraph";
import { rationalOfBigInts, rationalParts, ratEqual } from "@red-cup-engineering/metrologic/number/exact-number";

const states = new WeakMap();
const name = value => typeof value === "string" && value.trim() !== "";
const pair = (first, second) => JSON.stringify([first, second].sort());
const byId = (left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
const accept = value => Object.freeze({ ok: true, value });
const refuse = (code, details) => Object.freeze({ ok: false, refusal: Object.freeze({ code, ...details }) });

/** Publish the accepted kinds and their symmetric, irreflexive independence relation. */
export function createPort(input) {
  const source = readSourceRecord(input, "Port");
  if (!hasFields(source, ["kinds"], ["independent"])) throw new TypeError("expected Port kinds and independence pairs");
  const kinds = readSourceArray(source.kinds, "Port kinds");
  if (kinds.some(kind => !name(kind)) || new Set(kinds).size !== kinds.length)
    throw new TypeError("Port kinds must be distinct nonempty names");
  const pairs = new Set();
  for (const entry of readSourceArray(source.independent ?? [], "Port independence")) {
    const [first, second, ...rest] = readSourceArray(entry, "Port independence pair");
    if (rest.length || first === second || !kinds.includes(first) || !kinds.includes(second))
      throw new TypeError("Port independence relates two different admitted kinds");
    pairs.add(pair(first, second));
  }
  const content = {
    kind: "signgraph.port.v1",
    kinds: kinds.toSorted(),
    independent: [...pairs].sort().map(key => JSON.parse(key)),
  };
  return retainedCarrier({ ...content, id: exactIdentity(content) });
}

function cut(port, sources, deliveries, before) {
  const nodes = [...deliveries.keys()].sort().map(id => ({ id }));
  const edges = [...before].sort().map(key => {
    const [from, to] = JSON.parse(key);
    return { from, to };
  });
  const { tiers, cycle } = topologicalTiers(createGraph({ nodes, edges }));
  if (cycle) return refuse("conflicting-delivery-order", { port: port.id, occurrences: Object.freeze(cycle) });
  const content = {
    kind: "signgraph.portGraph.v1",
    port,
    cells: [...sources.values(), ...deliveries.values()].sort(byId),
    order: tiers.flatMap(tier => tier.sort()),
    precedences: edges.map(({ from, to }) => [from, to]),
  };
  const graph = retainedCarrier({ ...content, id: exactIdentity(content) });
  states.set(graph, { sources, deliveries, before });
  return accept(graph);
}

/** Seat a Port on a finite cut of native cellular sources. */
export function createPortGraph(input, cells = []) {
  const source = readSourceRecord(input, "Port carrier");
  const { id, kind, kinds, independent } = source;
  const port = createPort({ kinds, independent });
  if (!hasFields(source, ["id", "kind", "kinds", "independent"]) || kind !== port.kind || id !== port.id)
    throw new TypeError("Port carrier does not match its advertised identity");
  const sources = new Map();
  for (const supplied of readSourceArray(cells, "Port graph cells")) {
    const entity = admitSemioticCell(supplied);
    if (sources.has(entity.id)) throw new TypeError("duplicate Port graph cell");
    sources.set(entity.id, entity);
  }
  return cut(port, sources, new Map(), new Set()).value;
}

function stateOf(graph) {
  const state = states.get(graph);
  if (!state) throw new TypeError("expected an admitted Port graph");
  return state;
}

function readOffer(graph, input) {
  let delivery;
  try { delivery = admitDelivery(input); }
  catch (error) { return refuse("invalid-delivery", { port: graph.port.id, message: error.message }); }
  if (!graph.port.kinds.includes(delivery.message.type))
    return refuse("unsupported-kind", { port: graph.port.id, kind: delivery.message.type });
  const { cell: recipient, pore: address } = delivery.target;
  const pore = stateOf(graph).sources.get(recipient)?.pores.find(pore => pore.id === address);
  if (!pore || (pore.direction !== "in" && pore.direction !== "bidirectional"))
    return refuse("unknown-ingress", { port: graph.port.id, target: delivery.target });
  return accept({ delivery, pore });
}

/** Screen an addressed offer against the published vocabulary and supplied ingress cut. */
export function inspectPortDelivery(graph, input) {
  stateOf(graph);
  const checked = readOffer(graph, input);
  if (!checked.ok) return checked;
  const { delivery, pore } = checked.value;
  return isPoreOpen(pore, "in") ? accept(delivery)
    : refuse("closed-ingress", { port: graph.port.id, target: delivery.target });
}

function amount(input) {
  const source = readSourceRecord(input, "exact quantity");
  if (!hasFields(source, ["kind", "num", "den"]))
    throw new TypeError("quantity requires a Metrologic rational");
  const [numerator, denominator] = rationalParts(source);
  if (numerator < 0n || denominator <= 0n) throw new TypeError("quantity must be nonnegative");
  return rationalOfBigInts(numerator, denominator);
}

function exchangeReport(input) {
  const source = readSourceRecord(input, "resource exchange");
  if (!hasFields(source, ["resource", "debited", "credited", "witness"]) ||
      !name(source.resource) || source.witness == null)
    throw new TypeError("exchange requires a resource, exact quantities, and a source witness");
  const debited = amount(source.debited), credited = amount(source.credited);
  if (!ratEqual(debited, credited)) throw new TypeError("exchange debited and credited quantities differ");
  return retainedCarrier({ resource: source.resource, amount: debited, witness: source.witness });
}

/** Record a crossing confirmed by SignCell's receiver, with optional qualified ownership evidence. */
export function recordPortDelivery(graph, input, world, exchange) {
  const { sources, deliveries, before } = stateOf(graph);
  const checked = readOffer(graph, input);
  if (!checked.ok) return checked;
  const { delivery } = checked.value;
  let receipt;
  try { receipt = receiptForDelivery(world, input); }
  catch (error) { return refuse("invalid-receipt-source", { port: graph.port.id, message: error.message }); }
  if (!receipt) return refuse("unreceived-delivery", { port: graph.port.id, target: delivery.target });
  let resource;
  if (exchange !== undefined) {
    try { resource = exchangeReport(exchange); }
    catch (error) { return refuse("invalid-exchange", { port: graph.port.id, message: error.message }); }
  }
  const id = exactIdentity({ source: receipt.source, id: receipt.id });
  const record = retainedCarrier({ id, delivery, testimony: cell(
    delivery.sender.cell, "signgraph.port-crossing.v1", { recipient: delivery.target.cell, occurrence: id },
    { for: [receipt] },
  ), exchange: resource });
  const previous = deliveries.get(id);
  if (previous) return exactIdentity(previous) === exactIdentity(record) ? accept(graph)
    : refuse("conflicting-delivery", { port: graph.port.id, occurrence: id });
  const independent = new Set(graph.port.independent.map(([first, second]) => pair(first, second)));
  const order = new Set(before);
  for (const [prior, value] of deliveries)
    if (!independent.has(pair(value.delivery.message.type, delivery.message.type)))
      order.add(JSON.stringify([prior, id]));
  return cut(graph.port, sources, new Map(deliveries).set(id, record), order);
}

/** Compose exact shared-Port cuts, preserving witnessed order and delivery occurrences. */
export function composePortGraphs(left, right) {
  const first = stateOf(left), second = stateOf(right);
  if (left.port.id !== right.port.id)
    return refuse("different-ports", { port: left.port.id, supplied: right.port.id });
  const sources = new Map(first.sources), deliveries = new Map(first.deliveries);
  for (const [id, entity] of second.sources) {
    if (sources.has(id) && exactIdentity(sources.get(id)) !== exactIdentity(entity))
      return refuse("conflicting-cell", { port: left.port.id, cell: id });
    sources.set(id, entity);
  }
  for (const [id, record] of second.deliveries) {
    if (deliveries.has(id) && exactIdentity(deliveries.get(id)) !== exactIdentity(record))
      return refuse("conflicting-delivery", { port: left.port.id, occurrence: id });
    deliveries.set(id, record);
  }
  return cut(left.port, sources, deliveries, new Set([...first.before, ...second.before]));
}
