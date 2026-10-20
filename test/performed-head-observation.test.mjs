import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { utterance, articulatingUtter, articulatingPair } from "@red-cup-engineering/signcell/utterance";
import {
  derivePerformedHeadShadow, derivePerformedObservationRoutes,
  composePerformedObservationRoutes,
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
