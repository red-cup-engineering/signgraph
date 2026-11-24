import {
  semanticId, utf8Bytes,
} from "@red-cup-engineering/semiotic-content-address-system";
import {
  address, hasTriple, cell, converse,
} from "@red-cup-engineering/signcell";
import {
  createGraph, distances,
} from "@red-cup-engineering/metrologic/models/graphs/directed-multigraph";

/** Proof paths over predication. */

const EDGE_TYPES = Object.freeze(["specialization", "converse", "subject-projection", "object-projection"]);

const isLiteralTerm = term => typeof term === "string";
const termKey = term => isLiteralTerm(term) ? term.normalize("NFC") : hasTriple(term) ? address(term) : semanticId(term);
const cellOf = (subject, predicate, object) => cell(subject, predicate, object);

const byteDecoder = new TextDecoder("utf-8", { ignoreBOM: true });
const sanitizeSegment = text => text === "" ? "~e" : Array.from(utf8Bytes(text), (byte, index) => {
  const character = String.fromCharCode(byte);
  return /^[A-Za-z0-9._-]$/u.test(character) && !(index === 0 && character === ".") &&
    !(index === 1 && text === "..") ? character : `~${byte.toString(16).padStart(2, "0")}`;
}).join("");

function desanitizeSegment(segmentText) {
  if (segmentText === "~e") return "";
  const bytes = [];
  for (const token of segmentText.match(/~[0-9a-fA-F]{2}|./gsu) ?? []) {
    if (token.length === 3 && token.startsWith("~")) bytes.push(Number.parseInt(token.slice(1), 16));
    else bytes.push(...utf8Bytes(token));
  }
  return byteDecoder.decode(Uint8Array.from(bytes));
}

const segment = term => sanitizeSegment(termKey(term));

function decodeSegment(text) {
  const decoded = desanitizeSegment(text);
  return sanitizeSegment(decoded) === text ? decoded : null;
}

const render = ({ root, steps }) => [segment(root), ...steps.flatMap(({ kind, node }) => [kind, "library", segment(node)])].join("/");

function parsePath(path) {
  if (typeof path !== "string") return null;
  const [root, ...hops] = path.split("/");
  const rootKey = decodeSegment(root);
  if (rootKey === null || hops.length % 3 !== 0) return null;
  const steps = [];
  for (let index = 0; index < hops.length; index += 3) {
    const [kind, delimiter, node] = hops.slice(index, index + 3);
    const nodeKey = decodeSegment(node);
    if (delimiter !== "library" || !EDGE_TYPES.includes(kind) || nodeKey === null) return null;
    steps.push(Object.freeze({ kind, nodeKey }));
  }
  return Object.freeze({ rootKey, steps: Object.freeze(steps) });
}

const targetKeyOf = path => path.steps.at(-1)?.nodeKey ?? path.rootKey;

const edgeKey = (from, kind, to) => JSON.stringify([from, kind, to]);
const coordinates = ({ subject, predicate, object }) => [termKey(subject), predicate, termKey(object)];
const sortKey = atom => {
  const [from, kind, to] = coordinates(atom);
  return edgeKey(from, EDGE_TYPES.indexOf(kind), to);
};

function canonicalEdges(atoms) {
  const unique = new Map();
  for (const atom of atoms) {
    const key = sortKey(atom);
    if (!unique.has(key)) unique.set(key, atom);
  }
  return [...unique.keys()].sort().map(key => unique.get(key));
}

const atom = (subject, predicate, object) => Object.freeze({ subject, predicate, object });

/** Project cell transformations to graph edges. Specialization points from general to specific. */
function structureOf(cells, { specializationPredicate } = {}) {
  const specialization = termKey(specializationPredicate ?? "is-a");
  const edges = new Map();
  for (const { subject, predicate, object } of cells) {
    let candidates;
    if (termKey(predicate) === specialization) {
      candidates = [atom(object, "specialization", subject)];
    } else {
      const node = cellOf(subject, predicate, object);
      candidates = [atom(node, "converse", converse(node)), atom(node, "subject-projection", subject), atom(node, "object-projection", object)];
    }
    for (const edge of candidates) {
      const key = sortKey(edge);
      if (!edges.has(key)) edges.set(key, edge);
    }
  }
  return Object.freeze([...edges.values()]);
}

