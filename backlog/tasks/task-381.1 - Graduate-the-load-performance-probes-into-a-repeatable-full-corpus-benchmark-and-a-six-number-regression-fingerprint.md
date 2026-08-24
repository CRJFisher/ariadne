---
id: TASK-381.1
title: "Graduate the load-performance probes into a repeatable full-corpus benchmark and a six-number regression fingerprint"
status: To Do
assignee: []
created_date: "2026-08-24 09:07"
labels:
  - test-infra
  - performance
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`packages/core/src/project/project.bench.test.ts` times `update_file` over a synthetic 80-line file repeated 50 times and then asserts `expect(avg_time).toBeGreaterThan(0)`. It documents nothing and catches nothing. Every measurement behind this epic was taken by throwaway scripts against a checked-out copy of microsoft/vscode, and none of them can be re-run by the next person to touch the load path.

The harness has to encode why measuring this codebase is hard. Wall clock on a shared box is scheduling, not work: the full-corpus runs on an idle box recorded cpu/wall between 0.97 and 1.09, while runs on the same hardware under load recorded 0.04 to 0.5 at loadavg 100-273 against 4 CPUs — and the 11.23-hour baseline figure is a wall number taken at roughly 5x oversubscription. So serial arms are judged on `process.cpuUsage`, arms are interleaved A,B,A,B in separate processes, slices are nested so cost-per-file curves are comparable across n, and loadavg and cpu/wall are recorded on every row.

It also has to enforce two rules learned expensively. First, a corpus-scale claim requires a corpus-scale run: every power-law fit made during this investigation under-predicted in the same direction (a fit over n<=1,847 predicted 355 s against 778 s measured, and the same method applied to the unpatched build predicts 1.4 h against 11.23 h observed). Second, a corpus-derived constant is meaningless without its input: the harness records the corpus commit, the discovery predicate, the file count that predicate yields, and the Ariadne commit on every row. The corpus at f3fa55c3 holds 8,451 `.ts` files under `src/` excluding `.d.ts` and 8,648 including them, while Ariadne's walk discovers 8,494 — three numbers for one repository, and no task may assert one without naming which.

Alongside that, the harness must record the resolved grammar versions on every row: two measurement worktrees silently resolved tree-sitter 0.21.1 and tree-sitter-typescript 0.21.2 from hoisted copies instead of the 0.25.0 and 0.23.2 a normal checkout uses, and the ~40 grammar test failures both reports waved off as environmental were exactly that.

The regression guard is six values taken together: sorted node ids, sorted caller-to-callee pairs, the unresolved-call count, sorted raw `trace_call_graph` entry points, sorted `indirect_reachability` keys, and the sorted dropped-file set. The dropped set belongs in it because it grows from 1 to 3 to 8 files across n=100/120/200, and a guard compared across differently-sized slices means nothing without it. Crucially the guard must not be a test that never runs: the vscode corpus is absent in CI and in most checkouts, so the fingerprint mechanism runs there against an in-repo fixture corpus with a committed expected value, and only the corpus-scale rows skip. TASK-370 exists because vacuous assertions in this repo have shipped before. The standing acceptance rule for every performance change in this epic is `only_baseline == 0` on edges, at a fixed ingest order, with TASK-381.11 owning the order question itself.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 #1 `project.bench.test.ts` is replaced by a harness whose every row carries cpu_user_ms, wall_ms, cpu/wall, loadavg, peak RSS and the resolved tree-sitter and tree-sitter-typescript versions; no assertion of the form `expect(x).toBeGreaterThan(0)` remains.
- [ ] #2 #2 The harness emits the six-number fingerprint and has a compare mode reporting only_baseline and only_candidate per component.
- [ ] #3 #3 Arms are interleaved A,B,A,B across separate processes, and a documented smoke run reproduces the baseline on the first 200 path-sorted `.ts` files of `src/vs/base` at corpus commit f3fa55c3 on Ariadne commit 12458246: 191 indexed, 9 dropped, 4,917 nodes, 1,673 raw entry points.
- [ ] #4 #4 Slices are nested by construction (50 within 100 within 200 within 1,200 within 2,000) and a full-corpus mode offers every discovered file to one process.
- [ ] #5 #5 A three-order mode runs the same file set forward, reversed and shuffled under a recorded seed, and diffs the fingerprint across all three runs.
- [ ] #6 #6 The harness refuses to compare two rows whose tree-sitter or tree-sitter-typescript versions differ, and the documented worktree setup symlinks `node_modules` from the primary checkout.
- [ ] #7 #7 The documentation states the unit rule and the reason for it — serial arms judged on CPU, worker-pool arms on wall taken on an idle box with CPU reported alongside, wall under contention never a measurement — and states that no corpus-scale figure is accepted without a corpus-scale run, citing the 2.19x and 16.8x fit errors.
- [ ] #8 #8 The corpus path is configurable, defaults to the checked-out microsoft/vscode location, and the corpus-scale ROWS skip cleanly when it is absent.
- [ ] #9 #9 The fingerprint computation and its compare mode run in CI against an in-repo fixture corpus on every test run, with a committed expected fingerprint, so the guard is non-vacuous where the vscode corpus is absent (TASK-370's rule). Only the corpus-scale rows skip; the mechanism never does.
- [ ] #10 #10 Every recorded row names the corpus commit, the discovery predicate that produced the file list, the file count it produced, and the Ariadne commit — the corpus at f3fa55c3 holds 8,451 `.ts` under `src/` excluding `.d.ts`, 8,648 including, while Ariadne discovers 8,494, and no task may assert a file count without naming its predicate.
- [ ] #11 #11 The hash functions behind the fingerprint are themselves pinned by a unit test over a synthetic fixture, so a hash-function change cannot silently invalidate every recorded baseline.

<!-- AC:END -->
