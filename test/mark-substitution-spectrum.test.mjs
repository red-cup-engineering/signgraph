import test from "node:test";
import assert from "node:assert/strict";
import { mark } from "@red-cup-engineering/signcell/mark";
import { utterance, articulatingUtter, articulatingPair } from "@red-cup-engineering/signcell/utterance";
import { spectrumOfMarkSubstitution, selectSourceMarkReactions } from "../src/substitution-spectrum.mjs";

const a=mark("a"),b=mark("b"),c=mark("c");
const fib=()=>[
  utterance(a,[a,b]),utterance(b,[a]),
];
const padovan=()=>[
  utterance(a,[b]),utterance(b,[c]),utterance(c,[a,b]),
];
const tribonacci=()=>[
  utterance(a,[a,b]),utterance(b,[a,c]),utterance(c,[a]),
];

test("Fibonacci follows its actual Mark-word substitution, not an assumed growth number",()=>{
  const result=spectrumOfMarkSubstitution(fib());
  assert.equal(result.status,"derived");
  assert.equal(result.substitution.alphabetSize,2);
  assert.deepEqual([result.adjacencyGraph.vertices,result.adjacencyGraph.edges,result.adjacencyGraph.graphH1],[2,3,2]);
  assert.deepEqual(result.substitution.matrix,[[1,1],[1,0]]);
  assert.deepEqual(result.substitution.characteristicPolynomialDescending,[1,-1,-1]);
  assert.equal(result.substitution.polynomialDegree,2);
  assert.equal(result.chu.r.length,4);
});

test("Padovan and Tribonacci are different source relations despite both having three letters",()=>{
  const pad=spectrumOfMarkSubstitution(padovan());
  const trib=spectrumOfMarkSubstitution(tribonacci());
  assert.equal(pad.substitution.alphabetSize,3);
  assert.equal(trib.substitution.alphabetSize,3);
  assert.deepEqual(pad.substitution.matrix,[[0,1,0],[0,0,1],[1,1,0]]);
  assert.equal(pad.adjacencyGraph.graphH1,2);
  assert.equal(pad.adjacencyGraph.vertices,3);
  assert.equal(pad.adjacencyGraph.graphH1!==pad.substitution.alphabetSize,true,
    "an actual primitive Padovan substitution has graph-H1 2, not automatically 3");
  assert.deepEqual(trib.substitution.matrix,[[1,1,0],[1,0,1],[1,0,0]]);
  assert.equal(trib.adjacencyGraph.graphH1,3);
  assert.notEqual(pad.adjacencyGraph.graphH1,trib.adjacencyGraph.graphH1);
  assert.deepEqual(pad.substitution.characteristicPolynomialDescending,[1,0,-1,-1]);
  assert.deepEqual(trib.substitution.characteristicPolynomialDescending,[1,-1,-1,-1]);
  assert.notDeepEqual(pad.substitution.matrix,trib.substitution.matrix);
  assert.notDeepEqual(pad.chu.r,trib.chu.r);
  assert.match(pad.scope,/no minimal-polynomial, Pisot, transfinite/);
});

test("FOUR positive-incidence is a lossy shadow, never the substitution's whole word",()=>{
  const u=[
    utterance(a,[a,b,a]),
    utterance(b,[b]),
  ];
  const actual=spectrumOfMarkSubstitution(u);
  assert.deepEqual(actual.substitution.matrix,[[2,1],[0,1]]);
  assert.equal(actual.adjacencyGraph.graphH1,3);
  assert.deepEqual(actual.substitution.characteristicPolynomialDescending,[1,-3,2]);
  assert.deepEqual(actual.informationLoss.multipleSymbolEntries,[{i:0,j:0,count:2}]);
  assert.equal(actual.chu.r[0].reading,"potential");
  assert.equal(actual.chu.r[1].reading,"potential");
  const permuted=spectrumOfMarkSubstitution([utterance(a,[a,a,b]),utterance(b,[b])]);
  assert.deepEqual(actual.substitution.matrix,permuted.substitution.matrix);
  assert.notDeepEqual(actual.source.utteranceIds,permuted.source.utteranceIds,
    "word order survives in the source even after abelianization loses it");
});

test("foreign Mark claims and duplicate alphabet presentations cannot silently form a typed rule",()=>{
  assert.throws(()=>spectrumOfMarkSubstitution([utterance(a,[c])]),/known original Mark/);
  assert.throws(()=>spectrumOfMarkSubstitution([utterance(a,[a]),utterance(a,[a])]),/duplicate original presentations/);
  assert.throws(()=>spectrumOfMarkSubstitution([utterance(a,["a"])]),/known original Mark/);
  assert.throws(()=>spectrumOfMarkSubstitution([{token:"a",claim:"b"}]),/original SignCell Utterance/);
});

