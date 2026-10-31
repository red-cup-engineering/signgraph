import test from "node:test";
import assert from "node:assert/strict";
import { cell } from "@red-cup-engineering/signcell/cell";
import { cellular2Complex, cohomologyReceiptOfCells } from "../src/cohomology.mjs";
import {
  apply, applyLaplacian, admitCellularSheaf, cellularSheaf, cellularSheafCohomology, exactCohomologyRankWithinBudget, MAX_EXACT_COHOMOLOGY_RANK_SLOTS, coboundary, cochain, constantSheaf, sheafSourceScalar,
  compareFixedCountRigidity, planConnectedBarExchanges, diffuse, harmonicProjection, hodgeCheck, rigidityReceipt, rigiditySheaf, sheafLaplacian,
  weightedSheafDirichlet, weightedSheafLaplacian, extendCellularSheafSection, tensorCellularSheaves, pullbackCellularSheaf, glueCellularSheafPatches,
} from "../src/cellular-sheaf.mjs";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);



test("cochain: finite numeric vertex readings admit idempotent repetition, not false gluing", () => {
  const s = cellularSheaf({ vertices: [{ id: "a", dim: 2 }, { id: "b", dim: 1 }], edges: [] });
  assert.deepEqual(cochain(s, [{ vertex: "a", value: [1, 2] }, { vertex: "b", value: 3 }]), [1, 2, 3]);
  assert.throws(() => cochain(s, [{ vertex: "a", value: [1, 2] }], { missing: "refuse" }),
    /incomplete observation omitted 1 positive-dimensional stalks/u);
  assert.deepEqual(cochain(s, [{ vertex: "a", value: [1, 2] }, { vertex: "b", value: 0 }], { missing: "refuse" }), [1, 2, 0],
    "an actually supplied zero differs from zero extension");
  assert.deepEqual(cochain(s, [{ vertex: "a", value: [1, 2] }], { missing: "zero" }), [1, 2, 0]);
  assert.throws(() => cochain(s, [], { missing: "unknown" }), /missing policy/u);
  assert.deepEqual(cochain(s, [{ vertex: "a", value: [1, 2] }, { vertex: "a", value: [1, 2] }]), [1, 2, 0]);
  assert.throws(
    () => cochain(s, [{ vertex: "a", value: [1, 2] }, { vertex: "a", value: [1, 3] }]),
    /conflicting duplicate vertex readings/,
  );
  for (const invalid of [[1, Infinity], [NaN, 0], ["1", 2], [undefined, 1]]) {
    assert.throws(() => cochain(s, [{ vertex: "a", value: invalid }]), /finite numbers/);
  }
  assert.throws(() => cochain(s, [{ vertex: "b", value: -Infinity }]), /finite numbers/);
  assert.throws(() => cochain(s, [{ vertex: "missing", value: 1 }]), /unknown vertex/);
});

test("cellularSheaf: validates shapes, ids and endpoints", () => {
  const v = [{ id: "a", dim: 2 }, { id: "b", dim: 1 }];
  const ok = { id: "e", from: "a", to: "b", dim: 1, restrict: { from: [[1, 0]], to: [[1]] } };
  assert.equal(cellularSheaf({ vertices: v, edges: [ok] }).c0, 3);
  assert.throws(() => cellularSheaf({ vertices: v, edges: [{ ...ok, restrict: { from: [[1]], to: [[1]] } }] }), RangeError);
  assert.throws(() => cellularSheaf({ vertices: [...v, { id: "a", dim: 1 }], edges: [] }), RangeError);
  assert.throws(() => cellularSheaf({ vertices: v, edges: [{ ...ok, to: "z" }] }), RangeError);
  assert.ok(Object.isFrozen(cellularSheaf({ vertices: v, edges: [ok] })));
});

test("constant sheaf source ownership excludes foreign array methods, accessor edges and undeclared incidence", () => {
  const vertices=["alpha","beta"];
  const existing=constantSheaf(vertices,[["alpha","beta"]]);
  assert.equal(existing.vertices.length,2);
  assert.equal(existing.edges.length,1);
  assert.equal(existing.edges[0].id,0);
  assert.equal(cellularSheafCohomology(existing).h0,1);
  assert.deepEqual(cochain(existing,[
    {vertex:"alpha",value:3},{vertex:"beta",value:3},
  ],{missing:"refuse"}),[3,3],
    "the original cochain consumer receives the repaired constant chart");
  const withOwnId=constantSheaf(vertices,[{id:"claim:e",from:"alpha",to:"beta"}]);
  assert.equal(withOwnId.edges[0].id,"claim:e");
  const withoutId=constantSheaf(vertices,[{from:"alpha",to:"beta"}]);
  assert.equal(withoutId.edges[0].id,0);
  const nullProto=Object.assign(Object.create(null),{
    id:"source:null-prototype",from:"alpha",to:"beta",
  });
  assert.equal(constantSheaf(vertices,[nullProto]).edges[0].id,
    "source:null-prototype");

  let executable=0;
  const hostileVertices=[...vertices];
  Object.defineProperty(hostileVertices,"map",{enumerable:true,get(){
    executable++;throw Error("a foreign source map was invoked");
  }});
  assert.throws(()=>constantSheaf(hostileVertices,[["alpha","beta"]]),
    /constantSheaf vertices.*sparse or decorated/);
  const hostileEdges=[["alpha","beta"]];
  Object.defineProperty(hostileEdges,"map",{enumerable:true,get(){
    executable++;throw Error("a foreign edge list map was invoked");
  }});
  assert.throws(()=>constantSheaf(vertices,hostileEdges),
    /constantSheaf edges.*sparse or decorated/);
  const accessor={id:"claimed:e",to:"beta"};
  Object.defineProperty(accessor,"from",{enumerable:true,get(){
    executable++;throw Error("a foreign edge source getter was invoked");
  }});
  assert.throws(()=>constantSheaf(vertices,[accessor]),
    /constantSheaf source edge.*inert own source fields/);
  const inherited=Object.assign(Object.create({from:"alpha"}),{
    id:"claim:e",to:"beta",
  });
  assert.throws(()=>constantSheaf(vertices,[inherited]),
    /constantSheaf source edge.*plain original source record/);
  const hidden={from:"alpha",to:"beta"};
  Object.defineProperty(hidden,"authority",{value:"unearned"});
  assert.throws(()=>constantSheaf(vertices,[hidden]),
    /constantSheaf source edge.*exact inert own source fields/);
  const decoratedTuple=["alpha","beta"];
  Object.defineProperty(decoratedTuple,Symbol.iterator,{get(){
    executable++;throw Error("tuple iterator invoked");
  }});
  assert.throws(()=>constantSheaf(vertices,[decoratedTuple]),
    /constantSheaf edge pair.*sparse or decorated/);
  assert.throws(()=>constantSheaf(vertices,[["alpha","beta","hidden"]]),
    /exactly two endpoints/);
  assert.equal(executable,0,
    "source admission never executes caller array methods, getters or iterators");
});

test("constant sheaf construction checks work budgets and safe coordinate sums before allocating dense matrices",()=>{
  const vertices=["a","b"];
  assert.throws(()=>constantSheaf(vertices,[["a","b"]],2048),
    /dense restriction construction not evaluated; coefficient slot budget exceeded/);
  assert.throws(()=>constantSheaf(vertices,[["a","b"]],Number.MAX_SAFE_INTEGER),
    /dense restriction construction not evaluated/);
  for(const dim of [NaN,Infinity,-1,1.1,Number.MAX_SAFE_INTEGER+1])
    assert.throws(()=>constantSheaf(vertices,[["a","b"]],dim),
      /dimension must be a nonnegative safe integer/);
  let accesses=0;
  const oversized=Array(65537).fill("a");
  Object.defineProperty(oversized,Symbol.iterator,{get(){
    accesses++;throw Error("unbounded input visited");
  }});
  assert.throws(()=>constantSheaf(oversized,[]),
    /source lists exceed finite admission budget/);
  assert.throws(()=>constantSheaf(vertices,Array(65537).fill(["a","b"])),
    /source lists exceed finite admission budget/);
  assert.equal(accesses,0);
  // No O(dim²) identity matrix is allocated for an edgeless source,
  // while the underlying chart must still have representable coordinates.
  const edgeless=constantSheaf(vertices,[],0);
  assert.equal(edgeless.c0,0);
  assert.equal(edgeless.c1,0);
  assert.equal(cellularSheafCohomology(edgeless).h0,0);
  assert.throws(()=>constantSheaf(vertices,[],Number.MAX_SAFE_INTEGER),
    /vertex coordinate index exceeds safe integer range/);
  assert.throws(()=>cellularSheaf({
    vertices:[{id:"one",dim:Number.MAX_SAFE_INTEGER},{id:"two",dim:1}],
    edges:[],
  }),/vertex coordinate index exceeds safe integer range/,
    "the original general chart owner also refuses rounded cochain coordinates");
  const exact=constantSheaf(vertices,[["a","b"]],2);
  assert.equal(exact.c0,4);
  assert.equal(exact.c1,2);
  assert.equal(cellularSheafCohomology(exact).h0,2);
  assert.equal(cellularSheafCohomology(exact).h1,0);
});

test("coboundary and Laplacian: (δx)_e = F_to x_to − F_from x_from, L = δᵀδ", () => {
  const s = constantSheaf(["a", "b", "c"], [["a", "b"], ["b", "c"]]);
  assert.deepEqual(apply(coboundary(s), [1, 3, 6]), [2, 3]);
  assert.deepEqual(applyLaplacian(s, [1, 3, 6]), [-2, -1, 3]);
  assert.deepEqual(applyLaplacian(s, [5, 5, 5]), [0, 0, 0]);
  const L = sheafLaplacian(s);
  assert.deepEqual(L.entries.map((row) => row.map(([, v]) => v)), [[1, -1], [-1, 2, -1], [-1, 1]]);
});

test("exact cohomology: agrees with cohomologyOfCells on the integer incidence", () => {
  const graphs = [
    { nodes: ["a", "b", "c"], edges: [["a", "b"], ["b", "c"], ["c", "a"]] },
    { nodes: ["a", "b", "c", "d", "e"], edges: [["a", "b"], ["b", "c"], ["d", "e"]] },
    { nodes: ["a", "b", "c", "d"], edges: [["a", "b"], ["a", "b"], ["b", "c"], ["c", "a"], ["c", "c"]] },
  ];
  for (const { nodes, edges } of graphs) {
    const reference = cohomologyReceiptOfCells(edges.map(([s, o]) => cell(s, "edge", o)), nodes);
    const r = cellularSheafCohomology(constantSheaf(nodes, edges));
    assert.equal(r.h0, reference.h0);
    assert.equal(r.h1, reference.h1);
    assert.equal(r.vanishing.kind, reference.vanishing.kind);
  }
});

