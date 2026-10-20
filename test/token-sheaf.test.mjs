import assert from "node:assert/strict";
import test from "node:test";
import { cell, claimCoordinate, sidesOf } from "@red-cup-engineering/signcell/cell";
import { SPECIALIZES, generalizations, tokenFrame } from "@red-cup-engineering/signcell/token-frame";
import { possibilize, valuationOf } from "@red-cup-engineering/signchain/token-fiber";
import { inherited, inheritedClaim, queryInheritedTellings, tellingsAt } from "../src/token-sheaf.mjs";

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
      const queryKey = claimCoordinate(predicate, object);
      const slots = full.cells.flatMap((telling, index) =>
        claimCoordinate(telling.predicate, telling.object) === queryKey ? [index] : []);
      assert.equal(cut.kind, full.kind);
      assert.equal(cut.token, token);
      assert.deepEqual(cut.cells, slots.map((index) => full.cells[index]), `${token}: ${predicate}/${object}`);
      assert.deepEqual(cut.sources, slots.map((index) => full.sources[index]));
      assert.deepEqual(cut.contested, full.contested.filter((entry) =>
        claimCoordinate(entry.cell.predicate, entry.cell.object) === queryKey));
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
  assert.deepEqual(fiber.sources[0].map(({ token }) => token).sort(), ["general", "specific"]);
  const unknown = inheritedClaim(frame, "specific", "promises", "never-told");
  assert.deepEqual(unknown.cells, []);
  assert.deepEqual(unknown.sources, []);
  assert.deepEqual(unknown.contested, []);
  assert.throws(() => inheritedClaim(frame, "unadmitted-token", "promises", "service"), /not a token/u);
  assert.throws(() => inheritedClaim(frame, "specific", "promises", undefined), /object must be present/u);
});

test("indexed claim coordinates coincide across representational key order", () => {
  const original = { z: 2, a: { y: "two", x: "one" } };
  const equivalent = { a: { x: "one", y: "two" }, z: 2 };
  const frame = tokenFrame([
    cell("observed-token", "describes", original, { for: [{ source: "original", revision: 1 }] }),
    cell("observed-token", "describes", original, { against: [{ source: "counterevidence", revision: 2 }] }),
  ]);
  const fiber = inheritedClaim(frame, "observed-token", "describes", equivalent);
  assert.equal(fiber.cells.length, 1);
  assert.deepEqual(sidesOf(fiber.cells[0]), [true, true]);
  assert.equal(fiber.contested.length, 1);
  assert.equal(fiber.sources[0].length, 1,
    "two original tellings of one cell are knowledge-joined by SignCell, not counted as independent source tokens");
});

test("mutable wire token-frame presentations cannot retain stale claim-fiber indices", () => {
  const generated = tokenFrame([
    cell("specific", SPECIALIZES, "general", { for: ["classification"] }),
    cell("general", "requires", "release", { for: ["first"] }),
  ]);
  const wire = { kind: generated.kind, predicate: generated.predicate, cells: [...generated.cells] };
  const first = inheritedClaim(wire, "specific", "requires", "release");
  assert.deepEqual(first.cells[0].for, ["first"]);
  assert.deepEqual(first.cells[0].against, []);
  wire.cells.push(cell("general", "requires", "release", { against: ["second"] }));
  const updated = inheritedClaim(wire, "specific", "requires", "release");
  assert.deepEqual(updated.cells[0].for, ["first"]);
  assert.deepEqual(updated.cells[0].against, ["second"]);
  assert.equal(updated.contested.length, 1);
  const full = inherited(wire, "specific");
  assert.deepEqual(full.cells.find((at) => at.predicate === "requires").against, ["second"],
    "full-section and exact-claim reads both reobserve changed mutable sources");
});

test("nested claim mutation under a shallow-frozen wire frame cannot reuse stale Graph indexes", () => {
  const mutableObject = { state: "old" };
  const admitted = tokenFrame([
    cell("child", SPECIALIZES, "parent", { for: ["classification"] }),
    cell("parent", "reports", { state: "old" }, { for: ["provider"] }),
  ]);
  const wire = Object.freeze({
    kind: admitted.kind, predicate: admitted.predicate,
    cells: Object.freeze([
      admitted.cells.find((x) => x.predicate === SPECIALIZES),
      Object.freeze({
        subject: "parent", predicate: "reports", object: mutableObject,
        for: Object.freeze(["provider"]), against: Object.freeze([]),
      }),
    ]),
  });
  const earlier = inheritedClaim(wire, "child", "reports", { state: "old" });
  assert.equal(earlier.cells.length, 1);
  mutableObject.state = "new";
  assert.deepEqual(inheritedClaim(wire, "child", "reports", { state: "old" }).cells, []);
  const later = inheritedClaim(wire, "child", "reports", { state: "new" });
  assert.equal(later.cells.length, 1);
  assert.deepEqual(later.cells[0].for, ["provider"]);
});

