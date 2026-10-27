/**
 * An intentionally CONDITIONAL finite model: source-occurrence labels in this
 * fixture are test witnesses, not certified performed Obsmetrologia acts.
 *
 * Run:
 *   node examples/keratin-hole-workbench.mjs          # exact JSON diagnosis
 *   node examples/keratin-hole-workbench.mjs --dot | dot -Tsvg > keratin-hole.svg
 */
import {
  keratinPositionKey,keratinGraphOfPredications,analyzeKeratinGraph,
  keratinGraphToDot,keratinLinearSheaf,
} from '../src/keratin-graph.mjs';

const role = performed => ({performed,side:'token',display:performed});
const incident = (occurrence,subject,predicate,object) => ({
  occurrence,sourceRecord:`fixture:act:${occurrence}`,
  cell:{subject:role(subject),predicate,object:role(object)},
});
const source = [
  incident('root/left','root','continues','left'),
  incident('root/right','root','continues','right'),
  incident('left/right','left','touches','right'),
];
const id=performed=>keratinPositionKey(performed);
const boundary=[
  {occurrence:'root/left',direction:1},
  {occurrence:'left/right',direction:1},
  {occurrence:'root/right',direction:-1},
];
const graph=keratinGraphOfPredications({
  source,selectors:{axialPredicate:'continues',transversePredicate:'touches'},
  stalks:['root','left','right'].map(x=>({position:id(x),states:['0','1']})),
  contacts:[
    {occurrence:'root/left',allowed:[['0','0'],['1','1']]},
    {occurrence:'root/right',allowed:[['0','0'],['1','1']]},
    {occurrence:'left/right',allowed:[['0','1'],['1','0']]},
  ],
  holes:[{id:'missing-contact-disc',sourceRecord:'fixture:unfilled',boundary}],
  observers:[{id:'limited-observer',visiblePositions:[id('root'),id('left')],visibleOccurrences:['root/left']}],
});
const diagnostic=analyzeKeratinGraph(graph);
// This *linear* sheaf is a separate numerical measurement. It does NOT
// impose the binary contact constraints of the finite set-valued model.
const linear=keratinLinearSheaf(graph,{
  vertexStalks:graph.feather.positions.map(p=>({position:p.key,dim:1})),
  relationStalks:graph.feather.predications.map(p=>({
    occurrence:p.occurrence,dim:1,restrict:{from:[[1]],to:[[1]]},
  })),
});
if(process.argv.includes('--dot'))process.stdout.write(keratinGraphToDot(graph,diagnostic));
else process.stdout.write(JSON.stringify({
  model:graph.kind,
  fork:graph.feather.forks[0],
  actualComplexBetti:diagnostic.actualComplexBetti,
  sheafH0:linear.cohomology.h0,
  graphSheafH1:linear.cohomology.h1,
  finiteGlobalSectionCount:diagnostic.sectionCount,
  unsatisfiableSourceContacts:diagnostic.unsatisfiableContactCore,
  candidateHoles:diagnostic.candidateHoles.map(h=>({id:h.id,reading:h.reading})),
  observer:diagnostic.observers[0],
  caution:diagnostic.qualification,
},null,2)+'\n');
