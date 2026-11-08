/**
 * A source-Mark substitution spectrum, computed rather than guessed from n.
 *
 * A substitution is a finite family of native SignCell Utterances. Each
 * utterance's token-side MARK presents one alphabet letter, and the
 * claim-side MARK carries an ordered word (array) of those very same original
 * Mark presentations. The claim is not a new primitive recurrence, nor proof
 * of an observational quotient: it is a typed source-owned syntactic rule.
 *
 * Positional Mark occurrences -> word incidence with multiplicities ->
 * existing Data Engineering exact characteristic polynomial. Also derive
 * the positive-evidence FOUR Chu pairing, but keep its lost multiplicities
 * visible: incidence is NOT an isomorphism of word and FOUR.
 *
 * Characteristic degree is matrix dimension by construction. This alone
 * proves neither irreducible MINIMAL degree, Pisot growth, quasicrystal,
 * cohomological rank, nor any non-finite closure regime.
 */
import { isMark } from "@red-cup-engineering/signcell/mark";
import { isUtterance, traceOfArticulating } from "@red-cup-engineering/signcell/utterance";
import { semanticId, admitCell, cellSet, measured, presence, recordOf } from "@red-cup-engineering/signcell/cell";
import { charPoly, fromInts, toInt } from "@red-cup-engineering/metrologic/number/exact-number";
import { cohomologyOfEdgeGraph } from "./cohomology.mjs";

const LIMIT=8,MAX_WORD=64;
const ID="signgraph.markSourceSubstitutionSpectrum.v1";
const freeze=x=>Object.freeze(x);
export function spectrumOfMarkSubstitution(input) {
  // Recover the SAME source as Mark→Utterance→Articulating when the caller
  // provides a genuine generative carrier. The original list input remains
  // an explicitly declared finite comparison/presentation surface.
  const trace=Array.isArray(input)?null:traceOfArticulating(input,{maxLayers:LIMIT});
  const utterances=trace===null?input:trace.trace;
  if(!Array.isArray(utterances)||utterances.length<1||utterances.length>LIMIT||
     utterances.some(u=>!isUtterance(u)))
    throw new TypeError("Mark substitution needs one to eight original SignCell Utterance rules");
  const n=utterances.length;
  const alphabet=utterances.map(u=>u.token.mark);
  const ids=alphabet.map(semanticId);
  if(new Set(ids).size!==n)
    throw new TypeError("Mark substitution alphabet contains duplicate original presentations");
  const index=new Map(ids.map((id,i)=>[id,i]));
  const words=utterances.map(u=>{
    const value=u.claim.mark.value;
    if(!Array.isArray(value)||value.length>MAX_WORD||
       value.some(item=>!isMark(item)||!index.has(semanticId(item))))
      throw new TypeError("each substitution claim must be an ordered word of known original Mark presentations");
    return freeze(value.map(item=>index.get(semanticId(item))));
  });
  const incidence=words.map(word=>{
    const row=Array(n).fill(0);
    for(const position of word)row[position]++;
    return freeze(row);
  });
  // This graph of literal substitution LETTER INCIDENCES is not the
  // Anderson-Putnam tiling complex or the identification-residue nerve.
  // Use SignGraph's existing exact graph-cohomology owner to read it.
  const directedEdges=incidence.flatMap((row,i)=>row.flatMap((count,j)=>
    Array.from({length:count},()=>[ids[i],ids[j]])));
  const adjacency=cohomologyOfEdgeGraph(ids,directedEdges);
  const adjacencyGraph=freeze({
    vertices:n,edges:directedEdges.length,
    components:adjacency.zeroCohomology.rank,
    graphH1:adjacency.firstCohomology.rank,
    scope:"adjacency multigraph cycle rank; not Anderson-Putnam cohomology or proved StepN cohRank",
  });
  const poly=charPoly(fromInts(incidence)).map(toInt);
  if(!Array.isArray(poly)||poly.length!==n+1||
     poly.some(coefficient=>!Number.isSafeInteger(coefficient)))
    throw new TypeError("the exact-number provider returned a malformed characteristic polynomial");
  const coefficients=freeze(poly.slice().reverse());
  const positiveIncidence=freeze(incidence.flatMap((row,i)=>row.map((count,j)=>freeze({
    pt:ids[i],st:ids[j],reading:count>0?"potential":"absurd",
  }))));
  const forgotten=freeze(incidence.flatMap((row,i)=>row.map((count,j)=>({i,j,count}))
    .filter(entry=>entry.count>1).map(entry=>freeze(entry))));
  return freeze({
    kind:ID,status:"derived",
    source:freeze({
      kind:trace===null?"original-utterance-list-presentation":"native-articulating-trace",
      utteranceIds:freeze(utterances.map(semanticId)),
      alphabetMarkIds:freeze(ids),
      ...(trace===null?{}:{
        articulatingId:semanticId(trace.carrier),
        finiteSourceOrdinal:trace.sourceOrdinal,
      }),
    }),
    words:freeze(words),
    adjacencyGraph,
    substitution:freeze({
      matrix:freeze(incidence),
      alphabetSize:n,characteristicPolynomialDescending:coefficients,
      polynomialDegree:n,
    }),
    chu:freeze({pts:freeze(ids),sts:freeze(ids),r:positiveIncidence}),
    informationLoss:freeze({
      multipleSymbolEntries:forgotten,
      claim:"FOUR positive-incidence projection forgets word order and multiplicity",
    }),
    scope:"finite original Mark-word substitution; no minimal-polynomial, Pisot, transfinite ordinal, physical dimension or H1 claim",
  });
}


