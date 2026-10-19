import assert from "node:assert/strict";
import test from "node:test";
import { address, cell, sidesOf } from "@red-cup-engineering/signcell/cell";
import { SPECIALIZES, generalizations, tokenFrame } from "@red-cup-engineering/signcell/token-frame";
import { possibilize, valuationOf } from "@red-cup-engineering/signchain/token-fiber";
import { inherited, inheritedClaim, tellingsAt } from "../src/token-sheaf.mjs";

const told = (special, general, by = "leader") => cell(special, SPECIALIZES, general, { for: [by] });

// The Leader's resource types (2026-10-15): a services section is a repository, a repository is a unit.
const vocabulary = [
  told("unit", "thing"),
  told("repository", "unit"),
  told("services-section", "repository"),
  told("actor", "thing"),
  told("character", "actor"),
  told("signcell", "services-section", "computer-data-engineering-services-section"),
];

// The Leader's rules for resource types (2026-10-15), each told of the type it targets.
const rules = [
  cell("repository", "requires", "default-branch-on-github-holds-all-work", { for: ["leader-2026-10-15"] }),
  cell("services-section", "requires", "own-repository-mounted-in-parent", { for: ["leader-2026-10-15"] }),
  cell("unit", "requires", "repository-name-equals-package-name", { for: ["leader-2026-10-15"] }),
  cell("signcell", "requires", "zero-failing-tests", { for: ["signcell-maintainer"] }),
];

test("whatever is told of a type is told of everything of that type", () => {
  const frame = tokenFrame([...vocabulary, ...rules]);
  const reading = inherited(frame, "signcell");
  assert.deepEqual(reading.cells.map((at) => at.object).sort(), [
    "default-branch-on-github-holds-all-work",
    "own-repository-mounted-in-parent",
    "repository-name-equals-package-name",
    "zero-failing-tests",
  ]);
  for (const at of reading.cells) assert.equal(at.subject, "signcell");
  const naming = reading.cells.findIndex((at) => at.object === "repository-name-equals-package-name");
  assert.deepEqual(reading.sources[naming].map((source) => source.token), ["unit"]);
  assert.deepEqual(reading.contested, []);
  assert.deepEqual(inherited(frame, "character").cells, []);
  assert.deepEqual(inherited(frame, "repository").cells.map((at) => at.object).sort(), ["default-branch-on-github-holds-all-work", "repository-name-equals-package-name"]);
});

test("disagreeing generalizations leave the inherited cell contested, whichever is nearer", () => {
  const frame = tokenFrame([
    ...vocabulary,
    cell("unit", "may-hold", "workspace-dependencies", { against: ["leader-2026-10-15"] }),
    cell("services-section", "may-hold", "workspace-dependencies", { for: ["an-old-agent-note"] }),
  ]);
  const reading = inherited(frame, "signcell");
  assert.equal(reading.contested.length, 1);
  const [contest] = reading.contested;
  assert.deepEqual(sidesOf(contest.cell), [true, true]);
  assert.deepEqual(contest.for, ["services-section"]);
  assert.deepEqual(contest.against, ["unit"]);
  assert.deepEqual(contest.cell.for, ["an-old-agent-note"]);
  assert.deepEqual(contest.cell.against, ["leader-2026-10-15"]);
  assert.equal(inherited(frame, "repository").contested.length, 0);
});

test("a token's own tellings join what it inherits, and tokens outside every order keep only their own", () => {
  const frame = tokenFrame([...vocabulary, ...rules, cell("signcell", "requires", "repository-name-equals-package-name", { for: ["signcell-maintainer"] }), cell("kalshi", "requires", "client-order-id", { for: ["leader"] })]);
  const naming = inherited(frame, "signcell").cells.find((at) => at.object === "repository-name-equals-package-name");
  assert.deepEqual([...naming.for].sort(), ["leader-2026-10-15", "signcell-maintainer"]);
  assert.deepEqual(inherited(frame, "kalshi").cells.map((at) => at.object), ["client-order-id"]);
  assert.deepEqual(generalizations(frame, "kalshi"), ["kalshi"]);
});