test("one source-told sheaf supports cross-token typed queries and stable local pagination", () => {
  const frame = tokenFrame([
    cell("api", SPECIALIZES, "service", { for: ["classification-api"] }),
    cell("another-api", SPECIALIZES, "service", { for: ["classification-other"] }),
    cell("service", "has", "monitor", { for: ["catalog"] }),
    cell("api", "has", "monitor", { against: ["observed-incident"] }),
    cell("another-api", "has", "dashboard", { for: ["provider"] }),
    cell("api", "offers", "query", { for: ["creator"] }),
    cell("another-api", "offers", "query", { against: ["receiver"] }),
  ]);
  const claim = { predicate: "has", object: "monitor" };
  const whole = queryInheritedTellings(frame, claim, { limit: 128 });
  assert.equal(whole.kind, "signgraph.inherited-telling-query");
  assert.equal(whole.total, 3, "both specialized resources inherit the general service claim");
  assert.equal(whole.entries.filter((row) => row.reading === "stable").length, 1,
    "contradiction does not vanish in a broad query");
  const opposed = whole.entries.find((row) => row.token === "api");
  assert.deepEqual(opposed.cell.for, ["catalog"]);
  assert.deepEqual(opposed.cell.against, ["observed-incident"]);
  assert.deepEqual(opposed.sources.map((origin) => origin.token).sort(), ["api", "service"]);

  let next = 0;
  const paged = [];
  do {
    const page = queryInheritedTellings(frame, claim, { offset: next, limit: 1 });
    paged.push(...page.entries);
    next = page.next;
  } while (next !== null);
  assert.deepEqual(paged, whole.entries,
    "only original witnessed rows are paged, in the generated frame order");

  assert.equal(queryInheritedTellings(frame, {
    ...claim, reading: "stable",
  }).total, 1);
  assert.equal(queryInheritedTellings(frame, { predicate: "offers" }).total, 2);
  assert.equal(queryInheritedTellings(frame, { object: "query" }).total, 2);
  assert.equal(queryInheritedTellings(frame, { token: "api", predicate: "has" }).total, 1);
  assert.equal(queryInheritedTellings(frame, { predicate: SPECIALIZES }).total, 0,
    "a structural specialization generator is not relabeled as a witnessed claim");
  assert.equal(queryInheritedTellings(frame, { predicate: "no-such-claim" }).total, 0);
  assert.throws(() => queryInheritedTellings(frame, { token: "unauthorized" }),
    /not a token/u);
  assert.throws(() => queryInheritedTellings(frame, claim, { limit: 129 }),
    /noncanonical/u);
  assert.throws(() => queryInheritedTellings(frame, claim, { offset: 4 }),
    /outside admitted source/u);
  assert.throws(() => queryInheritedTellings(frame, { predicate: "has", reading: "proven" }),
    /noncanonical/u);
  const accessor = Object.defineProperty({}, "predicate", {
    enumerable: true, get() { throw new Error("not an admitted data field"); },
  });
  assert.throws(() => queryInheritedTellings(frame, accessor), /plain data fields/u);
});

test("paged source claims retain immutable original testimony across wire edits", () => {
  const object = { text: "before" };
  const frame = Object.freeze({
    kind: "signcell.token-frame", predicate: SPECIALIZES,
    cells: Object.freeze([Object.freeze({
      subject: "observed", predicate: "says", object,
      for: Object.freeze(["author"]), against: Object.freeze([]),
    })]),
  });
  const first = queryInheritedTellings(frame, { predicate: "says", object: { text: "before" } });
  assert.equal(first.total, 1);
  object.text = "after";
  assert.equal(first.entries[0].sources[0].cell.object.text, "before",
    "a query result holds the original source snapshot, not a mutable pointer");
  assert.equal(queryInheritedTellings(frame, {
    predicate: "says", object: { text: "before" },
  }).total, 0);
  assert.equal(queryInheritedTellings(frame, {
    predicate: "says", object: { text: "after" },
  }).total, 1);
});

test("page snapshots bind the measured specialization interpretation, not only an equal cell cut", () => {
  const cells = [
    cell("child", SPECIALIZES, "parent", { for: ["observed-hierarchy"] }),
    cell("parent", "can", "answer-token-query", { for: ["source-author"] }),
  ];
  const inheritedFrame = tokenFrame(cells, { predicate: SPECIALIZES });
  const independentFrame = tokenFrame(cells, { predicate: "other-specialization" });
  const selection = { token: "child", predicate: "can", object: "answer-token-query" };
  const inheritedPage = queryInheritedTellings(inheritedFrame, selection);
  const independentPage = queryInheritedTellings(independentFrame, selection);
  assert.equal(inheritedPage.total, 1);
  assert.equal(independentPage.total, 0,
    "changing the source-generator predicate changes the lawful answer");
  assert.equal(inheritedPage.sourceCells, independentPage.sourceCells,
    "both interpretations retain the same original source cell identity");
  assert.notEqual(inheritedPage.snapshot, independentPage.snapshot,
    "a query client must not reuse a page under a different frame law");
  assert.equal(inheritedPage.snapshot,
    queryInheritedTellings(inheritedFrame, selection).snapshot);
  assert.match(inheritedPage.snapshot, /^ni:\/\/\/sha-256;/u);
});

test("a deeply immutable transported frame may omit the canonical default predicate", () => {
  const generated = tokenFrame([
    cell("child", SPECIALIZES, "parent", { for: ["source"] }),
    cell("parent", "knows", "term", { for: ["witness"] }),
  ]);
  const wire = Object.freeze({ kind: generated.kind, cells: generated.cells });
  const original = queryInheritedTellings(generated, { token: "child", predicate: "knows" });
  const restored = queryInheritedTellings(wire, { token: "child", predicate: "knows" });
  assert.deepEqual(restored.entries, original.entries);
  assert.equal(restored.snapshot, original.snapshot,
    "omitting the declared default must not change the semantic page identity");
});
