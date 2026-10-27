/**
 * SignGraph — valuations over a site: which evidence each cell of the site carries.
 *
 * A valuation is a SignCell cell set whose triples are cells of a site. The
 * knowledge-least valuation is the empty set (every cell told nothing); two
 * valuations join cellwise by knowledge join (SignCell merge), and order
 * cellwise by the knowledge order. Positing a valuation over its site gives
 * the presheaf settlement reads: the site with a trace of valuations, seeded
 * with the posited one. The sheaf is a valuation taken as the global section.
 */
import { cell, cellAt, cellSet, mergeCellSets, triple, tripleKey } from "@red-cup-engineering/signcell/cell";
import { knowledgeLeq } from "@red-cup-engineering/signchain/bilattice";
import { freeSite, site as siteOf } from "./site.mjs";

/** The cell a valuation carries at a triple: its telling there, or the triple told nothing. */
export function evidenceAt(valuation, at) {
  const found = cellAt(valuation, at);
  return found ?? cell(at.subject, at.predicate, at.object);
}

/** The same evidence at every cell of a site. */
export const valuationOfEvidence = (site, evidence) => cellSet(site.cells.map((at) => cell(at.subject, at.predicate, at.object, evidence)));

/** The knowledge-least valuation: nothing told anywhere. */
export const knowledgeLeastValuation = () => cellSet();

/** Cellwise knowledge join of two valuations. */
export const valuationKnowledgeJoin = mergeCellSets;

/** Whether `left` is told no more than `right` at every listed triple (default: every cell of either). */
export function valuationLeqKnowledge(left, right, cells = [...left, ...right].map(triple)) {
  return cells.every((at) => knowledgeLeq(evidenceAt(left, at), evidenceAt(right, at)));
}

/** Whether two valuations tell the same at every cell. */
export const sameValuation = (left, right) => valuationLeqKnowledge(left, right) && valuationLeqKnowledge(right, left);

/** Posit a valuation over its site: the presheaf with the valuation as its first trace.
 *  Refuses a valuation carrying a cell outside the site. */
export function posit(site, valuation) {
  const admitted = cellSet(valuation);
  if (admitted.length > 0) {
    // Membership is the same canonical triple coincidence that constructs a
    // site. Index once instead of re-encoding its cells for every telling;
    // the admitted evidence, including untold cells and written values, stays
    // in the original SignCell set below.
    const members = new Set(site.cells.map(tripleKey));
    if (admitted.some((told) => !members.has(tripleKey(told)))) throw new TypeError("posit: the valuation tells a cell outside its site");
  }
  return Object.freeze({ kind: "signgraph.presheaf", site, traces: Object.freeze([admitted]) });
}

/** A presheaf's latest valuation. */
export const lastValuation = (presheaf) => presheaf.traces[presheaf.traces.length - 1];

/** Extend a presheaf by a valuation over the SAME base site.
 * Reuse the existing posit admission: without it, subsequent traces could
 * introduce arbitrary cells from another site and fabricate a global section.
 * A new context/site needs an explicit base-change, not a silent append. */
export function withTrace(presheaf, valuation) {
  if (presheaf?.kind !== "signgraph.presheaf" || !Array.isArray(presheaf.traces) || presheaf.traces.length === 0)
    throw new TypeError("withTrace requires an existing posited presheaf");
  const next = posit(presheaf.site, valuation);
  return Object.freeze({ ...presheaf, traces: Object.freeze([...presheaf.traces, next.traces[0]]) });
}

/** The presheaf of a valuation over the site its own cells generate. */
export const presheafOfValuation = (valuation) => posit(siteOf(valuation), valuation);

/** A valuation taken as a global section. */
export const sheafOfValuation = (section) => Object.freeze({ kind: "signgraph.sheaf", section: cellSet(section) });

/** A presheaf's stored presentation: its site's generators and its posited valuation. */
export const presentPresheaf = (presheaf) => Object.freeze({ kind: "signgraph.presheaf", cells: presheaf.site.cells, specializations: presheaf.site.specializations, valuation: presheaf.traces[0] });

/** The presheaf back from its presentation. */
export const freePresheaf = (presentation) => posit(freeSite(presentation), presentation.valuation);
