---
id: TASK-391
title: "Keep a function indirectly reachable when one of several files that read it is re-indexed"
status: To Do
assignee: []
labels:
  - call-graph
  - incremental
  - bug
dependencies:
  - TASK-381.11
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

Edit one file in a loaded project and a function that nothing in that file
touches can turn into a reported entry point — dead code that is not dead. It
comes back on the next full load, so the user sees a report that depends on
which files they have edited since opening the project.

## The mechanism

`remove_files` (`resolve_references/resolution_state.ts:239`) evicts an
indirect-reachability entry when the edited file matches
`entry.reason.read_location.file_path`. The map is keyed by the reachable
FUNCTION and holds ONE read site as its evidence, so that file path is the one
site that happened to be recorded — not the set of files that reach the
function. A function read as a value from ten files loses its entry when the one
recorded file is re-indexed, and the other nine reads do not put it back,
because nothing re-resolves them.

This is invisible to a bulk load: `resolve_corpus` resolves once after every
file is in the registries, so its evictions remove nothing at all. It is live on
the incremental edit path, which is the watcher and the MCP server.

TASK-381.11 made which read site is recorded a function of the corpus rather
than of the walk, so the entry that is lost is now predictable. It did not make
losing it correct.

## What has to hold

Eviction has to be driven by the set of files that reach the function, not by
one witness. The two shapes are a reverse index from file to the reachability
entries its reads produced, or re-deriving reachability for the affected files
after an eviction the way call resolution already re-derives its own.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A function read as a value from two files stays indirectly reachable after either file is re-indexed with its read intact, and stops being reachable only when the last read of it is gone. Guarded in `resolution_state.test.ts` against both files in both orders.
- [ ] #2 The entry-point set after re-indexing every file of a corpus one at a time equals the entry-point set of a cold load of that corpus. Measured over a slice of vscode's `src/`, stated with the file count.
- [ ] #3 The seven-number fingerprint of a cold load is unchanged by the fix: this is an incremental-path defect and a bulk load must not move.

<!-- AC:END -->
