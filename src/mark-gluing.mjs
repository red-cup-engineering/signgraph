/**
 * Source-generated first cellular boundary and explicit gluing of Mark positions.
 * The quotient of ORIGINAL PORT OCCURRENCES is a mathematical assumption
 * until a competent source proves each identifying relation.
 * Quot.sound is the proof transport for a proved equivalence, not an
 * automatically charged thermodynamic event.
 */
import { utterance, isUtterance, formalBoundaryOfUtterance, markRoleIncidenceOfUtterance, traceOfArticulating, reattendArticulating, compareImmediateArticulating }
  from "@red-cup-engineering/signcell/utterance";
import { semanticId }
  from "@red-cup-engineering/semiotic-content-address";
import { cellular2Complex } from "./cohomology.mjs";
import { createGraph, observedTwoStepPaths } from "@red-cup-engineering/metrologic/models/graphs/directed-multigraph";
import { kinematicDiamondSpaceOf } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/causal";
import { subset, meet, join, le } from "@red-cup-engineering/metrologic/sheaf/topology/d-frame";
import { finitePreorder, admitUpperOpen, finiteCoherentSectionSpace } from "@red-cup-engineering/metrologic/models/order/finite-preorder";
import { articulatedPredications } from "@red-cup-engineering/signcell/predication";
import { address as cellAddress } from "@red-cup-engineering/signcell/cell";
import * as chain from "@red-cup-engineering/signchain/bilattice";

const KIND="signgraph.markGeneratedCellGluing.v1";
const freeze=value=>Object.freeze(value);
const name=(i,side)=>"port:"+i+":"+side;
const validIndex=(i,n,label)=>{
  if(!Number.isSafeInteger(i)||i<0||i>=n)
    throw new RangeError(label+" must name a real source Utterance index");
  return i;
};
const readUtterance=value=>{
  if(isUtterance(value))return value;
  if(Array.isArray(value)&&value.length===2)return utterance(value[0],value[1]);
  throw new TypeError("Mark gluing requires native SignCell Utterance or two original Marks");
};
const position=(value,n)=>{
  if(!Array.isArray(value)||value.length!==2||!["token","claim"].includes(value[1]))
    throw new TypeError("an identification endpoint is [index, token|claim]");
  return 2*validIndex(value[0],n,"identification")+(value[1]==="claim"?1:0);
};
const keys=(value,list)=>value&&typeof value==="object"&&!Array.isArray(value)&&
  Object.keys(value).sort().join("|")===list.join("|");

/**
 * Each source Utterance is one oriented formal edge from its token PORT to
 * its claim PORT (not a physical or asserted higher-dimensional wall).
 * Each identification explicitly glues two port occurrences. With E
 * identifications, V=2*utterances initial ports and C final classes, the
 * redundant-identification count is E-(V-C). It is independent of ordering.
 *
 * The built graph's H1 is a DIFFERENT number. Optional face walks attach
 * 2-cells and SignGraph's existing cellular2Complex requires boundary²=0.
 * This model never tests opaque Mark payload identity as an equivalence law.
 */
export function glueMarkUtteranceCells(raw) {
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
     Object.keys(raw).some(k=>!["utterances","identifications","faces"].includes(k)))
    throw new TypeError("Mark gluing requires a source/cell presentation");
  const items=raw.utterances,ids=raw.identifications??[],faces=raw.faces??[];
  if(!Array.isArray(items)||items.length<1||
     !Array.isArray(ids)||!Array.isArray(faces))
    throw new TypeError("Mark gluing requires nonempty source Utterances and finite identification and face lists");
  const utterances=items.map(readUtterance);
  const boundaries=utterances.map(formalBoundaryOfUtterance);
  const n=utterances.length,ports=2*n;
  const parent=Array.from({length:ports},(_,i)=>i);
  const find=x=>{while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x];}return x;};
  const trace=[];
  let merges=0,residue=0;
  for(const [at,item] of ids.entries()) {
    if(!keys(item,["left","right"]))
      throw new TypeError("each presented identification has only left/right endpoints");
    const left=position(item.left,n),right=position(item.right,n);
    const a=find(left),b=find(right),repeated=a===b;
    if(repeated)residue++;
    else {parent[Math.max(a,b)]=Math.min(a,b);merges++;}
    trace.push(freeze({step:at,left:name(item.left[0],item.left[1]),
      right:name(item.right[0],item.right[1]),
      effect:repeated?"residual-identification":"component-merge",
      classes:ports-merges}));
  }
  const roots=Array.from({length:ports},(_,i)=>find(i));
  const unique=[...new Set(roots)].sort((a,b)=>a-b);
  const vertex=i=>"class:"+roots[i];
  const vertices=unique.map(i=>"class:"+i);
  const edges=utterances.map((_,i)=>freeze({
    id:"utterance:"+i,from:vertex(2*i),to:vertex(2*i+1),
  }));
  const attached=faces.map(face=>{
    if(!keys(face,["boundary","id"])||!Array.isArray(face.boundary)||
       face.boundary.length<1)
      throw new TypeError("a 2-cell needs identity and a bounded oriented Utterance walk");
    const boundary=face.boundary.map(step=>{
      if(!keys(step,["direction","utterance"])||![1,-1].includes(step.direction))
        throw new TypeError("each 2-cell step names a source Utterance and direction");
      const at=validIndex(step.utterance,n,"face");
      return freeze({edge:"utterance:"+at,direction:step.direction});
    });
    return freeze({id:face.id,boundary:freeze(boundary)});
  });
  const complex=cellular2Complex({vertices,edges,faces:attached});
  if(residue!==ids.length-(ports-unique.length)||merges+residue!==ids.length)
    throw new TypeError("identification residual fails the finite Euler rank equation");
  return freeze({
    kind:KIND,
    source:freeze({
      utteranceIds:freeze(utterances.map(semanticId)),
      ports:freeze(boundaries.flatMap((b,i)=>b.ports.map(port=>freeze({
        sourceIndex:i,position:port.position,
        markPresentationId:semanticId(port.mark),
        occurrence:name(i,port.position),orientation:port.coefficient,
      })))),
    }),
    identificationLedger:freeze({
      authority:"conditional on presented identifications, not an authenticated Quot.sound",
      gross:ids.length,merges,residue,initialPorts:ports,classes:unique.length,
      trace:freeze(trace),
      // The proposed WIT denomination is per justified equivalence
      // instrument. Merely presenting a relation does not pay that unit.
      witDenomination:"one properly justified Quot.sound identification instrument",
      presentedInstrumentCandidates:ids.length,
      justifiedInstrumentWits:null,
      identificationNerve:freeze({
        h0:unique.length,h1:residue,euler:ports-ids.length,
        indexBalanceHolds:unique.length-residue===ports-ids.length,
      }),
      physicallyErasedBits:null,
    }),
    topology:freeze({
      vertices:complex.vertices,edges:complex.edges,faces:complex.faces,
      betti:complex.betti,ranks:complex.rank,
      graphOnlyH1:complex.graphOnlyH1,
      boundaryZero:complex.coboundary.zero,
      boundaryOne:complex.coboundary.one,
    }),
    distinction:freeze({
      identificationResidue:residue,
      assembledGraphH1:complex.graphOnlyH1,
      filledComplexH1:complex.betti.h1,
      equalNumerically:residue===complex.graphOnlyH1,
      equalityNotAssumed:true,
    }),
    scope:"exact finite presented source quotient and cellular chain complex, not physical Landauer dissipation, externally valid identity or manifold claim",
  });
}


/**
 * Couple a presented port identification to SignChain's ACTUAL four-corner
 * evidence adjudication. This is a guarded comparison entry, not a
 * declaration that positive testimony proves equality or pays physical heat.
 *
 * Input judgment is an original SignCell cell whose subject and object must
 * equal the precise positional port occurrences named by the identification,
 * and whose predicate is the literal "identifies". SignChain refuses missing,
 * opposed, contested or value-only presumed relations before any quotient
 * topology is constructed. Its original witnesses remain in the output.
 *
 * In particular the returned quotient is CONDITIONAL on those presented
 * judgments until a competent proof supplies the relation they purport to
 * witness. This function cannot call Quot.sound or authenticate a witness.
 */
