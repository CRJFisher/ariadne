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

- [ ] #1 Every discovered file under vscode `src/` is offered to one process, the run completes, and one entry-point report is produced — against an unpatched run that died at file 6,634 of 8,494 after 11.23 h. MEASURED on composed patches: 8,494/8,494 indexed, `dropped_files` empty, in five independent processes. RE-MEASURED on landed code (ariadne@25af64a8, microsoft/vscode@f3fa55c3, predicate `src`, 8,494 discovered, Darwin 24.6.0 / 6 cores / 32 GiB / node v22.22.1): **8,494 of 8,494 offered to one process and every process ran to completion**, in FIVE independent processes — three clean arms, one with phase-boundary wrappers installed, one under `--cpu-prof` — each producing one entry-point report of **19,816 raw entry points**. `dropped_files` is NOT empty on this tree and this criterion's second half does not hold here: **676 files are dropped and 7,818 indexed**, because the export gate is still in place. TASK-381.8 is what empties the set, and 676 rather than the prototype's 603 is the count it has to clear.
- [ ] #2 REPLACES the `<= 850 s CPU` ceiling, which is REFUTED as a portable criterion: the same computation with byte-identical structural output measured 777.6 s, 801.3 s and 1,019.4 s in three sessions. The criterion is now (a) the absolute is recorded as a mean of >= 2 processes with CV, cpu/wall, loadavg, machine and node version, and (b) any improvement claim is a ratio against an interleaved control arm run in the SAME session. MEASURED for the composed stack: 510.3 s mean, CV 3.29%, cpu/wall 0.80-1.02, loadavg at arm start 2.8-29.2, on Darwin 21.6.0 / 4 cores / 16 GiB / node v22.23.2. RE-MEASURED on landed code, and both halves are satisfied. (a) The absolute is **337.3 s of CPU, mean of three independent processes, CV 0.89%**, reps 340.75 / 337.70 / 333.44 s, cpu/wall 1.03-1.05, loadavg at arm start 3.1-4.5, on Darwin 24.6.0 / 6 cores / 32 GiB / node v22.22.1 at `--max-old-space-size=12288`. It is NOT comparable with the 510.3 s or 777.6 s above, which is the point of the criterion. (b) The improvement claim is a same-session ratio against an interleaved control arm — the tree this work started from, ariadne@2970604b, run control,candidate,control,candidate in one session, each arm running its own checkout's script: **1.52x at 200 files, 2.09x at 600 and 3.40x at 1,200**, both arms indexing and dropping identically at every slice. The control arm is run over nested slices and not over the corpus because that tree is the build that spent 11.23 h and died at file 6,634; the ratio rises with the file set, so none of these three is the corpus-scale ratio and no fit over them is admissible.
- [ ] #3 Peak RSS is recorded with the settled-heap figure alongside it, as a mean of >= 2 runs with the spread, because single-run RSS flaps by up to 61% on identical inputs. MEASURED: 7.83 GB resident against 3.32 GB settled for the stack alone (ratio 2.3x), and 4,172.0 against 3,563.8 MB after the export-gate repair (ratio 1.17x) — so the RSS-to-heap ratio is a measured pair, not a constant. RE-MEASURED on landed code over `src/`: peak RSS **7,177.6 MB, mean of three processes** (6,668.0 / 7,320.9 / 7,544.0, spread 12.2%, CV 5.18%) against a settled heap of **6,434.9 MB** (4,691.3 / 7,290.5 / 7,322.9, spread 40.9%, CV 19.16%). Over the repository root, 8,352.6 MB peak RSS against 8,299.8 MB settled, two processes. A second half of this criterion is REFUTED here: at a 12,288 MB ceiling the settled heap is not the stable member of the pair. The corpus never forces a full collection at that cap, so the closing `used_heap_size` reads the GC schedule — three processes computing a byte-identical result spread 40.9% — and no RSS-to-heap ratio may be quoted from this row at all.
- [ ] #4 Independent processes produce byte-identical entry-point, node, call-reference, resolved-edge and indirect-reachability-evidence hashes — the seven-number fingerprint of TASK-381.1, not the six-number one. MEASURED for the composed stack across 5 processes, 3 ingest orders and 2 heap caps: eps 16055/99cd0823d5b346c7, nodes 195087/4f99991652e22825, refs 1545264/f6d811c2f4e12cbc, resolved 1481123/d6e8eb5aedf760f1, indirect 29363/506ef8c06d8bfbca. RE-MEASURED on landed code: all seven components byte-identical across **five independent processes** over `src/` — nodes 184957/eee36b26277fd292, call edges 322300/ac7bfdba0b002ff8, unresolved calls 543967/33d7de4ce0a7030d, raw entry points 19816/9e8736700b47aa37, indirect-reachability keys 25811/16f2c4325fb5fba9, dropped files 676/003c1db7f45416b0, indirect-reachability evidence 25811/b87a2c5f358d23a4 — with the diagnostics pair (d73ce9fdb980ca14 / f5ad492280537a41) identical too, and across **both** repository-root processes (nodes 242533/c48b8f4bfd2fef9c, entry points 24805/e67ef60569bc75b5, dropped 995/9efaf8ac3659dc14). Two of those five processes carried the phase-boundary wrappers and the sampling profiler, so neither instrument changes what the run reports. Every prototype value above is superseded: the landed tree is not the composed patch set.
- [ ] #5 The per-phase CPU split of the whole run is RE-MEASURED on the landed code — parse and index, `resolve_names`, `resolve_calls_for_files`, `resolve_callback_invocations`, drop rollback, `trace_call_graph` — in absolute CPU-seconds as well as shares. The split recorded when this task was written (rollback 44.5%, tree-sitter marshalling 29.3%, `resolve_calls_for_files` 5.7%, `trace_call_graph` 0.08%) is superseded in its largest term: TASK-381.8 takes drop rollback to zero, measured by a counter at 0 calls to `Project.remove_file`. RE-MEASURED on landed code, over a run of all 8,494 files totalling 344,407.9 ms of CPU, each phase an exact `process.cpuUsage()` delta taken by a wrapper installed on the class prototype from outside the module (no production file touched): **parse and index (`Project.ingest_file`, 8,494 calls) 292,833.1 ms / 85.03%; the rest of the load 26,873.4 ms / 7.80%; `resolve_corpus` 24,074.6 ms / 6.99%, of which `resolve_calls_for_files` 13,928.7 ms / 4.04%, import-location fixing 7,074.4 ms / 2.05% and `resolve_names` 1,823.9 ms / 0.53%; drop rollback 187.1 ms / 0.05% over 676 calls; `trace_call_graph` 439.7 ms / 0.13%.** `resolve_callback_invocations` is module-local and cannot be wrapped from outside, so it is sampled in a second full-corpus run under `--cpu-prof`: 1,907.9 ms, 24.02% of the `resolve_calls_for_files` that contains it. The rollback term is already ZERO through the incremental API on this tree — **`Project.remove_file` is called 0 times** — but not because of TASK-381.8: TASK-381.4's two-phase driver rolls a failed ingest back through `evict_ingested_file`, which resolves nothing. The term the collapsed rollback uncovers is the tree-sitter node boundary: **51.28% of the load-and-trace subtrees** of the profiled run is spent in `get type`, `get parent`, `childForFieldName`, `unmarshalNode` and the position getters, against 7.59% in `Query.captures` and 5.00% in `Parser.parse`. That is what TASK-381.13 and TASK-381.14 are scoped from; resolution is not, at 4.57% for both resolution phases together.
- [ ] #6 No projection is recorded as a result: every figure this task outputs comes from a run of every discovered file, and the corpus each figure refers to is named. Both predicates are recorded — `src/` (8,494 discovered, 510.3 s) and the repository root (12,654 discovered, 1,653.9 s, 7,492.8 MB peak RSS) — because they answer this epic's headline question differently. RE-MEASURED on landed code, both predicates re-counted and both run to completion in this session: **`src/` — 8,494 discovered, 8,494 offered, 7,818 indexed, 676 dropped, 337.3 s of CPU over three processes at a 12,336 MB heap; repository root — 12,654 discovered, 12,654 offered, 11,659 indexed, 995 dropped, 1,105.7 s of CPU (CV 3.27%) over two processes at a 22,693 MB heap**, which the harness demands because 12,654 files need 18,116 MB by its own requirement. 49% more files costs **3.28x** the CPU, so the two answers stay opposite: 5.62 minutes of CPU and 5.42 of wall for `src/`, 18.43 and 18.49 for the root. The other two defensible counts were re-counted too — 8,451 `.ts` under `src/` excluding `.d.ts` and 8,648 including them. No figure in this task is a projection: every one comes from a run of every file its named predicate discovered, and each is recorded in `RECORDED_FULL_CORPUS_BASELINE` with its corpus commit, predicate, file count, Ariadne commit, machine and node version.
- [ ] #7 SUPERSEDED, recorded rather than deleted: the gate-active versus gate-files-WITHHELD arms this task was to run as TASK-381.8's baseline are no longer the measurement. The export-gate repair exists and was measured against a real control arm — the identical stack with the repair reverse-applied — which is a stronger comparison because withholding files changes the input while reverse-applying the patch does not. The 833.3 s / 423.4 s withheld-file pair stands only as the estimate that first sized the problem; TASK-381.8 is judged against its own same-session control (1,019,390.4 ms and 801.3 s in two sessions). RECORDED as superseded in `RECORDED_FULL_CORPUS_BASELINE.superseded`, with its reason: withholding files changes the input, so the two arms describe different corpora and their difference includes the cost of files one arm never saw, while reverse-applying the repair changes the code and leaves the input alone. The baseline TASK-381.8 measures its readmission against is the row this task lands: 7,818 of 8,494 indexed, 676 dropped, 337.3 s, 184,957 nodes and 19,816 raw entry points.
- [ ] #8 The superseded 855 s / 14.24 min projection for a repaired gate is recorded as superseded, with its reason: it added 603 files back at the local marginal without knowing that removing the gate also removes the 370.9 s rollback cascade. MEASURED outcome: the repaired gate costs 462.9 s, not 855 s. RECORDED as superseded in `RECORDED_FULL_CORPUS_BASELINE.superseded`, and doubly void on this tree: the rollback cascade the projection failed to account for is ALREADY gone here, at 0 calls to `Project.remove_file` and 187.1 ms — 0.05% of the run — for the whole of `evict_ingested_file` over 676 drops. So what a repaired gate costs on the landed tree is the marginal cost of the 676 readmitted files alone, which TASK-381.8 measures against its own same-session control rather than against either figure above.

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## What the corpus costs, on the tree that ships

