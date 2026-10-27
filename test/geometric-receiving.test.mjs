import test from "node:test";
import assert from "node:assert/strict";
import { cellular3Complex } from "../src/cohomology.mjs";
import { geometricReceiving, metricSquareOfVector } from "../src/embedding.mjs";
import { executeOperation, operations } from "../src/operations.mjs";

/**
 * Independent Engineering receiving of Science-owned exact J26 geometry:
 * lenticule-science/obsmetrologia
 * data/records/geometric-carriers/j26-regular-embedding.json
 * authored against combinatorial J26.lean blob
 * fe42c0e4fd56e034307ce5edaf9047b51980a134.
 * This immutable fixture is not an alternative mathematical source owner.
 */
const SCIENCE_GEOMETRY_BLOB = "49e760838311ca28d92b9aa86f7cf4f8a3057f80";
const vertices = ["q0","q1","q2","q3","a","b","c","d"];
const positions = [
  [-1,-1,0],[-1,1,0],[1,1,0],[1,-1,0],
  [-1,0,1],[1,0,1],[0,1,-1],[0,-1,-1],
];
const metric = { diagonal: [1,1,3], denominator: 2 };
const edgeTuples = [
  ["q0q1","q0","q1"],["q1q2","q1","q2"],["q2q3","q2","q3"],
  ["q3q0","q3","q0"],["q1a","q1","a"],["ab","a","b"],
  ["bq2","b","q2"],["aq0","a","q0"],["bq3","b","q3"],
  ["q2c","q2","c"],["cd","c","d"],["dq3","d","q3"],
  ["cq1","c","q1"],["dq0","d","q0"],
];
const polygons = {
  leftTop:["q0","q1","a"],
  leftBottom:["q3","b","q2"],
  leftSide0:["q1","q2","b","a"],
  leftSide1:["a","b","q3","q0"],
  rightTop:["q1","c","q2"],
  rightBottom:["q0","q3","d"],
  rightSide0:["q2","c","d","q3"],
  rightSide1:["c","q1","q0","d"],
};
const fixture = (sign = -1) => {
  const edges = edgeTuples.map(([id,from,to])=>({id,from,to}));
  const faces = Object.entries(polygons).map(([id,walk])=>({
    id,
    boundary:walk.map((from,i)=>{
      const to=walk[(i+1)%walk.length];
      const edge=edges.find(e=>(e.from===from&&e.to===to)||(e.from===to&&e.to===from));
      assert.ok(edge, `Science J26 edge between ${from},${to}`);
      return {edge:edge.id,direction:edge.from===from?1:-1};
    }),
  }));
  return {vertices,edges,faces,volumes:[{
    id:"j26",boundary:faces.map(face=>({face:face.id,direction:sign})),
  }]};
};
const receive = (input, points = positions, m = metric) =>
  geometricReceiving(cellular3Complex(input), points, m);
const one = {numerator:"1",denominator:"1"};

test("Science J26 carrier is an exactly regular, strictly convex 3D solid with area and volume",()=>{
  const solid = fixture(), reading=receive(solid);
  assert.equal(SCIENCE_GEOMETRY_BLOB.length,40);
  assert.deepEqual(cellular3Complex(solid).betti,{h0:1,h1:0,h2:0,h3:0});
  assert.equal(reading.conformance.certifiedRegularConvexSolid,true);
  assert.deepEqual(reading.conformance,{
    allEdgesEqual:true,allFacesRegular:true,
    strictConvexSupportingPlanes:true,volumeBoundaryOutward:true,
    certifiedRegularConvexSolid:true,
  });
  assert.equal(reading.edges.length,14);
  assert.ok(reading.edges.every(edge=>edge.matchesReference));
  assert.ok(reading.edges.every(edge=>JSON.stringify(edge.squaredLength)===JSON.stringify(one)));
  assert.deepEqual(reading.volume.coefficient,{numerator:"1",denominator:"2"});
  assert.equal(reading.volume.radicand,"3");
  assert.equal(reading.volume.determinantSum,"24");
  assert.deepEqual(reading.area,{
    squareCoefficient:{numerator:"4",denominator:"1"},
    triangularCoefficient:one,
    radical:3,certified:true,
  });
  assert.equal(reading.faces.filter(f=>f.polygon==="triangle").length,4);
  assert.equal(reading.faces.filter(f=>f.polygon==="square-candidate").length,4);
  assert.ok(reading.faces.every(f=>f.planar&&f.regular&&f.strictlySupporting));
  assert.deepEqual(reading.orientation,{
    inwardFaceCount:8,outwardFaceCount:0,valid:true,
  });
});

