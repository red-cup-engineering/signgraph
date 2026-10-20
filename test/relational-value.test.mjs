import assert from "node:assert/strict";
import test from "node:test";
import { decodeSemantic, semanticBytes, semanticId } from "@red-cup-engineering/semiotic-content-address";

import { makeNiUri } from "@red-cup-engineering/uri-services-section/ni-uri";
import { encodeCanonical } from "@red-cup-engineering/cbor-services-section";
import { markResource, markBytes, bitAt, bitWindow } from "@red-cup-engineering/computer-data-engineering-services-section/digital-mark-space";
import { flowNetworkOfCells } from "../src/cell-graph.mjs";
import { address as cellAddress, cell as predicationCell, knowledgeReading } from "@red-cup-engineering/signcell/cell";
import { typedListItems, typedListTerm } from "@red-cup-engineering/computer-data-engineering-services-section/semiotic-expression-notation/json-codec";
import {
  admitRelationalValuePayload,
  decodeRelationalValue,
  encodeRelationalValue,
  relationalValueId,
  relationalValuePredications,
  identifyRelationalValuePayload,
  verifyRelationalValuePayload,
} from "../src/relational-value.mjs";

const VECTOR_SOURCE = Object.freeze({ alpha: "é", zeta: Object.freeze([true, null, 7]) });
const VECTOR_TOKEN = "ni:///sha-256;cdzMmK_smdb8QlOItnfrciFlnK42RA28R-MyS5hJatc";

test("identifies and admits one canonical token/claim relational payload", () => {
  const identified = identifyRelationalValuePayload(VECTOR_SOURCE);
  assert.equal(identified.token, VECTOR_TOKEN);
  assert.equal(identified.token, makeNiUri(identified.bytes));
  assert.deepEqual(Object.keys(identified.claim).sort(), ["semanticType", "term"]);
  assert.equal(verifyRelationalValuePayload({ token: identified.token, claim: identified.claim }), true);

  const admitted = admitRelationalValuePayload({
    bytes: new Uint8Array(identified.bytes),
    token: identified.token,
  });
  assert.deepEqual(admitted.claim, identified.claim);
  assert.equal(Object.isFrozen(admitted.claim), true);
  assert.equal(Object.isFrozen(admitted.claim.semanticType), true);
  assert.equal(Object.isFrozen(admitted.claim.term), true);
});

test("refuses token mismatch and a reordered but graph-equivalent carrier", () => {
  const identified = identifyRelationalValuePayload(VECTOR_SOURCE);
  assert.throws(
    () => admitRelationalValuePayload({ bytes: identified.bytes, token: identifyRelationalValuePayload("other").token }),
    /token does not match/u,
  );

  const reorderedAscription = [
    "ascribe",
    identified.claim.semanticType,
    structuredClone(identified.claim.term),
  ];
  const nodes = reorderedAscription[2][2];
  nodes[1] = typedListTerm(null, [...typedListItems(nodes[1])].reverse());
  const reorderedBytes = encodeCanonical(reorderedAscription);
  assert.throws(
    () => admitRelationalValuePayload({ bytes: reorderedBytes, token: makeNiUri(reorderedBytes) }),
    /graph carrier is not canonical/u,
  );
  assert.equal(verifyRelationalValuePayload({
    token: makeNiUri(reorderedBytes),
    claim: { semanticType: reorderedAscription[1], term: reorderedAscription[2] },
  }), false);
});

test("Buffer and Uint8Array values have one canonical payload identity", () => {
  const bufferPayload = identifyRelationalValuePayload(Buffer.from([0, 1, 255]));
  const typedArrayPayload = identifyRelationalValuePayload(new Uint8Array([0, 1, 255]));
  assert.equal(typedArrayPayload.token, bufferPayload.token);
  assert.deepEqual(typedArrayPayload.claim, bufferPayload.claim);
  assert.deepEqual(
    admitRelationalValuePayload({ bytes: typedArrayPayload.bytes, token: typedArrayPayload.token }).claim,
    typedArrayPayload.claim,
  );
});

test("typed relational SEN is canonical and round-trips without JSON", () => {
  const source = { alpha: "é", decimals: [1e-7, -2.5e-8, 1.25, 1e21], zeta: [true, null, 7] };
  const encoded = encodeRelationalValue(source);
  const term = ["ascribe", encoded.type, encoded.term];
  assert.deepEqual(decodeRelationalValue(encoded.type, encoded.term), source);
  assert.deepEqual(decodeSemantic(semanticBytes(term)), term);
  assert.equal(relationalValueId(source), semanticId(term));
});


