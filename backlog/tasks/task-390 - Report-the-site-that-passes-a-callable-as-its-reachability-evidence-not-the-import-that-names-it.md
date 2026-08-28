---
id: TASK-390
title: "Report the site that passes a callable as its reachability evidence, not the import that names it"
status: To Do
assignee: []
labels:
  - call-graph
  - diagnostics
dependencies:
  - TASK-381.11
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

A function reported as indirectly reachable comes with one piece of evidence:
the place it was read as a value. That evidence is what a user reads to decide
whether Ariadne is right — "this is not dead, here is where it is handed
somewhere". For an imported callable the evidence now names the import
statement, which tells the user only that the file imports it. The collection
that holds it, when there is one, is not named at all.

Over the ten-file in-repo benchmark corpus, eight of ten evidence tuples name an
import specifier, and three of those — `increment`, `alpha`, `beta` — say
`function_reference` where a `collection_read` naming the array that stores them
is the informative answer. Membership does not move: every one of those
functions is indirectly reachable either way, and the entry-point set is
unchanged.

## Why it reads this way

The reachability map holds one entry per function and TASK-381.11 made the
winner the read site earliest in the project — file path, then position. That is
what makes the answer a function of the corpus rather than of the order files
were ingested in, and it is not negotiable. But an import statement sits above
every use in its file, and importing a callable IS a read of it, so the import
wins the position rule wherever the callable is imported at all.

## What has to hold

A rule that prefers a use site over an import site, and a collection read over a
bare reference, without reopening the walk: the winner must still be a function
of the corpus, decided by a total order that ranks the KIND of evidence before
its position rather than after. `record_indirect_reachability`
(`resolve_references/indirect_reachability.ts`) is the single writer and the only
place the rule lives.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Evidence for a function read both at an import specifier and at a genuine use site names the use site, and evidence for a function stored in a collection names the collection, whatever order the corpus is ingested in.
- [ ] #2 The seven-number fingerprint is byte-identical across forward, reverse, descending-byte-size and seeded-shuffle ingest of vscode's `src/` after the change, with the `indirect_reachability_evidence` component re-baselined and every moved member accounted for.
- [ ] #3 The in-repo corpus guard's committed member list is re-derived by reading the corpus, not by pasting a run's output, and its eight import-specifier tuples become use-site or collection tuples.
- [ ] #4 `indirect_reachability_keys` is unchanged by the change: this moves which evidence is reported, never which functions are reachable.

<!-- AC:END -->
