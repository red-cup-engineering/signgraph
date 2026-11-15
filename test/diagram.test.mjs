import assert from "node:assert/strict";
import test from "node:test";
import { createGraph } from "@red-cup-engineering/metrologic/models/graphs/directed-multigraph";
import { toDot, toMermaid } from "@red-cup-engineering/signgraph/diagram";

test("DOT output is a digraph with quoted ids and labelled non-default kinds.", () => {
  const graph = createGraph({ edges: [{ from: "a b", to: "c", kind: "depends-on" }, { from: "c", to: "d" }] });
  const dot = toDot(graph, { label: "demo" });
  assert.ok(dot.startsWith("digraph demo {"));
  assert.ok(dot.includes('"a b" -> "c" [label="depends-on"];'));
  assert.ok(dot.includes('"c" -> "d";'));
  assert.ok(dot.endsWith("}\n"));
});

test("A DOT label is bare when it is an identifier, and the rank direction and node labels are written.", () => {
  const graph = createGraph({ nodes: [{ id: "a", data: { kind: "root" } }], edges: [{ from: "a", to: "b" }] });
  const dot = toDot(graph, { label: "software_inventory", rankdir: "LR", nodeLabel: (node) => node.data?.kind });
  assert.ok(dot.startsWith("digraph software_inventory {\n  rankdir=LR;"));
  assert.ok(dot.includes('"a" [label="root"];'));
  assert.ok(dot.includes('"b";'));
  assert.ok(toDot(createGraph(), { label: "two words" }).startsWith('digraph "two words" {'));
});

test("DOT quotes escape quotation marks and backslashes in ids.", () => {
  const dot = toDot(createGraph({ nodes: [{ id: 'say "hi"\\' }] }));
  assert.ok(dot.includes('"say \\"hi\\"\\\\";'));
});

test("Mermaid output keeps source ids as labels under positional aliases.", () => {
  const graph = createGraph({ edges: [{ from: "a b", to: "c", kind: "depends-on" }] });
  const mermaid = toMermaid(graph);
  assert.ok(mermaid.startsWith("flowchart TD"));
  assert.ok(mermaid.includes('m0["a b"]'));
  assert.ok(mermaid.includes('m1["c"]'));
  assert.ok(mermaid.includes("m0 -- depends-on --> m1"));
});

test("Distinct node addresses never share a Mermaid identifier.", () => {
  const ids = ["a b", "a/b", "a_b", "ni:///sha-256;a.b", "ni:///sha-256;a_b"];
  const edges = [
    { from: "a b", to: "a/b" },
    { from: "a_b", to: "ni:///sha-256;a.b" },
    { from: "ni:///sha-256;a.b", to: "ni:///sha-256;a_b" },
  ];
  const rendered = toMermaid(createGraph({ nodes: ids.map((id) => ({ id })), edges }));
  const aliases = new Map([...rendered.matchAll(/^  (m\d+)\["([^"]+)"\]$/gm)].map(([, alias, id]) => [id, alias]));
  assert.equal(aliases.size, ids.length);
  assert.equal(new Set(aliases.values()).size, ids.length);
  assert.deepEqual([...aliases.keys()].sort(), [...ids].sort());
  for (const edge of edges) assert.ok(rendered.includes(`  ${aliases.get(edge.from)} --> ${aliases.get(edge.to)}`));
  const reversed = createGraph({ nodes: [...ids].reverse().map((id) => ({ id })), edges: [...edges].reverse() });
  assert.equal(toMermaid(reversed), rendered, "aliases follow the canonical graph, not insertion order");
});

test("Mermaid refuses a direction it does not know.", () => {
  assert.throws(() => toMermaid(createGraph(), { direction: "UP" }), TypeError);
  assert.throws(() => toMermaid(createGraph(), { direction: "TD\n  m0 --> m1" }), /direction/);
  assert.ok(toMermaid(createGraph(), { direction: "LR" }).startsWith("flowchart LR"));
});
