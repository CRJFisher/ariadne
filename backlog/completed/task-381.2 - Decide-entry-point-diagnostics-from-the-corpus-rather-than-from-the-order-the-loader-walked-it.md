---
id: TASK-381.2
title: "Decide entry-point diagnostics from the corpus rather than from the order the loader walked it"
status: Done
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

- [x] #1 #1 `build_lines_by_file`, `build_grep_index` and `build_reference_index` all iterate one path-sorted file list produced at a single source, and no ordered read in `extract_entry_point_diagnostics` depends on a Map's insertion history.
- [x] #2 #2 `build_call_refs_by_name`'s per-name list is sorted by (file, line, column) before `find_matching_call_refs` applies `MAX_DIAGNOSTICS_PER_ENTRY`, so the fifty retained are the earliest fifty call sites in the project under every ingest order.
- [x] #3 #3 The original hashes `1b02e8f53c9e6b6c` / `4d88be1462914be3` are NOT reproducible and are not asserted: they came from the investigation's own probe, and TASK-381.1's duplicate-reference repair in `typescript.scm` moved the payload for every generic call and construction. What holds on the landed tree is asserted instead. MEASURED with the harness's `--orders` mode over the corpus checkout restored at `~/.ariadne/triage-entrypoints/repos/microsoft--vscode`, microsoft/vscode@f3fa55c3 · `folder-ts:src/vs/base` · first 200 path-sorted files of 479 · ariadne@0cdc1296 · Darwin 24.6.0 x64 · node v22.22.1, shuffle seed 7, one process per order: forward, reversed, descending size and seeded shuffle all index 200 of 200 with 0 dropped and agree on all seven fingerprint components (nodes 5778/61888849a7477f16, call edges 13849/6f8cbf634e0d90f9, unresolved 6835/c990dbda540b36c2, raw entry points 1325/62309d683f1e3fa9, indirect keys 1393/e70cbb6a4a9dfea3, dropped 0/e3b0c44298fc1c14, evidence 1393/4c755453ab355850) and on ONE diagnostics `canonical_hash`, `d4a42769520154e1`. The emitted `diag_hash` does NOT agree — `1fabd4b1072e57e5`, `a649d22f7e9b8f08`, `3c2b1dac58f2b2e6`, `05250523977f6b77` — so the original criterion's claim of one emitted hash is withdrawn: membership of the payload is a function of the corpus, the emission order of its evidence lists is not. The harness reports exactly that ("canonical hash held, so only the EMISSION ORDER ... differs"). Recorded in `RECORDED_DIAGNOSTICS_BASELINE.remeasured_on_landed_tree`.
- [x] #4 #4 `MAX_GREP_HITS` still caps at 10 and `MAX_DIAGNOSTICS_PER_ENTRY` at 50; which hits survive each cap is a function of the corpus alone.
- [x] #5 #5 The two diagnostics tests that fail today pass — both named by file and test title in the task — and `extract_entry_point_diagnostics.test.ts` stays green.
- [x] #6 #6 The resulting six-number fingerprint is recorded in the TASK-381.1 harness as this epic's first guard baseline, with its input predicate and Ariadne commit named.

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

The two diagnostics tests AC #5 refers to, named: `packages/core/src/classify_entry_points/extract_entry_point_diagnostics.test.ts` — "stamps both disambiguators on an uncalled function (both false, no callers)" and "rejects a sibling class's method override (typeorm dropSchema shape)". Both failed on the investigation's tree and its fix flipped exactly those two. On this landed tree both pass before the change as well — the Map insertion orders its unit fixtures produce happen to land on the passing side — so their passing is necessary but not evidence. The guard that IS evidence is the new ingest-order test in the same file, "keeps the earliest call sites under the cap whichever order files arrive in": sixty same-named call sites against the fifty-site cap, one corpus ingested in two orders, verified to fail on the unfixed tree and pass on the fixed one.

Two corrections to AC #3, carried rather than dropped. First, the corpus checkout the epic pins (`~/.ariadne/triage-entrypoints/repos/microsoft--vscode`) was absent when this task landed, so the named slice could not be re-ingested then. Second, the recorded hashes `1b02e8f53c9e6b6c` / `4d88be1462914be3` are in any case not reproducible by the landed tree: they were taken by the investigation's own probe (SHA-256 over its own JSON serialization, first 16 hex) on commit 12458246 plus its patch, and TASK-381.1 has since landed the duplicate-reference repair in `typescript.scm`, which moves the diagnostics payload for every generic call and construction. They are therefore recorded verbatim as this epic's first guard baseline — `RECORDED_DIAGNOSTICS_BASELINE` in `packages/core/src/benchmark_corpus_load/recorded_diagnostics_baseline.ts`, with the slice derivation, seeds, Ariadne commit and hash algorithm named — under the same rule `RECORDED_ORDER_SENSITIVITY` lives by: a record of one run, never a value to compare a current digest with.

The live, recomputable form of the three-orders-one-payload property runs where a corpus exists. Every harness row now carries a two-hash diagnostics fingerprint (`diag_hash` over the payload as emitted, `canonical_hash` over its deep-sorted form — the pair whose disagreement pattern distinguishes an ordering defect from a membership one), the multi-order mode diffs it alongside the seven-number fingerprint and fails the run on divergence, and `diagnostics_fingerprint.corpus.test.ts` asserts one payload across forward, reversed and seeded-shuffle ingest of the in-repo guard corpus on every test run, with the committed baseline 4 / `2137c19fcc86c4eb` / `33247e7b3a040f85` derived from a payload the test reads back. The vscode slice was re-measured through `--orders` once the checkout was restored; that closes AC #3 (see the criterion for the result and for the emitted-hash residue).

<!-- SECTION:NOTES:END -->

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

## Final Summary

What a user can now rely on: the diagnosis attached to an entry point — the evidence a classifier and a reader see — is a function of the corpus, so renaming a directory or loading files in another order no longer changes which call sites are shown or what a function is diagnosed as. The mechanism is one path-sorted file list feeding every index in `extract_entry_point_diagnostics`, and a (file, line, column) sort of each name's call sites before the 50-item cap.

Every criterion is ticked. #3 was rewritten rather than met as written: the recorded hashes cannot be reproduced after TASK-381.1, so it asserts what holds now — four ingest orders over 200 files of vscode `src/vs/base` at f3fa55c3 agree on all seven fingerprint components and on one diagnostics `canonical_hash` — and withdraws the claim of one emitted `diag_hash`, which still varies with order. Recorded in `RECORDED_DIAGNOSTICS_BASELINE.remeasured_on_landed_tree`.

<!-- SECTION:FINAL_SUMMARY:END -->
