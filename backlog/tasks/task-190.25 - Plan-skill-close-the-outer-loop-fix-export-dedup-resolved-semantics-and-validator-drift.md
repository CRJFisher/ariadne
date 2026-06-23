---
id: TASK-190.25
title: "Plan skill: close the outer loop — fix export dedup, resolved semantics, and validator drift"
status: To Do
assignee: []
created_date: "2026-06-23 00:00"
labels:
  - self-repair
  - plan
  - bug-fix
  - loop-closure
parent_task_id: TASK-190
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

A deep multi-agent review of the plan skill (run 2026-06-23) confirmed the internal three-pass pipeline (group → strategize → reconcile) is sound: provably total fault-area routing, zero dedup_key mismatches across 61 live tasks, 179 passing tests, and correct orphan-gating logic. However, three code-level defects prevent the outer loop from ever working correctly:

1. **Export dedup is keyed on `dedup_key` alone.** Seven live key-groups span 2–3 tasks across different tiers (architectural/fault_area/localized nodes can share identical evidence → same `dedup_key`). A batch export would write multiple backlog files with the same `plan_dedup_key`, then collapse them last-writer-wins on the next sweep, silently stranding siblings as permanently-skipped.

2. **`resolved` rewards disappearance, not repair.** A task flips to `resolved` when a false positive stops recurring across re-scans — with no requirement that a backlog task was exported, a fix commit landed, or a regression test was added. Five tasks already carry `resolved` with `exported_backlog_task: null`; at least four of them resolved because the 06-17 run was dropped from scope, not because a fix landed. This is a silent false-success signal.

3. **Doc-vs-validator drift on the `other` bucket rule.** `SKILL.md` requires `other` buckets to emit both a taxonomy-extension task and a real core-fix task. `validate_plan.ts` accepts any non-taxonomy node — including a classifier-only interim — as the core-fix. `core_fix_effort` is documented as `{1, 3, 5}` but only validated as `> 0`.

A fourth gap — no colocated test for `plan_task_record.ts` despite it being the hot read-boundary for all task DB access — is also addressed here.

## Scope

### Part 1 — Export dedup: key on `(dedup_key, tier)`

Thread `tier` into the backlog dedup link throughout the plan skill's export path:

- `scripts/export_to_backlog.ts` / `src/export/select_exportable_tasks.ts`: stamp exported frontmatter with `plan_tier: <tier>` alongside `plan_dedup_key`; change the skip guard from `seen_dedup_keys.has(dedup_key)` to `seen_keys.has(dedup_key + ":" + tier)`.
- `src/store/backlog_dedup.ts`: change `read_exported_backlog_keys` to build a `Set<string>` of `"${plan_dedup_key}:${plan_tier}"` composite keys from frontmatter; update all callers.
- `reconcile_plan.ts` export-dedup overlay (line ~256): key on `(dedup_key, tier)` to match the reconcile matcher already at line ~148.
- Update the docstring invariant at `select_exportable_tasks.ts:L19-21` to reflect the correct invariant: two live tasks may share `dedup_key` if and only if they differ in tier.

### Part 2 — `resolved` semantics: distinguish repair from disappearance

Split the terminal state into two distinct statuses:

- **`resolved`**: the false positive stopped recurring AND the grounding backlog task carries a fix-bearing Conventional-Commits scope (`fix`/`feat`) that appears in this repo's `git log` — i.e. fix-confirmed. The reconciler checks `exported_backlog_task` is non-null and the linked backlog task's `plan_task` field matches a commit scope before applying this status.
- **`unobserved`**: the false positive stopped recurring but no fix is confirmed. Human review required before marking as truly resolved. The task surfaces as `unobserved` in plan output; the agent prompts the user to confirm or re-open it.

Migrate the five existing `resolved` tasks with `exported_backlog_task: null` to `unobserved` as part of this change.

Add `unobserved` to `PlanTask`'s status union type in `src/store/plan_task.ts` and update all status-discriminating code paths (reconcile, export filter, render).

### Part 3 — Tighten `validate_plan.ts`

For `other` buckets, require that the core-fix node is not a taxonomy-extension node AND not a classifier-only node (i.e. its title or `tier` cannot be `localized` with a classifier fingerprint — the `--classifier` / interim signal already present in the strategist prompt). Specifically:

- The validator's `found.core_fix` check must require a node whose `tier` is `architectural` or `fault_area`, not `localized`.
- Add a check: `core_fix_effort ∈ {1, 3, 5}` (reject 0, 2, 4, or values > 5).
- Update `validate_plan.ts` error messages to quote the relevant SKILL.md rule so a strategist retry produces a conforming plan.

### Part 4 — Add `plan_task_record.test.ts`

Add `src/store/plan_task_record.test.ts` covering:

- Happy path: a well-formed task JSON round-trips through `parse_plan_task` with correct field types.
- Invalid JSON: throws with a descriptive message.
- Non-object root: throws.
- Wrong `schema_version`: throws.
- Missing required fields (`id`, `tier`, `fault_area`, `status`): each throws independently.

## Out of scope

- Locking the membership-override store and the backlog-id mint path with `atomic_update_registry` — that is safe under the current single-writer-per-sweep usage and is a YAGNI addition.
- Concurrency-cap enforcement (advisory prose vs code semaphore) — no real resource exhaustion has occurred.
- Effort rollup semantics on non-leaf nodes — addressable in a later strategist-quality pass.
- Running the human promotion pass — an operational action to take after this task lands.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Exported backlog task frontmatter carries `plan_tier: <tier>` alongside `plan_dedup_key`; `select_exportable_tasks.ts` skip guard keys on `(dedup_key, tier)` so tasks sharing a `dedup_key` but differing in tier export independently
- [ ] #2 `src/store/backlog_dedup.ts` builds composite `"${plan_dedup_key}:${plan_tier}"` keys; all callers updated; the docstring invariant at `select_exportable_tasks.ts` correctly states that tasks may share `dedup_key` iff they differ in `tier`
- [ ] #3 `reconcile_plan.ts` export-dedup overlay keys on `(dedup_key, tier)` — consistent with the reconcile matcher at line ~148
- [ ] #4 `PlanTask` status union includes `unobserved`; the reconciler applies `unobserved` (not `resolved`) when a task's false positive stops recurring but `exported_backlog_task` is null or no fix-bearing commit is confirmed
- [ ] #5 `resolved` is only applied when `exported_backlog_task` is non-null and the linked backlog task traces to a fix-bearing commit in `git log`
- [ ] #6 The five existing `resolved` tasks with `exported_backlog_task: null` are migrated to `unobserved` (one-off migration script or manual update)
- [ ] #7 `validate_plan.ts` rejects an `other`-bucket plan whose core-fix node is `localized` tier (classifier-only), requiring `architectural` or `fault_area` tier
- [ ] #8 `validate_plan.ts` rejects `core_fix_effort` values outside `{1, 3, 5}` with a message citing the SKILL.md rule
- [ ] #9 `src/store/plan_task_record.test.ts` exists and tests: happy path, invalid JSON, non-object root, wrong schema_version, and each missing required field — each throw branch covered
- [ ] #10 `pnpm -r build && pnpm -r test && pnpm typecheck && pnpm lint` are green

<!-- AC:END -->
