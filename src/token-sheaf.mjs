/**
 * SignGraph — the sheaf of tellings over a token frame.
 *
 * The construction runs one way. SignCell's token frame is the Heyting algebra of a token order, each
 * token embedded as its extent; SignChain's token fiber reads a claim at every token in FOUR; this
 * module glues. Its sections are tellings: the section at a token t is what is told of t, the cells
 * whose subject is t. Restriction runs along specialization: t ≤ g sends what is told of g to t, so
 * whatever is told of a type is told of everything of that type. The inherited section at t is the
 * gluing of the sections of t's generalizations, its cover ↑t, by knowledge join: each cell (t, p, o)
 * carries every witness told for or against (g, p, o) at any generalization g.
 *
 * Where the cover disagrees, one generalization telling for and another against, the glued cell is
 * contested (⊤). The contradiction is held and reported with the generalizations on each side, never
 * resolved by which is nearer; the contested cells are the obstruction to gluing that cover. Read one
 * claim at a time, the inherited section is the fiber SignChain's possibilizing gives: gluing over ↑t
 * is ◇. The object position is reached through the converse generator.
 */
import { address, cell, coincidenceKey, coincides, evidenceOf, merge, sidesOf } from "@red-cup-engineering/signcell/cell";
import { generalizations } from "@red-cup-engineering/signcell/token-frame";

const INHERITED = "signgraph.inherited-tellings";
const frozen = (values) => Object.freeze([...values]);
const byKey = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const sections = new WeakMap();

// What is told of each token, by token key: the frame's cells that are not specializations.
function sectionsOf(frame) {
  if (!sections.has(frame)) {
    const bySubject = new Map();
    for (const at of frame.cells) {
      if (coincides(at.predicate, frame.predicate)) continue;
      const key = coincidenceKey(at.subject);
      if (!bySubject.has(key)) bySubject.set(key, []);
      bySubject.get(key).push(at);
    }
    sections.set(frame, bySubject);
  }
  return sections.get(frame);
}

const isToken = (frame, token) => frame.tokens.some((other) => coincides(other, token));

/** The section at a token: what is told of it directly. */
export const tellingsAt = (frame, token) => frozen(sectionsOf(frame).get(coincidenceKey(token)) ?? []);

/**
 * What is told of `token`, inherited from every generalization: the gluing of the sections over its
 * cover. Each cell is (token, p, o) with the knowledge join of the evidence told of (g, p, o) over the
 * generalizations g; `sources` lists, per cell, the generalizations that told it and their cells;
 * `contested` lists the cells told both for and against, with the generalizations on each side.
 */
export function inherited(frame, token) {
  const cover = isToken(frame, token) ? generalizations(frame, token) : [token];
  const merged = new Map();
  const from = new Map();
  for (const general of [...cover].sort((left, right) => byKey(coincidenceKey(left), coincidenceKey(right)))) {
    for (const telling of tellingsAt(frame, general)) {
      const at = cell(token, telling.predicate, telling.object, evidenceOf(telling));
      const slot = address(at);
      merged.set(slot, merged.has(slot) ? merge(merged.get(slot), at) : at);
      if (!from.has(slot)) from.set(slot, []);
      from.get(slot).push(Object.freeze({ token: general, cell: telling }));
    }
  }
  const slots = [...merged.keys()].sort(byKey);
  const cells = frozen(slots.map((slot) => merged.get(slot)));
  const sources = frozen(slots.map((slot) => frozen(from.get(slot))));
  const contested = [];
  slots.forEach((slot, index) => {
    const [toldFor, toldAgainst] = sidesOf(cells[index]);
    if (!(toldFor && toldAgainst)) return;
    const side = (which) => frozen(sources[index].filter((source) => sidesOf(source.cell)[which]).map((source) => source.token));
    contested.push(Object.freeze({ cell: cells[index], for: side(0), against: side(1) }));
  });
  return Object.freeze({ kind: INHERITED, token, cells, sources, contested: frozen(contested) });
}