export function glueAdjudicatedMarkUtteranceCells(raw) {
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    Object.keys(raw).some(k=>!["utterances","identifications","faces"].includes(k))||
    !Array.isArray(raw.identifications))
    throw new TypeError("adjudicated Mark gluing requires a finite source and identification judgments");
  const adjudicator=chain.adjudicateCellEvidence;
  if(typeof adjudicator!=="function"){
    const error=new TypeError("SignGraph needs the installed source-owning SignChain evidence adjudicator");
    error.code="SIGNGRAPH_SIGNCHAIN_ADJUDICATION_UNAVAILABLE";
    throw error;
  }
  const examined=raw.identifications.map((item,index)=>{
    if(!item||typeof item!=="object"||Array.isArray(item)||
       Object.keys(item).sort().join("|")!=="judgment|left|right")
      throw new TypeError("adjudicated gluing requires left, right and original source judgment");
    const left=item.left,right=item.right;
    if(!Array.isArray(left)||!Array.isArray(right)||left.length!==2||right.length!==2)
      throw new TypeError("adjudicated gluing names source positions");
    const posture=adjudicator(item.judgment);
    if(item.judgment?.subject!==name(left[0],left[1])||
       item.judgment?.predicate!=="identifies"||
       item.judgment?.object!==name(right[0],right[1]))
      throw new TypeError("evidence must explicitly name the very same two positional source ports");
    if(!posture.identification.eligibleForRelationProof)
      throw new TypeError("unobserved, denied, contested or unmeasured identification refuses gluing");
    return freeze({index,left,right,posture});
  });
  const conditional=glueMarkUtteranceCells({
    utterances:raw.utterances,
    identifications:examined.map(value=>({left:value.left,right:value.right})),
    ...(raw.faces===undefined?{}:{faces:raw.faces}),
  });
  return freeze({
    ...conditional,
    kind:"signgraph.adjudicatedMarkCellGluing.v1",
    judgments:freeze(examined.map(value=>value.posture)),
    relationAdmission:freeze({
      eligibleForRelationProof:true,
      quotientAdmitted:false,
      meaning:"only original unopposed measured SignChain testimony; competent relation proof and its Quot.sound passage remain unreceived",
    }),
  });
}


/**
 * Graph-gradient readout on already generated/conditionally glued Mark cells.
 *
 * The original SignGraph cellular2Complex owns d0 and d1 and has enforced
 * d1*d0=0. A scalar 0-cochain is an *admitted external readout*, not a new
 * primitive Mark identity, source ascent or an order-theoretic gradient.
 * This operation computes d0(f), and exhibits d1(d0(f))=0.
 *
 * A kinetic vector field, metric or Lyapunov energy needs separate input and
 * proof. A phase's Articulating tower depth is not the graph gradient.
 */
export function gradientOfGluedMarkCells(input) {
  if(!input||typeof input!=="object"||Array.isArray(input)||
     Object.keys(input).some(k=>!["utterances","identifications","faces","potentials"].includes(k)))
    throw new TypeError("Mark gradient requires a finite generated cell presentation and scalar potential");
  const {potentials}=input;
  const glued=glueMarkUtteranceCells({
    utterances:input.utterances,
    ...(input.identifications===undefined?{}:{identifications:input.identifications}),
    ...(input.faces===undefined?{}:{faces:input.faces}),
  });
  if(!Array.isArray(potentials)||potentials.length!==glued.topology.vertices.length||
     !potentials.every(Number.isSafeInteger))
    throw new TypeError("Mark gradient requires one bounded integer scalar per generated quotient vertex");
  const readable=n=>{
    if(n>BigInt(Number.MAX_SAFE_INTEGER)||n<BigInt(Number.MIN_SAFE_INTEGER))
      throw new RangeError("an exact Mark-gradient value exceeds the safe integer boundary");
    return Number(n);
  };
  const gradient=glued.topology.boundaryZero.map(row=>readable(
    row.reduce((sum,coefficient,j)=>sum+BigInt(coefficient)*BigInt(potentials[j]),0n)));
  const faceCirculation=glued.topology.boundaryOne.map(row=>readable(
    row.reduce((sum,coefficient,j)=>sum+BigInt(coefficient)*BigInt(gradient[j]),0n)));
  if(faceCirculation.some(x=>x!==0))
    throw new TypeError("source-derived Mark complex contradicts d1 d0 = 0");
  return freeze({
    kind:"signgraph.markGeneratedGradient.v1",
    source:glued,
    scalar0Cochain:freeze([...potentials]),
    oriented1Cochain:freeze(gradient),
    exactFaceCirculation:freeze(faceCirculation),
    invariant:"native cellular coboundary d1 d0 = 0",
    scope:"exact gradient on conditional source-generated finite quotient, not physical force, free-energy descent or Articulating ascent",
  });
}


/**
 * A genuinely TWO-SORTED wall/cell INCIDENCE complex over original Marks.
 *
 * Unlike glueMarkUtteranceCells' older signed 1-edge PROJECTION, this
 * preserves distinct role sorts: each original token candidate is a WALL
 * node, each original claim candidate is a CELL node. One native Utterance
 * creates an intrinsic wall->cell incidence; it does not identify them.
 *
 * Additional CELL->WALL attaching incidences require an original, exactly
 * addressed SignCell judgment passing SignChain's witnessed/unopposed/
 * measured evidence gate. That evidence is NOT a proof of a quotient
 * identification or of a spatial manifold attachment. No wall or cell is
 * collapsed just because its underlying Mark presentations have identical
 * content. Optional face walks are source-identified and validated by
 * SignGraph's existing cellular2Complex, including boundary squared zero.
 *
 * The resulting graph is the incidence GRAPH of possible wall/cell
 * attachments. Its H1 is not automatically the H1 of the physical complex
 * these incidences may eventually present: a realization still needs
 * actual cell dimensions, higher attaching maps and justified quotienting.
 */
export function assembleMarkWallCellIncidence(raw){
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
     Object.keys(raw).some(k=>!["utterances","attachments","faces"].includes(k)))
    throw new TypeError("two-sorted Mark incidence requires source Utterances, optional witnessed attachments and faces");
  const values=raw.utterances,attachments=raw.attachments??[],faces=raw.faces??[];
  if(!Array.isArray(values)||values.length<1||
     !Array.isArray(attachments)||!Array.isArray(faces))
    throw new TypeError("two-sorted Mark incidence requires nonempty source Utterances and finite attachment and face lists");
  const sources=values.map(readUtterance);
  const incidences=sources.map(markRoleIncidenceOfUtterance);
  const n=sources.length;
  const vertices=sources.flatMap((_,i)=>["wall:"+i,"cell:"+i]);
  const edges=sources.map((_,i)=>freeze({id:"utterance:"+i,from:"wall:"+i,to:"cell:"+i}));
  const judged=attachments.map((attachment,i)=>{
    if(!keys(attachment,["cell","judgment","wall"]))
      throw new TypeError("attaching incidence requires source cell, target wall and original SignCell judgment");
    const from=validIndex(attachment.cell,n,"cell attachment");
    const to=validIndex(attachment.wall,n,"wall attachment");
    const expectedFrom="cell:"+from,expectedTo="wall:"+to;
    const original=attachment.judgment;
    const admitted=chain.adjudicateCellEvidence(original);
    if(original?.subject!==expectedFrom||original?.predicate!=="attaches-to"||
       original?.object!==expectedTo)
      throw new TypeError("attaching judgment must name the precise source cell and wall occurrence");
    if(!admitted.identification.eligibleForRelationProof)
      throw new TypeError("unsupported, opposed, contested or unmeasured Mark attachment refuses incidence");
    edges.push(freeze({id:"attachment:"+i,from:expectedFrom,to:expectedTo}));
    return freeze({id:"attachment:"+i,sourceCell:from,targetWall:to,judgment:admitted});
  });
  const boundaries=faces.map(face=>{
    if(!keys(face,["boundary","id"])||!Array.isArray(face.boundary)||
       face.boundary.length<1)
      throw new TypeError("incidence face needs an identity and an oriented source walk");
    const boundary=face.boundary.map(step=>{
      if(!keys(step,["direction","edge"])||![1,-1].includes(step.direction)||
         typeof step.edge!=="string")
        throw new TypeError("face step requires a named original incidence edge and direction");
      return freeze({edge:step.edge,direction:step.direction});
    });
    return freeze({id:face.id,boundary:freeze(boundary)});
  });
  const geometry=cellular2Complex({vertices,edges,faces:boundaries});
  return freeze({
    kind:"signgraph.twoSortedMarkIncidenceComplex.v1",
    source:freeze({
      utteranceIds:freeze(sources.map(semanticId)),
      roleIncidences:freeze(incidences),
    }),
    sorts:freeze({wall:n,cell:n,equatedAcrossSorts:false}),
    attachments:freeze(judged),
    conditionalGeometry:freeze({
      vertices:geometry.vertices,edges:geometry.edges,faces:geometry.faces,
      coboundary:geometry.coboundary,
      graphOnlyH1:geometry.graphOnlyH1,
      betti:geometry.betti,rank:geometry.rank,
    }),
    status:"exact conditional incidence presentation",
    relationAdmission:freeze({
      quotientAdmitted:false,
      sourceAuthority:"original SignChain witnessed incidence; attaching-map and equivalence proofs still required",
    }),
    scope:"finite two-sorted incidence graph and optionally face-filled CW comparison; no physical wall/cell dimension or aperiodic regime proved",
  });
}