test("exact cohomology: rational restrictions and a twisted cycle", () => {
  const vs = ["a", "b", "c"].map((id) => ({ id, dim: 1 }));
  const edge = (id, from, to, f, t) => ({ id, from, to, dim: 1, restrict: { from: [[f]], to: [[t]] } });
  const twisted = cellularSheaf({ vertices: vs, edges: [edge(1, "a", "b", 1, 1), edge(2, "b", "c", 1, 1), edge(3, "c", "a", "1/2", 1)] });
  const r = cellularSheafCohomology(twisted);
  assert.equal(r.h0, 0); assert.equal(r.h1, 0);
  const flat = cellularSheaf({ vertices: vs, edges: [edge(1, "a", "b", "1/3", "1/3"), edge(2, "b", "c", 1, 1)] });
  assert.equal(cellularSheafCohomology(flat).h0, 1);
  const inexact = cellularSheaf({ vertices: vs, edges: [edge(1, "a", "b", 0.5, 1)] });
  assert.throws(() => cellularSheafCohomology(inexact), RangeError);
});

test("exact cohomology admits original sheaf custody, not counterfeit dimensions or an exact label", () => {
  const built = constantSheaf(["source:a","source:b"], [["source:a","source:b"]]);
  const reference = cellularSheafCohomology(built);
  assert.equal(reference.h0,1);
  assert.equal(reference.h1,0);
  // A transported chart is mathematically re-admitted by the original
  // constructor; it is not trusted merely because its labels agree.
  const transported = JSON.parse(JSON.stringify(built));
  assert.deepEqual(cellularSheafCohomology(transported),reference);
  assert.equal(exactCohomologyRankWithinBudget(transported),true);
  assert.throws(()=>cellularSheafCohomology({exact:true,c0:3,c1:0,edges:[]}),
    /cellularSheaf chart/,
    "a caller cannot issue H0/H1 by inventing an exact rank-zero chart");
  assert.throws(()=>exactCohomologyRankWithinBudget({exact:true,c0:3,c1:0,edges:[]}),
    /cellularSheaf chart/,
    "budget qualification itself must not bless unissued geometry");
  const corrupted={...transported,c0:9};
  assert.throws(()=>cellularSheafCohomology(corrupted),
    /derived indices, dimensions, restrictions or exactness differ/,
    "a transported chart cannot rewrite original sheaf degree dimensions");
  let executed=0;
  const hostile={...transported};
  Object.defineProperty(hostile,"exact",{enumerable:true,get(){executed++;return true;}});
  assert.throws(()=>cellularSheafCohomology(hostile),/inert own source fields/);
  assert.equal(executed,0);
});

test("exact rational rank bounds dense coefficient work before materialization without manufacturing vanishing",()=>{
  const vertices=Array.from({length:257},(_,i)=>"source:vertex:"+i);
  const edges=Array.from({length:256},(_,i)=>[vertices[i],vertices[i+1]]);
  const expensive=constantSheaf(vertices,edges);
  assert.equal(expensive.c0,257);
  assert.equal(expensive.c1,256);
  assert.equal(MAX_EXACT_COHOMOLOGY_RANK_SLOTS,65536);
  assert.equal(exactCohomologyRankWithinBudget(expensive),false);
  assert.throws(()=>cellularSheafCohomology(expensive),
    /not evaluated; dense coefficient work budget exceeded/,
    "out-of-budget rank MUST refuse instead of claiming H1=0");
  const elementary=constantSheaf(["a","b","c"],[["a","b"],["b","c"]]);
  assert.equal(exactCohomologyRankWithinBudget(elementary),true);
  assert.equal(cellularSheafCohomology(elementary).h0,1);
  assert.equal(cellularSheafCohomology(elementary).h1,0);
  // A zero-row differential needs no rational matrix allocation, even if
  // its valid H0 rank dimension happens to exceed the dense work cap.
  const isolated=constantSheaf(vertices,[]);
  assert.equal(exactCohomologyRankWithinBudget(isolated),true);
  const trivial=cellularSheafCohomology(isolated);
  assert.equal(trivial.h0,257);
  assert.equal(trivial.h1,0);
});

test("exact H0/H1 retain original graph cohomology across all 512 three-position directed incidences",()=>{
  const vertices=["source:a","source:b","source:c"];
  const possible=vertices.flatMap((from,i)=>vertices.map((to,j)=>({
    id:"directed:"+i+":"+j,from,to,
  })));
  let verified=0;
  // Exhaustive finite metamodel over the nine independently present/absent
  // oriented incidences (including self loops). This is a finite conformance
  // assay of two existing source implementations, NOT a Lean theorem.
  for(let mask=0;mask<(1<<possible.length);mask++){
    const edges=possible.filter((_,i)=>(mask&(1<<i))!==0);
    const sheaf=cellularSheafCohomology(constantSheaf(vertices,edges));
    const complex=cellular2Complex({vertices,edges,faces:[]});
    assert.equal(sheaf.h0,complex.betti.h0,"H0 differs at mask "+mask);
    assert.equal(sheaf.h1,complex.graphOnlyH1,"graph-only H1 differs at mask "+mask);
    assert.equal(sheaf.rank,complex.rank.zero,"δ rank differs at mask "+mask);
    assert.equal(sheaf.h0-sheaf.h1,vertices.length-edges.length,
      "Euler relation differs at mask "+mask);
    verified++;
  }
  assert.equal(verified,512);
});

test("diffusion: converges to the harmonic section (component means) and lies in ker L", () => {
  const s = constantSheaf(["a", "b", "c", "d", "e"], [["a", "b"], ["b", "c"], ["d", "e"]]);
  const r = harmonicProjection(s, [1, 2, 6, 10, 20], { tolerance: 1e-12 });
  assert.ok(r.converged);
  [3, 3, 3, 15, 15].forEach((m, i) => near(r.section[i], m, 1e-9));
  near(r.residual, 0, 1e-9);
  assert.ok(r.firings.length > 0);
  const again = harmonicProjection(s, [1, 2, 6, 10, 20], { tolerance: 1e-12 });
  assert.deepEqual(again.section, r.section);
  assert.deepEqual(again.firings, r.firings);
});

test("Hodge degree 0: tree and rotated stalks admit globally harmonic sections", () => {
  const tree = constantSheaf(["a", "b", "c"], [["a", "b"], ["b", "c"]]);
  const h = hodgeCheck(tree, [4, -1, 9]);
  assert.equal(h.h1, 0);
  assert.ok(h.harmonic);
  near(h.sectionResidual, 0, 1e-9);
  near(h.laplacianResidual, 0, 1e-9);
  // a vector-valued sheaf with non-trivial restrictions: limit lies in ker δ
  const rot = cellularSheaf({
    vertices: [{ id: "a", dim: 2 }, { id: "b", dim: 2 }],
    edges: [{ id: "e", from: "a", to: "b", dim: 2, restrict: { from: [[0, -1], [1, 0]], to: [[1, 0], [0, 1]] } }],
  });
  const hr = hodgeCheck(rot, [1, 2, 3, 4]);
  assert.ok(hr.harmonic);
  near(hr.section[2], -hr.section[1], 1e-8); // x_b = R x_a = (-a1, a0)
  near(hr.section[3], hr.section[0], 1e-8);
});

test("Hodge degree 0: a balanced cycle has nonzero H⁰ and H¹ at once", () => {
  const cycle = constantSheaf(["a", "b", "c"], [["a", "b"], ["b", "c"], ["c", "a"]]);
  const cohomology = cellularSheafCohomology(cycle);
  assert.equal(cohomology.h0, 1);
  assert.equal(cohomology.h1, 1, "a cycle is not a forest, but still admits global sections");
  const projection = hodgeCheck(cycle, [1, 2, 9]);
  assert.equal(projection.h1, 1);
  assert.equal(projection.harmonic, true);
  [4, 4, 4].forEach((expected, i) => near(projection.section[i], expected));
  near(projection.sectionResidual, 0);
  near(projection.laplacianResidual, 0);
});

test("Hodge degree 0: frustrated signed cycle has H⁰ = H¹ = 0 and only the zero harmonic", () => {
  const edges = [
    { id: "ab", from: "a", to: "b" },
    { id: "bc", from: "b", to: "c" },
    { id: "ca", from: "c", to: "a" },
  ].map(({ id, from, to }) => ({
    id, from, to, dim: 1, restrict: { from: [[1]], to: [[-1]] },
  }));
  const cycle = cellularSheaf({
    vertices: ["a", "b", "c"].map((id) => ({ id, dim: 1 })), edges,
  });
  const cohomology = cellularSheafCohomology(cycle);
  assert.equal(cohomology.h0, 0, "odd negative holonomy destroys nonzero global sections");
  assert.equal(cohomology.h1, 0, "vanishing H¹ does not create a nonzero harmonic section");
  const delta = apply(coboundary(cycle), [1, 1, 1]);
  assert.deepEqual(delta, [-2, -2, -2]);
  assert.equal(delta.reduce((sum, r) => sum + r * r, 0), 12);
  const projection = hodgeCheck(cycle, [1, 1, 1]);
  assert.equal(projection.h1, 0);
  assert.equal(projection.harmonic, true, "the zero section is harmonic");
  projection.section.forEach((value) => near(value, 0));
  near(projection.sectionResidual, 0);
  near(projection.laplacianResidual, 0);
});

test("diffuse: pinned testimony is order-independent, identical repetition is idempotent, and incompatibility remains visible", () => {
  const s = constantSheaf(["a", "b"], [["a", "b"]]);
  const boundary = [{ vertex: "a", value: 0 }, { vertex: "b", value: 10 }];
  const conflict = diffuse(s, [3, 7], { fixed: boundary });
  assert.equal(conflict.converged, true, "all pinned coordinates are stationary");
  assert.equal(conflict.compatible, false, "stationary incompatible pins are not a global section");
  near(conflict.residual, 10);
  assert.deepEqual(diffuse(s, [3, 7], { fixed: [...boundary].reverse() }).section, conflict.section);
  const repeated = diffuse(s, [3, 7], { fixed: [{ vertex: "a", value: 0 }, { vertex: "a", value: 0 }] });
  assert.deepEqual(repeated.section, diffuse(s, [3, 7], { fixed: [{ vertex: "a", value: 0 }] }).section);
  for (const fixed of [
    [{ vertex: "a", value: 0 }, { vertex: "a", value: 1 }],
    [{ vertex: "a", value: 1 }, { vertex: "a", value: 0 }],
  ]) assert.throws(() => diffuse(s, [3, 7], { fixed }), /conflicting duplicate pinned/);
  assert.throws(() => diffuse(s, [3, 7], { fixed: [{ vertex: "a", value: Infinity }] }), /pinned stalk values/);
});

