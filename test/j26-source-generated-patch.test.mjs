import test from "node:test";
import assert from "node:assert/strict";
import { gyrobifastigiumJ26 } from "@red-cup-engineering/metrologic/articulation/predicating/geometry/spatial/gyrobifastigium-j26";
import { j26CellularSurface, j26FacePatch, j26PunctureView } from "../src/j26-surface.mjs";
import { burgersOfComplex } from "../src/cohomology.mjs";

const reversePairs = (left, right) =>
  left.map((from,i)=>[from,right[(right.length-i)%right.length]]);
const face=(id)=>gyrobifastigiumJ26.faces.find(f=>f.name===id).vertices;
const connection=(id,lt,lf,rt,rf)=>({
  id,left:{tile:lt,face:lf},right:{tile:rt,face:rf},
  vertexPairs:reversePairs(face(lf),face(rf)),
});

test("Metrologic's current J26 produces a real closed 3-cell and exactly 14 signed oppositions",()=>{
  const surface=j26CellularSurface();
  assert.equal(surface.kind,"signgraph.j26.cellular-surface.v1");
  assert.equal(surface.vertices.length,8);
  assert.equal(surface.edges.length,14);
  assert.equal(surface.faces.length,8);
  assert.equal(surface.faceAdjacency.length,14);
  assert.equal(surface.complex.volumes.length,1);
  assert.equal(surface.complex.totalFaceBoundaryCloses,true);
  assert.deepEqual(surface.complex.totalFaceBoundary,new Array(14).fill(0));
  assert.deepEqual(surface.complex.surfaceBetti,{h0:1,h1:0,h2:1});
  assert.deepEqual(surface.complex.betti,{h0:1,h1:0,h2:0,h3:0});
  assert.equal(surface.faces.filter(f=>f.kind==="triangle").length,4);
  assert.equal(surface.faces.filter(f=>f.kind==="square").length,4);
});

test("a single misoriented face cannot become an admitted J26 volume",()=>{
  const flipped={...gyrobifastigiumJ26,
    faces:gyrobifastigiumJ26.faces.map(face=>face.name==="rightTop"
      ? {...face,vertices:[...face.vertices].reverse()} : face)};
  assert.throws(()=>j26CellularSurface(flipped),/traverse each edge oppositely/);
});

test("no contact exists until two tiles have an explicit reversed face identification",()=>{
  const isolated=j26FacePatch({tiles:["north","south"]});
  assert.equal(isolated.adjacency.length,0);
  assert.equal(isolated.exposed.length,16);
  const patch=j26FacePatch({tiles:["north","south"],interfaces:[
    connection("f1","north","leftTop","south","leftTop"),
  ]});
  assert.equal(patch.kind,"signgraph.j26.combinatorial-patch.v1");
  assert.deepEqual(patch.adjacency,[{interface:"f1",from:"north",to:"south"}]);
  assert.equal(patch.exposed.length,14);
  assert.equal(patch.interfaces[0].vertexPairs.length,3);
});

test("three tiles admit separate triangular and square contacts, not fictional causal arrows",()=>{
  const patch=j26FacePatch({tiles:["A","B","C"],interfaces:[
    connection("tri","A","leftTop","B","leftTop"),
    connection("square","B","rightSide0","C","leftSide0"),
  ]});
  assert.equal(patch.interfaces.length,2);
  assert.equal(patch.exposed.length,20);
  assert.deepEqual(patch.adjacency.map(edge=>edge.interface),["tri","square"]);
});

test("incompatible, reused, invented or self-facing contacts refuse, rather than manufacturing a tiling",()=>{
  const valid=connection("f1","A","leftTop","B","leftTop");
  const reversedWrong={...valid,vertexPairs:face("leftTop").map(v=>[v,v])};
  const badType=connection("wrong","A","leftTop","B","leftSide0");
  for(const bad of [
    reversedWrong,badType,
    {...valid,right:{tile:"A",face:"rightTop"}},
    {...valid,right:{tile:"outside",face:"leftTop"}},
    {...valid,right:{tile:"B",face:"ghost"}},
    {...valid,vertexPairs:[[ "q0","q0" ],["q1","q0"],["a","q1"]]},
  ]) assert.throws(()=>j26FacePatch({tiles:["A","B"],interfaces:[bad]}),TypeError);
  assert.throws(()=>j26FacePatch({tiles:["A","A"]}),/duplicate tile/);
  assert.throws(()=>j26FacePatch({tiles:["A","B"],interfaces:[valid,{...valid,id:"f2"}]}),
    /already consumed/);
  assert.throws(()=>j26FacePatch({tiles:["A","B"],interfaces:[valid,valid]}),/duplicate interface/);
});