function atomsOfStructure(structure) {
  const edges = [];
  for (const kind of EDGE_TYPES) {
    if (!Array.isArray(structure[kind])) continue;
    for (const edge of structure[kind]) {
      if (edge && typeof edge === "object" && "domain" in edge && "codomain" in edge) {
        edges.push(atom(edge.domain, kind, edge.codomain));
      }
    }
  }
  return Object.freeze(edges);
}

function structureAddress(atoms) {
  const term = value => isLiteralTerm(value) ? termKey(value) : { address: termKey(value) };
  const edges = canonicalEdges(atoms).map(({ subject, predicate, object }) => {
    if (!EDGE_TYPES.includes(predicate)) throw new TypeError(`unknown proof edge ${JSON.stringify(predicate)}`);
    return [term(subject), predicate, term(object)];
  });
  return semanticId({ kind: "semiotic-content.generator-structure", version: 1, edges });
}

function graphOf(atoms) {
  const original = canonicalEdges(atoms);
  const edges = original.map((entry, data) => {
    const [from, kind, to] = coordinates(entry);
    return { from: `:${from}`, kind, to: `:${to}`, data };
  });
  const graph = createGraph({ edges });
  const reverse = createGraph({ edges: edges.map(({ from, to }) => ({ from: to, to: from })) });
  return { graph, reverse, original };
}

function shortestEdges({ graph, original }, start, distancesToEnd, requireEdge = false) {
  if (!distancesToEnd.has(start)) return null;
  const result = [];
  let node = start;
  if (requireEdge && distancesToEnd.get(start) === 0) {
    const returning = graph.outgoing(start).filter(({ to }) => distancesToEnd.has(to));
    const first = returning.reduce((best, edge) => !best || distancesToEnd.get(edge.to) < distancesToEnd.get(best.to) ? edge : best, null);
    if (!first) return null;
    result.push(original[first.data]);
    node = first.to;
  }

  while (distancesToEnd.get(node) > 0) {
    const next = graph.outgoing(node).find(({ to }) => distancesToEnd.get(to) === distancesToEnd.get(node) - 1);
    result.push(original[next.data]);
    node = next.to;
  }
  return result;
}

function routeOf(atoms, root, target) {
  const from = `:${termKey(root)}`, to = `:${termKey(target)}`;
  const index = from === to ? null : graphOf(atoms);
  const path = index ? shortestEdges(index, from, distances(index.reverse, to)) : [];
  if (path === null) return null;
  return Object.freeze({ root, steps: Object.freeze(path.map(({ predicate, object }) => Object.freeze({ kind: predicate, node: object }))) });
}