test("source-qualified heat flow rejects fabricated numeric vectors, boundary pins and options",()=>{
  const sheaf=constantSheaf(["a","b"],[["a","b"]]);
  let callbacks=0;
  const forged=[0,4];
  Object.defineProperty(forged,Symbol.iterator,{value(){
    callbacks++;return [4,0][Symbol.iterator]();
  }});
  assert.throws(()=>diffuse(sheaf,forged,{maxSteps:0}),
    /diffuse initial 0-cochain cannot be sparse or decorated/);
  const getterVector=[0,4];
  Object.defineProperty(getterVector,"0",{enumerable:true,get(){
    callbacks++;return 4;
  }});
  assert.throws(()=>diffuse(sheaf,getterVector,{maxSteps:0}),
    /diffuse initial 0-cochain array slots must be inert own data/);
  const forgedPin={value:4};
  Object.defineProperty(forgedPin,"vertex",{enumerable:true,get(){
    callbacks++;return "a";
  }});
  assert.throws(()=>diffuse(sheaf,[0,4],{maxSteps:0,fixed:[forgedPin]}),
    /diffuse fixed reading: requires exact inert own source fields/);
  const decoratedPin={vertex:"a",value:0};
  Object.defineProperty(decoratedPin,"sourceAuthority",{value:"fabricated"});
  assert.throws(()=>diffuse(sheaf,[0,4],{maxSteps:0,fixed:[decoratedPin]}),
    /diffuse fixed reading: requires exact inert own source fields/);
  const inheritedPin=Object.assign(Object.create({vertex:"a"}),{value:4});
  assert.throws(()=>diffuse(sheaf,[0,4],{maxSteps:0,fixed:[inheritedPin]}),
    /diffuse fixed reading: requires a plain original source record/);
  const pinnedValues=[0];
  Object.defineProperty(pinnedValues,"0",{enumerable:true,get(){
    callbacks++;return 0;
  }});
  assert.throws(()=>diffuse(sheaf,[0,4],{maxSteps:0,
    fixed:[{vertex:"a",value:pinnedValues}]}),
    /diffuse pinned coordinates array slots must be inert own data/);
  const maliciousOptions={maxSteps:0};
  Object.defineProperty(maliciousOptions,"tolerance",{enumerable:true,get(){
    callbacks++;return 1e-12;
  }});
  assert.throws(()=>diffuse(sheaf,[0,4],maliciousOptions),
    /diffuse options: requires exact inert own source fields/);
  assert.throws(()=>hodgeCheck(sheaf,[0,4],maliciousOptions),
    /hodgeCheck options: requires exact inert own source fields/);
  assert.throws(()=>diffuse(sheaf,[0,4],{unknown:"issued"}),
    /diffuse options: undeclared numerical option/);
  assert.throws(()=>diffuse(sheaf,[0,4],{maxSteps:1000001}),/maxSteps/);
  assert.equal(callbacks,0,"mathematical source admission runs no untrusted callbacks");

  const original=diffuse(sheaf,[0,4],{maxSteps:10});
  const typed=new Float64Array([0,4]);
  Object.defineProperty(typed,"length",{get(){
    callbacks++;throw Error("typed-array length override executed");
  }});
  Object.defineProperty(typed,Symbol.iterator,{value(){
    callbacks++;throw Error("typed-array iterator executed");
  }});
  assert.deepEqual(diffuse(sheaf,typed,{maxSteps:10}),original,
    "native numeric vector variants admit the same source coordinates");
  assert.equal(callbacks,0);
  const pinned=diffuse(sheaf,[0,4],{maxSteps:0,fixed:[{vertex:"a",value:0}]});
  assert.deepEqual(pinned.section,[0,4],"a legitimate pinned coordinate is retained");
});

test("diffuse: rejects unstable steps and non-finite inputs instead of certifying numeric settlement", () => {
  const s = constantSheaf(["a", "b"], [["a", "b"]]);
  const ordinary = diffuse(s, [0, 10]);
  assert.equal(ordinary.converged, true);
  assert.equal(ordinary.compatible, true);
  near(ordinary.section[0], 5); near(ordinary.section[1], 5);
  for (const step of [-1, 0, 1, 10, NaN, Infinity]) {
    assert.throws(() => diffuse(s, [0, 10], { step }), /Gershgorin bound/);
  }
  assert.ok(diffuse(s, [0, 10], { step: 0.8 }).converged);
  for (const value of [NaN, Infinity, "0"]) {
    assert.throws(() => diffuse(s, [value, 10]), /initial stalk values/);
  }
  assert.throws(() => diffuse(s, [0, 10], { tolerance: -1 }), /tolerance/);
  assert.throws(() => diffuse(s, [0, 10], { maxSteps: -1 }), /maxSteps/);
  assert.throws(() => diffuse(s, [0, 10], { maxSteps: 1.5 }), /maxSteps/);
  assert.throws(() => diffuse(s, [1e308, -1e308]), {
    name: "RangeError", message: "apply: numerical sum overflowed host arithmetic",
  });
});

test("shared sheaf norm preserves nonzero residual and normalized rigidity across the binary64 exponent range",()=>{
  const graph=constantSheaf(["a","b"],[["a","b"]]);
  const reverse=constantSheaf(["a","b"],[["b","a"]]);
  let verified=0;
  for(const magnitude of [1e-200,1e-100,1,1e100,1e200,1e308]){
    const result=diffuse(graph,[magnitude,0],{tolerance:0,maxSteps:0});
    const backward=diffuse(reverse,[magnitude,0],{tolerance:0,maxSteps:0});
    assert.equal(result.residual,magnitude,
      "original nonzero coboundary cannot be squared into zero at "+magnitude);
    assert.equal(result.compatible,false,
      "a nonzero exact-tolerance coboundary is not a global section");
    assert.equal(result.converged,false,
      "a nonzero exact-tolerance gradient cannot be called stationary");
    assert.equal(backward.residual,result.residual,
      "directed reversal preserves the source's Euclidean residual");
    verified++;
  }
  assert.equal(verified,6);
  assert.throws(()=>diffuse(graph,[1.5e308,0],{tolerance:0,maxSteps:0}),
    /numerical norm exceeded finite host arithmetic/,
    "an unrepresentable gradient norm must refuse, never become valid infinity");

  // The original normalized rigidity sheaf consumes this SAME native norm.
  // Both tiny and large but finite nonzero bars remain nonzero directions,
  // not spurious zero-length bars or all-zero restriction matrices.
  for(const length of [1e-200,1e200]){
    const sheaf=rigiditySheaf([[0,0],[length,0]],[[0,1]],2,
      {normalize:true});
    assert.deepEqual(sheaf.edges[0].restrict.from,[[1,0]]);
    assert.deepEqual(sheaf.edges[0].restrict.to,[[1,0]]);
  }
});

test("diffusion with pinned vertices: boundary conditions are admitted evidence", () => {
  const s = constantSheaf(["a", "b", "c"], [["a", "b"], ["b", "c"]]);
  const r = diffuse(s, cochain(s, []), { fixed: [{ vertex: "a", value: 0 }, { vertex: "c", value: 10 }], tolerance: 1e-12 });
  assert.ok(r.converged);
  near(r.section[0], 0); near(r.section[1], 5); near(r.section[2], 10);
  const conflict = diffuse(s, [0, 0, 0], { fixed: [{ vertex: "a", value: 0 }, { vertex: "b", value: 1 }], maxSteps: 10 });
  assert.ok(conflict.residual > 0);
});

test("rigidity: triangle rigid, open square flexes, braced square has a self-stress, tetrahedron rigid", () => {
  const tri = rigidityReceipt([[0, 0], [4, 0], [1, 3]], [[0, 1], [1, 2], [0, 2]], 2);
  assert.equal(tri.cohomology.h0, 3); assert.equal(tri.cohomology.h1, 0); assert.ok(tri.infinitesimallyRigid);
  const square = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const ring = [[0, 1], [1, 2], [2, 3], [3, 0]];
  const open = rigidityReceipt(square, ring, 2);
  assert.equal(open.cohomology.h0, 4); assert.equal(open.mechanisms, 1); assert.ok(!open.infinitesimallyRigid);
  const braced = rigidityReceipt(square, [...ring, [0, 2], [1, 3]], 2);
  assert.equal(braced.cohomology.h0, 3); assert.equal(braced.cohomology.h1, 1); assert.ok(braced.infinitesimallyRigid);
  const tet = rigidityReceipt([[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]], [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]], 3);
  assert.equal(tet.cohomology.h0, 6); assert.equal(tet.cohomology.h1, 0); assert.ok(tet.infinitesimallyRigid);
  // rational coordinates stay exact
  const rat = rigidityReceipt([["0", "0"], ["1/2", "0"], ["1/3", "2/5"]], [[0, 1], [1, 2], [0, 2]], 2);
  assert.ok(rat.infinitesimallyRigid);
  // Maxwell: m = dN − C − E + stresses
  assert.equal(braced.mechanisms - braced.selfStresses, 2 * 4 - 3 - 6);
  assert.equal(open.mechanisms - open.selfStresses, 2 * 4 - 3 - 4);
});

test("fixed-count embedded exchange can change rigidity without changing the Euler index", () => {
  // Lenticule's five-joint exact counterexample: these snapshots both have
  // 7 undirected bars and 5 joints, but distinct rigidity-matrix ranks.
  const points = [[0, 0], [2, 0], [0, 3], [3, 4], [5, 2]];
  const rigid = { points, bars: [[0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [1, 4], [2, 4]] };
  const flexible = { points, bars: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3], [3, 4]] };
  const change = compareFixedCountRigidity({ before: rigid, after: flexible, dimension: 2 });
  assert.equal(change.vertices, 5);
  assert.equal(change.bars, 7);
  assert.equal(change.eulerIndex, -2);
  assert.equal(change.meanCoordination, 14 / 5);
  assert.equal(change.before.cohomology.rank, 7);
  assert.equal(change.after.cohomology.rank, 6);
  assert.equal(change.before.mechanisms, 0);
  assert.equal(change.after.mechanisms, 1);
  assert.equal(change.before.selfStresses, 0);
  assert.equal(change.after.selfStresses, 1);
  assert.equal(change.rankDelta, -1);
  assert.equal(change.mechanismsDelta, 1);
  assert.equal(change.rigidityChanged, true);
  assert.equal(change.before.infinitesimallyRigid, true);
  assert.equal(change.after.infinitesimallyRigid, false);
  assert.ok(Object.isFrozen(change));

  const same = compareFixedCountRigidity({ before: rigid, after: rigid, dimension: 2 });
  assert.equal(same.rankDelta, 0);
  assert.equal(same.mechanismsDelta, 0);
  assert.equal(same.rigidityChanged, false);

  const reverse = compareFixedCountRigidity({ before: flexible, after: rigid, dimension: 2 });
  assert.equal(reverse.rankDelta, 1);
  assert.equal(reverse.mechanismsDelta, -1);
  assert.equal(reverse.rigidityChanged, true);

  assert.throws(() => compareFixedCountRigidity({ before: rigid,
    after: { ...flexible, bars: flexible.bars.slice(1) }, dimension: 2 }), /conserved vertex and bar counts/);
  assert.throws(() => compareFixedCountRigidity({ before: rigid,
    after: { ...flexible, points: flexible.points.slice(1) }, dimension: 2 }), /invalid bar endpoints|conserved vertex and bar counts/);
  assert.throws(() => compareFixedCountRigidity({ before: rigid,
    after: { ...flexible, bars: [[0, 1], [1, 0]] }, dimension: 2 }), /duplicate undirected bar/);
  assert.throws(() => compareFixedCountRigidity({ before: rigid,
    after: { ...flexible, bars: [[0, 5], ...flexible.bars.slice(1)] }, dimension: 2 }), /invalid bar endpoints/);
  assert.throws(() => compareFixedCountRigidity({ before: rigid, after: flexible, dimension: 4 }),
    /dimension 2 or 3/);
});

