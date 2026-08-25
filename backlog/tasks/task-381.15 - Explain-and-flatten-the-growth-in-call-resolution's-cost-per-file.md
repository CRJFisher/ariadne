---
id: TASK-381.15
title: "Explain and flatten the growth in call resolution's cost per file"
status: To Do
assignee: []
created_date: "2026-08-24 09:07"
labels:
  - call-resolution
  - performance
  - polymorphic_dispatch
dependencies:
  - TASK-381.8
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Call resolution's cost per file rises with corpus size even under the two-phase driver, and no confirmed mechanism explains it. On the pre-TASK-381.8 run `resolve_calls_for_files` (`packages/core/src/resolve_references/call_resolution/call_resolver.ts:68`) takes 5.72% — 45 s — with its self-time share up 5.9x from n=927 to n=7,891, and `resolve_callback_invocations` adds 4.71%, 37 s, with its share up 2.4x. In the counterfactual run with the export-gate files withheld it is 21.7 s of 423.4 s in a single whole-corpus call over 7,891 files, so this is growth in the cost of one call rather than growth in how many times it is called. An independent fit put the exponent at 1.83. Two separate agents flagged this term as the remaining scaling risk and neither investigated it.

The pre-381.8 figures (82 s, 10.4%) are NOT this task's baseline. TASK-381.8 alone takes the same term to roughly 5.1% of a much smaller run, so a criterion written against 10.4% would book TASK-381.8's saving a second time and could be closed by doing nothing. The baseline is the post-381.8 full-corpus row that TASK-381.8 AC #3 records.

One contributor is already identified. `resolve_callback_invocations` calls `definitions.get_callable_definitions()` (`call_resolver.ts:456`), materialising every callable in the project into an array and only then filtering on `callable.name !== "<anonymous>"` and file membership — at 200 files that was 199 calls scanning 552,079 callables. The two-phase driver collapses the call count without changing the scan's shape, so the term keeps growing with corpus size. Index anonymous callables by file so the resolver asks for the batch's callbacks directly, and test it for scale-invariance across two corpus sizes rather than at one, since a single-n count is satisfied by the driver alone and would prove nothing about this change.

The leading suspect for the rest, by elimination, is method dispatch enumerating transitive subtypes: `get_transitive_subtypes` (`packages/core/src/resolve_references/call_resolution/method_lookup.ts:256`, called at `:189` and `:228`) is the only call-resolution path known to reach outside both the import closure and the importer closure. It may turn out to be intrinsic to polymorphic dispatch, in which case the honest outcome of this task is an index over what is being re-enumerated plus a documented scaling limit — the corpus size at which the term becomes dominant — rather than a fix. Either way this is the term that would set the ceiling on the next corpus up, so leaving it unexplained is not an option.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 #1 Callables scanned per resolve pass does not grow with project size: measured at n=1,200 and at the full corpus and flat within 25%, against 552,079 scanned across 199 calls at n=200 today.
- [ ] #2 #2 The growth exponent of `resolve_calls_for_files` CPU per file is measured across n=927, 2,000 and the full corpus on the post-TASK-381.8 build and recorded, and the mechanism behind any exponent above 1.1 is named rather than left open.
- [ ] #3 #3 Measured on the post-TASK-381.8 full-corpus run, `resolve_calls_for_files` plus `resolve_callback_invocations` fall by >= 15 s of CPU in absolute terms against the baseline TASK-381.8 AC #3 records, and their combined share of that run falls by >= 3 percentage points. The pre-381.8 figures (82 s, 10.4% of 778 s) are recorded as superseded and are not this task's baseline, because TASK-381.8 alone already takes the term to about 5.1%.
- [ ] #4 #4 If residual growth is intrinsic to polymorphic dispatch, the measured exponent and the corpus size at which the term becomes dominant are recorded in the call-resolution module documentation, rather than the task being closed silently.
- [ ] #5 #5 The six-number fingerprint is unchanged at n=200, n=1,200 and the full corpus, and `call_resolver.test.ts` and the `project/*.integration.test.ts` suites stay green.

<!-- AC:END -->
