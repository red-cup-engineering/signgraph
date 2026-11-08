/**
 * mesh — reading a body of SignCell cells whose positions are terms.
 *
 * A cell (s, p, o) says of s the claim p(_, o): the predicate with its object supplied, waiting
 * for a subject (Frege's unsaturated function). Those claims are the attributes of a formal
 * context whose objects are subjects, and incidence is a cell told for. Because a predicate is
 * itself a term, the same reading applies one level up with predicates as subjects of their own
 * cells, so the cells mesh. Cells here are `{ subject, predicate, object, for, against }` with
 * any extra fields; terms are compared by their canonical JSON.
 *
 * Everything is derived from the cells: a subject's profile, the knowledge reading of each of
 * its claims, how two subjects' readings relate, and the concepts subjects generate.
 */
import { extent, intent, makeContext } from "@red-cup-engineering/metrologic/closure/formal-context";
import { knowledgeReading, semanticId } from "@red-cup-engineering/signcell/cell";
import { census } from "@red-cup-engineering/metrologic/four";

const text = (value) => JSON.stringify(value);

/** The claim a cell makes of its subject: its predicate with its object supplied. */
export const claimOf = (cell) => text([cell.predicate, cell.object]);

/** A subject's profile: the claims its cells make that some witness tells for. */
export function profile(cells) {
  return new Set(cells.filter((cell) => cell.for.length > 0).map(claimOf));
}

/** How settled a body of cells is: the census of their knowledge readings (SignChain). */
export function settledness(cells) {
  return census(cells.map(knowledgeReading));
}

/** How many distinct witnesses tell for the claims of a body of cells, and how many cells rest on one only. */
export function witnessing(cells) {
  const witnesses = new Set(cells.flatMap((cell) => cell.for));
  return Object.freeze({ witnesses: witnesses.size, cells: cells.length, single: cells.filter((cell) => cell.for.length === 1).length });
}

/**
 * The relational predicates of a mesh: those whose objects are mostly terms rather than marks
 * (object properties, in OWL's words, against datatype properties -- a date, an id, a title
 * surface). `reach` is `[{ predicate, cells, termObjects }]`, the predicate as canonical text,
 * counted over the whole mesh.
 */
export function relationalPredicates(reach, { minimumShare = 0.5 } = {}) {
  return new Set(reach.filter((row) => row.cells > 0 && row.termObjects / row.cells >= minimumShare).map((row) => row.predicate));
}

function jaccard(left, right) {
  if (left.size === 0 && right.size === 0) return 0;
  let shared = 0;
  for (const item of left) if (right.has(item)) shared += 1;
  return shared / (left.size + right.size - shared);
}

/**
 * Compare subjects that answer to one name. Each reading is `{ key, cells, ...fields }`;
 * `overlap(leftKey, rightKey)` estimates how much their texts overlap (null when unknown). A pair
 * is `copies` (texts overlap), `same-concept` (claims close to one another though texts differ),
 * `related` (some text or claims shared), or `unconnected` (nothing shared: no evidence either
 * way -- one sense written twice, or one word read in two registers, is for a reader to find).
 */
export function compareReadings({ readings, overlap = () => null } = {}) {
  if (!Array.isArray(readings)) throw new TypeError("readings must be an array");
  const profiled = readings.map((reading) => ({ ...reading, claims: profile(reading.cells) }));
  const pairs = [];
  for (let i = 0; i < profiled.length; i += 1) for (let j = i + 1; j < profiled.length; j += 1) {
    const left = profiled[i], right = profiled[j];
    const textOverlap = overlap(left.key, right.key);
    const claimOverlap = jaccard(left.claims, right.claims);
    const verdict = textOverlap !== null && textOverlap >= 0.5 ? "copies"
      : claimOverlap >= 0.6 && left.claims.size >= 3 && right.claims.size >= 3 ? "same-concept"
      : (textOverlap === null || textOverlap < 0.15) && claimOverlap < 0.1 ? "unconnected"
      : "related";
    pairs.push(Object.freeze({ left: left.key, right: right.key, textOverlap, claimOverlap: Number(claimOverlap.toFixed(3)), verdict,
      shared: Object.freeze([...left.claims].filter((claim) => right.claims.has(claim)).sort().map((claim) => JSON.parse(claim))) }));
  }
  return Object.freeze({
    readings: Object.freeze(profiled.map(({ cells, claims, ...fields }) => Object.freeze({ ...fields, claims: claims.size, settledness: settledness(cells) }))),
    pairs: Object.freeze(pairs),
  });
}