/**
 * Unfold the existing Articulating recursion into a finite source-generated
 * incidence tower, with no externally supplied graph edges or witness claims.
 *
 * Articulating.utter supplies the first genuine Mark→wall/cell incidence;
 * each Articulating.pair supplies ONE new source Utterance. We choose a
 * minimal, explicit ONE-DIMENSIONAL realization of pair recursion:
 * the previous claim-side occurrence is linked to the new token-side
 * occurrence, followed by the new token→claim incidence.
 *
 * These are formal structural/recursive links, NOT witnessed external
 * identifications, quotient relations, physical walls, or a physical metric.
 * Distinct source OCCURRENCES never collapse, even if their Mark contents
 * or entire Utterances share the same content-addressed presentation.
 *
 * At layer n this chosen incidence graph must be a tree with 2n distinct
 * positions, 2n-1 edges, H0=1, H1=0. Each source prefix is a *subcomplex*
 * of the next stage. There is a source-derived deformation retraction
 * that contracts the two new positions and edges onto the immediately
 * preceding claim position. Both ascending inclusion and descending
 * contraction are CHAIN MAPS (they commute with the genuine boundary).
 * p◦j = identity; j◦p is not identity because new source layers are lost.
 *
 * These are finite Articulating prefix/source-geometry morphisms. They
 * establish no transfinite closure ordinal, Scott continuity, intrinsic
 * metric gradient, aperiodic foam or microscopic Landauer reset.
 */
export function unfoldArticulatingIncidenceTower(carrier,options={}){
  if(!options||typeof options!=="object"||Array.isArray(options)||
     Object.keys(options).some(k=>k!=="maxLayers"))
    throw new TypeError("source tower admits only its finite maxLayers budget");
  const maxLayers=options.maxLayers??16;
  if(!Number.isSafeInteger(maxLayers)||maxLayers<1||maxLayers>16)
    throw new RangeError("source tower maxLayers must be 1-16");
  const native=traceOfArticulating(carrier,{maxLayers});
  const stages=[];
  const boundaryCheck=(before,after)=>{
    const oldV=before.vertices.length,oldE=before.edges.length;
    const newV=after.vertices.length,newE=after.edges.length;
    if(newV!==oldV+2||newE!==oldE+2)
      throw new TypeError("source pair did not add precisely its two Mark roles and two structural edges");
    const vDown=Array.from({length:newV},(_,i)=>i<oldV?i:oldV-1);
    const eDown=Array.from({length:newE},(_,i)=>i<oldE?i:null);
    const prior=before.coboundary.zero,later=after.coboundary.zero;
    for(let i=0;i<newE;i++){
      const aggregated=Array(oldV).fill(0);
      for(let j=0;j<newV;j++)aggregated[vDown[j]]+=later[i][j];
      const expected=i<oldE?prior[i]:Array(oldV).fill(0);
      if(aggregated.some((x,j)=>x!==expected[j]))
        throw new TypeError("Articulating descending contraction is not a boundary-commuting chain map");
    }
    for(let i=0;i<oldE;i++)
      if(later[i].some((x,j)=>j<oldV?x!==prior[i][j]:x!==0))
        throw new TypeError("Articulating prefix inclusion is not a boundary-commuting chain map");
    return freeze({
      fromDepth:before.depth,toDepth:after.depth,
      ascending:freeze({
        vertices:freeze(Array.from({length:oldV},(_,i)=>i)),
        edges:freeze(Array.from({length:oldE},(_,i)=>i)),
        commutesWithBoundary:true,
      }),
      descending:freeze({
        vertices:freeze(vDown),
        edges:freeze(eDown),
        commutesWithBoundary:true,
        contractedPositions:freeze([oldV,oldV+1]),
        toPreviousClaimPosition:oldV-1,
      }),
      retractionAfterInclusionIsIdentity:true,
      inclusionAfterRetractionIsIdentity:false,
      distinctNewSourcePositions:2,
      // Kernel of the chosen vertex projection: exactly three distinct
      // source-position occurrences project onto the previous claim.
      // Two spanning-tree identifications WOULD present this quotient.
      // Neither is a source-proved Quot.sound use or an energy event.
      projectionKernel:freeze({
        fiber:freeze([oldV-1,oldV,oldV+1]),
        image:oldV-1,
        potentialIdentificationPairs:freeze([
          freeze([oldV-1,oldV]),freeze([oldV-1,oldV+1]),
        ]),
        independentMerges:2,
        residualIdentifications:0,
        justifiedQuotSoundWits:null,
        physicallyDissipatedEnergy:null,
        scope:"only the kernel equivalence of the selected readout retraction",
      }),
      scope:"a chosen finite structural contraction, not inverse of Articulating or quotient-equality proof",
    });
  };
  const transports=[];
  for(let depth=1;depth<=native.trace.length;depth++){
    const vertices=[],edges=[];
    for(let i=0;i<depth;i++){
      vertices.push("wall:"+i,"cell:"+i);
      edges.push(freeze({id:"utterance:"+i,from:"wall:"+i,to:"cell:"+i}));
      if(i>0)edges.push(freeze({
        id:"recursive-pair:"+i,from:"cell:"+(i-1),to:"wall:"+i,
      }));
    }
    const cellComplex=cellular2Complex({vertices,edges,faces:[]});
    if(cellComplex.betti.h0!==1||cellComplex.betti.h1!==0||
       vertices.length!==2*depth||edges.length!==2*depth-1)
      throw new TypeError("generated Articulating source recursion failed the finite tree invariant");
    const state=freeze({
      depth,sourceArticulatingId:semanticId(native.prefixes[depth-1]),
      sourceUtteranceId:semanticId(native.trace[depth-1]),
      sourceRoleIncidence:markRoleIncidenceOfUtterance(native.trace[depth-1]),
      regime:"strict finite source ordinal, not closure fixed-point ordinal",
      vertices:freeze(vertices),edges:freeze(edges),
      coboundary:cellComplex.coboundary,
      cohomology:freeze({
        h0:cellComplex.betti.h0,h1:cellComplex.betti.h1,
        treeEuler:vertices.length-edges.length,
      }),
    });
    if(stages.length>0)transports.push(boundaryCheck(stages.at(-1),state));
    stages.push(state);
  }
  return freeze({
    kind:"signgraph.markGeneratedArticulatingTower.v1",
    status:"constructed",
    source:freeze({
      articulatingId:semanticId(native.carrier),
      finiteOrdinal:native.sourceOrdinal,
      markCarrierIds:freeze(native.trace.map(u=>freeze({
        token:semanticId(u.token.mark),claim:semanticId(u.claim.mark),
      }))),
    }),
    stages:freeze(stages),transports:freeze(transports),
    sourceLaw:"Articulating.utter base; each Articulating.pair adds one original Utterance; chosen cell(previous)->wall(next) structural link",
    limitLaw:"finite successor folds only, no aperiodic/uncountable limit generator established",
    equivalenceAuthority:"none: no external Mark-port identifications are made",
  });
}


/**
 * EARLIEST SOURCE-GENERATED OBSERVATIONAL QUOTIENT OF A FREE INCIDENCE TOWER.
 *
 * The only initial input is an existing ORIGINAL Articulating and a bounded
 * count of native, immediate SAME-HEAD re-attendings. Every new performance
 * is constructed by SignCell's actual Articulating.pair owner; none of the
 * Mark heads, equivalence pairs, graph edges, truth values or spatial
 * coordinates is supplied by the caller.
 *
 * Phase 1: SignGraph's already existing unfoldArticulatingIncidenceTower
 * constructs the unglued Mark-position chain. It is a TREE.
 * Phase 2: the source-derived HeadCoincidence for each new performance
 * presents a single identification of the NEW claim-position vertex
 * with the old head-claim position. Only this readout is quotiented.
 * Phase 3: the existing cellular2Complex measures the resulting graph.
 *
 * The source-generated observational relation is supported in Science by
 * Articulating.headQuot_reentry_identification (one Quotient.sound
 * instrument SITE). It must be kernel checked and paid by WitLedger
 * BEFORE any runtime can assert authenticated WIT receiving.
 * Reusing that Science theorem along a finite orbit is not a source
 * of free independent Marks, measured k_B T ln2 heat, or aperiodic closure.
 *
 * For k re-attendings of a source of n Utterances, the chosen free
 * incidence graph has V=2(n+k), E=2(n+k)-1, H1=0; the quotient has
 * V'=2(n+k)-k, same E, H1'=k. The identification NERVE here has
 * k independent merges, ZERO redundant cycles. These are different
 * invariants of two different mathematical projections.
 */
