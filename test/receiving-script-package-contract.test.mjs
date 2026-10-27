import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

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
  assert.ok(named.includes("test/meridian-flow-observability.test.mjs") === false);
  assert.ok(named.includes("test/hierarchical-circuit.test.mjs"));
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
