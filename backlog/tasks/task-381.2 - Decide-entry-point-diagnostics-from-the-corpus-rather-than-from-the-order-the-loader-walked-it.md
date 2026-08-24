---
id: TASK-381.2
title: "Decide entry-point diagnostics from the corpus rather than from the order the loader walked it"
status: To Do
assignee: []
created_date: "2026-08-24 09:07"
labels:
  - entry_point_classification
  - bug
dependencies:
  - TASK-381.1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`extract_entry_point_diagnostics` takes `project.get_file_contents()` (`packages/core/src/classify_entry_points/extract_entry_point_diagnostics.ts:118`), an insertion-ordered Map, and builds `lines_by_file` (`:273`), the reference index (`:359`) and the grep index (`:506`) by iterating it. `build_call_refs_by_name` (`:287`) pushes each call site in call-graph insertion order, which is load order, and `find_matching_call_refs` (`:670-678`) then keeps the first `MAX_DIAGNOSTICS_PER_ENTRY = 50` of them. Which evidence a classifier sees about a given function — and therefore what that function is diagnosed as — is decided by the order the loader happened to walk the directory tree.

Sorting the file iteration is necessary and, on its own, not sufficient; that is the part the first pass at this got wrong. With the file list sorted, a deep-sorted canonical hash of the diagnostics payload still differed between ingest orders. A canonical hash that still differs after sorting is a membership difference rather than an ordering one, and that is what exposed the 50-item cap as the real cause: two orders truncate to two different sets of fifty call sites. Sorting each name's list by (file, line, column) before the cap is applied makes the fifty that survive the earliest fifty in the project, under every order.

Entry-point membership was never at risk here — `detect_entry_points` is a pure set difference, so walk order can only reorder its output array — but the diagnosis attached to each entry point is what a user reads and what the triage classifiers consume, and it moved. Two diagnostics tests that fail today pass once this lands, which is independent evidence the flakiness was already costing the suite. The deeper order-dependence, where resolution itself produces different edges under different ingest orders, is TASK-381.11's and is not touched here. This lands early because until it is gone no before-and-after in this epic can be read.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 #1 `build_lines_by_file`, `build_grep_index` and `build_reference_index` all iterate one path-sorted file list produced at a single source, and no ordered read in `extract_entry_point_diagnostics` depends on a Map's insertion history.
- [ ] #2 #2 `build_call_refs_by_name`'s per-name list is sorted by (file, line, column) before `find_matching_call_refs` applies `MAX_DIAGNOSTICS_PER_ENTRY`, so the fifty retained are the earliest fifty call sites in the project under every ingest order.
- [ ] #3 #3 Forward, reversed and seeded-shuffle ingest of the harness's named slice (recorded by file set, corpus commit f3fa55c3, Ariadne commit, and shuffle seed) each produce diag hash `1b02e8f53c9e6b6c` and canonical hash `4d88be1462914be3` under the harness's pinned hash functions, matching the pre-change forward-order baseline over the same set.
- [ ] #4 #4 `MAX_GREP_HITS` still caps at 10 and `MAX_DIAGNOSTICS_PER_ENTRY` at 50; which hits survive each cap is a function of the corpus alone.
- [ ] #5 #5 The two diagnostics tests that fail today pass — both named by file and test title in the task — and `extract_entry_point_diagnostics.test.ts` stays green.
- [ ] #6 #6 The resulting six-number fingerprint is recorded in the TASK-381.1 harness as this epic's first guard baseline, with its input predicate and Ariadne commit named.

<!-- AC:END -->
