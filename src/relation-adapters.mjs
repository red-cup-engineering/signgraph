import { utterEvidenceSet } from "@red-cup-engineering/signcell/utterance";
import { canonicalCarrier } from "@red-cup-engineering/semiotic-content-address";
const assertRecords = (records, label) => {
  if (!Array.isArray(records)) throw new TypeError(`${label} records must be an array`);
  return records;
};
const observation = (subject, predicate, object, evidence, datum) => Object.freeze({ subject, predicate, object, ...(datum === undefined ? {} : { datum }), evidence: Object.freeze(evidence) });

/** Project already-parsed Markdown frontmatter; parsing and filesystem I/O remain upstream. */
export function markdownFrontmatterClaims(documents, { relations } = {}) {
  if (relations === null || typeof relations !== "object" || Array.isArray(relations)) throw new TypeError("Markdown projection requires an explicit relations policy object");
  const claims = [];
  for (const document of assertRecords(documents, "Markdown")) {
    if (document?.id === undefined || document.frontmatter === null || typeof document.frontmatter !== "object") throw new TypeError("Markdown records require id and frontmatter object");
    for (const [predicate, datum] of Object.entries(relations)) {
      const raw = document.frontmatter[predicate];
      if (raw === undefined || raw === null) continue;
      for (const object of Array.isArray(raw) ? raw : [raw]) claims.push(observation(document.id, predicate, object, { substrate: "markdown-frontmatter", resource: document.id }, datum));
    }
  }
  return Object.freeze(claims);
}

/** Project observed JavaScript module topology; source parsing remains with JSNode. */
export function javascriptModuleClaims(modules) {
  const claims = [];
  for (const module of assertRecords(modules, "JavaScript module")) {
    if (module?.id === undefined) throw new TypeError("JavaScript module records require id");
    for (const imported of module.imports ?? []) claims.push(observation(module.id, "imports", imported, { substrate: "javascript-module", resource: module.id }));
    for (const exported of module.exports ?? []) claims.push(observation(module.id, "exports", exported, { substrate: "javascript-module", resource: module.id }));
  }
  return Object.freeze(claims);
}

/** Adapt an already-admitted EAVT ledger without assigning it a FOUR polarity vocabulary. */
export function eavtRelations(rows, { polarityByAttribute = {} } = {}) {
  const claims = [];
  for (const row of assertRecords(rows, "EAVT")) {
    if (row?.e === undefined || row.a === undefined || row.v === undefined || row.t === undefined) throw new TypeError("EAVT rows require e, a, v, and t");
    claims.push(observation(row.e, row.a, row.v, { substrate: "eavt", witness: row.t }, polarityByAttribute[row.a]));
  }
  return Object.freeze(claims);
}

export const observeClaims = (drew, { source, claims, id }) => drew.observe({ source, relations: claims, ...(id === undefined ? {} : { id }) });

/**
 * Turn existing ERP EAVT rows, ECS/module graphs and authored-source
 * observations into the SAME Mark-rooted Utterances that SignCell admits.
 *
 * This is one observation adapter over the existing normalized relation
 * carrier, not a second token/claim codec, graph equality, evidence log,
 * or authorization source. Every input occurrence has a separate ordinal
 * even when its encoded content coincides with another occurrence.
 * Source metadata survives separately as observation, not an invented
 * witness supporting the uttered proposition.
 */
export function utteredRelationObservations(records) {
  const rows = assertRecords(records, "Relation");
  const observations = rows.map((row,index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)
      || !Object.hasOwn(row,"subject") || !Object.hasOwn(row,"predicate")
      || !Object.hasOwn(row,"object") || !Object.hasOwn(row,"evidence")
      || typeof row.predicate !== "string" || !row.predicate.trim())
      throw new TypeError(`relation observation ${index} requires subject/predicate/object/evidence`);
    return canonicalCarrier(row);
  });
  // Construct every Mark and its two positional hands through SignCell only.
  const utterances = utterEvidenceSet(observations);
  return canonicalCarrier({
    kind:"signgraph.utteredRelationObservations.v1",
    entries:observations.map((observation,sourceOrdinal) => ({
      sourceOrdinal, utterance:utterances[sourceOrdinal], observation,
    })),
    attribution:"original observation only; no semantic identification, witness, authority or delivery follows",
  });
}