test("rigidity numerics: normalized (unit direction) sheaf diffuses to a rigid motion", () => {
  const s = rigiditySheaf([[0, 0], [1, 0], [0, 1]], [[0, 1], [1, 2], [0, 2]], 2, { normalize: true });
  const translation = [1, 2, 1, 2, 1, 2];
  near(apply(coboundary(s), translation).reduce((a, b) => a + Math.abs(b), 0), 0, 1e-12);
  const r = harmonicProjection(s, [0, 0, 1, 0.2, 0, 1], { tolerance: 1e-10 });
  assert.ok(r.converged);
  near(r.residual, 0, 1e-8);
});

import { applyTranspose, bodyBarReceipt, bodyBarSheaf, solveNormal } from "../src/cellular-sheaf.mjs";

test("solveNormal: min-norm solution of δᵀf = rhs; over-braced picks the harmonic representative", () => {
  // braced square (2D, 4 joints, 6 bars): one self-stress. Load the square in equilibrium: pull diagonal 0-2 apart.
  const pts = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const bars = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]];
  const s = rigiditySheaf(pts, bars, 2, { normalize: true });
  const load = [1, 1, 0, 0, -1, -1, 0, 0]; // equal and opposite along the diagonal
  const r = solveNormal(s, load);
  assert.ok(r.consistent && r.converged);
  const back = applyTranspose(coboundary(s), r.section);
  back.forEach((v, i) => near(v, load[i], 1e-9));
  // minimum norm: orthogonal to the self-stress, i.e. in the image of δ
  const again = solveNormal(s, load);
  assert.deepEqual(again.section, r.section); // deterministic
});

test("solveNormal: an unresolvable load is an obstruction in ker δ, not NaN", () => {
  // open square: a mechanism. A shear load is not carried.
  const pts = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const s = rigiditySheaf(pts, [[0, 1], [1, 2], [2, 3], [3, 0]], 2, { normalize: true });
  const shear = [0, -1, 0, 1, 0, 1, 0, -1]; // a net-zero force pattern of the shear mode: not in im δᵀ
  const r = solveNormal(s, shear);
  assert.ok(!r.consistent);
  assert.ok(Number.isFinite(r.residual) && r.residual > 0.1);
  near(norm2(apply(coboundary(s), r.obstruction)), 0, 1e-8); // the obstruction is a motion
});

test("normal loads admit the declared finite vector, never iterable claims or underflowed obstructions",()=>{
  const sheaf=constantSheaf(["a","b"],[["a","b"]]);
  let callbacks=0;
  const forged=[0,0];
  Object.defineProperty(forged,Symbol.iterator,{value(){
    callbacks++;return [1,-1][Symbol.iterator]();
  }});
  assert.throws(()=>solveNormal(sheaf,forged),
    /solveNormal source load cannot be sparse or decorated/);
  const accessor=[1,-1];
  Object.defineProperty(accessor,"0",{enumerable:true,get(){
    callbacks++;return 0;
  }});
  assert.throws(()=>solveNormal(sheaf,accessor),
    /solveNormal source load array slots must be inert own data/);
  const hostileOptions={};
  Object.defineProperty(hostileOptions,"maxSteps",{enumerable:true,get(){
    callbacks++;return 1000000;
  }});
  assert.throws(()=>solveNormal(sheaf,[1,-1],hostileOptions),
    /solveNormal options: requires exact inert own source fields/);
  for(const options of [{tolerance:NaN},{consistency:Infinity},{floor:-1},
      {maxSteps:-1},{maxSteps:1000001},{unknown:1}]){
    assert.throws(()=>solveNormal(sheaf,[1,-1],options),
      /solveNormal: (tolerance|consistency|floor|maxSteps)|solveNormal options:/);
  }
  for(const invalid of [[Infinity,0],[NaN,0],["1",0]]){
    assert.throws(()=>solveNormal(sheaf,invalid),/rhs stalk values must be finite numbers/);
  }
  assert.equal(callbacks,0,"normal solver cannot execute input getters or iterators");

  const expected=solveNormal(sheaf,[1,-1]);
  assert.ok(expected.consistent && expected.converged);
  const typed=new Float64Array([1,-1]);
  Object.defineProperty(typed,"length",{get(){
    callbacks++;throw Error("typed-array length override");
  }});
  Object.defineProperty(typed,Symbol.iterator,{value(){
    callbacks++;throw Error("typed-array iterator override");
  }});
  assert.deepEqual(solveNormal(sheaf,typed),expected);
  assert.equal(callbacks,0);
  const doubled=solveNormal(sheaf,[2,-2]);
  near(doubled.section[0],2*expected.section[0]);
  const reverse=constantSheaf(["a","b"],[["b","a"]]);
  const reversed=solveNormal(reverse,[1,-1]);
  near(reversed.section[0],-expected.section[0],
    1e-9);
  // A nonzero load on an edgeless original sheaf is a genuine obstruction.
  // In particular the small value must not be squared into a false zero.
  const noEdges=constantSheaf(["isolated"],[]);
  const small=solveNormal(noEdges,[1e-200]);
  assert.equal(small.converged,true);
  assert.equal(small.consistent,false);
  assert.equal(small.residual,1e-200);
  assert.equal(small.rhsNorm,1e-200);
});

const norm2 = (v) => Math.sqrt(v.reduce((a, b) => a + b * b, 0));

test("body-bar: a rigid pair joined by six generic bars is rigid; five leave one mechanism; collinear clusters are fine", () => {
  const bars = (list) => list.map(([a, b], i) => ({ id: i, kind: "bar", from: "A", to: "B", a, b }));
  // A at the origin; B displaced by (0,0,5); attachment points are collinear on each body's axis plus offsets.
  const six = bars([[[1, 0, 0], [1, 0, 5]], [[0, 1, 0], [1, 1, 6]], [[-1, 0, 0], [-2, 0, 5]], [[0, -1, 0], [0, -2, 5]], [[1, 1, 0], [0, 1, 4]], [[2, 0, 1], [2, 1, 5]]]);
  const full = bodyBarReceipt(["A", "B"], six);
  assert.equal(full.mechanisms, 0); assert.ok(full.rigid); assert.equal(full.pieces, 1);
  assert.ok(full.maxwell.holds);
  const five = bodyBarReceipt(["A", "B"], six.slice(0, 5));
  assert.equal(five.mechanisms, 1); assert.ok(!five.rigid); assert.ok(five.maxwell.holds);
  const seven = bodyBarReceipt(["A", "B"], [...six, { id: 9, kind: "bar", from: "A", to: "B", a: [3, 0, 0], b: [3, 2, 5] }]);
  assert.equal(seven.selfStresses, 1); assert.equal(seven.mechanisms, 0);
  const pin = bodyBarReceipt(["A", "B"], [{ id: "p", kind: "pin", from: "A", to: "B", at: [0, 0, 1] }]);
  assert.equal(pin.mechanisms, 3);
  const hinge = bodyBarReceipt(["A", "B"], [{ id: "h", kind: "hinge", from: "A", to: "B", at: [0, 0, 1], axis: [1, 0, 0] }]);
  assert.equal(hinge.mechanisms, 1);
  const apart = bodyBarReceipt(["A", "B"], []);
  assert.equal(apart.pieces, 2); assert.equal(apart.mechanisms, 0);
});

test("body-bar: equilibrium of a loaded rigid pair via solveNormal (unit rows are forces)", () => {
  // B hangs below A on three vertical bars; weight 3 on B, balanced by A.
  const tri = [[1, 0], [-1, 0], [0, 1]];
  const constraints = tri.map(([x, y], i) => ({ id: i, kind: "bar", from: "A", to: "B", a: [x, y, 0], b: [x, y, -2] }));
  const s = bodyBarSheaf(["A", "B"], constraints, { normalize: true });
  const loadOnB = [0, 0, -3, 0, 0, 0], loadOnA = [0, 0, 3, 0, 0, 0];
  // equilibrium: p + Rᵀf = 0 with f compression-positive: Rᵀf = −p
  const r = solveNormal(s, [...loadOnA, ...loadOnB].map((v) => -v));
  assert.ok(r.consistent);
  // tension is negative compression; moment balance puts the whole weight on the two bars at y = 0
  near(r.section[0], -1.5, 1e-9); near(r.section[1], -1.5, 1e-9); near(r.section[2], 0, 1e-9);
});

test("connected bar exchange actually fabricates a minimal count-preserving rigidity trajectory", () => {
  const points = [[0, 0], [2, 0], [0, 3], [3, 4], [5, 2]];
  const rigid = [[0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [1, 4], [2, 4]];
  const flexible = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3], [3, 4]];
  const path = planConnectedBarExchanges({ points, beforeBars: rigid, afterBars: flexible, dimension: 2 });
  assert.equal(path.kind, "signgraph.connectedBarExchangePath.v1");
  assert.equal(path.minimumSwapCount, 2);
  assert.equal(path.vertices, 5);
  assert.equal(path.bars, 7);
  assert.equal(path.eulerIndex, -2);
  assert.equal(path.meanCoordination, 14 / 5);
  assert.equal(path.startRigidity.cohomology.rank, 7);
  assert.equal(path.finalRigidity.cohomology.rank, 6);
  assert.deepEqual(path.exchanges.map(x => x.broken), [[1, 4], [2, 4]]);
  assert.deepEqual(path.exchanges.map(x => x.formed), [[2, 3], [3, 4]]);
  assert.equal(path.exchanges.reduce((rankChange, exchange) => rankChange + exchange.rankDelta, 0), -1);
  const edgeKey = ([a, b]) => [Math.min(a, b), Math.max(a, b)].join(":");
  const keys = list => new Set(list.map(edgeKey));
  const isConnected = bars => {
    const reached = new Set([0]), pending = [0];
    for (let at = 0; at < pending.length; at++) {
      for (const [u, v] of bars) {
        if (u === pending[at] && !reached.has(v)) { reached.add(v); pending.push(v); }
        if (v === pending[at] && !reached.has(u)) { reached.add(u); pending.push(u); }
      }
    }
    return reached.size === points.length;
  };
  let active = rigid;
  for (const step of path.exchanges) {
    assert.equal(step.resultBars.length, rigid.length);
    assert.equal(isConnected(step.resultBars), true);
    assert.ok(keys(active).has(edgeKey(step.broken)));
    assert.ok(!keys(active).has(edgeKey(step.formed)));
    const next = keys(step.resultBars);
    assert.ok(!next.has(edgeKey(step.broken)));
    assert.ok(next.has(edgeKey(step.formed)));
    assert.ok(Object.isFrozen(step) && Object.isFrozen(step.resultBars));
    active = step.resultBars;
  }
  assert.deepEqual(keys(active), keys(flexible));
  const back = planConnectedBarExchanges({ points, beforeBars: flexible, afterBars: rigid, dimension: 2 });
  assert.equal(back.minimumSwapCount, 2);
  assert.equal(back.startRigidity.cohomology.rank, 6);
  assert.equal(back.finalRigidity.cohomology.rank, 7);
  const same = planConnectedBarExchanges({
    points, beforeBars: rigid, afterBars: rigid.map(([u, v]) => [v, u]), dimension: 2,
  });
  assert.deepEqual(same.exchanges, []);
  assert.equal(same.startRigidity.cohomology.rank, same.finalRigidity.cohomology.rank);
  assert.throws(() => planConnectedBarExchanges({
    points, beforeBars: rigid, afterBars: flexible.slice(1), dimension: 2,
  }), /conserved vertex and bar counts/);
  assert.throws(() => planConnectedBarExchanges({
    points: [[0,0],[1,0],[0,1],[1,1]],
    beforeBars: [[0,1],[2,3]], afterBars: [[0,1],[1,2]], dimension: 2,
  }), /requires connected input and target networks/);
  assert.throws(() => planConnectedBarExchanges({
    points, beforeBars: rigid, afterBars: [...flexible.slice(0,-1), [1,0]], dimension: 2,
  }), /duplicate undirected bar/);
});

