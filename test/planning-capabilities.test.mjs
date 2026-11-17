import assert from "node:assert/strict";
import test from "node:test";
import { cell } from "@red-cup-engineering/signcell";
import { defineType } from "@red-cup-engineering/typed-content";
import { createTypedMark, referenceOf } from "@red-cup-engineering/typed-content";
import {
  createSignGraph, createSignGraphPredicateReader, inspectSignGraphKinds, querySignGraph,
} from "@red-cup-engineering/signgraph/semantic-graph";
import { readDependencyHorizon, readEndeavor, readWorkflow, rollupAttemptCosts } from "@red-cup-engineering/signgraph/dependency-cone";
import { dispatchFit, readWorkSettlement } from "@red-cup-engineering/signgraph/work-settlement";
import { compareSignGraphAlexandrov } from "@red-cup-engineering/signgraph/alexandrov";
import { regimeCost } from "@red-cup-engineering/metrologic/closure/regime";
import { finiteRead, namedLimitRead } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/ordinal-closure";
import { knowledgeLeqReading } from "@red-cup-engineering/metrologic/four";

function value(result) {
  assert.equal(result.ok, true, JSON.stringify(result.refusal));
  return result.value;
}

const type = (name) => value(defineType({
  id: "https://example.test/" + name, name, description: "Test " + name,
  parents: [], schema: { type: "string" },
}));
const work = type("work"), state = type("state"), attempt = type("attempt"), witnessType = type("witness");
const mark = (type, text) => value(createTypedMark(type, text));
const witness = mark(witnessType, "observed");
const declaration = (id, subjects = [work], objects = [work]) => ({
  id, subjectTypes: subjects.map(type => type.id), objectTypes: objects.map(type => type.id),
  witnessTypes: [witnessType.id],
});
const edge = (subject, predicate, object) => ({
  subject: referenceOf(subject), predicate, object: referenceOf(object), witness: referenceOf(witness),
});
const graphOf = (cells, relations, edges) => value(createSignGraph({ cells: [...cells, witness], relations, edges }));

test("specializations and converses are index reads with the original source edge", () => {
  const node = mark(work, "task"), resource = mark(state, "package");
  const relations = [
    declaration("acts-on", [work, attempt], [state]),
    declaration("modifies", [work], [state]), declaration("deploys", [work], [state]),
    declaration("affected-by", [state], [work, attempt]),
  ];
  const graph = graphOf([node, resource], relations, [edge(node, "deploys", resource)]);
  const nodeRef = referenceOf(node), resourceRef = referenceOf(resource);
  const reader = createSignGraphPredicateReader(structuredClone(graph), {
    specializations: [["deploys", "modifies"], ["modifies", "acts-on"]],
    converses: [["acts-on", "affected-by"]],
  });
  const [direct] = reader(nodeRef, "acts-on");
  assert.deepEqual(direct.source, querySignGraph(graph, nodeRef, "deploys")[0]);
  assert.equal(direct.edge.predicate, "acts-on");
  assert.deepEqual(reader(resourceRef, "affected-by", { object: nodeRef }), [{
    source: direct.source, reversed: true, edge: edge(resource, "affected-by", node),
  }]);
  assert.deepEqual(querySignGraph(graph, nodeRef, "acts-on"), []);
  assert.throws(() => createSignGraphPredicateReader(graph, {
    specializations: [["acts-on", "deploys"]],
  }), /endpoint types/);
  assert.throws(() => createSignGraphPredicateReader(graph, {
    converses: [["deploys", "affected-by"]],
  }), /reversed endpoint/);
});

test("kind extrema count paths over all declarations and keep structural sources and sinks separate", () => {
  const ab = declaration("starts", [work], [attempt]);
  const bc = declaration("ends", [attempt], [state]);
  const chain = value(createSignGraph({ cells: [], relations: [ab, bc], edges: [] }));
  assert.deepEqual(inspectSignGraphKinds(chain).initial, [work.id]);
  assert.deepEqual(inspectSignGraphKinds(chain).terminal, [state.id]);
  const shortcut = declaration("bypasses", [work], [state]);
  const loop = declaration("repeats", [state], [state]);
  for (const extra of [shortcut, loop]) {
    const graph = value(createSignGraph({ cells: [], relations: [ab, bc, extra], edges: [] }));
    const reading = inspectSignGraphKinds(graph, ["starts", "ends"]);
    assert.deepEqual(reading.sources, [work.id]);
    assert.deepEqual(reading.sinks, [state.id]);
    assert.deepEqual(reading.initial, []);
    assert.deepEqual(reading.terminal, []);
  }
});

