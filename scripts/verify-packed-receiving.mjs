#!/usr/bin/env node
// SignGraph source-owned receiving: a passing source test is not a packed artifact test.
// No deployment, package publication, work acceptance, or observed resource flow follows.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { qualifyPackedRegistry, declaredRegistryScopes, configuredRegistryScopes } from './qualify-packed-registry.mjs';

const source = resolve(process.env.SIGNGRAPH_SOURCE_ROOT || process.cwd());
const inventoryOnly = process.argv.slice(2).includes('--inventory-only');
const receipt = { kind: 'signgraph.packed-receiving.v1', source, mode: inventoryOnly ? 'archive-only' : 'dependency-backed',
  stage: 'preflight', result: 'unverified' };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (command, args, cwd, maxMs = 600000, extraEnv = {}) => {
  const p = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: maxMs,
    maxBuffer: 32 * 1024 * 1024, env: (() => {
      const env = { ...process.env, npm_config_update_notifier: 'false', ...extraEnv };
      delete env.NODE_TEST_CONTEXT; // prevent inherited parent node:test worker role
      return env;
    })() });
  if (p.error || p.status !== 0) {
    const message = (p.stderr || p.stdout || p.error?.message || '').slice(-3000);
    throw new Error(`${command} ${args[0]} failed (${p.status ?? 'no-exit'}): ${message}`);
  }
  return p.stdout;
};
// Do not log, copy, or forward `npm config list --json`: it may contain
// credential-bearing settings. Only its validated scoped-registry KEY NAMES
// are used to reproduce original source selection in the unpacked consumer.
function sourceConfiguredScopes() {
  const env = {...process.env, npm_config_update_notifier:'false'};
  delete env.NODE_TEST_CONTEXT;
  const p = spawnSync('npm', ['config', 'list', '--json'], {
    cwd:source, encoding:'utf8', timeout:120000, maxBuffer:4*1024*1024, env,
  });
  if (p.error || p.status !== 0)
    throw new Error('cannot enumerate effective source npm registry scopes');
  let config;
  try { config = JSON.parse(p.stdout); }
  catch { throw new Error('cannot parse effective source npm registry scopes'); }
  return configuredRegistryScopes(config);
}
const filePath = id => typeof id === 'string' && /^test\/[a-zA-Z0-9._/-]+\.test\.mjs$/.test(id) &&
  !id.split('/').includes('..') && !id.split('/').includes('.');
const unique = rows => new Set(rows).size === rows.length;
// Package exports are a tree of subpaths, conditions and fallback arrays.
// Every advertised candidate (not merely the default or first string) must
// refer to an actual regular packed file, or receiving is not qualified.
// Pattern exports require separate, finite coverage and therefore refuse here.
function exportTargets(value, label='exports') {
  if (value == null) return [];
  if (typeof value === 'string') {
    const parts = value.startsWith('./') ? value.slice(2).split('/') : [];
    assert(parts.length > 0 && parts.every(x => x && x !== '.' && x !== '..') &&
      !value.includes('\\') && !value.includes('\0') && !value.includes('*'),
      `unsafe or unqualified package export target at ${label}: ${value}`);
    return [value.slice(2)];
  }
  if (Array.isArray(value))
    return value.flatMap((v, i) => exportTargets(v, `${label}[${i}]`));
  assert(typeof value === 'object', `invalid package export at ${label}`);
  return Object.entries(value).flatMap(([key, v]) => {
    assert(!key.includes('*'), `unqualified package export pattern at ${label}.${key}`);
    return exportTargets(v, `${label}.${key}`);
  });
}
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
  const exported = [...new Set(exportTargets(pkg.exports))];
  for (const id of exported)
    assert(inventory.has(`package/${id}`), `export absent from emitted archive: ./${id}`);
  receipt.checkedExportTargets = exported.length;
  receipt.stage = 'archive-extraction';
  run('tar', ['-xzf', tarball, '-C', dir], dir, 120000);
  const packed = join(dir, 'package');
  let comparedFiles = 0;
  for (const entry of entries) {
    if (entry.endsWith('/')) continue;
    const id = entry.slice('package/'.length);
    const artifact = join(packed, id);
    const original = join(source, id);
    assert(existsSync(original) && lstatSync(original).isFile() && lstatSync(artifact).isFile(),
      `emitted file lacks original regular source: ${id}`);
    assert(sha256(readFileSync(artifact)) === sha256(readFileSync(original)),
      `emitted archive file differs from source: ${id}`);
    comparedFiles++;
  }
  for (const id of tests)
    assert(lstatSync(join(packed, id)).isFile(), `receiving test is not a regular file: ${id}`);
  receipt.sourceToArchiveFiles = comparedFiles;
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
    // Source .npmrc is absent in the tarball. Original npm config selects
    // the registry, while the helper proves the extracted install uses it.
    // No credential or .npmrc is copied into the published artifact.
    const handoff = qualifyPackedRegistry(
      (cwd, environment = {}, key = 'registry') =>
        run('npm', ['config', 'get', key], cwd, 120000, environment).trim(),
      {source, packed, scopes:[...new Set([
        ...declaredRegistryScopes(pkg), ...sourceConfiguredScopes(),
      ])].sort()});
    receipt.installRegistryOrigin = handoff.origin;
    receipt.qualifiedRegistryScopeCount = handoff.scopes.length;
    run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'],
      packed, 600000, handoff.environment);
    receipt.dependencyInstall = 'passed';
    receipt.stage = 'archive-native-tests';
    const executed = [];
    for (const id of tests) {
      // Every exact receiving file must actually execute. A zero-case green
      // exit, including inherited NODE_TEST_CONTEXT, is not qualification.
      const tap = run(process.execPath, ['--test', '--test-reporter=tap', id], packed);
      // Node may synthesize a green file-level subtest even if this module
      // registered *zero* tests. TAP '# tests 1' alone is therefore not
      // evidence that any receiving assertion or test body actually ran.
      const subtests = tap.split(/\r?\n/u).filter(line => line.startsWith('# Subtest: '));
      if (subtests.length === 1 && ['# Subtest: ' + id, '# Subtest: ' + join(packed, id)].includes(subtests[0]))
        throw new Error('native receiving file has no registered test cases: ' + id);
      const count = /^# tests (\d+)\r?$/mu.exec(tap);
      const passed = /^# pass (\d+)\r?$/mu.exec(tap);
      if (!count || !passed || Number(count[1]) < 1 ||
          Number(count[1]) !== Number(passed[1]))
        throw new Error('native package test did not positively execute: ' + id);
      executed.push({ file: id, passed: Number(passed[1]) });
    }
    receipt.nativeReceivingTests = executed.length;
    receipt.nativeReceivingCases = executed.reduce((n, file) => n + file.passed, 0);
    receipt.executedTestFiles = executed;
    receipt.nodeVersion = process.version;
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
