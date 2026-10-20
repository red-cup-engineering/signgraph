import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { utterance, articulatingUtter, articulatingPair, reattendArticulating } from "@red-cup-engineering/signcell/utterance";
import { articulatedPredications } from "@red-cup-engineering/signcell/predication";
import { address as cellAddress } from "@red-cup-engineering/signcell/cell";
import {
  derivePerformedHeadShadow, derivePerformedObservationRoutes,
  composePerformedObservationRoutes, readPerformedSemioverseFiber,
  transportPerformedSemioverseClaim,
} from "../src/mark-gluing.mjs";
import { executeOperation, operations } from "../src/operations.mjs";

function performedSource() {
  const floor = utterance("a", "ground");
  const later = utterance("b", "claim");
  return articulatingPair(later, articulatingUtter(floor));
}
const operation = "signgraph.mark-incidence.performed-head-shadow";

test("one native re-attention creates one visible loop but not a repeated original move", () => {
  const a = performedSource();
  const view = derivePerformedHeadShadow({ articulating: a, steps: 1 });
  assert.equal(view.kind, "signgraph.performedHeadObservationShadow.v1");
  assert.equal(view.originalSourceNodes.length, 2);
  assert.equal(view.originalSourceSteps.length, 1);
  assert.equal(view.observedHeads.length, 1);
  assert.equal(view.originalCompositions, 0);
  assert.equal(view.ghostCompositions, 1);
  const single = view.observedTwoStepComposites[0];
  assert.equal(single.ghostObservationOnly, true);
  assert.equal(single.sourceComposable, false);
  assert.equal(single.licensedSourceComposite, null);
  assert.notEqual(single.originalEndpointRouteExists, null,
    "another source arrow with the same endpoints does not license doubling the original edge");
  assert.equal(single.observedFrom, single.observedTo);
  assert.equal(view.observationAuthority.startsWith("none:"), true);
  assert.equal(view.observationalQuotient.justifiedLeanWits, null);
});

test("three source steps create exactly two permitted length-two source paths, plus seven ghost image paths", () => {
  const view = derivePerformedHeadShadow({ articulating: performedSource(), steps: 3 });
  assert.equal(view.originalSourceNodes.length, 4);
  assert.equal(view.originalSourceSteps.length, 3);
  assert.equal(view.observedTwoStepComposites.length, 9);
  assert.equal(view.originalCompositions, 2);
  assert.equal(view.ghostCompositions, 7);
  const accepted = view.observedTwoStepComposites.filter(pair => pair.sourceComposable);
  assert.deepEqual(accepted.map(p => p.sourceStepAddresses),
    [[view.originalSourceSteps[0].address, view.originalSourceSteps[1].address],
      [view.originalSourceSteps[1].address, view.originalSourceSteps[2].address]]);
  assert.ok(accepted.every(pair => pair.licensedSourceComposite !== null));
  const reverse = view.observedTwoStepComposites.find(pair =>
    pair.sourceStepAddresses[0] === view.originalSourceSteps[2].address &&
    pair.sourceStepAddresses[1] === view.originalSourceSteps[0].address);
  assert.equal(reverse.ghostObservationOnly, true);
  assert.equal(reverse.originalEndpointRouteExists, null,
    "reverse image path has no original source morphism between its endpoints");
  assert.equal(reverse.licensedSourceComposite, null);
});

test("the original source route and associativity remain preserved, not overridden by the shadow", () => {
  const input = { articulating: performedSource(), steps: 3 };
  const s = derivePerformedObservationRoutes(input);
  const [first, second, third] = [
    s.paths.find(p => p.first === 0 && p.last === 1),
    s.paths.find(p => p.first === 1 && p.last === 2),
    s.paths.find(p => p.first === 2 && p.last === 3),
  ];
  const ab = composePerformedObservationRoutes(s, first, second);
  const bc = composePerformedObservationRoutes(s, second, third);
  const left = composePerformedObservationRoutes(s, ab, third);
  const right = composePerformedObservationRoutes(s, first, bc);
  assert.strictEqual(left, right);
  const shadow = derivePerformedHeadShadow(input);
  assert.equal(shadow.originalCompositions, 2);
  assert.throws(() => composePerformedObservationRoutes(s, second, first), /not composable/);
  assert.throws(() => composePerformedObservationRoutes(s, first, structuredClone(second)),
    /original generated observation routes/);
});

test("zero generated steps create neither ghost paths nor invented observed moves", () => {
  const shadow = derivePerformedHeadShadow({ articulating: performedSource(), steps: 0 });
  assert.equal(shadow.originalSourceNodes.length, 1);
  assert.equal(shadow.observedHeads.length, 1);
  assert.deepEqual(shadow.observedAtomicSteps, []);
  assert.deepEqual(shadow.observedTwoStepComposites, []);
  assert.equal(shadow.ghostCompositions, 0);
});

