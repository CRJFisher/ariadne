---
id: TASK-190.35
title: "Purge the classifier `kind` discriminant — flatten ClassifierSpec to builtin-only"
status: To Do
assignee: []
created_date: "2026-07-02 00:00"
labels:
  - self-repair
  - classifier-lifecycle
  - types
  - simplification
parent_task_id: TASK-190
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

After TASK-190.30.2 removed the predicate DSL, `ClassifierSpec` is the union
`{ kind: "none" } | BuiltinClassifierSpec | { kind: "retired"; from; reason }`.
In practice the catalog is builtin-only: the live registry holds **18
`builtin`, 1 `none`, 0 `retired`, 0 `fixed`/`wip`**. The `kind` discriminant now
carries almost no information — every real classifier is a builtin. This task
removes it, flattening a classifier to a plain `{ function_name, min_confidence }`.

### Viability (checked)

Viable. `classifier.kind` is branched on in only five non-test source files —
`packages/types/src/known_issues.ts` (the type + `select_permanent_slice_rules`),
`packages/core/src/classify_entry_points/classify_entry_points.ts` (dispatch:
`if (spec.kind !== "builtin") continue`), `registry_loader.ts`
(`validate_permanent_slice`), `.claude/skills/triage/src/known_issues_registry.ts`
(`validate_classifier_spec`), and `.claude/skills/triage/scripts/reconcile_registry.ts`
(retire/promote arms, `--stage` builtin-only gate) — plus the registry data,
the bundled slice, and their tests. All of these simplify when the union
collapses to one shape.

### What "purge `kind`" entails (two things beyond deleting retired rows)

1. **The `none` variant is removed too**, so the one live `none` row —
   `true-positive-lambda-handler` — must be resolved. It is currently **inert**:
   a `none` classifier never fires and is excluded from the permanent slice, so
   it does nothing today. Its rule is trivially a builtin ("file path contains
   `_lambda_handler`"), so **give it a real `check_true_positive_lambda_handler`
   builtin** rather than deleting it — that turns a dead documentary row into a
   firing classifier, which is strictly better and aligns with the regime
   (every catalog entry carries a real check).

2. **Retirement changes from mark-in-place to delete-the-row.** The `retired`
   kind exists to preserve a fixed bug's former builtin (`from` + `reason`) on a
   `fixed` row so its `function_name` does not dangle. Without a `retired`
   marker, a fixed classifier cannot linger — so `reconcile_registry.ts`
   name-mode (`--id ... --fixed --reason`) must **delete** the named row(s) and
   their `check_*.ts`, with git history as the audit trail (accepted trade). This
   also makes the `fixed` status largely vestigial (a fixed bug = a deleted row),
   which is a candidate follow-on simplification but out of scope here.

### The change

- **Types** (`packages/types/src/known_issues.ts`): replace the `ClassifierSpec`
  union with a flat classifier shape `{ function_name: string; min_confidence:
  number }` (drop `kind`, `none`, `retired`, and the `from`/`reason` fields).
  Update `select_permanent_slice_rules` (no more `kind === "builtin"` filter —
  every permanent row qualifies) and the doc comments.
- **Core**: `classify_entry_points.ts` dispatch becomes unconditional (every
  classifier is a builtin lookup); `registry_loader.ts` `validate_permanent_slice`
  drops the `kind`-based allowlist. The barrel↔registry bijection guard
  (TASK-190.30.2) still holds and now covers every row.
- **Triage validator** (`known_issues_registry.ts`): `validate_classifier_spec`
  collapses to validating `function_name` (regex + uniqueness) + `min_confidence`
  ∈ [0,1]. Drop the `none`/`retired` branches and the `retired`-requires-`fixed`
  coupling. Keep the evidence gate and the permanent-row gates from TASK-190.30.x.
- **Reconcile** (`reconcile_registry.ts`): name-mode retirement deletes rows
  instead of writing a `retired` marker; the promote/`--stage` `kind` checks
  simplify.
- **Data**: migrate `registry.json` — strip `"kind": "builtin"` from every
  classifier object; convert the `true-positive-lambda-handler` row to a real
  builtin; regenerate `permanent_data.ts`.
- **Docs**: `classifier-lifecycle.md` and the reconcile/prioritize SKILLs — drop
  the `none`/`retired` lifecycle language and describe retirement as deletion.

### Trade-off

The in-registry, lossless retirement audit trail (`from` + `reason` on a `fixed`
row) is gone; git history is the record instead. Accepted per the task request.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] `ClassifierSpec` is a flat `{ function_name, min_confidence }` (no `kind`
      discriminant, no `none`/`retired` variants) in `@ariadnejs/types`.
- [ ] The `true-positive-lambda-handler` row carries a real
      `check_true_positive_lambda_handler` builtin (no more inert `none` row).
- [ ] `registry.json` migrated (no `kind` field on any classifier), permanent
      slice regenerated, `permanent_data.sync.test.ts` passes.
- [ ] Dispatch (`classify_entry_points.ts`), slice validation
      (`registry_loader.ts`), and the triage validator all simplified to the
      single builtin shape; the barrel↔registry bijection guard still passes.
- [ ] `reconcile_registry.ts` name-mode retirement deletes the row(s) + their
      `check_*.ts` instead of writing a `retired` marker; tests updated.
- [ ] `classifier-lifecycle.md` + the reconcile/prioritize SKILLs describe the
      flat classifier and retirement-by-deletion; no stale `none`/`retired`
      lifecycle language.
- [ ] `pnpm build` + `pnpm typecheck` + full suite green.

<!-- AC:END -->