test("opaque addressed nomenclature and work values become witnessed, oriented SignCells and a selected 1-skeleton", () => {
  const registry = {
    nomenclature: {
      preferred: "Citizen", alternatives: ["Inhabitant", "resident"], score: 7, stringScore: "7",
    },
    endeavor: {
      title: "Cold Red Gate Colony",
      workflow: ["observe", "admit", "assay"],
      complete: false,
    },
  };
  const source = { resource: "urn:561:records:citizen-register", revision: "record-cut-1" };
  const projected = relationalValuePredications(registry, source);
  const second = relationalValuePredications({
    endeavor: registry.endeavor, nomenclature: {
      stringScore: "7", score: 7, alternatives: ["Inhabitant", "resident"], preferred: "Citizen",
    },
  }, source);
  assert.equal(projected.kind, "signgraph.relational-value-predications/v1");
  assert.equal(projected.payload, identifyRelationalValuePayload(registry).token);
  assert.deepEqual(projected, second,
    "changing the insertion order of record keys does not invent different structure");
  assert.equal(projected.source.resource, source.resource);
  assert.equal(projected.source.revision, source.revision);
  assert.ok(projected.source.occurrence.startsWith("ni:///sha-256;"));
  assert.ok(projected.edges.length > 0);
  assert.ok(projected.edges.some(edge => edge.predicate === "field:nomenclature"));
  assert.ok(projected.edges.some(edge => edge.predicate === "field:workflow"));
  assert.ok(projected.edges.some(edge => edge.predicate === "index:0"));
  assert.ok(projected.edges.every(edge => edge.subject.startsWith("ni:///sha-256;")
    && edge.object.startsWith("ni:///sha-256;")));
  assert.ok(projected.attributes.some(at => at.predicate === "relational-value:kind"
    && at.object === "integer"));
  assert.ok(projected.attributes.some(at => at.predicate === "relational-value:kind"
    && at.object === "text"));
  assert.ok(projected.attributes.some(at => at.predicate === "relational-value:lexical"
    && at.object === "7"));
  assert.ok(projected.attributes.some(at => at.predicate === "relational-value:root"
    && at.subject === projected.source.occurrence && at.object === projected.root));
  assert.ok(projected.cells.every(at => knowledgeReading(at) === "potential"
    && at.for[0].kind === "signgraph.relational-value-structural-derivation/v1"
    && at.for[0].resource === source.resource && at.for[0].revision === source.revision
    && at.for[0].payload === projected.payload),
  "the evidence is a deterministic structural projection of one identified record, not a citizen grant");
  const geometry = flowNetworkOfCells(projected.edges);
  assert.equal(geometry.edges.length, projected.edges.length,
    "select only the directed structural edges, not node lexical labels as shortcuts");
  assert.ok(!projected.edges.some(edge => edge.object === "7" || edge.object === "Citizen"));
  assert.notEqual(projected.source.occurrence, projected.root,
    "source occurrence and its internal root are different typed referents");

  const anotherSource = relationalValuePredications(registry, {
    resource: "urn:561:records:another-register", revision: source.revision,
  });
  assert.equal(anotherSource.payload, projected.payload);
  assert.equal(cellAddress(anotherSource.edges[0]), cellAddress(projected.edges[0]),
    "the same structural predication has one cell coordinate across sources");
  assert.notDeepEqual(anotherSource.edges[0].for, projected.edges[0].for,
    "independently supplied source witnesses must remain different");
  assert.notEqual(anotherSource.source.occurrence, projected.source.occurrence);
  const incompatible = relationalValuePredications({ ...registry, additional: "different" }, source);
  assert.notEqual(incompatible.payload, projected.payload);
  assert.notEqual(incompatible.source.occurrence, projected.source.occurrence,
    "conflicting data under an unverified reused revision label must not share one occurrence");
  const newer = relationalValuePredications(registry, { ...source, revision: "record-cut-2" });
  assert.notEqual(newer.source.occurrence, projected.source.occurrence,
    "a repeated value at a later record cut is another sourced occurrence");
  assert.equal(newer.payload, projected.payload);
  assert.throws(() => relationalValuePredications(registry), /source resource and revision/u);
  assert.throws(() => relationalValuePredications(registry, { resource: "only" }),
    /source resource and revision/u);
});

