---
id: TASK-381.13
title: "Stop the per-file passes re-deriving scope containment and enum membership they already hold"
status: To Do
assignee: []
created_date: "2026-08-24 09:07"
labels:
  - performance
  - syntactic_extraction
dependencies:
  - TASK-381.1
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`ProcessingContext.get_scope_id` (`packages/core/src/index_single_file/scopes/scopes.ts:220-247`) answers "which scope contains this location" by linear-scanning every scope in the file, on roughly 952 calls per file — quadratic in the file's own size, and 6.9% of the per-file parse-and-index constant. `create_processing_context` (`:218-229`) already walks the whole scope tree to precompute depths, so the tree is in hand; descending from `root_scope_id` through `child_ids` is 3.6x faster (3.145 to 0.867 ms/file) and returned an identical `ScopeId` on 124,862 real lookups across two independent runs, backed by a structural audit of 8,184 real scopes finding zero violations of the four invariants a descent needs.

The `Malformed scope tree` throw (`:239-243`) goes with the scan: it is a by-product of scanning everything, it never fires on real source, and re-deriving it on every lookup is pure cost. It is not, however, unwitnessed — `scopes.test.ts:834` constructs two sibling depth-0 module scopes both containing one location and asserts the throw. The descent is provably NOT equivalent on that input, because a scope not reachable from `root_scope_id` through `child_ids` is never visited. That test is deleted with its reason recorded, and every other test in the file stays green unmodified. Anyone reviewing this change must see that concession stated rather than discover it.

The capture normalisation loop (`packages/core/src/index_single_file/index_single_file.ts:53-71`) calls `Object.values(SemanticCategory).includes(...)` and `Object.values(SemanticEntity).includes(...)` once per capture, allocating a 10-element and a 40-element array each time and linear-scanning both, and `node_to_location` (`node_to_location.ts:15-21`) reads each tree-sitter `Point` twice — four boundary crossings and two discarded objects to produce four integers. Hoisting both enums to module-scoped Sets and binding the Points once removes 1.76 microseconds per capture with 0 semantic differences over 61,724 captures, which at the corpus mean of roughly 1,272 captures per file is about 2.2 ms/file.

The constant these sit inside is a range rather than a number — three independent size-stratified samples of the real corpus measured 40.06, 43.19 and 50.5 ms/file — and the components reconstruct to 4.9-5.9 ms/file depending on how the sampled slice is weighted, so the criterion below is set against the low end of that band and each component is reported separately. One cautionary result belongs here: the parser-buffer high-water mark, estimated at 0.39-0.41 ms/file from the same kind of sample, measured 0.008% of the full-corpus run. Per-file estimates multiplied out by file count have been wrong by two orders of magnitude in this codebase, so the whole-corpus saving must be confirmed by a whole-corpus run against a threshold, not merely observed.

## Explicitly not in scope

Bounding `extract_construct_target`'s parent-chain walk: it changes 403 of 7,322 resolved construct targets, which would destroy the clean reading this batch depends on.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 #1 `get_scope_id` descends from `root_scope_id` through `child_ids`; the linear scan and the `Malformed scope tree` throw are both gone, and >= 100,000 real lookups over the vscode corpus return the same `ScopeId` the scan returned (124,862 verified in the prototype).
- [ ] #2 #1a `scopes.test.ts`'s `Malformed scope tree` test (line 834) is deleted with its reason recorded — the invariant it asserts is unreachable by construction under a root-descent, because a scope not reachable from `root_scope_id` through `child_ids` is never visited — and every other test in `scopes.test.ts` stays green unmodified.
- [ ] #3 #2 `SemanticCategory` and `SemanticEntity` membership is tested against module-scoped Sets, and `node_to_location` binds `startPosition` and `endPosition` once each.
- [ ] #4 #3 Combined saving is >= 4 ms/file on a 160-file size-stratified sample of the corpus, against a reconstructed 4.9-5.9 ms/file band, with each component reported separately against its measured value (3.145 to 0.867 ms/file for the descent, 1.76 microseconds per capture for the normalisation).
- [ ] #5 #4 A full-corpus run records the combined CPU saving in seconds against the immediately preceding full-corpus baseline; the saving is >= 25 s, and if it is below that the gap between it and the 4 ms/file sample figure is explained rather than the task closed — the parser buffer, estimated at 0.39-0.41 ms/file, measured 0.008% of the corpus run, and that failure mode is what this criterion exists to catch.
- [ ] #6 #5 The six-number fingerprint is byte-identical before and after at n=200 and n=1,200: this batch changes no answer.
- [ ] #7 #6 Bounding `extract_construct_target`'s parent-chain walk is recorded as out of scope in the module, citing the harness row that measured it (403 of 7,322 resolved construct targets move).

<!-- AC:END -->
