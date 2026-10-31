import assert from "node:assert/strict";
import test from "node:test";
import {
  address, admitCell, cell, measured, presence, recordOf, valueOf
} from "@red-cup-engineering/signcell/cell";
import { record, samePoint } from "@red-cup-engineering/computer-data-engineering-services-section/four";
import { at } from "@red-cup-engineering/metrologic/chu";
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

test("strict installed SignCell chargeRecordTowerOfCell produces the original Graph source-record tower", async () => {
  // Deliberately NOT a fixture and NOT a conditional skip. The real package
  // supplier MUST be published and selected before this proof-receiving gate
  // may turn green. Missing export means missing integration, not success.
  const {chargeRecordTowerOfCell} = await import("@red-cup-engineering/signcell/charge-spin");
  assert.equal(typeof chargeRecordTowerOfCell,"function",
    "the exact installed SignCell edition must export its native tower producer");
  const positive = cell("A","rel","B", {
    for:["original:witness-a","original:witness-b"],
    against:["original:opposition"],
  });
  const second = cell("A","rel","B", {for:["original:independent-presentation"]});
  const graph=sourceRecordTowerFlowOfCells([positive,second],chargeRecordTowerOfCell);
  assert.equal(graph.kind,"signgraph.source-record-tower-flow.v1");
  assert.equal(graph.entries.length,2,
    "two original source occurrences may coincide extensionally without being one performance");
  assert.equal(graph.extensionalCells.length,1);
  assert.equal(graph.flow.edges.length,2);
  assert.equal(graph.entries[0].sourceAddress,address(positive));
  assert.equal(graph.entries[1].sourceAddress,address(second));
  assert.deepEqual(graph.entries[0].tower.sourceCell.for,positive.for);
  assert.deepEqual(graph.entries[0].tower.sourceCell.against,positive.against);
  assert.deepEqual(graph.entries[0].tower.record,record(2,1));
  assert.deepEqual(graph.entries[0].tower.minimumRecord,record(1,1));
  assert.deepEqual(graph.entries[0].tower.retainedSurplus,record(1,0));
  assert.equal(graph.entries[0].tower.observedCharge,"stable");
  assert.equal(graph.entries[0].tower.valuedCharge,valueOf(positive));
  assert.ok(samePoint(at(graph.chu,positive,"source-evidence-charge"),"stable"));
  assert.equal("electricCharge" in graph.entries[0].tower,false,
    "the FOUR evidence tower does not manufacture physical electric charge");
  assert.equal("quantumSpin" in graph.entries[0].tower,false,
    "a finite FOUR readout is not quantum spin testimony");
});

