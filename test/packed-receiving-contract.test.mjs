import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// This is a consumer test of the ORIGINAL receiver executable using real npm
// tarballs, not a mock inventory or substitute JS test runner. The fixture has
// zero external dependencies and does not represent SignGraph qualification.
const verifier = new URL('../scripts/verify-packed-receiving.mjs', import.meta.url);
const cleanManifest = () => ({
  name: '@test/signgraph-receiving-contract', version: '0.0.1', type: 'module',
  files: ['src', 'test/ping.test.mjs'],
  exports: {'./answer': './src/answer.mjs'},
  receivingTests: ['test/ping.test.mjs'],
  scripts: {'test:ping': 'node --test test/ping.test.mjs'},
});
const makeFixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'signgraph-receiver-contract-'));
  mkdirSync(join(root, 'src'));
  mkdirSync(join(root, 'test'));
  writeFileSync(join(root, 'src', 'answer.mjs'), 'export const answer = 42;\n');
  writeFileSync(join(root, 'test', 'ping.test.mjs'),
    `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {answer} from '../src/answer.mjs';\ntest('exact packaged source',()=>assert.equal(answer,42));\n`);
  const manifest = cleanManifest();
  const save = () => writeFileSync(join(root, 'package.json'), JSON.stringify(manifest));
  save();
  return {root, manifest, save};
};
function execution(t, mutate, mode='--inventory-only') {
  const fixture = makeFixture();
  t.after(() => rmSync(fixture.root, {recursive:true, force:true}));
  mutate?.(fixture);
  fixture.save();
  const result = spawnSync(process.execPath, [fileURLToPath(verifier), ...(mode ? [mode] : [])], {
    cwd: fixture.root, encoding: 'utf8', maxBuffer: 1024*1024,
    timeout: 60000,
    env:{...process.env, SIGNGRAPH_SOURCE_ROOT:fixture.root, npm_config_update_notifier:'false'},
  });
  assert.ifError(result.error);
  const source = result.status === 0 ? result.stdout : result.stderr;
  assert(source.trim(), 'a checked result must include a native receipt');
  const receipt = JSON.parse(source.trim().split('\n').at(-1));
  assert.equal(receipt.kind, 'signgraph.packed-receiving.v1');
  return {status:result.status, receipt};
}
test('real emitted npm archive has exact receiver bytes and source manifest, without claiming installation',t=>{
  const {status,receipt}=execution(t);
  assert.equal(status,0);
  assert.equal(receipt.result,'inventory-qualified-only');
  assert.equal(receipt.inventory,'passed');
  assert.equal(receipt.sourceToArchiveBytes,'matched');
  assert.equal(receipt.declaredReceivingTests,1);
  assert.match(receipt.archiveSha256,/^[0-9a-f]{64}$/);
  assert.equal(receipt.nativeReceivingTests,undefined,'inventory-only cannot qualify native tests');
});
test('native node:test executes the actual unpacked emitted npm archive',t=>{
  const {status,receipt}=execution(t,undefined,'');
  assert.equal(status,0);
  assert.equal(receipt.result,'packed-tests-passed-not-installed');
  assert.equal(receipt.nativeReceivingTests,1);
  assert.equal(receipt.nativeReceivingCases,1);
  assert.deepEqual(receipt.executedTestFiles,[{file:'test/ping.test.mjs',passed:1}]);
  assert.equal(receipt.tests,'passed');
  assert.equal(receipt.sourceToArchiveBytes,'matched');
});
test('missing files enrollment refuses before a passing source test can impersonate receiving',t=>{
  const {status,receipt}=execution(t, f=>{f.manifest.files=['src'];});
  assert.equal(status,1);
  assert.equal(receipt.stage,'preflight');
  assert.match(receipt.obstruction,/not selected for packing/);
});
test('duplicate declared receiver refuses before pack',t=>{
  const {status,receipt}=execution(t, f=>{f.manifest.receivingTests.push('test/ping.test.mjs');});
  assert.equal(status,1);
  assert.equal(receipt.stage,'preflight');
  assert.match(receipt.obstruction,/unique safe receiving tests/);
});
test('missing exported module refuses actual emitted archive inventory',t=>{
  const {status,receipt}=execution(t, f=>{f.manifest.exports['./answer']='./src/absent.mjs';});
  assert.equal(status,1);
  assert.equal(receipt.stage,'archive-inventory');
  assert.match(receipt.obstruction,/export absent from emitted archive/);
  assert.match(receipt.archiveSha256,/^[0-9a-f]{64}$/);
});
test('failed native test is a refusal, not an archive acceptance',t=>{
  const {status,receipt}=execution(t, f=>{
    const path=join(f.root,'test','ping.test.mjs');
    const modified=readFileSync(path,'utf8').replace('answer,42','answer,99');
    assert.match(modified,/answer,99/);
    writeFileSync(path,modified);
  },'');
  assert.equal(status,1);
  assert.equal(receipt.stage,'archive-native-tests');
  assert.equal(receipt.inventory,'passed');
  assert.equal(receipt.sourceToArchiveBytes,'matched');
  assert.match(receipt.obstruction,/failed/);
});
test('conditional import export missing from archive MUST refuse, even when unrelated tests pass',t=>{
  const {status,receipt}=execution(t, f=>{
    f.manifest.exports['./answer']={import:'./src/absent.mjs',default:'./src/answer.mjs'};
  },'');
  assert.equal(status,1);
  assert.equal(receipt.stage,'archive-inventory');
  assert.match(receipt.obstruction,/export absent from emitted archive/);
});
test('valid nested conditional exports and null-blocked subpaths receive all available targets',t=>{
  const {status,receipt}=execution(t, f=>{
    f.manifest.exports={
      './answer': {node: {import:'./src/answer.mjs',default:'./src/answer.mjs'}},
      './blocked': null,
    };
  },'');
  assert.equal(status,0);
  assert.equal(receipt.result,'packed-tests-passed-not-installed');
  assert.equal(receipt.checkedExportTargets,1);
  assert.equal(receipt.sourceToArchiveFiles,3);
  assert.equal(receipt.nativeReceivingCases,1);
});
test('fallback export array cannot conceal an absent candidate behind a working candidate',t=>{
  const {status,receipt}=execution(t, f=>{
    f.manifest.exports['./answer']={import:['./src/answer.mjs','./src/absent.mjs']};
  });
  assert.equal(status,1);
  assert.equal(receipt.stage,'archive-inventory');
  assert.match(receipt.obstruction,/export absent from emitted archive/);
});
test('export patterns require separate coverage rather than silently qualifying unenumerated consumers',t=>{
  const {status,receipt}=execution(t, f=>{
    f.manifest.exports={'./*':'./src/*.mjs'};
  });
  assert.equal(status,1);
  assert.equal(receipt.stage,'archive-inventory');
  assert.match(receipt.obstruction,/unqualified package export pattern/);
});
test('unsafe path traversal in export is refused without treating it as a packed target',t=>{
  const {status,receipt}=execution(t, f=>{
    f.manifest.exports['./answer']='./src/../answer.mjs';
  });
  assert.equal(status,1);
  assert.equal(receipt.stage,'archive-inventory');
  assert.match(receipt.obstruction,/unsafe or unqualified package export target/);
});
