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
  change. This sixfold **planar** crystal carrier is not yet an embedding
  or tiling theorem for the **three-dimensional** J26 gyrobifastigium,
  and neither kind of topological defect has been proved equivalent
  to thermodynamic temperature.
- `relation-adapters` — projections from already-parsed Markdown, JavaScript,
  and EAVT evidence into relation observations.
- `pam` — graph-backed predicate-algebra modeling over EAVT's relation web
  (`@red-cup-engineering/eavt-services-section/relation-web`), which is data: content-addressed
  relation observations over plain JSON terms, with no cell, valuation or FOUR.

## Depends on

`@lenticule-science/metrologic` for mathematics, SignCell for cells, and
SignChain for cell order and FOUR evidence profiles. Nothing here imports
SignCraft; SignCraft imports this.
