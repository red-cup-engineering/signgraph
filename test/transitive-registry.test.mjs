import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {configuredRegistryScopes, declaredRegistryScopes, qualifyPackedRegistry} from '../scripts/qualify-packed-registry.mjs';

test('transitive-only scoped provider is admitted without copying npm credentials',t=>{
  const root=mkdtempSync(join(tmpdir(),'signgraph-closure-registry-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const source=join(root,'source'),packed=join(root,'packed');
  mkdirSync(source);mkdirSync(packed);
  writeFileSync(join(source,'.npmrc'),
    'registry=https://default.invalid/root/\n'+
    '@direct:registry=https://direct.invalid/deps/\n'+
    '@nested:registry=https://transitive.invalid/deps/\n');
  const base={...process.env};
  for (const k of Object.keys(base))
    if (k.startsWith('npm_config_@') || k.toLowerCase()==='npm_config_registry') delete base[k];
  const cmd=(cwd,args,extra={})=>{
    const p=spawnSync('npm',args,{cwd,encoding:'utf8',timeout:20000,env:{...base,...extra}});
    assert.equal(p.status,0,'npm config must succeed');
    return p.stdout.trim();
  };
  const read=(cwd,environment={},key='registry')=>cmd(cwd,['config','get',key],environment);
  const config=JSON.parse(cmd(source,['config','list','--json']));
  const configured=configuredRegistryScopes(config);
  assert.deepEqual(configured,['@direct','@nested']);
  const rootManifest={dependencies:{'@direct/package':'1.0.0'}};
  const declared=declaredRegistryScopes(rootManifest);
  assert.deepEqual(declared,['@direct']);
  const flawed=qualifyPackedRegistry(read,{source,packed,scopes:declared});
  assert.equal(read(packed,flawed.environment,'@nested:registry'),'undefined',
    'reproduce the old false green under the root-only scope selection');
  const effective=[...new Set([...declared,...configured])].sort();
  const repaired=qualifyPackedRegistry(read,{source,packed,scopes:effective});
  assert.equal(repaired.environment['npm_config_@nested:registry'],
    'https://transitive.invalid/deps/');
  assert.equal(read(packed,repaired.environment,'@nested:registry'),
    read(source,{},'@nested:registry'));
  assert.equal(read(packed,repaired.environment,'registry'),read(source));
  assert.deepEqual(Object.keys(repaired.environment).sort(),
    ['npm_config_@direct:registry','npm_config_@nested:registry','npm_config_registry']);
  // Only provider URLs, never auth keys, move across this boundary.
  assert.equal(JSON.stringify(repaired).includes('authToken'),false);
  assert.throws(()=>qualifyPackedRegistry((cwd,env,key='registry')=>
    cwd===packed&&key==='@nested:registry'?'https://substituted.invalid/':read(cwd,env,key),
    {source,packed,scopes:effective}),/scope registry differs/);
});

test('scope discovery reads names only and rejects malformed or unbounded enumeration',()=>{
  const scopes=configuredRegistryScopes({
    '@nested:registry':'https://nested.invalid/',
    '//registry.invalid/:_authToken':'sensitive',
    'registry':'https://default.invalid/',
  });
  assert.deepEqual(scopes,['@nested']);
  assert.throws(()=>configuredRegistryScopes(null),TypeError);
  assert.throws(()=>configuredRegistryScopes({'@nested/path:registry':'https://invalid/'}),
    /invalid effective npm scoped registry key/);
  const huge=Object.fromEntries(Array.from({length:101},(_,i)=>[['@s'+i+':registry'][0],'https://s.invalid/']));
  assert.throws(()=>configuredRegistryScopes(huge),/too many effective npm scoped registries/);
});
