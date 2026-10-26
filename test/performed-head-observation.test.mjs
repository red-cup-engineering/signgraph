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
  transportPerformedSemioverseClaim, assessPerformedBoundaryFactorization, readPerformedKinematicSectionSpace,
  readPerformedCellularCover,
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


test("portable JSON Semioverse readouts retain original occurrence indices without granting composition authority", () => {
  const original = derivePerformedHeadShadow({ articulating: performedSource(), steps: 3 });
  const transported = JSON.parse(JSON.stringify(original));
  const p = transported.kinematic.points.findIndex(point =>
    point.lowerEventIndex === 0 && point.upperEventIndex === 1);
  const q = transported.kinematic.points.findIndex(point =>
    point.lowerEventIndex === 1 && point.upperEventIndex === 2);
  const claim = transported.semioverse.claimEntries.find(entry =>
    entry.firstOccurrenceIndex === 0 && entry.secondOccurrenceIndex === 1);
  assert.deepEqual(readPerformedSemioverseFiber(transported, p),
    readPerformedSemioverseFiber(original, p));
  assert.deepEqual(transportPerformedSemioverseClaim(transported,p,q,claim.claimIndex),
    transportPerformedSemioverseClaim(original,p,q,claim.claimIndex));
  const source = derivePerformedObservationRoutes({ articulating: performedSource(), steps: 3 });
  const first = source.paths.find(x => x.first === 0 && x.last === 1);
  const second = source.paths.find(x => x.first === 1 && x.last === 2);
  assert.throws(() => composePerformedObservationRoutes(structuredClone(source), first, second),
    /original generated observation routes/,
    "a serialized readout cannot masquerade as the live original compositional authority");
});

test("portable source readers require every original ordered pair at its canonical coordinate", () => {
  const original = derivePerformedHeadShadow({ articulating: performedSource(), steps: 2 });
  const rows = original.semioverse.claimEntries.map(entry => ({
    claimIndex: entry.claimIndex, requiredClass: "portable",
  }));
  const region = original.kinematic.points.map((_point, index) => index);
  const readers = [
    view => readPerformedSemioverseFiber(view, 0),
    view => transportPerformedSemioverseClaim(view, 0, 0, 0),
    view => readPerformedCellularCover(view, 0, [{
      pointIndex: 0, coveredClaimIndices: [0], selectedClaimIndices: [0],
    }]),
    view => readPerformedKinematicSectionSpace(view, { patches: [region] }),
    view => assessPerformedBoundaryFactorization(view, rows),
  ];
  const mutations = [
    ["a repeated pair hidden behind a different claim index", semi => {
      semi.claimEntries[1] = { ...semi.claimEntries[0], claimIndex: 1 };
    }],
    ["a missing pair", semi => { semi.claimEntries.pop(); }],
    ["a repeated claim index", semi => { semi.claimEntries[1].claimIndex = 0; }],
    ["source pair order changed without its coordinate", semi => {
      [semi.claimEntries[0], semi.claimEntries[1]] = [semi.claimEntries[1], semi.claimEntries[0]];
      semi.claimEntries[0].claimIndex = 0;
      semi.claimEntries[1].claimIndex = 1;
    }],
    ["an absent source occurrence", semi => {
      semi.claimEntries[0].firstOccurrenceIndex = -1;
      delete semi.claimEntries[0].firstOccurrenceId;
    }],
    ["a fractional source occurrence", semi => { semi.claimEntries[0].secondOccurrenceIndex = 0.5; }],
    ["an occurrence identifier from a different source", semi => {
      semi.claimEntries[0].firstOccurrenceId = "not-the-original-source";
    }],
    ["an incomplete source identity table", semi => { semi.sourceEventIds[1] = semi.sourceEventIds[0]; }],
  ];
  for (const [reason, mutate] of mutations) {
    const transported = structuredClone(original);
    mutate(transported.semioverse);
    for (const read of readers)
      assert.throws(() => read(transported), /complete original|inconsistent original/u, reason);
  }
  // A normal JSON readout is still admissible, including distinct source
  // occurrences whose extensional claim addresses happen to agree.
  const portable = JSON.parse(JSON.stringify(original));
  assert.ok(new Set(portable.semioverse.claimEntries.map(entry => entry.claimAddress)).size
    < portable.semioverse.claimEntries.length);
  for (const read of readers) assert.deepEqual(read(portable), read(original));
  assert.equal(assessPerformedBoundaryFactorization(portable, rows).authority, "none");
});

