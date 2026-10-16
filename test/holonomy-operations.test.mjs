import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { operations, LIMITS, executeOperation } from "../src/operations.mjs";

const triangle = () => ({
  vertices: ["a", "b", "c"],
  edges: [
    { id: "ab", from: "a", to: "b" },
    { id: "bc", from: "b", to: "c" },
    { id: "ca", from: "c", to: "a" },
  ],
  faces: [{ id: "f", boundary: ["ab", "bc", "ca"].map(edge => ({ edge, direction: 1 })) }],
});

test("three reusable operations share one structural admission, with machine-readable schemas", () => {
  assert.deepEqual(Object.values(operations).map(op => op.id), [
    "signgraph.holonomy.topology",
    "signgraph.holonomy.burgers",
    "signgraph.holonomy.affine",
  ]);
  for (const op of Object.values(operations)) {
    assert.equal(op.inputSchema.type, "object");
    assert.equal(op.inputSchema.additionalProperties, false);
    assert.deepEqual(op.inputSchema.required.slice(0, 3), ["vertices", "edges", "faces"]);
    assert.equal(typeof op.execute, "function");
  }
  const receipt = executeOperation("signgraph.holonomy.topology", triangle());
  assert.deepEqual(receipt.betti, { h0: 1, h1: 0, h2: 0 });
  assert.deepEqual(receipt.rank, { zero: 2, one: 1 });
  assert.equal(receipt.graphOnlyH1, 1);
  assert.equal(receipt.coefficientDomain, "Q");
  assert.deepEqual(receipt.shape, { vertices: 3, edges: 3, faces: 1, faceSteps: 3 });
  assert.ok(Object.isFrozen(receipt));
});

test("operator receives actionable local Burgers charges and a constructive exactness witness", () => {
  const input = triangle();
  const bad = executeOperation("signgraph.holonomy.burgers", {
    ...input, edgeDisplacements: [[1, 0], [0, 0], [0, 0]],
  });
  assert.equal(bad.classification, "local-defect");
  assert.deepEqual(bad.faceResidues[0].burgers, [1, 0]);
  assert.equal(bad.exact, false);
  const clean = executeOperation("signgraph.holonomy.burgers", {
    ...input, edgeDisplacements: [[1, 2], [3, 4], [-4, -6]],
  });
  assert.equal(clean.classification, "exact");
  assert.equal(clean.faceResidues[0].flat, true);
  assert.ok(clean.potential.length === 3);
});

test("rational b1=0 does not suppress finite-order global affine holonomy", () => {
  // A one-cell CW model of RP². The face attaches by aa,
  // so H1(Q)=0 while π1 = C2 has nontrivial order-two monodromy.
  const projectivePlane = {
    vertices: ["p"],
    edges: [{ id: "a", from: "p", to: "p" }],
    faces: [{ id: "disk", boundary: [
      { edge: "a", direction: 1 }, { edge: "a", direction: 1 },
    ] }],
  };
  const rank = executeOperation("signgraph.holonomy.topology", projectivePlane);
  assert.deepEqual(rank.betti, { h0: 1, h1: 0, h2: 0 });
  assert.equal(rank.rationalH1Vanishing, true);
  const receipt = executeOperation("signgraph.holonomy.affine", {
    ...projectivePlane,
    edgeMotions: [{ rotation: 3, translation: [0, 0] }],
  });
  assert.equal(receipt.classification, "global-affine-holonomy");
  assert.equal(receipt.localFlat, true);
  assert.equal(receipt.nontrivialGlobalMonodromy, true);
  assert.deepEqual(receipt.faceHolonomies[0].holonomy,
    { rotation: 0, translation: [0, 0] });
  assert.equal(receipt.cycleHolonomies.length, 1);
  assert.equal(receipt.cycleHolonomies[0].holonomy.rotation, 3);
});