export function generateHeadObservationGluing(raw) {
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
     Object.keys(raw).some(k=>!["articulating","steps"].includes(k))||
     !Object.hasOwn(raw,"articulating"))
    throw new TypeError("observational gluing requires only an original Articulating and optional re-attention steps");
  const steps=raw.steps??1;
  if(!Number.isSafeInteger(steps)||steps<0||steps>6)
    throw new RangeError("source-generated quotient permits zero to six bounded re-attendings");
  const source=traceOfArticulating(raw.articulating,{maxLayers:16});
  if(source.trace.length+steps>16)
    throw new RangeError("source-generated observation exceeds the sixteen-layer finite capacity");
  let cursor=source.carrier;
  const receipts=[];
  for(let i=0;i<steps;i++){
    const next=reattendArticulating(cursor,{maxLayers:16});
    const compared=compareImmediateArticulating(
      cursor,next.presented,next.presented,{maxLayers:16});
    if(!compared.comparison.headPresentationCoincides||
       !compared.comparison.constructedPresentationCoincides)
      throw new TypeError("native source-derived head relation failed the immediate constructor");
    receipts.push(freeze({
      step:i+1,
      fromArticulatingId:semanticId(cursor),
      toArticulatingId:semanticId(next.presented),
      sourceHeadPresentation:semanticId(next.presentedHead),
      relation:"one source-generated head-preserving immediate re-attention",
      relationInScience:"Obsmetrologia.Articulating.HeadCoincidence",
      correspondingInstrument:"Obsmetrologia.Articulating.headQuot_reentry_identification",
    }));
    cursor=next.presented;
  }
  const unglued=unfoldArticulatingIncidenceTower(cursor,{maxLayers:16});
  const final=unglued.stages.at(-1);
  const firstCopied=source.trace.length-1;
  const originCell="cell:"+firstCopied;
  const image=id=>{
    if(!id.startsWith("cell:"))return id;
    const index=Number(id.slice(5));
    return index>firstCopied?originCell:id;
  };
  const vertices=final.vertices.map(image).filter((item,i,array)=>
    array.indexOf(item)===i);
  const edges=final.edges.map(edge=>freeze({
    id:edge.id,from:image(edge.from),to:image(edge.to),
  }));
  const quotient=cellular2Complex({vertices,edges,faces:[]});
  const total=source.trace.length+steps;
  if(final.cohomology.h1!==0||final.vertices.length!==2*total||
     quotient.betti.h0!==1||quotient.betti.h1!==steps||
     vertices.length!==2*total-steps||
     edges.length!==2*total-1)
    throw new TypeError("source-generated observation did not have the expected nontrivial quotient incidence");
  return freeze({
    kind:"signgraph.markSourceHeadObservationGluing.v1",
    status:"constructed-conditional-observation",
    originalSourceId:semanticId(source.carrier),
    continuedSourceId:semanticId(cursor),
    addedReattendings:steps,
    original:freeze({
      depth:total,vertices:final.vertices,
      edges:final.edges,cohomology:final.cohomology,
    }),
    identification:freeze({
      instruments:freeze(receipts),
      sourceProvenHeadRelations:steps,
      candidateQuotSoundUses:steps,
      identifiedClaimPositions:freeze(Array.from({length:steps},(_,j)=>
        freeze({left:originCell,right:"cell:"+(firstCopied+1+j)}))),
      independentMerges:steps,
      identificationNerveH1:0,
      justifiedLeanWits:null,
      physicalDissipation:null,
      acceptance:"pending native Lean kernel and wit-ledger receiving; quotient reflects source head observation only",
    }),
    projected:freeze({
      vertices:quotient.vertices,edges:quotient.edges,
      cohomology:quotient.betti,
      graphOnlyH1:quotient.graphOnlyH1,
      coboundary:quotient.coboundary,
    }),
    law:"Articulating source re-attention -> source head-coincidence -> proposed Quotient.sound -> generated cellular incidence shadow",
    frontier:"no first pre-Mark exclusion theorem, no uncountable aperiodic limit, no physical matter/heat inference",
  });
}


/**
 * Derive finite composable observation routes FROM performed Articulating,
 * never FROM an arbitrary caller-supplied category or table of possible worlds.
 *
 * This receives the existing source-head-observation generator, which itself
 * creates each re-attending using SignCell's native constructor. The "objects"
 * are the successive distinct performed source acts; an edge exists exactly
 * where the source supplied its own immediate HeadCoincidence continuation.
 * The empty route and path concatenation can THEN be recognized as the unit
 * and associative composition of this particular generated chain.
 *
 * These are source-relative, content-addressed formal routes. The
 * observational quotient of the graph is STILL conditional: no actual
 * Lean/WitLedger receipt, Chalmers semantic reference, physics, actor
 * authority, or new necessary utterance before the Mark floor is claimed.
 */
const generatedRouteReceipts=new WeakMap();

export function derivePerformedObservationRoutes(raw) {
  const observation=generateHeadObservationGluing(raw);
  const headSteps=observation.identification.instruments;
  const source=observation.originalSourceId;
  const nodes=[source],edges=[];
  for(const [index,step] of headSteps.entries()) {
    if(step.fromArticulatingId!==nodes[index] ||
      step.step!==index+1 ||
      step.fromArticulatingId===step.toArticulatingId)
      throw new TypeError("native re-attending failed to generate a distinct, contiguous source act");
    edges.push(freeze({
      step:index+1,
      from:step.fromArticulatingId,
      to:step.toArticulatingId,
      head:step.sourceHeadPresentation,
      address:semanticId([
        "obsmetrologia.performed-head-observation-step/v1",
        source,step.step,step.fromArticulatingId,
        step.toArticulatingId,step.sourceHeadPresentation,
      ]),
    }));
    nodes.push(step.toArticulatingId);
  }
  if(nodes.at(-1)!==observation.continuedSourceId ||
     new Set(nodes).size!==nodes.length)
    throw new TypeError("performed re-attending did not retain distinct source history");
  const paths=[];
  for(let i=0;i<nodes.length;i++)for(let j=i;j<nodes.length;j++) {
    const steps=freeze(edges.slice(i,j).map(e=>e.address));
    paths.push(freeze({
      kind:"signgraph.performedObservationRoute/v1",
      from:nodes[i],to:nodes[j],
      first:i,last:j,steps,
      address:semanticId([
        "obsmetrologia.performed-observation-route/v1",
        source,nodes[i],nodes[j],steps,
      ]),
    }));
  }
  const result=freeze({
    kind:"signgraph.generatedPerformedObservationRoutes/v1",
    status:"generated-from-native-Articulating-formal-source",
    originalSourceId:source,
    continuedSourceId:observation.continuedSourceId,
    nodes:freeze(nodes),edges:freeze(edges),
    paths:freeze(paths),
    observationalQuotient:freeze({
      candidateQuotSoundUses:observation.identification.candidateQuotSoundUses,
      justifiedLeanWits:observation.identification.justifiedLeanWits,
      status:observation.identification.acceptance,
    }),
    // This is deliberately NOT "Chalmers Category": no secondary referent
    // extensions, naturality or source-forced pre-Mark generator was proved.
    scope:"finite source-generated re-attending and composable trace routes only; category is a downstream mathematical reading",
  });
  const key= (i,j) => i+":"+j;
  generatedRouteReceipts.set(result,new Map(paths.map(p=>[key(p.first,p.last),p])));
  return result;
}

/**
 * Composition is *read off* the generated path, not freely appointed by a
 * user's FCA preorder. Return the original contiguous source route.
 * A deserialized graph/route must be regenerated from the original
 * Articulating before taking part; a matching hash is not a proof receipt.
 */
export function composePerformedObservationRoutes(result,left,right) {
  const received=generatedRouteReceipts.get(result);
  if(!received ||
     !left || !right ||
     received.get(left.first+":"+left.last)!==left ||
     received.get(right.first+":"+right.last)!==right)
    throw new TypeError("composition requires original generated observation routes");
  if(left.to!==right.from || left.last!==right.first)
    throw new TypeError("performed observation routes are not composable");
  const composite=received.get(left.first+":"+right.last);
  if(!composite)
    throw new TypeError("source did not generate that composite observation route");
  return composite;
}


/**
 * Project NATIVE performed Articulating routes through their already observed
 * head Marks and calculate the exactly missing source path compositions.
 *
 * This is a finite head-shadow comparison for richer Paracosm research,
 * NOT the existing source-realizable kinematic-past Paracosm of
 * Obsmetrologia.GeneratedWorlds. It is made ONLY from original SignCell
 * re-attention and introduces no arbitrary observer equality, pre-Mark
 * world, quotient proof, actor, or executable duty.
 *
 * Each generated source step advances a different Articulating history even
 * when its exposed utterance head is unchanged. An observer seeing only that
 * head finds composable loops. Metrologic computes their complete two-edge
 * image; the original route composer alone licenses each source composite.
 * Thus one image composition can exist while its exact source edge pair does
 * not compose. This is neither a fictitious original arrow nor authority to
 * execute the observational path.
 */
