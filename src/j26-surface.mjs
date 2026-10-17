/**
 * One source-owned J26 cellular producer and finite face-glued patches.
 *
 * Metrologic supplies the mathematical J26 geometry and the *oriented*
 * exterior face cycles received from Obsmetrologia.AperiodicOrder.J26.
 * SignGraph derives incidences through its existing cellular3Complex.
 * A patch only assembles explicitly supplied orientation-reversing face
 * identifications. It does NOT claim a rigid embedding, space-filling tiling,
 * right to occupy territory, causal edges, or market trade authority.
 */
import { gyrobifastigiumJ26 } from "@red-cup-engineering/metrologic/articulation/predicating/geometry/spatial/gyrobifastigium-j26";
import { cellular3Complex } from "./cohomology.mjs";

const freeze = value => Object.freeze(value);
const identifier = (value, label) => {
  if (typeof value !== "string" || value.length === 0)
    throw new TypeError("j26: " + label + " requires a nonempty identity");
  return value;
};
const pairKey = (a,b) => JSON.stringify([a,b].sort());
const faceType = face => face.vertices.length === 3 ? "triangle" : "square";

export function j26CellularSurface(geometry = gyrobifastigiumJ26) {
  if (geometry?.type !== "GyrobifastigiumJ26" ||
      geometry.vertices === null || typeof geometry.vertices !== "object" ||
      !Array.isArray(geometry.faces))
    throw new TypeError("j26: require the named finite J26 geometry");
  const vertices = Object.keys(geometry.vertices);
  if (vertices.length !== 8 || geometry.faces.length !== 8)
    throw new RangeError("j26: expected exactly eight vertices and eight exterior faces");
  const known = new Set(vertices), names = new Set();
  const edgesByPair = new Map(), incident = new Map();
  const faces = geometry.faces.map(face => {
    const id = identifier(face?.name,"face");
    if (names.has(id)) throw new TypeError("j26: duplicate face " + id);
    names.add(id);
    const walk = face.vertices;
    if (!Array.isArray(walk) || (walk.length !== 3 && walk.length !== 4) ||
        new Set(walk).size !== walk.length ||
        walk.some(vertex => typeof vertex !== "string" || !known.has(vertex)))
      throw new TypeError("j26: a face needs three or four distinct known vertices");
    const boundary = walk.map((from,i) => {
      const to = walk[(i+1)%walk.length];
      const key = pairKey(from,to);
      let edge = edgesByPair.get(key);
      if (!edge) {
        edge = freeze({id:key,from,to});
        edgesByPair.set(key,edge);
      }
      const direction = edge.from === from && edge.to === to ? 1 : -1;
      const entries = incident.get(key) ?? [];
      entries.push(freeze({face:id,direction}));
      incident.set(key,entries);
      return freeze({edge:edge.id,direction});
    });
    return freeze({id,vertices:freeze([...walk]),kind:faceType(face),boundary:freeze(boundary)});
  });
  if (edgesByPair.size !== 14 ||
      faces.filter(face => face.kind === "triangle").length !== 4 ||
      faces.filter(face => face.kind === "square").length !== 4)
    throw new RangeError("j26: expected fourteen edges, four triangles, four squares");
  const dual = [];
  for (const [edge, entries] of incident) {
    if (entries.length !== 2 || entries[0].direction + entries[1].direction !== 0)
      throw new RangeError("j26: exterior incident faces must traverse each edge oppositely: " + edge);
    dual.push(freeze({edge,faces:freeze(entries.map(entry=>entry.face))}));
  }
  const volume = freeze({id:"j26",boundary:freeze(faces.map(face=>freeze({face:face.id,direction:-1})))});
  const complex = cellular3Complex({
    vertices,edges:[...edgesByPair.values()],
    faces:faces.map(face=>({id:face.id,boundary:face.boundary})),
    volumes:[volume],
  });
  if (!complex.totalFaceBoundaryCloses || complex.betti.h0 !== 1 ||
      complex.betti.h1 !== 0 || complex.betti.h2 !== 0 || complex.betti.h3 !== 0)
    throw new RangeError("j26: derived 3-complex is not the expected filled J26 cell");
  return freeze({
    kind:"signgraph.j26.cellular-surface.v1",
    vertices:freeze(vertices),faces:freeze(faces),
    edges:freeze([...edgesByPair.values()]),
    faceAdjacency:freeze(dual),complex,
  });
}