test("original SignGraph accepts source-ordered record towers without erasing parallel presentations", () => {
  const a = cell("A", "rel", "B", { for: ["w1", "w2"], against: ["w3"] });
  const b = cell("A", "rel", "B", { for: ["w4"] });
  const reversed = cell("B", "rel", "A", { for: ["w5"] });
  const self = cell("C", "rel", "C", { for: ["w6"] });
  const graph = sourceRecordTowerFlowOfCells([a, b, reversed, self], towerFixture);
  assert.equal(graph.kind, "signgraph.source-record-tower-flow.v1");
  assert.equal(graph.entries.length, 4, "all four presentations are retained");
  assert.ok(samePoint(at(graph.chu, reversed, "source-evidence-charge"), "potential"));
  assert.ok(samePoint(at(graph.chu, a, "source-evidence-charge"), "stable"),
    "Chu extent merges witnesses at one triple while entries retain each original");

  assert.equal(graph.extensionalCells.length, 3, "only extensional source identities coincide");
  assert.equal(graph.flow.edges.length, 3, "the reflexive cell has zero oriented boundary");
  assert.deepEqual(graph.entries.map(x => x.sourceIndex), [0, 1, 2, 3]);
  assert.deepEqual(graph.entries[0].tower.record, record(2, 1));
  assert.deepEqual(graph.entries[0].tower.minimumRecord, record(1, 1));
  assert.deepEqual(graph.entries[0].tower.retainedSurplus, record(1, 0));
  assert.deepEqual(graph.entries[0].cell.against, ["w3"]);
  assert.equal(graph.entries[0].sourceAddress, graph.entries[1].sourceAddress,
    "same triple address does not collapse two supplied positions or certify independent performances");
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
  assert.ok(samePoint(at(graph.chu, declared, "source-evidence-charge"), "potential"));
  assert.ok(samePoint(at(graph.chu, declared, "posited-charge"), "absurd"));
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

test("equal-count, same-address foreign testimony refuses while canonical witness order is equivalent", () => {
  const source = cell("A", "rel", "B", {
    for: ["source:a", "source:b"], against: ["opposition:a"]
  });
  const sameAddressDifferentTestimony = [
    cell("A", "rel", "B", {
      for: ["source:a", "foreign:b"], against: ["opposition:a"]
    }),
    cell("A", "rel", "B", {
      for: ["source:a", "source:b"], against: ["foreign:opposition"]
    }),
  ];
  for (const foreign of sameAddressDifferentTestimony) {
    // Triple identity and the entire FOUR/Record readout remain unchanged;
    // only canonical source evidence identity distinguishes these claims.
    assert.equal(address(foreign), address(source));
    assert.deepEqual(recordOf(foreign), recordOf(source));
    assert.equal(presence(foreign), presence(source));
    assert.equal(valueOf(foreign), valueOf(source));
    assert.throws(
      () => sourceRecordTowerFlowOfCells([source], cell => ({
        ...towerFixture(cell), sourceCell: foreign
      })),
      /rejected foreign, stale or inconsistent source tower/u
    );
  }
  // Source equality is canonical content equality, not object reference or
  // the caller's order of witnesses: equivalent evidence remains admissible.
  const equivalent = cell("A", "rel", "B", {
    for: ["source:b", "source:a"], against: ["opposition:a"]
  });
  const accepted = sourceRecordTowerFlowOfCells([source], cell => ({
    ...towerFixture(cell), sourceCell: equivalent
  }));
  assert.equal(accepted.entries.length, 1);
  assert.deepEqual(accepted.entries[0].tower.sourceCell.for, source.for);
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

test("tower source cells reject accessor-backed arrays and non-cells before producer execution",()=>{
  const good=cell("A","rel","B",{for:["source-record"]});
  let calls=0,producers=0;
  const getter=()=>{calls++;throw Error("executed foreign getter");};
  const array=[good];
  Object.defineProperty(array,"0",{enumerable:true,get:getter});
  const source={subject:"A",predicate:"rel",object:"B",for:["source-record"],against:[]};
  Object.defineProperty(source,"subject",{enumerable:true,get:getter});
  const extra={...good};
  Object.defineProperty(extra,"role",{enumerable:true,get:getter});
  const forged={subject:"A",predicate:"rel",object:"B"};
  for(const input of [array,[source],[extra],[forged]]) {
    assert.throws(()=>sourceRecordTowerFlowOfCells(input,at=>{
      producers++;return towerFixture(at);
    }),/signcell:/u);
  }
  assert.equal(calls,0,"source getters must not execute");
  assert.equal(producers,0,"unadmitted source positions must never reach the native tower supplier");
});

test("tower result refuses forged authority, invisible or executable source attributes",()=>{
  const good=cell("A","rel","B",{for:["source-record"]});
  let calls=0;
  const getter=()=>{calls++;throw Error("executed foreign tower getter");};
  const original=towerFixture(good);
  const hidden={...original};
  Object.defineProperty(hidden,"authority",{value:"forged"});
  const extra={...original,claim:"invented"};
  const accessor={...original};
  Object.defineProperty(accessor,"sourceAddress",{enumerable:true,get:getter});
  const nested={...original,record:{...original.record}};
  Object.defineProperty(nested.record,"pos",{enumerable:true,get:getter});
  for(const forged of [hidden,extra,accessor,nested]) {
    assert.throws(()=>sourceRecordTowerFlowOfCells([good],()=>forged),
      /rejected foreign|accessors|inert|source/u);
  }
  assert.equal(calls,0,"no hidden producer field may execute as source evidence");
});

test("tower projection snapshots a mutable provider result without rewriting evidence or witness counts",()=>{
  const source=cell("A","rel","B",{for:["source-a"],against:["source-b"]});
  let offered;
  const reading=sourceRecordTowerFlowOfCells([source],at=>{
    const original=towerFixture(at);
    offered={...original,record:{...original.record},
      sourceCell:JSON.parse(JSON.stringify(original.sourceCell))};
    return offered;
  });
  const before=JSON.stringify(reading);
  offered.record.pos=999;
  offered.sourceCell.for[0]="forged-after-admission";
  offered.sourceAddress="ni:wrong";
  assert.equal(JSON.stringify(reading),before,
    "one issued tower cannot be retroactively rewritten by its producer");
  assert.deepEqual(reading.entries[0].cell.for,["source-a"]);
  assert.deepEqual(reading.entries[0].cell.against,["source-b"]);
  assert.equal(reading.flow.edges.length,1);
});