/**
 * The concepts subjects generate: in the formal context whose objects are the subjects and whose
 * attributes are their claims, each subject's concept is (extent, intent) of its profile.
 * Subjects generating one concept are indistinguishable by anything claimed of them (aliases in
 * one register, or subjects too thinly stated to tell apart); a subject whose extent holds
 * another is broader than it. The context is read over the claims at least `minimumSupport`
 * subjects make: a claim one subject alone makes (its date, its id, its own title) sets it apart
 * from everything and says nothing about what it shares, so it carries no concept structure.
 * Given `predicates` (canonical texts, e.g. `relationalPredicates`), only claims through those
 * predicates are read: concepts are then what subjects share in how they relate to other terms.
 * Subjects with fewer than `minimumClaims` such claims are left out.
 * @param {{subjects: Array<{key: string, cells: object[]}>, predicates?: Set<string>|null, minimumClaims?: number, minimumSupport?: number}} input
 */
export function generatedConcepts({ subjects, predicates = null, minimumClaims = 2, minimumSupport = 2 } = {}) {
  if (!Array.isArray(subjects)) throw new TypeError("subjects must be an array");
  const through = (cell) => predicates === null || predicates.has(text(cell.predicate));
  const profiles = subjects.map((subject) => ({ key: subject.key, claims: profile(subject.cells.filter(through)) }));
  const support = new Map();
  for (const { claims } of profiles) for (const claim of claims) support.set(claim, (support.get(claim) ?? 0) + 1);
  const profiled = profiles.map((subject) => ({ key: subject.key, claims: new Set([...subject.claims].filter((claim) => support.get(claim) >= minimumSupport)) }))
    .filter((subject) => subject.claims.size >= minimumClaims);
  const attributes = [...new Set(profiled.flatMap((subject) => [...subject.claims]))].sort();
  const context = makeContext(profiled.map((subject) => subject.key), attributes, profiled.flatMap((subject) => [...subject.claims].map((claim) => [subject.key, claim])));
  const byExtent = new Map();
  const broader = [];
  for (const subject of profiled) {
    const objects = [...extent(context, subject.claims)].sort();
    const key = objects.join("\u0000");
    const group = byExtent.get(key) ?? { intent: [...intent(context, new Set(objects))].sort(), generatedBy: [] };
    group.generatedBy.push(subject.key);
    byExtent.set(key, group);
    const narrower = objects.filter((other) => other !== subject.key);
    if (narrower.length > 0) broader.push(Object.freeze({ subject: subject.key, narrower: Object.freeze(narrower) }));
  }
  const aliases = [...byExtent.values()].filter((group) => group.generatedBy.length > 1)
    .map((group) => Object.freeze({ subjects: Object.freeze(group.generatedBy.sort()), intent: Object.freeze(group.intent.map((claim) => JSON.parse(claim))) }));
  return Object.freeze({ subjects: profiled.length, attributes: attributes.length, aliases: Object.freeze(aliases), broader: Object.freeze(broader) });
}

/**
 * An intensional dossier of one spoken NAME over actual source-qualified
 * SignCells. This is the pure SignGraph producer for any term, not a MetroPlat
 * or Markdown-specific keyword scraper.
 *
 * There are three noninterchangeable levels:
 *   name -> source reading (what THIS source said, in THIS revision)
 *   source reading -> claim coordinate, with independently retained FOR/AGAINST
 *   actual Thing/secondary intension: unknown until a separately qualified
 *       anchored reference is supplied by the appropriate authority.
 *
 * Primary readings are partial epistemic claim profiles, not total mappings
 * from all conceivable scenarios to referents. FCA closure is informative
 * about shared incidence but cannot recover a forgotten performance history
 * (Obsmetrologia.Site.Intension.performedConcept_not_injective).
 *
 * Mentioned words are mere lexical observations, not asserted relations.
 * Content identity of claim coordinates does not establish semantic
 * identity of Marks, and copying a source does not authenticate its testimony.
 */