const admittedRef = (ref, ids, faces, role) => {
  if (ref === null || typeof ref !== "object" || Array.isArray(ref) ||
      !ids.has(ref.tile) || !faces.has(ref.face))
    throw new TypeError("j26 patch: " + role + " must address a listed tile and exterior face");
  return freeze({tile:ref.tile,face:ref.face});
};

/** Explicit finite combinatorial contact, never inferred from proximity.
 * Each provided face map must reverse the cyclic orientation and be a bijection.
 * The matched facets must be the same polygon type. No physical placement,
 * non-overlap, global tessellation, or real-world contract is inferred.
 */
export function j26FacePatch({ tiles, interfaces = [] } = {}) {
  if (!Array.isArray(tiles) || tiles.length === 0 ||
      !Array.isArray(interfaces))
    throw new TypeError("j26 patch: require tiles and an interface array");
  const surface = j26CellularSurface();
  const ids = new Set(), acceptedTiles = tiles.map(id => {
    identifier(id,"tile");
    if (ids.has(id)) throw new TypeError("j26 patch: duplicate tile " + id);
    ids.add(id);
    return id;
  });
  const faces = new Map(surface.faces.map(f=>[f.id,f]));
  const used = new Set(), seen = new Set();
  const accepted = interfaces.map(item => {
    const id = identifier(item?.id,"interface");
    if (seen.has(id)) throw new TypeError("j26 patch: duplicate interface " + id);
    seen.add(id);
    const left = admittedRef(item.left,ids,faces,"left");
    const right = admittedRef(item.right,ids,faces,"right");
    if (left.tile === right.tile)
      throw new TypeError("j26 patch: a contact cannot join a tile to itself");
    const leftFace = faces.get(left.face), rightFace = faces.get(right.face);
    if (leftFace.kind !== rightFace.kind)
      throw new TypeError("j26 patch: triangle and square faces cannot be identified");
    for (const ref of [left,right]) {
      const k = JSON.stringify([ref.tile,ref.face]);
      if (used.has(k)) throw new TypeError("j26 patch: exterior face is already consumed");
      used.add(k);
    }
    const pairs = item.vertexPairs;
    if (!Array.isArray(pairs) || pairs.length !== leftFace.vertices.length ||
        pairs.some(p=>!Array.isArray(p)||p.length!==2))
      throw new TypeError("j26 patch: require the full oriented vertex identification");
    const mapping = new Map(pairs);
    if (mapping.size !== pairs.length ||
        new Set(pairs.map(pair=>pair[1])).size !== pairs.length ||
        [...mapping.keys()].some(v=>!leftFace.vertices.includes(v)) ||
        [...mapping.values()].some(v=>!rightFace.vertices.includes(v)))
      throw new TypeError("j26 patch: contact must biject the two named faces");
    const n = leftFace.vertices.length, target = rightFace.vertices;
    for (let i=0;i<n;i++) {
      const from=mapping.get(leftFace.vertices[i]);
      const next=mapping.get(leftFace.vertices[(i+1)%n]);
      const index=target.indexOf(from);
      if (target[(index+n-1)%n] !== next)
        throw new TypeError("j26 patch: contact must reverse the oriented face boundary");
    }
    return freeze({id,left,right,vertexPairs:freeze(pairs.map(pair=>freeze([...pair])))});
  });
  const exposed = [];
  for (const tile of acceptedTiles) for (const face of surface.faces)
    if (!used.has(JSON.stringify([tile,face.id])))
      exposed.push(freeze({tile,face:face.id,kind:face.kind}));
  return freeze({
    kind:"signgraph.j26.combinatorial-patch.v1",
    surface,tiles:freeze(acceptedTiles),
    interfaces:freeze(accepted),exposed:freeze(exposed),
    // A combinatorial game graph is not causal order or proof of a physical packing.
    adjacency:freeze(accepted.map(i=>freeze({interface:i.id,from:i.left.tile,to:i.right.tile}))),
  });
}
