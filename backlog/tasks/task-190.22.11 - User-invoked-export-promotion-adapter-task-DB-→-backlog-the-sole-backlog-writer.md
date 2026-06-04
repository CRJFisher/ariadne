---
id: TASK-190.22.11
title: >-
  User-invoked export/promotion adapter (task-DB → backlog), the sole backlog
  writer
status: To Do
assignee: []
created_date: '2026-06-01 15:19'
labels:
  - self-repair
  - firewall
  - export
dependencies:
  - TASK-190.22.8
  - TASK-190.22.7
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
parent_task_id: TASK-190.22
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

The control gate + the portability seam. The USER (or me on their behalf) decides which task-DB entries graduate into `backlog/` — this is the only place the firewall is crossed, and the only backlog-coupled code in the pipeline. Keeping it a thin, swappable adapter is what makes "switch planning tools" real: a different target = a second adapter, no engine/DB change.

## Scope

- `.claude/skills/plan/scripts/export_to_backlog.ts` — the single entry in `ALLOWED_BACKLOG_WRITERS`. Selects task-DB rows by `--status` (default `proposed`), `--fault-area`, `--priority`, or explicit `--id <db-task-id>...`; `--dry-run` prints the selection without mutating.
- Maps each selected `PlanTask` → backlog task (reusing the pure `render_task_*` row-builders) and creates `backlog/tasks/*.md` (via `mcp__backlog__task_create` or direct write).
- **Stamp `plan_dedup_key: <PlanTask.dedup_key>` into the created backlog task's frontmatter** (the verbatim source `dedup_key` hash). This is the loop-closure link the plan reconciler reads back: TASK-190.22.10's read-only backlog dedup (`src/reconcile/backlog_dedup.ts`) keys on exactly this field to recognise already-promoted work and suppress re-proposal. The field name and value (raw `dedup_key`) are a fixed contract — do not rename or transform it. SHOULD also stamp the source DB task `id` for human traceability.
- On success: stamp the DB row `proposed → exported`, record the resulting `backlog_task` id; idempotent re-run skips rows already `exported` with a matching id (same no-op-on-match guard the old `link_ariadne_bug_tasks` used).
- Expose as a user-facing `plan` skill command (e.g. `/export-to-backlog`) so it is run deliberately by the human, never by the autonomous sweep.
- Document the adapter contract ("given a filtered set of DB rows → create tracker items → stamp exported + external id") so a `export_to_linear.ts` / `export_to_github_issues.ts` is a drop-in.

## Verification

`--dry-run` lists the selected rows and writes nothing; a real run creates backlog tasks, flips the DB rows to `exported`, and a second identical run is a no-op. The adapter is the only file the 190.22.7 firewall test allows to touch backlog.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `export_to_backlog.ts` exists as the sole `ALLOWED_BACKLOG_WRITERS` entry; selects DB rows by status/fault-area/priority/id; `--dry-run` writes nothing
- [ ] #2 Selected `PlanTask` rows are rendered (reusing `render_task_*`) into `backlog/tasks/*.md`, each stamped with `plan_dedup_key: <source dedup_key>` (the loop-closure link TASK-190.22.10's reconciler reads); the DB row flips `proposed → exported` with the `backlog_task` id recorded
- [ ] #3 Idempotent: re-running skips rows already `exported` with a matching id (no duplicate backlog tasks)
- [ ] #4 Exposed as a user-invoked `plan` skill command; never called by the autonomous sweep
- [ ] #5 Adapter contract documented as a swappable seam (a second tool target needs only a new adapter); `pnpm -r test` + the firewall test green
<!-- AC:END -->