// The older Science Python J26 research (Obsmetrologia PR #69) uses a
// different but congruent coordinate/vertex chart. These integer points
// and face names are a ONE-TIME source-matching fixture, not another
// geometry engine or an independently installed Python solver.
const legacyJ26 = Object.freeze({
  vertices: Object.freeze({
    A: [0, 0, 0], B: [2, 0, 0], C: [1, 1, 0], D: [0, 0, 2],
    E: [2, 0, 2], F: [1, 1, 2], G: [0, -1, 1], H: [2, -1, 1],
  }),
  faces: Object.freeze({
    T0: { sourceFace: "leftTop", cycle: "CBA" },
    T1: { sourceFace: "leftBottom", cycle: "DEF" },
    T2: { sourceFace: "rightTop", cycle: "GDA" },
    T3: { sourceFace: "rightBottom", cycle: "BEH" },
    S0: { sourceFace: "leftSide1", cycle: "BCFE" },
    S1: { sourceFace: "leftSide0", cycle: "CADF" },
    S2: { sourceFace: "rightSide1", cycle: "ABHG" },
    S3: { sourceFace: "rightSide0", cycle: "GHED" },
  }),
  // Explicit, verified source bijection: 8 vertices/14 edges/8 faces.
  vertexMap: Object.freeze({
    A: "q1", B: "q0", C: "a", D: "q2",
    E: "q3", F: "b", G: "c", H: "d",
  }),
});

const integerReferenceAtSource = () => Object.fromEntries(
  Object.entries(legacyJ26.vertexMap).map(([old, native]) =>
    [native, legacyJ26.vertices[old]]));
const delta = (after, before) => after.map((v, i) => v - before[i]);
const referenceGradient = (surface, points) =>
  surface.edges.map(({ from, to }) => delta(points[to], points[from]));
const fieldAtSourceEdge = (surface, field, from, to, increment) => {
  const next = field.map(v => [...v]);
  const index = surface.edges.findIndex(e =>
    (e.from === from && e.to === to) || (e.from === to && e.to === from));
  assert.notEqual(index, -1, "source edge must exist, not be inferred");
  const edge = surface.edges[index];
  next[index][2] += edge.from === from ? increment : -increment;
  return next;
};
const vectorFieldOnView = (surface, field, view) => {
  const byIdentity = new Map(surface.edges.map((edge, i) => [edge.id, field[i]]));
  return view.complex.edges.map(edge => byIdentity.get(edge.id));
};


test("old J26 research chart matches EXACT original Metrologic vertices and oriented faces", () => {
  // Source Python integer triple (i,j,k) represents (i/2, j*sqrt(3)/2, k/2).
  // This explicit Euclidean reflection/translation maps the chart onto the
  // native geometry. Do not identify chart labels without this proof obligation.
  for (const [old, [i, j, k]] of Object.entries(legacyJ26.vertices)) {
    const transformed = [j === 0 ? 0 : -j * Math.sqrt(3) / 2, 0.5 - i / 2, -0.5 + k / 2];
    assert.deepEqual(transformed, gyrobifastigiumJ26.vertices[legacyJ26.vertexMap[old]], old);
  }
  const source = j26CellularSurface();
  for (const [old, { sourceFace, cycle }] of Object.entries(legacyJ26.faces)) {
    const nativeCycle = source.faces.find(face => face.id === sourceFace).vertices;
    const mapped = [...cycle].map(vertex => legacyJ26.vertexMap[vertex]);
    assert.ok(nativeCycle.some((_, shift) =>
      mapped.every((vertex, i) => vertex === nativeCycle[(shift + i) % mapped.length])),
      "source face cycle/orientation must match exactly: " + old);
  }
  assert.equal(source.vertices.length, 8);
  assert.equal(source.edges.length, 14);
  assert.equal(source.faces.length, 8);
});

