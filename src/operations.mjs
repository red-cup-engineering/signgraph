/**
 * SignGraph's reusable headless holonomy operation family.
 *
 * This is an Engineering capability, not a second graph engine. Ops,
 * enterprise and public callers supply typed instance data. Runtime and
 * stdio surfaces all call the same registry, reusing the owning cellular
 * complex and affine transport implementations.
 *
 * The finite work profile bounds exact-rational elimination and the
 * amount of evidence returned. Never accept a named material, temperature,
 * gauge or source as a mathematical witness: that is outside these inputs.
 */
import {
  cellular2Complex, cellular3Complex, burgersOfComplex, affineHolonomyOfComplex,
} from "./cohomology.mjs";
import { geometricReceiving, metricSquareOfVector } from "./embedding.mjs";
import { planConnectedBarExchanges } from "./cellular-sheaf.mjs";
import { hierarchicalCircuitId, normalizeHierarchicalCircuit, planCombinationalCircuit } from "./hierarchical-circuit.mjs";

export const LIMITS = Object.freeze({
  vertices: 64,
  edges: 128,
  faces: 64,
  faceSteps: 2048,
  volumes: 32,
  volumeSteps: 2048,
  circuitComponents: 32,
  circuitInstances: 64,
  barExchanges: 32,
});

/** Bound the actual structural work before allocating incidence matrices. */
function bounded(input, operation) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new TypeError("signgraph operation requires an input record");
  // The same size budget applies to direct MetroPlat and host calls,
  // not only the JSONL executable. Admit a bounded JSON carrier before
  // exact rational matrix construction. TextEncoder is host-portable.
  const bytes = new TextEncoder().encode(JSON.stringify(input)).length;
  if (bytes > 65536)
    throw new RangeError("signgraph operation exceeds the 64KiB input work budget");
  if (operation === "signgraph.rigidity.connected-exchange") {
    if (Object.keys(input).some(key => !["points", "beforeBars", "afterBars", "dimension"].includes(key)))
      throw new TypeError("signgraph rigidity operation has undeclared input fields");
    if (!Array.isArray(input.points) || !Array.isArray(input.beforeBars) ||
        !Array.isArray(input.afterBars) || ![2, 3].includes(input.dimension))
      throw new TypeError("signgraph rigidity operation needs points, both bar arrays and a 2D/3D dimension");
    if (input.points.length > LIMITS.vertices || input.beforeBars.length > LIMITS.edges ||
        input.afterBars.length > LIMITS.edges)
      throw new RangeError("signgraph rigidity operation exceeds the finite geometry work budget");
    return;
  }
  if (operation === "signgraph.eda.tensor-wavefront") {
    if (Object.keys(input).some(key => !["circuit", "components"].includes(key)))
      throw new TypeError("signgraph EDA operation has undeclared input fields");
    if (!input.circuit || typeof input.circuit !== "object" || Array.isArray(input.circuit) ||
        !Array.isArray(input.components))
      throw new TypeError("signgraph EDA operation needs a circuit and component sequence");
    if (input.components.length > LIMITS.circuitComponents ||
        input.circuit.instances?.length > LIMITS.circuitInstances ||
        input.components.some(child => child?.instances?.length > LIMITS.circuitInstances))
      throw new RangeError("signgraph EDA operation exceeds the finite circuit work budget");
    return;
  }
  const allowed = new Set([
    "vertices", "edges", "faces", "volumes",
    ...(operation === "signgraph.holonomy.geometry" ? ["positions", "metric", "edgeDisplacements"] : []),
    ...(operation === "signgraph.holonomy.burgers" ? ["edgeDisplacements"] : []),
    ...(operation === "signgraph.holonomy.affine" ? ["edgeMotions"] : []),
  ]);
  if (Object.keys(input).some(key => !allowed.has(key)))
    throw new TypeError("signgraph operation has undeclared input fields");

  const { vertices, edges, faces, volumes } = input;
  if (![vertices, edges, faces].every(Array.isArray))
    throw new TypeError("signgraph operation requires arrays of vertices, edges and faces");
  if (vertices.length > LIMITS.vertices || edges.length > LIMITS.edges ||
      faces.length > LIMITS.faces)
    throw new RangeError("signgraph operation exceeds the finite-complex work budget");
  let steps = 0;
  for (const face of faces) {
    if (!face || !Array.isArray(face.boundary))
      throw new TypeError("signgraph operation requires an oriented face walk");
    steps += face.boundary.length;
    if (steps > LIMITS.faceSteps)
      throw new RangeError("signgraph operation exceeds the face-walk work budget");
  }
  let volumeSteps = 0;
  if (volumes !== undefined) {
    if (!Array.isArray(volumes))
      throw new TypeError("signgraph operation requires an array of volumes");
    if (volumes.length > LIMITS.volumes)
      throw new RangeError("signgraph operation exceeds the volume count work budget");
    for (const volume of volumes) {
      if (!volume || !Array.isArray(volume.boundary))
        throw new TypeError("signgraph operation requires an oriented volume boundary");
      volumeSteps += volume.boundary.length;
      if (volumeSteps > LIMITS.volumeSteps)
        throw new RangeError("signgraph operation exceeds the volume boundary work budget");
    }
  }
  if (operation === "signgraph.holonomy.burgers" &&
      (!Array.isArray(input.edgeDisplacements) ||
       input.edgeDisplacements.length !== edges.length))
    throw new TypeError("signgraph operation requires a Burgers vector for each edge");
  if (operation === "signgraph.holonomy.geometry" &&
      (volumes === undefined || !Array.isArray(input.positions) ||
       !input.metric || (input.edgeDisplacements !== undefined &&
       (!Array.isArray(input.edgeDisplacements) || input.edgeDisplacements.length !== edges.length))))
    throw new TypeError("signgraph geometry operation needs volumes, positions, a metric and optional per-edge displacement vectors");
  if (operation === "signgraph.holonomy.affine" &&
      (!Array.isArray(input.edgeMotions) ||
       input.edgeMotions.length !== edges.length))
    throw new TypeError("signgraph operation requires an affine motion for each edge");
  const complex = volumes === undefined
    ? cellular2Complex({ vertices, edges, faces })
    : cellular3Complex({ vertices, edges, faces, volumes });
  return Object.freeze({ complex, steps, volumeSteps });
}

