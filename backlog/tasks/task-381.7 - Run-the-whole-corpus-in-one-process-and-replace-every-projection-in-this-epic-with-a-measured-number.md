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

Every figure the earlier plan rested on was taken at n <= 200 and every projection made from those figures was wrong in the same direction. This task is where the composed change set is run over every discovered file in one process, ON THE LANDED CODE, and the resulting numbers become the epic's baseline. It has been done several times on composed patches, and those runs are the evidence this task is measured against rather than a substitute for it.

The recorded runs are: 773.8 s and 781.4 s of CPU for TASK-381.2 through TASK-381.6 alone (mean 777.6 s, CV 0.69%, peak RSS 7.83 GB against 3.32 GB settled heap, 7,891 of 8,494 discovered files indexed, node v22.5.1, `--max-old-space-size=12288`); 462.9 s for that stack plus the export-gate repair (2 reps, CV 1.61%, 8,494/8,494 indexed); and 510.3 s for the stack plus the export-gate repair plus the location-index repair (5 reps, CV 3.29%, reps 500.3/501.6/502.5/507.0/540.0 s, peak RSS 5,367-6,511 MB). The unpatched build on the same corpus spent 11.23 hours and died at file 6,634 with `Ineffective mark-compacts near heap limit`.

The hardest lesson from those runs changes this task's shape. Absolute CPU for this workload is machine-bound and does not transfer. The stack-only arm produced byte-identical structural output in three separate sessions — 7,891 indexed, 603 dropped, 183,018 nodes, 1,502,343 call refs, 26,610 indirect entries, all four phase-2 graph fingerprints matching — and measured 777.6 s, 801.3 s and 1,019.4 s. So a fixed CPU ceiling is not a portable criterion, and the criterion below is restated as a same-session control-arm ratio plus a recorded absolute. Whoever repeats this must run their own control arm rather than dividing into a number from this file.

The run also settled the structural question the earlier plan carried as an open gate — whether `ResolutionState` eviction is a cold-path cost — and the answer is that the corpus batch's own resolution-state work is 24.0 s, 2.9% of the load, so the mutable-state redesign it would have triggered is not needed. What the run must record instead is where the time actually is, because that is what TASK-381.13, TASK-381.14 and TASK-381.15 are scoped from. The phase split that produced this task was export-gate rollback 44.5%, tree-sitter Node-boundary marshalling 29.3%, `resolve_calls_for_files` 5.7%, and `trace_call_graph` itself 652 ms of 773,779 — 0.08%. Entry-point detection is free; the whole cost is the load. The first of those terms is now zero: TASK-381.8 removes the rollback entirely and `Project.remove_file` is called zero times, so the split must be re-measured on the landed code rather than carried forward.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Every discovered file under vscode `src/` is offered to one process, the run completes, and one entry-point report is produced — against an unpatched run that died at file 6,634 of 8,494 after 11.23 h. MEASURED on composed patches: 8,494/8,494 indexed, `dropped_files` empty, in five independent processes.
- [ ] #2 REPLACES the `<= 850 s CPU` ceiling, which is REFUTED as a portable criterion: the same computation with byte-identical structural output measured 777.6 s, 801.3 s and 1,019.4 s in three sessions. The criterion is now (a) the absolute is recorded as a mean of >= 2 processes with CV, cpu/wall, loadavg, machine and node version, and (b) any improvement claim is a ratio against an interleaved control arm run in the SAME session. MEASURED for the composed stack: 510.3 s mean, CV 3.29%, cpu/wall 0.80-1.02, loadavg at arm start 2.8-29.2, on Darwin 21.6.0 / 4 cores / 16 GiB / node v22.23.2.
- [ ] #3 Peak RSS is recorded with the settled-heap figure alongside it, as a mean of >= 2 runs with the spread, because single-run RSS flaps by up to 61% on identical inputs. MEASURED: 7.83 GB resident against 3.32 GB settled for the stack alone (ratio 2.3x), and 4,172.0 against 3,563.8 MB after the export-gate repair (ratio 1.17x) — so the RSS-to-heap ratio is a measured pair, not a constant.
- [ ] #4 Independent processes produce byte-identical entry-point, node, call-reference, resolved-edge and indirect-reachability-evidence hashes — the seven-number fingerprint of TASK-381.1, not the six-number one. MEASURED for the composed stack across 5 processes, 3 ingest orders and 2 heap caps: eps 16055/99cd0823d5b346c7, nodes 195087/4f99991652e22825, refs 1545264/f6d811c2f4e12cbc, resolved 1481123/d6e8eb5aedf760f1, indirect 29363/506ef8c06d8bfbca.
- [ ] #5 The per-phase CPU split of the whole run is RE-MEASURED on the landed code — parse and index, `resolve_names`, `resolve_calls_for_files`, `resolve_callback_invocations`, drop rollback, `trace_call_graph` — in absolute CPU-seconds as well as shares. The split recorded when this task was written (rollback 44.5%, tree-sitter marshalling 29.3%, `resolve_calls_for_files` 5.7%, `trace_call_graph` 0.08%) is superseded in its largest term: TASK-381.8 takes drop rollback to zero, measured by a counter at 0 calls to `Project.remove_file`.
- [ ] #6 No projection is recorded as a result: every figure this task outputs comes from a run of every discovered file, and the corpus each figure refers to is named. Both predicates are recorded — `src/` (8,494 discovered, 510.3 s) and the repository root (12,654 discovered, 1,653.9 s, 7,492.8 MB peak RSS) — because they answer this epic's headline question differently.
- [ ] #7 SUPERSEDED, recorded rather than deleted: the gate-active versus gate-files-WITHHELD arms this task was to run as TASK-381.8's baseline are no longer the measurement. The export-gate repair exists and was measured against a real control arm — the identical stack with the repair reverse-applied — which is a stronger comparison because withholding files changes the input while reverse-applying the patch does not. The 833.3 s / 423.4 s withheld-file pair stands only as the estimate that first sized the problem; TASK-381.8 is judged against its own same-session control (1,019,390.4 ms and 801.3 s in two sessions).
- [ ] #8 The superseded 855 s / 14.24 min projection for a repaired gate is recorded as superseded, with its reason: it added 603 files back at the local marginal without knowing that removing the gate also removes the 370.9 s rollback cascade. MEASURED outcome: the repaired gate costs 462.9 s, not 855 s.

<!-- AC:END -->
