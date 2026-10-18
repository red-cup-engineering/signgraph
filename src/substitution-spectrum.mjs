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
import { semanticId } from "@red-cup-engineering/semiotic-content-address";
import { charPoly, fromInts, toInt } from "@red-cup-engineering/exact-number-data-service/exact-number";
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
