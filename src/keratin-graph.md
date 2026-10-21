# Keratin Graphs — hole-aware, source-positioned graphing

**Engineering owner:** SignGraph (Red Cup Engineering).  **Mathematical owner:** Obsmetrologia (Lenticule Science), especially the active [keratin/feather-graph frontier #79](https://github.com/lenticule-science/obsmetrologia/issues/79). **Status:** bounded finite working readout; NOT a native generator, causal-hole proof, physical model, or deployed visualization service.

A **Keratin Graph** is a graph workbench *over* existing SignGraph's original performed-predication reading, not a new primitive ontology. It adds inspectable, explicitly declared finite stalk alphabets; directed admissibility relations; event-indexed irreversible information restrictions; filled 2-cells; candidate unfilled boundary walks; and observer-scoped reports. It can compute exact finite compatibility, separate graph topology from sheaf cohomology, and create Graphviz visualizations which retain evidence labels.

A graph of actual source-witnessed relations is a carrier. An **application-supplied finite state model** over that carrier is an interpretation, not an authenticating act. A claim that the latter arises from Mark, Articulating and a proof-carrying causal shroud is a *further science result*, not something a JavaScript constructor may conjure from a label.

## Use the workbench now

```sh
npm run test:keratin
npm run demo:keratin
node examples/keratin-hole-workbench.mjs --dot | dot -Tsvg > keratin-hole.svg
```

The executable example uses three source-labeled original predications: two incomparable continuations from one root and a separately supplied cross-contact. This is precisely the **finite conditional feather-fork fixture** from the existing SignGraph/native research, not evidence that an Obsmetrologia `Articulating.Beneath` has been promoted into an admitted object-language predication. Its parity tables make every edge locally feasible, yet the three constraints jointly impossible. An observer able to see only one branch obtains two plausible states, neither globally extendable. The candidate triangular boundary has graph-only first Betti number one, and its incidence remains a **proposed unfilled face**, not a physical cavity or causal horizon.

### Programming interface

```js
import {
  keratinPositionKey, keratinGraphOfPredications, analyzeKeratinGraph,
  keratinLinearSheaf, keratinGraphToDot,
} from '@red-cup-engineering/signgraph/keratin-graph';

const graph = keratinGraphOfPredications({
  source: originalPredications, // existing feather-graph input: original occurrences
  selectors: {axialPredicate:'continues', transversePredicate:'touches'},
  stalks: [{position:keratinPositionKey('a'), states:['0','1']}, /* ... */],
  contacts: [{occurrence:'a>b', allowed:[['0','0'],['1','1']]}, /* ... */],
  faces: [], // ONLY explicitly supplied 2-cells, with sourceRecord
  holes: [{id:'gap',sourceRecord:'source:gap',boundary:[
    {occurrence:'a>b',direction:1}, /* a complete signed closed walk */
  ]}],
  locks: [{id:'event:1',position:keratinPositionKey('a'),
    sourceRecord:'source:event:1',excludes:['0']}],
  observers: [{id:'observer',visiblePositions:[keratinPositionKey('a')],visibleOccurrences:[]}],
});
const exact = analyzeKeratinGraph(graph);
const dotText = keratinGraphToDot(graph, exact); // Graphviz DOT
```

The abbreviated `holes` boundary above is deliberately not executable on its own: a real boundary must be a complete closed walk. The example program supplies one.

The finite state sheaf has stalks `K_v`, one original directed relation occurrence `e:s(e)→t(e)` per contact, and permitted pair relation `R_e⊆K_s×K_t`. For incidence subgraphs `U`, the set of sections is `{x | (x_s,x_t)∈R_e for every included e}`. The exact incidence-cover sheaf condition for this construction and its relation to graph parity are established **conditionally** in the [existing FOAM finite-fibers research packet](https://github.com/lenticule-science/obsmetrologia/issues/79), not reproved by this code. The workbench enumerates full finite compatible assignments under a stated work bound, supplies a minimal edge-conflict core where feasible, and compares each observer's local sections to the actual global sections and their projections. The model returns **not evaluated**, never `0`, when a budget is exceeded.

### Exact topology and what the word “hole” does NOT license

- **Missing evidence/relations:** no edge is invented, including sibling–sibling contacts. The native feather source must explicitly supply any cross-contact.
- **Graph cycle:** first graph cohomology is computed from the actual one-skeleton, with original source occurrence IDs including parallel edges. A graph cycle alone is not evidence of a puncture.
- **Filled 2-cell:** only an explicitly supplied closed oriented boundary and its caller-identified source record produce a face in `cellular2Complex`. Neither the witness label nor its presence in JSON proves physical embedding. Exact rank distinguishes graph-only `H¹` from the true supplied 2-complex `H¹`.
- **Candidate unfilled hole:** an explicitly claimed closed boundary is tested by **temporarily** filling it solely in a separate rank probe. The face is never inserted into the real complex. Each candidate reports whether its class is nontrivial; the aggregate reports how many independent candidate boundary classes are present. Two equally homologous holes do not automatically count twice. This is not a theorem that a physical hole exists.
- **Global section obstruction:** all finite stalks may be nonempty, and each contact individually feasible, without *any* globally compatible state. The test's filled triangular disc still has zero valid sections. This obstruction is not synonymous with topology `H¹`.
- **Causal horizon / observer cone:** observer scopes are caller-declared, and an inaccessible interior is not manufactured. Translating `Hole`/`ShroudIndexedKeratin` and light-cone observation from Obsmetrologia into lawful source witnesses remains an independent research and receiving obligation.

Lock events form an ordered, separately identified, append-only history. Each may **exclude** locally modeled states: exclusion unions are monotone in the *information-refinement order* and cannot later add a forbidden state. This is a deliberate finite surrogate. Lean's `Lock.step_infl` on a complete lattice and physical felting/fracture mechanisms are NOT proved equivalent to this surrogate. The caller supplies exclusion meaning; SignGraph does not infer it from the event's name.

### Numeric sheaf alternative on the same source relations

`keratinLinearSheaf(graph,{vertexStalks,relationStalks})` reuses the same original vertex and directed contact identities but supplies *separate* finite-dimensional vector stalks and restriction matrices. It delegates construction to the existing `cellularSheaf` and exact rational `cellularSheafCohomology` rather than implementing another matrix/rank engine. It measures sheaf `H⁰/H¹` on the **graph one-skeleton**. Matrix restrictions and their semantics are caller-supplied. This does not extend linear restrictions over attached 2-cells; the original [SignGraph 2-complex/sheaf work #17](https://github.com/red-cup-engineering/signgraph/pull/17) owns that additional translation. Thus even `H¹=0` in a *filled topological surface* need not equal the graph-sheaf `H¹`; one cannot deduce physical closure by reusing a numerical rank.

### Visualization and interchange

The workbench emits industry-standard **Graphviz DOT** without requiring a new runtime framework. Solid arrows are ONLY original performed-predication readouts; their IDs, predicate labels, and source records remain in `id`, `label`, and `tooltip`. Red marks a minimal unsatisfiable contact core when one is evaluated; blue marks candidate unfilled boundaries; green box overlays denote supplied 2-cells. Dashed/dotted spokes explicitly say `annotation` and are NOT relations in the keratin graph. Graphviz is a rendering *projection*; layout coordinates and display colors confer no source authority. The exported full structured object, not the SVG, carries the exact topology, stalks, contact tables, lock order and observer scope.

FEATHER-G is a different standard numerical embedding algorithm. The already open [FEATHER-G codec PR #29](https://github.com/red-cup-engineering/signgraph/pull/29) handles its **lossy** undirected-graph projection with sidecars. Neither numerical embeddings nor Graphviz SVG are native Keratin Graphs; both are consumer readouts.

## Receiving gates still owed

1. Source-only finite program: tests of identity, orientation, gap-vs-filled-face topology, exact global compatibility, lock monotonicity, cone-limited observation, matrix sheaf handoff, malicious data refusal, bounded computation and Graphviz DOT roundtrip.
2. **Native dependencies:** run the package's actual `node --test` suite with the published SignCell, Metrologic, exact arithmetic and related house packages. Offline test doubles are insufficient for claiming integration. The private repository's GitHub Actions runner has previously failed allocation before tests; report absent CI as absent rather than green.
3. A source-admissible **KeratinSheaf/`ShroudIndexedKeratin` → SignGraph bridge** must be established by Lenticule Science without inventing an `Articulating.Beneath` predication, hole interior, or observer cone. The existing `#79` obligation remains open.
4. Real consuming workloads (e.g., Semioverse provenance gaps, SignCraft-compatible fibers, and actual agency resource flows), graph interaction, actor rights, and packaging/installation must be independently received. A passing unit test or attractive SVG cannot close that institutional outcome.

**Workload bounds:** 128 source positions, 256 original relations, 32 faces, 32 candidate holes, 512 lock events, 8 explicitly scoped observers; max 16 symbols per stalk, 256 permitted pairs per contact; default 250,000 finite assignments; explicit upper cap 2,000,000. Exceeding finite feasibility budget produces an unknown/not-evaluated **receipt** while exact topology remains available. The bounds are engineering work budgets, not a theorem constraining mathematical keratin.
