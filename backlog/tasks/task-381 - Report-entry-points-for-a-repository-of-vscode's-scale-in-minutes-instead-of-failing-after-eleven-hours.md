---
id: TASK-381
title: "Report entry points for a repository of vscode's scale in minutes instead of failing after eleven hours"
status: To Do
assignee: []
created_date: "2026-08-24 09:07"
labels:
  - performance
  - memory
  - call-graph
  - architecture
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

Pointed at microsoft/vscode, Ariadne did not produce an answer. The baseline run spent 11.23 hours and then died — `Ineffective mark-compacts near heap limit` — at file 6,634 of 8,494 discovered. The 78% it managed to index described a corpus with 603 files (7.10%) silently discarded by `ExportRegistry`, 36.5% of internal import edges pointing at one of those discarded files, and an entry-point list that changed when you renamed a directory. That is now fixed and measured. With the change set of TASK-381.2 through TASK-381.6 plus the export-registry declaration-space key of TASK-381.8 and the definition-location-index repair of TASK-381.11, a cold load of vscode's `src/` tree indexes 8,494 of 8,494 files with an empty `dropped_files` set and zero calls to `Project.remove_file`, in 510.3 s of CPU — mean of five independent processes, CV 3.29%, reps 500.3 / 501.6 / 502.5 / 507.0 / 540.0 s, on a 4-core 16 GiB Darwin 21.6.0 box under node v22.23.2 shared with other work.

## Is it under ten minutes: yes for one corpus and no for the other

The answer splits on the corpus, not on the machine, and the split has to be stated or the headline is a lie. Over vscode's `src/` tree — the 8,494-file corpus every phase-2 and phase-3 number in this epic refers to — it is 8.51 minutes of CPU, and even wall clock came in under ten minutes on four of five reps (498-672 s). Over what `load_project({project_path})` actually discovers when pointed at the repository root, `find_source_files` returns 12,654 indexable files and the same stack costs 1,653.9 s of CPU (27.6 min) and 32.2 min of wall at 7,492.8 MB peak RSS. 49% more files costs 3.24x the CPU, so the flat growth this epic achieved holds inside the measured range and does not extrapolate past it. Any claim of "under ten minutes for vscode" must say `vscode/src`.

## The two rules this investigation cost the most to learn

First, no power-law extrapolation. Every fit made here was optimistic in the same direction: a fit over n<=1,847 predicted 355 s against 778 s measured (2.19x), and the same method applied to the unpatched build predicts 1.4 h against the 11.23 h observed (16.8x). Fits cannot see the GC wall. Second, and newer: absolute CPU is machine-bound and does not transfer between sessions. The stack-only arm produced byte-identical structural output in three separate sessions — 7,891 indexed, 603 dropped, 183,018 nodes, 1,502,343 call references, 26,610 indirect entries — and measured 777.6 s, 801.3 s and 1,019.4 s. A speedup taken by dividing into another session's number was wrong by 40%: the export-gate repair's 2.202x became 1.570x when an independent verifier built their own interleaved control arm. Every ratio in this epic must come from a same-session control.

## What the user gets, and what is still open

