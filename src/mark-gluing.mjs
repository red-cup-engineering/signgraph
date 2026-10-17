/**
 * Source-generated first cellular boundary and explicit gluing of Mark positions.
 * The quotient of ORIGINAL PORT OCCURRENCES is a mathematical assumption
 * until a competent source proves each identifying relation.
 * Quot.sound is the proof transport for a proved equivalence, not an
 * automatically charged thermodynamic event.
 */
import { utterance, isUtterance, formalBoundaryOfUtterance, markRoleIncidenceOfUtterance, traceOfArticulating }
  from "@red-cup-engineering/signcell/utterance";
import { semanticId }
  from "@red-cup-engineering/computer-content-address-engineering-services-section/semiotic-content-address";
import { cellular2Complex } from "./cohomology.mjs";
import * as chain from "@red-cup-engineering/signchain/bilattice";

const KIND="signgraph.markGeneratedCellGluing.v1";
const LIMITS=Object.freeze({utterances:32,identifications:128,faces:32});
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
  if(!Array.isArray(items)||items.length<1||items.length>LIMITS.utterances||
     !Array.isArray(ids)||ids.length>LIMITS.identifications||
     !Array.isArray(faces)||faces.length>LIMITS.faces)
    throw new RangeError("bounded Utterance, identification and face lists required");
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
       face.boundary.length<1||face.boundary.length>LIMITS.identifications)
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
  if(!Array.isArray(values)||values.length<1||values.length>LIMITS.utterances||
     !Array.isArray(attachments)||attachments.length>LIMITS.identifications||
     !Array.isArray(faces)||faces.length>LIMITS.faces)
    throw new RangeError("two-sorted Mark incidence exceeds bounded source/attachment/face budget");
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
       face.boundary.length<1||face.boundary.length>LIMITS.identifications)
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