const shape = (complex, steps, volumeSteps) => Object.freeze({
  vertices: complex.vertices.length,
  edges: complex.edges.length,
  faces: complex.faces.length,
  faceSteps: steps,
  ...(complex.kind === "signgraph.cellular3Complex"
    ? { volumes: complex.volumes.length, volumeSteps } : {}),
});
const topologicalSummary = (complex, steps, volumeSteps) => Object.freeze({
  kind: "signgraph.topologyReceipt",
  coefficientDomain: "Q",
  shape: shape(complex, steps, volumeSteps),
  rank: complex.rank,
  betti: complex.betti,
  ...(complex.kind === "signgraph.cellular3Complex"
    ? { exteriorBetti: complex.surfaceBetti } : {}),
  graphOnlyH1: complex.graphOnlyH1,
  totalFaceBoundaryCloses: complex.totalFaceBoundaryCloses,
  // A zero rational b1 cannot exclude finite-order nonabelian monodromy.
  // A Smith-normal-form / torsion integral homology receipt is NOT claimed.
  rationalH1Vanishing: complex.betti.h1 === 0,
});

const commonInput = Object.freeze({
  type: "object",
  required: Object.freeze(["vertices", "edges", "faces"]),
  additionalProperties: false,
  properties: Object.freeze({
    vertices: { type: "array", maxItems: LIMITS.vertices },
    edges: { type: "array", maxItems: LIMITS.edges },
    faces: { type: "array", maxItems: LIMITS.faces },
    volumes: { type: "array", maxItems: LIMITS.volumes },
  }),
});
const schema = (requiredExtra, propertyExtra) => Object.freeze({
  ...commonInput,
  required: Object.freeze([...commonInput.required, ...requiredExtra]),
  properties: Object.freeze({ ...commonInput.properties, ...propertyExtra }),
});