test("huge but finite exact sheaf restrictions now project faithfully through Data", () => {
  const huge = 10n ** 400n;
  const restriction = `${huge + 1n}/${huge}`;
  const s = cellularSheaf({
    vertices: [{ id: "a", dim: 1 }, { id: "b", dim: 1 }],
    edges: [{ id: "e", from: "a", to: "b", dim: 1,
      restrict: { from: [[restriction]], to: [[1]] } }],
  });
  assert.equal(s.exact, true);
  assert.equal(cellularSheafCohomology(s).h0, 1);
  assert.equal(cellularSheafCohomology(s).h1, 0);
  assert.deepEqual(apply(coboundary(s), [1, 2]), [1],
    "an exact ratio near 1 cannot turn into NaN because its inputs exceed binary64");
  assert.deepEqual(sheafLaplacian(s).entries, [
    [[0, 1], [1, -1]], [[0, -1], [1, 1]],
  ]);
  const overflowing = cellularSheaf({
    vertices: [{ id: "a", dim: 1 }, { id: "b", dim: 1 }],
    edges: [{ id: "f", from: "a", to: "b", dim: 1,
      restrict: { from: [["1" + "0".repeat(400)]], to: [[1]] } }],
  });
  assert.equal(cellularSheafCohomology(overflowing).h0, 1);
  assert.throws(() => coboundary(overflowing), /exceeds finite binary64 range/);
});

test("weighted metrics and observed numeric cochains cannot execute source arrays or replace a negative metric",()=>{
  const s=constantSheaf(["a","b"],[["a","b"]]);
  let executed=0;
  // Original source declared a NEGATIVE scalar, then supplied methods
  // which replaced that scalar with +1 during the old Cholesky evaluation.
  const fake=[[-1]];
  Object.defineProperty(fake,"every",{value(){executed++;return true;}});
  Object.defineProperty(fake,"map",{value(){executed++;return [[1]];}});
  assert.throws(()=>weightedSheafDirichlet(s,[fake],[0,2]),
    /weighted edge metric cannot be sparse or decorated/);
  assert.throws(()=>weightedSheafLaplacian(s,[fake]),
    /weighted edge metric cannot be sparse or decorated/);
  assert.throws(()=>weightedSheafDirichlet(s,[[[-1]]],[0,2]),
    /not positive definite/);
  const row=[1];
  Object.defineProperty(row,"0",{enumerable:true,get(){
    executed++;throw Error("called hostile metric scalar getter");
  }});
  assert.throws(()=>weightedSheafDirichlet(s,[[row]],[0,2]),
    /weighted metric row array slots must be inert own data/);
  const metrics=[[[1]]];
  Object.defineProperty(metrics[0],"0",{enumerable:true,get(){
    executed++;throw Error("called hostile metric-row getter");
  }});
  assert.throws(()=>weightedSheafLaplacian(s,metrics),
    /weighted edge metric array slots must be inert own data/);
  const witness=[0,2];
  Object.defineProperty(witness,"0",{enumerable:true,get(){
    executed++;throw Error("called hostile numeric source getter");
  }});
  assert.throws(()=>weightedSheafDirichlet(s,[[[1]]],witness),
    /weighted source cochain array slots must be inert own data/);
  const decorated=[[[1]]];
  Object.defineProperty(decorated,Symbol("unadmitted"),{value:true});
  assert.throws(()=>weightedSheafDirichlet(s,decorated,[0,2]),
    /weighted source metrics cannot be sparse or decorated/);
  const vector=[0,2];
  Object.defineProperty(vector,Symbol("unadmitted"),{value:true});
  assert.throws(()=>weightedSheafDirichlet(s,[[[1]]],vector),
    /weighted source cochain cannot be sparse or decorated/);
  const rational={kind:"exactNumber.rational",den:"1"};
  Object.defineProperty(rational,"num",{enumerable:true,get(){
    executed++;throw Error("called hostile rational metric getter");
  }});
  assert.throws(()=>weightedSheafDirichlet(s,[[[rational]]],[0,2]),
    /exact source scalar cannot contain accessors or hidden data/);
  const typed=new Float64Array([0,2]);
  Object.defineProperty(typed,"length",{get(){
    executed++;throw Error("typed-array length override executed");
  }});
  Object.defineProperty(typed,Symbol.iterator,{value(){
    executed++;throw Error("typed-array iterator executed");
  }});
  Object.defineProperty(typed,"map",{value(){
    executed++;throw Error("typed-array map override executed");
  }});
  assert.equal(weightedSheafDirichlet(s,[[[1]]],typed).energy,4,
    "the original numeric TypedArray consumer remains admitted without source callbacks");
  assert.throws(()=>weightedSheafDirichlet(s,[[[1]]],new DataView(new ArrayBuffer(16))),
    /finite 0-cochain/);
  assert.throws(()=>weightedSheafDirichlet(s,[[[1]]],new Float64Array([Infinity,2])),
    /finite 0-cochain/);
  assert.equal(executed,0,"metric and observed-value source callbacks must not execute");
  assert.equal(weightedSheafDirichlet(s,[[[1]]],[0,2]).energy,4,
    "the original lawful unit metric still has its expected energy");
});

test("native weighted Dirichlet equals quadratic Laplacian energy under incidence reversal and metric scaling",()=>{
  const chart=constantSheaf(["a","b"],[["a","b"]],2);
  const reverse=constantSheaf(["a","b"],[["b","a"]],2);
  const W=[[[2,1],[1,3]]];
  const x=[2,3,4,5];
  const sourceEnergy=weightedSheafDirichlet(chart,W,x);
  const L=weightedSheafLaplacian(chart,W);
  const Lx=apply(L,x);
  const quadratic=x.reduce((sum,v,i)=>sum+v*Lx[i],0);
  near(sourceEnergy.energy,28,1e-12);
  near(quadratic,sourceEnergy.energy,1e-12);
  near(weightedSheafDirichlet(reverse,W,x).energy,sourceEnergy.energy,1e-12,
    "an oriented edge reversal reverses the residual but preserves quadratic energy");
  const doubled=[[[4,2],[2,6]]];
  near(weightedSheafDirichlet(chart,doubled,x).energy,2*sourceEnergy.energy,1e-12);
  const sourceCarried=[[[ "2","1" ],[ "1","3" ]]];
  near(weightedSheafDirichlet(chart,sourceCarried,x).energy,sourceEnergy.energy,1e-12);
  let positiveMatrices=0;
  for(let a=1;a<=4;a++)for(let b=-2;b<=2;b++)for(let c=1;c<=5;c++){
    if(a*c<=b*b)continue; // Sylvester's criterion on 2×2 symmetric W
    const matrix=[[[a,b],[b,c]]];
    const e=weightedSheafDirichlet(chart,matrix,x).energy;
    const applied=apply(weightedSheafLaplacian(chart,matrix),x);
    const q=x.reduce((sum,v,i)=>sum+v*applied[i],0);
    const rev=weightedSheafDirichlet(reverse,matrix,x).energy;
    assert.ok(Math.abs(e-q)<1e-9*Math.max(1,Math.abs(e)),
      "finite SPD Dirichlet/Laplacian agreement at "+a+","+b+","+c);
    assert.ok(Math.abs(e-rev)<1e-9*Math.max(1,Math.abs(e)),
      "finite SPD orientation reversal at "+a+","+b+","+c);
    positiveMatrices++;
  }
  assert.ok(positiveMatrices>=50,
    "finite law assay must actually exercise many strictly positive matrices");
  assert.equal(sourceEnergy.perEdge[0].id,0,
    "numerical energy still retains the original source-indexed edge identity");
});

test("numeric sheaf and weighted Dirichlet receipts reject overflow instead of fabricating Infinity", () => {
  const high = cellularSheaf({
    vertices: [{ id: "a", dim: 1 }, { id: "b", dim: 1 }],
    edges: [{ id: "e", from: "a", to: "b", dim: 1,
      restrict: { from: [[1e200]], to: [[1e200]] } }],
  });
  const productOverflow = {
    name: "RangeError", message: "cellularSheaf Gram: numerical product overflowed or underflowed host arithmetic",
  };
  assert.throws(() => sheafLaplacian(high), productOverflow);
  assert.throws(() => weightedSheafLaplacian(high, [[[1]]]), productOverflow);

  const s = constantSheaf(["a", "b"], [["a", "b"]]);
  assert.equal(weightedSheafDirichlet(s, [[[1]]], [0, 2]).energy, 4);
  assert.throws(
    () => weightedSheafDirichlet(s, [[[1]]], [1e308, -1e308]),
    { name: "RangeError", message: "apply: numerical sum overflowed host arithmetic" },
  );
  assert.throws(
    () => weightedSheafDirichlet(s, [[[1e308]]], [0, 1e100]),
    { name: "RangeError", message: "weightedSheafDirichlet: numerical product overflowed or underflowed host arithmetic" },
  );
});

test("tiny exact restrictions stay exact but cannot silently project to zero incidence", () => {
  // Underflow to a floating-point zero changes ker δ, while the exact
  // rational rank remains lawful. Exact H⁰/H¹ must remain available.
  const tiny = "1/" + "1" + "0".repeat(400);
  const s = cellularSheaf({
    vertices: [{ id: "a", dim: 1 }, { id: "b", dim: 1 }],
    edges: [{ id: "e", from: "a", to: "b", dim: 1,
      restrict: { from: [[tiny]], to: [[1]] } }],
  });
  assert.equal(s.exact, true);
  assert.equal(cellularSheafCohomology(s).h0, 1);
  assert.equal(cellularSheafCohomology(s).h1, 0);
  assert.throws(() => coboundary(s), /underflows binary64/);
  // An exactly zero coefficient is legitimately projected to zero.
  const zero = cellularSheaf({
    vertices: [{ id: "a", dim: 1 }, { id: "b", dim: 1 }],
    edges: [{ id: "e", from: "a", to: "b", dim: 1,
      restrict: { from: [["0/" + "1" + "0".repeat(400)]], to: [[1]] } }],
  });
  assert.deepEqual(apply(coboundary(zero), [3, 7]), [7]);
});