test("same native operation is externally callable through the existing bounded JSONL interface", () => {
  const input = { articulating: performedSource(), steps: 2 };
  const result = executeOperation(operation, input);
  assert.equal(operations.performedHeadShadow.id, operation);
  assert.equal(result.ghostCompositions, 3);
  assert.equal(result.originalCompositions, 1);
  const runner = fileURLToPath(new URL("../scripts/holonomy.mjs", import.meta.url));
  const invoked = spawnSync(process.execPath, [runner], {
    input: JSON.stringify({ operation, input }) + "\n",
    encoding: "utf8", maxBuffer: 1024 * 1024,
  });
  assert.equal(invoked.status, 0, invoked.stderr);
  const line = JSON.parse(invoked.stdout.trim());
  assert.equal(line.ok, true);
  assert.equal(line.operation, operation);
  assert.equal(line.receipt.ghostCompositions, 3);
  assert.equal(line.receipt.originalCompositions, 1);
});

test("no user can supply a shadow map, forged source graph or fake authorization", () => {
  const source = performedSource();
  assert.throws(() => executeOperation(operation, {
    articulating: source, steps: 2,
    observedNodes: ["arbitrary"], originalGraph: [], authority: "operator",
  }), /only admits Articulating/);
  assert.throws(() => executeOperation(operation, { articulating: source, steps: 7 }),
    /zero to six/);
  assert.throws(() => executeOperation(operation, { articulating: source, steps: -1 }),
    /zero to six/);
  assert.throws(() => executeOperation(operation, {
    articulating: { kind: "articulating.pair", utterance: "invented" },
  }), /native ordered Mark roles/);
});


test("the SAME performed Articulating generates kinematic diamond points by endpoint sequencing, not nested intervals", () => {
  const shadow = derivePerformedHeadShadow({ articulating: performedSource(), steps: 3 });
  const K = shadow.kinematic;
  assert.equal(K.kind, "signgraph.performedArticulatingKinematicReadout.v1");
  assert.equal(K.sourceEventIds.length, 5,
    "two original prefix acts plus three source-generated re-attendings");
  assert.equal(new Set(K.sourceEventIds).size, 5);
  assert.equal(K.points.length, 10);
  assert.equal(new Set(K.points.map(x =>
    x.lowerArticulatingId + ":" + x.upperArticulatingId)).size, 10);
  const index = (a, b) => K.points.findIndex(p =>
    p.lowerEventIndex === a && p.upperEventIndex === b);
  assert.ok(index(0, 1) >= 0);
  assert.ok(index(1, 2) >= 0);
  assert.ok(K.sequencing.some(edge =>
    edge.parent === index(0, 1) && edge.child === index(1, 2)));
  // Set nesting does NOT generate kinematic precedence.
  assert.equal(K.sequencing.some(edge =>
    edge.parent === index(0, 4) && edge.child === index(1, 2)), false);
  assert.equal(K.sequencing.some(edge =>
    edge.parent === index(1, 2) && edge.child === index(0, 4)), false);
  assert.equal(K.scope.includes("not a physical metric"), true);
});


test("finite Semioverse draws all ordered occurrence pairs from the existing SignCell generator", () => {
  const view = derivePerformedHeadShadow({ articulating: performedSource(), steps: 3 });
  const K = view.kinematic, L = view.lspace, S = view.semioverse;
  assert.equal(K.sourceEventIds.length, 5);
  assert.equal(S.claimEntries.length, 25);
  assert.equal(S.loci.length, K.points.length);
  assert.deepEqual(S.sourceEventIds, L.sourceEventIds);
  assert.equal(S.continuedSourceId, view.continuedSourceId);
  assert.deepEqual([...new Set(S.claimEntries.map(entry => entry.claimIndex))].length, 25);
  const last = readPerformedSemioverseFiber(view, K.points.length - 1);
  assert.equal(last.entries.length, 25);
  assert.equal(last.point.upperEventIndex, 4);
  const first = readPerformedSemioverseFiber(view, 0);
  assert.equal(first.entries.length, 4);
  assert.equal(first.point.upperEventIndex, 1);
  assert.equal(S.loci[0].admittedClaimCount, first.entries.length);
  const pair = S.claimEntries.find(entry =>
    entry.firstOccurrenceIndex === 1 && entry.secondOccurrenceIndex === 2);
  const repeated = S.claimEntries.find(entry =>
    entry.firstOccurrenceIndex === 2 && entry.secondOccurrenceIndex === 1);
  assert.notEqual(pair.claimIndex, repeated.claimIndex);
  assert.equal(pair.firstOccurrenceId, L.sourceEventIds[1]);
  assert.equal(pair.secondOccurrenceId, L.sourceEventIds[2]);
  assert.equal(typeof pair.claimAddress, "string");
});