test("a previously read portable incidence is checked again after mutation", () => {
  const portable = structuredClone(derivePerformedHeadShadow({
    articulating: performedSource(), steps: 2,
  }));
  assert.equal(readPerformedSemioverseFiber(portable, 0).entries.length, 4);
  portable.semioverse.claimEntries[1] = { ...portable.semioverse.claimEntries[0], claimIndex: 1 };
  assert.throws(() => readPerformedSemioverseFiber(portable, 0), /inconsistent original/u);
});


test("source-generated re-attention chain obeys finite fiber law without licensing ghost moves", () => {
  // Metrologic's independent degree/fiber oracle is conditional mathematics.
  // Here SignGraph must first generate every edge and equal head from the
  // SAME original performed Articulating, then refuse source authority for
  // every image-only composition. Source-native runner still needs the exact
  // upstream package to be published and installed.
  for (let n = 0; n <= 6; n++) {
    const view = derivePerformedHeadShadow({ articulating: performedSource(), steps: n });
    const edges = view.originalSourceSteps;
    const image = view.observedTwoStepComposites;
    assert.equal(edges.length, n);
    assert.equal(image.length, n ** 2, `observed C at n=${n}`);
    assert.equal(view.originalCompositions, Math.max(0, n - 1), `source L at n=${n}`);
    assert.equal(view.ghostCompositions, n * n - Math.max(0, n - 1), `ghost G at n=${n}`);
    const exact = [];
    const observed = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const pair = image[i * n + j];
        const composable = i + 1 === j;
        observed.push(pair.sourceStepAddresses);
        assert.equal(pair.sourceComposable, composable);
        assert.equal(pair.ghostObservationOnly, !composable);
        assert.equal(pair.licensedSourceComposite !== null, composable,
          `image pair ${i},${j} at n=${n} has no invented source permission`);
        if (composable) exact.push([edges[i].address, edges[j].address]);
      }
    }
    assert.deepEqual(observed, edges.flatMap(left => edges.map(right =>
      [left.address, right.address])));
    assert.deepEqual(image.filter(pair => pair.sourceComposable)
      .map(pair => pair.sourceStepAddresses), exact);
  }
});

test("source-indexed receiving requirements descend through a boundary only when all its fibers agree", () => {
  const view = derivePerformedHeadShadow({ articulating: performedSource(), steps: 3 });
  const readings = view.semioverse.claimEntries.map(entry => ({
    claimIndex: entry.claimIndex, requiredClass: "portable",
  }));
  const yes = assessPerformedBoundaryFactorization(view, readings);
  assert.equal(yes.status, "conditional-factorization-on-finite-source");
  assert.equal(yes.sourceClaimCount, view.semioverse.claimEntries.length);
  assert.equal(yes.authority, "none");
  assert.equal(yes.settlement, "not-established");
  assert.ok(yes.observedBoundaryCount < yes.sourceClaimCount);
  assert.deepEqual(yes.obstructions, []);
  assert.equal(yes.necessaryRefinement.extraClasses, 0);
  assert.equal(yes.necessaryRefinement.minimumAdditionalTagBits, 0);
  const [one, later] = [2, 3].map(index => view.semioverse.claimEntries.find(e =>
    e.firstOccurrenceIndex === index && e.secondOccurrenceIndex === index));
  assert.equal(one.claimAddress, later.claimAddress);
  assert.notEqual(one.firstOccurrenceId, later.firstOccurrenceId);
  const selective = readings.map(row => row.claimIndex === later.claimIndex
    ? { ...row, requiredClass: "pinned" } : row);
  const no = assessPerformedBoundaryFactorization(view, selective);
  assert.equal(no.status, "source-distinction-obstructed");
  assert.equal(no.inducedBoundaryReadings, null);
  assert.ok(no.necessaryRefinement.extraClasses >= 1);
  assert.equal(no.necessaryRefinement.minimumAdditionalTagBits, 1);
  assert.equal(no.necessaryRefinement.standing,
    "proposed-minimal-distinction-only-not-disclosed-or-authorized");
  assert.ok(no.obstructions.some(witness =>
    witness.claimAddress === one.claimAddress &&
    witness.first.firstOccurrenceId !== witness.second.firstOccurrenceId));
  assert.equal(no.authority, "none");
});

