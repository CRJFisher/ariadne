---
id: TASK-349.3
title: "Apply two small Phase-1 corrections: self-initializer ordering and sibling/hoist propagation"
status: To Do
assignee: []
created_date: "2026-06-26 11:16"
labels:
  - plan-export
  - name_resolution
dependencies: []
parent_task_id: TASK-349
priority: high
ordinal: 3000
plan_dedup_key: a21fbd7311550458aaa9a5695b44828cfa762ee8fef7c903560d56cf5913b7c7
plan_source_task: pt-c009557cba419023
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Two same-file binding gaps remain in `name_resolution.ts` (4-member leaf). These are the only rows whose failure is genuinely a Phase-1 defect.

## Change C.1 — import-vs-local self-initializer ordering

Phase-1 Step-2 (`name_resolution.ts:191-196`) layers _all_ local definitions over imports unconditionally. For `let has_flatten = has_flatten(fields)` (serde `struct_.rs:67`), this registers the local binding so the call resolves to the just-declared variable instead of the imported function. The minimal, correct rule: resolve the call reference against the binding in scope _at the reference position_ — do not let a `let x = … x(…)` self-initializer shadow the import for the reference inside its own initializer. Scope this narrowly to the self-initializer case so correct shadowing elsewhere is unchanged.

## Change C.2 — sibling-scope / hoisted-function propagation

A function defined in a sibling inner scope (or hoisted in JS) is absent from the scope map of the calling sibling scope: nest `cleanup` called inside a `this.done` arrow before its sibling `function cleanup` declaration; serde `content_as_str` intra-file. Add propagation in `resolve_scope_recursive`'s child recursion so a function definition is present in the scope map of sibling scopes that lexically reach it (JS function hoisting into the enclosing scope; Rust same-module items).

Both edits are confined to `resolve_references/name_resolution.ts`.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `Project` + `update_file`: a serde-style `let x = … x(…)` self-initializer resolves the call to the imported function, not the local binding.
- [ ] #2 A nested function called before its sibling declaration (nest-style hoisting) resolves to the function definition.
- [ ] #3 Correct shadowing in non-self-initializer cases is unchanged (the ordering fix is scoped to the self-initializer).
- [ ] #4 Both corrections are confined to `resolve_references/name_resolution.ts` (Step-2 and `resolve_scope_recursive`).

<!-- AC:END -->