test("operation work limits and undeclared data fail before expensive rank elimination", () => {
  const base = triangle();
  assert.throws(() => executeOperation("signgraph.holonomy.topology", {
    ...base, vertices: Array.from({ length: LIMITS.vertices + 1 }, (_, i) => String(i)),
  }), /work budget/);
  assert.throws(() => executeOperation("signgraph.holonomy.topology", {
    ...base, faces: Array.from({ length: LIMITS.faces + 1 }, (_, i) => ({
      id: i, boundary: [{ edge: "ab", direction: 1 }],
    })),
  }), /work budget/);
  assert.throws(() => executeOperation("signgraph.holonomy.topology", {
    ...base, typo: true,
  }), /undeclared input fields/);
  assert.throws(() => executeOperation("signgraph.holonomy.topology", {
    ...base, vertices: ["x".repeat(100000)],
  }), /64KiB input work budget/);
  assert.throws(() => executeOperation("signgraph.holonomy.affine", {
    ...base, edgeMotions: [{ rotation: 0, translation: [0, 0] }],
  }), /for each edge/);
  assert.throws(() => executeOperation("signgraph.holonomy.burgers", {
    ...base, edgeDisplacements: null,
  }), /for each edge/);
  assert.throws(() => executeOperation("signgraph.holonomy.invalid", base), /not installed/);
});

const bin = fileURLToPath(new URL("../scripts/holonomy.mjs", import.meta.url));

test("installed CLI batches successful and rejected JSONL requests without side effects", () => {
  const input = triangle();
  const messages = [
    { operation: "signgraph.holonomy.topology", input },
    { operation: "signgraph.holonomy.affine", input: {
      ...input, edgeMotions: [
        { rotation: 0, translation: [1, 0] },
        { rotation: 0, translation: [0, 1] },
        { rotation: 0, translation: [-1, -1] },
      ],
    }},
    { operation: "signgraph.holonomy.unknown", input },
    { operation: "signgraph.holonomy.topology", input },
  ].map(x => JSON.stringify(x)).join("\n") + "\n";
  const child = spawnSync(process.execPath, [bin], {
    input: messages, encoding: "utf8", timeout: 10000,
  });
  assert.equal(child.status, 1, child.stderr);
  const receipts = child.stdout.trim().split("\n").map(x => JSON.parse(x));
  assert.equal(receipts.length, 4);
  assert.deepEqual(receipts.map(x => x.ok), [true, true, false, true]);
  assert.equal(receipts[0].receipt.graphOnlyH1, 1);
  assert.equal(receipts[1].receipt.classification, "affine-flat");
  assert.match(receipts[2].error, /not installed/);
  assert.equal(receipts[3].receipt.betti.h1, 0);
  assert.equal(child.stderr, "");
  const help = spawnSync(process.execPath, [bin, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /signgraph\.holonomy\.affine/);
});

test("CLI input budget produces a failure receipt and still receives subsequent work", () => {
  const child = spawnSync(process.execPath, [bin], {
    input: JSON.stringify({ operation: "signgraph.holonomy.topology", input: { typo: "x".repeat(300000) } }) +
      "\n" + JSON.stringify({ operation: "signgraph.holonomy.topology", input: triangle() }),
    encoding: "utf8", timeout: 10000,
  });
  assert.equal(child.status, 1, child.stderr);
  const receipts = child.stdout.trim().split("\n").map(x => JSON.parse(x));
  assert.equal(receipts.length, 2);
  assert.match(receipts[0].error, /64KiB/);
  assert.equal(receipts[1].ok, true);
});

test("CLI enforces its 1024-request batch limit with a failing exit code", () => {
  const request = JSON.stringify({ operation: "signgraph.holonomy.topology", input: triangle() });
  const child = spawnSync(process.execPath, [bin], {
    input: Array(1025).fill(request).join("\n") + "\n",
    encoding: "utf8", timeout: 20000, maxBuffer: 6 * 1024 * 1024,
  });
  assert.equal(child.status, 1, child.stderr);
  const lines = child.stdout.trim().split("\n").map(line => JSON.parse(line));
  assert.equal(lines.length, 1025);
  assert.ok(lines.slice(0, 1024).every(line => line.ok));
  assert.equal(lines[1024].ok, false);
  assert.match(lines[1024].error, /1024 requests/);
});