const [plan, a, b, c, target] = ["plan", "a", "b", "c", "aim"].map(name => mark(work, name));
const [planRef, aRef, bRef, cRef, targetRef] = [plan, a, b, c, target].map(referenceOf);
const diamond = (predicate) => [
  edge(plan, predicate, a), edge(plan, predicate, b),
  edge(a, predicate, c), edge(b, predicate, c),
];

test("cost aggregation counts shared work once and preserves unknown completion cost", () => {
  const predicates = ["contains"];
  const attempts = [
    { id: "successful", work: cRef, cost: 7, successful: true },
    { id: "failed", work: cRef, cost: 3, successful: false },
    { id: "other-success", work: cRef, cost: 9, successful: true },
  ];
  const graph = graphOf([plan, a, b, c], [declaration("contains")], diamond("contains").reverse());
  const report = rollupAttemptCosts(graph, planRef, { predicates, attempts: [...attempts, attempts[0]] });
  assert.deepEqual(report, { upperBound: 19, cheapestSuccess: 7, attempts: 3, missing: [] });
  assert.deepEqual(rollupAttemptCosts(graph, aRef, { predicates, attempts }), report);
  assert.deepEqual(rollupAttemptCosts(graph, bRef, { predicates, attempts: attempts.toReversed() }), report);
  assert.equal(rollupAttemptCosts(graph, planRef, { predicates, attempts, required: [aRef, cRef] }).cheapestSuccess, null);
  assert.throws(() => rollupAttemptCosts(graph, planRef, {
    predicates, attempts: [...attempts, { ...attempts[0], cost: 18 }],
  }), /conflicting/);
});

test("causal height respects satisfied and blocked prerequisites and rejects cycles", () => {
  const predicates = ["depends-on"];
  const relations = [declaration(predicates[0])];
  const edges = diamond(predicates[0]);
  const graph = graphOf([plan, a, b, c], relations, edges);
  assert.deepEqual(readDependencyHorizon(graph, planRef, { predicates }), { height: 2, horizon: "Later" });
  assert.deepEqual(readDependencyHorizon(graph, planRef, { predicates, satisfied: [cRef] }), { height: 1, horizon: "Soon" });
  assert.deepEqual(readDependencyHorizon(graph, planRef, { predicates, blocked: [cRef] }), { height: Infinity, horizon: "Eventually" });
  const cyclic = graphOf([plan, a, b, c], relations, [...edges, edge(c, predicates[0], plan)]);
  assert.throws(() => readDependencyHorizon(cyclic, planRef, { predicates }), /cycle/);
});

test("endeavors retain component failures and attempts keep intent separate from observed outcome", () => {
  const journey = mark(attempt, "first attempt"), wanted = mark(state, "wanted"), observed = mark(state, "observed");
  const graph = graphOf([plan, a, b, c, target, journey, wanted, observed], [
    declaration("contains"), declaration("aim"),
    declaration("intends", [attempt], [state]), declaration("realized", [attempt], [state]),
  ], [...diamond("contains"), edge(plan, "aim", target), edge(journey, "intends", wanted), edge(journey, "realized", observed)]);
  const selected = { contains: ["contains"], aim: "aim", failed: [cRef] };
  assert.deepEqual(readEndeavor(graph, planRef, selected), { continuing: true, failedAims: [], absorbed: [cRef.id] });
  assert.equal(readEndeavor(graph, planRef, { ...selected, failed: [targetRef] }).continuing, false);
  assert.equal(readEndeavor(graph, planRef, { ...selected, abandoned: [planRef] }).continuing, false);
  assert.deepEqual(querySignGraph(graph, referenceOf(journey), "intends")[0].edge.object, referenceOf(wanted));
  assert.deepEqual(querySignGraph(graph, referenceOf(journey), "realized")[0].edge.object, referenceOf(observed));
});