test("boundary factorization refuses partial, duplicated, forged and noncanonical recipient readings", () => {
  const view = derivePerformedHeadShadow({ articulating: performedSource(), steps: 2 });
  const rows = view.semioverse.claimEntries.map(entry => ({
    claimIndex: entry.claimIndex, requiredClass: "unsettled",
  }));
  assert.throws(() => assessPerformedBoundaryFactorization(view, rows.slice(1)), /one recipient classification/);
  assert.throws(() => assessPerformedBoundaryFactorization(view, [...rows.slice(0, -1), rows[0]]),
    /unique, canonical/);
  assert.throws(() => assessPerformedBoundaryFactorization(view, rows.map((row,i) =>
    i === 1 ? { ...row, requiredClass: "an arbitrary string" } : row)), /canonical/);
  const forged = structuredClone(view);
  forged.semioverse.claimEntries[0].firstOccurrenceId = "not-source-generated";
  assert.throws(() => assessPerformedBoundaryFactorization(forged, rows), /inconsistent original/);
  const portable = structuredClone(view);
  assert.deepEqual(assessPerformedBoundaryFactorization(portable, rows),
    assessPerformedBoundaryFactorization(view, rows));
});

test("native boundary classification and bounded JSONL use the exact same performed source", () => {
  const input = { articulating: performedSource(), steps: 3 };
  const shadow = derivePerformedHeadShadow(input);
  const requiredReadings = shadow.semioverse.claimEntries.map(entry => ({
    claimIndex: entry.claimIndex, requiredClass: "source-permitted",
  }));
  const id = "signgraph.mark-incidence.boundary-factorization";
  const direct = executeOperation(id, { ...input, requiredReadings });
  assert.deepEqual(direct, assessPerformedBoundaryFactorization(shadow, requiredReadings));
  assert.equal(direct.authority, "none");
  assert.equal(direct.status, "conditional-factorization-on-finite-source");
  const runner = fileURLToPath(new URL("../scripts/holonomy.mjs", import.meta.url));
  const invoked = spawnSync(process.execPath, [runner], {
    input: JSON.stringify({ operation: id, input: { ...input, requiredReadings } }) + "\n",
    encoding: "utf8", maxBuffer: 1024 * 1024,
  });
  assert.equal(invoked.status, 0, invoked.stderr);
  const result = JSON.parse(invoked.stdout.trim());
  assert.equal(result.ok, true);
  assert.equal(result.operation, id);
  assert.deepEqual(result.receipt, direct);
  assert.throws(() => executeOperation(id, {
    ...input, requiredReadings: requiredReadings.slice(1),
  }), /one recipient classification/);
  assert.throws(() => executeOperation(id, {
    ...input, requiredReadings, unauthorized: true,
  }), /requires original Articulating/);
});

test("three distinct original performances behind one observed head require two local sidecar bits", () => {
  const view = derivePerformedHeadShadow({ articulating: performedSource(), steps: 3 });
  const originals = [2, 3, 4].map(n => view.semioverse.claimEntries.find(entry =>
    entry.firstOccurrenceIndex === n && entry.secondOccurrenceIndex === n));
  assert.equal(new Set(originals.map(x => x.claimAddress)).size, 1);
  assert.equal(new Set(originals.map(x => x.firstOccurrenceId)).size, 3);
  const distinct = new Map(originals.map((entry,i) =>
    [entry.claimIndex, ["one","two","three"][i]]));
  const readings = view.semioverse.claimEntries.map(entry => ({
    claimIndex: entry.claimIndex,
    requiredClass: distinct.get(entry.claimIndex) ?? "one",
  }));
  const result = assessPerformedBoundaryFactorization(view, readings);
  assert.equal(result.status, "source-distinction-obstructed");
  const relevant = result.necessaryRefinement.groups.filter(row =>
    row.claimAddress === originals[0].claimAddress);
  assert.equal(relevant.length, 3);
  assert.deepEqual(relevant.map(row => row.classIndexWithinBoundary), [0,1,2]);
  assert.equal(result.necessaryRefinement.maxClassesPerBoundary, 3);
  assert.equal(result.necessaryRefinement.minimumAdditionalTagBits, 2);
  const flattened = relevant.flatMap(row => row.sourceClaimIndices);
  for (const source of originals) assert.ok(flattened.includes(source.claimIndex));
  assert.equal(result.authority, "none");
  assert.equal(result.settlement, "not-established");
});


