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
import { j26PunctureView } from "./j26-surface.mjs";
import { unfoldArticulatingIncidenceTower, generateHeadObservationGluing, derivePerformedHeadShadow, readPerformedCellularCover, assessPerformedBoundaryFactorization, readPerformedKinematicSectionSpace } from "./mark-gluing.mjs";

export const LIMITS = Object.freeze({
  inputBytes: 65536,
  sourceLayers: 16,
  vertices: 64,
  edges: 128,
  faces: 64,
  faceSteps: 2048,
  volumes: 32,
  volumeSteps: 2048,
});

/** Default host safety policy, not a finite-complex theorem.
 * Only a trusted in-process host can pass a different budget; a JSON
 * operation input is never allowed to select the host's capacity.
 */
function budgetOf(override) {
  if (override === undefined) return LIMITS;
  if (!override || typeof override !== "object" || Array.isArray(override) ||
      Object.keys(override).some(key => !Object.hasOwn(LIMITS, key)))
    throw new TypeError("SignGraph work budget has undeclared fields");
  const budget = Object.freeze({ ...LIMITS, ...override });
  if (Object.values(budget).some(value => !Number.isSafeInteger(value) || value < 1))
    throw new RangeError("SignGraph work budget entries must be positive safe integers");
  return budget;
}

/** Bound structural work according to the selecting execution host. */
function bounded(input, operation, workBudget) {
  const budget = budgetOf(workBudget);
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new TypeError("signgraph operation requires an input record");
  // The same size budget applies to direct MetroPlat and host calls,
  // not only the JSONL executable. Admit a bounded JSON carrier before
  // exact rational matrix construction. TextEncoder is host-portable.
  const bytes = new TextEncoder().encode(JSON.stringify(input)).length;
  if (bytes > budget.inputBytes)
    throw new RangeError("signgraph operation exceeds the 64KiB input work budget");
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
  if (vertices.length > budget.vertices || edges.length > budget.edges ||
      faces.length > budget.faces)
    throw new RangeError("signgraph operation exceeds the finite-complex work budget");
  let steps = 0;
  for (const face of faces) {
    if (!face || !Array.isArray(face.boundary))
      throw new TypeError("signgraph operation requires an oriented face walk");
    steps += face.boundary.length;
    if (steps > budget.faceSteps)
      throw new RangeError("signgraph operation exceeds the face-walk work budget");
  }
  let volumeSteps = 0;
  if (volumes !== undefined) {
    if (!Array.isArray(volumes))
      throw new TypeError("signgraph operation requires an array of volumes");
    if (volumes.length > budget.volumes)
      throw new RangeError("signgraph operation exceeds the volume count work budget");
    for (const volume of volumes) {
      if (!volume || !Array.isArray(volume.boundary))
        throw new TypeError("signgraph operation requires an oriented volume boundary");
      volumeSteps += volume.boundary.length;
      if (volumeSteps > budget.volumeSteps)
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

/**
 * Source-native input has no independently supplied vertices or edges:
 * it must carry a real original Articulating and a bounded finite prefix.
 * The original source-derived constructor owns everything after admission.
 */
function boundedArticulating(input, workBudget) {
  const budget = budgetOf(workBudget);
  if(!input||typeof input!=="object"||Array.isArray(input)||
     Object.keys(input).some(k=>!["articulating","maxLayers"].includes(k))||
     !Object.hasOwn(input,"articulating"))
    throw new TypeError("Mark tower operation needs an original Articulating and optional maxLayers");
  if(new TextEncoder().encode(JSON.stringify(input)).length>budget.inputBytes)
    throw new RangeError("Mark tower operation exceeds the 64KiB original source budget");
  const maxLayers=input.maxLayers??16;
  if(!Number.isSafeInteger(maxLayers)||maxLayers<1||maxLayers>budget.sourceLayers)
    throw new RangeError("Mark tower operation requires 1-16 finite source layers");
  return Object.freeze({source:input.articulating,maxLayers});
}

/**
 * Both original head-observation consumers receive exactly the same performed
 * Articulating source and host budget; neither may supply its own paths, graph,
 * quotient or authority. This is the shared source admission, not a second
 * formal semantics.
 */
function boundedHeadObservation(input, workBudget) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some(key => !["articulating", "steps"].includes(key)) ||
      !Object.hasOwn(input, "articulating"))
    throw new TypeError("source head quotient operation only admits Articulating plus bounded steps");
  const { source } = boundedArticulating({ articulating: input.articulating, maxLayers: 16 }, workBudget);
  const steps = input.steps ?? 1;
  if (!Number.isSafeInteger(steps) || steps < 0 || steps > 6)
    throw new RangeError("source-generated quotient permits zero to six bounded re-attendings");
  return Object.freeze({ articulating: source, steps });
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
    vertices: { type: "array" },
    edges: { type: "array" },
    faces: { type: "array" },
    volumes: { type: "array" },
  }),
});
const schema = (requiredExtra, propertyExtra) => Object.freeze({
  ...commonInput,
  required: Object.freeze([...commonInput.required, ...requiredExtra]),
  properties: Object.freeze({ ...commonInput.properties, ...propertyExtra }),
});

