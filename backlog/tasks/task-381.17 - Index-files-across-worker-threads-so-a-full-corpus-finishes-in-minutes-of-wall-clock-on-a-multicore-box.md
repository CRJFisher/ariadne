---
id: TASK-381.17
title: "Index files across worker threads so a full corpus finishes in minutes of wall clock on a multicore box"
status: To Do
assignee: []
created_date: "2026-08-24 09:07"
labels:
  - performance
  - architecture
dependencies:
  - TASK-381.10
  - TASK-381.11
  - TASK-381.13
  - TASK-381.14
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Pass A of the two-phase driver is embarrassingly parallel: `parse_file` and `build_index_single_file` touch no registry. The seam already exists — `SemanticIndex` is what the persistence cache serialises, so `serialize_semantic_index` and `deserialize_semantic_index` are a ready-made transport and `Project.restore_file` (`packages/core/src/project/project.ts:173`) a ready-made apply path, proved fingerprint-identical to `update_file` across all six hashes over 191 real vscode files — and tree-sitter's native binding loads per worker thread with no special handling.

The unit changes here and the criteria change with it. Threads trade CPU for wall: the one pool that was actually built measured wall 16,607 to 15,084 ms while CPU rose 19,094 to 25,454 ms, up 33%, at n=200. That measurement was taken when resolution still dominated the run and it does not transfer, which is why the wall target below is COMPUTED from a re-measured share rather than fixed in advance. Every other item in this epic is judged on CPU because wall on a shared box is scheduling; this one is judged on wall taken on an idle box with CPU reported alongside, and never booked as a CPU saving.

Three constraints were learned the hard way. The pool must preserve caller order, because the reported graph is order-dependent — TASK-381.11 is what makes that structurally safe rather than merely arranged. Use the JSON transport and not `structuredClone`, which throws on any residual non-cloneable field and takes the whole file down: pre-fix it lost 133 nodes, 172 call edges and 15 entry points on `vs/base` alone, which is what TASK-381.10 removes. And on a contended machine the pool is a net loss — at loadavg 7-19 on four cores every pool arm was slower than serial, wall up 21% and CPU up 24-31%, with cpu/wall at 0.97 while three workers ran, meaning they took no extra CPU and stole it from the critical path. The answer to that is one mechanism with a computed width, not a pool path beside a serial path: width comes from cores and load, and a width of one is the same dispatch code running a single worker.

The pool is also what makes post-load's one parallel seam available. The indexed grep pass and the residue grep pass are two textual byte-passes over disjoint file sets sharing no state but their output Map, and they dispatch through this pool rather than growing a second threading mechanism of their own. This item lands last because it is the only one whose value depends on everything before it having already changed the shape of the run.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 #1 Before any pool code is written, the parallelisable share of the post-TASK-381.8 full-corpus run is re-measured and recorded, and the wall target for AC #3 is COMPUTED from it — not taken from the n=200 prototype and not fixed in advance.
- [ ] #2 #2 Pass A dispatches to a worker pool over the JSON transport, results are applied in caller path order, and the six-number fingerprint is identical to the serial arm at n=200, n=1,200 and over the full corpus.
- [ ] #3 #3 Full-corpus cold WALL on an otherwise-idle 4-core box meets the target computed in AC #1 as `serial_wall x (1 - share + share/3.2)`, with 3.2 stated as the measured 4-core efficiency of the pool at full corpus; the computed target and the achieved wall are both recorded. Total CPU is reported alongside and explicitly permitted to exceed the serial arm's by up to 35% (measured +33% at n=200). No CPU reduction is claimed.
- [ ] #4 #4 There is one dispatch mechanism: worker width is computed from core count and loadavg, a width of one runs the same code with a single worker, and a contended run is never slower than the width-one arm — against every pool arm today running +21% wall and +24-31% CPU at loadavg 7-19.
- [ ] #5 #5 Main-thread deserialize cost is reported separately by the harness, since it lands on the critical path and partially cancels the win.
- [ ] #6 #6 A worker crash re-dispatches its file rather than failing the load, and a cache hit is resolved before dispatch rather than by a second code path inside it.
- [ ] #7 #7 The worker entry ships as a built `.js` in `dist` rather than relying on the host's tsx hook.
- [ ] #8 #8 The indexed grep pass and the residue grep pass dispatch through this same pool, and post-load wall on an idle box is reported with CPU unchanged within noise.

<!-- AC:END -->