Pointed at every file its discovery walk finds under vscode's `src/`, Ariadne now
takes all 8,494 of them into one process, finishes, and reports 19,816 entry
points. It does that in **337.3 s of CPU** — the mean of three independent
processes, CV 0.89%, cpu/wall 1.03-1.05 — at 7,177.6 MB of peak resident set. The
same walk at the repository root takes all 12,654 files for **1,105.7 s** and
8,352.6 MB. So the ten-minute answer still splits on the corpus and not on the
box: 5.62 minutes for `src/` against 18.43 for the whole repository, 49% more
files for 3.28x the CPU.

Coverage has not moved yet. 676 of the 8,494 files are still read, found to
declare a name twice in one declaration space, and discarded — 7,818 indexed.
That is TASK-381.8's to fix, and 676 rather than the 603 the prototype recorded
is the number it has to clear.

Nothing here is a projection, and no absolute above is comparable with the
510.3 s or 777.6 s this task was written over: those were taken on other machines
in other sessions, and identical computation has measured 777.6, 801.3 and
1,019.4 s across three of them. The improvement claim therefore comes from a
control arm — the tree this work started from, ariadne@2970604b — run
interleaved with the candidate in this session, control,candidate,control,candidate,
each arm running its own checkout's script. It buys **1.52x at 200 files, 2.09x
at 600 and 3.40x at 1,200**, with both arms indexing and dropping identically at
every slice. It is not run at corpus scale because that tree is the build that
spent 11.23 hours and died at file 6,634; a ratio that rises this steeply with
the file set is also the reason none of the three may be extrapolated to one.