const performedHeadInputSchema = Object.freeze({
  type: "object", additionalProperties: false,
  required: Object.freeze(["articulating"]),
  properties: Object.freeze({
    articulating: { type: "object" },
    steps: { type: "integer", minimum: 0, maximum: 6 },
  }),
});

export const operations = Object.freeze({
  topology: Object.freeze({
    id: "signgraph.holonomy.topology",
    description: "Compute exact rational cellular ranks and distinguish filled 2-cells from graph-only cycles.",
    inputSchema: commonInput,
    execute(input, { workBudget } = {}) {
      const { complex, steps, volumeSteps } = bounded(input, this.id, workBudget);
      return topologicalSummary(complex, steps, volumeSteps);
    },
  }),
  burgers: Object.freeze({
    id: "signgraph.holonomy.burgers",
    description: "Read local integral Burgers face curl, exact vertex potential and global translational holonomy.",
    inputSchema: schema(["edgeDisplacements"], {
      edgeDisplacements: { type: "array",  },
    }),
    execute(input, { workBudget } = {}) {
      const { complex, steps, volumeSteps } = bounded(input, this.id, workBudget);
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
      positions: { type: "array",  },
      metric: { type: "object", additionalProperties: false,
        required: ["diagonal", "denominator"], properties: {
          diagonal: { type: "array", minItems: 3, maxItems: 3 },
          denominator: { type: "integer", minimum: 1 },
        },
      },
      edgeDisplacements: { type: "array",  },
    }),
    execute(input, { workBudget } = {}) {
      const { complex, steps, volumeSteps } = bounded(input, this.id, workBudget);
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
  affine: Object.freeze({
    id: "signgraph.holonomy.affine",
    description: "Read nonabelian C6-semidirect-Z2 local affine defects and global monodromy up to conjugacy.",
    inputSchema: schema(["edgeMotions"], {
      edgeMotions: { type: "array",  },
    }),
    execute(input, { workBudget } = {}) {
      const { complex, steps, volumeSteps } = bounded(input, this.id, workBudget);
      return Object.freeze({
        topology: topologicalSummary(complex, steps, volumeSteps),
        ...affineHolonomyOfComplex(complex, input.edgeMotions),
      });
    },
  }),
  j26Puncture: Object.freeze({
    id: "signgraph.j26.puncture",
    description: "Read the original Metrologic/Obsmetrologia J26 under explicit face-removal semantics; optional source-edge-addressed integral Burgers observations.",
    inputSchema: Object.freeze({
      type: "object", additionalProperties: false,
      required: Object.freeze(["removedFaces", "retention"]),
      properties: Object.freeze({
        removedFaces: { type: "array", items: { type: "string" } },
        retention: { type: "string", enum: ["skeleton", "face-support"] },
        edgeField: { type: "array", items: {
          type: "object", required: ["edge", "vector"], additionalProperties: false,
          properties: { edge: { type: "string" }, vector: { type: "array" } },
        } },
      }),
    }),
    execute(input, { workBudget } = {}) {
      if (!input || typeof input !== "object" || Array.isArray(input) ||
          Object.keys(input).some(key => !["removedFaces", "retention", "edgeField"].includes(key)) ||
          !Object.hasOwn(input, "removedFaces") || !Object.hasOwn(input, "retention"))
        throw new TypeError("J26 puncture operation admits only removedFaces, retention and optional edgeField");
      const budget = budgetOf(workBudget);
      if (new TextEncoder().encode(JSON.stringify(input)).length > budget.inputBytes)
        throw new RangeError("J26 puncture operation exceeds the source input byte budget");
      const view = j26PunctureView(input);
      const faceSteps = view.complex.faces.reduce((sum, face) => sum + face.boundary.length, 0);
      if (view.complex.vertices.length > budget.vertices ||
          view.complex.edges.length > budget.edges ||
          view.complex.faces.length > budget.faces || faceSteps > budget.faceSteps)
        throw new RangeError("J26 puncture operation exceeds the finite-complex work budget");
      // Return exact typed source geometry to pair a subsequent edge observation
      // with the SAME pinned package/edge-order edition. This source name is
      // neither a legal authorization nor a GR spacetime metric.
      const edges = Object.freeze(view.complex.edges.map(({ id, from, to }) =>
        Object.freeze({ id, from, to })));
      const faces = Object.freeze(view.complex.faces.map(face =>
        Object.freeze({
          id: face.id,
          boundary: Object.freeze(face.boundary.map(step =>
            Object.freeze({ edge: step.edge, direction: step.direction }))),
        })));
      const receipt = {
        kind: "signgraph.j26.puncture-receipt.v1",
        source: view.source,
        retention: view.retention,
        removedFaces: view.removedFaces,
        retainedFaces: view.retainedFaces,
        droppedEdges: view.droppedEdges,
        droppedVertices: view.droppedVertices,
        vertices: view.complex.vertices,
        edges,
        faces,
        topology: topologicalSummary(view.complex, faceSteps, 0),
      };
      if (input.edgeField !== undefined) {
        if (!Array.isArray(input.edgeField) || input.edgeField.length !== edges.length)
          throw new TypeError("J26 puncture edgeField needs exactly one identified entry per retained source edge");
        const byId = new Map();
        const allowed = new Set(edges.map(edge => edge.id));
        for (const entry of input.edgeField) {
          if (!entry || typeof entry !== "object" || Array.isArray(entry) ||
              Object.keys(entry).some(key => key !== "edge" && key !== "vector") ||
              typeof entry.edge !== "string" || !allowed.has(entry.edge) ||
              byId.has(entry.edge) || !Object.hasOwn(entry, "vector"))
            throw new TypeError("J26 puncture edgeField must have one unique original edge identity and vector");
          byId.set(entry.edge, entry.vector);
        }
        receipt.burgers = burgersOfComplex(view.complex,
          edges.map(edge => byId.get(edge.id)));
      }
      return Object.freeze(receipt);
    },
  }),
  observedHeadGluing: Object.freeze({
    id:"signgraph.mark-incidence.observed-head-gluing",
    description:"Construct source-generated head-identification incidence cycles AFTER Articulating, with exact candidate WIT accounting and no physical erasure assertion.",
    inputSchema: performedHeadInputSchema,
    execute(input, { workBudget } = {}){
      return generateHeadObservationGluing(boundedHeadObservation(input, workBudget));
    },
  }),
  performedHeadShadow: Object.freeze({
    id: "signgraph.mark-incidence.performed-head-shadow",
    description: "Compute source-generated observed head paths; distinguish actual Articulating composition from observer-created nonlifting paths.",
    inputSchema: performedHeadInputSchema,
    execute(input, { workBudget } = {}) {
      return derivePerformedHeadShadow(boundedHeadObservation(input, workBudget));
    },
  }),
  performedKinematicSections: Object.freeze({
    id:"signgraph.mark-incidence.kinematic-section-descent",
    description:"Query genuine source-generated Kinematic Alexandrov upper-opens, coherent local occurrence-pair sections, exact sparse 3-axis incidence tensor factors, compatible gluing and original overlap obstructions from the existing performed Articulating.",
    inputSchema:Object.freeze({
      type:"object",additionalProperties:false,
      required:Object.freeze(["articulating","patches"]),
      properties:Object.freeze({
        articulating:{type:"object"},
        steps:{type:"integer",minimum:0,maximum:6},
        patches:{type:"array",minItems:1,maxItems:8,
          items:{type:"array",minItems:1,
            items:{type:"integer",minimum:0}}},
        sections:{type:"array",items:{type:"array",items:{
          type:"object",additionalProperties:false,
          required:["pointIndex","claimIndex"],
          properties:{pointIndex:{type:"integer",minimum:0},
            claimIndex:{type:"integer",minimum:0}},
        }}},
      }),
    }),
    execute(input,{workBudget}={}){
      if(!input||typeof input!=="object"||Array.isArray(input)||
         Object.keys(input).some(k=>!["articulating","steps","patches","sections"].includes(k))||
         !Array.isArray(input.patches)||input.patches.length<1||input.patches.length>8)
        throw new TypeError("performed kinematic sections need original Articulating and finite source patches");
      const budget=budgetOf(workBudget);
      if(new TextEncoder().encode(JSON.stringify(input)).length>budget.inputBytes)
        throw new RangeError("performed kinematic sections exceed source-host byte budget");
      const source=boundedHeadObservation({
        articulating:input.articulating,
        ...(input.steps===undefined?{}:{steps:input.steps}),
      },workBudget);
      return readPerformedKinematicSectionSpace(derivePerformedHeadShadow(source),{
        patches:input.patches,
        ...(input.sections===undefined?{}:{sections:input.sections}),
      });
    },
  }),
  performedCellularCover: Object.freeze({
    id:"signgraph.mark-incidence.performed-cellular-cover",
    description:"Read a source-generated kinematic/L-Space claim fiber as finite cellular local sections, reporting genuine uncovered and incompatible original occurrence pairs, gluing only a conditional compatible full cover.",
    inputSchema:Object.freeze({
      type:"object",additionalProperties:false,
      required:Object.freeze(["articulating","targetPointIndex","patches"]),
      properties:Object.freeze({
        articulating:{type:"object"},
        steps:{type:"integer",minimum:0,maximum:6},
        targetPointIndex:{type:"integer",minimum:0},
        patches:{type:"array",minItems:1,maxItems:64,items:{
          type:"object",additionalProperties:false,
          required:["pointIndex","coveredClaimIndices","selectedClaimIndices"],
          properties:{
            pointIndex:{type:"integer",minimum:0},
            coveredClaimIndices:{type:"array",items:{type:"integer",minimum:0}},
            selectedClaimIndices:{type:"array",items:{type:"integer",minimum:0}},
          },
        }},
      }),
    }),
    execute(input,{workBudget}={}){
      if(!input||typeof input!=="object"||Array.isArray(input)||
         Object.keys(input).some(k=>!["articulating","steps","targetPointIndex","patches"].includes(k))||
         !Number.isSafeInteger(input.targetPointIndex)||input.targetPointIndex<0||
         !Array.isArray(input.patches)||input.patches.length<1||input.patches.length>64)
        throw new TypeError("performed cellular cover requires source Articulating, kinematic locus and bounded original patches");
      if(new TextEncoder().encode(JSON.stringify(input)).length>budgetOf(workBudget).inputBytes)
        throw new RangeError("performed cellular cover exceeds native source-byte budget");
      const generated=boundedHeadObservation({
        articulating:input.articulating,
        ...(input.steps===undefined?{}:{steps:input.steps}),
      },workBudget);
      return readPerformedCellularCover(
        derivePerformedHeadShadow(generated),input.targetPointIndex,input.patches);
    },
  }),
  boundaryFactorization: Object.freeze({
    id: "signgraph.mark-incidence.boundary-factorization",
    description: "Test whether complete recipient-specific source classes descend through the ORIGINAL performed claim-address boundary; return a source occurrence obstruction if not.",
    inputSchema: Object.freeze({
      type: "object", additionalProperties: false,
      required: Object.freeze(["articulating", "requiredReadings"]),
      properties: Object.freeze({
        articulating: { type: "object" },
        steps: { type: "integer", minimum: 0, maximum: 6 },
        requiredReadings: { type: "array", items: { type: "object" } },
      }),
    }),
    execute(input, { workBudget } = {}) {
      if (!input || typeof input !== "object" || Array.isArray(input) ||
          Object.keys(input).some(key => !["articulating","steps","requiredReadings"].includes(key)))
        throw new TypeError("boundary factorization requires original Articulating, steps and recipient readings");
      if (new TextEncoder().encode(JSON.stringify(input)).length > budgetOf(workBudget).inputBytes)
        throw new RangeError("boundary factorization exceeds the input byte budget");
      const generated = boundedHeadObservation({
        articulating: input.articulating,
        ...(input.steps === undefined ? {} : { steps: input.steps }),
      }, workBudget);
      return assessPerformedBoundaryFactorization(derivePerformedHeadShadow(generated), input.requiredReadings);
    },
  }),
  articulatingTower: Object.freeze({
    id: "signgraph.mark-incidence.articulating-tower",
    description: "Construct source-owned Mark wall/cell prefix topology and exact chain-map ascent/retraction; no external edges or physical identity.",
    inputSchema: Object.freeze({
      type:"object",additionalProperties:false,
      required:Object.freeze(["articulating"]),
      properties:Object.freeze({
        articulating:{type:"object"},
        maxLayers:{type:"integer",minimum:1},
      }),
    }),
    execute(input, { workBudget } = {}) {
      const {source,maxLayers}=boundedArticulating(input, workBudget);
      return unfoldArticulatingIncidenceTower(source,{maxLayers});
    },
  }),
});

// One published operation ID SHALL designate exactly one schema and executor.
// A duplicate makes generated operation catalogs and actual dispatch disagree.
// Refuse it at module admission, before any source reading or host effect.
const operationList = Object.values(operations);
const operationById = new Map();
for (const op of operationList) {
  if (typeof op?.id !== "string" || !op.id ||
      typeof op.execute !== "function" || !op.inputSchema)
    throw new TypeError("signgraph operation registration lacks its declared typed source contract");
  if (operationById.has(op.id))
    throw new TypeError("signgraph duplicate operation id: " + op.id);
  operationById.set(op.id, op);
}

export function executeOperation(id, input, { workBudget } = {}) {
  const op = operationById.get(id);
  if (!op) throw new RangeError("signgraph operation id is not installed");
  return op.execute(input, { workBudget });
}