/**
 * Grow possible finite "molecular" Mark words by firing ONLY substitution
 * utterances in an original, genuinely performed Articulating source.
 *
 * This is not an abstract graph, stochastic optimizer, or source of free
 * rewrites. The supplier is spectrumOfMarkSubstitution's already admitted
 * original Mark->Utterance->Articulating spectrum; the only variation is
 * choosing which existing Mark occurrence receives its own source rule.
 * Externally supplied seed/target words are application inputs, NOT extra
 * mathematical generators or proofs of necessities.
 *
 * Search all one-occurrence reactions breadth-first, preserving distinct
 * performed reaction PATHS even if a later Mark-word projection coincides.
 * Stop only after a COMPLETE generation is examined. A bounded or truncated
 * frontier cannot claim target unreachability or minimality. "Selected" means
 * fewest performed source-rule firings to an exact caller-supplied word under
 * this particular finite reaction semantics. It is not useful behavior,
 * biological fitness, physical energy, proof equivalence, or a chemical law.
 */
export function selectSourceMarkReactions(input) {
  if(!input || Object.getPrototypeOf(input)!==Object.prototype ||
     Object.keys(input).some(key=>![
       "articulating","seed","target","maxReactions","maxCandidates","maxWordLength",
     ].includes(key)) ||
     Array.isArray(input.articulating))
    throw new TypeError("source Mark reactions require a genuine Articulating, seed and target only");

  const maxReactions=input.maxReactions??5;
  const maxCandidates=input.maxCandidates??512;
  const maxWordLength=input.maxWordLength??32;
  if(!Number.isSafeInteger(maxReactions)||maxReactions<0||maxReactions>6||
     !Number.isSafeInteger(maxCandidates)||maxCandidates<1||maxCandidates>4096||
     !Number.isSafeInteger(maxWordLength)||maxWordLength<1||maxWordLength>64)
    throw new RangeError("source reaction budgets require 0..6 steps, 1..4096 candidates and 1..64 Mark occurrences");

  const substrate=spectrumOfMarkSubstitution(input.articulating);
  if(substrate.source.kind!=="native-articulating-trace")
    throw new TypeError("source reaction requires original performed Articulating");
  const alphabet=substrate.source.alphabetMarkIds;
  const index=new Map(alphabet.map((id,i)=>[id,i]));
  const word=(marks,label)=>{
    if(!Array.isArray(marks)||marks.length>maxWordLength)
      throw new RangeError(label+" must be a bounded list of original Mark presentations");
    return freeze(marks.map(markValue=>{
      if(!isMark(markValue))throw new TypeError(label+" must contain original SignCell Marks");
      const id=semanticId(markValue);
      if(!index.has(id))
        throw new TypeError(label+" includes a Mark that has no original source rule");
      return id;
    }));
  };
  const seed=word(input.seed,"seed");
  const target=word(input.target,"target");
  const sourceId=substrate.source.articulatingId;
  const readoutAddress=ids=>semanticId(["mark-reaction-word/v1",sourceId,ids]);
  const matches=ids=>ids.length===target.length&&ids.every((v,i)=>v===target[i]);
  const root=freeze({
    kind:"signgraph.sourceMarkReactionPath/v1",
    pathAddress:semanticId(["mark-reaction-root/v1",sourceId,seed]),
    wordAddress:readoutAddress(seed),
    word:seed,depth:0,steps:freeze([]),
  });
  const candidates=[root], collisions=new Map([[root.wordAddress,[root.pathAddress]]]);
  const countProjection=(candidate)=>{
    if(!collisions.has(candidate.wordAddress))collisions.set(candidate.wordAddress,[]);
    collisions.get(candidate.wordAddress).push(candidate.pathAddress);
  };
  const losses=()=>freeze([...collisions.entries()]
    .filter(([,routes])=>routes.length>1)
    .map(([wordAddress,routes])=>freeze({
      wordAddress,pathAddresses:freeze(routes),
    })));
  const stats=()=>freeze({
    visitedSourcePaths:candidates.length,
    distinctWordReadouts:collisions.size,
    pathsLostByWordProjection:candidates.length-collisions.size,
    capacity:maxCandidates,
    maxDepth:maxReactions,
  });
  const result=(status,depth,matched=[],obstructions=[])=>freeze({
    kind:"signgraph.sourceMarkReactionSelection/v1",status,
    source:substrate.source,
    seed, target, minimalSourceReactions:status==="selected"?depth:null,
    selected:freeze(matched),
    candidates:freeze(candidates),
    projectionCollisions:losses(),
    obstructions:freeze(obstructions),
    work:stats(),
    scope:"finite actual Articulating-derived Mark rewrite paths; external target is a requirement, not a source of rules or a physical/biological fitness proof",
  });

  const words=substrate.words;
  let frontier=[root];
  const obstructions=[];
  for(let depth=0;depth<=maxReactions;depth++) {
    const matched=frontier.filter(candidate=>matches(candidate.word));
    if(matched.length)return result("selected",depth,matched,obstructions);
    if(depth===maxReactions)return result("depth-limited",depth,[],obstructions);
    const next=[];
    for(const candidate of frontier) {
      for(let at=0;at<candidate.word.length;at++) {
        const ruleIndex=index.get(candidate.word[at]);
        const rule=words[ruleIndex];
        const successorLength=candidate.word.length-1+rule.length;
        if(successorLength>maxWordLength){
          obstructions.push(freeze({
            reason:"source-reaction-exceeds-word-budget",
            parentPathAddress:candidate.pathAddress,
            atPosition:at,requiredLength:successorLength,maxWordLength,
          }));
          continue;
        }
        // Preserve exact ordered Mark occurrences; a multiset would erase
        // which occurrence was rewritten, and later paths can converge.
        const successor=freeze([
          ...candidate.word.slice(0,at),
          ...rule.map(i=>alphabet[i]),
          ...candidate.word.slice(at+1),
        ]);
        const nextAddress=readoutAddress(successor);
        const originalUtteranceId=substrate.source.utteranceIds[ruleIndex];
        const reaction=freeze({
          kind:"signgraph.sourceMarkReactionStep/v1",
          sourceUtteranceId:originalUtteranceId,
          ruleMarkAddress:alphabet[ruleIndex],
          atPosition:at,fromWordAddress:candidate.wordAddress,
          toWordAddress:nextAddress,parentPathAddress:candidate.pathAddress,
        });
        const address=semanticId(["mark-reaction-step/v1",sourceId,reaction]);
        const successorSteps=freeze([...candidate.steps,freeze({...reaction,address})]);
        const following=freeze({
          kind:"signgraph.sourceMarkReactionPath/v1",
          pathAddress:semanticId(["mark-reaction-path/v1",sourceId,root.pathAddress,
            successorSteps.map(step=>step.address)]),
          wordAddress:nextAddress,word:successor,
          depth:depth+1,steps:successorSteps,
        });
        // Never claim a partial frontier has a selected globally minimal
        // path, and NEVER merge coincident words from distinct paths.
        if(candidates.length>=maxCandidates){
          return result("candidate-capacity-obstructed",depth+1,[],[
            ...obstructions,freeze({
              reason:"distinct-source-path-capacity-exceeded",
              parentPathAddress:candidate.pathAddress,atPosition:at,
              sourceUtteranceId:originalUtteranceId,
            }),
          ]);
        }
        candidates.push(following);
        countProjection(following);
        next.push(following);
      }
    }
    if(!next.length)
      return result(obstructions.length?"word-capacity-obstructed":"source-exhausted",
        depth+1,[],obstructions);
    frontier=next;
  }
  throw new Error("finite source-reaction iteration exceeded its own depth bound");
}

