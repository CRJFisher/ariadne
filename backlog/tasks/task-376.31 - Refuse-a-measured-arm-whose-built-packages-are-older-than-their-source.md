---
id: TASK-376.31
title: Refuse a measured arm whose built packages are older than their source
status: To Do
assignee: []
created_date: '2026-09-27 18:55'
labels:
  - measurement
dependencies: []
parent_task_id: TASK-376
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Root cause

A measured arm runs the checkout's resolver from source, but two parts of it run built code:

- **Indexing.** The indexing pass runs on worker threads that always load the compiled `packages/core/dist` (`dispatch_to_workers.ts`).
- **Types.** `@ariadnejs/core` imports `@ariadnejs/types` through the package entry, which is `packages/types/dist`.

When either build is older than its source, the arm measures a mix of two trees: today's resolver over yesterday's indexer or types. Nothing says so. The numbers come out plausible and wrong. TASK-376.25's first measurements were invalid for exactly this reason. Both its candidate and its control had stale builds, and it took a re-run against freshly built trees to notice. A stale types build can also fail outright, when source calls a function the build does not yet export.

## Work plan

1. Add a build-freshness check to `benchmark_corpus_load/`. A package's build is current when its `dist` exists, its build info is at least as new as every non-test source file under `src/`, and every `.scm` query file is at least as new in `dist` as in `src`. It covers `packages/core` and `packages/types`.
2. Have the parent of `run_load_benchmark.ts` run the check on every arm's checkout before it spawns any child, and refuse to run when a build is stale. The refusal names the stale package, the newest source file that outdates it, and the command that rebuilds it. A single-arm run is checked the same way.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The harness refuses to run any arm whose `packages/core` or `packages/types` build is missing or older than its source, before spawning a child, naming the package, the newest source file, and the rebuild command.
- [ ] #2 A freshly built checkout passes the check, and test files do not count as source.
- [ ] #3 Unit tests cover a current build, a missing `dist`, a source file newer than the build info, and a query file newer than its copy in `dist`.
<!-- AC:END -->