export function intensionalDossier({
  name, readings = [], mentions = [], incomplete = false,
} = {}) {
  if (typeof name !== "string" || name.trim() === "" || !Array.isArray(readings)
    || !Array.isArray(mentions) || typeof incomplete !== "boolean")
    throw new TypeError("intensional dossier requires a term, source readings, and mentions");
  if (mentions.some(item => {
    if (typeof item === "string") return !item;
    return !item || typeof item.path !== "string" || !item.path
      || (item.revision !== undefined && (typeof item.revision !== "string" || !item.revision))
      || (item.line !== undefined && (!Number.isSafeInteger(item.line) || item.line < 1))
      || (item.evidence !== undefined && (!Array.isArray(item.evidence)
        || item.evidence.some(value => typeof value !== "string")));
  })) throw new TypeError("intensional dossier mentions require located source passages");
  const query = name.trim();
  const queryId = semanticId(["term-name", query]);
  const nodeById = new Map();
  const links = [];
  const nameNode = Object.freeze({ id: queryId, kind: "spoken-name", surface: query });
  nodeById.set(queryId, nameNode);
  const sourceCoordinates = new Set();
  const primary = [];
  for (const reading of readings) {
    if (!reading || typeof reading.key !== "string" || !reading.key
      || (reading.revision !== undefined && (typeof reading.revision !== "string" || !reading.revision))
      || (reading.locale !== undefined && (typeof reading.locale !== "string" || !reading.locale))
      || !Array.isArray(reading.cells))
      throw new TypeError("intensional dossier requires located, optionally revisioned SignCell readings");
    const coordinate = semanticId(["source-reading", reading.key, reading.revision ?? null]);
    if (sourceCoordinates.has(coordinate))
      throw new TypeError("intensional dossier repeats one source revision; preserve one original reading");
    sourceCoordinates.add(coordinate);
    const source = Object.freeze({
      id: coordinate, kind: "source-reading", path: reading.key,
      revision: reading.revision ?? null, locale: reading.locale ?? null,
    });
    nodeById.set(coordinate, source);
    links.push(Object.freeze({
      from: queryId, to: coordinate, kind: "answers-to-name",
      semantics: "lexical-source-match-not-actual-reference",
    }));
    const assertions = [];
    for (const cell of reading.cells) {
      if (!cell || !Object.hasOwn(cell, "predicate") || !Object.hasOwn(cell, "object")
        || !Array.isArray(cell.for) || !Array.isArray(cell.against))
        throw new TypeError("intensional dossier requires original sided SignCells");
      const claimId = semanticId(["claim-coordinate", cell.predicate, cell.object]);
      if (!nodeById.has(claimId)) nodeById.set(claimId, Object.freeze({
        id: claimId, kind: "claim-coordinate",
        predicate: cell.predicate, object: cell.object,
        semantics: "presentation-only-not-semantic-Mark-equality",
      }));
      // A source's negative tellings and untold cells are retained; neither
      // becomes an absent or positive assertion when projecting a concept.
      const readingName = knowledgeReading(cell);
      const assertion = Object.freeze({
        claim: claimId, reading: readingName,
        for: Object.freeze([...cell.for]), against: Object.freeze([...cell.against]),
      });
      assertions.push(assertion);
      links.push(Object.freeze({
        from: coordinate, to: claimId, kind: "source-telling",
        reading: readingName, for: assertion.for, against: assertion.against,
      }));
    }
    primary.push(Object.freeze({
      source, claims: Object.freeze(assertions),
      witnessedProfileSize: profile(reading.cells).size,
      census: settledness(reading.cells),
    }));
  }
  const passages = new Map();
  for (const mention of mentions) {
    const { path, revision, line, evidence } = typeof mention === "string"
      ? { path: mention } : mention;
    const id = semanticId(["source-passage", path, revision ?? null, line ?? null, evidence ?? []]);
    if (passages.has(id)) continue;
    const passage = Object.freeze({
      id, path, revision: revision ?? null, line: line ?? null,
      evidence: Object.freeze([...(evidence ?? [])]),
      status: "uninterpreted-textual-occurrence",
    });
    passages.set(id, passage);
    nodeById.set(id, Object.freeze({ ...passage, kind: "source-passage" }));
    links.push(Object.freeze({
      from: id, to: queryId, kind: "mentions-name",
      semantics: "source-located-text-not-licensed-claim-or-actual-reference",
    }));
  }
  // The context closure below only compares already-told source profiles.
  // Its alias/broader readings NEVER authenticate an actual referent.
  const concepts = primary.length > 1
    ? generatedConcepts({
        subjects: primary.map((reading, index) => ({
          key: reading.source.id, cells: readings[index].cells,
        })),
        minimumClaims: 1, minimumSupport: 2,
      })
    : Object.freeze({ subjects: 0, attributes: 0, aliases: Object.freeze([]), broader: Object.freeze([]) });
  return Object.freeze({
    kind: "signgraph.intensional-dossier/v1", name: query,
    coverage: Object.freeze({
      sourceReadings: primary.length, textualMentions: passages.size,
      incomplete,
    }),
    graph: Object.freeze({
      nodes: Object.freeze([...nodeById.values()]),
      edges: Object.freeze(links),
    }),
    primary: Object.freeze({
      kind: "partial-epistemic-source-profile",
      readings: Object.freeze(primary),
      // Actual located prose remains evidence for later qualified semantic
      // analysis, never a silently inferred predicate or secondary intension.
      passages: Object.freeze([...passages.values()]),
      concepts,
    }),
    secondary: Object.freeze({
      kind: "actual-world-anchored-reference",
      status: "unanchored",
      explanation: "No qualified actual referent, counterfactual transport or independent institutional identity follows from source-name coincidence.",
    }),
    actualThing: Object.freeze({
      status: "not-derived",
      known: Object.freeze(primary.map(r => r.source)),
      explanation: "Original source objects are identified; the named Thing's actual identity and powers still require independently qualified reference and authorization.",
    }),
  });
}