/**
 * FOUR-valued receiving of a SOURCE-GENERATED reaction product.
 *
 * `selectSourceMarkReactions` already creates ALL least-depth source-authorized
 * Mark-reaction paths, including distinct paths to the same final word.
 * Matching a requested word is only a syntactic search result, not accepted
 * service, an independently witnessed reaction, or physical computation.
 *
 * Each receiver's report is an original SignCell addressed to ONE exact
 * pathAddress and its wordAddress, under an explicitly declared predicate.
 * These are only evidence reports; the caller must qualify provenance,
 * actual rights, physical transduction and observer independence separately.
 *
 * Never infer a positive output from an absent, contradicted, or unmeasured
 * report. Do not memoize by final Mark word: two path addresses may differ
 * even when their final word readouts coincide.
 *
 * The original Articulating, Mark rules and bounded selector remain the only
 * generator. Neither reports nor the receiver predicate introduce rewrite
 * rules. This is a non-Boolean readout ON a finite Turing-simulable engine;
 * it is not a hypercomputer, a physical chemistry, or a new Actor authority.
 */
export function receiveSourceMarkReactions(input) {
  const allowed=new Set([
    "articulating","seed","target","maxReactions","maxCandidates","maxWordLength",
    "receipts","acceptancePredicate"
  ]);
  if(!input||Object.getPrototypeOf(input)!==Object.prototype||
      Object.keys(input).some(key=>!allowed.has(key)))
    throw new TypeError("source reaction receiving requires only native reaction inputs and receipt evidence");
  const predicate=input.acceptancePredicate;
  if(typeof predicate!=="string"||!predicate.trim()||predicate.length>256)
    throw new TypeError("source reaction receiving requires a declared nonempty acceptance predicate");
  const submitted=input.receipts??[];
  if(!Array.isArray(submitted)||submitted.length>1024)
    throw new RangeError("source reaction receiving requires 0..1024 SignCell reports");

  // Recompute the actual original finite source generation. No caller-supplied
  // 'selected' result can smuggle in synthetic paths or a borrowed proof.
  const selection=selectSourceMarkReactions({
    articulating:input.articulating,seed:input.seed,target:input.target,
    maxReactions:input.maxReactions,maxCandidates:input.maxCandidates,
    maxWordLength:input.maxWordLength
  });
  const eligible=new Map(selection.selected.map(path=>[path.pathAddress,path]));
  const byPath=new Map(selection.selected.map(path=>[path.pathAddress,[]]));
  for(const report of submitted) {
    const original=admitCell(report);
    if(!measured(original))
      throw new TypeError("source reaction report must be measured from its evidence, not a contradictory written value");
    const matched=eligible.get(original.subject);
    if(!matched||original.predicate!==predicate||original.object!==matched.wordAddress)
      throw new TypeError("source reaction report is foreign, non-selected or bound to the wrong path/readout");
    byPath.get(original.subject).push(original);
  }

  const evaluations=freeze(selection.selected.map(path=>{
    const observations=freeze(byPath.get(path.pathAddress));
    const merged=cellSet(observations);
    // All received reports share exactly one original (path,predicate,word)
    // triple; cellSet uses the original Cell knowledge join of witness sides.
    if(merged.length>1)
      throw new TypeError("source reaction reports must be one addressed observation coordinate");
    const evidence=merged[0]??null;
    const reading=evidence===null?"absurd":presence(evidence);
    const tally=evidence===null?freeze({pos:0,neg:0}):recordOf(evidence);
    const status=reading==="potential"?"supported":
       reading==="active"?"opposed":
       reading==="stable"?"contested":"unobserved";
    return freeze({
      pathAddress:path.pathAddress,
      wordAddress:path.wordAddress,
      sourceSteps:path.steps,
      status,reading,
      evidence,observations,record:tally,
      // Counts are number of distinct witness representations after the
      // SignCell merge, NOT authenticated independent Actors or payments.
      scope:"source-reported evidence only; no independent ACK, signed identity or physical proof"
    });
  }));
  const statuses=evaluations.map(e=>e.status);
  const status=selection.status!=="selected"?"search-obstructed":
    statuses.includes("supported")?"has-reported-support":
    statuses.includes("contested")?"contested":
    statuses.length>0&&statuses.every(s=>s==="opposed")?"opposed":"unobserved";
  return freeze({
    kind:"signgraph.sourceMarkReactionReceiving/v1",
    status,acceptancePredicate:predicate,
    selection,evaluations,
    scope:"Articulating-derived finite non-Boolean receiving; target match and unopposed report never imply physical reaction, usable work, authenticated observer, abiogenesis or super-Turing power"
  });
}

