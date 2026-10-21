# SignGraph

A general graphing library whose semantic specialization organizes the assembled bilattice as a Chu space
-- points (SignCell's cells, and the things they are addressed by) against
observations (attributes, queries, indexes) under an evaluation, with Chu
morphisms (forward map, backward demand, adjointness) as the contract
between two organizations. That is its most boring reading, and it is the
brand name it uses.

A contract of data carried between parties with demand transported back is
what networking is. Pure.


## Named competitive target: LangGraph

[The original SignGraph package requirement](../data/records/requirements-records/signgraph-meets-then-beats-application-peers.json)
names **LangGraph** as the Leader-selected *meet-then-beat* target. **Oxigraph**
is a different, additional graph-database target. This named Work belongs
to SignGraph; it must not be silently relabeled a FeltOS-only or Organizing-only
requirement when a user asks about durable agent execution.

The actual LangGraph comparator is a low-level, **running stateful graph
orchestration framework**, not just an adjacency list: StateGraph state and
reducers, conditional edges and Send/Command routing, subgraphs, persistent
thread checkpoints and state history, human interrupts/resume, and event
streaming. See [LangGraph's overview](https://langchain-ai.github.io/langgraph/),
[graphs](https://langchain-ai.github.io/langgraph/reference/graphs/),
[persistence](https://langchain-ai.github.io/langgraph/concepts/durable_execution/)
and [interrupts](https://langchain-ai.github.io/langgraph/concepts/breakpoints/).
Its interrupt contract can restart a node and repeat earlier side effects;
that is a concrete comparative case, not an assertion that this package
already handles effects better.

SignGraph owns the **shared graph relations, identity, evidence-bearing topology
and graph transition/query semantics** used by the competitor-facing capability.
It must reuse SignCell for original Mark/cell admission, SignChain for witnessed
sequential/evidence composition, and SignCraft for higher-order realization.
Durable file/database/host lifecycle, external effects and office authority
belong to their original Engineering/Organizing/FeltOS/Computer Systems
suppliers. The SignGraph *market obligation* remains open until those
dependencies form a usable, source-qualified SignGraph-composed product,
tested on equal workloads and independently received. Do not move runtime
code into this pure graph layer, nor waive the customer requirement because
the graph source is pure.

The selected workloads, candidate differentiators, and explicitly unknown
parity/receiving are specified at the **existing original requirement** above,
not in a second benchmark registry. A green graph test proves one native
graph behavior; it does not prove LangGraph parity or a running customer
service.

## Feather graphs: posit graphs as charged feather readings

The original [Obsmetrologia feather-graph assay](https://github.com/lenticule-science/obsmetrologia/blob/main/docs/research/2026-10-16-relationlessness-spiral-pisot-prior-work-assay.md#relation-only-feather-graphs-candidate-derived-forks-and-first-negative-controls)
starts with **performed directed predication roles**, not a chosen vertex set.
The `./feather-graph` export implements one finite source-position **reading**
of those original predications, retaining each source occurrence and the
distinct `{ performed, side: token|claim }` positions even when their optional
Mark displays coincide. The sites in the result are induced by those original
positions.

`featherGraphOfPredications(originalOccurrences, { axialPredicate,
transversePredicate })` derives incomparable, source-reported sibling
continuations and finds their **separately supplied** transverse predications.
It returns explicit original occurrence-id sequences for each direct and
two-step route, leaving the comparison `unmeasured`: path composition does
not authorize a new source predication or assert that the two routes commute.
A branch without a reported cross-contact remains a branch-only candidate.
Fully saturated ordinal comparisons whose descendants are comparable do not
count as immediate source forks. Cyclic ancestry, duplicate occurrence IDs,
conflicting displays for one performed position and excessive finite branching
are refused.

`positGraphOfFeather(feather, posits)` retains **the same original feather
graph** and attaches independent source-reported for/against testimony to the
original predication occurrences. It retains multiple opposed tellings rather
than silently replacing one with the other. This is the finite-engineering
reading of the Leader's assertion that *posit graphs are feather graphs*:
Positing adds evidence/charge, not a competing primitive vertex-and-edge
carrier. The original SignChain FOUR adjudication and original authority to
admit that testimony remain with their existing owners. Even a JSON copy of
the readout cannot acquire in-process derivation authority.

**Scientific frontier:** the original Articulating `Beneath` relation is a
proposition about performances, not yet a proved object-language
`SourceDirectedCell`. Source-record IDs and caller-declared predicate
selectors alone cannot close that gap. New source-warranted transverse-contact
production, cone-observer lift and route comparison remain the mathematical
obligations of [Obsmetrologia issue #79](https://github.com/lenticule-science/obsmetrologia/issues/79).
The present pure implementation is a **conditional view over caller-qualified
source acts**, not a theorem or authenticated source importer.

## Flat-file graph stores: additive SQLite and CouchDB obligations

The Leader has additionally named **SQLite** and **Apache CouchDB** as
meet-then-beat targets. The additive [original owner requirement](../data/records/requirements-records/signgraph-meets-then-beats-sqlite-and-couchdb.json)
preserves LangGraph and Oxigraph and records separate matched queries,
transactions/crash-recovery and offline-replication workloads. The dated
reference baselines are SQLite **3.54.1** (2026-10-16) and CouchDB
**3.5.3** (2026-10-12), selected from those products' primary sources.

SignGraph owns source-qualified predication/query geometry and the identity
of original relation routes. Its actual downstream flat-file database substrate
already exists: the original
[SEAVT store](https://github.com/red-cup-engineering/semiotic-eavt-services-section/blob/main/content/text/documents/specifications/store.md)
holds NI-addressed immutable JSONL records, named heads, day logs and causal
links with existing `put/get/has/walk/extend/heads/pull` operations. Its
source-owned design requires **formula-derivable locations rather than
load-bearing hot/cold indexes**, and currently supports strict individual
head durability, not general SQL multi-record transactions; its causal-head
peer exchange is distinct from CouchDB HTTP/MVCC replication. The actual
cross-owner receiving Work is [SEAVT #17](https://github.com/red-cup-engineering/semiotic-eavt-services-section/issues/17).

The existing
[proof-path-structuration-service](https://github.com/red-cup-engineering/proof-path-structuration-service)
derives canonical relative POSIX paths from original generator witnesses, and
[proof-pathing-services-section](https://github.com/red-cup-engineering/proof-pathing-services-section)
owns the filesystem admission leg and coordinate settlement. Correct
**durable transactions, crash consistency, indexes, MVCC, backups, HTTP
interfaces and replication** must be realized through their competent
File/Systems/Networking owners and tested in the installed composite. An
NI address or earned path provides neither a write transaction nor a
replication protocol on its own. The proof-pathing parent currently declares
workspace-only dependencies and cross-reading qualification remains open;
this package intentionally adds no shadow storage engine or unpublished
dependency. Both market comparisons remain unqualified until independent
receiving establishes parity and then a measured improvement.

## What lives here

- `semantic-graph` — one closed, NI-addressed graph over SignCell's typed
  Marks, declarations, and EAVT-addressed witnessed edges. Its queries and
  bounded continuations preserve every source witness without pretending that
  a page is a complete graph; gluing records schema obstructions without
  promoting projections to lossless states. All runtime graph operations and
  their twelve original regression cases were removed from SignCell.
  The `./graph` export now includes `findSignGraphRoute(graph, sourceReference,
  targetReference, { predicate? })`. It reuses Metrologic's shortest path over
  the **admitted** original SignCell graph, and returns one immutable structural
  route as typed nodes and per-hop arrays of original EAVT-addressed edges.
  Parallel witnesses survive intact, including contrary predicates if no
  predicate filter was selected; absent routes remain explicitly unreachable.
  A route does not assert its composed endpoint relation, evaluate a SignChain
  claim, perform SignCraft effects, grant an actor authority or checkpoint a
  running agent. Those remain separate original owners.


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

### Data-owned resource composition

The direct Computer Data dependency is exactly `0.7.1`. A host supplying
`markResource` or `markSpace(...).get(address)` to `bitPatchOfResource` must
resolve that same Data module instance. Data retains private admission and
byte ownership; a matching NI address or resource-shaped JSON is not admission.
Dependency composition must preserve this identity instead of overriding all
transitive Data versions, weakening its guard, or copying and re-admitting bytes.
SignGraph restricts the original resource through Data's bounded `bitValues`
operation without re-reading host media or acquiring file/network authority.
Separate module instances remain foreign even when their versions match.

`@red-cup-engineering/metrologic` for mathematics, SignCell for cells, and
SignChain for cell order and FOUR evidence profiles. Canonical carrier snapshots,
semantic addresses and portable byte operations come directly from
`@red-cup-engineering/semiotic-content-address` 0.1.0, the same owner selected by
Data, Cell, Chain and Craft. The shipped `chu-term` module also receives its
declared runtime dependency on Computer Code 0.1.2. Nothing here imports
SignCraft; SignCraft imports this.

## Canonical graph ordering across runtime locales

Content-addressed semantic graph cells, relations, witness edges and gluing
obstructions use the canonical semiotic-content-address owner's NFC-aware UTF-8
byte ordering, not host `localeCompare`. This does not assert that matching
Mark presentations establish observational equality or external evidence:
SignCell continues to own typed source identity and SignChain owns the actual
tellings. The SignGraph source edition 0.5.0 selects exact SignCell 0.10.0,
whose concept address ordering is defined by the same canonical byte comparator.
This needs genuine package/lock selection before a running consumer can claim it.

## Typed Channel → Message → Resource Exchange incidence

**Original receiving:** [SignGraph #24](https://github.com/red-cup-engineering/signgraph/issues/24), [SignCraft #11](https://github.com/red-cup-engineering/signcraft/issues/11), and the Leader's 2026-10-21 algebra→logic→language→geometry→dynamics direction. Reuse the **same** `./graph` export and existing `semantic-graph` source reader. `channelResourceIncidence(graph, {channel,relations,maxMessages?,maxExchanges?,maxEdges?,maxContainmentDepth?})` reads a **closed, original SignCell/EAVT-witnessed SignGraph**, not an arbitrary collection of links or an ActivityPub inbox parser.

Caller-supplied role names `contains`, `reports`, `resource`, `from`, `to` **must** be distinct, already-declared predicates. Optional `quantity`, `settlement` and `inside` also require declarations; no relation/Thing type is inferred from words such as "channel", "Resource" or "payment". Directed source claims carry the edges: channel→message, message→exchange, exchange→resource/from/to/quantity/settlement-claim, and endpoints→compartments. The projection:

- Retains **original** typed node references, EAVT edge IDs and *all parallel witnesses*. Two different Messages reporting the **same original Exchange** do not fabricate two transfers.
- Produces one source-addressed oriented **candidate incidence** per structurally unambiguous exchange. With `maxContainmentDepth:1..8` (default 1), follows only **actually witnessed** `inside` edges from actor to cell and then cell to an enclosing cell/tissue; each source and destination path retains its original edges. At each requested depth, `compartmentLevels` reports a paired crossing or explicit `unknown`, never an inferred root. Plural parentage and cycles are obstructions. This remains a graph-incidence reading: true cellular 2-faces, biological compartment structure, causal ordering, restriction maps, and physical membranes are separately unreceived.
- Reports missing or conflicting source/destination/resource/compartment and multi-quantity inputs as **obstructions**, rather than constructing a fictitious source-target combination or a synthetic zero. An optional **missing** quantity remains `null`; SignCraft must refuse a numeric analysis until measurement is separately qualified.
- Does **not** infer ordering from an unordered graph, resolve SignChain FOUR testimony, calculate monetary/material quantities, authenticate a settlement claim, perform ActivityPub++ delivery, mutate a cell's stock or grant any actor authority. The return explicitly marks those effects unperformed.
- Refuses wrong types, unknown relations and source-forged graphs through existing SignCell admission, plus finite budgets (default 256 messages, 1024 exchanges and 16,384 witnessed edges). The receiver tests positive exchange sharing, independent resources, parallel witnesses, ambiguous/missing roles, foreign marks, stale carriers and serialization.

This is **graph geometry downstream of source language**, not a new algebra, typed vocabulary, host or fundamental mathematical genesis. Upstream SignCell [Thing→Resource source PR #13](https://github.com/red-cup-engineering/signcell/pull/13) and [relational-value PR #20](https://github.com/red-cup-engineering/signgraph/pull/20), existing SignGraph [cellular sheaf PR #17](https://github.com/red-cup-engineering/signgraph/pull/17), and native Obsmetrologia [kinetic source #24](https://github.com/lenticule-science/obsmetrologia/issues/24) remain distinct open dependencies. Compare ActivityStreams 2.0 and PROV-O with source-received mappings where relevant, not by relabeling a graph: <https://www.w3.org/TR/activitystreams-core/> and <https://www.w3.org/TR/prov-primer/>.

**Receiving:** source tests are in the original `test/graph.test.mjs`; run them with actual exact installed upstream packages. The published/current SignCraft `signgraph@0.5.0` does not yet contain this method; do not claim this source alone installed, transported, billed, or conserved any resource.

## Offered Channel → Transport Option → shared Capacity Source (SignGraph #26)

`channelTransportPossibilities(graph, {channel,relations,quantityType,observedAt?,maxOptions?,maxSources?,maxEdges?})` extends the ORIGINAL `./graph` reader alongside `channelResourceIncidence`. It does not infer a possibility from historical transactions: an original typed Channel must witness `offers` an original typed Option; each Option must have original `resource/from/to/uses` and each `uses` source independently witnesses `capacityResource/capacity`. Every relation role is explicitly declared in the admitted graph; no name-matching, invented missing link, inferred office grant, second store or transport event is allowed. Optional original `cost`, `opposes` and `revokes` are retained, with negative/revoked evidence blocking that Option rather than being voted away.

Each capacity source retains its **one original typed source identity and all EAVT edge/witness addresses**, even when two different Options both use it. This is the consequential [shared-bottleneck discriminator](https://github.com/red-cup-engineering/signgraph/issues/26): two separate demands of four atoms each can both pass route-local tests against one capacity of five, yet aggregate demand eight exceeds the SAME source capacity. **A copied source capacity is not a new endowment.** SignGraph returns the identities and exact source-reported quantities, and its SignCraft receiver conditionally compares summed proposed demand; original AOE/FeltOS Work, office competence, reservations, transport effects and assayer acceptance remain separate.

A source reported Quantity Mark must have the caller-identified original `quantityType` and canonical `{atoms,unit,observedAt?,expiresAt?}` with exact nonnegative integer atoms (maximum 80 decimal digits), an explicit nonempty unit, and optional UTC observations. Unwitnessed, plural, malformed, zero, unclocked dated, future or expired capacity is an **obstruction**, never a presumed zero or a presently available balance. Missing `observedAt` does not silently reuse a scheduled wake. Distinct units are retained as named; no automatic conversion or evidence of actual stock is inferred. Multiple witnesses on one original offered option are one option with multiple original reports. Missing `opposes` testimony in one finite graph does NOT independently establish universal FOUR positivity or legal eligibility.

`possibilities` are strictly `source-offered-only-not-authorized`; `obstructions` explain refused source cases; `capacitySources` is a unique read-only shared-source projection. These are neither autonomous Physarum dynamics nor a reserved amount. See [SignCraft #11](https://github.com/red-cup-engineering/signcraft/issues/11), [SignGraph #26](https://github.com/red-cup-engineering/signgraph/issues/26) and [AOE government #99](https://github.com/red-cup-engineering/agent-organization-engine/issues/99) for distinct receiver and authorization obligations. Native tests are authored in original `test/graph.test.mjs`; source-modeled tests are not immutable/pinned/native installation qualification.

