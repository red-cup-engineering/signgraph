import test from "node:test";
import assert from "node:assert/strict";
import { cell, coincides, retainedCarrier, semanticId, sidesOf } from "@red-cup-engineering/signcell/cell";
import { tokenFrame, SPECIALIZES } from "@red-cup-engineering/signcell/token-frame";
import { allPairs, converse, knowledgeOrder, predicateFiber } from "../src/fiber.mjs";
import { queryInheritedTellings } from "../src/token-sheaf.mjs";
import { decodeRelationalValue, encodeRelationalValue, relationalValueId } from "../src/relational-value.mjs";

test("predicate fibers receive Cell-owned byte coordinates through canonical reindexing", () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const subject = retainedCarrier({ name: "e\u0301", bytes });
  const object = retainedCarrier({ name: "other", bytes: new Uint8Array([4, 5]) });
  const label = retainedCarrier({ name: "relate\u0301", bytes: new Uint8Array([6]) });
  const entities = [subject, object];
  const fiber = predicateFiber(label, entities, (s, o) =>
    coincides(s, subject) && coincides(o, object) ? "potential" : "absurd");
  bytes[0] = 99;
  assert.equal(subject.name, "e\u0301", "retaining source presentation does not normalize it in place");
  assert.equal(fiber.entities[0].name, "é", "the fiber uses the original canonical projection");
  assert.equal(fiber.label.name, "relaté");
  assert.equal(fiber.at(subject, object), "potential");
  assert.deepEqual(fiber.entities[0].bytes, new Uint8Array([1, 2, 3]));
  fiber.entities[0].bytes[0] = 77;
  assert.deepEqual(fiber.entities[0].bytes, new Uint8Array([1, 2, 3]));
  assert.equal(semanticId(fiber.entities[0]), semanticId(subject));
  const moved = converse(entities).pullback(fiber);
  const returned = converse(entities).exists(knowledgeOrder(), moved);
  for (const [s, o] of allPairs(entities)) {
    assert.equal(moved.at(o, s), fiber.at(s, o));
    assert.equal(returned.at(s, o), fiber.at(s, o));
  }
});

test("inherited query pages retain Cell-owned byte claims and opposing witnesses", () => {
  const bytes = new Uint8Array([10, 20]);
  const source = cell("general", "reports", { bytes }, {
    for: [{ witness: "provider", bytes: new Uint8Array([30]) }],
  });
  const denial = cell("specific", "reports", source.object, {
    against: [{ witness: "receiver", bytes: new Uint8Array([40]) }],
  });
  const frame = tokenFrame([
    cell("specific", SPECIALIZES, "general", { for: ["classification"] }),
    source, denial,
  ]);
  const selection = { predicate: "reports", object: source.object };
  const first = queryInheritedTellings(frame, selection, { limit: 1 });
  const second = queryInheritedTellings(frame, selection, { offset: first.next, limit: 1 });
  assert.equal(first.total, 2);
  assert.equal(first.next, 1);
  assert.equal(second.next, null);
  assert.equal(second.snapshot, first.snapshot);
  assert.equal(second.sourceCells, first.sourceCells);
  const entries = [...first.entries, ...second.entries];
  assert.deepEqual(entries.map(x => x.token).sort(), ["general", "specific"]);
  const inherited = entries.find(x => x.token === "specific");
  assert.equal(inherited.reading, "stable");
  assert.deepEqual(sidesOf(inherited.cell), [true, true]);
  assert.deepEqual(inherited.cell.for[0].bytes, new Uint8Array([30]));
  assert.deepEqual(inherited.cell.against[0].bytes, new Uint8Array([40]));
  assert.deepEqual(inherited.sources.map(x => x.token).sort(), ["general", "specific"]);
  bytes[0] = 90;
  first.selection.object.bytes[0] = 80;
  inherited.cell.for[0].bytes[0] = 70;
  assert.deepEqual(source.object.bytes, new Uint8Array([10, 20]));
  assert.deepEqual(first.selection.object.bytes, new Uint8Array([10, 20]));
  assert.deepEqual(inherited.cell.for[0].bytes, new Uint8Array([30]));
  assert.equal(queryInheritedTellings(frame, selection, { limit: 1 }).snapshot, first.snapshot);
});

test("relational wire identity is unchanged for source-owned byte and Unicode values", () => {
  const held = retainedCarrier({ name: "e\u0301", bytes: new Uint8Array([7, 8]), list: [1, true] });
  const canonical = { name: "é", bytes: new Uint8Array([7, 8]), list: [1, true] };
  const encoded = encodeRelationalValue(held);
  assert.deepEqual(encoded, encodeRelationalValue(canonical));
  assert.equal(relationalValueId(held), relationalValueId(canonical));
  const decoded = decodeRelationalValue(encoded.type, encoded.term);
  assert.ok(decoded.bytes instanceof Uint8Array);
  assert.deepEqual({ ...decoded, bytes: Array.from(decoded.bytes) },
    { ...canonical, bytes: Array.from(canonical.bytes) });
  assert.equal(semanticId(decoded), semanticId(canonical));
  decoded.bytes[0] = 0;
  assert.deepEqual(held.bytes, new Uint8Array([7, 8]));
  assert.equal(held.name, "e\u0301");
});

test("receiving a byte carrier does not admit arbitrary coordinate accessors", () => {
  let reads = 0;
  const foreign = {};
  Object.defineProperty(foreign, "bytes", { enumerable: true, get() { reads++; return new Uint8Array([1]); } });
  assert.throws(() => predicateFiber("reports", [foreign], () => "potential"), TypeError);
  const frame = tokenFrame([cell("subject", "reports", "object", { for: ["source"] })]);
  assert.throws(() => queryInheritedTellings(frame, { object: foreign }), TypeError);
  assert.equal(reads, 0);
});

test("relational encoding refuses foreign getters before observing their values", () => {
  let reads = 0;
  const object = {};
  const array = [];
  for (const [value, key] of [[object, "value"], [array, "0"]]) {
    Object.defineProperty(value, key, {
      enumerable: true, get() { reads++; return "unadmitted observation"; },
    });
    assert.throws(() => encodeRelationalValue(value), TypeError);
  }
  assert.equal(reads, 0);
});

test("relational input uses the selected Cell's JSON absence and dense-array semantics", () => {
  const absent = { claim: "present", absent: undefined };
  assert.deepEqual(encodeRelationalValue(absent), encodeRelationalValue({ claim: "present" }));
  assert.ok(Object.hasOwn(absent, "absent"), "projection does not rewrite the source object");
  assert.throws(() => encodeRelationalValue(new Array(1)), TypeError);
});