export function derivePerformedHeadShadow(raw) {
  const generated = derivePerformedObservationRoutes(raw);
  // Head is read FROM the original Mark-rooted performed source, not from a
  // supplied "observer interpretation". The performed continuation reuses it.
  const performed = traceOfArticulating(raw.articulating, { maxLayers: 16 });
  const originHead = semanticId(performed.trace.at(-1));
  const imageAt = new Map(generated.nodes.map((node, index) => [
    node, index === 0 ? originHead : generated.edges[index - 1].head,
  ]));
  if (generated.edges.some(edge => edge.head !== originHead))
    throw new TypeError("re-attention observation did not retain its original Mark-rooted head");
  const source = createGraph();
  for (const id of generated.nodes) source.addNode(id);
  for (const edge of generated.edges) {
    source.addEdge({
      from: edge.from, to: edge.to, kind: "source-performed-step",
      data: { step: edge.step, address: edge.address },
    });
  }
  const image = observedTwoStepPaths(source, node => imageAt.get(node));
  // The complete performed prefix is retained: K(C) must not be fabricated
  // merely from the post-observation tail, nor from a chosen coordinate grid.
  // Each original native Articulating prefix contributes exactly one causal
  // event; the observed re-attention steps continue that SAME source chain.
  const eventIds = freeze([
    ...performed.prefixes.slice(0, -1).map(prefix => semanticId(prefix)),
    ...generated.nodes,
  ]);
  if (new Set(eventIds).size !== eventIds.length ||
      eventIds[performed.prefixes.length - 1] !== generated.originalSourceId)
    throw new TypeError("source-generated causal prefix and re-attending failed to join");
  const causalSteps = Array.from({ length: eventIds.length - 1 }, (_, index) =>
    freeze({ parent: index, child: index + 1 }));
  const finiteKinematic = kinematicDiamondSpaceOf({
    eventCount: eventIds.length, edges: causalSteps,
  });
  const kinematicPoints = freeze(finiteKinematic.points.map(point => freeze({
    ...point,
    lowerArticulatingId: eventIds[point.lowerEventIndex],
    upperArticulatingId: eventIds[point.upperEventIndex],
  })));
  const kinematic = freeze({
    kind: "signgraph.performedArticulatingKinematicReadout.v1",
    sourceEventIds: eventIds,
    strictCausalSteps: freeze(causalSteps),
    points: kinematicPoints,
    sequencing: finiteKinematic.sequencing,
    causalFrontiers: finiteKinematic.causalFrontiers,
    causalHeight: finiteKinematic.causalHeight,
    scope: "derived finite causal-diamond endpoint sequencing, not a physical metric or all Kinematic Space",
  });
  // Lean's LSpace(W) is an original performed occurrence inhabiting a
  // kinematic locus only when the occurrence belongs to the upper act's
  // performed prefix. Here original Articulating is a finite constructor
  // chain, so the precise source-admitted occurrence fiber over (a,b) is
  // prefix indices [0..b]. Equal head Marks never merge occurrences.
  const sourceHeadIds = freeze([
    ...performed.trace.map(head => semanticId(head)),
    ...generated.edges.map(edge => edge.head),
  ]);
  if (sourceHeadIds.length !== eventIds.length)
    throw new TypeError("original utterance occurrence count lost its performed Articulating source");
  // Reconstruct ONLY with SignCell's native generative operation. The
  // existing source-observation operator generated these same steps already;
  // every replayed predecessor/continuation/head ID must match that result.
  // No duplicate predication constructor or new Semioverse truth valuation.
  let continued = performed.carrier;
  for (const edge of generated.edges) {
    const next = reattendArticulating(continued, { maxLayers: 16 });
    if (semanticId(continued) !== edge.from ||
        semanticId(next.presented) !== edge.to ||
        semanticId(next.presentedHead) !== edge.head)
      throw new TypeError("native Articulating continuation differs from original generated source");
    continued = next.presented;
  }
  if (semanticId(continued) !== generated.continuedSourceId)
    throw new TypeError("Semioverse incidence lost the original continued source");
  // Science's finite Semioverse core composes the seeds of two original
  // utterance occurrences. This exact constructor is already in SignCell:
  // (u.token, u.claim, v.token). Source indices distinguish performances
  // even where their extensional predication cells have equal addresses.
  const generatedClaims = articulatedPredications(continued, { maxLayers: 16 });
  if (generatedClaims.entries.length !== eventIds.length * eventIds.length)
    throw new TypeError("generated Semioverse pair incidence is incomplete");
  const claimEntries = freeze(generatedClaims.entries.map((entry, claimIndex) => freeze({
    claimIndex,
    firstOccurrenceIndex: entry.subjectOccurrence,
    secondOccurrenceIndex: entry.objectOccurrence,
    firstOccurrenceId: eventIds[entry.subjectOccurrence],
    secondOccurrenceId: eventIds[entry.objectOccurrence],
    claimAddress: cellAddress(entry.cell),
  })));
  const semioverse = freeze({
    kind: "signgraph.performedSemioverseIncidence.v1",
    originalSourceId: generated.originalSourceId,
    continuedSourceId: generated.continuedSourceId,
    sourceEventIds: eventIds,
    claimEntries,
    loci: freeze(kinematicPoints.map((point, pointIndex) => freeze({
      pointIndex,
      maximumAdmittedOccurrenceIndex: point.upperEventIndex,
      admittedClaimCount: (point.upperEventIndex + 1) ** 2,
    }))),
    scope: "source-ordered performed pair incidence only; not all FOAM evidence, logical truth, admitted authority or universal Semioverse",
  });
  const lspace = freeze({
    kind: "signgraph.performedLocalLSpaceIncidence.v1",
    sourceEventIds: eventIds,
    sourceHeadIds,
    loci: freeze(kinematicPoints.map((point, pointIndex) => freeze({
      pointIndex,
      occurrences: freeze(eventIds.slice(0, point.upperEventIndex + 1)
        .map((occurrenceId, occurrenceIndex) => freeze({
          occurrenceIndex, occurrenceId, headId: sourceHeadIds[occurrenceIndex],
        }))),
    }))),
    scope: "finite source-performed incidence only; no new words, semantic identity, evidence charge or knowledge permission",
  });
  if (image.atomic.length !== generated.edges.length ||
      image.sourceVertexCount !== generated.nodes.length)
    throw new TypeError("observed head image lost a native performed source occurrence");
  const originalRoutes = new Map(generated.paths.map(route => [
    route.first + ":" + route.last, route,
  ]));
  const composable = image.composites.map(pair => {
    const [leftIndex, rightIndex] = pair.sourceEdgeIndices;
    const left = originalRoutes.get(leftIndex + ":" + (leftIndex + 1));
    const right = originalRoutes.get(rightIndex + ":" + (rightIndex + 1));
    // A shadow pair may have equal observed endpoints while its original
    // source transitions are disjoint. Never call source composition then.
    const licensed = pair.sourceComposable
      ? composePerformedObservationRoutes(generated, left, right)
      : null;
    const exactEndpointRoute = generated.paths.find(route =>
      route.from === pair.sourceFrom && route.to === pair.sourceTo);
    return freeze({
      sourceStepAddresses: freeze([generated.edges[leftIndex].address,
        generated.edges[rightIndex].address]),
      sourceEndpoints: freeze([pair.sourceFrom, ...pair.sourceVia, pair.sourceTo]),
      observedHead: pair.observedVia,
      observedFrom: pair.observedFrom,
      observedTo: pair.observedTo,
      sourceComposable: pair.sourceComposable,
      licensedSourceComposite: licensed?.address ?? null,
      originalEndpointRouteExists: exactEndpointRoute?.address ?? null,
      ghostObservationOnly: pair.observationOnly,
    });
  });
  return freeze({
    kind: "signgraph.performedHeadObservationShadow.v1",
    originalSourceId: generated.originalSourceId,
    continuedSourceId: generated.continuedSourceId,
    originalSourceNodes: generated.nodes,
    originalSourceSteps: generated.edges,
    originalSourceRoutes: generated.paths,
    kinematic,
    lspace,
    semioverse,
    observedHeads: image.observedVertices,
    observedAtomicSteps: image.atomic,
    observedTwoStepComposites: freeze(composable),
    originalCompositions: image.liftedCount,
    ghostCompositions: image.observationOnlyCount,
    observationalQuotient: generated.observationalQuotient,
    sourceAuthority: "only original generated Articulating routes compose in the source",
    observationAuthority: "none: head coincidence cannot authorize or prove a source arrow",
  });
}

/** A bounded observation fiber over an ORIGINAL generated kinematic point.
 * This is a readout of this source-derived object, never a new claim,
 * proof, permission, signed witness, or authority to consume private data.
 */
