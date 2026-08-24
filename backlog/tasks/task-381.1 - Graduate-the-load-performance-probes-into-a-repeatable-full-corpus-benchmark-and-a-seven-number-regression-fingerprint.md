---
id: TASK-381.1
title: "Graduate the load-performance probes into a repeatable full-corpus benchmark and a seven-number regression fingerprint"
status: To Do
assignee: []
created_date: "2026-08-24 09:07"
labels:
  - test-infra
  - performance
  - determinism
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`packages/core/src/project/project.bench.test.ts` times `update_file` over a synthetic 80-line file repeated 50 times and then asserts `expect(avg_time).toBeGreaterThan(0)`. It documents nothing and catches nothing. Every measurement behind this epic was taken by throwaway scripts against a checked-out copy of microsoft/vscode, and none of them can be re-run by the next person to touch the load path.

The harness has to encode why measuring this codebase is hard. Wall clock on a shared box is scheduling, not work: full-corpus runs on an idle box recorded cpu/wall between 0.97 and 1.09, while runs on the same hardware under load recorded 0.04 to 0.5 at loadavg 100-273 against 4 CPUs, and the 11.23-hour baseline figure is a wall number taken at roughly 5x oversubscription. So serial arms are judged on `process.cpuUsage`, arms are interleaved A,B,A,B in separate processes, slices are nested so cost-per-file curves are comparable across n, and loadavg and cpu/wall are recorded on every row. A harder rule has since been learned: absolute CPU is machine-bound and does not transfer even between two runs of provably identical computation. One arm producing byte-identical structural output — 7,891 files indexed, 603 dropped, 183,018 nodes, 1,502,343 call refs, 26,610 indirect entries — measured 777.6 s, 801.3 s and 1,019.4 s in three different sessions. Every ratio this epic states must therefore come from an interleaved control arm run in the SAME session, and a speedup taken by dividing into a number from another session is inadmissible: the export-gate repair's 2.202x became 1.570x when someone built their own control.

The regression guard is SEVEN values taken together, not six: sorted node ids, sorted caller-to-callee pairs, the unresolved-call count, sorted raw `trace_call_graph` entry points, sorted `indirect_reachability` keys, the sorted dropped-file set, and — the seventh — the hash of the full `get_call_graph().indirect_reachability` evidence tuples (fn id, reason type, collection id, read site). The seventh is not decoration: an order-dependence in which read site got recorded as a function's reachability evidence survived the six-number fingerprint entirely, because it never moves entry-point membership, and it took four writers converted to a single position-ordered writer to close. The dropped set belongs in it because it grows from 1 to 3 to 8 files across n=100/120/200, and a guard compared across differently-sized slices means nothing without it. Crucially the guard must not be a test that never runs: the vscode corpus is absent in CI and in most checkouts, so the fingerprint mechanism runs there against an in-repo fixture corpus with a committed expected value, and only the corpus-scale rows skip. TASK-370 exists because vacuous assertions in this repo have shipped before.

