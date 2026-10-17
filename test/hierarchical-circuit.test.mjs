// Pure placement-independent SEN die assay.
import assert from "node:assert/strict";
import test from "node:test";
import { semanticId } from "@red-cup-engineering/computer-content-address-engineering-services-section/semiotic-content-address";
import {
  CIRCUIT_ASSEMBLY_PROFILE,
  HIERARCHICAL_CIRCUIT_PROFILE,
  circuitAssemblyId,
  decodeHierarchicalCircuit,
  encodeHierarchicalCircuit,
  hierarchicalCircuitId,
  normalizeHierarchicalCircuit,
  planCombinationalCircuit,
  readCircuitContext,
  synthesizeCircuitBehavior,
  verifyCircuitFamily,
  verifyCircuitRealization,
  verifyCircuitEquivalence,
  verifyCircuitAssembly,
} from "../src/hierarchical-circuit.mjs";

const id = (label) => semanticId(["mark", label]);
const account = (suffix) => `eip155:31337:0x${suffix.padStart(40, "0")}`;
const N = Object.freeze({ positiveEvidence: false, negativeEvidence: false });
const T = Object.freeze({ positiveEvidence: true, negativeEvidence: false });
const F = Object.freeze({ positiveEvidence: false, negativeEvidence: true });
const B = Object.freeze({ positiveEvidence: true, negativeEvidence: true });
const rows = (outputs = [N, T, F, B]) => [N, T, F, B].map((input, index) => ({ input: [input], output: [outputs[index]] }));
const pin = (name, direction, mode = "tensor") => ({ name, direction, mode, predicate: id("evidences"), carrier: id("FOUR") });
const behavior = (inputs = ["a"], outputs = ["z"], table = rows()) => ({ factors: [{ inputs, outputs, rows: table }] });

function membrane(suffix, label) {
  return { account: account(suffix), authority: id(`${label}-authority`), custody: id(`${label}-custody`), territory: id(`${label}-territory`) };
}

function leaf() {
  return {
    profile: HIERARCHICAL_CIRCUIT_PROFILE,
    law: id("identity-law"),
    ports: [pin("z", "output"), pin("a", "input")], instances: [], nets: [],
    behavior: behavior(),
  };
}

function parent(child) {
  return {
    profile: HIERARCHICAL_CIRCUIT_PROFILE,
    law: id("parent-law"),
    ports: [pin("z", "output"), pin("a", "input")],
    instances: [{ name: "die", component: hierarchicalCircuitId(child) }],
    nets: [
      { name: "n-in", driver: { instance: null, port: "a" }, sinks: [{ instance: "die", port: "a" }], mode: "tensor", chain: null, contract: null },
      { name: "n-out", driver: { instance: "die", port: "z" }, sinks: [{ instance: null, port: "z" }], mode: "tensor", chain: null, contract: null },
    ],
    behavior: behavior(),
  };
}

function assembly(circuit, placements) {
  return {
    profile: CIRCUIT_ASSEMBLY_PROFILE,
    circuit: hierarchicalCircuitId(circuit),
    placements: placements.map(([address, suffix, label]) => ({ address, membrane: membrane(suffix, label) })),
  };
}

