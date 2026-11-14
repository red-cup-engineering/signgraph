import assert from "node:assert/strict";
import test from "node:test";
import { cell } from "@red-cup-engineering/signcell/cell";
import { site, specializationMorphism, transportRules } from "@red-cup-engineering/signgraph/site";

test("Specialization transport states one rule each way for a specialized cell whose general cell is in the site.", () => {
  const special = cell("a", "parent-of", "b"), general = cell("a", "related-to", "b"), lone = cell("c", "parent-of", "d");
  const rules = transportRules(site([special, general, lone], [specializationMorphism("parent-of", "related-to")]));
  assert.deepEqual(rules.map((r) => r.name).sort(), [
    `specialization-against:${JSON.stringify(["a", "related-to", "parent-of", "b"])}`,
    `specialization-for:${JSON.stringify(["a", "parent-of", "related-to", "b"])}`,
  ]);
});

test("Specialization transport over a large site is indexed, not a scan per cell.", () => {
  const cells = [];
  for (let i = 0; i < 4000; i++) cells.push(cell(`s${i}`, "parent-of", `o${i}`), cell(`s${i}`, "related-to", `o${i}`));
  const started = performance.now();
  const rules = transportRules(site(cells, [specializationMorphism("parent-of", "related-to")]));
  assert.equal(rules.length, 8000);
  assert.ok(performance.now() - started < 20000, "transport over 8000 cells finishes well inside a quadratic scan's time");
});
