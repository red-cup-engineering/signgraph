import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageName = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).name;
const family = packageName.split("/").at(-1);
const higher = {
  signcell: ["signchain", "signgraph", "signcraft"],
  signchain: ["signgraph", "signcraft"],
  signgraph: ["signcraft"],
  signcraft: [],
}[family];
if (!higher) throw new Error("this assay belongs to one of the four Sign libraries");

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
  for (const path of sourceFiles(join(root, "src"))) {
    inspected++;
    const code = readFileSync(path, "utf8");
    const imports = [
      ...code.matchAll(/\bfrom\s*["']([^"']+)["']/gu),
      ...code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/gu),
    ].map(match => match[1]);
    for (const specifier of imports) {
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
