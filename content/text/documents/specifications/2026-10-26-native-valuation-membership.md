# Native valuation membership

## Required change

The source-qualified software solve loop retains Requirement, task, candidate,
verification and receiving observations through native structural SignCells.
Its resulting source graph exposed repeated scans in SignGraph `posit`: each
admitted valuation Cell scanned the site's complete source list using native
triple coincidence. For a complete N-Cell valuation this performs a quadratic
number of membership comparisons before the native settlement can begin.

SignGraph owns membership of a valuation in a site. SignCell owns admission,
canonical triple identity, witness joins and written FOUR values. The existing
`site` constructor already indexes the same identities with SignCell
`tripleKey`. No downstream admission or replay may be bypassed for performance.

## Required behavior

1. Normalize the entire valuation through the original `cellSet` before testing
   membership, preserving its validation and joining behavior.
2. For a native site, accept exactly those normalized Cells whose triples occur
   in that site, irrespective of their positive/negative witnesses or written
   value. A structurally present untold Cell still requires membership.
3. Retain the original site and normalized valuation in the frozen presheaf.
   Do not rewrite evidence, values, source order or prior traces.
4. Preserve the existing foreign-cell TypeError and reuse the same admission
   through `withTrace`, `freePresheaf` and downstream settlement replay.
5. Construct membership from native canonical triple keys once per nonempty
   call. Empty valuations need no membership traversal. Use no persistent cache
   that could miss changed input presentations and no additional identity law.
6. Read a native source site at most linearly when checking a complete valuation.

## Receiving evidence

Run the original valuation, site, fiber and graph tests with genuine selected
suppliers. Add cases for all sixteen witness-presence/written-value pairs,
opaque structured terms, transported presentations, native witness joining,
untold cells, and foreign subject/predicate/object refusal. A deterministic
source-access assay must fail on the former nested scan and pass on the bounded
membership implementation. Separately time an actual source-record structural
projection, preserving identical result identities on baseline and candidate.

This is a bounded performance correction to native admission. It establishes no
new source authority, acceptance policy, mathematical closure or operating effect.

## Qualified upstream source adoption

The consumer also selects the issued SignCell `0.13.1-dev.185`, git head
`8c3a38f406c01688520459a253215d22a25d0dd1`. Its original token-frame correction
uses actual source witness incidence to generate specialization order while
retaining written values. The issued archive's `src/token-frame.mjs` has Git
blob `203a2dc5fe306610c933ef75e7e0e0d0a15e6c69`, the independently reviewed source.

The composed consumer selects the issued SignChain `0.4.2-dev.64`, git head
`38c4c4b2855e9c44641a7ebf867b4420b42f6b43`, whose own Cell selection is that same
Cell185 edition. Direct Graph adoption alone is insufficient: predecessor Chain
modalities reconstruct the old source order. The full issued cohort must agree.

The three original Graph receiving cases from that correction are retained in
`test/evidence-order-receiving.test.mjs`: a source-silent written classification
cannot transmit a requirement; a lowered written value cannot erase a witnessed
path; a written positive value cannot overturn an explicit negative source.
They compare whole, exact and paged Graph inheritance with native Chain modality.
Both this supplier assay and the original valuation test ship with the package
and are enrolled in its receivingTests. Supplier selection uses native pnpm
resolution and existing supply-chain policy, with only specifically qualified
new editions added to the release-age exceptions.

## Pure publication boundary

The original package exposed `signgraph-holonomy` as a public executable and
shipped `scripts/holonomy.mjs`, whose stdin/stdout and process exit effects lay
outside the existing source-only purity assay. Remove both the executable
declaration and the script, keeping `src/operations.mjs` and all mathematical
operations unchanged. CAIRN receives the original bounded JSONL command through
SignCraft's pure `./graph-operations` composition; Graph introduces no host
implementation or forwarding command.

Preserve the native operation assertions in the four original receiving files.
Relocate their nine process-facing cases to the competent host: four holonomy,
one geometric, two articulating incidence and the CLI portions of two performed
head observations. The retained performed-source cases still receive their
original source counts, conditional classification and refusing inputs.

Strengthen and enroll `test/pure-functional-boundary.test.mjs` in the published
receiving surface. It must reject a public `bin` or shipped script, limit public
exports to the inspected source library and inspect every exported target for
the original ambient effects prohibition. Run it against both original and
candidate metadata so the existing command leak is a demonstrated failure.
Archive inspection must independently confirm the deleted command is absent.
