# SignGraph

A general graphing library whose semantic specialization organizes the assembled bilattice as a Chu space
-- points (SignCell's cells, and the things they are addressed by) against
observations (attributes, queries, indexes) under an evaluation, with Chu
morphisms (forward map, backward demand, adjointness) as the contract
between two organizations. That is its most boring reading, and it is the
brand name it uses.

A contract of data carried between parties with demand transported back is
what networking is. Pure.

## What lives here

- `semantic-graph` — one closed, NI-addressed graph over SignCell's typed
  Marks, declarations, and EAVT-addressed witnessed edges. Its queries and
  bounded continuations preserve every source witness without pretending that
  a page is a complete graph; gluing records schema obstructions without
  promoting projections to lossless states. All runtime graph operations and
  their twelve original regression cases were removed from SignCell.


- `token-sheaf` — the sheaf of tellings over SignCell's token frame: the
  section at a token is what is told of it, restriction runs along
  specialization, and `inherited(frame, token)` glues the sections of the
  token's generalizations by knowledge join, holding a disagreement as a
  contested cell with each side's generalizations (the gluing obstruction).
  Claim by claim it is SignChain's possibilizing of the told fiber. Heyting
  algebra (SignCell), fiber algebra (SignChain), sheaf (here): the
  dependencies run that way only.
- `cell-graph` — `cellGraph(cells, observations)` builds the Chu
  relation of held SignCells under named, total observations
  (`{ name, evaluate(cell) }`) using metrologic's `chuSpaceOfEntries`
  and SignCell's canonical coincidence. Its `relationGraphOfCells`
  reads symmetric adjacency: it is suitable for connectivity, undirected
  Laplacians and diffusion, but **does not prove causal direction**.
  `flowNetworkOfCells` projects the existing oriented flow-network directly
  from SignCells, and `flowNetwork(section)` delegates to that reading.
  Every non-reflexive cell contributes the subject→object incidence with
  boundary ∂[a→b]=[b]−[a]. Reversing a link changes the boundary even when
  the symmetric relation graph is unchanged. Parallel cells retain
  distinct incidence edges; loops retain vertices but have zero boundary.
  No second graph type, signer, evidence authority or new execution path
  is introduced by these projections.
- `graph` — the deterministic typed directed-multigraph carrier and its
  traversal, cycle, path, merge, and text-rendering operations.
- `cellular-sheaf` — cellular sheaves on a graph (vector stalks on vertices and edges, restriction matrices on
  incidences), the coboundary δ⁰, the sheaf Laplacian L = δᵀδ, exact cohomology over ℚ (dim H⁰ = dim C⁰ − rank δ,
  dim H¹ = dim C¹ − rank δ, ranks from the data layer's `number/rational-matrix`), and the deterministic heat flow
  x ← x − αLx (Gershgorin step, pinned vertices as boundary evidence, firing steps where an edge residual crosses its
  tolerance). It is the numeric side of Obsmetrologia's Laplacianizability (the Hodge isomorphism H• ≅ ker Δ, with the
  inner product supplied here), LawvereKernelH0 (the harmonic kernel is H⁰, the global sections, and diffusion converges
  to the harmonic section), CoordinationCohomology (Ȟ⁰ = |V| − ρ, Ȟ¹ = |E| − ρ; the constant sheaf agrees with
  `cohomologyOfCells`) and ClosureFlowDynamics (firing versus smooth steps). `rigiditySheaf` is the bar-framework
  rigidity matrix as such a sheaf: H⁰ is the infinitesimal motions (rigid iff d(d+1)/2), H¹ the self-stresses.
  `weightedSheafLaplacian(sheaf, metrics)` supplies L = δᵀWδ with one full symmetric positive definite
  edge-stalk metric per edge, in sheaf order. `weightedSheafDirichlet(sheaf, metrics, x)` returns Σ rᵀWr
  and each edge's unweighted residual and energy (no factor of 1/2). Both use the same Cholesky
  whitening Cᵀ where W = CCᵀ and the existing coboundary, so non-identity restrictions and self-edges
  retain their meaning and ker L = H⁰. Metrics are validated without adding a ridge; only relative
  floating-point symmetry round-off is averaged. Exact cohomology remains the separate rational
  operation. For inverse-covariance metrics these describe calibrated disagreement; they do not
  establish a probabilistic forecast or trading edge.
  `compareFixedCountRigidity({before, after, dimension})` composes the
  existing exact rational `rigidityReceipt` for two simple embedded
  bar-joint frameworks with equal vertex and bar counts. It fabricates
  the change in kinematic rank, mechanisms and self-stresses without
  mistaking preserved Euler index/mean coordination for invariant
  rigidity. Use `@red-cup-engineering/signgraph/cellular-sheaf`.
  It does not assert that a chemical associative exchange realizes a
  candidate graph or that crystallinity or mechanical strength is measured.
- `hierarchical-circuit` — the established pure typed relation model
  for SEN circuit-shaped diagrams and finite FOUR-valued semantics.
  `planCombinationalCircuit` remains a pure graph-order projection for
  existing callers, not the owner of Electronic Design Automation or its
  fabrication machinery. Constructive, evidence-aware synthesis belongs in
  SignCraft, where consumers supply their own lawful constraints.
  `verifyCircuitEquivalence` checks only the modeled behavior, not a
  physical or deployed circuit.
- `cohomology` — `cellular2Complex({vertices, edges, faces})` extends the
  existing graph incidence to **oriented 2-cells**. Every face must
  attach by a composable closed walk, `δ¹δ⁰=0` is checked, and exact rational
  ranks yield `b₀=V−rank δ⁰`, `b₁=E−rank δ⁰−rank δ¹`, and `b₂=F−rank δ¹`.
  Graph-only `H¹` is reported separately: on the received J26 exterior it
  is 7, but the face-filled 2-complex has `(b₀,b₁,b₂)=(1,0,1)`.
  `burgersOfComplex` evaluates the integral translational edge 1-cochain:
  `δ¹b` is a local face-closure defect, while a face-closed but nonexact
  assignment witnesses global holonomy. The root-fixed spanning forest gives
  a constructive vertex potential precisely when every edge's residual
  vanishes. A closed oriented surface necessarily has zero *total* abelian
  face charge, though individual faces may have opposite residues.
- `paths` / `cohomology` — `sixfoldMotion`, `sixfoldCompose`,
  `sixfoldInverse`, `sixfoldDevelop` and `affineHolonomyOfComplex`
  recover the **nonabelian** `ℤ² ⋊ C₆` transport of
  `Obsmetrologia.AperiodicOrder.Defect.Disclination`. In particular the
  Science 5–7 word at separation `s` has neutral rotation and Burgers vector
  `(0,-s)`, whereas an unpaired five-site carries rotational residue.
  A face with nontrivial affine commutator cannot be declared flat merely
  because its plain translations sum to zero. The ordered transport is
  frame-relative; only triviality and conjugacy data survive a base-frame
  change. Global flat affine monodromy is a representation of the
  fundamental group up to conjugacy, not an element of additive H¹.
  The sixfold **planar** crystal group is not identified with the
  now-calibrated **three-dimensional** J26 spatial metric: constructing a
  compatible lattice transport is still a real mathematical obligation.
  Neither kind of topological defect has been proved equivalent to
  thermodynamic temperature.
- `relation-adapters` — projections from already-parsed Markdown, JavaScript,
  and EAVT evidence into relation observations.
- `pam` — graph-backed predicate-algebra modeling over EAVT's relation web
  (`@red-cup-engineering/eavt-services-section/relation-web`), which is data: content-addressed
  relation observations over plain JSON terms, with no cell, valuation or FOUR.

## Pure functional boundary

SignGraph's reusable core constructs and transforms relations, Chu spaces,
diagrams, incidences, sheaves and cohomology from explicit inputs. It does not
own EDA, protein-folding, materials manufacturing, payment, provider dispatch,
credentials or any execution of an external process. SignCraft composes the
native sign structures through evidence-sensitive generative transformations.
A graph metric, even with a specialized example, does not acquire the
authority to synthesize or fabricate its consuming domain.

The four preexisting holonomy JSONL operations are retained as legacy
compatibility surfaces for already selected consumers. They should be
extracted to their competent engineering operations owner without changing
their mathematical core; new application-specific dispatch operations are
not admitted to this library.

## Operational holonomy receiving

`./operations` retains four historical, read-only holonomy adapter operations:
`signgraph.holonomy.topology`, `signgraph.holonomy.burgers`,
`signgraph.holonomy.affine`, and `signgraph.holonomy.geometry`.
These project the SignGraph 2-complex and its exact algebra; they are
compatibility adapters, not new semiotic or fabrication primitives. Callers in Operations, Corporate, Public,
or an agent-hosting platform supply particular vertices, oriented edges,
oriented face walks, and—when appropriate—one measured displacement or
sixfold affine motion per edge. The optional geometry operation accepts an
additional exact scaled Cartesian metric, spatial positions, and a signed
single-volume boundary from a source-owned carrier. No physical
thermometry, hidden material instance, or remote execution is invented.

The limits below are **default host/JSONL work budgets**, not an algebraic
upper bound on admissible finite complexes. A trusted in-process caller can
explicitly select a larger finite resource allowance through
`executeOperation(id, input, {workBudget: {vertices: 256, edges: 512}})`.
Omitted dimensions retain the conservative default; unrecognized or invalid
budget entries refuse, as do budget fields smuggled into an operation input.
This does not promise physical host capacity or permission for a public
request to grant itself more work. The JSONL executable retains its defaults.

An installed package also exposes the executable `signgraph-holonomy`
for newline-delimited JSON requests and receipts. For example:

```sh
printf '%s\\n' '{"operation":"signgraph.holonomy.affine","input":{"vertices":["p"],"edges":[{"id":"a","from":"p","to":"p"}],"faces":[{"id":"disk","boundary":[{"edge":"a","direction":1},{"edge":"a","direction":1}]}],"edgeMotions":[{"rotation":3,"translation":[0,0]}]}}' | signgraph-holonomy
```

This one-cell projective-plane carrier has **rational** first Betti
number zero yet has order-two, globally nontrivial sixfold rotational
monodromy. The CLI must not suppress that result merely because the
rational rank vanishes: ordinary linear cohomology and finite-order
nonabelian holonomy are different invariants.

The CLI emits one JSON receipt for each request, continues after individual
refusals, and exits nonzero if any request fails. A single request is
at most 64 KiB, a batch at most 1024 requests; the operation admits
at most 64 vertices, 128 edges, 64 faces and 2048 oriented steps.
These bounded estimates precede exact rational elimination. Receipts
report the input shape, rational ranks, local face residues, and
nonabelian monodromy when requested—not installation/qualification claims.

`npm run check:holonomy` checks syntax and `npm run test:holonomy`
runs the existing cellular/affine regressions plus operation and CLI
receiving. A published artifact and running MetroPlat instance must
be independently received; committing this source does not cause
automatic installation. This is a planar sixfold lattice model, not
yet a theorem equating J26's three-dimensional honeycomb with a
two-dimensional Burgers lattice or with temperature.

## J26 volume completion and Burgers/Stokes receiving

The J26 `cellComplex` in **Obsmetrologia** contains one 3-cell as well as
its oriented exterior; the exterior is **not** the full solid. Engineering
`cellular3Complex({ vertices, edges, faces, volumes })` extends the existing
2-complex without creating another incidence engine. A volume boundary is a
signed 2-chain of admitted faces. It is admitted only when
`∂₂ ∂₃ = 0`; exact rational rank `rank ∂₃` gives
`b₂ = F − rank ∂₂ − rank ∂₃` and `b₃ = V₃ − rank ∂₃`.
For the current J26 Science fixture the exterior has
`(b₀,b₁,b₂)=(1,0,1)`, while adding its one oriented interior gives
`(b₀,b₁,b₂,b₃)=(1,0,0,0)`. Two oppositely oriented volumes over that
same boundary produce a nontrivial 3-cycle, `b₃=1`.

`burgersOfComplex` accepts both exact 2D and 3D integral translation
cochains (the dimension is determined by a declared edge reading).
Its **face residues** are `δ¹ b`; its **volume residues** are
`δ²δ¹ b`. The latter vanish on every admitted volume for *every*
edge assignment, including ones with large nonzero local face residues.
That is the discrete Stokes/Bianchi composition test, not a device to
hide defects by summing them away. It produces an explicit local-to-
volume conservation receipt and remains covariant under consistent
face-orientation changes. Prior 2-complex-only inputs and 2D outputs
remain admitted and retain their original meaning.

All three public operations now also admit optional `volumes`, with the
existing JSONL executable unchanged. Admission budgets bound the added
work to 32 volumes and 2,048 oriented volume-face steps, as well as the
existing graph/face budget. An explicit `volumes: []` is not the same
as inventing a J26 interior; a volume is never inferred from a closed
surface. The affine `ℤ² ⋊ C₆` reader can traverse the resulting
3-complex's edges and faces, but remains a **planar** frame model:
no fabricated 3D rotational group, lattice embedding, physical elastic
constants, or temperature relation has been claimed.

**Scope:** a signed cellular 3-chain satisfying `∂₂ ∂₃=0` is
not, by itself, proof that the volume is a geometrically embedded ball.
J26's specific one-volume topology is backed by its source-owned
combinatorial representation, and the executable test is independent
receiving of the ranks and Stokes law. Physical qualification, registry
publication, and installed-service receiving are still separate.

## Exact spatial J26 geometry receiving

Lenticule Science owns the **machine-readable regular J26 reference** at
`lenticule-science/obsmetrologia/data/records/geometric-carriers/j26-regular-embedding.json`
(source-linked to its qualified `J26.lean` carrier). The exact spatial
coordinates, in J26 vertex order, are the four square vertices
`(±1,±1,0)`, the upper pair `(±1,0,1)` and lower pair
`(0,±1,-1)`. They use metric
`ds²=(dX²+dY²+3dZ²)/4`. These are not arbitrary vectors:
they represent the regular equilateral-prism half-cells in real 3D space.

`geometricReceiving(cellular3Complex(...), positions, metric)` checks
the geometric obligations **independently** of topological chain closure:
all 14 edges have the same exact length, every triangle is equilateral,
every quadrilateral is a planar square with two correct diagonals, and
every exterior face lies on a strict supporting plane of the full
vertex set. The oriented volume is computed by the exact determinant
triangulation, with a signed outward-incidence test.

For this J26 reference the physical unit-edge results are
`edge length² = 1`,
`area = 4 + √3`, and
`positive volume = √3/2`.
All eight face walks in `J26.lean` are **geometrically inward**
on this coordinate witness. The geometric, outward-oriented volume
therefore has **−1** incidence with each of those face walks, even
though either uniform sign gives the same topological Betti ranks.
Wrong physical orientation is a failed geometric receipt, not
automatically a topological chain error.

`signgraph.holonomy.geometry` receives the declared geometric carrier
through the same admitted operations registry and JSONL executable.
Optional **3-coordinate Burgers readings** are measured using the
same spatial diagonal metric: their facewise physical squared lengths
are exact rationals and their total charge obeys the admitted 3-cell
Stokes law. All geometric calculations use bounded integers and BigInt,
not approximate floating-point predicates, and report failed obligations
on nonregular or misoriented inputs rather than silently normalizing
them into compliant solids. An exact spatial J26 realization has thus
been witnessed, rather than retained as a perpetually speculative
"missing bridge."

**Still distinct:** one regular convex spatial realization does not
itself construct the full face-to-face, gap-free honeycomb with explicit
tile-neighbor morphisms. It also does not establish a homomorphism from
the planar `ℤ² ⋊ C₆` defect dynamics into the 3D cell automorphisms,
nor a stress/strain law, temperature scale, or thermodynamic free-energy
identification. Those remain genuine theorem and qualification targets;
the new geometry data is a concrete carrier on which to attempt them.

## Depends on

`@lenticule-science/metrologic` for mathematics, SignCell for cells, and
SignChain for cell order and FOUR evidence profiles. Nothing here imports
SignCraft; SignCraft imports this.

## Canonical graph ordering across runtime locales

Content-addressed semantic graph cells, relations, witness edges and gluing
obstructions use the shared semiotic-content-address provider's NFC-aware UTF-8
byte ordering, not host `localeCompare`. This does not assert that matching
Mark presentations establish observational equality or external evidence:
SignCell continues to own typed source identity and SignChain owns the actual
tellings. The SignGraph source edition 0.5.0 selects SignCell ^0.7.0,
whose concept address ordering is defined by the same Data-owned byte comparator.
This needs genuine package/lock selection before a running consumer can claim it.