## Where the time is, and the two questions the split settles

Every phase below is an exact `process.cpuUsage()` delta taken across the phase
boundary by a wrapper installed on the class prototype from a measurement script,
so no production file is touched, and the run it comes from reproduces the
byte-identical fingerprint of the three clean arms.

| phase                            | CPU        | share  |
| -------------------------------- | ---------- | ------ |
| parse and index                  | 292,833 ms | 85.03% |
| the rest of the load             | 26,873 ms  | 7.80%  |
| resolve the corpus               | 24,075 ms  | 6.99%  |
| — `resolve_calls_for_files`      | 13,929 ms  | 4.04%  |
| — fix import locations           | 7,074 ms   | 2.05%  |
| — `resolve_names`                | 1,824 ms   | 0.53%  |
| — `resolve_callback_invocations` | 1,908 ms   | 0.51%  |
| drop rollback                    | 187 ms     | 0.05%  |
| `trace_call_graph`               | 440 ms     | 0.13%  |

`resolve_callback_invocations` is the one term taken from a sampling profiler
rather than a wrapper, because it is module-local and cannot be reached from
outside its module; it is 24.02% of the `resolve_calls_for_files` that contains
it in the same profiled run.

The first question this settles is where the drop-rollback cascade went. It is
gone, and not through the gate repair: **`Project.remove_file` is called zero
times over a corpus load**, because TASK-381.4's two-phase driver rolls a failed
ingest back through `evict_ingested_file`, which evicts registry entries and
resolves nothing. The whole rollback path costs 187 ms over 676 drops, against
the 44.5% the term held when this task was written.

