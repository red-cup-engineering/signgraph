import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const packageName = manifest.name;
const family = packageName.split("/").at(-1);
const higher = {
  signcell: ["signchain", "signgraph", "signcraft"],
  signchain: ["signgraph", "signcraft"],
  signgraph: ["signcraft"],
  signcraft: [],
}[family];
if (!higher) throw new Error("this assay belongs to one of the four Sign libraries");

test("the published SignGraph runtime exposes pure library entries and keeps receiving harnesses private", () => {
  assert.equal(manifest.bin, undefined, "process commands belong to the downstream effect owner");
  // The archive deliberately ships its original native receiving assays.
  // Their two private harnesses are test dependencies, not runtime entries.
  assert.deepEqual(manifest.files.filter(path => path === "scripts" || path.startsWith("scripts/")).sort(),
    ["scripts/qualify-packed-registry.mjs", "scripts/verify-packed-receiving.mjs"],
    "only the original packed-receiving harnesses may accompany the library");
  for (const [name, target] of Object.entries(manifest.exports)) {
    assert.ok(target === "./package.json" ||
      (typeof target === "string" && target.startsWith("./src/") && !target.includes("/../")),
    `${name} must expose only the inspected library`);
  }
});

function* sourceFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (entry.isFile() && entry.name.endsWith(".mjs")) yield path;
  }
}

test("the Sign-family source is a pure functional substrate, not an effects provider", () => {
  let inspected = 0;
  const ambient = /\b(?:Date\.now\s*\(|Math\.random\s*\(|fetch\s*\(|process\.(?:env|stdin|stdout|stderr|exit|cwd)\b)/u;
  const inspectedSources = new Set(sourceFiles(join(root, "src")));
  for (const target of Object.values(manifest.exports)) {
    if (typeof target === "string" && target !== "./package.json")
      inspectedSources.add(join(root, target));
  }
  for (const path of inspectedSources) {
    inspected++;
    const code = readFileSync(path, "utf8");
    const imports = [
      ...code.matchAll(/\bfrom\s*["']([^"']+)["']/gu),
      ...code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/gu),
    ].map(match => match[1]);
    for (const specifier of imports) {
      if (specifier.startsWith("."))
        assert.doesNotMatch(specifier, /(?:^|\/)scripts(?:\/|$)/u,
          `${path} may not import a private receiving harness into the runtime`);
      assert.doesNotMatch(specifier,
        /^(?:node:)?(?:fs(?:\/promises)?|child_process|http|https|net|tls|dgram|worker_threads)(?:\/|$)/u,
        `${path} may not acquire ambient I/O capabilities`);
      for (const upper of higher) {
        assert.notEqual(specifier, `@red-cup-engineering/${upper}`,
          `${path} may not depend on a higher Sign library`);
        assert.ok(!specifier.startsWith(`@red-cup-engineering/${upper}/`),
          `${path} may not import from a higher Sign library`);
      }
    }
    assert.doesNotMatch(code, ambient,
      `${path} must not read ambient clock, randomness, process or network from library source`);
    if (family === "signgraph" && path.endsWith("/operations.mjs"))
      assert.doesNotMatch(code, /signgraph\.(?:eda|rigidity)\./u,
        "the SignGraph compatibility dispatcher must not grow application-themed operations");
  }
  assert.ok(inspected > 0, "source library was not inspected");
});
