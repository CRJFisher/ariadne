---
id: TASK-348.2
title: "Author interim wip classifier-registry rows and residual known-issues"
status: Done
assignee: []
created_date: "2026-06-26 11:16"
labels:
  - plan-export
  - entry_point_classification
dependencies: []
parent_task_id: TASK-348
priority: medium
ordinal: 2000
plan_dedup_keys:
  - 5a7523de87fbd48bf7f46da7ea0b41cf910596781bc9693fc729faa39c04c4a0
plan_source_tasks:
  - pt-cc5517355c51a4c6
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Work plan

1. Per the classifier-lifecycle contract, the human authors `wip` registry rules in `.claude/skills/triage/known_issues/registry.json` (through `atomic_update_registry`) covering the six fingerprints as a bridge until the core reachability and trace_call_graph arms land.

2. As each core arm lands, flip the corresponding `wip → fixed`: the closure rule and the field-store rule retire entirely (subsumed by the core reachability arms); the `#[test]`/ASV rules retire once the trace_call_graph gates land.

3. Keep as standing `classifier.kind = "none"` known-issues (no robust producer signal, YAGNI): the `quote!`/Askama codegen rows (`print_ty`, `constrain`), the downstream-only public-API rows (`bind_rustls_0_23`, `add_flags_and_try_run_tests`, `analyze_match`), the residual PyTorch/NestJS pure-decorator-table registrations covered by the existing `framework-decorator-dispatch` builtin pattern extended to the Python decorator names, and dynamic-dispatch rows with no static signal (SQLAlchemy `__getattribute__` `_sa_`-prefix delegation).

4. Registry edits must go through `atomic_update_registry`; `packages/skill-fs/src/registry_writers.test.ts` must stay green.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

<!-- AC:END -->

## Implementation Notes

## High-level summary

The core reachability and trace_call_graph arms landed before this task ran (TASK-348, TASK-348.1), so there is no bridge interval left to cover: the `wip` classifier rows the original plan would have authored as a stopgap are unnecessary, and the subsumed rows retire instead of being written. This task closes the registry side of the TASK-348 cluster — it retires the classifier rows the landed core fix made redundant and corrects the original plan's disposition against what the fix empirically required.

The closure arm the original plan hypothesised for TASK-348 needed no new code: `call_resolution/call_resolver.ts` already synthesizes a callback call-edge for every inline / higher-order anonymous TypeScript callback, so those callables never enter the entry-point set. The two `wip` builtins that classified them as known false positives — `higher-order-function-callback` and `inline-callback` — can therefore never fire. They are retired: their registry rows flip `wip → fixed` with `classifier.kind` set to `none`, their builtin source files are deleted, and the `BUILTIN_CHECKS` barrel drops them. Each row's `backlog_task` repoints to `TASK-348`, where the subsuming fix is verified, so the `backlog_task` + git-log audit trail names the task that actually closed the issue.

### What changed

- **Registry** (`.claude/skills/triage/known_issues/registry.json`): `higher-order-function-callback` and `inline-callback` flip `wip → fixed`; their classifier becomes `{ "kind": "none" }` (the builtin spec is dropped so no row references a deleted classifier); `backlog_task` becomes `TASK-348`. The write goes through `atomic_update_registry` per the classifier-lifecycle contract — a one-off script importing the helper, run by the human, never a committed registry writer.
- **Builtins** (`packages/core/src/classify_entry_points/builtins/`): `check_higher-order-function-callback.ts` and `check_inline-callback.ts` are deleted and removed from the `index.ts` barrel.
- **No `permanent_data` change**: neither retired row is `permanent`, so the bundled core slice is untouched; `permanent_data.sync.test.ts` stays byte-locked.

### Why the deletion is safe

A `fixed` row is never looked up: core loads only the permanent slice (`registry_loader.ts`), and triage filters `fixed` rows out via `active_rules_for_classification` before any builtin resolution. Setting `classifier.kind` to `none` is a second guard. No test loads the on-disk registry and asserts every builtin `function_name` resolves in the barrel, so deletion regresses nothing. `registry_writers.test.ts` and the full classify/triage/types suites stay green.

### Corrections to the original work plan

- **Two builtins retired, not three.** The original plan grouped `stored-callback-via-object-property` with the closure builtins. TASK-348's empirical analysis showed it is not a reachability case at all — it matches a cross-file name-resolution miss (`name_not_in_scope`), owned by **TASK-190.28**. Its row stays `wip` and its builtin stays in the barrel until 190.28 lands the resolver fix and the human retires the row.
- **Evidence cases are already fixed and tested by the core arms.** All eight in-scope evidence cases (cases 1–8 of the TASK-348 evidence matrix) are pinned by `toEqual`-asserting integration tests: the method-as-value and closure cases in `classify_entry_points/enrich_call_graph.test.ts`, the `#[test]`/`#[cfg(test)]`/ASV runner-convention cases in `trace_call_graph/runner_suppression*.test.ts`. Cases 9 (TS field-initializer indexing gap) and 10 (stored-callback resolver miss) are outside the reachability layer and tracked in TASK-190.28. No new tests or fixtures were required for this task; per the project convention inline `Project` tests cover these single-file cases.
- **No standing `kind: "none"` rows were authored.** The original plan's step 3 named fingerprints (`print_ty`/`constrain` codegen, `bind_rustls_0_23`/`add_flags_and_try_run_tests`/`analyze_match` public-API, SQLAlchemy `_sa_` delegation) to "keep" as standing known-issues. No such rows exist in the registry and none ever had a producer signal — authoring them would be surplus against YAGNI. The genuinely related decorator-dispatch coverage is the existing `framework-decorator-dispatch` builtin, left untouched.
