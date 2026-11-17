import assert from "node:assert/strict";
import test from "node:test";
import {
  APERTURE, address, cell, checkpointWorld, createMessage, createSemioticCell, createWorld,
  restoreWorld, runSystems, sendMessage, utterance, wallAt, withPore,
} from "@red-cup-engineering/signcell";
import {
  composePortGraphs, createPort, createPortGraph, inspectPortDelivery, recordPortDelivery,
} from "@red-cup-engineering/signgraph/ports";
import { rationalOfBigInts } from "@red-cup-engineering/metrologic/number/exact-number";

const value = report => {
  assert.equal(report.ok, true, JSON.stringify(report.refusal));
  return report.value;
};
const endpoint = (occurrence, direction, evidence = { for: ["interface survey"] }) => {
  const occurrenceCell = createSemioticCell({ occurrence, source: utterance("same wall", "ready") });
  return withPore(occurrenceCell, cell(wallAt(occurrenceCell).id, APERTURE, direction, evidence));
};
const location = entity => ({ cell: entity.id, pore: entity.pores[0].id });
const port = createPort({ kinds: ["status", "measurement", "ship"], independent: [["status", "measurement"]] });
const sender = endpoint("shipper", "out"), receiver = endpoint("warehouse", "in");
const graph = createPortGraph(port, [receiver]);
const world = createWorld([], { semioticCells: [receiver] });
const send = (kind, id, target = location(receiver)) =>
  sendMessage(sender, location(sender).pore, createMessage(kind, id), { id, target });
const authorizeDelivery = delivery =>
  delivery.source === sender.id && delivery.sender.pore === location(sender).pore &&
  delivery.target.cell === receiver.id && delivery.target.pore === location(receiver).pore;
const receive = (world, delivery) => runSystems(world, [delivery], { authorizeDelivery }).world;

test("Port is a frozen finite contract with symmetric independence", () => {
  assert.ok(Object.isFrozen(port) && Object.isFrozen(port.kinds) && Object.isFrozen(port.independent[0]));
  assert.deepEqual(port, createPort({
    kinds: port.kinds.toReversed(), independent: [["measurement", "status"], ["status", "measurement"]],
  }));
  assert.throws(() => createPort({ kinds: ["ship"], independent: [["ship", "ship"]] }), /independence/);
  assert.throws(() => createPort({ kinds: ["ship"], independent: [["ship", "report"]] }), /independence/);
});

test("Port refusal names unsupported kinds and leaves observations unchanged", () => {
  const message = send("undeclared", "d1");
  assert.deepEqual(inspectPortDelivery(graph, message), {
    ok: false, refusal: { code: "unsupported-kind", port: port.id, kind: "undeclared" },
  });
  assert.equal(recordPortDelivery(graph, message, world).refusal.code, "unsupported-kind");
  const missing = send("ship", "d2", { cell: receiver.id, pore: sender.pores[0].id });
  assert.equal(inspectPortDelivery(graph, missing).refusal.code, "unknown-ingress");
  const closed = endpoint("closed", "in", { against: ["closed till loading"] });
  const blocked = send("ship", "d3", location(closed));
  assert.equal(inspectPortDelivery(createPortGraph(port, [closed]), blocked).refusal.code, "closed-ingress");
  const wronglyAddressed = send("ship", "d4", location(sender));
  assert.equal(inspectPortDelivery(graph, wronglyAddressed).refusal.code, "unknown-ingress");
  assert.equal(recordPortDelivery(graph, send("ship", "d5"), world).refusal.code, "unreceived-delivery");
  assert.deepEqual(graph.order, []);
  assert.deepEqual(world.cells, receiver.pores.map(pore => pore.aperture));
});

function trace(deliveries) {
  let at = world, current = graph;
  for (const delivery of deliveries) {
    value(inspectPortDelivery(current, delivery));
    at = receive(at, delivery);
    current = value(recordPortDelivery(current, delivery, at));
  }
  return { world: at, graph: current };
}

test("Independent messages commute and dependent delivery order survives", () => {
  const a = send("status", "seen"), b = send("measurement", "checked"), c = send("ship", "sent");
  assert.deepEqual(trace([a, b, c]).graph, trace([b, a, c]).graph);
  const first = trace([a, c]).graph, second = trace([c, a]).graph;
  assert.notEqual(first.id, second.id);
  assert.deepEqual(first.order, second.order.toReversed());
  assert.equal(composePortGraphs(first, second).refusal.code, "conflicting-delivery-order");
});

test("Port composition retains exact crossed occurrences and supports restored-world replay", () => {
  const first = send("ship", "e\u0301"), second = send("ship", "é");
  const received = trace([first, second]);
  const restored = restoreWorld(structuredClone(checkpointWorld(received.world)));
  assert.strictEqual(value(recordPortDelivery(received.graph, first, restored)), received.graph);
  assert.equal(recordPortDelivery(received.graph, { ...first, message: createMessage("ship", "changed") }, restored)
    .refusal.code, "unreceived-delivery");
  const alternate = sendMessage(sender, location(sender).pore, createMessage("ship", "changed"),
    { id: first.id, target: location(receiver) });
  const other = trace([alternate]);
  assert.equal(recordPortDelivery(received.graph, alternate, other.world).refusal.code, "conflicting-delivery");
  const origin = createPortGraph(port, [sender]);
  const composite = value(composePortGraphs(received.graph, origin));
  assert.deepEqual(composite, value(composePortGraphs(origin, received.graph)));
  assert.deepEqual(new Set(composite.cells.map(cell => cell.id)),
    new Set([...received.graph.cells, ...origin.cells].map(cell => cell.id)));
  const crossings = composite.cells.filter(cell => cell.delivery);
  assert.equal(crossings.length, 2);
  assert.notEqual(address(crossings[0].testimony), address(crossings[1].testimony));
  assert.equal(composePortGraphs(composite, createPortGraph(createPort({ kinds: ["ship"] }))).refusal.code, "different-ports");
});

test("Resource exchange records exact conserved amounts with attributed evidence", () => {
  const shipment = send("ship", "load");
  const at = receive(world, shipment);
  const amount = rationalOfBigInts(90071992547409931n, 7n);
  const quantity = {
    resource: "grain", debited: amount, credited: amount, witness: { carrier: "weighbridge", report: 17 },
  };
  const reported = value(recordPortDelivery(graph, shipment, at, quantity));
  const combined = value(composePortGraphs(createPortGraph(port, [sender]), reported));
  assert.deepEqual(combined.cells.find(cell => cell.delivery).exchange, {
    resource: "grain", amount, witness: quantity.witness,
  });
  const short = { ...quantity, credited: rationalOfBigInts(90071992547409930n, 7n) };
  assert.equal(recordPortDelivery(graph, shipment, at, short).refusal.code, "invalid-exchange");
  assert.deepEqual(graph.order, []);
});
