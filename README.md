# SignGraph

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

Relations, sites, fibers and sheaves organizing SignCell cells and SignChain orderings.

## Receiving a graph

`markdownFrontmatterClaims` from `@red-cup-engineering/signgraph/relation-adapters`
reads only configured, directly authored frontmatter fields. Use `predicateIds`
when a document field is a readable name for a separate canonical predicate
identifier. For example, with `relations: { instantiates: undefined }` and
`predicateIds: { instantiates: "urn:example:predicate:instantiates" }`, the
adapter emits the canonical predicate and records `instantiates` as the source
field in the evidence. If no identity is configured, the field name remains
the predicate. A nested field, inherited property, or similar label such as
`specialization` does not supply the configured relation.

Use `createSignGraph` to construct a closed cut and `admitSignGraph` to qualify
a portable cut. Queries and routes return the original addressed incidences.
`querySignGraphPage` binds cursors to their original cut and selection.
The [admission tests](test/graph-admission.test.mjs) use the public package
exports and run with `npm test`.

## Ports

Publish a vocabulary with `createPort` and seat it on cellular sources with
`createPortGraph`. Screen a native addressed delivery through
`inspectPortDelivery`. Run the authorized receiving transition at the
SignCell boundary, then supply its world to `recordPortDelivery`.
`composePortGraphs` combines cuts on a shared Port with their original
receipts and precedence constraints. See the [Port receiver tests](test/ports.test.mjs).

## Planning with an admitted graph

- `/semantic-graph` checks endpoint types. `createSignGraphPredicateReader`
  follows declared specialization and converse while returning the original
  source edge. `inspectSignGraphKinds` reports structural sources and sinks
  for selected predicates and counts paths over all declarations for the
  initial and terminal objects. `/fiber` supplies subject and object
  projections over the declared entity carrier.
- `/dependency-cone` runs over caller-selected relations. It reads causal
  horizons, rolls up attempt costs once per distinct attempt, and retains
  component failures in an endeavor. Workflow readouts report precedence,
  reachability and parallel waves and refuse unequal declared nesting
  boundaries. Attempts can carry distinct intended and realized states as
  typed relations. `/alexandrov` compares reachability constraints across
  plans on the same typed work items.
- `/work-settlement` reports witnessed declarations alongside settlement
  derived from witnessed obligations. Its dispatch fold ranks refusal ahead
  of contest, unknown and fit. The token frame and `/token-sheaf` let
  callers read inherited qualification evidence.
- Metrologic supplies finite valuation reindexing and closure-stage
  constructors. Use its regime order to compare declared regime classes.
  Regime classification requires evidence about the closure process,
  including continuity and cofinality where applicable.

## Place in the family

Metrologic supplies mathematics, SignCell supplies cellular structure and
addressed transitions, and SignChain supplies evidence ordering. SignGraph
supplies witnessed incidences, typed projection, and composition. Typed
Content and the Semiotic Content Address System supply type and carrier
contracts. SignCraft receives graph readouts for process and resource work.
Hosts supply transport, authentication, and persistence.

## Install

Packages are published to the 561 Group registry, which serves them without
authentication. Node.js 24.2 or later is required.

```sh
npm install @red-cup-engineering/signgraph --registry=https://registry.561.group/
```

## Status

The [implementation and receiving record](content/implementation.md) describes
the contracts, sources, and exercised consumers.

## Requirements

The peers this library must meet, then beat, are recorded in [requirements/](requirements/).
