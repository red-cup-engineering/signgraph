import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { qualifyPackedRegistry } from "../scripts/qualify-packed-registry.mjs";

// Receive the explicit named test scripts through the SAME package artifact.
// Source-tree "npm test" may intentionally include more tests than a packed
// receiver, but a script naming exact files must not silently lose any of them.
const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

function receivingScriptPaths(packageJson, fileExists = path =>
  existsSync(new URL("../" + path, import.meta.url))) {
  const files = packageJson.files;
  const receiving = packageJson.receivingTests;
  if (!Array.isArray(files) || !Array.isArray(receiving) ||
      files.some(path => typeof path !== "string") ||
      receiving.some(path => typeof path !== "string") ||
      new Set(files).size !== files.length ||
      new Set(receiving).size !== receiving.length)
    throw new TypeError("packed receiving requires unique declared file paths");
  for (const path of receiving) {
    if (!/^test\/[a-zA-Z0-9._/-]+\.test\.mjs$/.test(path) || path.includes("..") ||
        !files.includes(path) || !fileExists(path))
      throw new TypeError("receiving suite does not have a packaged source: " + path);
  }
  const named = [...new Set(Object.entries(packageJson.scripts ?? {})
    .filter(([key]) => key.startsWith("test:"))
    .flatMap(([, command]) => [...String(command)
      .matchAll(/\btest\/[a-zA-Z0-9._/-]+\.test\.mjs\b/g)].map(match => match[0])))].sort();
  for (const path of named)
    if (!files.includes(path) || !receiving.includes(path) || !fileExists(path))
      throw new TypeError("named test script not received in package: " + path);
  return named;
}

test("explicit named native test scripts have the same packed receiving sources", () => {
  const named = receivingScriptPaths(manifest);
  assert.ok(named.includes("test/cellular-2complex.test.mjs"));
  assert.ok(manifest.receivingTests.includes("test/meridian-flow-observability.test.mjs"));
  assert.ok(named.includes("test/hierarchical-circuit.test.mjs"));
  for(const suite of [
    "test/evidence-order-receiving.test.mjs",
    "test/fiber-source-context.test.mjs",
    "test/site-source-admission.test.mjs",
    "test/site-specialization-closure.test.mjs",
    "test/cell-graph.test.mjs",
    "test/source-record-tower-flow.test.mjs",
    "test/cohomology-canonical-incidence.test.mjs",
  ]) {
    assert.ok(named.includes(suite), "the foundations interoperability gate must execute " + suite);
    assert.ok(manifest.files.includes(suite), "foundations source absent from the issued artifact");
    assert.ok(manifest.receivingTests.includes(suite), "packed receiving omits foundations source");
  }
});

test("missing receiver enrollment refuses before a published artifact is accepted", () => {
  const prior = {
    ...manifest,
    receivingTests: manifest.receivingTests.filter(path =>
      path !== "test/cellular-2complex.test.mjs"),
  };
  assert.throws(() => receivingScriptPaths(prior), /named test script not received/);
});

test("missing package file and duplicate receiving declarations fail closed", () => {
  const withoutFile = { ...manifest,
    files: manifest.files.filter(path => path !== "test/sixfold-holonomy.test.mjs") };
  assert.throws(() => receivingScriptPaths(withoutFile),
    /receiving suite does not have a packaged source/);
  const duplicate = { ...manifest,
    receivingTests: [...manifest.receivingTests, manifest.receivingTests[0]] };
  assert.throws(() => receivingScriptPaths(duplicate), /unique declared file paths/);
});

test("packed archive dependency registry follows original source config without copying private npmrc", () => {
  // Offline test: npm config get registry never downloads/install dependencies.
  // The emitter runs under source/.npmrc but extraction changes its cwd.
  const root = mkdtempSync(join(tmpdir(), "signgraph-registry-assay-"));
  const original = join(root, "source"), unpacked = join(root, "unpacked");
  try {
    mkdirSync(original); mkdirSync(unpacked);
    writeFileSync(join(original, ".npmrc"), "registry=https://registry.561.group/\n");
    const env = {...process.env};
    delete env.npm_config_registry;
    delete env.NPM_CONFIG_REGISTRY;
    const registry = (cwd, additional = {}) => {
      const result = spawnSync("npm", ["config", "get", "registry"], {
        cwd, encoding: "utf8", timeout: 20000,
        env: {...env, ...additional},
      });
      assert.equal(result.status, 0, String(result.stderr || result.error));
      return result.stdout.trim();
    };
    const sourceRegistry = registry(original);
    assert.equal(sourceRegistry, "https://registry.561.group/");
    assert.equal(existsSync(join(unpacked, ".npmrc")), false,
      "the emitted package does not carry the source installation policy");
    // The verifier must pass this exact resolved source registry into the
    // unpacked install; its default may otherwise be a different provider.
    const handoff = qualifyPackedRegistry(registry, {source:original, packed:unpacked});
    assert.deepEqual(handoff.environment, {npm_config_registry:sourceRegistry});
    assert.equal(handoff.origin, "https://registry.561.group");
    assert.equal(registry(unpacked, handoff.environment), sourceRegistry);
  } finally {
    rmSync(root, {recursive:true, force:true});
  }
});

test("source registry handoff fails closed on absent, mismatched or credentialed providers", () => {
  const places = {source:"source",packed:"packed"};
  for(const bad of ["", "not-a-url", "http://registry.invalid/",
    "https://user:password@registry.invalid/",
    "https://registry.invalid/?token=secret", "https://registry.invalid/#secret"]) {
    assert.throws(() => qualifyPackedRegistry(() => bad, places), TypeError);
  }
  assert.throws(() => qualifyPackedRegistry(
    (cwd, env) => cwd === "source" ? "https://registry.561.group/" : "https://other.invalid/",
    places), /archive installation registry differs/);
  assert.throws(() => qualifyPackedRegistry(null,places), TypeError);
});

test("source-qualified graph cohomology cannot be silently dropped from packed foundations receiving",()=>{
  const missing={...manifest,
    receivingTests:manifest.receivingTests.filter(x=>
      x!=="test/cohomology-canonical-incidence.test.mjs")};
  assert.throws(()=>receivingScriptPaths(missing),
    /named test script not received/u);
  const unpacked={...manifest,
    files:manifest.files.filter(x=>
      x!=="test/site-specialization-closure.test.mjs")};
  assert.throws(()=>receivingScriptPaths(unpacked),
    /receiving suite does not have a packaged source/u);
});
