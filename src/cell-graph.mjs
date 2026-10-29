/**
 * cell-graph — SignCell's cells organized as a Chu space.
 *
 * Points are cells; states are observations (attributes, queries, indexes) over
 * them, each a named, total evaluator `(cell) => reading`. The organization is
 * SignChain's Chu space over FOUR, with SignCell's coincidence as point sameness
 * and observation-name equality as state sameness; Chu maps between two
 * organizations are SignChain's `chuMap`.
 */
import {
  address, admitCell, cellSet, coincidenceKey, coincides, measured,
  presence, recordOf, sameCell, valueOf
} from "@red-cup-engineering/signcell/cell";
import { natZero, natOne, natAdd, fromNatural } from "@red-cup-engineering/exact-number-data-service/exact-number";
import { chuSpaceOfEntries } from "@red-cup-engineering/metrologic/chu";
import { sourceIncidenceTriples } from "./site.mjs";

/** The Chu space of a cell set under a list of named observations. */
export function cellGraph(cells, observations, options = {}) {
  // A SignCell point is the triple, not the current evidence presentation.
  // First join coincident tellings into one point, retaining both evidence sides.
  // This is an extensional graph projection, NOT a substitute for original
  // Articulating occurrences: their separately carried histories remain upstream.
  const points = cellSet(cells);
  const entries = points.flatMap((point) => observations.map((observation) => [point, observation.name, observation.evaluate(point)]));
  return chuSpaceOfEntries(points, observations.map((observation) => observation.name), entries, {
    absent: options.absent, samePoint: sameCell, sameState: (left, right) => left === right,
  });
}

/** Build the existing symmetric projection from ONE detached, source-admitted
 * incidence presentation, without another input read or cell-set collapse. */
function relationGraphOfAdmittedIncidences(incidences) {
    if (incidences.length === 0)
        throw new TypeError("an empty section presents no relation graph");
    // SignCell's canonical coincidence bytes, not host object identity or
    // JSON.stringify. Every original term is retained in first-seen order.
    // Each incident endpoint is classified once in O(1) expected map access.
    const terms = [];
    const positions = new Map();
    const indexOf = (term) => {
        const key = coincidenceKey(term);
        const prior = positions.get(key);
        if (prior !== undefined) return prior;
        const position = terms.length;
        terms.push(term);
        positions.set(key, position);
        return position;
    };
    const pairs = [];
    for (const at of incidences) {
        const subject = indexOf(at.subject);
        const object = indexOf(at.object);
        if (subject !== object)
            pairs.push([subject, object]);
    }
    // Accumulate each unoriented relation exactly once, preserving multiplicity.
    // The old implementation rescanned the entire edge list once for each
    // matrix entry, costing O(entities² × cells). The output is necessarily
    // dense, but this construction requires only O(cells + entities²) work.
    // Reuse the exact-number tower; never sum host floats or reimplement ℕ.
    const counts = Array.from({ length: terms.length }, () => Array(terms.length).fill(natZero));
    for (const [a, b] of pairs) {
        counts[a][b] = natAdd(counts[a][b], natOne);
        counts[b][a] = natAdd(counts[b][a], natOne);
    }
    const weights = counts.map(row => row.map(fromNatural));
    return Object.freeze({
        kind: "signgraph.relationGraph",
        terms: Object.freeze(terms),
        weights: Object.freeze(weights.map((row) => Object.freeze(row))),
    });
}
/** The source-admitted, symmetric relation graph of predication Cells/triples.
 * Both bare source triples and full SignCells use the ORIGINAL site's source
 * boundary; a new Graph reader may neither evaluate a getter nor invent a
 * different input on a second pass. Parallel source occurrences remain edges.
 */
export function relationGraphOfCells(cells) {
    return relationGraphOfAdmittedIncidences(sourceIncidenceTriples(cells));
}
/** The relation graph of a section (its entries' cells). Delegates to {@link relationGraphOfCells}. */
export function relationGraph(section) {
    return relationGraphOfCells(section.entries.map((entry) => entry.cell));
}

/**
 * The same oriented flow network as flowNetwork(section), directly from held
 * SignCells rather than a separately materialized SectionCarrier. In contrast
 * to the symmetric relationGraphOfCells, this retains the sign of the boundary
 * operator: each edge is subject -> object, fromIndex -> toIndex.
 *
 * This matters for causal proof graphs. A symmetric Laplacian can answer
 * connectivity or diffusion questions, but it cannot distinguish "source
 * proves conclusion" from the reversed (and generally invalid) claim.
 * The flow is still a SignGraph READING of existing cells, not a new journal,
 * an authenticated source, an inference, or authority to produce an order.
 *
 * Reflexive predications remain vertices but have zero boundary and therefore
 * no directed edge. Duplicate predications remain distinct incidence edges,
 * as they already do in flowNetwork(section).
 */
