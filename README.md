# SignGraph

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->
<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

A general graphing library whose semantic specialization organizes the assembled bilattice as a Chu space:
points (SignCell's cells, and the things they are addressed by) against
observations (attributes, queries, indexes) under an evaluation, with Chu
morphisms (forward map, backward demand, adjointness) as the contract
between two organizations.

A contract of data carried between parties, with demand transported back, is
what networking is.

## What lives here

- `./cell-graph`: `cellGraph(cells, observations)` builds the Chu-space
  relation of a cell set under a list of named, total observations
  (`{ name, evaluate(cell) }`).
- `./graph`: the deterministic typed directed-multigraph carrier and its
  traversal, cycle, path, merge, and text-rendering operations.
- `./relation-adapters`: projections from already-parsed Markdown, JavaScript,
  and EAVT evidence into relation observations.
- `./pam`: graph-backed predicate-algebra modeling.
- `./semantic-graph`, `./cellular-sheaf`, `./token-sheaf`: semantic graphs and
  sheaf structures over them.

The [package manifest](package.json) lists every export, and the
[source guide](src/README.md) documents them in full.

## Install

Packages are published to the 561 Group registry, which serves them without
authentication. Node.js 24.2 or later is required.

```sh
npm install @red-cup-engineering/signgraph --registry=https://registry.561.group/
```

## Depends on

Metrologic for mathematics, SignCell for cells, and SignChain for cell order and
FOUR evidence profiles. Nothing here imports SignCraft; SignCraft imports this.
