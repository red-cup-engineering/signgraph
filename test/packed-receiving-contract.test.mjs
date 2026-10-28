import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { qualifyPackedRegistry, declaredRegistryScopes, configuredRegistryScopes } from '../scripts/qualify-packed-registry.mjs';

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
test('a packaged test module that registers zero tests must refuse instead of counting the file wrapper',t=>{
  const {status,receipt}=execution(t, f=>{
    // Node's native --test runner reports the file itself as one green
    // subtest when the file registers no node:test case at all.
    writeFileSync(join(f.root,'test','ping.test.mjs'),
      '// This module intentionally registers no node:test test or suite.\nexport const ignored = 42;\n');
  },'');
  assert.equal(status,1);
  assert.equal(receipt.stage,'archive-native-tests');
  assert.match(receipt.obstruction,/no registered test cases/);
});


// This boundary is materially different from forwarding npm's default registry.
// A project may resolve the same package name/version from its scoped provider
// while an emitted package silently falls back to a different provider.
test('declared scoped registry remains source-qualified in the emitted receiver', t => {
  const root = mkdtempSync(join(tmpdir(), 'signgraph-scoped-registry-'));
  t.after(() => rmSync(root, {recursive:true, force:true}));
  const source = join(root, 'source'), packed = join(root, 'packed');
  mkdirSync(source); mkdirSync(packed);
  writeFileSync(join(source, '.npmrc'),
    'registry=https://default.invalid/root/\n' +
    '@red-cup-engineering:registry=https://scoped.invalid/house/\n');
  const clear = {...process.env};
  for (const key of ['npm_config_registry', 'NPM_CONFIG_REGISTRY',
    'npm_config_@red-cup-engineering:registry', 'NPM_CONFIG_@red-cup-engineering:registry'])
    delete clear[key];
  const read = (cwd, extra = {}, name = 'registry') => {
    const result = spawnSync('npm', ['config', 'get', name], {
      cwd, encoding:'utf8', timeout:20000, env:{...clear, ...extra},
    });
    assert.equal(result.status, 0, String(result.stderr || result.error));
    return result.stdout.trim();
  };
  const scopes = declaredRegistryScopes({dependencies:{
    '@red-cup-engineering/receipt-probe':'1.0.0'
  }, devDependencies:{other:'npm:@other-scope/lib@1.0.0'}});
  assert.deepEqual(scopes, ['@other-scope', '@red-cup-engineering']);
  const handoff = qualifyPackedRegistry(read, {source, packed,
    scopes:['@red-cup-engineering']});
  const key = 'npm_config_@red-cup-engineering:registry';
  assert.equal(handoff.environment[key], 'https://scoped.invalid/house/');
  assert.equal(read(packed, handoff.environment, '@red-cup-engineering:registry'),
    'https://scoped.invalid/house/');
  assert.equal(read(packed, handoff.environment, 'registry'),
    'https://default.invalid/root/');
  assert.throws(() => qualifyPackedRegistry(
    (cwd, extra = {}, name = 'registry') =>
      cwd === packed && name === '@red-cup-engineering:registry'
        ? 'https://substituted.invalid/' : read(cwd, extra, name),
    {source, packed, scopes:['@red-cup-engineering']}),
    /scope registry differs/);
  assert.throws(() => qualifyPackedRegistry(
    (cwd, extra = {}, name = 'registry') =>
      cwd === source && name === '@red-cup-engineering:registry'
        ? 'https://user:password@scoped.invalid/' : read(cwd, extra, name),
    {source, packed, scopes:['@red-cup-engineering']}), TypeError);
});


test('effective source-configured transitive-only registry cannot be lost in packed npm receiving', t => {
  const root = mkdtempSync(join(tmpdir(), 'signgraph-transitive-registry-'));
  t.after(() => rmSync(root, {recursive:true, force:true}));
  const source = join(root, 'source'), packed = join(root, 'packed');
  mkdirSync(source); mkdirSync(packed);
  const initial = 'registry=https://default.invalid/root/\n' +
    '@red-cup-engineering:registry=https://scoped.invalid/house/\n' +
    '@sg-transitive-only:registry=https://transitive.invalid/house/\n';
  writeFileSync(join(source, '.npmrc'), initial);
  const clean = {...process.env};
  for (const key of Object.keys(clean))
    if (key.toLowerCase().startsWith('npm_config_')) delete clean[key];
  const npm = (cwd, args, extra={}) => {
    const result = spawnSync('npm', args, {
      cwd, encoding:'utf8', timeout:20000, env:{...clean, ...extra},
    });
    assert.equal(result.status, 0, String(result.stderr || result.error));
    return result.stdout.trim();
  };
  const read = (cwd, extra={}, key='registry') => npm(cwd, ['config', 'get', key], extra);
  const declared = declaredRegistryScopes({dependencies:{
    '@red-cup-engineering/direct':'1.0.0',
  }});
  assert(!declared.includes('@sg-transitive-only'));
  // npm config ls --json silently omits protected scoped registry keys.
  // npm config ls exposes their names without forwarding any values.
  const configured = configuredRegistryScopes(npm(source, ['config', 'ls']));
  assert(configured.includes('@sg-transitive-only'));
  const scopes = [...new Set([...declared, ...configured])].sort();
  assert.equal(read(packed, {}, '@sg-transitive-only:registry'), 'undefined');
  const handoff = qualifyPackedRegistry(read, {source, packed, scopes});
  assert.equal(handoff.environment['npm_config_@sg-transitive-only:registry'],
    'https://transitive.invalid/house/');
  assert.equal(read(packed, handoff.environment, '@sg-transitive-only:registry'),
    read(source, {}, '@sg-transitive-only:registry'));
  assert.throws(() => qualifyPackedRegistry(
    (cwd, extra={}, key='registry') => cwd === packed && key === '@sg-transitive-only:registry'
      ? 'https://imposter.invalid/' : read(cwd, extra, key),
    {source, packed, scopes}), /scope registry differs/);
  writeFileSync(join(source, '.npmrc'), initial.replace('https://transitive.invalid/house/', 'http://transitive.invalid/house/'));
  assert.throws(() => qualifyPackedRegistry(read, {source, packed, scopes}), /credential-free HTTPS/);
  // A protected credentialed registry can be omitted by npm --json; a plain
  // listing still names its scope, forcing fail-closed npm config get.
  writeFileSync(join(source, '.npmrc'), initial.replace('https://transitive.invalid/house/', 'https://user:secret@transitive.invalid/house/'));
  assert(configuredRegistryScopes(npm(source, ['config', 'ls'])).includes('@sg-transitive-only'));
  assert.throws(() => qualifyPackedRegistry(read, {source, packed, scopes}));
  assert.throws(() => configuredRegistryScopes('@invalid/scope:registry = "https://bad.invalid/"'),
    TypeError);
});