The capability improves rather than merely getting faster. Nothing is lost — the node set is a strict superset, 183,018 -> 195,087, with all 12,069 added nodes inside the 603 readmitted files — and resolved call edges rise 1,185,919 -> 1,481,123 (+295,204). Reported entry points fall 17,994 -> 16,055; measured at the resolution level, 6,020 raw candidates disappear and 100.0% of them gained an explicit incoming resolved call edge, while 1,947 appear and 100.00% are inside the readmitted files. The same seven-number fingerprint comes back whether files arrive in path order, reverse path order, largest-first or a seeded shuffle. Two commitments in the original plan are refuted and carried as corrections: peak RSS is 5,367-6,511 MB (mean 5,760.6 over five runs), not under 5 GB; and the run does NOT complete at node's default old-space ceiling — it OOMs after 666 s with a 3,563.8 MB live heap against a 4,144 MB cap, so an explicit `--max-old-space-size` of at least 6,144 MB is required (measured: 507.0 s, byte-identical fingerprint). Ariadne must not set that flag itself. Still open: cache resume (TASK-381.9), the per-file cost work (TASK-381.13/14/15) whose 420 s target remains unmeasured, wall-clock parallelism (TASK-381.17), and one file repo-wide still dropped and rolled back by a different gate — the scope-tree invariant, on `extensions/vscode-colorize-tests/test/colorize-fixtures/test6916.js`.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Every file selected by Ariadne's discovery walk over microsoft/vscode `src/` at commit f3fa55c3 is indexed and reported: 8,494 of 8,494, `dropped_files` empty, `Project.remove_file` called ZERO times, asserted by a counter and by `project.get_file_contents().size`. MEASURED in five independent processes across three ingest orders and two heap caps, against 7,891/8,494 with 603 drops and 603 rollbacks before TASK-381.8. Repo-wide the same stack indexes 12,653 of 12,654 and still drops one file through a DIFFERENT gate ("Malformed scope tree: multiple scopes at depth 1 contain location ..." on `extensions/vscode-colorize-tests/test/colorize-fixtures/test6916.js`), so this criterion is scoped to `src/` and that residual drop has its own follow-up.
- [ ] #2 Cold serial CPU over the `src/` corpus is <= 550 s per run, reported as a mean of >= 5 independent processes with CV, cpu/wall, loadavg, machine and node version. MEASURED 510.3 s mean, CV 3.29%, reps 500.3 / 501.6 / 502.5 / 507.0 / 540.0 s, cpu/wall 0.80-1.02, loadavg at arm start 2.8-29.2, Darwin 21.6.0 / 4 cores / 16 GiB / node v22.23.2. This REPLACES "<= 520 s after TASK-381.8 and <= 420 s after TASK-381.13/14/15": the 520 s figure is met by the composed stack today, and the 420 s figure has never been measured and remains those tasks' target rather than this epic's claim.
- [ ] #3 MEMORY CONTRACT, refuted and restated. The corpus does NOT complete at node's default old-space ceiling: it OOMs after 666 s of CPU at a 4,144 MB cap with a 3,563.8 MB settled heap, one 6,178 ms mark-compact recovering 0.4 MB, mu 0.005. `--max-old-space-size=6144` completes with a byte-identical fingerprint (507.0 s, peak RSS 5,367.4 MB). Peak RSS is 5,367.4 / 5,410.5 / 5,583.6 / 5,930.8 / 6,510.6 MB, mean 5,760.6 over five runs, so the bound is <= 6.6 GB stated as a mean of >= 2 runs. The `<= 5 GB at node's default heap` commitment is REFUTED in both halves. Ariadne adds no heap flag anywhere: a re-exec or `NODE_OPTIONS` hand-off would be a second execution path and would cover only the CLI.
- [ ] #4 `kill -9` mid-load then restart reuses every blob written before the kill — measured 0 of 87 today — and produces a byte-identical call graph at the same ingest order. UNMEASURED; owned by TASK-381.9.
- [ ] #5 The SEVEN-number fingerprint (entry points, nodes, call references, resolved edges and their hashes, plus the count and hash of the `indirect_reachability` evidence tuples) is identical across forward, reversed, descending-byte-size and seeded-shuffle ingest of the same corpus, with the seed recorded. MEASURED for the composed stack in five processes: eps 16055/99cd0823d5b346c7, nodes 195087/4f99991652e22825, refs 1545264/f6d811c2f4e12cbc, resolved 1481123/d6e8eb5aedf760f1, indirect 29363/506ef8c06d8bfbca. The six-number version is insufficient and is retired: an order-dependence in which read site was recorded as a function's reachability evidence survived it undetected.
- [ ] #6 The determinism probe is proven non-vacuous before its silence counts. MEASURED: the same probe on the pre-TASK-381.11 tree, forward versus descending-byte-size over the identical 8,494 files, moves 31 entry points (17,994 -> 17,973; 26 forward-only, 5 revsize-only) and changes four of five hashes while the node hash 8d099b5bb8f8f9fa stays identical, with the moved entry points clustering on the exported-singleton idiom (ime.ts x3, inputMode.ts, tabFocus.ts, onboardingRegistry.ts, implicitActivationEvents.ts, textAreaEditContextRegistry.ts).
- [ ] #7 Every corpus-scale figure comes from a run of every discovered file. No power-law fit is accepted as evidence (the recorded fit errors are 2.19x and 16.8x optimistic), the superseded 855 s projection for a repaired gate is recorded as superseded rather than dropped, AND no ratio is taken across sessions or machines: identical computation measured 777.6 s, 801.3 s and 1,019.4 s in three sessions with byte-identical structural output, and a cross-session speedup claim was wrong by 40% (2.202x claimed, 1.570x against a same-session control). Every improvement claim names its interleaved control arm.
- [ ] #8 Every budget names its unit where it is stated — CPU-seconds for serial arms, wall-seconds on an idle box for the worker-pool arm — and no comparison rests on wall clock taken under contention. Every "under ten minutes" claim names its corpus: `src/` at 8,494 files is 8.51 minutes of CPU; the repository root at 12,654 files is 27.6 minutes of CPU and 32.2 minutes of wall.
- [ ] #9 Every corpus-derived constant in this epic's tasks names the corpus commit, the discovery predicate, the resulting file count, the Ariadne commit, the machine and the node version. The four defensible counts for this repository are recorded together: 8,451 `.ts` under `src/` excluding `.d.ts`, 8,648 including them, 8,494 discovered by Ariadne's walk over `src/`, and 12,654 discovered by `find_source_files` at the repository root.
- [ ] #10 The reported graph is a strict improvement and not merely a different answer. MEASURED at full corpus: nodes 183,018 -> 195,087 with 0 lost; resolved call edges 1,185,919 -> 1,481,123 (+295,204); reported entry points 17,994 -> 16,055; and at the resolution level 6,020 raw candidates removed of which 100.0% gained an explicit incoming resolved call edge and 0 lost their node, against 1,947 added of which 100.00% lie inside the 603 readmitted files. The residual is <= 10 entry points and is a classifier effect in `enrich_call_graph`, not a resolution loss.

<!-- AC:END -->
