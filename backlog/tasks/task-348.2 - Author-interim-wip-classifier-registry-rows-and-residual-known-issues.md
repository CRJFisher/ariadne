---
id: TASK-348.2
title: "Author interim wip classifier-registry rows and residual known-issues"
status: To Do
assignee: []
created_date: "2026-06-26 11:16"
labels:
  - plan-export
  - entry_point_classification
dependencies: []
parent_task_id: TASK-348
priority: medium
ordinal: 2000
plan_dedup_key: 5a7523de87fbd48bf7f46da7ea0b41cf910596781bc9693fc729faa39c04c4a0
plan_source_task: pt-cc5517355c51a4c6
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
