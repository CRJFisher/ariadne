---
id: TASK-376.31
title: Refuse a measured arm whose built packages are older than their source
status: Done
assignee: []
created_date: '2026-09-27 18:55'
updated_date: '2026-09-27 19:03'
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

1. Add a build-freshness check to `benchmark_corpus_load/`. A checkout's builds are current when the checkout's own TypeScript, asked through `tsc -b packages/core/tsconfig.build.json --dry`, would build neither `packages/core` nor the `packages/types` it references; when the built worker entry exists; and when every `.scm` query file in `dist` is byte-identical to its source. The TypeScript check compares content, not timestamps: a `git checkout` that only touches a file leaves the build current, while comparing timestamps would refuse that tree until its content changed, and rebuilding would not clear the refusal because core's `tsc -p` does not rewrite an unchanged build info.
2. Have `run_load_benchmark.ts` run the check on an arm's checkout before spawning its child, and on both checkouts before the first arm of an interleaved run, and refuse to run when a build is stale. The refusal names the stale package and the command that rebuilds it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The harness refuses to run any arm whose `packages/core` or `packages/types` build is missing or does not match its source, before spawning a child, naming the package and the rebuild command.
- [x] #2 A freshly built checkout passes the check, and so does one whose sources were only touched. Test files and files the build excludes do not count as source.
- [x] #3 Tests cover a current build, a touched but unchanged source, an edited source, a missing built entry, and a query file that differs from its copy in `dist`.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What the capability surface gained

A measured arm can no longer run over a checkout whose built `packages/core` or `packages/types` differs from its source. The harness refuses before spawning the arm, and before an interleaved run's first arm for both checkouts, naming each stale package and the `npm run build` that fixes it, types first.

## Decisions

- **Content, not timestamps.** Measured on this tree: after a `touch` of a core source, core's `tsc -p` build leaves `tsconfig.build.tsbuildinfo` unwritten, so a timestamp check would refuse forever and no rebuild would clear it. `tsc -b --dry` hashes content and reports a touched file as "would update timestamps" rather than "would build", so the checkout's own TypeScript decides.
- **TypeScript's answer is taken whole.** An edit to types that leaves its declarations unchanged makes only types stale; core is "up to date with .d.ts files from its dependencies", and the refusal names types alone.
- **Fail closed on unreadable output.** A dry run that does not list its projects throws rather than passing as current.

## Evidence

- `build_freshness.test.ts` builds a two-package fake checkout with the real compiler and covers current, touched, test-and-excluded-only edits, core edited, types edited, both edited (build order), missing worker entry, and a differing `.scm` copy.
- End to end: `--interleave` over 20 express files ran on a fresh build; after appending one line to `project.ts`, the same command refused before spawning any arm.
<!-- SECTION:NOTES:END -->
