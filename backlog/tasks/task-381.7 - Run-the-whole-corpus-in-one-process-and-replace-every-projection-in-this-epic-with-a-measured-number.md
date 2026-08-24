---
id: TASK-381.7
title: "Run the whole corpus in one process and replace every projection in this epic with a measured number"
status: To Do
assignee: []
created_date: "2026-08-24 09:07"
labels:
  - performance
  - memory
  - test-infra
dependencies:
  - TASK-381.4
  - TASK-381.5
  - TASK-381.6
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Every figure the earlier plan rested on was taken at n <= 200 and every projection made from those figures was wrong in the same direction. This task is where the composed change set — TASK-381.2 through TASK-381.6 — is run over every discovered file in one process, on the landed code, and the resulting numbers become the epic's baseline.

It has already been done once, on a composed patch rather than on landed code, and that is the evidence this task is measured against: 773.8 s and 781.4 s of CPU in two independent processes (mean 777.6 s = 12.96 min, CV 0.69%), byte-identical entry-point, node and edge hashes, peak RSS 7.83 GB against 3.32 GB of settled heap, 7,891 of 8,494 discovered files indexed, on node v22.5.1, serial, with `--max-old-space-size=12288`, at loadavg 3.7-7.6 and cpu/wall 0.97-1.09. The unpatched build on the same corpus spent 11.23 hours and died at file 6,634 with `Ineffective mark-compacts near heap limit`.

The run also answers the structural question the earlier plan carried as an open gate — whether `ResolutionState` eviction is a cold-path cost — and the answer is that the corpus batch's own resolution-state work is 24.0 s, 2.9% of the load, so the gate closes and the mutable-state redesign it would have triggered is not needed (recorded in TASK-381.5). What the run must record instead is where the time actually is, because that is what TASK-381.8, TASK-381.14 and TASK-381.15 are scoped from: export-gate rollback 44.5%, tree-sitter Node-boundary marshalling 29.3%, `resolve_calls_for_files` 5.7%, and `trace_call_graph` itself 652 ms of 773,779 — 0.08%. Entry-point detection is free; the whole cost is the load.

This task also supplies TASK-381.8's baseline, and it must do so in this checkout rather than leaving TASK-381.8 to be judged against figures taken on a composed patch. TASK-381.8's only dependency on this task is that baseline, so the export-gate implementation may proceed in parallel.

One thing this task must not do is quote a speedup ratio. At corpus scale there is no A/B to take: the unpatched build needs roughly 15.4 GB at its flat 1.95 MB/file and cannot complete on a 16 GB machine at all. The capability change is "does not finish" to "finishes", and stating it as a multiple would be inventing a denominator.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 #1 Every discovered file is offered to one process, the run completes, and one entry-point report is produced — against an unpatched run that died at file 6,634 of 8,494 after 11.23 h.
- [ ] #2 #2 Cold serial CPU is <= 850 s across two independent processes with CV <= 3%, measured as cpu_user with cpu/wall and loadavg on every row (773.8 s and 781.4 s, CV 0.69%, on the composed patch).
- [ ] #3 #3 Peak RSS is <= 8 GB and the settled-heap figure is recorded alongside it (7.83 GB and 3.32 GB on the composed patch), so the RSS-to-heap slack is a measured number rather than an assumption.
- [ ] #4 #4 The two processes produce byte-identical entry-point, node and edge hashes.
- [ ] #5 #5 The per-phase CPU split of the whole run is recorded — parse and index, `resolve_names`, `resolve_calls_for_files`, `resolve_callback_invocations`, drop rollback, `trace_call_graph` — with the two largest terms named (44.5% rollback and 29.3% tree-sitter marshalling in the run that produced this task), in absolute CPU-seconds as well as shares.
- [ ] #6 #6 No projection is recorded as a result: every figure this task outputs comes from a run of every discovered file, and no A/B ratio against the unpatched build is quoted, because that build cannot complete the corpus.
- [ ] #7 #7 The gate-active and gate-files-withheld arms are both run in this checkout on the landed code with identical instrumentation, and their CPU, peak RSS, indexed-file count, node count and entry-point count are recorded as TASK-381.8's baseline. TASK-381.8's targets are judged against these rows, not against the 833.3 s / 423.4 s figures taken on the composed patch.
- [ ] #8 #8 The superseded 855 s / 14.24 min projection for a repaired gate is recorded as superseded, with its reason: it added 603 files back at the local marginal without knowing that removing the gate also removes the 370.9 s rollback cascade.

<!-- AC:END -->
