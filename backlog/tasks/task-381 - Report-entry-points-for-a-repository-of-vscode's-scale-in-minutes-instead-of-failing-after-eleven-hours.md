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

Pointed at microsoft/vscode, Ariadne does not produce an answer. The baseline run spent 11.23 hours and then died — `Ineffective mark-compacts near heap limit` — at file 6,634 of 8,494 discovered. The 78% it managed to index describes a corpus with 603 files (7.10%) silently discarded by `ExportRegistry`, 36.5% of internal import edges pointing at one of those discarded files, and an entry-point list that changes when you rename a directory. The capability this codebase exists for — point it at a repository, get its entry points — does not exist at this scale.

## What has since been measured, not projected

The change set in TASK-381.2 through TASK-381.6 has been built and run over the whole corpus in one process: 773.8 s and 781.4 s of CPU in two independent runs (mean 777.6 s = 12.96 min, CV 0.69%), byte-identical entry-point, node and edge hashes, peak RSS 7.83 GB, 7,891 of 8,494 discovered files indexed. So this epic is no longer an argument from small slices. It also settles two questions the earlier plan left open: whether `ResolutionState` eviction is a cold-path cost (it is 2.9% of the load, not the 27% the profile appeared to say) and whether the corpus fits in memory at all (it does, at 7.83 GB, once the flattened name table is gone).

## On file counts

8,494 is the output of Ariadne's discovery walk, not a fact about the corpus. At commit f3fa55c3 microsoft/vscode holds 8,451 `.ts` files under `src/` excluding `.d.ts`, 8,648 including them, and 12,557 repo-wide. No criterion in this epic asserts a literal count without naming the predicate that produces it; the criterion that matters is an empty `dropped_files` set and a zero gap between discovered and indexed.

## Retired method

Every power-law extrapolation made during this investigation was optimistic in the same direction: a fit over n<=1,847 predicted 355 s against the 778 s measured (2.19x), and the same method applied to the unpatched build predicts 1.4 h against the 11.23 h actually observed (16.8x). Fits cannot see the GC wall. No corpus-scale number is accepted in this epic that has not been run at corpus scale. The scale-validation document's 855 s / 14.24 min projection for a repaired gate is likewise superseded: it added the 603 files back at the local marginal without knowing that removing the gate also removes the 370.9 s rollback cascade.

## Root cause of what is left

`ExportRegistry.update_file` throws `Duplicate export name` when a value and a type share an export name (`packages/core/src/resolve_references/registries/export.ts:164`) — 633 pairs of `export const IFoo = createDecorator<IFoo>()` beside `export interface IFoo`, vscode's dependency-injection idiom, legal TypeScript in two declaration spaces. `load_project` catches it and calls `project.remove_file` (`packages/core/src/project/load_project.ts:263-265`), which re-resolves the dropped file's dependents. The file has already been parsed, indexed and registered by then. Measured at full corpus on the built stack, both arms instrumented identically: 833.3 s with the gate active against 423.4 s with the 603 gate-dropping files never offered, for the same 7,891 files, the same 183,018 nodes and the same 19,917 entry points. That is 409.9 s — 49.2% of the load — and 1.84x the peak RSS, spent indexing files that are then discarded and re-resolving the project around their absence. The repair itself has never been built or measured; only the cost of the status quo has.

## The real target, stated honestly

Ten minutes of cold CPU is reachable and roughly ten minutes of cold wall is not, on the machines this was measured on. After the export-gate repair the corpus lands at about 495 s of CPU (ceiling 520 s) for all discovered files, anchored on the measured 423.4 s plus 603 files at the measured marginal plus the only figure ever measured for the repair logic itself (+7.2% of cold load). On an idle 4-core box wall equals CPU, because the load is single-threaded. On the contended machine that produced the 11.23-hour figure, cpu/wall ran 0.2-0.5 and as low as 0.04, so the same work is roughly half an hour of wall. The commitment this epic can make is: it finishes, it reports every file, it fits under 5 GB at node's default heap ceiling, and it costs under 520 s of CPU after TASK-381.8 and under 420 s after TASK-381.13/14/15. Wall-clock minutes belong to TASK-381.17 and are quoted only on an idle box.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 #1 Every file selected by Ariadne's discovery walk over microsoft/vscode at commit f3fa55c3 is indexed and reported, with an empty `dropped_files` set and a zero gap between discovered and indexed — 8,494 discovered under today's predicate, of which 603 (7.10%) are discarded and 34,085 of 93,409 internal import edges point at one of them. The criterion is the empty set and the zero gap, not the literal 8,494.
- [ ] #2 #2 Cold serial load of every discovered file costs <= 520 s CPU on an otherwise-idle 4-core box once TASK-381.8 lands, and <= 420 s once TASK-381.13, 381.14 and 381.15 land — against 777.6 s measured for 7,891 files today and 11.23 h then OOM before this epic. Each figure comes from a run of every discovered file.
- [ ] #3 #3 Peak RSS over the full corpus is <= 5 GB, against 7.83 GB measured today, and the run completes under node's default old-space ceiling on a 16 GB box with no heap flag passed by the user and none set by Ariadne.
- [ ] #4 #4 `kill -9` mid-load then restart reuses every blob written before the kill — measured 0 of 87 today — and produces a byte-identical call graph at the same ingest order.
- [ ] #5 #5 The six-number fingerprint is identical across forward, reversed and seeded-shuffle ingest of the same corpus, with the seed recorded; today the unpatched build itself moves by two entry points (3,701 forward against 3,699 reversed at n=1,000).
- [ ] #6 #6 Every corpus-scale figure this epic claims comes from a run of every discovered file. No power-law fit is accepted as evidence, the two recorded fit errors (2.19x and 16.8x optimistic) being the reason, and the superseded 855 s projection is recorded as superseded rather than silently dropped.
- [ ] #7 #7 Every budget names its unit where it is stated — CPU-seconds on an idle box for serial arms, wall-seconds on an idle box for the worker-pool arm — and no comparison anywhere rests on wall clock taken under contention.
- [ ] #8 #8 Every corpus-derived constant in this epic's tasks names the corpus commit, the discovery predicate, the resulting file count and the Ariadne commit it was measured on.

<!-- AC:END -->