test("actual source-generated cellular L-Space cover operation returns source occurrence triples, not a fictional backward witness",()=>{
  const articulating=performedSource(),steps=2;
  const shadow=derivePerformedHeadShadow({articulating,steps});
  const targetPointIndex=shadow.kinematic.points.length-1;
  const all=readPerformedSemioverseFiber(shadow,targetPointIndex)
    .entries.map(entry=>entry.claimIndex);
  const input={articulating,steps,targetPointIndex,
    patches:[
      {pointIndex:targetPointIndex,coveredClaimIndices:all.filter((_,i)=>i%2===0),
        selectedClaimIndices:all.filter((_,i)=>i%2===0)},
      {pointIndex:targetPointIndex,coveredClaimIndices:all.filter((_,i)=>i%2===1),
        selectedClaimIndices:all.filter((_,i)=>i%2===1)},
    ]};
  const result=executeOperation("signgraph.mark-incidence.performed-cellular-cover",input);
  assert.equal(result.status,"glued-conditional-section");
  assert.equal(result.complete,true);
  assert.equal(result.compatible,true);
  assert.deepEqual(result.globalSection.map(row=>row.claimIndex),all);
  assert.equal(result.globalSection.every(row=>row.firstOccurrenceId && row.secondOccurrenceId),true);
  assert.equal(result.scope.includes("not full sheafification"),true);

  const earlier=shadow.kinematic.sequencing.find(edge=>
    edge.child===targetPointIndex)?.parent;
  if(earlier!==undefined){
    const old=readPerformedSemioverseFiber(shadow,earlier).entries.map(row=>row.claimIndex);
    const partial=executeOperation("signgraph.mark-incidence.performed-cellular-cover",{
      articulating,steps,targetPointIndex,
      patches:[{pointIndex:earlier,coveredClaimIndices:old,selectedClaimIndices:old}],
    });
    assert.equal(partial.complete,false);
    assert.equal(partial.globalSection,null);
    assert.ok(partial.uncovered.length>0);
    const incompatible=executeOperation("signgraph.mark-incidence.performed-cellular-cover",{
      articulating,steps,targetPointIndex,
      patches:[
        {pointIndex:earlier,coveredClaimIndices:old.slice(0,1),
          selectedClaimIndices:old.slice(0,1)},
        {pointIndex:targetPointIndex,coveredClaimIndices:all,
          selectedClaimIndices:all.slice(1)},
      ],
    });
    assert.equal(incompatible.compatible,false);
    assert.ok(incompatible.incompatibleOverlaps.some(item=>
      item.firstOccurrenceId && item.secondOccurrenceId));
    assert.equal(incompatible.globalSection,null);
  }
});


test("one source-published kinematic operation has one actual schema and executor",()=>{
  const ids=Object.values(operations).map(op=>op.id);
  assert.equal(new Set(ids).size,ids.length,
    "an operation name cannot select two incompatible schema/dispatch implementations");
  assert.equal(ids.filter(id=>id==="signgraph.mark-incidence.kinematic-section-descent").length,1);
  assert.ok(operations.performedKinematicSections?.inputSchema?.properties?.patches);
  assert.equal("generatedKinematicSections" in operations,false,
    "do not expose an unreachable duplicate registry entry");
});

test("the original performed source yields a genuine gluable coherent kinematic hypertensor",()=>{
  // Not a freely authored graph/trace: the actual original SignCell
  // constructor is used by the owning SignGraph source generator.
  const performed={articulating:performedSource(),steps:2};
  const shadow=derivePerformedHeadShadow(performed);
  const region=shadow.kinematic.points.map((_p,i)=>i);
  const sourceSection=region.map(pointIndex=>({pointIndex,claimIndex:0}));
  const matched=executeOperation("signgraph.mark-incidence.kinematic-section-descent",{
    ...performed,patches:[region,region],
    sections:[sourceSection,sourceSection],
  });
  assert.equal(matched.status,"original-source-sections-glued");
  assert.equal(matched.gluedSection.length,region.length);
  assert.deepEqual(matched.gluedSection.map(x=>x.claimIndex),
    region.map(()=>0));
  const hypertensor=matched.sourceIncidenceHypertensor;
  assert.equal(hypertensor.originalOccurrenceIds.length,
    shadow.semioverse.sourceEventIds.length);
  const mathematicallyExpected=shadow.kinematic.points.reduce((n,p)=>
    n+(p.upperEventIndex+1)**2,0);
  assert.equal(hypertensor.nonzeroIncidences,String(mathematicallyExpected));
  assert.equal(hypertensor.metrologicFactorReceipt.nonzeroIncidences,
    hypertensor.nonzeroIncidences);
  assert.ok(hypertensor.cpRankUpperBound<=shadow.semioverse.sourceEventIds.length);
  assert.equal(matched.customerSettlement,"not-established");
  const second=region.map(pointIndex=>({pointIndex,claimIndex:1}));
  const opposed=readPerformedKinematicSectionSpace(shadow,{
    patches:[region,region],sections:[sourceSection,second],
  });
  assert.equal(opposed.status,"overlap-obstructed");
  assert.equal(opposed.gluedSection,null);
  assert.equal(opposed.overlapObstructions[0].leftClaimIndex,0);
  assert.equal(opposed.overlapObstructions[0].rightClaimIndex,1);
});