export function readPerformedSemioverseFiber(shadow, pointIndex) {
  const W = shadow?.kinematic, semi = shadow?.semioverse;
  if (shadow?.kind !== "signgraph.performedHeadObservationShadow.v1" ||
      semi?.kind !== "signgraph.performedSemioverseIncidence.v1" ||
      !Array.isArray(W?.points) || !Array.isArray(semi?.claimEntries) ||
      !Number.isSafeInteger(pointIndex) || pointIndex < 0 ||
      pointIndex >= W.points.length)
    throw new TypeError("Semioverse fiber requires a generated shadow and an existing kinematic point");
  const point = W.points[pointIndex];
  const admitted = semi.claimEntries.filter(entry =>
    entry.firstOccurrenceIndex <= point.upperEventIndex &&
    entry.secondOccurrenceIndex <= point.upperEventIndex);
  return freeze({
    kind: "signgraph.performedSemioverseFiber.v1",
    pointIndex, point,
    entries: freeze(admitted),
    source: semi.continuedSourceId,
    scope: "projection of sourced utterance pairs at the kinematic upper prefix; a serialized shadow is not itself an authenticated source witness",
  });
}

/** Unique forward lift of a SAME source pair along K(C) sequencing.
 * Equality is the kinematic identity. No unproved backwards restriction
 * is allowed: the future original performance is absent from its past.
 */
export function transportPerformedSemioverseClaim(shadow, fromPointIndex, toPointIndex, claimIndex) {
  const from = readPerformedSemioverseFiber(shadow, fromPointIndex);
  const target = readPerformedSemioverseFiber(shadow, toPointIndex);
  if (!Number.isSafeInteger(claimIndex) || claimIndex < 0 ||
      claimIndex >= shadow.semioverse.claimEntries.length)
    throw new TypeError("Semioverse transport requires a genuine original claim occurrence");
  const claim = shadow.semioverse.claimEntries[claimIndex];
  if (!from.entries.includes(claim))
    throw new TypeError("Semioverse transport cannot backdate a source-performed claim");
  const precedes = fromPointIndex === toPointIndex ||
    shadow.kinematic.sequencing.some(edge =>
      edge.parent === fromPointIndex && edge.child === toPointIndex);
  if (!precedes)
    throw new TypeError("Semioverse transport requires original kinematic endpoint sequencing");
  if (!target.entries.includes(claim))
    throw new TypeError("Semioverse kinematic transport lost the original performed occurrence");
  return freeze({
    kind: "signgraph.performedSemioverseForwardLift.v1",
    fromPointIndex, toPointIndex, claimIndex,
    claimAddress: claim.claimAddress,
    firstOccurrenceId: claim.firstOccurrenceId,
    secondOccurrenceId: claim.secondOccurrenceId,
    source: shadow.semioverse.continuedSourceId,
  });
}

/**
 * An actually queryable, finite, source-generated local-to-global fiber
 * cover. This is the first COMPARISON of patches of the original performed
 * Semioverse, NOT an assumed Grothendieck coverage or a sheaf theorem.
 *
 * Each host-selected patch is a subset of actual original claim-occurrence
 * coordinates at an earned kinematic point. K(C)'s forward lift licenses
 * transport from each patch to the target. An inverse-image on the POWERS
 * of supported coordinates may then restrict an observed section backwards
 * by intersection: this does not reverse an original performed Articulating.
 * Metrologic owns these exact finite Heyting/powerset operations.
 *
 * Overlaps require equal selected membership for each SAME original occurrence
 * pair; equal extensional claimAddress does not collapse independent acts.
 * Incompatible overlap preserves its two opposed patch statements; incomplete
 * coverage preserves original uncovered pairs. Neither is silently completed.
 */
export function readPerformedCellularCover(shadow, targetPointIndex, localPatches) {
  const target = readPerformedSemioverseFiber(shadow,targetPointIndex);
  if(!Array.isArray(localPatches)||localPatches.length<1||localPatches.length>64)
    throw new TypeError("cellular L-Space cover requires 1-64 source-indexed patches");
  const targetIds=target.entries.map(entry=>String(entry.claimIndex));
  const targetSupport=subset(targetIds);
  const byIndex=new Map(target.entries.map(entry=>[String(entry.claimIndex),entry]));
  const owned=localPatches.map((patch,number)=>{
    if(!patch||typeof patch!=="object"||Array.isArray(patch)||
       Object.keys(patch).some(k=>!["pointIndex","claimIndices"].includes(k))||
       !Array.isArray(patch.claimIndices)||patch.claimIndices.length>targetIds.length)
      throw new TypeError("L-Space patch requires only source locus and selected claim indices");
    const original=readPerformedSemioverseFiber(shadow,patch.pointIndex);
    // No caller-supplied cover relation: the actual generated kinematic arrow
    // must exist; source forward transport of EVERY local occurrence is read.
    const originalSupport=original.entries.map(entry=>String(entry.claimIndex));
    for(const entry of original.entries)
      transportPerformedSemioverseClaim(shadow,patch.pointIndex,targetPointIndex,entry.claimIndex);
    const seen=new Set();
    for(const index of patch.claimIndices) {
      if(!Number.isSafeInteger(index)||index<0||!original.entries.some(x=>x.claimIndex===index)||
          seen.has(index))
        throw new TypeError("L-Space patch selects unknown, duplicated or future claim");
      seen.add(index);
    }
    const selection=subset(patch.claimIndices.map(String));
    return freeze({
      patch:number,pointIndex:patch.pointIndex,
      sourceSupport:subset(originalSupport),
      // Section-level reindexing is an intersection within original
      // support, not an inverse transport of new performed occurrences.
      selected:meet(selection,targetSupport),
      witness:"host-selected section over a genuine source kinematic patch, not sourced FOUR valuation",
    });
  });
  let covered=subset([]);
  for(const patch of owned)covered=join(covered,patch.sourceSupport);
  const uncovered=targetSupport.elements.filter(id=>!covered.elements.includes(id));
  const opposed=[];
  for(let left=0;left<owned.length;left++)for(let right=left+1;right<owned.length;right++){
    const overlap=meet(owned[left].sourceSupport,owned[right].sourceSupport);
    for(const id of overlap.elements){
      const a=owned[left].selected.elements.includes(id);
      const b=owned[right].selected.elements.includes(id);
      if(a!==b){
        const entry=byIndex.get(id);
        opposed.push(freeze({
          claimIndex:entry.claimIndex,claimAddress:entry.claimAddress,
          firstOccurrenceId:entry.firstOccurrenceId,
          secondOccurrenceId:entry.secondOccurrenceId,
          leftPatch:left,rightPatch:right,leftSelected:a,rightSelected:b,
        }));
      }
    }
  }
  // Construct a global section ONLY for a complete, overlap-compatible
  // cover. Set union is lawful after this guard; it doesn't settle charge.
  const complete=le(targetSupport,covered),compatible=opposed.length===0;
  let selected=null;
  if(complete&&compatible){
    selected=subset([]);
    for(const patch of owned)selected=join(selected,patch.selected);
  }
  const sourceEntries=selected===null?null:
    freeze(target.entries.filter(entry=>selected.elements.includes(String(entry.claimIndex)))
      .map(entry=>freeze({
        locus:targetPointIndex,
        claimIndex:entry.claimIndex,
        firstOccurrenceIndex:entry.firstOccurrenceIndex,
        secondOccurrenceIndex:entry.secondOccurrenceIndex,
        firstOccurrenceId:entry.firstOccurrenceId,
        secondOccurrenceId:entry.secondOccurrenceId,
        claimAddress:entry.claimAddress,
      })));
  return freeze({
    kind:"signgraph.performedCellularFiberCover.v1",
    originalSourceId:shadow.originalSourceId,
    continuedSourceId:shadow.continuedSourceId,
    targetPointIndex,
    patchCount:owned.length,
    sourceOccurrenceCount:target.entries.length,
    complete,compatible,
    status:complete&&compatible?"glued-conditional-section":"obstructed",
    patches:freeze(owned.map(p=>freeze({
      patch:p.patch,pointIndex:p.pointIndex,
      sourceClaimIndices:freeze(p.sourceSupport.elements.map(Number)),
      selectedClaimIndices:freeze(p.selected.elements.map(Number)),
    }))),
    uncovered:freeze(uncovered.map(id=>{
      const e=byIndex.get(id);
      return freeze({
        claimIndex:e.claimIndex,claimAddress:e.claimAddress,
        firstOccurrenceId:e.firstOccurrenceId,
        secondOccurrenceId:e.secondOccurrenceId,
      });
    })),
    incompatibleOverlaps:freeze(opposed),
    globalSection:sourceEntries,
    geometry:"original performed kinematic interval points and ordered source-occurrence pair axes; no fabricated continuum/tensor metric",
    variance:"source occurrences lift FORWARD; section supports compare by exact finite restriction, not backwards source acts",
    scope:"conditional finite coordinate-cover and sparse 3-axis source-incidence readout; not full sheafification, FOUR valuation, rights, settlement or earned global L-Space",
  });
}