test("nonzero numerical sheaf products refuse host underflow rather than fabricate zero energy", () => {
  const thin = cellularSheaf({
    vertices: [{ id: "a", dim: 1 }, { id: "b", dim: 1 }],
    edges: [{ id: "e", from: "a", to: "b", dim: 1,
      restrict: { from: [[1e-200]], to: [[0]] } }],
  });
  assert.throws(() => sheafLaplacian(thin), /underflowed host arithmetic/);
  assert.throws(() => weightedSheafLaplacian(thin, [[[1]]]), /underflowed host arithmetic/);
  assert.throws(() => apply(coboundary(thin), [1e-200, 0]), /underflowed host arithmetic/);
  const ordinary = constantSheaf(["a", "b"], [["a", "b"]]);
  assert.equal(weightedSheafDirichlet(ordinary, [[[1]]], [0, 2]).energy, 4);
  assert.throws(() => weightedSheafDirichlet(ordinary, [[[1]]], [0, 1e-200]),
    /underflowed host arithmetic/);
});


test("source-partial rational stalk readings construct a real global section rather than zero filling",()=>{
  const sheaf=constantSheaf(["research","engineering"],[{
    id:"original-dependency",from:"research",to:"engineering"
  }],1);
  const lifted=extendCellularSheafSection(sheaf,[
    {vertex:"research",coordinate:0,value:"7/3",sourceRecord:"source:original-science-witness"}
  ]);
  assert.equal(lifted.status,"mathematically-liftable");
  assert.deepEqual(lifted.exactSection.map(x=>[x.num,x.den]),[["7","3"],["7","3"]]);
  assert.equal(lifted.unobservedCoordinates,1);
  assert.equal(lifted.freeDimensions,0);
  assert.equal(lifted.sourceRows[0].origin,"cellular-restriction");
  assert.equal(lifted.sourceRows[1].sourceRecord,"source:original-science-witness");
  const unobserved=extendCellularSheafSection(sheaf,[]);
  assert.equal(unobserved.freeDimensions,1);
  assert.equal(unobserved.observedCoordinateCount,0);
  assert.equal(unobserved.unobservedCoordinates,2);
});

test("two irreconcilable source-local stalk readings return a witnessed no-extension equation",()=>{
  const sheaf=constantSheaf(["science","operations"],[{id:"handoff",from:"science",to:"operations"}],1);
  const result=extendCellularSheafSection(sheaf,[
    {vertex:"science",coordinate:0,value:7,sourceRecord:"science:observation"},
    {vertex:"operations",coordinate:0,value:8,sourceRecord:"operations:counter-reading"}
  ]);
  assert.equal(result.status,"mathematically-obstructed");
  assert.equal(result.exactSection,null);
  assert.equal(result.sourceRows.length,3);
  const [edge,science,ops]=result.obstruction.sourceEquationWeights;
  assert.deepEqual(result.sourceRows.map(row=>row.origin),
    ["cellular-restriction","source-observation","source-observation"]);
  // δx = operations − science; the exact certificate weights sum to 0
  // in each unknown but a nonzero signed combination of claimed readings.
  const rational=x=>Number(x.num)/Number(x.den);
  assert.equal(-rational(edge)+rational(science),0);
  assert.equal(rational(edge)+rational(ops),0);
  assert.notEqual(7*rational(science)+8*rational(ops),0);
});

test("a nontrivial source restriction admits compatible partial vectors with genuine free stalk directions",()=>{
  const sheaf=cellularSheaf({
    vertices:[{id:"left",dim:2},{id:"right",dim:2}],
    edges:[{id:"typed-interface",from:"left",to:"right",dim:1,
      restrict:{from:[[1,0]],to:[[0,1]]}}]
  });
  const view=extendCellularSheafSection(sheaf,[
    {vertex:"left",coordinate:0,value:11,sourceRecord:"original:left"}
  ]);
  assert.equal(view.status,"mathematically-liftable");
  assert.equal(view.freeDimensions,2);
  assert.equal(Number(view.exactSection[0].num),11);
  assert.equal(Number(view.exactSection[3].num),11);
  assert.equal(view.unobservedCoordinates,3);
  assert.equal(view.sourceRows[0].edge,"typed-interface");
});


test("exact tensor composition is a productive source-indexed construction, invariant under separate source enumeration",()=>{
  const base=constantSheaf(["a","b","c"],[
    {id:"ab",from:"a",to:"b"},
    {id:"bc",from:"b",to:"c"}
  ],1);
  const make=(ids,edges)=>cellularSheaf({
    vertices:ids.map(id=>({id,dim:1})),
    edges:edges.map(([id,from,to,weight])=>({
      id,from,to,dim:1,restrict:{from:[[weight]],to:[[1]]}
    }))
  });
  const original=make(["a","b","c"],[
    ["ab","a","b",2],["bc","b","c",3]
  ]);
  const differentOrder=make(["c","a","b"],[
    ["bc","b","c",3],["ab","a","b",2]
  ]);
  const tensor=(other)=>tensorCellularSheaves([
    {sourceRef:"base:source",sheaf:base},{sourceRef:"partner:source",sheaf:other}
  ]);
  const one=tensor(original),two=tensor(differentOrder);
  assert.deepEqual(one.edges,two.edges,"source order is not relational geometry");
  const observation={vertex:"a",coordinate:0,value:"7/5",sourceRecord:"source:consented"};
  const lift=extendCellularSheafSection(two,[observation]);
  assert.equal(lift.status,"mathematically-liftable");
  assert.deepEqual(lift.exactSection.map(x=>x.num+"/"+x.den),
    ["7/5","14/5","42/5"]);
  const conflict=extendCellularSheafSection(two,[observation,
    {vertex:"c",coordinate:0,value:9,sourceRecord:"source:contrary"}]);
  assert.equal(conflict.status,"mathematically-obstructed");
  assert.equal(conflict.exactSection,null);
  assert.equal(conflict.sourceRows.at(-1).sourceRecord,"source:contrary");
});

test("covered source-local sheaf sections actually glue; contradictory and missing covers retain original evidence",()=>{
 const source=cellularSheaf({
  vertices:[{id:"odooparty",dim:1},{id:"seller",dim:1},{id:"awsresource",dim:1}],
  edges:[{id:"crm-seller",from:"odooparty",to:"seller",dim:1,
   restrict:{from:[[1]],to:[[1]]}},
   {id:"seller-cloud",from:"seller",to:"awsresource",dim:1,
   restrict:{from:[[1]],to:[[1]]}}],
 });
 const local=(region,sourceRef,rows)=>({region,sourceRef,
   vertices:rows.map(([vertex,value])=>({vertex,values:[value]}))});
 const odoo=local("odoo","source:original-odoo",
   [["odooparty","13"],["seller","13"]]);
 const aws=local("aws","source:original-aws",
   [["seller","13"],["awsresource","13"]]);
 const received=glueCellularSheafPatches(source,[odoo,aws]);
 assert.equal(received.status,"globally-glued");
 assert.deepEqual(received.exactGlobalSection.map(x=>x.num+"/"+x.den),["13/1","13/1","13/1"]);
 assert.deepEqual(received.regions.map(x=>x.sourceRef),[odoo.sourceRef,aws.sourceRef]);
 const uncovered=glueCellularSheafPatches(source,[odoo]);
 assert.equal(uncovered.status,"incomplete-cover");
 assert.deepEqual(uncovered.uncoveredEdges,["seller-cloud"]);
 assert.equal(uncovered.exactGlobalSection,null);
 const contested=glueCellularSheafPatches(source,[odoo,local("aws","source:contrary-aws",
   [["seller","8"],["awsresource","8"]])]);
 assert.equal(contested.status,"globally-obstructed");
 assert.ok(contested.obstruction.sourceEquationWeights.length>0);
 assert.ok(contested.globalSourceRows.some(row=>row.sourceRecord==="source:contrary-aws"));
 const locallyBroken=glueCellularSheafPatches(source,[local("odoo","source:bad-odoo",
   [["odooparty","13"],["seller","8"]]),aws]);
 assert.equal(locallyBroken.status,"locally-obstructed");
 assert.equal(locallyBroken.failedRegion,"odoo");
});


test("native source-qualified tensor charts are received by original exact extension and gluing",()=>{
  const a=constantSheaf(["a","b"],[["a","b"]]);
  const b=constantSheaf(["a","b"],[["a","b"]]);
  const tensor=tensorCellularSheaves([
    {sourceRef:"original:stalk-a",sheaf:a},
    {sourceRef:"original:stalk-b",sheaf:b},
  ]);
  assert.equal(admitCellularSheaf(tensor),tensor,
    "the original tensor producer must issue a chart accepted by its own sheaf receiver");
  assert.deepEqual(tensor.tensor.factors,["original:stalk-a","original:stalk-b"]);
  const extended=extendCellularSheafSection(tensor,[{
    vertex:"a",coordinate:0,value:"4",sourceRecord:"witness:local-a",
  }]);
  assert.equal(extended.status,"mathematically-liftable");
  assert.deepEqual(extended.exactSection.map(x=>x.num+"/"+x.den),["4/1","4/1"]);
  const glued=glueCellularSheafPatches(tensor,[{
    region:"common-ground",sourceRef:"witness:local-b",
    vertices:[{vertex:"a",values:["4"]},{vertex:"b",values:["4"]}],
  }]);
  assert.equal(glued.status,"globally-glued");
  assert.deepEqual(glued.exactGlobalSection.map(x=>x.num+"/"+x.den),["4/1","4/1"]);
  // Native custody is not transferable by merely copying a JSON carrier
  // with an extra tensor label. A genuine issued package/transport receiver is
  // a separate original release/contract gate.
  assert.throws(()=>admitCellularSheaf(structuredClone(tensor)),
    /exact inert own source fields/);
});

test("cellular tensor input rejects executable, hidden and decorated source factors",()=>{
  const first=constantSheaf(["a","b"],[["a","b"]]);
  const second=constantSheaf(["a","b"],[["a","b"]]);
  const good={sourceRef:"source:first",sheaf:first};
  let called=0;
  const malicious={sourceRef:"source:second"};
  Object.defineProperty(malicious,"sheaf",{
    enumerable:true,get(){called++;return second;},
  });
  assert.throws(()=>tensorCellularSheaves([good,malicious]),
    /exact inert own source fields/);
  const hidden={sourceRef:"source:second",sheaf:second};
  Object.defineProperty(hidden,"authority",{value:"unearned"});
  assert.throws(()=>tensorCellularSheaves([good,hidden]),
    /exact inert own source fields/);
  assert.throws(()=>tensorCellularSheaves(Array(5).fill(good)),
    /requires 2\.\.4 exact source-attributed factors/,
    "factor count refuses before allocating any source-descriptor map");
  const array=[good,{sourceRef:"source:second",sheaf:second}];
  Object.defineProperty(array,Symbol.iterator,{
    get(){called++;return Array.prototype[Symbol.iterator];},
  });
  assert.throws(()=>tensorCellularSheaves(array),
    /cannot be sparse or decorated/);
  assert.equal(called,0,"tensor source admission never executes getters or custom iterators");
  assert.deepEqual(tensorCellularSheaves([good,{sourceRef:"source:second",sheaf:second}])
    .tensor.factors,["source:first","source:second"],
    "legitimate native tensor factor references retain original order");
});

