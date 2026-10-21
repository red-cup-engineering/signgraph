/**
 * Alexandrov reading of one EXPLICIT homogeneous, witnessed SignGraph relation.
 *
 * This is a readout of source-admitted edges, not another graph registry.
 * Reachability is a preorder; its up-sets form the Alexandrov opens.
 * Cyclic points are topologically indistinguishable, but original identities,
 * witnesses, and capabilities remain different. A route is not authority.
 *
 * Application bindings (e.g. ActivityPub Actor delivery, delegation or
 * observation) must provide a separately qualified typed relation. This
 * module cannot infer those facts from Follow, inbox receipt or names.
 */
import {
  reachable, stronglyConnectedComponents, subgraph,
} from '@red-cup-engineering/metrologic/models/graphs/directed-multigraph';
import { projectSignGraphTopology, findSignGraphRoute } from './graph.mjs';
import { glueSignGraphs } from './semantic-graph.mjs';

const MAX_POINTS = 256;
const frozen = values => Object.freeze(values);
const sortIds = (left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
const invalid = message => { throw new TypeError('SignGraph Alexandrov: ' + message); };

/**
 * Read the upper Alexandrov topology on the reflexive-transitive closure of
 * an ALREADY declared, homogeneous relation between typed SignCell points.
 *
 * nodeType is a SignCell type id; predicate is a declared relation id.
 * Both source and target type domains must consist of EXACTLY that type:
 * this prevents closure paths from silently traversing non-actor records.
 *
 * basis is the list of minimal open neighborhoods. No powerset of opens
 * is enumerated. components is a T0 quotient READING, never a license to
 * identify, merge, appoint, authorize, or deliver to different Actors.
 */
export function projectSignGraphAlexandrov(source, options) {
  if (!options || typeof options !== 'object' || Array.isArray(options) ||
      Object.keys(options).some(key => !['nodeType', 'predicate'].includes(key)) ||
      typeof options.nodeType !== 'string' || options.nodeType.length === 0 ||
      typeof options.predicate !== 'string' || options.predicate.length === 0)
    invalid('options require exactly nodeType and predicate strings');

  const checked = glueSignGraphs(source);
  if (!checked.ok) {
    const error = new TypeError('SignGraph Alexandrov source refused: ' + checked.refusal.message);
    error.code = checked.refusal.code;
    throw error;
  }
  const admitted = checked.value.graph;
  const { nodeType, predicate } = options;
  const relation = admitted.relations.find(item => item.id === predicate);
  if (!relation || relation.subjectTypes.length !== 1 ||
      relation.objectTypes.length !== 1 ||
      relation.subjectTypes[0] !== nodeType || relation.objectTypes[0] !== nodeType)
    invalid('predicate must be originally declared with exactly nodeType on both ends');

  const points = frozen(admitted.cells.filter(cell => cell.type === nodeType)
    .map(cell => frozen({ id: cell.id, type: cell.type })).sort(sortIds));
  if (points.length > MAX_POINTS)
    throw new RangeError('SignGraph Alexandrov: ' + points.length +
      ' points exceed bounded ' + MAX_POINTS + ' point reading');

  const byId = new Map(points.map(ref => [ref.id, ref]));
  const graph = subgraph(projectSignGraphTopology(admitted), new Set(byId.keys()));
  const futureIds = new Map(points.map(ref => [ref.id,
    new Set([ref.id, ...reachable(graph, ref.id, { kind: predicate })])]));
  const basis = frozen(points.map(point => frozen({
    point,
    open: frozen([...futureIds.get(point.id)].map(id => byId.get(id)).sort(sortIds)),
  })));
  const components = frozen(stronglyConnectedComponents(graph, { kind: predicate })
    .map(ids => frozen(ids.map(id => byId.get(id)).sort(sortIds)))
    .sort((a, b) => sortIds(a[0], b[0])));

  function pointId(ref) {
    if (!ref || typeof ref !== 'object' || Array.isArray(ref) ||
        typeof ref.id !== 'string' || ref.type !== nodeType || !byId.has(ref.id))
      invalid('point must be an existing source-admitted typed reference');
    return ref.id;
  }
  const principalOpen = point => basis.find(item => item.point.id === pointId(point)).open;
  const specializes = (x, y) => futureIds.get(pointId(x)).has(pointId(y));
  const isOpen = members => {
    if (!Array.isArray(members)) invalid('candidate open must be an array of typed references');
    const subset = new Set(members.map(pointId));
    return [...subset].every(id => [...futureIds.get(id)].every(other => subset.has(other)));
  };
  const readSubset = members => {
    if (!Array.isArray(members)) invalid('members must be an array of typed references');
    return new Set(members.map(pointId));
  };
  const asPoints = members => frozen([...members].map(id => byId.get(id)).sort(sortIds));
  // Up S = union of the principal upper neighborhoods at each source point.
  // This is an OPEN HULL (not topological closure; closure is the DOWN hull).
  const upperHull = members => {
    const selected = readSubset(members), union = new Set();
    for (const id of selected) for (const later of futureIds.get(id)) union.add(later);
    return asPoints(union);
  };
  // Box T = {x | every reachable y is in T}: the largest open subset of T.
  // Up S subset T iff S subset Box T (directed Post/Box adjunction).
  const futureNecessary = members => {
    const selected = readSubset(members);
    return asPoints(new Set(points.filter(point =>
      [...futureIds.get(point.id)].every(id => selected.has(id))).map(point => point.id)));
  };
  // Topological closure of S, unlike upperHull, is the causal DOWN-set.
  const topologicalClosure = members => {
    const selected = readSubset(members);
    return asPoints(new Set(points.filter(point =>
      [...futureIds.get(point.id)].some(id => selected.has(id))).map(point => point.id)));
  };
  const witnessedRoute = (from, to) => {
    const x = byId.get(pointId(from)), y = byId.get(pointId(to));
    // Original route readmission and edge witnesses, not an inferred signed
    // transitive edge. Only the selected homogeneous relation can occur.
    return findSignGraphRoute(admitted, x, y, { predicate });
  };

  const directEdges = frozen(admitted.edges.filter(entry => entry.edge.predicate === predicate));
  return frozen({
    kind: 'signgraph.alexandrov.witnessed-reachability.v1',
    graph: admitted.id,
    nodeType, predicate,
    points, directEdges, basis, components,
    t0: components.every(component => component.length === 1),
    principalOpen, specializes, isOpen, upperHull, futureNecessary,
    topologicalClosure, witnessedRoute,
  });
}


/**
 * Compare two independent source-qualified revisions on EXACTLY the same
 * addressed actor carrier. This is a mathematical comparison of two graph
 * readings, NOT evidence that one happened later, revoked authority, or
 * delivered any ActivityPub message.
 *
 * The identity map source -> target is continuous iff source reachability
 * implies target reachability. If this fails, an originally witnessed route
 * gives a concrete obstruction. If both directions hold the Alex topologies
 * coincide, even if individual direct edge witnesses have changed.
 *
 * Counterexample routes retain original EAVT source addresses; no synthetic
 * transitive "witness edge" is admitted.
 */
export function compareSignGraphAlexandrov(source, target, options) {
  const left = projectSignGraphAlexandrov(source, options);
  const right = projectSignGraphAlexandrov(target, options);
  if (left.points.length !== right.points.length ||
      left.points.some((point, i) =>
        point.id !== right.points[i].id || point.type !== right.points[i].type))
    invalid('identity comparison requires exactly the same source-admitted typed points; use an independently qualified map for changed actors');

  let lostComparabilities = 0, gainedComparabilities = 0;
  const lostExamples = [], gainedExamples = [];
  const MAX_EXAMPLES = 8;
  for (const from of left.points) for (const to of left.points) {
    if (from.id === to.id) continue;
    const prior = left.specializes(from, to);
    const next = right.specializes(from, to);
    if (prior && !next) {
      lostComparabilities += 1;
      if (lostExamples.length < MAX_EXAMPLES)
        lostExamples.push(Object.freeze({
          from, to, originalRoute: left.witnessedRoute(from, to),
        }));
    } else if (!prior && next) {
      gainedComparabilities += 1;
      if (gainedExamples.length < MAX_EXAMPLES)
        gainedExamples.push(Object.freeze({
          from, to, newRoute: right.witnessedRoute(from, to),
        }));
    }
  }
  const beforeEdges = new Set(left.directEdges.map(edge => edge.id));
  const afterEdges = new Set(right.directEdges.map(edge => edge.id));
  const lostDirectWitnesses = left.directEdges.filter(edge => !afterEdges.has(edge.id));
  const gainedDirectWitnesses = right.directEdges.filter(edge => !beforeEdges.has(edge.id));
  return Object.freeze({
    kind: 'signgraph.alexandrov.identity-comparison.v1',
    sourceGraph: left.graph,
    targetGraph: right.graph,
    nodeType: left.nodeType,
    predicate: left.predicate,
    comparedPoints: left.points.length,
    sourceToTargetContinuous: lostComparabilities === 0,
    targetToSourceContinuous: gainedComparabilities === 0,
    identityHomeomorphism: lostComparabilities === 0 && gainedComparabilities === 0,
    lostComparabilities,
    gainedComparabilities,
    lostExamples: Object.freeze(lostExamples),
    gainedExamples: Object.freeze(gainedExamples),
    lostDirectWitnesses: Object.freeze(lostDirectWitnesses),
    gainedDirectWitnesses: Object.freeze(gainedDirectWitnesses),
  });
}
