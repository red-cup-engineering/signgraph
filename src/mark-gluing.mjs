/**
 * Source-generated first cellular boundary and explicit gluing of Mark positions.
 * The quotient of ORIGINAL PORT OCCURRENCES is a mathematical assumption
 * until a competent source proves each identifying relation.
 * Quot.sound is the proof transport for a proved equivalence, not an
 * automatically charged thermodynamic event.
 */
import { utterance, isUtterance, formalBoundaryOfUtterance }
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