test("different original enterprise/cloud stalks pull back to one witnessed base and tensor before exact gluing",()=>{
  const O=cellularSheaf({
    vertices:[{id:"odoo:company",dim:1},{id:"odoo:invoice",dim:1}],
    edges:[{id:"odoo:order",from:"odoo:company",to:"odoo:invoice",
      dim:1,restrict:{from:[[1]],to:[[1]]}}],
  });
  const A=cellularSheaf({
    vertices:[{id:"aws:tenant",dim:1},{id:"aws:capacity",dim:1}],
    edges:[{id:"aws:resource",from:"aws:tenant",to:"aws:capacity",
      dim:1,restrict:{from:[[2]],to:[[3]]}}],
  });
  const base={vertices:["buyer","resource"],
    edges:[{id:"buyer-resource",from:"buyer",to:"resource"}]};
  const morphism=(from,to,edge)=>({
    vertices:[{id:"buyer",source:from},{id:"resource",source:to}],
    edges:[{id:"buyer-resource",source:edge}],
  });
  const odoo=pullbackCellularSheaf(O,{base,
    map:morphism("odoo:company","odoo:invoice","odoo:order")});
  const aws=pullbackCellularSheaf(A,{base,
    map:morphism("aws:tenant","aws:capacity","aws:resource")});
  const comparison=tensorCellularSheaves([
    {sourceRef:"source:odoo",sheaf:odoo.sheaf},
    {sourceRef:"source:aws",sheaf:aws.sheaf},
  ]);
  assert.deepEqual(comparison.vertices.map(x=>x.id),["buyer","resource"]);
  assert.deepEqual(comparison.edges.map(x=>x.id),["buyer-resource"]);
  assert.deepEqual(comparison.edges[0].restrict.from.map(row=>row.map(x=>x.num+"/"+x.den)),
    [["2/1"]]);
  assert.deepEqual(comparison.edges[0].restrict.to.map(row=>row.map(x=>x.num+"/"+x.den)),
    [["3/1"]]);
  // The partial source reader now computes a genuine missing coordinate,
  // rather than requiring providers to rename their original resource IDs.
  const received=extendCellularSheafSection(comparison,[
    {vertex:"buyer",coordinate:0,value:"3",sourceRecord:"source:customer-window"}
  ]);
  assert.equal(received.status,"mathematically-liftable");
  assert.deepEqual(received.exactSection.map(x=>x.num+"/"+x.den),["3/1","2/1"]);
  const covered=glueCellularSheafPatches(comparison,[{
    region:"joint-confirmed",sourceRef:"source:joint-patch",
    vertices:[{vertex:"buyer",values:["3"]},{vertex:"resource",values:["2"]}]
  }]);
  assert.equal(covered.status,"globally-glued");
  const disputed=glueCellularSheafPatches(comparison,[{
    region:"joint-contrary",sourceRef:"source:disagreed",
    vertices:[{vertex:"buyer",values:["3"]},{vertex:"resource",values:["5"]}]
  }]);
  assert.equal(disputed.status,"locally-obstructed");
  assert.ok(disputed.obstruction.sourceEquationWeights.length>0);
  assert.throws(()=>pullbackCellularSheaf(A,{base,
    map:morphism("aws:capacity","aws:tenant","aws:resource")}),
    /exact oriented incidence/u);
  assert.deepEqual(A.vertices.map(x=>x.id),["aws:tenant","aws:capacity"],
    "pullback cannot rename original cloud resource identities");
});

test("cochain indexes canonical structured stalks without manufacturing missing data", () => {
  const original = { name: "é", details: { b: 2, a: 1 } };
  const equivalent = { details: { a: 1, b: 2 }, name: "é" };
  const ids = [original, { name: "second" }, { name: "empty-dimension" }];
  const sheaf = cellularSheaf({ vertices: [
    { id: ids[0], dim: 1 }, { id: ids[1], dim: 1 }, { id: ids[2], dim: 0 }
  ], edges: [] });
  assert.deepEqual(cochain(sheaf, [
    { vertex: equivalent, value: 7 }, { vertex: ids[1], value: 0 },
    { vertex: original, value: 7 }
  ], { missing: "refuse" }), [7, 0]);
  assert.throws(() => cochain(sheaf, [{ vertex: equivalent, value: 7 }], { missing: "refuse" }),
    /incomplete observation omitted 1 positive-dimensional stalks/u);
  assert.throws(() => cochain(sheaf, [
    { vertex: original, value: 7 }, { vertex: equivalent, value: 8 }
  ]), /conflicting duplicate vertex readings/u);
  const many = Array.from({ length: 250 }, (_, i) => "stalk-" + i);
  const full = constantSheaf(many, []);
  const reversed = [...many].reverse().map((vertex, index) => ({vertex, value:index}));
  const vector = cochain(full, reversed, { missing: "refuse" });
  assert.equal(vector.length, many.length);
  assert.equal(vector[0], 249);
  assert.equal(vector[249], 0);
});

test("original cellular stalk IDs and restriction data remain immutable after caller edits",()=>{
 const alpha={source:"A",coordinates:{side:"left"}};
 const beta={source:"B",coordinates:{side:"right"}};
 const sourceEdge={address:"edge:original"};
 const entry={kind:"exactNumber.rational",num:"1",den:"3"};
 const from=[[entry]],to=[[1]];
 const sheaf=cellularSheaf({
   vertices:[{id:alpha,dim:1},{id:beta,dim:1}],
   edges:[{id:sourceEdge,from:alpha,to:beta,dim:1,restrict:{from,to}}],
 });
 const original={vertex:JSON.stringify(sheaf.vertices[0].id),edge:JSON.stringify(sheaf.edges[0].id),
   restriction:JSON.stringify(sheaf.edges[0].restrict.from)};
 alpha.coordinates.side="changed";beta.source="changed";sourceEdge.address="rewritten";entry.num="999";
 assert.equal(JSON.stringify(sheaf.vertices[0].id),original.vertex);
 assert.equal(JSON.stringify(sheaf.edges[0].id),original.edge);
 assert.equal(JSON.stringify(sheaf.edges[0].restrict.from),original.restriction);
 assert.equal(Object.isFrozen(sheaf.vertices[0].id.coordinates),true);
 assert.equal(Object.isFrozen(sheaf.edges[0].restrict.from[0][0]),true);
 assert.equal(cellularSheafCohomology(sheaf).h0,1,
   "the original exact rank cannot change when a caller mutates old input");
});
test("source rational getter cannot execute during original sheaf restriction admission",()=>{
 let reads=0;
 const hostile={kind:"exactNumber.rational",den:"2"};
 Object.defineProperty(hostile,"num",{enumerable:true,get(){reads++;return "1";}});
 assert.throws(()=>cellularSheaf({
   vertices:[{id:"a",dim:1},{id:"b",dim:1}],
   edges:[{id:"ab",from:"a",to:"b",dim:1,
     restrict:{from:[[hostile]],to:[[1]]}}],
 }),/exact source scalar cannot contain accessors/u);
 assert.equal(reads,0);
});

test("sheaf source records and stalk arrays refuse foreign executable accessors",()=>{
 let reads=0;
 const source={edges:[]};
 Object.defineProperty(source,"vertices",{enumerable:true,get(){reads++;return [{id:"a",dim:1}];}});
 assert.throws(()=>cellularSheaf(source),/inert own data/u);
 const vertex={dim:1};
 Object.defineProperty(vertex,"id",{enumerable:true,get(){reads++;return "a";}});
 assert.throws(()=>cellularSheaf({vertices:[vertex],edges:[]}),/inert own data/u);
 const edge={id:"ab",from:"a",to:"b",dim:1};
 Object.defineProperty(edge,"restrict",{enumerable:true,get(){reads++;return {from:[[1]],to:[[1]]};}});
 assert.throws(()=>cellularSheaf({vertices:[{id:"a",dim:1},{id:"b",dim:1}],edges:[edge]}),/inert own data/u);
 const row=[1];
 Object.defineProperty(row,"0",{enumerable:true,get(){reads++;return 1;}});
 assert.throws(()=>cellularSheaf({vertices:[{id:"a",dim:1},{id:"b",dim:1}],
  edges:[{id:"ab",from:"a",to:"b",dim:1,restrict:{from:[row],to:[[1]]}}]}),/array slots must be inert own data/u);
 assert.equal(reads,0);
});

test("strict observed cochains refuse getters without promoting missing stalks to zeros",()=>{
 const sheaf=cellularSheaf({vertices:[{id:"a",dim:1},{id:"b",dim:1}],edges:[]});
 let reads=0;
 const row={value:1};
 Object.defineProperty(row,"vertex",{enumerable:true,get(){reads++;return "a";}});
 assert.throws(()=>cochain(sheaf,[row]),/inert own data/u);
 const options={};
 Object.defineProperty(options,"missing",{enumerable:true,get(){reads++;return "refuse";}});
 assert.throws(()=>cochain(sheaf,[],options),/inert own data/u);
 const vector=[1];
 Object.defineProperty(vector,"0",{enumerable:true,get(){reads++;return 1;}});
 assert.throws(()=>cochain(sheaf,[{vertex:"a",value:vector}]),/array slots must be inert own data/u);
 assert.equal(reads,0);
 assert.deepEqual(cochain(sheaf,[{vertex:"a",value:0},{vertex:"b",value:0}],{missing:"refuse"}),[0,0]);
 assert.throws(()=>cochain(sheaf,[{vertex:"a",value:0}],{missing:"refuse"}),/incomplete observation/u);
});

test("canonical exact source scalar is inert and immutable",()=>{
 let reads=0;
 const bad={kind:"exactNumber.rational",den:"3"};
 Object.defineProperty(bad,"num",{enumerable:true,get(){reads++;return "1";}});
 assert.throws(()=>sheafSourceScalar(bad),/accessors or hidden data/u);
 assert.equal(reads,0);
 const admitted=sheafSourceScalar({kind:"exactNumber.rational",num:"2",den:"6"});
 assert.deepEqual([admitted.num,admitted.den],["1","3"]);
 assert.equal(Object.isFrozen(admitted),true);
});

test("source patch gluing refuses executable cover, region and observation fields before evaluation",()=>{
 let getterCalls=0;
 const source=cellularSheaf({vertices:[{id:"a",dim:1}],edges:[]});
 const good={region:"first",sourceRef:"source:a",
   vertices:[{vertex:"a",values:["13"]}]};
 const hostile={
   cover:()=>{const cover=[good];Object.defineProperty(cover,"0",
     {enumerable:true,get(){getterCalls++;return good;}});return cover;},
   region:()=>{const patch={...good};Object.defineProperty(patch,"region",
     {enumerable:true,get(){getterCalls++;return "first";}});return [patch];},
   ref:()=>{const patch={...good};Object.defineProperty(patch,"sourceRef",
     {enumerable:true,get(){getterCalls++;return "source:a";}});return [patch];},
   vertex:()=>{const reading={values:["13"]};Object.defineProperty(reading,"vertex",
     {enumerable:true,get(){getterCalls++;return "a";}});
     return [{...good,vertices:[reading]}];},
   values:()=>{const reading={vertex:"a"};Object.defineProperty(reading,"values",
     {enumerable:true,get(){getterCalls++;return ["13"];}});
     return [{...good,vertices:[reading]}];},
   vector:()=>{const vector=["13"];Object.defineProperty(vector,"0",
     {enumerable:true,get(){getterCalls++;return "13";}});
     return [{...good,vertices:[{vertex:"a",values:vector}]}];},
   rational:()=>{const value={kind:"exactNumber.rational",den:"1"};
     Object.defineProperty(value,"num",{enumerable:true,get(){getterCalls++;return "13";}});
     return [{...good,vertices:[{vertex:"a",values:[value]}]}];},
 };
 for(const make of Object.values(hostile))
   assert.throws(()=>glueCellularSheafPatches(source,make()),
     /inert|source fields|array slots|accessors or hidden data/u);
 assert.equal(getterCalls,0);
 assert.equal(glueCellularSheafPatches(source,[good]).status,"globally-glued");
});