/**
 * Actual finite Alexandrov section-space of ORIGINAL performed Semioverse
 * occurrence pairs. The older trace-hypertensor manuscripts assert gluing
 * of recognition fibers, but the source's performed fibers transport FORWARD
 * and are not presheaves. A coherent section is a different object:
 * a selection of the SAME original occurrence pair at comparable positions.
 *
 * Restriction is by selecting fewer source-generated positions of an
 * already coherent section. Binary gluing requires local assignments to
 * agree on every common position. This constructs and counts the exact
 * source-possible finite section space, not a fabricated backward transport,
 * modal nucleus, sheaf H1, physical quasicrystal or licensed external Work.
 */
export function readPerformedKinematicSectionSpace(shadow, { patches, sections } = {}) {
  const W=shadow?.kinematic, semi=shadow?.semioverse;
  if(shadow?.kind!=="signgraph.performedHeadObservationShadow.v1"||
     W?.kind!=="signgraph.performedArticulatingKinematicReadout.v1"||
     semi?.kind!=="signgraph.performedSemioverseIncidence.v1"||
     shadow.continuedSourceId!==semi.continuedSourceId ||
     !Array.isArray(W.points)||W.points.length<1||W.points.length>120||
     !Array.isArray(W.sequencing)||!Array.isArray(semi.claimEntries)||
     !Array.isArray(semi.sourceEventIds)||
     semi.claimEntries.length!==semi.sourceEventIds.length**2)
    throw new TypeError("source-coherent kinematic sections require the existing full performed Semioverse");
  if(!Array.isArray(patches)||patches.length<1||patches.length>8)
    throw new RangeError("kinematic cover requires 1..8 finite source-selected opens");
  const pointCount=W.points.length;
  const edges=W.sequencing.map(edge=>{
    if(!Number.isSafeInteger(edge?.parent)||!Number.isSafeInteger(edge?.child)||
       edge.parent<0||edge.child<0||
       edge.parent>=pointCount||edge.child>=pointCount||
       edge.parent===edge.child)
      throw new TypeError("kinematic cover needs actual oriented original sequencing edges");
    return edge;
  });
  const frame=finitePreorder(pointCount,edges.map(edge=>[edge.parent,edge.child]));
  const normalized=patches.map((source,index)=>{
    if(!Array.isArray(source)||source.length<1||source.length>pointCount||
       source.some((point,i)=>!Number.isSafeInteger(point)||point<0||
         point>=pointCount||(i>0&&source[i-1]>=point)))
      throw new TypeError("kinematic cover patch "+index+" needs canonical sorted earned loci");
    // Metrologic, not SignGraph, owns transitive Alexandrov upper-opens.
    // Exact original Articulating emitted all these endpoint sequencing pairs.
    try{return admitUpperOpen(frame,source);}
    catch(error){throw new TypeError("patch "+index+" is not a source-generated upper-open region: "+error.message);}

  });
  const union=freeze([...new Set(normalized.flat())].sort((a,b)=>a-b));
  const claimCount=semi.claimEntries.length;
  // Exact membership comes from the ORIGINAL performed upper prefix, not an
  // after-the-fact claim address or an arbitrary chosen valuation.
  const fibers=Array.from({length:pointCount},(_,p)=>
    readPerformedSemioverseFiber(shadow,p).entries.map(entry=>entry.claimIndex));
  const admitted=new Map(union.map(p=>[p,new Set(fibers[p])]));
  for(const [i,entry] of semi.claimEntries.entries()){
    if(entry?.claimIndex!==i||
       entry.firstOccurrenceId!==semi.sourceEventIds[entry.firstOccurrenceIndex]||
       entry.secondOccurrenceId!==semi.sourceEventIds[entry.secondOccurrenceIndex])
      throw new TypeError("source kinematic sheaf lost original performed pair positions");
  }
  const choicesOf=indices=>{
    // Do not construct a second finite reachability/section solver in this
    // sourced SignGraph consumer. The original Metrologic finite preorder
    // now owns the transitive site, connected components and exact products.
    const space=finiteCoherentSectionSpace(frame,fibers,indices);
    return freeze({components:space.components,possibleSections:space.possibleSections});
  };
  const patchSpace=freeze(normalized.map((indices,i)=>freeze({
    index:i,pointIndices:indices,...choicesOf(indices),
  })));
  const global=choicesOf(union);
  const overlaps=freeze(normalized.flatMap((left,i)=>
    normalized.slice(i+1).map((right,index)=>freeze({
      left:i,right:i+1+index,
      pointIndices:freeze(left.filter(p=>right.includes(p))),
    }))));
  let glued=null,obstructions=[];
  if(sections!==undefined){
    if(!Array.isArray(sections)||sections.length!==normalized.length)
      throw new TypeError("a local source section must be supplied for every original open");
    const locals=normalized.map((indices,i)=>{
      const received=sections[i];
      if(!Array.isArray(received)||received.length!==indices.length)
        throw new TypeError("source section requires exactly one source pair per open point");
      const selections=new Map();
      for(let j=0;j<indices.length;j++){
        const row=received[j];
        if(!row||Object.keys(row).sort().join(",")!=="claimIndex,pointIndex"||
           row.pointIndex!==indices[j]||
           !Number.isSafeInteger(row.claimIndex)||row.claimIndex<0||
           row.claimIndex>=claimCount||
           !admitted.get(row.pointIndex).has(row.claimIndex))
          throw new TypeError("local section must select an ORIGINAL performed pair at its earned point");
        selections.set(row.pointIndex,row.claimIndex);
      }
      // Coherence is a source identity constraint, NOT equality of
      // observational addresses (distinct performed pairs may look equal).
      for(const component of patchSpace[i].components)
        if(new Set(component.pointIndices.map(p=>selections.get(p))).size!==1)
          throw new TypeError("local source section does not preserve its original occurrence pair along kinematic arrows");
      return selections;
    });
    obstructions=overlaps.flatMap(pair=>pair.pointIndices.flatMap(p=>{
      const left=locals[pair.left].get(p),right=locals[pair.right].get(p);
      if(left===right)return [];
      const a=semi.claimEntries[left],b=semi.claimEntries[right];
      return [freeze({kind:"non-gluable-original-source-overlap",
        leftPatch:pair.left,rightPatch:pair.right,pointIndex:p,
        leftClaimIndex:left,rightClaimIndex:right,
        leftSourceOccurrences:freeze([a.firstOccurrenceId,a.secondOccurrenceId]),
        rightSourceOccurrences:freeze([b.firstOccurrenceId,b.secondOccurrenceId]),
        claimAddressesCoincide:a.claimAddress===b.claimAddress,
        reason:"even equal observed claim addresses do not identify distinct performed original source pairs",
      })];
    }));
    if(obstructions.length===0){
      const byPoint=new Map();
      for(const local of locals)for(const [p,index] of local)
        byPoint.set(p,index);
      // Coherence across patch boundaries follows *only* for genuinely
      // upward-open regions: if p≤q and p is in a patch, that patch contains q.
      const combined=[...byPoint].sort((a,b)=>a[0]-b[0]);
      for(const component of global.components)
        if(new Set(component.pointIndices.map(p=>byPoint.get(p))).size!==1)
          throw new TypeError("the original open-cover local coherence did not glue globally");
      glued=freeze(combined.map(([pointIndex,claimIndex])=>{
        const claim=semi.claimEntries[claimIndex];
        return freeze({pointIndex,claimIndex,
          firstOccurrenceId:claim.firstOccurrenceId,
          secondOccurrenceId:claim.secondOccurrenceId,
          claimAddress:claim.claimAddress,
        });
      }));
    }
  }
  return freeze({
    kind:"signgraph.performedKinematicSectionSpace.v1",
    status:sections===undefined?"unselected-source-section-space":
      obstructions.length?"overlap-obstructed":"original-source-sections-glued",
    originalSourceId:shadow.originalSourceId,
    continuedSourceId:shadow.continuedSourceId,
    kinematicOpenCriterion:"upward-closed under original endpoint sequencing",
    patchSpaces:patchSpace,
    unionRegion:freeze({pointIndices:union,...global}),
    pairFiberShape:freeze({
      sourceOccurrences:semi.sourceEventIds.length,
      originalOrderedPairPositions:claimCount,
      semanticAddressQuotientAuthority:"none",
    }),
    // Each source-performed kinematic slice is a REAL three-index Boolean
    // incidence tensor, not an arbitrary vector invented by the caller:
    // H[p,i,j]=[i<=upper(p)][j<=upper(p)]. Every ordered (i,j) is exactly
    // the original SignCell generated claim at i*N+j. Equal claimAddress
    // cells NEVER identify distinct occurrences. Exact CP factors are
    // indexed by the original upper performed source index k:
    // H = Σ_k [upper(p)=k] ⊗ [i<=k] ⊗ [j<=k].
    // This is a bounded *factorization of incidence*, NOT a proved
    // quasicrystalline diffraction spectrum, numeric physical hypertensor,
    // universal Day convolution or independently granted compute capacity.
    sourceIncidenceHypertensor:freeze({
      kind:"signgraph.sourceGeneratedKinematicIncidenceHypertensor.v1",
      axes:freeze(["earned-kinematic-locus","first-original-performance","second-original-performance"]),
      originalOccurrenceIds:semi.sourceEventIds,
      claimIndexFormula:"firstOccurrenceIndex * N + secondOccurrenceIndex",
      incidenceFormula:"1[firstIndex <= upperEventIndex(point)] * 1[secondIndex <= upperEventIndex(point)]",
      slices:freeze(union.map(p=>freeze({
        pointIndex:p,sourceUpperEventIndex:W.points[p].upperEventIndex,
        admittedPairPositions:(W.points[p].upperEventIndex+1)**2,
      }))),
      exactFiniteFactorization:freeze(
        [...new Set(union.map(p=>W.points[p].upperEventIndex))]
          .sort((a,b)=>a-b).map(upper=>freeze({
            upperEventIndex:upper,
            kinematicPointIndices:freeze(union.filter(p=>W.points[p].upperEventIndex===upper)),
            bothOriginalAxesPrefixSize:upper+1,
            term:"indicator[upper(point)==k] * indicator[first<=k] * indicator[second<=k]",
          }))
      ),
      ambientCoefficientDomain:"Boolean incidence; linear rational extension conditional on an owning math conversion",
      semanticStanding:"source-performed incidence, not an evidence charge or active FOUR valuation",
    }),
    overlaps,overlapObstructions:freeze(obstructions),
    gluedSection:glued,
    categoricalBoundary:"restriction of coherent sections is contravariant; performed source occurrences themselves remain forward-only opfibration",
    mathematicalScope:"finite source-coherent binary descent, not arbitrary Grothendieck sheaf, numerical sheaf H1, modal Heyting topos or proven quasicrystalline hypertensor",
    evidenceAuthority:"conditional mathematical readout of original performed Articulating, no independently received Lean/kernel/actor credential",
    customerSettlement:"not-established",
  });
}

