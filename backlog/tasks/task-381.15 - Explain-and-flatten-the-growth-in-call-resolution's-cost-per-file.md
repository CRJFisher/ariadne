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
  - TASK-381.11
  - TASK-381.18
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Call resolution's growth is now measured on the post-TASK-381.8 build, and it is not the scan this task was written against.

`DefinitionRegistry` indexes anonymous callables by the file that declares them, and `resolve_callback_invocations` asks the batch's files for their callbacks instead of materialising every callable in the project and filtering the result down. That changes the shape of a pass rather than its budget. Re-resolving ONE file inside the loaded corpus reads **8** callables and visits **8** registry entries where it read 212,275 and walked 916,801, at both 1,200 and 8,494 files, and its CPU falls **132.7 → 74.5 ms** (five reps per arm). Over a cold whole-corpus load it buys nothing measurable — 18,288.1 ms candidate against 18,175.3 ms control, four processes per arm interleaved in one session, both arms spreading 13% — because TASK-381.4's two-phase driver had already collapsed the pass count from one-per-file to one, and a single scan of the project IS a single scan of the batch when the batch is the project. The scan that pass was paying for measures 16.3 ms of a 353 s run.

The growth is polymorphic dispatch, and it is the cost of a bigger answer. Over 927 → 8,494 files the term's input grows linearly and its output does not: unresolved call sites at exponent 1.013, polymorphic expansions at 1.147, resolved call edges at 1.310, subtype edges enumerated by `method_lookup` at 1.726, and CPU inside `resolve_polymorphic_method` / `resolve_polymorphic_class_method` at 1.881 — 5.6% of the term at 927 files, 22.9% at 8,494. The mean fan-out of one dispatch goes 4.64 → 6.09 → 16.77 subtypes enumerated per expansion, because a wider corpus is one in which an interface genuinely has more implementations. Naming every possible runtime target is the capability, so this term is intrinsic and no index removes it.

The term's own exponent is **1.134** by least squares over 927 / 2,000 / 8,494 files (1.506 between the two largest, 0.276 between the two smallest), against the 1.83 the earlier fit claimed. Carried forward it reaches 10% of a load at 19,000–35,000 files, 25% at 67,000–307,000 and half at 232,000–2.7M; the memory contract refuses long before that, since 8,494 files already retain 4,046 MB live. Those sizes are recorded, not predicted — this epic's own rule is that no fit is evidence.

`RECORDED_CALL_RESOLUTION_GROWTH` holds every arm behind these figures, `packages/core/src/resolve_references/call_resolution/call_resolver.ts` carries the scaling limit as module documentation, and the pre-381.8 figures (82 s, 10.4% of 778 s) and the 552,079-callables-at-200-files reading are recorded there as superseded.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 #1 MET, in the unit the criterion states it in. A resolve pass over ONE file — the shape the 199 calls at n=200 were, and the shape the file watcher drives — reads **8** callables and visits **8** registry entries at n=1,200 and the identical 8 and 8 at n=8,494: flat at 0%, against 29,800 / 128,710 and 212,275 / 916,801 on the same two projects before the index. The cold whole-corpus pass, whose batch IS the project, reads 12,269 at n=1,200 and 109,781 at n=8,494 — 10.22 and 12.92 per file in the batch, +26.4%, which is the corpus holding more anonymous callables per file than its first 1,200 do and not the pass reading more of the project. Under the pre-index shape the same two readings are 24.83 and 24.99 per batch file, flat only because scanning everything once per pass is what it does. Counted by wrappers installed on `DefinitionRegistry`'s prototype from outside; recorded in `RECORDED_CALL_RESOLUTION_GROWTH`.
- [ ] #2 #2 MEASURED and NAMED. On the post-TASK-381.8 build (ariadne@3da741d7) `resolve_calls_for_files` costs 1,665.9 ms at n=927 (3 processes, CV 18.58%), 2,059.6 ms at n=2,000 (2, CV 1.58%) and 18,175.3 ms at n=8,494 (4, CV 13.02%) — 1.797, 1.030 and 2.140 ms per file. The exponent of total CPU against file count is **1.134** by least squares over the three, which is 0.134 per file; pairwise it is 0.276 (927→2,000), 1.506 (2,000→8,494) and 1.079 (927→8,494). Above 1.1, and the mechanism is polymorphic dispatch: over 927→8,494 the input grows linearly (unresolved call sites 1.013) while the answer does not (resolved call edges 1.310, subtype edges enumerated 1.726, CPU inside the polymorphic pair 1.881, its share of the term 5.6%→22.9%, mean subtypes per expansion 4.64→16.77). The 1.83 an earlier fit claimed is superseded.
- [ ] #3 #3 NOT MET, and the refutation is the criterion. Measured against an interleaved same-session control on the post-TASK-381.8 build: `resolve_calls_for_files` — which CONTAINS `resolve_callback_invocations`, so their sum is that one term — costs 18,288.1 ms on the candidate against 18,175.3 ms on the control, four processes per arm interleaved control,candidate,×4 at a 12,336 MB heap cap. That is **+112.8 ms and -0.001 percentage points** (5.14% of 355.63 s against 5.14% of 353.36 s), inside both arms' 13% run-to-run spread. The target could not be met by this change or any like it: 15 s is four fifths of the whole term, and the scan the criterion was aimed at costs **16.3 ms** of a 353 s run (49.4 ms across the three calls a run makes, 33.1 ms of which `trace_call_graph` and diagnostics extraction still make). What the index does buy is the incremental path: 132.7 → 74.5 ms per single-file resolve, five reps per arm. The pre-381.8 figures (82 s, 10.4% of 778 s) are recorded as superseded in `RECORDED_CALL_RESOLUTION_GROWTH`, together with the 15 s target and the 552,079-callables reading.
- [ ] #4 #4 RECORDED. The residual growth IS intrinsic to polymorphic dispatch — the enumeration produces the answer rather than searching for it — and `call_resolver.ts`'s module documentation carries the measured exponents (term 1.134 least squares, 1.506 on the top segment; subtype edges 1.726; polymorphic CPU 1.881) and the sizes they imply: 10% of a load at 19,000-35,000 files, 25% at 67,000-307,000, half at 232,000-2.7M. The sizes are stated against the ceiling that arrives first — 8,494 files retain 4,046 MB live, so 19,000 files need about 9 GB and 232,000 about 111 GB — and as measured sizes rather than a prediction, because this epic accepts no fit as evidence.
- [ ] #5 #5 MET. All SEVEN fingerprint components are byte-identical between the two builds at n=200 (5,845 nodes / 9,800 edges / 8,825 unresolved / 1,837 entry points), n=1,200 (28,057 / 84,346 / 62,942 / 4,141) and the full corpus (201,595 / 1,077,986 / 420,958 / 17,563, the values `RECORDED_ORDER_INDEPENDENCE` already holds for this corpus in forward order), and so are BOTH diagnostics hashes at all three sizes. `call_resolver.test.ts` (26 tests) and the five `project/*.integration.test.ts` suites (196 tests) are green, along with `definition.test.ts` (45). The six-number version named here is retired by TASK-381's AC #5: the fingerprint is seven components.

<!-- AC:END -->
