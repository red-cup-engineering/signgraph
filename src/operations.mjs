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
  cellular2Complex, burgersOfComplex, affineHolonomyOfComplex,
} from "./cohomology.mjs";

export const LIMITS = Object.freeze({
  vertices: 64,
  edges: 128,
  faces: 64,
  faceSteps: 2048,
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
  const allowed = new Set([
    "vertices", "edges", "faces",
    ...(operation === "signgraph.holonomy.burgers" ? ["edgeDisplacements"] : []),
    ...(operation === "signgraph.holonomy.affine" ? ["edgeMotions"] : []),
  ]);
  if (Object.keys(input).some(key => !allowed.has(key)))
    throw new TypeError("signgraph operation has undeclared input fields");

  const { vertices, edges, faces } = input;
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
  if (operation === "signgraph.holonomy.burgers" &&
      (!Array.isArray(input.edgeDisplacements) ||
       input.edgeDisplacements.length !== edges.length))
    throw new TypeError("signgraph operation requires a Burgers vector for each edge");
  if (operation === "signgraph.holonomy.affine" &&
      (!Array.isArray(input.edgeMotions) ||
       input.edgeMotions.length !== edges.length))
    throw new TypeError("signgraph operation requires an affine motion for each edge");
  return Object.freeze({ complex: cellular2Complex({ vertices, edges, faces }), steps });
}

const shape = (complex, steps) => Object.freeze({
  vertices: complex.vertices.length,
  edges: complex.edges.length,
  faces: complex.faces.length,
  faceSteps: steps,
});
const topologicalSummary = (complex, steps) => Object.freeze({
  kind: "signgraph.topologyReceipt",
  coefficientDomain: "Q",
  shape: shape(complex, steps),
  rank: complex.rank,
  betti: complex.betti,
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
      const { complex, steps } = bounded(input, this.id);
      return topologicalSummary(complex, steps);
    },
  }),
  burgers: Object.freeze({
    id: "signgraph.holonomy.burgers",
    description: "Read local integral Burgers face curl, exact vertex potential and global translational holonomy.",
    inputSchema: schema(["edgeDisplacements"], {
      edgeDisplacements: { type: "array", maxItems: LIMITS.edges },
    }),
    execute(input) {
      const { complex, steps } = bounded(input, this.id);
      return Object.freeze({
        topology: topologicalSummary(complex, steps),
        ...burgersOfComplex(complex, input.edgeDisplacements),
      });
    },
  }),
  affine: Object.freeze({
    id: "signgraph.holonomy.affine",
    description: "Read nonabelian C6-semidirect-Z2 local affine defects and global monodromy up to conjugacy.",
    inputSchema: schema(["edgeMotions"], {
      edgeMotions: { type: "array", maxItems: LIMITS.edges },
    }),
    execute(input) {
      const { complex, steps } = bounded(input, this.id);
      return Object.freeze({
        topology: topologicalSummary(complex, steps),
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
