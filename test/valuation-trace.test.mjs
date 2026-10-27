import test from "node:test";
import assert from "node:assert/strict";
import { cell, cellSet, knowledgeReading, measured, semanticId } from "@red-cup-engineering/signcell/cell";
import { site } from "../src/site.mjs";
import {
  posit, withTrace, lastValuation, evidenceAt,
  presentPresheaf, freePresheaf,
} from "../src/valuation.mjs";

const original = cell("institution", "acknowledges", "claim");
const contrary = cell("institution", "refutes", "claim");
const witness = (source, pole = "for") => cell(
  original.subject, original.predicate, original.object,
  pole === "for" ? { for: [source] } : { against: [source] },
);

test("later evidence remains on the same original site and source history persists", () => {
  const base = site([original]);
  const first = posit(base, [witness("source-A")]);
  const second = withTrace(first, [witness("source-B", "against")]);
  assert.equal(second.kind, "signgraph.presheaf");
  assert.equal(second.site, first.site, "a trace does not replace its parent site");
  assert.equal(first.traces.length, 1, "extending never mutates a prior source");
  assert.equal(second.traces.length, 2);
  assert.equal(evidenceAt(first.traces[0], original).for.length, 1);
  assert.equal(evidenceAt(lastValuation(second), original).against.length, 1);
  assert.deepEqual(second.traces[0], first.traces[0]);
  assert.equal(Object.isFrozen(second), true);
  assert.equal(Object.isFrozen(second.traces), true);
});

test("withTrace refuses an unrelated site before it can fabricate a sheaf section", () => {
  const base = site([original]);
  const first = posit(base, [witness("source-A")]);
  assert.throws(() => posit(base, [contrary]), /valuation tells a cell outside its site/);
  assert.throws(() => withTrace(first, [contrary]), /valuation tells a cell outside its site/);
  assert.equal(first.traces.length, 1);
  assert.equal(lastValuation(first)[0].predicate, original.predicate);
});

test("an empty second reading is lawful and an invalid carrier cannot become a trace", () => {
  const first = posit(site([original]), [witness("source")]);
  const second = withTrace(first, []);
  assert.equal(second.traces[1].length, 0);
  assert.throws(() => withTrace({ kind: "signgraph.presheaf", site: first.site, traces: [] }, []), /existing posited presheaf/);
  assert.throws(() => withTrace(null, []), /existing posited presheaf/);
  const presented = presentPresheaf(first);
  assert.equal(freePresheaf(presented).traces.length, 1);
});

test("posit retains every witness/value combination, including untold and unmeasured source cells", () => {
  const subject = { resource: "urn:requirement:source", revision: [1, 2] };
  const predicate = ["satisfies", { condition: "original" }];
  const object = new Uint8Array([0, 128, 255]);
  const base = site([cell(subject, predicate, object)]);
  const forWitness = { resource: "urn:assay:positive", revision: "v1" };
  const againstWitness = { resource: "urn:assay:negative", revision: "v2" };
  for (const positive of [false, true]) for (const negative of [false, true]) {
    for (const value of ["absurd", "potential", "active", "stable"]) {
      const at = cell(subject, predicate, object, {
        for: positive ? [forWitness] : [], against: negative ? [againstWitness] : [], value,
      });
      const before = semanticId(at);
      const result = posit(base, [at]);
      assert.equal(result.site, base);
      assert.deepEqual(result.traces[0], cellSet([at]));
      assert.equal(knowledgeReading(result.traces[0][0]), value);
      assert.equal(measured(result.traces[0][0]), measured(at));
      assert.equal(semanticId(at), before);
    }
  }
});

test("posit uses opaque triple coincidence after transport and keeps duplicate witnesses joined natively", () => {
  const at = cell({ source: "record", fields: [1, "two"] }, { relation: "applies" },
    { revision: "v1", coordinate: 0 }, { for: [{ resource: "A", revision: "1" }] });
  const base = site([at]);
  const wire = JSON.parse(JSON.stringify(at));
  wire.subject = { fields: [1, "two"], source: "record" };
  wire.object = { coordinate: 0, revision: "v1" };
  const contrary = cell(wire.subject, wire.predicate, wire.object,
    { against: [{ resource: "B", revision: "2" }], value: "potential" });
  const supplied = [at, wire, contrary, cell(wire.subject, wire.predicate, wire.object)];
  assert.deepEqual(posit(base, supplied).traces[0], cellSet(supplied));
  assert.equal(posit(base, supplied).traces[0].length, 1);
});

test("every foreign triple coordinate is refused even when untold or carrying a written value", () => {
  const at = cell({ subject: "original" }, { predicate: "original" }, { object: "original" });
  const base = site([at]);
  const first = posit(base, [at]);
  for (const coordinate of ["subject", "predicate", "object"]) {
    const foreign = { ...at, [coordinate]: { foreign: coordinate } };
    for (const evidence of [{}, { for: ["source"] }, { against: ["counter-source"] }, { value: "stable" }]) {
      const outside = cell(foreign.subject, foreign.predicate, foreign.object, evidence);
      assert.throws(() => posit(base, [outside]),
        { name: "TypeError", message: "posit: the valuation tells a cell outside its site" });
      assert.throws(() => withTrace(first, [outside]),
        { name: "TypeError", message: "posit: the valuation tells a cell outside its site" });
    }
  }
  assert.deepEqual(first.traces, [cellSet([at])]);
});

test("membership reads a native site's source cells linearly for a complete valuation", () => {
  const valuation = Array.from({ length: 64 }, (_, index) =>
    cell({ source: index }, "observed", { revision: "r" + index }, { for: [{ assay: index }] }));
  const base = site(valuation);
  let sourceReads = 0;
  // Observe accesses without changing the actual source array or its native
  // Cell triples. This bound is deterministic; host timing is measured apart.
  const observed = new Proxy(base.cells, {
    get(target, key, receiver) {
      if (typeof key === "string" && /^(0|[1-9][0-9]*)$/u.test(key)) sourceReads++;
      return Reflect.get(target, key, receiver);
    },
  });
  const presented = { ...base, cells: observed };
  assert.deepEqual(posit(presented, valuation).traces[0], cellSet(valuation));
  assert.ok(sourceReads >= valuation.length, "all original source cells were observed");
  assert.ok(sourceReads <= 2 * valuation.length,
    `membership revisited ${sourceReads} source cells for ${valuation.length} tellings`);
});