test("genuine open-face deletion and closed-face-support restriction give different H1", () => {
  const one = j26PunctureView({ removedFaces: ["leftTop"], retention: "face-support" });
  assert.deepEqual(one.complex.betti, { h0: 1, h1: 0, h2: 0 });
  const separated = ["leftTop", "leftBottom"];
  const holeSkeleton = j26PunctureView({ removedFaces: separated, retention: "skeleton" });
  const holeSupport = j26PunctureView({ removedFaces: separated, retention: "face-support" });
  assert.deepEqual(holeSkeleton.complex.betti, { h0: 1, h1: 1, h2: 0 });
  assert.deepEqual(holeSupport.complex.betti, { h0: 1, h1: 1, h2: 0 });
  assert.equal(holeSupport.complex.edges.length, 14);
  assert.ok(Object.isFrozen(holeSupport) && Object.isFrozen(holeSupport.complex));
  assert.deepEqual(holeSupport.removedFaces, separated);

  // Python T0+S0 are native leftTop+leftSide1 under the explicit chart map.
  const adjacent = ["leftTop", "leftSide1"];
  const skeleton = j26PunctureView({ removedFaces: adjacent, retention: "skeleton" });
  const support = j26PunctureView({ removedFaces: adjacent, retention: "face-support" });
  assert.deepEqual(skeleton.complex.betti, { h0: 1, h1: 1, h2: 0 });
  assert.deepEqual(support.complex.betti, { h0: 1, h1: 0, h2: 0 });
  assert.deepEqual([skeleton.complex.edges.length, support.complex.edges.length], [14, 13]);
  assert.deepEqual(support.droppedVertices, []);
  assert.equal(support.droppedEdges.length, 1);
  const deleted = j26CellularSurface().edges.find(e => e.id === support.droppedEdges[0]);
  assert.deepEqual([deleted.from, deleted.to].sort(), ["a", "q0"]);
  assert.deepEqual(
    j26PunctureView({ removedFaces: [...adjacent].reverse(), retention: "face-support" }).complex.betti,
    support.complex.betti);
});

test("original SignGraph Burgers identifies local J26 defect versus punctured global class", () => {
  const surface = j26CellularSurface();
  const potentials = integerReferenceAtSource();
  const reference = referenceGradient(surface, potentials);
  const exact = burgersOfComplex(surface.complex, reference);
  assert.equal(exact.classification, "exact");
  assert.equal(exact.exact, true);
  assert.equal(exact.localFlat, true);

  // Python B -> C and E -> F become native q0 -> a and q3 -> b,
  // with their signs taken from the ORIGINAL oriented edges.
  const localField = fieldAtSourceEdge(surface, reference, "q0", "a", 1);
  const local = burgersOfComplex(surface.complex, localField);
  assert.equal(local.classification, "local-defect");
  assert.deepEqual(local.faceResidues.filter(face => !face.flat)
    .map(face => [face.id, face.burgers]), [
    ["leftTop", [0, 0, -1]],
    ["leftSide1", [0, 0, 1]],
  ]);

  const two = fieldAtSourceEdge(surface, localField, "q3", "b", 1);
  const full = burgersOfComplex(surface.complex, two);
  assert.deepEqual(full.faceResidues.filter(face => !face.flat)
    .map(face => [face.id, face.burgers]), [
    ["leftTop", [0, 0, -1]],
    ["leftBottom", [0, 0, 1]],
  ]);
  const punctured = j26PunctureView({
    removedFaces: ["leftTop", "leftBottom"], retention: "face-support",
  });
  const transported = burgersOfComplex(punctured.complex, vectorFieldOnView(surface, two, punctured));
  assert.equal(transported.classification, "global-holonomy");
  assert.equal(transported.localFlat, true);
  assert.equal(transported.exact, false);
  assert.equal(transported.nontrivialGlobalClass, true);
  assert.ok(transported.faceResidues.every(face => face.flat));
  assert.ok(transported.cycleResidues.length > 0);
  assert.ok(!Object.hasOwn(transported, "authorized"),
    "a mathematical holonomy classification confers no Work or repair authority");

  // An altered original vertex potential produces a DIFFERENT globally exact
  // field that closure cannot tell apart from the source reference.
  const altered = { ...potentials, q0: [potentials.q0[0] + 1, ...potentials.q0.slice(1)] };
  const shifted = referenceGradient(surface, altered);
  assert.notDeepEqual(shifted, reference);
  assert.equal(burgersOfComplex(surface.complex, shifted).classification, "exact");
});

