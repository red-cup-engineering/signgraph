/**
 * Qualify the original npm default registry, package-declared scoped
 * registries, and effective source-configured transitive scopes across the source -> emitted-package installation boundary.
 * Only credential-free effective HTTPS registry URLs cross that boundary.
 * Host authentication stays with its original npm configuration and rights.
 */
function registryOf(value, label) {
  if (typeof value !== 'string' || value.length > 2048)
    throw new TypeError(label + ' registry must be a bounded URL');
  let url;
  try { url = new URL(value.trim()); }
  catch { throw new TypeError(label + ' registry is not an admitted URL'); }
  if (url.protocol !== 'https:' || url.username || url.password ||
      url.search || url.hash)
    throw new TypeError(label + ' registry must be credential-free HTTPS');
  return url;
}
const scopePattern = /^@[a-z0-9][a-z0-9._-]*$/i;

export function declaredRegistryScopes(pkg) {
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg))
    throw new TypeError('an original package manifest is required');
  const scopes = new Set();
  for (const group of ['dependencies', 'optionalDependencies', 'peerDependencies', 'devDependencies']) {
    const declared = pkg[group] ?? {};
    if (!declared || typeof declared !== 'object' || Array.isArray(declared))
      throw new TypeError('invalid package dependency group: ' + group);
    for (const [name, spec] of Object.entries(declared)) {
      const direct = /^(@[^/]+)\//.exec(name)?.[1];
      const alias = typeof spec === 'string' ? /^npm:(@[^/]+)\//.exec(spec)?.[1] : null;
      for (const scope of [direct, alias]) {
        if (scope) {
          if (!scopePattern.test(scope)) throw new TypeError('invalid declared package scope');
          scopes.add(scope);
        }
      }
    }
  }
  return Object.freeze([...scopes].sort());
}

// Root manifest scopes alone are not a dependency closure. A transitive-only
// dependency may use a source-configured npm scope invisible to package.json.
// Enumerate effective npm config keys, but never transmit config values or
// authentication; only strictly validated registry names cross this API.
export function configuredRegistryScopes(configuration) {
  if (typeof configuration !== 'string' || configuration.length > 1048576)
    throw new TypeError('bounded effective npm registry listing is required');
  const scopes = new Set();
  for (const line of configuration.split(/\r?\n/u)) {
    // npm config ls --json can OMIT protected @scope:registry entries.
    // Read only the key from npm's effective plain listing, never values.
    const scope = /^(@[^=\s]+):registry\s*=/u.exec(line)?.[1];
    if (!scope) continue;
    if (!scopePattern.test(scope))
      throw new TypeError('invalid source npm registry scope');
    scopes.add(scope);
    if (scopes.size > 100)
      throw new TypeError('unbounded source npm registry scopes');
  }
  return Object.freeze([...scopes].sort());
}

export function qualifyPackedRegistry(readRegistry, {source, packed, scopes = []} = {}) {
  if (typeof readRegistry !== 'function' ||
      typeof source !== 'string' || !source.length ||
      typeof packed !== 'string' || !packed.length ||
      !Array.isArray(scopes) || scopes.length > 100 ||
      scopes.some(scope => typeof scope !== 'string' || !scopePattern.test(scope)))
    throw new TypeError('packed receiving requires original paths and valid declared scopes');
  const original = registryOf(readRegistry(source), 'source');
  const environment = {npm_config_registry: original.href};
  const scopeSelections = [];
  for (const scope of [...new Set(scopes)].sort()) {
    const key = scope + ':registry';
    const sourceValue = readRegistry(source, {}, key);
    if (sourceValue == null || String(sourceValue).trim() === 'undefined') {
      scopeSelections.push([key, null]);
      continue;
    }
    const sourceUrl = registryOf(sourceValue, 'source ' + scope);
    environment['npm_config_' + key] = sourceUrl.href;
    scopeSelections.push([key, sourceUrl.href]);
  }
  Object.freeze(environment);
  const actual = registryOf(readRegistry(packed, environment), 'packed');
  if (actual.href !== original.href)
    throw new Error('archive installation registry differs from original source registry');
  for (const [key, expected] of scopeSelections) {
    const got = readRegistry(packed, environment, key);
    const actualScope = got == null || String(got).trim() === 'undefined'
      ? null : registryOf(got, 'packed ' + key).href;
    if (actualScope !== expected)
      throw new Error('archive installation scope registry differs for ' + key);
  }
  return Object.freeze({environment, origin:original.origin,
    scopes:Object.freeze(scopeSelections.map(x => x[0]))});
}