export function flowNetworkOfCells(cells) {
    // Use precisely the same detached source positions for both the
    // symmetric weights and oriented boundary. The old second read of
    // caller-owned cells could disagree with the first graph index.
    const incidences = sourceIncidenceTriples(cells);
    const graph = relationGraphOfAdmittedIncidences(incidences);
    // The weighted and directed readers must use the SAME upstream canonical
    // coincidence classes. Avoid linear vertex rescans per oriented edge.
    const positions = new Map(graph.terms.map((term, index) => [coincidenceKey(term), index]));
    const indexOf = (term) => positions.get(coincidenceKey(term));
    const edges = [];
    for (const value of incidences) {
        const fromIndex = indexOf(value.subject);
        const toIndex = indexOf(value.object);
        if (fromIndex === toIndex) continue;
        edges.push(Object.freeze({
            kind: "signgraph.flowNetwork.edge",
            from: graph.terms[fromIndex], to: graph.terms[toIndex],
            fromIndex, toIndex,
        }));
    }
    return Object.freeze({
        kind: "signgraph.flowNetwork",
        graph, terms: graph.terms, edges: Object.freeze(edges),
    });
}

/** The flow network of a section delegates to its SignCell source carrier. */
export function flowNetwork(section) {
    return flowNetworkOfCells(section.entries.map((entry) => entry.cell));
}

// — Receive (not recreate) the original SignCell FOUR ⇄ Record adjunction. —

/**
 * Bring a source-witnessed SignCell charge/record tower into the ORIGINAL
 * oriented SignGraph flow. The second argument is the actual producer
 * exported as SignCell ./charge-spin#chargeRecordTowerOfCell. It is injected
 * until that additive, draft SignCell export is published at a fixed version;
 * SignGraph deliberately does not import an unreleased npm subpath.
 *
 * One entry is retained PER supplied cell presentation. The existing
 * flowNetworkOfCells also retains parallel incidence edges. An address
 * coincidence DOES NOT erase source testimony or mint new independent WITs.
 *
 * The returned records are evidence counts, NOT authenticated actors,
 * accepted physical charges, a Scott/aperiodic closure ordinal, a sheaf,
 * electromagnetic fields, or a physical metric. Source and original
 * for/against/posited-value distinctions remain in every entry.
 */
export function sourceRecordTowerFlowOfCells(cells, towerOfCell) {
  if (!Array.isArray(cells) || cells.length === 0 || cells.length > 1024) {
    throw new TypeError("signgraph: source tower flow requires 1..1024 source cells");
  }
  if (typeof towerOfCell !== "function") {
    throw new TypeError("signgraph: a source-owned SignCell tower reader is required");
  }
  const entries = cells.map((original, sourceIndex) => {
    const admitted = admitCell(original);
    const tower = towerOfCell(admitted);
    const actualRecord = recordOf(admitted);
    if (!tower || tower.kind !== "signcell.charge-record-tower.v1"
        || tower.sourceAddress !== address(admitted)
        || !tower.sourceCell || !coincides(admitCell(tower.sourceCell), admitted)
        || tower.observedCharge !== presence(admitted)
        || tower.valuedCharge !== valueOf(admitted)
        || tower.measured !== measured(admitted)
        || !tower.record || tower.record.pos !== actualRecord.pos
        || tower.record.neg !== actualRecord.neg
        || !tower.minimumRecord || !tower.retainedSurplus
        || tower.minimumRecord.pos !== Number(actualRecord.pos > 0)
        || tower.minimumRecord.neg !== Number(actualRecord.neg > 0)
        || tower.retainedSurplus.pos !== actualRecord.pos - tower.minimumRecord.pos
        || tower.retainedSurplus.neg !== actualRecord.neg - tower.minimumRecord.neg) {
      throw new TypeError("signgraph: rejected foreign, stale or inconsistent source tower readout");
    }
    return Object.freeze({
      sourceIndex,
      cell: admitted,
      sourceAddress: tower.sourceAddress,
      tower,
      from: admitted.subject,
      to: admitted.object
    });
  });
  // Use the existing oriented graph: subject -> object, self-links have no edge.
  const flow = flowNetworkOfCells(entries.map((entry) => entry.cell));
  const extensionalCells = cellSet(entries.map((entry) => entry.cell));
  // Existing native Chu reader, now distinguishing evidence presence from the
  // posited FOUR value. It is intentionally a LOSSY extensional projection:
  // original entry witnesses and tally multiplicities stay above in entries.
  const chu = cellGraph(extensionalCells, [
    { name: "source-evidence-charge", evaluate: presence },
    { name: "posited-charge", evaluate: valueOf }
  ]);
  return Object.freeze({
    kind: "signgraph.source-record-tower-flow.v1",
    flow,
    chu,
    entries: Object.freeze(entries),
    extensionalCells
  });
}