test("the original source is retained without assigning physical dimensions or aperiodicity",()=>{
  const source=padovan();
  const prior=JSON.stringify(source);
  const built=spectrumOfMarkSubstitution(source);
  assert.equal(JSON.stringify(source),prior);
  assert.equal(built.source.utteranceIds.length,3);
  assert.equal(built.source.alphabetMarkIds.length,3);
  assert.equal(built.informationLoss.claim.includes("word order"),true);
  assert.equal(Object.hasOwn(built,"eigenvalues"),false);
  assert.equal(Object.hasOwn(built,"closureRegime"),false);
  assert.equal(Object.hasOwn(built,"cohomologyRank"),false);
});


test("Padovan recurrence matrix really descends from a native Mark→Articulating source",()=>{
  const original=padovan();
  let carrier=articulatingUtter(original[0]);
  carrier=articulatingPair(original[1],carrier);
  carrier=articulatingPair(original[2],carrier);
  const prior=JSON.stringify(carrier);
  const fromSource=spectrumOfMarkSubstitution(carrier);
  const fromList=spectrumOfMarkSubstitution(original);
  assert.equal(fromSource.source.kind,"native-articulating-trace");
  assert.equal(fromList.source.kind,"original-utterance-list-presentation");
  assert.deepEqual(fromSource.source.finiteSourceOrdinal,
    {kind:"finite-successor",length:3,pairMoves:2});
  assert.equal(typeof fromSource.source.articulatingId,"string");
  assert.deepEqual(fromSource.words,fromList.words);
  assert.deepEqual(fromSource.substitution,fromList.substitution);
  assert.deepEqual(fromSource.chu,fromList.chu);
  assert.deepEqual(fromSource.adjacencyGraph,fromList.adjacencyGraph);
  assert.deepEqual(fromSource.substitution.characteristicPolynomialDescending,[1,0,-1,-1]);
  assert.equal(JSON.stringify(carrier),prior);
});

test("an Articulating substitution is not secretly a free list of additional laws",()=>{
  const source=articulatingPair(utterance(b,[a]),articulatingUtter(utterance(a,[a,b])));
  assert.equal(spectrumOfMarkSubstitution(source).substitution.alphabetSize,2);
  assert.throws(()=>spectrumOfMarkSubstitution({
    kind:"articulating.pair",utterance:utterance(a,[a]),articulating:{kind:"alien"},
  }),/finite and acyclic|native ordered Mark roles/);
});


const nativeRules=(utterances)=>{
  let a=articulatingUtter(utterances[0]);
  for(const u of utterances.slice(1))a=articulatingPair(u,a);
  return a;
};

test("a real Mark rule firing produces the minimum target word without manufacturing mutations",()=>{
  const original=nativeRules(fib());
  const root=JSON.stringify(original);
  const selected=selectSourceMarkReactions({
    articulating:original,seed:[a],target:[a,b],maxReactions:3,
  });
  assert.equal(selected.status,"selected");
  assert.equal(selected.minimalSourceReactions,1);
  assert.equal(selected.selected.length,1);
  assert.equal(selected.selected[0].steps.length,1);
  const spectrum=spectrumOfMarkSubstitution(original);
  assert.equal(selected.selected[0].steps[0].sourceUtteranceId,spectrum.source.utteranceIds[0]);
  assert.deepEqual(selected.selected[0].word,[spectrum.source.alphabetMarkIds[0],spectrum.source.alphabetMarkIds[1]]);
  assert.equal(selected.work.visitedSourcePaths,2);
  assert.equal(JSON.stringify(original),root);
});

test("two source-distinct rewrite histories to one Mark word remain separate selection winners",()=>{
  const source=nativeRules([utterance(a,[a,a]),utterance(b,[b,b])]);
  const r=selectSourceMarkReactions({articulating:source,seed:[a,b],target:[a,a,b,b],maxReactions:2});
  assert.equal(r.status,"selected");
  assert.equal(r.minimalSourceReactions,2);
  assert.equal(r.selected.length,2);
  const [first,second]=r.selected;
  assert.equal(first.wordAddress,second.wordAddress);
  assert.notEqual(first.pathAddress,second.pathAddress);
  assert.notDeepEqual(first.steps.map(step=>step.atPosition),second.steps.map(step=>step.atPosition));
  assert(r.projectionCollisions.some(c=>c.wordAddress===first.wordAddress &&
    c.pathAddresses.length===2),"forgetting reaction paths loses two different performances");
  assert(r.work.pathsLostByWordProjection>=1);
  assert(Object.isFrozen(r));
  assert(Object.isFrozen(first.steps));
});