test("hierarchical circuits have one deterministic typed SEN identity", () => {
  const source = leaf(), normalized = normalizeHierarchicalCircuit(source), term = encodeHierarchicalCircuit(source);
  assert.deepEqual(decodeHierarchicalCircuit(term), normalized);
  assert.equal(hierarchicalCircuitId(source), hierarchicalCircuitId({ ...source, ports: [...source.ports].reverse(), behavior: { factors: [{ ...source.behavior.factors[0], rows: [...source.behavior.factors[0].rows].reverse() }] } }));
  assert.match(hierarchicalCircuitId(source), /^ni:\/\/\/sha-256;[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u);
});

test("a circuit of a sovereign die synthesizes the same black-box FOUR behavior", () => {
  const child = normalizeHierarchicalCircuit(leaf()), design = parent(child), library = new Map([[hierarchicalCircuitId(child), child]]);
  assert.deepEqual(synthesizeCircuitBehavior(design, library), normalizeHierarchicalCircuit(design).behavior);
  assert.deepEqual(verifyCircuitEquivalence(design, library).equivalent, true);
});

test("recursive containment is verified to arbitrary depth and read relative to an address", () => {
  const child = normalizeHierarchicalCircuit(leaf()), middle = normalizeHierarchicalCircuit(parent(child));
  const root = parent(middle), components = [child, middle];
  const populated = assembly(root, [[[], "3", "root"], [["die"], "2", "middle"], [["die", "die"], "1", "leaf"]]);
  const family = verifyCircuitFamily(root, components);
  assert.equal(family.verified.size, 3);
  const middleView = readCircuitContext({ circuit: root, components, assembly: populated, address: ["die"] });
  const childView = readCircuitContext({ circuit: root, components, assembly: populated, address: ["die", "die"] });
  assert.equal(middleView.circuit, hierarchicalCircuitId(middle));
  assert.equal(childView.circuit, hierarchicalCircuitId(child));
  assert.deepEqual(childView.address, ["die", "die"]);
  assert.equal(childView.parent.circuit, hierarchicalCircuitId(middle));
  assert.equal(childView.membrane.account, account("1"));
  assert.equal(Object.hasOwn(childView, "scale"), false);
});

test("one placement-neutral die design may inhabit distinct sovereign occurrences", () => {
  const child = normalizeHierarchicalCircuit(leaf()), root = normalizeHierarchicalCircuit({
    ...parent(child),
    ports: [],
    instances: [{ name: "left", component: hierarchicalCircuitId(child) }, { name: "right", component: hierarchicalCircuitId(child) }],
    nets: [
      { name: "loop-left-right", driver: { instance: "left", port: "z" }, sinks: [{ instance: "right", port: "a" }], mode: "tensor", chain: null, contract: null },
      { name: "loop-right-left", driver: { instance: "right", port: "z" }, sinks: [{ instance: "left", port: "a" }], mode: "tensor", chain: null, contract: null },
    ],
    behavior: { factors: [] },
  });
  const populated = assembly(root, [[[], "3", "root"], [["left"], "1", "left"], [["right"], "2", "right"]]);
  const verified = verifyCircuitAssembly(populated, root, [child]);
  assert.equal(verified.contexts.length, 3);
  assert.equal(readCircuitContext({ circuit: root, components: [child], assembly: populated, address: ["left"] }).circuit,
    readCircuitContext({ circuit: root, components: [child], assembly: populated, address: ["right"] }).circuit);
  assert.notEqual(readCircuitContext({ circuit: root, components: [child], assembly: populated, address: ["left"] }).membrane.account,
    readCircuitContext({ circuit: root, components: [child], assembly: populated, address: ["right"] }).membrane.account);
  assert.throws(() => verifyCircuitAssembly({ ...populated, placements: populated.placements.slice(0, 2) }, root, [child]), /omits circuit occurrence/u);
});

test("a board realizes its public black-box die exactly through sovereign child occurrences", () => {
  const child = normalizeHierarchicalCircuit(leaf()), implementation = normalizeHierarchicalCircuit(parent(child));
  const publicInterface = normalizeHierarchicalCircuit({ ...implementation, instances: [], nets: [] });
  const populated = assembly(implementation, [[[], "3", "board"], [["die"], "1", "child"]]);
  const realized = verifyCircuitRealization({ interface: publicInterface, circuit: implementation, components: [child], assembly: populated });
  assert.equal(realized.realized, true);
  assert.equal(realized.interface, hierarchicalCircuitId(publicInterface));
  assert.equal(realized.circuit, hierarchicalCircuitId(implementation));
  assert.deepEqual(realized.components, [hierarchicalCircuitId(child)]);

  const wrongLaw = { ...publicInterface, law: id("foreign-law") };
  assert.throws(() => verifyCircuitRealization({ interface: wrongLaw, circuit: implementation, components: [child], assembly: populated }), /same SEN law/u);
  const wrongPins = { ...publicInterface, ports: [pin("different", "output"), pin("a", "input")], behavior: behavior(["a"], ["different"]) };
  assert.throws(() => verifyCircuitRealization({ interface: wrongPins, circuit: implementation, components: [child], assembly: populated }), /pinout/u);
});

test("scale labels and consensus leakage are rejected rather than shimmed", () => {
  const source = leaf();
  assert.throws(() => normalizeHierarchicalCircuit({ ...source, ["sca" + "le"]: "enterprise" }), /legacy field/u);
  const child = normalizeHierarchicalCircuit(source), design = parent(child);
  design.nets[0] = { ...design.nets[0], chain: "eip155:31337", contract: id("wrong") };
  assert.throws(() => normalizeHierarchicalCircuit(design), /tensor nets cannot name consensus/u);
});

test("declared parent behavior must equal Beh(Synth(D))", () => {
  const child = normalizeHierarchicalCircuit(leaf()), design = parent(child), library = new Map([[hierarchicalCircuitId(child), child]]);
  design.behavior = behavior(["a"], ["z"], rows([N, N, N, N]));
  assert.throws(() => verifyCircuitEquivalence(design, library), /does not equal/u);
});

test("tensor-factorized boards preserve sixteen independent die relations without global truth-table expansion", () => {
  const children = Array.from({ length: 16 }, (_value, index) => normalizeHierarchicalCircuit({
    profile: HIERARCHICAL_CIRCUIT_PROFILE,
    law: id(`child-law-${index}`),
    ports: [
      { ...pin("request", "input"), predicate: id(`predicate-${index}`), carrier: id(`carrier-${index}`) },
      { ...pin("receipt", "output"), predicate: id(`predicate-${index}`), carrier: id(`carrier-${index}`) },
    ],
    instances: [], nets: [], behavior: behavior(["request"], ["receipt"]),
  }));
  const ports = children.flatMap((child, index) => child.ports.map((port) => ({ ...port, name: `${index}-${port.name}` })));
  const design = {
    profile: HIERARCHICAL_CIRCUIT_PROFILE,
    law: id("sixteen-die-board"),
    ports,
    instances: children.map((child, index) => ({ name: `die-${index}`, component: hierarchicalCircuitId(child) })),
    nets: children.flatMap((_child, index) => [
      { name: `in-${index}`, driver: { instance: null, port: `${index}-request` }, sinks: [{ instance: `die-${index}`, port: "request" }], mode: "tensor", chain: null, contract: null },
      { name: `out-${index}`, driver: { instance: `die-${index}`, port: "receipt" }, sinks: [{ instance: null, port: `${index}-receipt` }], mode: "tensor", chain: null, contract: null },
    ]),
    behavior: { factors: children.map((_child, index) => ({ inputs: [`${index}-request`], outputs: [`${index}-receipt`], rows: rows() })) },
  };
  const library = new Map(children.map((child) => [hierarchicalCircuitId(child), child]));
  const synthesized = synthesizeCircuitBehavior(design, library);
  assert.equal(synthesized.factors.length, 16);
  assert.equal(synthesized.factors.reduce((count, factor) => count + factor.rows.length, 0), 64);
  assert.equal(verifyCircuitEquivalence(design, library).equivalent, true);
  const collapsed = structuredClone(design);
  collapsed.behavior.factors = [{ inputs: ports.filter(({ direction }) => direction === "input").map(({ name }) => name), outputs: ports.filter(({ direction }) => direction === "output").map(({ name }) => name), rows: [] }];
  assert.throws(() => normalizeHierarchicalCircuit(collapsed), /at most six FOUR inputs/u);
});

test("factorized behavior refuses overlaps, omissions, and false independence", () => {
  const source = leaf();
  source.behavior.factors.push({ inputs: ["a"], outputs: [], rows: [N, T, F, B].map((input) => ({ input: [input], output: [] })) });
  assert.throws(() => normalizeHierarchicalCircuit(source), /more than one behavior factor/u);
  const omitted = leaf(); omitted.behavior = { factors: [] };
  assert.throws(() => normalizeHierarchicalCircuit(omitted), /omit input pin/u);
});


test("EDA tensor synthesis has a deterministic finite instance wavefront, not an assumed causal metric", () => {
  const child = normalizeHierarchicalCircuit(leaf()), component = hierarchicalCircuitId(child);
  const input = { instance: null, port: "a" }, output = { instance: null, port: "z" };
  const circuit = {
    profile: HIERARCHICAL_CIRCUIT_PROFILE, law: id("serial-tensor-law"),
    ports: [pin("a", "input"), pin("z", "output")],
    instances: [{ name: "right", component }, { name: "left", component }],
    nets: [
      { name: "second", driver: { instance: "left", port: "z" }, sinks: [{ instance: "right", port: "a" }], mode: "tensor", chain: null, contract: null },
      { name: "out", driver: { instance: "right", port: "z" }, sinks: [output], mode: "tensor", chain: null, contract: null },
      { name: "in", driver: input, sinks: [{ instance: "left", port: "a" }], mode: "tensor", chain: null, contract: null },
    ],
    behavior: behavior(),
  };
  const library = new Map([[component, child]]);
  assert.equal(verifyCircuitEquivalence(circuit, library).equivalent, true);
  const plan = planCombinationalCircuit(circuit, library);
  assert.equal(plan.kind, "signgraph.circuitCombinationalPlan.v1");
  assert.equal(plan.admissionLevel, "structural-only");
  assert.equal(plan.instanceCount, 2);
  assert.equal(plan.parallelRounds, 2);
  assert.deepEqual(plan.dependencies, [{ from: "left", to: "right" }]);
  assert.deepEqual(plan.waves, [["left"], ["right"]]);
  assert.ok(Object.isFrozen(plan) && Object.isFrozen(plan.waves[0]));
  const reordered = { ...circuit, instances: [...circuit.instances].reverse(), nets: [...circuit.nets].reverse() };
  assert.equal(plan.circuit, planCombinationalCircuit(reordered, library).circuit);
  assert.deepEqual(plan.waves, planCombinationalCircuit(reordered, library).waves);

  const parallel = {
    ...circuit, law: id("parallel-tensor-law"),
    ports: [pin("a1", "input"), pin("z1", "output"), pin("a2", "input"), pin("z2", "output")],
    nets: [
      { name: "left-in", driver: { instance: null, port: "a1" }, sinks: [{ instance: "left", port: "a" }], mode: "tensor", chain: null, contract: null },
      { name: "right-in", driver: { instance: null, port: "a2" }, sinks: [{ instance: "right", port: "a" }], mode: "tensor", chain: null, contract: null },
      { name: "left-out", driver: { instance: "left", port: "z" }, sinks: [{ instance: null, port: "z1" }], mode: "tensor", chain: null, contract: null },
      { name: "right-out", driver: { instance: "right", port: "z" }, sinks: [{ instance: null, port: "z2" }], mode: "tensor", chain: null, contract: null },
    ],
    behavior: { factors: [
      { inputs: ["a1"], outputs: ["z1"], rows: rows() },
      { inputs: ["a2"], outputs: ["z2"], rows: rows() },
    ] },
  };
  assert.equal(verifyCircuitEquivalence(parallel, library).equivalent, true);
  assert.deepEqual(planCombinationalCircuit(parallel, library).waves, [["left", "right"]]);

  const cycle = { ...circuit, law: id("cyclic-tensor-law"), ports: [],
    nets: [
      { name: "left-to-right", driver: { instance: "left", port: "z" }, sinks: [{ instance: "right", port: "a" }], mode: "tensor", chain: null, contract: null },
      { name: "right-to-left", driver: { instance: "right", port: "z" }, sinks: [{ instance: "left", port: "a" }], mode: "tensor", chain: null, contract: null },
    ],
    behavior: { factors: [] },
  };
  assert.throws(() => planCombinationalCircuit(cycle, library), /tensor dependency cycle/);

  const parChild = normalizeHierarchicalCircuit({ ...leaf(),
    ports: [pin("a", "input", "par"), pin("z", "output", "par")] });
  const parLibrary = new Map([[hierarchicalCircuitId(parChild), parChild]]);
  const par = { ...parent(parChild), ports: [pin("a", "input", "par"), pin("z", "output", "par")],
    instances: [{ name: "die", component: hierarchicalCircuitId(parChild) }],
    nets: parent(parChild).nets.map(net => ({
      ...net, mode: "par", chain: "eip155:31337", contract: id("consensus-contract"),
    })),
  };
  assert.throws(() => planCombinationalCircuit(par, parLibrary), /stateful\/consensus fabricator/);
  assert.throws(() => planCombinationalCircuit(circuit, new Map()), /not available for synthesis/);
});


test("six-input FOUR fabrication admits a complete monotone die through knowledge covers", () => {
  // The full six-input relation has 4^6 = 4096 rows. The prior pairwise
  // monotonicity assay compared up to 4^12 ordered input pairs.
  const inputs = Array.from({ length: 6 }, (_, i) => "a" + i);
  let valuations = [[]];
  for (const _name of inputs) valuations = valuations.flatMap(prefix =>
    [N, T, F, B].map(value => [...prefix, value]));
  const source = {
    profile: HIERARCHICAL_CIRCUIT_PROFILE,
    law: id("six-input-knowledge-cover-law"),
    ports: [...inputs.map(name => pin(name, "input")), pin("out", "output")],
    instances: [], nets: [],
    behavior: { factors: [{
      inputs, outputs: ["out"],
      rows: valuations.map(input => ({
        input,
        output: [{
          positiveEvidence: input.some(value => value.positiveEvidence),
          negativeEvidence: input.some(value => value.negativeEvidence),
        }],
      })),
    }] },
  };
  const fabricated = normalizeHierarchicalCircuit(source);
  assert.equal(fabricated.behavior.factors[0].rows.length, 4096);
  const artifact = hierarchicalCircuitId(source);
  assert.match(artifact, /^ni:\/\/\/sha-256;[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u);
  const reordered = structuredClone(source);
  reordered.behavior.factors[0].rows.reverse();
  assert.equal(hierarchicalCircuitId(reordered), artifact);
  // A forged knowledge-top output at the least-informed input violates the
  // immediate N -> T and N -> F cover edges. A fast admission is not a weaker one.
  const invalid = structuredClone(source);
  invalid.behavior.factors[0].rows[0].output = [B];
  assert.throws(() => normalizeHierarchicalCircuit(invalid), /monotone/u);
});

test("EDA composes a full six-input FOUR behavior using the fixed circuit wiring", () => {
  // Two legitimate four-input-or-smaller child factors feed one six-input die:
  // the first child combines a,b,c; its output and d,e,f feed the second.
  const values = [N, T, F, B];
  const valuations = width => {
    let result = [[]];
    for (let k = 0; k < width; k++) result = result.flatMap(prefix =>
      values.map(value => [...prefix, value]));
    return result;
  };
  const joinInputs = input => [{
    positiveEvidence: input.some(value => value.positiveEvidence),
    negativeEvidence: input.some(value => value.negativeEvidence),
  }];
  const child = (label, names) => normalizeHierarchicalCircuit({
    profile: HIERARCHICAL_CIRCUIT_PROFILE, law: id("composed-four-eda-" + label),
    ports: [...names.map(name => pin(name, "input")), pin("out", "output")],
    instances: [], nets: [], behavior: { factors: [{
      inputs: names, outputs: ["out"],
      rows: valuations(names.length).map(input => ({ input, output: joinInputs(input) })),
    }] },
  });
  const left = child("left", ["a", "b", "c"]);
  const right = child("right", ["mid", "d", "e", "f"]);
  const external = ["a", "b", "c", "d", "e", "f"];
  const net = (name, driver, sinks) => ({ name, driver, sinks, mode: "tensor", chain: null, contract: null });
  const design = {
    profile: HIERARCHICAL_CIRCUIT_PROFILE, law: id("six-input-composed-eda"),
    ports: [...external.map(name => pin(name, "input")), pin("out", "output")],
    instances: [
      { name: "right", component: hierarchicalCircuitId(right) },
      { name: "left", component: hierarchicalCircuitId(left) },
    ],
    nets: [
      ...["a", "b", "c"].map(name => net("in-" + name,
        { instance: null, port: name }, [{ instance: "left", port: name }])),
      ...["d", "e", "f"].map(name => net("in-" + name,
        { instance: null, port: name }, [{ instance: "right", port: name }])),
      net("bridge", { instance: "left", port: "out" }, [{ instance: "right", port: "mid" }]),
      net("result", { instance: "right", port: "out" }, [{ instance: null, port: "out" }]),
    ],
    behavior: { factors: [{
      inputs: external, outputs: ["out"],
      rows: valuations(6).map(input => ({ input, output: joinInputs(input) })),
    }] },
  };
  const library = new Map([
    [hierarchicalCircuitId(left), left], [hierarchicalCircuitId(right), right],
  ]);
  assert.deepEqual(planCombinationalCircuit(design, library).waves, [["left"], ["right"]]);
  const synthesized = synthesizeCircuitBehavior(design, library);
  assert.equal(synthesized.factors[0].rows.length, 4096);
  assert.deepEqual(synthesized, normalizeHierarchicalCircuit(design).behavior);
  assert.equal(verifyCircuitEquivalence(design, library).equivalent, true);
  const reversed = { ...design, instances: [...design.instances].reverse(), nets: [...design.nets].reverse() };
  assert.deepEqual(synthesizeCircuitBehavior(reversed, library), synthesized);
  const falseClaim = structuredClone(design);
  falseClaim.behavior.factors[0].rows = falseClaim.behavior.factors[0].rows.map(row =>
    ({ ...row, output: [N] }));
  assert.throws(() => verifyCircuitEquivalence(falseClaim, library), /does not equal/u);
});

test("connected seven-input synthesis refuses before enumeration despite legal smaller children", () => {
  // Two individually admissible four-input child factors are wired in series.
  // Their composed parent has 4 + (4 - 1) = SEVEN independent inputs.
  // A declared *separated* parent behavior is still a well-formed circuit
  // record, but cannot be accepted as the behavior of the real connected net.
  const combinations = width => {
    let all = [[]];
    for (let i = 0; i < width; i++) all = all.flatMap(xs => [N, T, F, B].map(value => [...xs, value]));
    return all;
  };
  const factor = (inputs, outputs) => ({
    inputs, outputs,
    rows: combinations(inputs.length).map(input => ({
      input, output: outputs.map(() => N),
    })),
  });
  const child = prefix => {
    const names = Array.from({ length: 4 }, (_, i) => prefix + i);
    return normalizeHierarchicalCircuit({
      profile: HIERARCHICAL_CIRCUIT_PROFILE, law: id("four-" + prefix),
      ports: [...names.map(name => pin(name, "input")), pin("out", "output")],
      instances: [], nets: [], behavior: { factors: [factor(names, ["out"])] },
    });
  };
  const left = child("a"), right = child("b");
  const wire = (name, driver, sinks) => ({
    name, driver, sinks, mode: "tensor", chain: null, contract: null,
  });
  const aNames = Array.from({ length: 4 }, (_, i) => "a" + i);
  const bNames = Array.from({ length: 3 }, (_, i) => "b" + (i + 1));
  const design = {
    profile: HIERARCHICAL_CIRCUIT_PROFILE, law: id("seven-input-circuit"),
    ports: [...aNames, ...bNames].map(name => pin(name, "input")).concat(pin("result", "output")),
    instances: [
      { name: "left", component: hierarchicalCircuitId(left) },
      { name: "right", component: hierarchicalCircuitId(right) },
    ],
    nets: [
      ...aNames.map(name => wire("feed-" + name, { instance: null, port: name },
        [{ instance: "left", port: name }])),
      ...bNames.map(name => wire("feed-" + name, { instance: null, port: name },
        [{ instance: "right", port: name }])),
      wire("bridge", { instance: "left", port: "out" }, [{ instance: "right", port: "b0" }]),
      wire("result", { instance: "right", port: "out" }, [{ instance: null, port: "result" }]),
    ],
    behavior: { factors: [
      factor(aNames, ["result"]), factor(bNames, []),
    ] },
  };
  const library = new Map([[hierarchicalCircuitId(left), left], [hierarchicalCircuitId(right), right]]);
  assert.equal(normalizeHierarchicalCircuit(design).ports.length, 8);
  assert.deepEqual(planCombinationalCircuit(design, library).waves, [["left"], ["right"]]);
  assert.throws(() => synthesizeCircuitBehavior(design, library),
    /synthesized behavior factor may expose at most six FOUR inputs/);
  assert.throws(() => verifyCircuitEquivalence(design, library),
    /synthesized behavior factor may expose at most six FOUR inputs/);
});