test("a workflow reads branches and parallel waves and refuses mismatched nested boundaries", () => {
  const child = mark(work, "nested workflow");
  const graph = graphOf([plan, a, b, c, target, child], [
    declaration("contains"), declaration("realized-by"), declaration("precedes"),
  ], [
    ...[a, b, c, target].map(item => edge(plan, "contains", item)),
    edge(a, "realized-by", child),
    edge(a, "precedes", b), edge(a, "precedes", c),
    edge(b, "precedes", target), edge(c, "precedes", target),
  ]);
  const options = { contains: "contains", realizedBy: "realized-by", precedes: "precedes" };
  const compatible = [[planRef, "order"], [referenceOf(child), "order"]];
  assert.deepEqual(readWorkflow(graph, planRef, { ...options, boundaries: compatible }), {
    sources: [aRef.id], sinks: [targetRef.id], dead: [], sound: true,
    patterns: { sequence: 0, branch: 1, parallel: 1 },
  });
  assert.equal(readWorkflow(graph, planRef, { ...options, boundaries: compatible.slice(0, 1) }).sound, true);
  assert.equal(readWorkflow(graph, planRef, { ...options, entry: bRef }).sound, false);
  assert.throws(() => readWorkflow(graph, planRef, {
    ...options, boundaries: [compatible[0], [referenceOf(child), "invoice"]],
  }), { code: "BOUNDARY_TYPE" });
});

test("settlement reports drift and keeps contest visible while dispatch refusal absorbs", () => {
  const asserted = cell("task", "settled", "meaning", { for: ["worker"] });
  const unknown = cell("task", "has", "input");
  const confirmed = cell("task", "has", "input", { for: ["input received"] });
  const contested = cell("task", "verified", "output", { for: ["pass"], against: ["failure"] });
  const execution = { obligations: [contested] };
  const prior = readWorkSettlement({ meaning: { declaration: asserted, obligations: [unknown] }, execution });
  const next = readWorkSettlement({ meaning: { declaration: asserted, obligations: [confirmed] }, execution });
  assert.equal(prior.meaning.agrees, false);
  assert.equal(next.meaning.agrees, true);
  assert.ok(knowledgeLeqReading(prior.meaning.derived, next.meaning.derived));
  assert.equal(next.knowledgeMeet, "potential");
  assert.equal(next.ready, false);
  assert.deepEqual(next.execution.contested, [contested]);
  assert.equal(dispatchFit([]), "potential");
  assert.equal(dispatchFit(["true", "unknown"]), "absurd");
  assert.equal(dispatchFit(["unknown", "both"]), "stable");
  assert.equal(dispatchFit(["both", "false", "unknown"]), "active");
});

test("reachability inclusion compares planning constraints and Metrologic orders closure regimes", () => {
  const options = { nodeType: work.id, predicate: "precedes" };
  const graph = (edges) => graphOf([a, b, c], [declaration(options.predicate)], edges);
  const ab = edge(a, options.predicate, b), bc = edge(b, options.predicate, c);
  const loose = graph([ab]), tight = graph([ab, bc]);
  const comparison = compareSignGraphAlexandrov(loose, tight, options);
  assert.equal(comparison.sourceToTargetContinuous, true);
  assert.equal(comparison.targetToSourceContinuous, false);
  assert.equal(compareSignGraphAlexandrov(tight, tight, options).identityHomeomorphism, true);
  assert.equal(finiteRead(4).finiteWitnessValue, 4);
  const limit = namedLimitRead("omega", 2);
  assert.equal(limit.isFinite, false);
  assert.equal(limit.prefixBelowLimit, true);
  assert.equal(limit.ordinal.fundamentalPrefix.length, 2);
  assert.deepEqual(["strict", "scott", "transfinite-bounded", "aperiodic"].map(regimeCost), [0, 1, 2, 3]);
});
