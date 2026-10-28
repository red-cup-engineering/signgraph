#!/usr/bin/env node
// SignGraph source-owned receiving: a passing source test is not a packed artifact test.
// No deployment, package publication, work acceptance, or observed resource flow follows.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const source = resolve(process.env.SIGNGRAPH_SOURCE_ROOT || process.cwd());
const inventoryOnly = process.argv.slice(2).includes('--inventory-only');
const receipt = { kind: 'signgraph.packed-receiving.v1', source, mode: inventoryOnly ? 'archive-only' : 'dependency-backed',
  stage: 'preflight', result: 'unverified' };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (command, args, cwd, maxMs = 600000) => {
  const p = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: maxMs,
    maxBuffer: 32 * 1024 * 1024, env: { ...process.env, npm_config_update_notifier: 'false' } });
  if (p.error || p.status !== 0) {
    const message = (p.stderr || p.stdout || p.error?.message || '').slice(-3000);
    throw new Error(`${command} ${args[0]} failed (${p.status ?? 'no-exit'}): ${message}`);
  }
  return p.stdout;
};
const filePath = id => typeof id === 'string' && /^test\/[a-zA-Z0-9._/-]+\.test\.mjs$/.test(id) &&
  !id.split('/').includes('..') && !id.split('/').includes('.');
const unique = rows => new Set(rows).size === rows.length;
function contract(pkg) {
  assert(Array.isArray(pkg.files) && Array.isArray(pkg.receivingTests), 'explicit files and receivingTests required');
  assert(pkg.files.every(x => typeof x === 'string') && unique(pkg.files), 'unique package files required');
  assert(pkg.receivingTests.length > 0 && pkg.receivingTests.every(filePath) && unique(pkg.receivingTests),
    'nonempty unique safe receiving tests required');
  for (const id of pkg.receivingTests)
    assert(pkg.files.includes(id), `receiving test not selected for packing: ${id}`);
  const named = [...new Set(Object.entries(pkg.scripts || {}).filter(([key]) => key.startsWith('test:'))
    .flatMap(([,cmd]) => [...String(cmd).matchAll(/\btest\/[a-zA-Z0-9._/-]+\.test\.mjs\b/g)]
      .map(m => m[0])))];
  for (const id of named)
    assert(pkg.receivingTests.includes(id), `named test script omitted from receiving: ${id}`);
  return pkg.receivingTests;
}
let dir;
try {
  const pkg = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'));
  const tests = contract(pkg);
  receipt.package = pkg.name;
  receipt.version = pkg.version;
  receipt.declaredReceivingTests = tests.length;
  for (const id of tests)
    assert(existsSync(join(source, id)), `source receiving test missing: ${id}`);
  dir = mkdtempSync(join(tmpdir(), 'signgraph-packed-receiving-'));
  receipt.stage = 'npm-pack';
  const pack = JSON.parse(run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', dir], source, 180000));
  assert(Array.isArray(pack) && pack.length === 1 && typeof pack[0].filename === 'string',
    'one emitted package artifact required');
  assert(basename(pack[0].filename) === pack[0].filename, 'tarball path must be a basename');
  const tarball = join(dir, pack[0].filename);
  const tarballBytes = readFileSync(tarball);
  receipt.archiveSha256 = sha256(tarballBytes);
  receipt.packageTarball = pack[0].filename;
  receipt.stage = 'archive-inventory';
  const entries = run('tar', ['-tzf', tarball], dir, 120000).trim().split('\n');
  assert(entries.length > 1 && unique(entries), 'archive entries must exist and be unique');
  assert(entries.every(x => x.startsWith('package/') && !x.split('/').includes('..') &&
    !x.includes('\\') && !x.includes('\0')), 'archive paths must be relative to package/');
  receipt.archiveEntries = entries.length;
  const inventory = new Set(entries);
  assert(inventory.has('package/package.json'), 'emitted package.json missing');
  for (const id of tests)
    assert(inventory.has(`package/${id}`), `receiving test absent from emitted archive: ${id}`);
  for (const entry of Object.values(pkg.exports || {}))
    if (typeof entry === 'string' && entry.startsWith('./'))
      assert(inventory.has('package/' + entry.slice(2)), `export absent from emitted archive: ${entry}`);
  receipt.stage = 'archive-extraction';
  run('tar', ['-xzf', tarball, '-C', dir], dir, 120000);
  const packed = join(dir, 'package');
  for (const id of tests) {
    const artifact = join(packed, id);
    assert(lstatSync(artifact).isFile(), `receiving test is not a regular file: ${id}`);
    assert(sha256(readFileSync(artifact)) === sha256(readFileSync(join(source, id))),
      `emitted receiving test differs from source: ${id}`);
  }
  const packagedManifest = JSON.parse(readFileSync(join(packed, 'package.json'), 'utf8'));
  assert(packagedManifest.name === pkg.name && packagedManifest.version === pkg.version,
    'packed package identity diverges from source');
  assert.deepEqual(packagedManifest.receivingTests, pkg.receivingTests,
    'packed receiving selection diverges from source');
  receipt.inventory = 'passed';
  receipt.sourceToArchiveBytes = 'matched';
  if (inventoryOnly) {
    receipt.stage = 'awaiting-dependency-backed-receiving';
    receipt.result = 'inventory-qualified-only';
  } else {
    receipt.stage = 'archive-dependencies';
    run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'], packed);
    receipt.dependencyInstall = 'passed';
    receipt.stage = 'archive-native-tests';
    run(process.execPath, ['--test', ...tests], packed);
    receipt.nativeReceivingTests = tests.length;
    receipt.tests = 'passed';
    receipt.result = 'packed-tests-passed-not-installed';
    receipt.stage = 'qualified-source-package';
  }
  process.stdout.write(JSON.stringify(receipt) + '\n');
} catch (err) {
  receipt.result = 'refused';
  receipt.obstruction = String(err?.message || err);
  process.stderr.write(JSON.stringify(receipt) + '\n');
  process.exitCode = 1;
} finally {
  if (dir) rmSync(dir, { recursive: true, force: true });
}