The second is what the collapsed rollback uncovered. Over half of the load —
**51.28% of the profiled run's load-and-trace subtrees** — is spent crossing the
JavaScript/native boundary to read tree-sitter node fields: `get type` alone is
14.47%, `get parent` 11.75%, then `childForFieldName`, `unmarshalNode` and the
position and index getters. `Query.captures` is 7.59% and `Parser.parse` 5.00%.
That is what TASK-381.13 and TASK-381.14 are scoped from. Resolution is not:
name resolution and call resolution together are 4.57% of the run, so
TASK-381.15's headroom is a fraction of a percent of the corpus load however
completely it succeeds.

Entry-point detection remains free. `trace_call_graph` is 440 ms of 344,408.

## Two commitments this checkpoint refutes

The settled heap is **not** the stable member of the RSS pair at this heap
ceiling. Three processes computing a byte-identical result closed with 4,691.3,
7,290.5 and 7,322.9 MB of used heap — a 40.9% spread — because at
`--max-old-space-size=12288` the corpus never forces a full collection, so the
closing reading is the GC schedule rather than what the load retains. Peak RSS,
the figure the harness distrusts, was the steadier of the two at 12.2%. No
RSS-to-heap ratio may be quoted from this row.

The composed prototype's structural output does not describe the landed tree.
Against 7,891 indexed, 603 dropped and 183,018 nodes, this tree reports **7,818
indexed, 676 dropped, 184,957 nodes, 322,300 call edges, 543,967 unresolved call
sites, 19,816 raw entry points and 25,811 indirect-reachability keys**. Every
prototype figure in this epic is superseded by that row, which is what this
checkpoint exists to establish.

## What is recorded, and how to re-run it

`RECORDED_FULL_CORPUS_BASELINE` holds every row above: both corpora with their
discovery counts, CPU, wall, cpu/wall, loadavg, peak RSS, settled heap, heap cap
and seven-number fingerprint; the interleaved control arm and its three ratios;
the phase split with each phase's provenance; the profile's cost centres; and
five superseded claims kept with the reason each was replaced — the 855 s
projection for a repaired gate, the withheld-file pair, the fixed CPU ceiling,
the old phase split, and the prototype's structural output. Its test recomputes
every summary from the observations behind it and refuses a phase split that
does not partition its run.

`packages/core/scripts/run_load_benchmark.ts` prints the record beneath any arm
that offers a whole corpus. The arms themselves are reproduced with
`--run-arm` at `--max-old-space-size=12288` for `src/`; the repository root needs
22,645, because the harness refuses a 12,654-file arm below the 18,116 MB its own
requirement asks for.

Two documented figures the checkpoint found stale are corrected rather than left
to fail silently. The smoke run over the first 200 path-sorted `.ts` files of
`src/vs/base` reproduces 185 indexed, 15 dropped, 4,500 nodes, 1,518 raw entry
points and 8,107 unresolved call sites; and the `folder:` and `folder-ts:` forms
of that predicate no longer index and drop identically, which strengthens rather
than weakens the reason a predicate names an extension set.

<!-- SECTION:NOTES:END -->
