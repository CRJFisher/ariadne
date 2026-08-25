---
id: TASK-381.12
title: "Cap the post-load grep index where its only reader stops"
status: To Do
assignee: []
created_date: "2026-08-24 09:07"
labels:
  - memory
  - entry_point_classification
dependencies:
  - TASK-381.1
  - TASK-381.2
  - TASK-381.8
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`build_grep_index` (`packages/core/src/classify_entry_points/extract_entry_point_diagnostics.ts:506-545`) pushes every hit unconditionally, and its only production reader is `grep_for_calls` at `:642-646`, which returns `.slice(0, MAX_GREP_HITS)` — the first ten. The function is exported but consumed nowhere outside this module and its own unit tests, and `has_uncaptured_indexed_grep_hit` derives from the already-sliced array, so nothing in production can observe a hit past the tenth. Its two sibling channels in the same codebase already cap at insertion — `build_reference_index` at `:445` and `complete_caller_evidence` at `:143-152`, the latter with a comment calling the cap load-bearing for memory. `build_grep_index` is the odd one out of three.

Measured over the 7,891 files `project.get_file_contents()` holds on the pre-TASK-381.8 build — the 603 gate-dropped files are removed from that map by the rollback, so this is not an 8,494-file measurement — with arms interleaved A,B,A and a sha1 digest taken over the readable window: 1,083,422 hits and 144.5 MB become 219,741 hits and 38.5 MB, digest identical in all three arms. That is 105.9 MB of unreachable records freed at the run's peak heap, and CPU is unchanged within noise — this is a memory fix and must not be sold as a speedup. If this lands after TASK-381.8 the corpus gains 603 files and both pre-figures rise, so the pre-figure is re-measured over the then-current file set before the ratio is judged.

Post-load is otherwise not a second cliff and this task does not try to make it one. The full-corpus profile put `trace_call_graph` itself at 652 ms of 773,779 — 0.08% of the run — so entry-point detection is effectively free and the whole cost is the load. `complete_caller_evidence` builds one inverted index over the residue and does a single `Map.get` per entry, flat at about a microsecond across a thousandfold range of entry counts. Running the two textual byte-passes concurrently is worth real wall time but needs worker threads, so it belongs to TASK-381.17's pool rather than growing a second, ad-hoc threading mechanism here.

## Explicitly not in scope

The keyword stoplist proposed alongside the cap. It was measured to change the output digest — 12 names and 120 hits removed from inside the readable window — for 0.05% of hits, and its premise is false for TypeScript, where `catch`, `new`, `for` and `typeof` are all legal method names and `.catch()` is ubiquitous.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 #1 `build_grep_index` caps at `MAX_GREP_HITS` as hits arrive, matching `build_reference_index` and `complete_caller_evidence`.
- [ ] #2 #2 Retained grep hits fall by >= 4.9x and retained memory by >= 3.7x on the same corpus — measured 1,083,422 -> 219,741 hits and 144.5 -> 38.5 MB over the 7,891 files `get_file_contents()` holds on the pre-TASK-381.8 build. If this lands after TASK-381.8 the pre-figure is re-measured over the then-current file set before the ratio is judged.
- [ ] #3 #3 A sha1 digest over `slice(0, 10)` of every name is byte-identical before and after, across three interleaved arms.
- [ ] #4 #4 CPU over the full corpus is unchanged within noise, and the change is recorded in the harness as a memory fix rather than a speedup.
- [ ] #5 #5 No keyword stoplist is added, and the module records the conclusion plus a pointer to the harness row that measured it, so it is not proposed again.
- [ ] #6 #6 `extract_entry_point_diagnostics.test.ts` stays green, with the direct `build_grep_index` unit tests updated to assert the insertion-time cap rather than the old unbounded shape.

<!-- AC:END -->