test("opaque hostile-looking JSON field names remain data on encode, decode and SignCell projection", () => {
  const input = JSON.parse('{"__proto__":{"citizen":false},"constructor":"opaque","toString":null}');
  assert.equal(Object.hasOwn(input, "__proto__"), true);
  const encoded = encodeRelationalValue(input);
  const returned = decodeRelationalValue(encoded.type, encoded.term);
  assert.deepEqual(returned, input);
  assert.equal(Object.getPrototypeOf(returned), Object.prototype);
  assert.equal(Object.hasOwn(returned, "__proto__"), true,
    "a JSON field must not be treated as the JavaScript prototype setter");
  assert.equal(returned.__proto__.citizen, false);
  assert.equal({}.citizen, undefined, "no prototype pollution");
  const projected = relationalValuePredications(input, {
    resource: "urn:561:registers:opaque-names", revision: "1",
  });
  assert.ok(projected.edges.some(at => at.predicate === "field:__proto__"));
  assert.ok(projected.edges.some(at => at.predicate === "field:constructor"));
  assert.ok(projected.edges.some(at => at.predicate === "field:toString"));
  assert.ok(projected.nodes.length > 3);
  const nominal = JSON.parse('{"e\\u0301":1,"é":2}');
  assert.throws(() => encodeRelationalValue(nominal),
    /field names collide after NFC normalization/u,
    "distinct original source keys cannot be silently merged by Unicode normalization");
});


test("arbitrary source bytes retain bit coordinates and a separate explicitly decoded relational view", () => {
  const rawA = new TextEncoder().encode('{"term":"Citizen","state":"candidate"}');
  const rawB = new TextEncoder().encode('{ "state" : "candidate", "term" : "Citizen" }\n');
  const a = markResource(rawA, { mediaType: "application/json", source: { registrar: "test", revision: "1" } });
  const b = markResource(rawB, { mediaType: "application/json", source: { registrar: "test", revision: "2" } });
  assert.notEqual(a.address, b.address, "exact original bytes retain two distinguishable source resources");
  rawA.fill(0);
  assert.equal(new TextDecoder().decode(markBytes(a)), '{"term":"Citizen","state":"candidate"}',
    "source transport cannot mutate the original admitted resource");
  const bits = bitWindow(a, { offset: 0, limit: 16 });
  assert.equal(bits.kind, "lspace.mark-window");
  assert.equal(bits.bits.length, 16);
  assert.equal(bits.next, 16);
  assert.deepEqual(bits.bits.map(at => at.cell), Array.from({ length: 16 }, (_, bit) => [
    a.address, bit, bitAt(a, bit).value,
  ]));
  assert.deepEqual(bits.bits.slice(0, 8).map(at => at.value),
    [0, 1, 1, 1, 1, 0, 1, 1], "first byte is the literal '{' with MSB-first coordinates");
  const sourceBit = bits.bits[0];
  const toldBit = predicationCell(sourceBit.address, sourceBit.bit, sourceBit.value, {
    for: [{ kind: "test.raw-bit-source-measurement", bitId: sourceBit.id, source: a.address }],
  });
  assert.equal(toldBit.subject, a.address);
  assert.equal(toldBit.predicate, 0);
  assert.equal(toldBit.object, 0);
  assert.equal(knowledgeReading(toldBit), "potential");
  assert.notEqual(cellAddress(toldBit), sourceBit.id,
    "Data's array-coordinate identity and SignCell's typed record-coordinate identity differ");

  // JSON.parse is a selected application-level interpretation of already-admitted
  // raw bytes here, NOT a default interpretation assigned by the byte substrate.
  const decodedA = JSON.parse(new TextDecoder().decode(markBytes(a)));
  const decodedB = JSON.parse(new TextDecoder().decode(markBytes(b)));
  assert.deepEqual(decodedA, decodedB);
  const pa = relationalValuePredications(decodedA, { resource: a.address, revision: "json-codec:1" });
  const pb = relationalValuePredications(decodedB, { resource: b.address, revision: "json-codec:1" });
  assert.equal(pa.payload, pb.payload,
    "a selected JSON interpretation yields equal canonical structured values despite different source bytes");
  assert.notEqual(pa.source.occurrence, pb.source.occurrence,
    "two raw sources still supply independently distinguishable occurrences");
  assert.equal(cellAddress(pa.edges[0]), cellAddress(pb.edges[0]),
    "shared structural predication identity does not require one raw-byte address");
  assert.notDeepEqual(pa.edges[0].for, pb.edges[0].for,
    "a same-SPO coordinate does not erase independent underlying source representations");
  assert.ok(!pa.cells.some(c => c.predicate === "authorized" || c.predicate === "skos:exactMatch"),
    "structured decoding never fabricates rights or lexical equivalence");
  assert.throws(() => bitAt({ ...a }, 0), /admitted/,
    "an asserted source shape without the original held bytes is not an admitted bit source");
});
