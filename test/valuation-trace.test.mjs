import test from "node:test";
import assert from "node:assert/strict";
import { cell } from "@red-cup-engineering/signcell/cell";
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