A corpus-derived constant is meaningless without its input, and this corpus has at least four defensible file counts. At f3fa55c3 microsoft/vscode holds 8,451 `.ts` files under `src/` excluding `.d.ts` and 8,648 including them; Ariadne's walk over `src/` discovers 8,494; and `find_source_files` pointed at the REPOSITORY ROOT — which is what `load_project({project_path})` does with no folder filter — discovers 12,654 indexable files, a corpus that costs 1,653.9 s of CPU against the 510.3 s of `src/`. Every phase-2 and phase-3 number in this epic refers to the 8,494-file `src/` corpus, and the two corpora give opposite answers to the ten-minute question, so a row without its predicate is not a measurement. The harness must also record the resolved grammar versions on every row: two measurement worktrees silently resolved tree-sitter 0.21.1 and tree-sitter-typescript 0.21.2 from hoisted copies instead of the 0.25.0 and 0.23.2 a normal checkout uses, and the ~40 grammar test failures both reports waved off as environmental were exactly that.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `project.bench.test.ts` is replaced by a harness whose every row carries cpu_user_ms, wall_ms, cpu/wall, loadavg, peak RSS, the heap cap, the machine and node version, and the resolved tree-sitter and tree-sitter-typescript versions; no assertion of the form `expect(x).toBeGreaterThan(0)` remains.
- [ ] #2 The harness emits the SEVEN-number fingerprint — node ids, caller-to-callee pairs, unresolved-call count, raw entry points, `indirect_reachability` keys, dropped-file set, and the hash of the `indirect_reachability` evidence tuples (fn id, reason type, collection id, read site) — and has a compare mode reporting only_baseline and only_candidate per component. The seventh number is mandatory: an order-dependence in the recorded read site survived the six-number version undetected, because it does not move entry-point membership.
- [ ] #3 Arms are interleaved A,B,A,B across separate processes, and a documented smoke run reproduces the baseline on the first 200 path-sorted `.ts` files of `src/vs/base` at corpus commit f3fa55c3 on Ariadne commit 12458246: 191 indexed, 9 dropped, 4,917 nodes, 1,673 raw entry points.
- [ ] #4 Slices are nested by construction (50 within 100 within 200 within 1,200 within 2,000) and a full-corpus mode offers every discovered file to one process.
- [ ] #5 A multi-order mode runs the same file set forward, reversed, descending by file byte size, and shuffled under a recorded mulberry32 seed, and diffs the seven-number fingerprint across all runs. Descending byte size is required and not optional: it scrambles directory locality and reverses the arrival order of the large exported-singleton modules, and it was the order that produced 31 moved entry points (17,994 -> 17,973) on a tree that forward-versus-reverse alone showed moving by 35.
- [ ] #6 The multi-order mode is validated against a KNOWN order-dependent tree before its silence counts as evidence, and the harness records that validation. MEASURED baseline for it: on the pre-TASK-381.11 tree, forward against descending-size over the same 8,494 files changes four of five hashes (eps 2871be58c0912b33 -> 1a37eaf1fa981f39, refs f9e8492f0cea5259 -> 9d95928ba096f9dd, resolved e5a73a35585a557a -> 4e9638caeebb87af, indirect ee8d2ebd22195046 -> da566426656b7501) while the node hash 8d099b5bb8f8f9fa stays identical.
- [ ] #7 The harness refuses to compare two rows whose tree-sitter or tree-sitter-typescript versions differ, AND refuses to compute a ratio between two rows taken in different sessions or on different machines. The reason is recorded with the numbers: one arm with byte-identical structural output (7,891 indexed, 603 dropped, 183,018 nodes, 1,502,343 refs, 26,610 indirect) measured 777.6 s, 801.3 s and 1,019.4 s in three sessions, and a speedup taken across sessions was wrong by 40% (2.202x claimed, 1.570x measured against a same-session control). The documented worktree setup symlinks `node_modules` from the primary checkout.
- [ ] #8 The documentation states the unit rule and the reason for it — serial arms judged on CPU, worker-pool arms on wall taken on an idle box with CPU reported alongside, wall under contention never a measurement — and states that no corpus-scale figure is accepted without a corpus-scale run, citing the 2.19x and 16.8x fit errors.
- [ ] #9 The corpus path is configurable and the harness records WHICH corpus a row is for, with both named predicates supported and their measured counts pinned: `src/` (8,494 discovered under Ariadne's walk; 8,451 `.ts` excluding `.d.ts`, 8,648 including) and the repository root (12,654 indexable files discovered by `find_source_files`). Rows for the two are never compared, because they answer the ten-minute question differently: 510.3 s of CPU against 1,653.9 s. Corpus-scale ROWS skip cleanly when the corpus is absent.
- [ ] #10 The fingerprint computation and its compare mode run in CI against an in-repo fixture corpus on every test run, with a committed expected fingerprint, so the guard is non-vacuous where the vscode corpus is absent (TASK-370's rule). Only the corpus-scale rows skip; the mechanism never does.
- [ ] #11 Every recorded row names the corpus commit, the discovery predicate that produced the file list, the file count it produced, the Ariadne commit, the machine and the node version — and no task in this epic may assert a file count or an absolute runtime without naming all six.
- [ ] #12 The hash functions behind the fingerprint are themselves pinned by a unit test over a synthetic fixture, so a hash-function change cannot silently invalidate every recorded baseline. Hashing must be streaming rather than via `join`: a full-corpus arm was lost to a V8 max-string-length blowup at 2M edges.
- [ ] #13 Peak RSS on any row is reported as a mean over >= 2 runs with the spread, never as a single figure, because peak RSS varies up to 61% run to run on one arm and inputs while settled heap is stable to 0.01%.

<!-- AC:END -->
