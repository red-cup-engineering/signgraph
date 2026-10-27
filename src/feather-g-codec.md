# FEATHER-G ↔ SignGraph: structural codecs, not source equivalence

The project has two **unrelated** uses of “feather”: the source-positioned
[SignGraph feather reading](./feather-graph.mjs), linked to Obsmetrologia's
keratinous-sheaf, kinematic and witnessed-predication research; and **FEATHER-G**
(Rozemberczki and Sarkar, CIKM 2020), a graph-level numerical descriptor based on
random-walk-weighted characteristic functions. The latter takes undirected graphs (including disconnected graphs without
explicitly isolated vertices). It is **not** a keratinous sheaf, source-derived predication,
source of truth, or an invertible graph encoding.

The authoritative mathematical frontier for the native reading is
[Obsmetrologia #79](https://github.com/lenticule-science/obsmetrologia/issues/79).
The FEATHER-G wire shape is documented at the
[reference implementation](https://github.com/benedekrozemberczki/FEATHER):
`{"0": [[0, 1], [1, 2]], "1": [[0, 1]]}`. Both graph and vertex IDs are
consecutive, starting at zero. The reference's NetworkX graph input drops edge orientation and coalesces
duplicate undirected edges; it can represent loops, but **this conservative
undirected-simple codec** declines loop-containing graphs until a separate
loop-preserving projection is specified. It refuses ambiguities rather than
silently coalescing them.

## Import external FEATHER-G graphs as *structural SignGraph readings*

```js
import { decodeFeatherGGraphCollection } from '@red-cup-engineering/signgraph/feather-g-codec';
const external = decodeFeatherGGraphCollection('{"0":[[0,1],[1,2]]}');
// external.graphs[0].vertices = [0,1,2]
// external.graphs[0].incidences has two unordered, undirected pairs.
// This is NOT a source-admitted SignGraph or native feather graph.
```

Import validates graph IDs, zero-based dense node IDs,
non-self-loop incidence, duplicate undirected edges, and bounded workload.
The projection does not forge SignCells, source-record IDs, directions,
FOUR evidence or Articulating ancestry. To become a native SignGraph,
original typed source positions, relation declarations and witnesses must be
supplied and **readmitted by their own source owner**.

## Export admitted SignGraphs or conditional feather sources

```js
import { encodeFeatherGGraphCollection } from '@red-cup-engineering/signgraph/feather-g-codec';
// A source SignGraph must have been created using createSignGraph.
const bundle = encodeFeatherGGraphCollection([{graph: admittedSignGraph}],
  {projection: 'undirected-simple'});
const graphsJson = JSON.stringify(bundle.graphs); // FEATHER-G --graphs-input
const sidecar = bundle.receipts; // retain away from the graph input file
```

An alternative input is `{source: originalPredicationOccurrences, selectors:
{axialPredicate, transversePredicate}}`. This delegates source-position and
fork reading to the existing `featherGraphOfPredications`, with its original
conditional status unchanged. The separate source sidecar stores original
vertex-role keys and grouped directed predicate occurrences, including
SignGraph EAVT edge addresses and typed witness IDs where available.

The **explicit** `projection: 'undirected-simple'` selection is mandatory.
It intentionally drops directions, predicates, parallel-witness distinctions
and source authority **from the FEATHER-G graph JSON**. They remain only as
sidecar *claims*; a serialized sidecar is not portable admission evidence.
The SignGraph export is **endpoint-induced**: all cells not serving as edge
endpoints (including original witness-only cells) are listed as
`excludedSourceCells` in the sidecar rather than disguised as isolated
FEATHER-G vertices. No such excluded cell is treated as a new source graph
vertex. Loops and oversized jobs are refused; disconnected endpoint graphs are
allowed. A simple projection can be round-tripped structurally, not
semantically.

## Read FEATHER-G embedding CSV as noninvertible descriptors

```js
import { decodeFeatherGEmbeddingCsv } from '@red-cup-engineering/signgraph/feather-g-codec';
// The upstream writer uses id,x_0,x_1,... and may serialize IDs as 0.0, 1.0.
const descriptors = decodeFeatherGEmbeddingCsv(csvText, bundle, {
  order: 5, evalPoints: 25, thetaMax: 2.5, pooling: 'mean',
});
```

The configured width is `2 × order × evalPoints`; CSV rows must align
one-to-one with graph IDs. The model settings are **declared by the caller**;
they are not inferable from the CSV, nor verified as the parameters a remote
FEATHER-G runner used. FEATHER-G's own reference implementation computes
log-degree features internally, performs random-walk characteristic-function
pooling and exports descriptors; **this codec does not fit or execute a
FEATHER-G model**. Its returned descriptor arrays are analytical readouts, not
new graph edges, global sheaf sections, witnessed predicates or evidence that
an embedding's reverse map exists.

Run `node --test test/feather-g-codec.test.mjs` from the SignGraph source root.
This is source-only interoperability until package publishing and an actual
consumer's FEATHER-G execution/receiving are independently evidenced.

## Untrusted object admission and execution boundary

The object-input FEATHER-G decoder first takes an inert, detached snapshot of
the entire finite external graph collection. Only plain JSON records, dense
undecorated arrays, two data-only endpoints per edge and finite bounded graph
sizes can reach the existing original structural validator. Ordinary getters
and hidden/symbol properties refuse *without execution*, including nested
getter-backed edge endpoints. JSON strings are decoded by JSON.parse and pass
the same structural checks. This does **not** make a hostile ECMAScript Proxy
safe to evaluate in process: admitting executable foreign objects requires a
host sandbox/capability boundary. It also does not make imported edge lists
source-witnessed native SignCells or bestow a reversible embedding.

## In-process structural readout custody and external wire input

`decodeFeatherGEmbeddingCsv` admits an original returned FEATHER-G structural
collection only through the decoder's existing in-process construction receipt.
A cloned or hand-assembled object advertising
`signgraph.featherG.structuralCollection.v1` cannot borrow its identity by
copying `kind` and `graphs`. Its failure is explicitly attributed to
unadmitted *graph IDs* rather than accidentally parsing the cloned object as a
new ordinary graph collection. Optional external export-projection graph data
may still be re-read as plain structural wire input, through own enumerable
data descriptors. Neither branch runs `kind` or `graphs` getters.
These are in-process boundary checks, not authenticated external graph sources.
