/**
 * Keep a packed source dependency install on the exact effective npm registry
 * selected at the owning source checkout. Packaging does not copy .npmrc.
 * No credentials, source configuration files, package effects or authority
 * are manufactured. A mismatch is an obstruction, not a fallback.
 */
function registryOf(value, label) {
  if (typeof value !== "string" || value.length > 2048)
    throw new TypeError(label + " registry must be a bounded URL");
  let url;
  try { url = new URL(value.trim()); }
  catch { throw new TypeError(label + " registry is not an admitted URL"); }
  if (url.protocol !== "https:" || url.username || url.password ||
      url.search || url.hash)
    throw new TypeError(label + " registry must be credential-free HTTPS");
  return url;
}
export function qualifyPackedRegistry(readRegistry, {source, packed}={}) {
  if (typeof readRegistry !== "function" ||
      typeof source !== "string" || !source.length ||
      typeof packed !== "string" || !packed.length)
    throw new TypeError("packed receiving requires original and unpacked source paths");
  const original = registryOf(readRegistry(source), "source");
  const environment = Object.freeze({npm_config_registry:original.href});
  const actual = registryOf(readRegistry(packed, environment), "packed");
  if (actual.href !== original.href)
    throw new Error("archive installation registry differs from original source registry");
  return Object.freeze({environment,origin:original.origin});
}