test("native puncture readout refuses invented/ambiguous faces and retention", () => {
  for (const bad of [
    {}, { removedFaces: ["leftTop"] }, { removedFaces: [], retention: "skeleton" },
    { removedFaces: ["leftTop"], retention: "implicit" },
    { removedFaces: ["ghost"], retention: "skeleton" },
    { removedFaces: ["leftTop", "leftTop"], retention: "skeleton" },
    { removedFaces: [1], retention: "skeleton" },
    { removedFaces: "leftTop", retention: "skeleton" },
    { removedFaces: gyrobifastigiumJ26.faces.map(f => f.name), retention: "skeleton" },
  ]) assert.throws(() => j26PunctureView(bad), TypeError);
  const original = j26CellularSurface();
  j26PunctureView({ removedFaces: ["leftTop"], retention: "skeleton" });
  assert.deepEqual(j26CellularSurface().complex.betti, original.complex.betti,
    "finite observation must not mutate the original closed source");
});


test("every proper J26 face removal uses original exact homology, not Python rank", () => {
  const source = j26CellularSurface();
  const ids = source.faces.map(face => face.id);
  const adjacency = new Map(ids.map(id => [id, new Set()]));
  for (const { faces } of source.faceAdjacency) {
    const [a, b] = faces;
    assert.notEqual(a, b);
    adjacency.get(a).add(b);
    adjacency.get(b).add(a);
  }
  // This is an independent combinatorial oracle over the ORIGINAL dual
  // face-incidence graph. The exact ranks/Betti numbers come exclusively
  // from the existing SignGraph cellular2Complex mathematics.
  const dualComponents = (selected) => {
    const unseen = new Set(selected);
    let count = 0;
    while (unseen.size) {
      const first = unseen.values().next().value;
      const stack = [first];
      unseen.delete(first);
      count++;
      while (stack.length) {
        for (const neighbor of adjacency.get(stack.pop())) {
          if (!unseen.delete(neighbor)) continue;
          stack.push(neighbor);
        }
      }
    }
    return count;
  };
  let checked = 0;
  let adjacentPairs = 0;
  let separatedPairs = 0;
  for (let mask = 1; mask < (1 << ids.length) - 1; mask++) {
    const removedFaces = ids.filter((_, i) => (mask & (1 << i)) !== 0);
    const open = j26PunctureView({ removedFaces, retention: "skeleton" });
    const support = j26PunctureView({ removedFaces, retention: "face-support" });
    assert.deepEqual(open.complex.betti, {
      h0: 1, h1: removedFaces.length - 1, h2: 0,
    }, "open-cell deletion, mask " + mask);
    assert.deepEqual(open.complex.rank, {
      zero: 7, one: 8 - removedFaces.length,
    }, "original skeleton must retain each edge, mask " + mask);
    assert.equal(support.complex.betti.h1, dualComponents(removedFaces) - 1,
      "face-support H1 must match independent missing-face-dual topology, mask " + mask);
    assert.equal(support.complex.betti.h2, 0);
    assert.equal(
      support.complex.vertices.length - support.complex.edges.length + support.complex.faces.length,
      support.complex.betti.h0 - support.complex.betti.h1 + support.complex.betti.h2,
      "actual retained support Euler equality, mask " + mask);
    assert.equal(open.complex.graphOnlyH1, 7);
    if (removedFaces.length === 2) {
      if (support.complex.betti.h1 === 0) adjacentPairs++;
      else if (support.complex.betti.h1 === 1) separatedPairs++;
    }
    checked++;
  }
  assert.equal(checked, 254);
  assert.deepEqual([adjacentPairs, separatedPairs], [14, 14]);
});