test("a source identity rewrite performs a distinct event without pretending the word changed",()=>{
  const source=nativeRules([utterance(a,[a]),utterance(b,[b])]);
  const r=selectSourceMarkReactions({articulating:source,seed:[a],target:[b],maxReactions:2});
  assert.equal(r.status,"depth-limited");
  assert.equal(r.work.visitedSourcePaths,3);
  assert.equal(r.work.distinctWordReadouts,1);
  assert.equal(r.work.pathsLostByWordProjection,2);
  assert.equal(r.projectionCollisions.length,1);
  assert.equal(r.projectionCollisions[0].pathAddresses.length,3);
});

test("an original source deletion rewrites to an empty molecule with its exact source lineage",()=>{
  const source=nativeRules([utterance(a,[])]);
  const r=selectSourceMarkReactions({articulating:source,seed:[a],target:[],maxReactions:3});
  assert.equal(r.status,"selected");
  assert.equal(r.minimalSourceReactions,1);
  assert.deepEqual(r.selected[0].word,[]);
  const none=selectSourceMarkReactions({articulating:source,seed:[],target:[a],maxReactions:3});
  assert.equal(none.status,"source-exhausted");
  assert.equal(none.selected.length,0);
});

test("bounded truncation cannot be misreported as an unreachable or minimal solution",()=>{
  const source=nativeRules([utterance(a,[a,a]),utterance(b,[b,b])]);
  const budget=selectSourceMarkReactions({
    articulating:source,seed:[a,b],target:[a,a,b,b],maxReactions:2,maxCandidates:2,
  });
  assert.equal(budget.status,"candidate-capacity-obstructed");
  assert.equal(budget.minimalSourceReactions,null);
  assert.equal(budget.selected.length,0);
  assert(budget.obstructions.some(o=>o.reason==="distinct-source-path-capacity-exceeded"));
  const long=selectSourceMarkReactions({
    articulating:source,seed:[a],target:[],maxReactions:3,maxWordLength:1,
  });
  assert.equal(long.status,"word-capacity-obstructed");
  assert(long.obstructions.some(o=>o.reason==="source-reaction-exceeds-word-budget"));
  assert.equal(long.selected.length,0);
  const zero=selectSourceMarkReactions({
    articulating:source,seed:[a],target:[a],maxReactions:0,
  });
  assert.equal(zero.status,"selected");
  assert.equal(zero.minimalSourceReactions,0);
});

test("an invented rule, foreign Mark or synthetic category cannot enter the native reaction space",()=>{
  const source=nativeRules(fib());
  assert.throws(()=>selectSourceMarkReactions({articulating:fib(),seed:[a],target:[a,b]}),
    /genuine Articulating/);
  assert.throws(()=>selectSourceMarkReactions({articulating:source,seed:[c],target:[a]}),
    /no original source rule/);
  assert.throws(()=>selectSourceMarkReactions({articulating:source,seed:[a],target:[c]}),
    /no original source rule/);
  assert.throws(()=>selectSourceMarkReactions({articulating:source,seed:[a],target:[b],
    guessedMorphisms:[["A","B"]]}),/genuine Articulating, seed and target only/);
  assert.throws(()=>selectSourceMarkReactions({articulating:source,seed:[a],target:[b],
    maxReactions:100}),/reaction budgets/);
});

test("finite selection agrees with independently enumerated one-occurrence reactions (147 cases)",()=>{
  const options=[[],["a"],["b"],["a","a"],["a","b"],["b","a"],["b","b"]];
  const markOf={a,b};
  const targets=[[],["a","b"],["b","b"]];
  const naive=(rules,target)=>{
    let layer=[["a"]];
    for(let depth=0;depth<=2;depth++){
      if(layer.some(word=>JSON.stringify(word)===JSON.stringify(target)))return depth;
      if(depth===2)return null;
      layer=layer.flatMap(word=>word.flatMap((name,i)=>{
        const image=rules[name];
        return [[...word.slice(0,i),...image,...word.slice(i+1)]];
      }));
    }
    return null;
  };
  let cases=0;
  for(const forA of options)for(const forB of options){
    const rules={a:forA,b:forB};
    const source=nativeRules([
      utterance(a,forA.map(x=>markOf[x])),
      utterance(b,forB.map(x=>markOf[x])),
    ]);
    for(const target of targets){
      const expected=naive(rules,target);
      const actual=selectSourceMarkReactions({
        articulating:source,seed:[a],target:target.map(x=>markOf[x]),
        maxReactions:2,maxCandidates:128,maxWordLength:8,
      });
      assert.equal(actual.minimalSourceReactions,expected,
        "original rule family="+JSON.stringify(rules)+" target="+JSON.stringify(target));
      if(expected===null)assert.notEqual(actual.status,"selected");
      else assert.equal(actual.status,"selected");
      cases++;
    }
  }
  assert.equal(cases,147);
});
