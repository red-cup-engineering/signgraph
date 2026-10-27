import assert from "node:assert/strict";
import test from "node:test";
import { canonicalizeSemioticJson } from "@red-cup-engineering/semiotic-content-address";
import {
  decodeRelationalValue,
  encodeRelationalValue,
  identifyRelationalValuePayload,
  relationalValueId,
  relationalValuePredications,
} from "../src/relational-value.mjs";

const producers = [
  encodeRelationalValue,
  identifyRelationalValuePayload,
  relationalValueId,
  value => relationalValuePredications(value, { resource: "urn:561:test:admission", revision: "1" }),
];
const decode = value => {
  const encoded = encodeRelationalValue(value);
  return decodeRelationalValue(encoded.type, encoded.term);
};

test("every relational producer refuses source record and index accessors without invoking them", () => {
  let reads = 0;
  const record = {};
  Object.defineProperty(record, "claim", { enumerable: true, get() { reads += 1; return "fabricated"; } });
  const sequence = [0];
  Object.defineProperty(sequence, "0", { enumerable: true, get() { reads += 1; return "fabricated"; } });
  for (const producer of producers) {
    for (const source of [record, { nested: record }, sequence, { nested: sequence }]) {
      assert.throws(() => producer(source), /never accessors/u);
      assert.equal(reads, 0, "source computation must not precede content-owner admission");
    }
  }
});

test("normalization does not dispatch through a caller's array map method", () => {
  let reads = 0;
  const source = [1, "e\u0301"];
  Object.defineProperty(source, "map", { get() { reads += 1; throw new Error("caller map ran"); } });
  assert.deepEqual(decode(source), [1, "é"]);
  assert.equal(reads, 0);
});

test("cycles refuse at the upstream carrier boundary while repeated values retain separate occurrences", () => {
  const record = {};
  record.back = record;
  const sequence = [];
  sequence.push(sequence);
  const mixed = { next: [] };
  mixed.next.push(mixed);
  for (const producer of producers) {
    for (const source of [record, sequence, mixed]) {
      assert.throws(() => producer(source), error => !(error instanceof RangeError) && /cyclic/u.test(error.message));
    }
  }
  const shared = { claim: "one" };
  const source = { first: shared, second: shared };
  assert.deepEqual(decode(source), source);
  const graph = relationalValuePredications(source, { resource: "urn:shared", revision: "1" });
  const first = graph.edges.find(cell => cell.predicate === "field:first");
  const second = graph.edges.find(cell => cell.predicate === "field:second");
  assert.notEqual(first.object, second.object, "shared source data is two structural occurrences");
});

test("sparse arrays and malformed scalars refuse before any structural graph is returned", () => {
  for (const producer of producers) {
    for (const source of [new Array(1), [1, , 3]]) assert.throws(() => producer(source), /present data elements/u);
    for (const source of [NaN, Infinity, -Infinity, { value: NaN }]) assert.throws(() => producer(source), /finite/u);
  }
});

test("upstream carrier normalization governs omitted undefined fields and preserved opaque keys", () => {
  const source = JSON.parse('{"__proto__":{"active":true},"constructor":"a mark","label":"e\\u0301"}');
  source.absent = undefined;
  const canonical = canonicalizeSemioticJson(source);
  assert.deepEqual(decode(source), canonical);
  assert.equal(identifyRelationalValuePayload(source).token, identifyRelationalValuePayload(canonical).token);
  assert.equal(Object.hasOwn(canonical, "__proto__"), true);
  assert.equal(Object.hasOwn(canonical, "absent"), false);
  assert.equal(Object.hasOwn(source, "absent"), true, "source is not modified");
  assert.equal({}.active, undefined);
  assert.throws(() => encodeRelationalValue({ "e\u0301": 1, "é": 2 }), /map keys collide after NFC normalization/u);
});

test("unchanged canonical data keeps its historical NI vector and byte ownership", () => {
  const source = { alpha: "é", zeta: [true, null, 7] };
  assert.equal(identifyRelationalValuePayload(source).token, "ni:///sha-256;cdzMmK_smdb8QlOItnfrciFlnK42RA28R-MyS5hJatc");
  const bytes = new Uint8Array([0, 1, 255]);
  const encoded = encodeRelationalValue(bytes);
  assert.equal(identifyRelationalValuePayload(bytes).token, identifyRelationalValuePayload(Buffer.from(bytes)).token);
  bytes[1] = 99;
  assert.deepEqual([...decodeRelationalValue(encoded.type, encoded.term)], [0, 1, 255]);
  assert.deepEqual(decode({ fraction: 1e-7, integer: 9007199254740993n }), { fraction: 1e-7, integer: 9007199254740993n });
});