test("gluing rejects hidden, inherited or decorated source patches without inventing global sections",()=>{
 const source=cellularSheaf({vertices:[{id:"a",dim:1}],edges:[]});
 const good={region:"first",sourceRef:"source:a",
   vertices:[{vertex:"a",values:["13"]}]};
 const hidden={...good};Object.defineProperty(hidden,"authority",{value:"forged"});
 const inherited=Object.assign(Object.create({region:"first"}),good);
 const extra={...good,unwitnessed:"source"};
 const decorated=[good];decorated.source="hidden";
 const vector=[{vertex:"a",values:["13"]}];vector.extra="forged";
 for(const patches of [[hidden],[inherited],[extra],decorated,
   [{...good,vertices:vector}]])
   assert.throws(()=>glueCellularSheafPatches(source,patches),
     /source record|source fields|dense|decorated/u);
 const actual=glueCellularSheafPatches(source,[good]);
 assert.equal(actual.status,"globally-glued");
 assert.deepEqual(actual.regions.map(x=>x.sourceRef),["source:a"]);
});

test("standalone exact section extension refuses executable source observations before solving",()=>{
  const source=constantSheaf(["science","engineering"],
    [{id:"dependency",from:"science",to:"engineering"}],1);
  const good={vertex:"science",coordinate:0,value:"7/3",sourceRecord:"science:one"};
  const original=extendCellularSheafSection(source,[good]);
  const replay=extendCellularSheafSection(source,JSON.parse(JSON.stringify([good])));
  assert.equal(original.status,"mathematically-liftable");
  assert.deepEqual(original.exactSection,replay.exactSection);
  assert.deepEqual(original.sourceRows,replay.sourceRows);
  let getterCalls=0;
  const getter=()=>{getterCalls++;throw Error("source accessor executed");};
  for(const key of ["vertex","coordinate","value","sourceRecord"]){
    const malicious={...good};
    Object.defineProperty(malicious,key,{enumerable:true,get:getter});
    assert.throws(()=>extendCellularSheafSection(source,[malicious]),
      /inert own source fields/u);
  }
  const sourceArray=[good];
  Object.defineProperty(sourceArray,"0",{enumerable:true,get:getter});
  assert.throws(()=>extendCellularSheafSection(source,sourceArray),
    /array slots must be inert/u);
  const hostileRational={kind:"exactNumber.rational",den:"3"};
  Object.defineProperty(hostileRational,"num",{enumerable:true,get:getter});
  assert.throws(()=>extendCellularSheafSection(source,[{...good,value:hostileRational}]),
    /accessors or hidden data/u);
  assert.equal(getterCalls,0,"never run caller accessors at the mathematical boundary");
});

test("standalone extension rejects extra or inherited readings and retains separate source disagreement",()=>{
  const source=constantSheaf(["a","b"],[{id:"link",from:"a",to:"b"}],1);
  const good={vertex:"a",coordinate:0,value:"2",sourceRecord:"site:a"};
  const extra={...good,authority:"forged"};
  const hidden={...good};
  Object.defineProperty(hidden,"hidden", {value:"not a source claim"});
  const inherited=Object.assign(Object.create({sourceRecord:"site:a"}),good);
  const decorated=[good];decorated.extra="hidden";
  const sparse=Array(2);sparse[0]=good;
  for(const sourceRows of [[extra],[hidden],[inherited],decorated,sparse])
    assert.throws(()=>extendCellularSheafSection(source,sourceRows),
      /source fields|source array|decorated|plain original source record|inert own/u);
  assert.throws(()=>extendCellularSheafSection(source,Array(258).fill(good)),
    /exact 256-coordinate\/equation envelope/u);
  const opposition=extendCellularSheafSection(source,[good,
    {vertex:"b",coordinate:0,value:"3",sourceRecord:"site:b"}]);
  assert.equal(opposition.status,"mathematically-obstructed",
    "two admitted incompatible readings cannot be flattened into a compatible section");
  assert.deepEqual(opposition.sourceRows.slice(-2).map(x=>x.sourceRecord),
    ["site:a","site:b"],"both original sources remain in the exact obstruction");
});

test("source-admitted exact sheaf chart survives JSON transport without changing gluing or extension",()=>{
  const original=constantSheaf(["science","engineering"],
    [{id:"original-dependency",from:"science",to:"engineering"}],1);
  assert.equal(admitCellularSheaf(original),original,
    "an in-process original chart is already admitted");
  const copied=JSON.parse(JSON.stringify(original));
  const recovered=admitCellularSheaf(copied);
  assert.notEqual(recovered,copied,"a transported copy receives a new original-source construction");
  assert.deepEqual(recovered,original,
    "derived incidence indices and restriction arrays retain exact semantic content");
  const observations=[{vertex:"science",coordinate:0,value:"7/3",sourceRecord:"source:original"}];
  const a=extendCellularSheafSection(original,observations);
  const b=extendCellularSheafSection(copied,observations);
  assert.deepEqual(a,b,"source-local exact lift and source equation indices survive transport");
  const patches=[{region:"both",sourceRef:"source:science",
    vertices:[{vertex:"science",values:["7/3"]},{vertex:"engineering",values:["7/3"]}]}];
  assert.deepEqual(glueCellularSheafPatches(copied,patches),
    glueCellularSheafPatches(original,patches),
    "source-local gluing cannot depend on in-process identity of the same valid original chart");
});

test("mathematical sheaf consumers refuse counterfeit charts before numerical readout",()=>{
  const issued=constantSheaf(["source:a","source:b"],
    [{id:"e",from:"source:a",to:"source:b"}],1);
  const copy=()=>JSON.parse(JSON.stringify(issued));
  const forged={...copy(),c0:17};
  const numerical=[
    ["cochain",s=>cochain(s,[])],
    ["coboundary",s=>coboundary(s)],
    ["Laplacian",s=>sheafLaplacian(s)],
    ["metric Laplacian",s=>weightedSheafLaplacian(s,[[[1]]])],
    ["Dirichlet",s=>weightedSheafDirichlet(s,[[[1]]],[0,0])],
    ["diffusion",s=>diffuse(s,[0,0],{maxSteps:0})],
    ["Hodge",s=>hodgeCheck(s,[0,0],{maxSteps:0})],
    ["normal solver",s=>solveNormal(s,[0,0])],
  ];
  for(const [name,read] of numerical)
    assert.throws(()=>read(forged),/cellularSheaf chart:/u,
      name+" cannot accept caller-forged cellular coordinates");
  let getterCalls=0;
  const accessor=copy();
  Object.defineProperty(accessor,"c0",{enumerable:true,get(){
    getterCalls++;
    throw Error("unadmitted source getter executed");
  }});
  for(const [name,read] of numerical)
    assert.throws(()=>read(accessor),/cellularSheaf chart:.*inert own source fields/u,
      name+" must reject a getter before numerical interpretation");
  assert.equal(getterCalls,0);
});

test("verified transported charts retain the original cochain and numerical sheaf semantics",()=>{
  const issued=constantSheaf(["a","b"],[{id:"e",from:"a",to:"b"}],1);
  const transported=JSON.parse(JSON.stringify(issued));
  const admitted=admitCellularSheaf(transported);
  assert.deepEqual(admitted,issued);
  assert.notEqual(admitted,transported);
  const reports=[{vertex:"a",value:2},{vertex:"b",value:4}];
  const numerical=[
    ["cochain",s=>cochain(s,reports,{missing:"refuse"})],
    ["coboundary",s=>coboundary(s)],
    ["Laplacian",s=>sheafLaplacian(s)],
    ["weighted Laplacian",s=>weightedSheafLaplacian(s,[[[2]]])],
    ["Dirichlet",s=>weightedSheafDirichlet(s,[[[2]]],[2,4])],
    ["diffusion",s=>diffuse(s,[2,4],{maxSteps:5})],
    ["Hodge",s=>hodgeCheck(s,[2,4],{maxSteps:5})],
    ["normal solver",s=>solveNormal(s,[-1,1])],
  ];
  for(const [name,read] of numerical)
    assert.deepEqual(read(transported),read(issued),
      name+" must preserve exact source geometry and bounded computation");
  assert.deepEqual(apply(coboundary(transported),[2,4]),[2]);
  assert.ok(Math.abs(weightedSheafDirichlet(transported,[[[2]]],[2,4]).energy-8)<1e-12,
    "host-float Cholesky energy agrees within round-off, not bit-for-bit");
});

test("derived sheaf indices and declared exactness cannot be forged into source-valid mathematical claims",()=>{
  const source=constantSheaf(["a","b"],[{id:"e",from:"a",to:"b"}],1);
  const copy=()=>JSON.parse(JSON.stringify(source));
  const sources=[
    ()=>{const c=copy();c.vertexOffsets[1]=19;return c;},
    ()=>{const c=copy();c.edgeOffsets[0]=7;return c;},
    ()=>{const c=copy();c.fromIndex[0]=1;return c;},
    ()=>{const c=copy();c.toIndex[0]=0;return c;},
    ()=>{const c=copy();c.c0=3;return c;},
    ()=>{const c=copy();c.c1=0;return c;},
    ()=>{const c=copy();c.exact=false;return c;},
    ()=>({...copy(),authority:"source:invented"}),
  ];
  for(const produce of sources){
    const forged=produce();
    assert.throws(()=>admitCellularSheaf(forged),
      /cellularSheaf chart:/u);
    assert.throws(()=>extendCellularSheafSection(forged,[]),
      /cellularSheaf chart:/u);
    assert.throws(()=>glueCellularSheafPatches(forged,[]),
      /cellularSheaf chart:/u);
  }
  let getterCalls=0;
  const get=()=>{getterCalls++;throw Error("executed forged sheaf source");};
  const direct=copy();
  Object.defineProperty(direct,"c0",{enumerable:true,get});
  const offset=copy();
  Object.defineProperty(offset.vertexOffsets,"0",{enumerable:true,get});
  const matrix=copy();
  Object.defineProperty(matrix.edges[0].restrict.from[0],"0",{enumerable:true,get});
  for(const forged of [direct,offset,matrix])
    assert.throws(()=>admitCellularSheaf(forged),
      /cellularSheaf chart:|array slots|inert|accessors/u);
  assert.equal(getterCalls,0,
    "source getters cannot participate in mathematical reconstruction");
});
