/**
 * Source-contract regression for the existing native hierarchical-circuit
 * normalizer and its companion CDDL diagnostic profile (2026-10-21).
 * Dependency-free: this does not run installed providers or prove semantics.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/hierarchical-circuit.mjs", import.meta.url), "utf8");
const schema = readFileSync(new URL("../src/hierarchical-circuit.v3.cddl", import.meta.url), "utf8");

const native = new Map([...source.matchAll(
  /^export const (HIERARCHICAL_CIRCUIT_PROFILE|CIRCUIT_ASSEMBLY_PROFILE) = "([^"]+)";/gm,
)].map((m) => [m[1], m[2]]));
const decodedProfiles = (text) => [...text.matchAll(
  /^\s*profile:\s*"([^"]+)"\s*,?/gm,
)].map((m) => m[1]);

test("CDDL circuit and assembly profiles exactly match both executable source constants", () => {
  assert.equal(native.size, 2, "both original versioned source constants must exist");
  assert.deepEqual(decodedProfiles(schema), [
    native.get("HIERARCHICAL_CIRCUIT_PROFILE"),
    native.get("CIRCUIT_ASSEMBLY_PROFILE"),
  ]);
  assert.equal(native.get("HIERARCHICAL_CIRCUIT_PROFILE"),
    "org.emsenn.sen.hierarchical-circuit.v3");
  assert.equal(native.get("CIRCUIT_ASSEMBLY_PROFILE"),
    "org.emsenn.sen.circuit-assembly.v1");
});

test("historical RMN profile literals are a negative control: native decoder must not claim them", () => {
  const obsolete = schema.replaceAll("org.emsenn.sen.", "org.emsenn.rmn.");
  assert.notDeepEqual(decodedProfiles(obsolete), decodedProfiles(schema));
  assert.deepEqual(decodedProfiles(obsolete), [
    "org.emsenn.rmn.hierarchical-circuit.v3",
    "org.emsenn.rmn.circuit-assembly.v1",
  ]);
  assert.equal(schema.includes("profile: \"org.emsenn.rmn."), false);
});