export const operations = Object.freeze({
  topology: Object.freeze({
    id: "signgraph.holonomy.topology",
    description: "Compute exact rational cellular ranks and distinguish filled 2-cells from graph-only cycles.",
    inputSchema: commonInput,
    execute(input) {
      const { complex, steps, volumeSteps } = bounded(input, this.id);
      return topologicalSummary(complex, steps, volumeSteps);
    },
  }),
  burgers: Object.freeze({
    id: "signgraph.holonomy.burgers",
    description: "Read local integral Burgers face curl, exact vertex potential and global translational holonomy.",
    inputSchema: schema(["edgeDisplacements"], {
      edgeDisplacements: { type: "array", maxItems: LIMITS.edges },
    }),
    execute(input) {
      const { complex, steps, volumeSteps } = bounded(input, this.id);
      return Object.freeze({
        topology: topologicalSummary(complex, steps, volumeSteps),
        ...burgersOfComplex(complex, input.edgeDisplacements),
      });
    },
  }),
  geometry: Object.freeze({
    id: "signgraph.holonomy.geometry",
    description: "Receive a real three-cell geometry through exact edge lengths, regular faces, convex supporting planes, outward volume and metric-calibrated Burgers face residues.",
    inputSchema: schema(["volumes", "positions", "metric"], {
      positions: { type: "array", maxItems: LIMITS.vertices },
      metric: { type: "object", additionalProperties: false,
        required: ["diagonal", "denominator"], properties: {
          diagonal: { type: "array", minItems: 3, maxItems: 3 },
          denominator: { type: "integer", minimum: 1 },
        },
      },
      edgeDisplacements: { type: "array", maxItems: LIMITS.edges },
    }),
    execute(input) {
      const { complex, steps, volumeSteps } = bounded(input, this.id);
      const geometry = geometricReceiving(complex, input.positions, input.metric);
      const result = {
        topology: topologicalSummary(complex, steps, volumeSteps),
        geometry,
      };
      if (input.edgeDisplacements !== undefined) {
        const burgers = burgersOfComplex(complex, input.edgeDisplacements);
        if (burgers.dimension !== 3)
          throw new TypeError("signgraph geometric Burgers reading must use the same three-coordinate frame");
        result.burgers = Object.freeze({
          ...burgers,
          faceSquaredMagnitudes: Object.freeze(burgers.faceResidues.map(face => Object.freeze({
            id: face.id,
            squaredMagnitude: metricSquareOfVector(face.burgers, input.metric),
          }))),
          volumeSquaredMagnitudes: Object.freeze(burgers.volumeResidues.map(volume => Object.freeze({
            id: volume.id,
            squaredMagnitude: metricSquareOfVector(volume.burgers, input.metric),
          }))),
          metricProvenance: "supplied diagonal spatial coordinate metric, not observed material elasticity",
        });
      }
      return Object.freeze(result);
    },
  }),
  rigidity: Object.freeze({
    id: "signgraph.rigidity.connected-exchange",
    description: "Fabricate connected one-bar-at-a-time count-preserving graph exchanges with exact rigidity changes; no chemical feasibility or rate is claimed.",
    inputSchema: Object.freeze({
      type: "object", additionalProperties: false,
      required: Object.freeze(["points", "beforeBars", "afterBars", "dimension"]),
      properties: Object.freeze({
        points: { type: "array", maxItems: LIMITS.vertices },
        beforeBars: { type: "array", maxItems: LIMITS.edges },
        afterBars: { type: "array", maxItems: LIMITS.edges },
        dimension: { type: "integer", enum: [2, 3] },
      }),
    }),
    execute(input) {
      bounded(input, this.id);
      return planConnectedBarExchanges(input);
    },
  }),
  eda: Object.freeze({
    id: "signgraph.eda.tensor-wavefront",
    description: "Fabricate bounded combinational execution waves from the existing exact-source tensor circuit graph; reject cycles and consensus nets.",
    inputSchema: Object.freeze({
      type: "object", additionalProperties: false,
      required: Object.freeze(["circuit", "components"]),
      properties: Object.freeze({
        circuit: { type: "object" },
        components: { type: "array", maxItems: LIMITS.circuitComponents },
      }),
    }),
    execute(input) {
      bounded(input, this.id);
      const library = new Map();
      for (const source of input.components) {
        const component = normalizeHierarchicalCircuit(source);
        const identity = hierarchicalCircuitId(component);
        if (library.has(identity))
          throw new TypeError("signgraph EDA operation repeats a component source");
        library.set(identity, component);
      }
      // Selecting additional source is a real act: preserve the complete
      // addressed component closure, and refuse unselected or orphaned source
      // instead of smuggling it into an apparently independent circuit job.
      const root = normalizeHierarchicalCircuit(input.circuit);
      const visited = new Set(), visiting = new Set();
      const visit = identity => {
        if (visited.has(identity)) return;
        if (visiting.has(identity))
          throw new TypeError("signgraph EDA component containment cycle");
        const child = library.get(identity);
        if (!child) throw new TypeError("signgraph EDA component source is absent");
        visiting.add(identity);
        for (const instance of child.instances) visit(instance.component);
        visiting.delete(identity);
        visited.add(identity);
      };
      for (const instance of root.instances) visit(instance.component);
      if (visited.size !== library.size)
        throw new TypeError("signgraph EDA operation contains an unselected component source");
      return planCombinationalCircuit(root, library);
    },
  }),
  affine: Object.freeze({
    id: "signgraph.holonomy.affine",
    description: "Read nonabelian C6-semidirect-Z2 local affine defects and global monodromy up to conjugacy.",
    inputSchema: schema(["edgeMotions"], {
      edgeMotions: { type: "array", maxItems: LIMITS.edges },
    }),
    execute(input) {
      const { complex, steps, volumeSteps } = bounded(input, this.id);
      return Object.freeze({
        topology: topologicalSummary(complex, steps, volumeSteps),
        ...affineHolonomyOfComplex(complex, input.edgeMotions),
      });
    },
  }),
});

export function executeOperation(id, input) {
  const op = Object.values(operations).find(op => op.id === id);
  if (!op) throw new RangeError("signgraph operation id is not installed");
  return op.execute(input);
}