test("gluing over a token's generalizations is possibilizing, claim by claim", () => {
  const frame = tokenFrame([...vocabulary, ...rules, cell("unit", "requires", "zero-failing-tests", { against: ["an-old-agent-note"] })]);
  const name = { "true,false": "potential", "false,true": "active", "true,true": "stable" };
  const claims = [...new Map(frame.cells.filter((at) => at.predicate !== SPECIALIZES).map((at) => [JSON.stringify([at.predicate, at.object]), [at.predicate, at.object]])).values()];
  assert.ok(claims.length >= 4);
  for (const [predicate, object] of claims) {
    const possible = possibilize(frame, valuationOf(frame, predicate, object));
    for (const token of frame.tokens) {
      const glued = inherited(frame, token).cells.find((at) => at.predicate === predicate && at.object === object);
      assert.equal(glued === undefined ? "absurd" : name[sidesOf(glued).join()], possible.find((entry) => entry.token === token).reading, `${token} ${predicate} ${object}`);
    }
  }
  assert.deepEqual(tellingsAt(frame, "signcell").map((at) => at.object), ["zero-failing-tests"]);
  assert.deepEqual(tellingsAt(frame, "thing"), []);
});

test("one token/claim fiber equals the corresponding FULL source-preserving gluing cut", () => {
  const frame = tokenFrame([
    ...vocabulary, ...rules,
    cell("unit", "may-hold", "workspace-dependencies", { against: ["leader"] }),
    cell("services-section", "may-hold", "workspace-dependencies", { for: ["old-note"] }),
    cell("signcell", "may-hold", "workspace-dependencies", { against: ["security"] }),
    cell("signcell", "requires", "zero-failing-tests", { against: ["customer"] }),
    cell("independent", "needs", "none", { for: ["other-source"] }),
  ]);
  const claims = [
    ["may-hold", "workspace-dependencies"], ["requires", "zero-failing-tests"],
    ["requires", "repository-name-equals-package-name"], ["needs", "none"],
    ["requires", "never-told"], [SPECIALIZES, "unit"],
  ];
  for (const token of frame.tokens) {
    const full = inherited(frame, token);
    for (const [predicate, object] of claims) {
      const cut = inheritedClaim(frame, token, predicate, object);
      const queryKey = address(cell(null, predicate, object));
      const slots = full.cells.flatMap((telling, index) =>
        address(cell(null, telling.predicate, telling.object)) === queryKey ? [index] : []);
      assert.equal(cut.kind, full.kind);
      assert.equal(cut.token, token);
      assert.deepEqual(cut.cells, slots.map((index) => full.cells[index]), `${token}: ${predicate}/${object}`);
      assert.deepEqual(cut.sources, slots.map((index) => full.sources[index]));
      assert.deepEqual(cut.contested, full.contested.filter((entry) =>
        address(cell(null, entry.cell.predicate, entry.cell.object)) === queryKey));
    }
  }
});

test("one claim preserves opposing original witnesses and refuses foreign tokens", () => {
  const frame = tokenFrame([
    cell("specific", SPECIALIZES, "general", { for: ["classification"] }),
    cell("general", "promises", "service", { for: ["provider-evidence"] }),
    cell("specific", "promises", "service", { against: ["buyer-evidence"] }),
    cell("specific", "promises", "other-service", { for: ["different-claim"] }),
  ]);
  const fiber = inheritedClaim(frame, "specific", "promises", "service");
  assert.equal(fiber.cells.length, 1);
  assert.deepEqual(fiber.cells[0].for, ["provider-evidence"]);
  assert.deepEqual(fiber.cells[0].against, ["buyer-evidence"]);
  assert.deepEqual(fiber.contested[0].for, ["general"]);
  assert.deepEqual(fiber.contested[0].against, ["specific"]);
  assert.deepEqual(fiber.sources[0].map(({ token }) => token), ["general", "specific"]);
  const unknown = inheritedClaim(frame, "specific", "promises", "never-told");
  assert.deepEqual(unknown.cells, []);
  assert.deepEqual(unknown.sources, []);
  assert.deepEqual(unknown.contested, []);
  assert.throws(() => inheritedClaim(frame, "unadmitted-token", "promises", "service"), /not a token/u);
  assert.throws(() => inheritedClaim(frame, "specific", "promises", undefined), /object must be present/u);
});
