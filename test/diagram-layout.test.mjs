import test from "node:test";
import assert from "node:assert/strict";
import { layout, presentedCategoryDiagram, writeMermaid, readMermaid } from "../src/diagram.mjs";

const opts = Object.freeze({ margin: 34, nodeWidth: 190, nodeHeight: 42, hGap: 34, vGap: 76 });
const directed = (pairs) => pairs.map(([from, to]) => ({ from, to }));
const boxes = (result) => [...result.boxes.entries()];

test("the original acyclic diagram keeps its longest-path placement and exact geometry", () => {
  const ids = ["a", "b", "c", "d", "e", "f"];
  const source = directed([["a", "b"], ["a", "c"], ["b", "d"], ["c", "d"], ["a", "e"], ["e", "f"], ["b", "f"]]);
  const first = layout(ids, source, opts);
  assert.equal(first.width, 706);
  assert.equal(first.height, 346);
  assert.equal(first.boxes.get("a").cy, 55);
  assert.equal(first.boxes.get("b").cy, 173);
  assert.equal(first.boxes.get("c").cy, 173);
  assert.equal(first.boxes.get("e").cy, 173);
  assert.equal(first.boxes.get("d").cy, 291);
  assert.equal(first.boxes.get("f").cy, 291);
  assert.deepEqual(boxes(first), boxes(layout(ids, [...source].reverse(), opts)));
  assert.deepEqual(ids, ["a", "b", "c", "d", "e", "f"], "source order is not mutated");
});

test("shortcut edges do not collapse the original longest-path depth", () => {
  const result = layout(["a", "b", "c", "d", "e"],
    directed([["a", "b"], ["b", "c"], ["a", "c"], ["c", "d"], ["a", "e"]]), opts);
  assert.ok(result.boxes.get("c").cy > result.boxes.get("b").cy);
  assert.ok(result.boxes.get("d").cy > result.boxes.get("c").cy);
  assert.equal(result.boxes.get("a").cy, result.boxes.get("e").cy - opts.vGap - opts.nodeHeight);
});

test("cycles and self-loops use finite graph component layers, not accumulating false depth", () => {
  const ids = ["a", "b", "c", "d", "e"];
  const edges = directed([["a", "b"], ["b", "c"], ["c", "b"], ["c", "d"], ["d", "e"]]);
  const diagram = layout(ids, edges, opts);
  assert.equal(diagram.boxes.get("b").cy, diagram.boxes.get("c").cy);
  assert.ok(diagram.boxes.get("d").cy > diagram.boxes.get("c").cy);
  assert.ok(diagram.boxes.get("e").cy > diagram.boxes.get("d").cy);
  assert.deepEqual(boxes(diagram), boxes(layout(ids, edges, opts)));
  const reflexive = layout(["x", "y"], directed([["x", "x"], ["x", "y"]]), opts);
  assert.ok(reflexive.boxes.get("y").cy > reflexive.boxes.get("x").cy);
});

test("foreign morphisms, duplicated object positions and malformed ids refuse before rendering", () => {
  assert.throws(() => layout(["a"], directed([["a", "missing"]]), opts),
    /morphisms must connect declared objects/);
  assert.throws(() => layout(["a", "a"], [], opts), /object IDs must be distinct/);
  assert.throws(() => layout(["a", ""], [], opts), /node id must be a non-empty string/);
  const normal = layout(["a", "b"], directed([["a", "b"]]), opts);
  const duplicated = layout(["a", "b"], directed([["a", "b"], ["a", "b"]]), opts);
  assert.deepEqual(boxes(normal), boxes(duplicated));
});

test("the empty drawing keeps its historical blank canvas contract", () => {
  const result = layout([], [], opts);
  assert.equal(result.width, 258);
  assert.equal(result.height, 68);
  assert.deepEqual(boxes(result), []);
});


test("diagram Mermaid projections retain five distinct Mark/NI addresses that sanitize identically", () => {
  const ids = ["a b", "a/b", "a_b", "ni:///sha-256;a.b", "ni:///sha-256;a_b"];
  const pairs = [["a b", "a/b"], ["a_b", "ni:///sha-256;a.b"], ["ni:///sha-256;a.b", "ni:///sha-256;a_b"]];
  const diagram = presentedCategoryDiagram({
    title: "address-sensitive graph",
    objects: ids.map(id => ({ id, label: id })),
    morphisms: pairs.map(([from, to]) => ({ from, to, label: "relates", kind: "relation" })),
  });
  const mermaid = writeMermaid(diagram);
  const aliases = new Map([...mermaid.matchAll(/^  (m\d+)\["([^"]+)"\]$/gm)]
    .map(([, alias, id]) => [id, alias]));
  assert.deepEqual([...aliases.keys()].sort(), [...ids].sort());
  assert.equal(new Set(aliases.values()).size, ids.length, "rendering cannot merge addresses");
  for (const [from, to] of pairs)
    assert.ok(mermaid.includes("  " + aliases.get(from) + " -->|relation: relates| " + aliases.get(to)));
  const reread = readMermaid(mermaid);
  assert.deepEqual(reread.objects, diagram.objects, "roundtrip source metadata retains complete object identities");
  assert.deepEqual(reread.morphisms, diagram.morphisms);
  const reordered = presentedCategoryDiagram({
    title: "address-sensitive graph",
    objects: [...ids].reverse().map(id => ({ id, label: id })),
    morphisms: pairs.map(([from, to]) => ({ from, to, label: "relates", kind: "relation" })),
  });
  const rereadAliases = new Map([...writeMermaid(reordered).matchAll(/^  (m\d+)\["([^"]+)"\]$/gm)]
    .map(([, alias, id]) => [id, alias]));
  assert.deepEqual(rereadAliases, aliases, "local aliases are independent of object insertion order");
});

test("diagram projection refuses foreign or duplicate object positions rather than drawing forged edges", () => {
  const objects = [{ id: "a" }, { id: "b" }];
  const graph = (members, morphisms) => presentedCategoryDiagram({ objects: members, morphisms });
  assert.throws(() => writeMermaid(graph(objects, [{ from: "a", to: "foreign" }])), /declared objects/);
  assert.throws(() => writeMermaid(graph([objects[0], objects[0]], [])), /distinct/);
});
