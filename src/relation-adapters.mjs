const assertRecords = (records, label) => {
  if (!Array.isArray(records)) throw new TypeError(`${label} records must be an array`);
  return records;
};
const observation = (subject, predicate, object, evidence, datum) => Object.freeze({ subject, predicate, object, ...(datum === undefined ? {} : { datum }), evidence: Object.freeze(evidence) });

/** Project already-parsed Markdown frontmatter; parsing and filesystem I/O remain upstream. */
export function markdownFrontmatterClaims(documents, { relations, predicateIds = {} } = {}) {
  if (relations === null || typeof relations !== "object" || Array.isArray(relations)) throw new TypeError("Markdown projection requires an explicit relations policy object");
  if (predicateIds === null || typeof predicateIds !== "object" ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(predicateIds))) {
    throw new TypeError("Markdown predicate identities must be a record");
  }
  const aliases = new Map(Object.entries(predicateIds));
  for (const [field, id] of aliases) {
    if (!Object.hasOwn(relations, field) || typeof id !== "string" || !id.trim() || id !== id.trim()) {
      throw new TypeError("Markdown predicate identity must name a configured field and an exact nonempty identifier");
    }
  }
  const claims = [];
  for (const document of assertRecords(documents, "Markdown")) {
    if (document?.id === undefined || document.frontmatter === null || typeof document.frontmatter !== "object") throw new TypeError("Markdown records require id and frontmatter object");
    for (const [field, datum] of Object.entries(relations)) {
      if (!Object.hasOwn(document.frontmatter, field)) continue;
      const raw = document.frontmatter[field];
      if (raw === undefined || raw === null) continue;
      const predicate = aliases.get(field) ?? field;
      const evidence = { substrate: "markdown-frontmatter", resource: document.id, ...(aliases.has(field) ? { field } : {}) };
      for (const object of Array.isArray(raw) ? raw : [raw]) claims.push(observation(document.id, predicate, object, { ...evidence }, datum));
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

