import assert from "node:assert/strict";
import test from "node:test";
import {
  address, admitCell, cell, measured, presence, recordOf, valueOf
} from "@red-cup-engineering/signcell/cell";
import { record } from "@red-cup-engineering/computer-data-engineering-services-section/four";
import { sourceRecordTowerFlowOfCells } from "../src/cell-graph.mjs";

// A native released-SignCell fixture for the consumer contract. This is NOT
// the unpublished SignCell ./charge-spin producer: cross-package integration
// must separately receive the fixed original SignCell version.
const towerFixture = (source) => {
  const original = admitCell(source);
  const tally = recordOf(original);
  const minimum = record(Number(tally.pos > 0), Number(tally.neg > 0));
  return Object.freeze({
    kind: "signcell.charge-record-tower.v1",
    sourceAddress: address(original), sourceCell: original,
    observedCharge: presence(original), valuedCharge: valueOf(original),
    measured: measured(original), record: tally, minimumRecord: minimum,
    retainedSurplus: record(tally.pos - minimum.pos, tally.neg - minimum.neg)
  });
};

test("original SignGraph accepts source-ordered record towers without erasing parallel presentations", () => {
  const a = cell("A", "rel", "B", { for: ["w1", "w2"], against: ["w3"] });
  const b = cell("A", "rel", "B", { for: ["w4"] });
  const reversed = cell("B", "rel", "A", { for: ["w5"] });
  const self = cell("C", "rel", "C", { for: ["w6"] });
  const graph = sourceRecordTowerFlowOfCells([a, b, reversed, self], towerFixture);
  assert.equal(graph.kind, "signgraph.source-record-tower-flow.v1");
  assert.equal(graph.entries.length, 4, "all four presentations are retained");
  assert.equal(graph.extensionalCells.length, 3, "only extensional source identities coincide");
  assert.equal(graph.flow.edges.length, 3, "the reflexive cell has zero oriented boundary");
  assert.deepEqual(graph.entries.map(x => x.sourceIndex), [0, 1, 2, 3]);
  assert.deepEqual(graph.entries[0].tower.record, record(2, 1));
  assert.deepEqual(graph.entries[0].tower.minimumRecord, record(1, 1));
  assert.deepEqual(graph.entries[0].tower.retainedSurplus, record(1, 0));
  assert.deepEqual(graph.entries[0].cell.against, ["w3"]);
  assert.equal(graph.entries[0].sourceAddress, graph.entries[1].sourceAddress,
    "same triple address does not identify two independent source presentations");
  assert.notEqual(graph.entries[0].sourceAddress, graph.entries[2].sourceAddress,
    "reversed predication remains distinct");
  assert.deepEqual(graph.flow.edges.map(x => [x.from, x.to]),
    [["A", "B"], ["A", "B"], ["B", "A"]]);
});

test("posited-value overrides stay distinct from measured evidence inside graph towers", () => {
  const declared = cell("S", "claims", "O", { for: ["source"], value: "absurd" });
  const graph = sourceRecordTowerFlowOfCells([declared], towerFixture);
  assert.equal(graph.entries[0].tower.observedCharge, "potential");
  assert.equal(graph.entries[0].tower.valuedCharge, "absurd");
  assert.equal(graph.entries[0].tower.measured, false);
  assert.deepEqual(graph.entries[0].tower.record, record(1, 0));
  assert.equal(graph.entries[0].cell.for.length, 1);
});

test("foreign, stale and corrupted tower projections refuse rather than enter a graph", () => {
  const source = cell("A", "rel", "B", { for: ["witness"] });
  const corruptions = [
    tower => ({ ...tower, sourceAddress: "ni:forged" }),
    tower => ({ ...tower, sourceCell: cell("A", "rel", "B", { against: ["other"] }) }),
    tower => ({ ...tower, record: record(500, 0) }),
    tower => ({ ...tower, minimumRecord: record(0, 0) }),
    tower => ({ ...tower, retainedSurplus: record(1, 0) }),
    tower => ({ ...tower, observedCharge: "stable" }),
    tower => ({ ...tower, valuedCharge: "stable" }),
    tower => ({ ...tower, kind: "foreign.tower" })
  ];
  for (const mutate of corruptions) {
    assert.throws(() => sourceRecordTowerFlowOfCells([source], c => mutate(towerFixture(c))),
      /rejected foreign, stale or inconsistent/u);
  }
});

test("only a bounded list of actual source cells and an actual producer can be admitted", () => {
  const good = cell("A", "rel", "B", { for: ["w1"] });
  assert.throws(() => sourceRecordTowerFlowOfCells([], towerFixture), /1..1024/u);
  assert.throws(() => sourceRecordTowerFlowOfCells(new Array(1025).fill(good), towerFixture), /1..1024/u);
  assert.throws(() => sourceRecordTowerFlowOfCells([good]), /source-owned SignCell tower reader/u);
  assert.throws(() => sourceRecordTowerFlowOfCells([good], () => ({ kind: "other" })),
    /rejected foreign, stale or inconsistent/u);
  assert.throws(() => sourceRecordTowerFlowOfCells([{ not: "a cell" }], towerFixture));
});