function closure(atoms) {
  const index = graphOf(atoms);
  const paths = [];
  for (const { id } of index.graph.nodes()) {
    const distance = distances(index.reverse, id);
    for (const from of distance.keys()) {
      const path = shortestEdges(index, from, distance, true);
      if (path) paths.push({ path, key: JSON.stringify(path.map(sortKey)) });
    }
  }
  paths.sort((left, right) => left.path.length - right.path.length ||
    (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
  return Object.freeze(paths.map(({ path }) => path.length === 1 ? path[0]
    : atom(path[0].subject, Object.freeze(path.map(edge => edge.predicate)), path.at(-1).object)));
}

const proves = (atoms, root, target) => routeOf(atoms, root, target) !== null;

function walk(atoms, path) {
  const parsed = parsePath(path);
  if (!parsed) return Object.freeze({ ok: false, reason: "malformed or noncanonical proof path" });
  const types = new Map(), edges = new Set();
  for (const edge of atoms) {
    for (const term of [edge.subject, edge.object]) {
      const key = termKey(term), literal = isLiteralTerm(term);
      if (types.has(key) && types.get(key) !== literal) {
        return Object.freeze({ ok: false, reason: "ambiguous structured/literal term identity" });
      }
      types.set(key, literal);
    }
    edges.add(edgeKey(...coordinates(edge)));
  }
  let current = parsed.rootKey;
  for (const { kind, nodeKey } of parsed.steps) {
    if (!edges.has(edgeKey(current, kind, nodeKey))) {
      return Object.freeze({ ok: false, reason: `no ${kind} edge from ${current} to ${nodeKey}` });
    }
    current = nodeKey;
  }
  return Object.freeze({ ok: true });
}

function proofAddress(atoms, path) {
  const edges = Array.isArray(atoms) ? atoms : [...atoms];
  return walk(edges, path).ok
    ? semanticId({ kind: "semiotic-content.proof-path", version: 1, structure: structureAddress(edges), path })
    : null;
}

const noProof = Object.freeze({ ok: false, route: null, generators: Object.freeze([]), path: null, address: null });
function prove(atoms, root, target) {
  const edges = Array.isArray(atoms) ? atoms : [...atoms];
  const route = routeOf(edges, root, target);
  if (!route) return noProof;
  const path = render(route);
  const address = proofAddress(edges, path);
  return Object.freeze({ ok: true, route, generators: Object.freeze(route.steps.map(step => step.kind)), path, address });
}

const pathOf = (structure, root, target) => prove(atomsOfStructure(structure), root, target).path;
const pathOfStructure = pathOf;

const split = text => String(text).split("/").filter(Boolean);
const segments = parts => (Array.isArray(parts) ? parts : [parts]).map(part => sanitizeSegment(String(part)));

function typedPath(root, parts, type) {
  const extension = String(type ?? "").trim().replace(/^\.+/u, "");
  if (!parts.length || !extension) throw new TypeError("typed path requires a term and an extension");
  const path = [root, ...parts, `${parts.at(-1)}.${extension}`].filter(Boolean).join("/");
  const absolute = path.startsWith("/");
  const normalized = [];
  for (const part of split(path)) {
    if (part === ".") continue;
    if (part !== "..") normalized.push(part);
    else if (normalized.length && normalized.at(-1) !== "..") normalized.pop();
    else if (!absolute) normalized.push(part);
  }
  return (absolute ? "/" : "") + normalized.join("/") || ".";
}

const proofPathAddress = (root, term, type) => typedPath(root, segments(Array.isArray(term) ? term : split(term).map(part => part.trim()).filter(Boolean)), type);
const logPath = (root, term) => proofPathAddress(root, term, "jsonl");
const addressNested = (root, parts, type) => typedPath(root, segments(parts), type);
const termOfNested = (root, path) => split(path.startsWith(root) ? path.slice(root.length) : path).slice(0, -1).map(desanitizeSegment);
const termOf = (root, path) => termOfNested(root, path).join("/");
const composeTerm = (namespace, parts = []) => segments([namespace, ...(Array.isArray(parts) ? parts : [parts])]).join("/");
function decomposeTerm(term) {
  const [namespace = "", ...parts] = split(term).map(desanitizeSegment);
  return Object.freeze({ namespace, parts: Object.freeze(parts) });
}
const namespaceOf = term => decomposeTerm(term).namespace;
const withinNamespace = (term, namespace) => split(term)[0] === sanitizeSegment(String(namespace));

export {
  EDGE_TYPES as MORPHISM_KEYS, proofPathAddress, addressNested, atomsOfStructure, cellOf, closure,
  composeTerm, decomposeTerm, desanitizeSegment, isLiteralTerm, logPath, namespaceOf, parsePath,
  pathOf, pathOfStructure, proofAddress, prove, proves, render, routeOf, sanitizeSegment, segment,
  structureAddress, structureOf, targetKeyOf, termKey, termOf, termOfNested, walk, withinNamespace,
};