test("Semioverse source-paired claims lift forward only along original K(C) endpoint sequencing", () => {
  const view = derivePerformedHeadShadow({ articulating: performedSource(), steps: 3 });
  const p = view.kinematic.points.findIndex(point =>
    point.lowerEventIndex === 0 && point.upperEventIndex === 1);
  const q = view.kinematic.points.findIndex(point =>
    point.lowerEventIndex === 1 && point.upperEventIndex === 2);
  const claim = view.semioverse.claimEntries.find(entry =>
    entry.firstOccurrenceIndex === 0 && entry.secondOccurrenceIndex === 1);
  const moved = transportPerformedSemioverseClaim(view, p, q, claim.claimIndex);
  assert.equal(moved.fromPointIndex, p);
  assert.equal(moved.toPointIndex, q);
  assert.equal(moved.claimIndex, claim.claimIndex);
  assert.equal(moved.claimAddress, claim.claimAddress);
  assert.equal(moved.firstOccurrenceId, claim.firstOccurrenceId);
  assert.equal(moved.secondOccurrenceId, claim.secondOccurrenceId);
  const identity = transportPerformedSemioverseClaim(view, p, p, claim.claimIndex);
  assert.equal(identity.claimAddress, claim.claimAddress);
  assert.throws(() => transportPerformedSemioverseClaim(view, q, p, claim.claimIndex),
    /kinematic endpoint sequencing/);
  const future = view.semioverse.claimEntries.find(entry =>
    entry.firstOccurrenceIndex === 2 && entry.secondOccurrenceIndex === 2);
  assert.throws(() => transportPerformedSemioverseClaim(view, p, q, future.claimIndex),
    /cannot backdate/);
});

test("equal head presentations do not collapse repeated performed Semioverse occurrences", () => {
  const view = derivePerformedHeadShadow({ articulating: performedSource(), steps: 3 });
  const E = view.semioverse.claimEntries;
  const first = E.find(x => x.firstOccurrenceIndex === 2 && x.secondOccurrenceIndex === 2);
  const later = E.find(x => x.firstOccurrenceIndex === 3 && x.secondOccurrenceIndex === 3);
  assert.equal(first.claimAddress, later.claimAddress,
    "observationally identical claims share a presentation address");
  assert.notEqual(first.firstOccurrenceId, later.firstOccurrenceId,
    "the producing performances are distinct original causal occurrences");
  assert.notEqual(first.claimIndex, later.claimIndex);
  assert.equal(view.semioverse.scope.includes("not all FOAM evidence"), true);
});

test("an index cannot fabricate a kinematic locus or Semioverse source claim", () => {
  const view = derivePerformedHeadShadow({ articulating: performedSource(), steps: 2 });
  const n = view.kinematic.points.length;
  assert.throws(() => readPerformedSemioverseFiber(view, n), /existing kinematic point/);
  assert.throws(() => readPerformedSemioverseFiber(view, -1), /existing kinematic point/);
  assert.throws(() => transportPerformedSemioverseClaim(view, 0, 0, 10000),
    /genuine original claim occurrence/);
});


test("SignGraph finite Semioverse is an exact projection of SignCell's original full source pair composition", () => {
  const original = performedSource();
  let continued = original;
  for (let i = 0; i < 3; i++)
    continued = reattendArticulating(continued, { maxLayers: 16 }).presented;
  const originalClaims = articulatedPredications(continued, { maxLayers: 16 });
  const shadow = derivePerformedHeadShadow({ articulating: original, steps: 3 });
  const corresponding = originalClaims.entries.map((entry, claimIndex) => ({
    claimIndex,
    firstOccurrenceIndex: entry.subjectOccurrence,
    secondOccurrenceIndex: entry.objectOccurrence,
    claimAddress: cellAddress(entry.cell),
  }));
  assert.deepEqual(shadow.semioverse.claimEntries.map(entry => ({
    claimIndex: entry.claimIndex,
    firstOccurrenceIndex: entry.firstOccurrenceIndex,
    secondOccurrenceIndex: entry.secondOccurrenceIndex,
    claimAddress: entry.claimAddress,
  })), corresponding);
  assert.equal(shadow.semioverse.claimEntries.length,
    originalClaims.sourceOrdinal.length ** 2);
});