/** Compare one proposed receiving classification with the original performed
 * Semioverse claim-address boundary. This finite test is the factorization
 * condition for d to descend through q, not a new authority or a universal
 * Wood mediator. It produces an original-occurrence counterexample when
 * two source claims share q but require different receiving treatments.
 */
export function assessPerformedBoundaryFactorization(shadow, requiredReadings) {
  // This is a conditional finite receiving/observation check, NOT a portal
  // implementation, source-authentication function or host/office admission.
  const semi = shadow?.semioverse;
  const ids = semi?.sourceEventIds, entries = semi?.claimEntries;
  if (shadow?.kind !== "signgraph.performedHeadObservationShadow.v1" ||
      semi?.kind !== "signgraph.performedSemioverseIncidence.v1" ||
      semi.continuedSourceId !== shadow.continuedSourceId ||
      semi.originalSourceId !== shadow.originalSourceId ||
      !Array.isArray(ids) || ids.length < 1 ||
      ids.length > 32 || new Set(ids).size !== ids.length ||
      ids.some(id => typeof id !== "string" || !id.length) ||
      !Array.isArray(entries) || entries.length !== ids.length ** 2)
    throw new TypeError("boundary check requires a complete original performed Semioverse readout");
  // Native SignCell generates one ordered pair for every pair of original
  // Utterance occurrences. This validates structural custody of the readout,
  // not the authenticity of a serialized source or any external permission.
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e?.claimIndex !== i ||
        !Number.isSafeInteger(e.firstOccurrenceIndex) ||
        !Number.isSafeInteger(e.secondOccurrenceIndex) ||
        e.firstOccurrenceId !== ids[e.firstOccurrenceIndex] ||
        e.secondOccurrenceId !== ids[e.secondOccurrenceIndex] ||
        typeof e.claimAddress !== "string" || !e.claimAddress.length)
      throw new TypeError("boundary check found an inconsistent original claim occurrence");
  }
  if (!Array.isArray(requiredReadings) || requiredReadings.length !== entries.length)
    throw new TypeError("boundary check requires one recipient classification for every original claim occurrence");
  const readings = new Array(entries.length);
  for (const supplied of requiredReadings) {
    if (!supplied || typeof supplied !== "object" || Array.isArray(supplied) ||
        Object.keys(supplied).sort().join(",") !== "claimIndex,requiredClass" ||
        !Number.isSafeInteger(supplied.claimIndex) ||
        supplied.claimIndex < 0 || supplied.claimIndex >= entries.length ||
        typeof supplied.requiredClass !== "string" ||
        !/^[a-z][a-z0-9._:-]{0,127}$/u.test(supplied.requiredClass) ||
        readings[supplied.claimIndex] !== undefined)
      throw new TypeError("boundary check requires unique, canonical, complete recipient classifications");
    readings[supplied.claimIndex] = supplied.requiredClass;
  }
  const image = new Map(), obstructions = [];
  const sourceCase = (entry, requiredClass) => freeze({
    claimIndex: entry.claimIndex,
    firstOccurrenceId: entry.firstOccurrenceId,
    secondOccurrenceId: entry.secondOccurrenceId,
    requiredClass,
  });
  for (const entry of entries) {
    const demanded = readings[entry.claimIndex];
    const held = image.get(entry.claimAddress);
    if (held === undefined) {
      image.set(entry.claimAddress, {
        first: entry, requiredClass: demanded, indices: [entry.claimIndex],
        hasObstruction: false,
      });
    } else {
      held.indices.push(entry.claimIndex);
      if (held.requiredClass !== demanded && !held.hasObstruction) {
        obstructions.push(freeze({
          kind: "source-distinction-lost-at-boundary",
          claimAddress: entry.claimAddress,
          first: sourceCase(held.first, held.requiredClass),
          second: sourceCase(entry, demanded),
        }));
        held.hasObstruction = true;
      }
    }
  }
  // Finite descent criterion: d factors through q on the complete original
  // source exactly when d is constant on every fiber of q. Here q is the
  // original SignCell claimAddress readout, never arbitrary user-named edges.
  const factorable = obstructions.length === 0;
  // The coarsest recipient-sufficient refinement of this ORIGINAL q source
  // groups exactly (original claimAddress, recipient-required class).
  // Never refine a source via a caller-invented alias or imply consent to
  // disclose any class. Group index is local to a boundary: not a global ID.
  const byBoundary = new Map();
  for (const entry of entries) {
    const observed = entry.claimAddress, requirement = readings[entry.claimIndex];
    let classes = byBoundary.get(observed);
    if (classes === undefined) { classes = new Map(); byBoundary.set(observed, classes); }
    let group = classes.get(requirement);
    if (group === undefined) {
      group = { claimAddress: observed, requiredClass: requirement,
        classIndexWithinBoundary: classes.size, sourceClaimIndices: [] };
      classes.set(requirement, group);
    }
    group.sourceClaimIndices.push(entry.claimIndex);
  }
  const groups = freeze([...byBoundary.values()].flatMap(classes =>
    [...classes.values()].map(group => freeze({
      ...group, sourceClaimIndices: freeze(group.sourceClaimIndices),
    }))));
  const maxClassesPerBoundary = Math.max(1,
    ...[...byBoundary.values()].map(classes => classes.size));
  const necessaryRefinement = freeze({
    kind: "signgraph.conditionalReceivingBoundaryRefinement.v1",
    groups, extraClasses: groups.length - byBoundary.size,
    maxClassesPerBoundary,
    // A finite fixed-width sidecar can reuse tags in different q fibers.
    // This bound says nothing about source secrecy or permitted disclosure.
    minimumAdditionalTagBits: Math.ceil(Math.log2(maxClassesPerBoundary)),
    standing: "proposed-minimal-distinction-only-not-disclosed-or-authorized",
  });
  return freeze({
    kind: "signgraph.performedBoundaryFactorization.v1",
    originalSourceId: shadow.originalSourceId,
    continuedSourceId: shadow.continuedSourceId,
    sourceClaimCount: entries.length,
    observedBoundaryCount: image.size,
    necessaryRefinement,
    status: factorable ? "conditional-factorization-on-finite-source" : "source-distinction-obstructed",
    inducedBoundaryReadings: factorable
      ? freeze([...image].map(([claimAddress, held]) => freeze({
          claimAddress, requiredClass: held.requiredClass,
          sourceClaimIndices: freeze([...held.indices]),
        })))
      : null,
    obstructions: freeze(obstructions),
    sourceStanding: "original-performed-source-readout-not-issuer-authentication",
    recipientStanding: "caller-supplied-classifications-not-independent-acceptance",
    authority: "none",
    execution: "not-performed",
    settlement: "not-established",
  });
}