test("topologically valid inward volume is geometrically misoriented, not an outward volume",()=>{
  const outward = fixture(-1),inward=fixture(1);
  assert.deepEqual(cellular3Complex(outward).betti,cellular3Complex(inward).betti);
  const valid=receive(outward),wrong=receive(inward);
  assert.equal(valid.volume.certified,true);
  assert.equal(wrong.volume.certified,false);
  assert.equal(wrong.conformance.volumeBoundaryOutward,false);
  assert.equal(wrong.volume.determinantSum,"-24");
  assert.deepEqual(wrong.volume.coefficient,{numerator:"-1",denominator:"2"});
});

test("exact physical volume and regularity survive translation and a consistently oriented face reversal",()=>{
  const input=fixture();
  const base=receive(input);
  const translated=positions.map(([x,y,z])=>[x+17,y-23,z+8]);
  const shifted=receive(input,translated);
  assert.deepEqual(shifted.volume,base.volume);
  assert.deepEqual(shifted.area,base.area);
  assert.deepEqual(shifted.conformance,base.conformance);
  const reversed = {
    ...input,
    faces:input.faces.map((f,i)=>i===2?
      {...f,boundary:f.boundary.slice().reverse().map(step=>({...step,direction:-step.direction}))}:f),
    volumes:input.volumes.map(v=>({...v,boundary:v.boundary.map(st=>
      st.face===input.faces[2].id?{...st,direction:-st.direction}:st)})),
  };
  const reversal=receive(reversed);
  assert.deepEqual(reversal.volume,base.volume);
  assert.deepEqual(reversal.area,base.area);
  assert.equal(reversal.conformance.certifiedRegularConvexSolid,true);
});

test("damaged coordinates cannot be passed off as the regular space-filling reference",()=>{
  const damaged=positions.map(p=>[...p]);
  damaged[4][2]=2; // displace apex a, breaking unit edges and its facet support
  const reading=receive(fixture(),damaged);
  assert.equal(reading.conformance.certifiedRegularConvexSolid,false);
  assert.equal(reading.conformance.allEdgesEqual,false);
  assert.equal(reading.area.certified,false);
  assert.ok(reading.edges.some(edge=>!edge.matchesReference));
  assert.throws(()=>receive(fixture(),positions,{diagonal:[1,1,0],denominator:2}),/positive bounded diagonal/);
  assert.throws(()=>receive(fixture(),positions,{diagonal:[1,1,3],denominator:0}),/positive bounded diagonal/);
  const fractions=positions.map(p=>[...p]);fractions[2][1]=0.5;
  assert.throws(()=>receive(fixture(),fractions),/exact bounded 3D coordinate/);
  assert.throws(()=>geometricReceiving(cellular3Complex({...fixture(),volumes:[]}),positions,metric),/one bounded/);
});

test("the operation exposes metric-calibrated three-component Burgers charges and the exact volume balance",()=>{
  const input=fixture();
  assert.ok(Object.values(operations).some(op=>op.id==="signgraph.holonomy.geometry"));
  const receipt=executeOperation("signgraph.holonomy.geometry",{
    ...input,positions,metric,
    edgeDisplacements:input.edges.map((_,i)=>i===0?[1,-3,5]:[0,0,0]),
  });
  assert.equal(receipt.geometry.conformance.certifiedRegularConvexSolid,true);
  assert.equal(receipt.burgers.dimension,3);
  assert.equal(receipt.burgers.classification,"local-defect");
  assert.deepEqual(receipt.burgers.volumeResidues[0].burgers,[0,0,0]);
  assert.deepEqual(receipt.burgers.volumeSquaredMagnitudes[0].squaredMagnitude,
    {numerator:"0",denominator:"1"});
  const magnitudes=receipt.burgers.faceSquaredMagnitudes.filter(m=>
    m.squaredMagnitude.numerator!=="0");
  assert.equal(magnitudes.length,2);
  for(const item of magnitudes)
    assert.deepEqual(item.squaredMagnitude,{numerator:"85",denominator:"4"});
  assert.deepEqual(metricSquareOfVector([1,-3,5],metric),{numerator:"85",denominator:"4"});
  assert.deepEqual(metricSquareOfVector([10000000,0,0],metric),
    {numerator:"25000000000000",denominator:"1"},
    "large exact Burgers displacements must not inherit the vertex-position limit");
  assert.match(receipt.burgers.metricProvenance,/not observed material elasticity/);
  assert.deepEqual(receipt.topology.betti,{h0:1,h1:0,h2:0,h3:0});
  assert.throws(()=>executeOperation("signgraph.holonomy.geometry",{
    ...input,positions,metric,edgeDisplacements:input.edges.map(()=>[1,0]),
  }),/same three-coordinate frame/);
});

