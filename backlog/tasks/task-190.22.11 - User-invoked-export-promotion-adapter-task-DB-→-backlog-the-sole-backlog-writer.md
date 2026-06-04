---
id: TASK-190.22.11
title: >-
  User-invoked export/promotion adapter (task-DB → backlog), the sole backlog
  writer
status: Done
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
- [x] #1 `export_to_backlog.ts` exists as the sole `ALLOWED_BACKLOG_WRITERS` entry; selects DB rows by status/fault-area/priority/id; `--dry-run` writes nothing
- [x] #2 Selected `PlanTask` rows are rendered (reusing `render_task_*`) into `backlog/tasks/*.md`, each stamped with `plan_dedup_key: <source dedup_key>` (the loop-closure link TASK-190.22.10's reconciler reads); the DB row flips `proposed → exported` with the `backlog_task` id recorded
- [x] #3 Idempotent: re-running skips rows already `exported` with a matching id (no duplicate backlog tasks)
- [x] #4 Exposed as a user-invoked `plan` skill command; never called by the autonomous sweep
- [x] #5 Adapter contract documented as a swappable seam (a second tool target needs only a new adapter); `pnpm -r test` + the firewall test green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## High-level summary

The export adapter is the one place the self-healing pipeline writes the user's `backlog/`, and the only backlog-coupled code in the engine. Everything upstream — triage, group, strategize, reconcile — is read-only against `backlog/`, accumulating proposed work as `PlanTask` rows in the firewalled task-DB (`~/.ariadne/plan/`). Promotion into the user's tracker is a deliberate human act, never the autonomous sweep, so it lives behind a single command that the human runs. Keeping it a thin adapter is what makes "switch planning tools" real: a different target is a second adapter, with no change to the engine or the DB.

The adapter is structured as three pure modules under `src/export/` plus one thin orchestrating script — mirroring the existing `group_runs.ts → src/group/` and `reconcile_plan.ts → src/reconcile/` split. The split is firewall-driven: the backlog write-boundary test (`packages/skill-fs/src/backlog_writers.test.ts`) admits exactly one file to write `backlog/`, so the sole `atomic_write_file` lives in the allowlisted script and the pure modules stay write-free (one of them reads the backlog tree read-only to mint an id, which the firewall permits). The write target is reached directly from the filesystem — no `mcp__backlog__*` tool is granted on the `plan` path, the contract's primary breach vector.

A run flows: **select → mint id → render → write → flip → log**. `select_exportable_tasks` picks the rows — filtered by `--status`/`--fault-area`/`--priority`, or named explicitly by `--id` — and drops anything already promoted. `next_backlog_task_id` recursively scans the whole `backlog/` tree for the highest top-level `task-<N>` and returns the next, matching how `backlog.md` itself allocates ids. `render_backlog_task` wraps each `PlanTask` into a `task-<id> - <slug>.md` file, stamping `plan_dedup_key: <PlanTask.dedup_key>` verbatim and `plan_source_task`. The script writes the file, flips the DB row `proposed → exported` (recording `exported_backlog_task`), and appends one `export` `PlanSweepEvent`.

The `plan_dedup_key` stamp is the loop-closure link: the reconciler's `src/store/backlog_dedup.ts` reads it back read-only and suppresses re-proposal of promoted work. That same key is the idempotency authority — selection skips a row already `exported` *and* a row whose `dedup_key` a backlog task already carries, so a re-run is a no-op even if a prior run crashed after writing the backlog file but before flipping the DB row.

## How to navigate

Start at the `scripts/export_to_backlog.ts` header — it documents the five-step adapter contract a second target (`export_to_linear.ts`) re-implements (mint-id + render + write are target-specific; select, the `proposed → exported` flip, and the `export` event are reused). `SKILL.md`'s **Export to backlog** section is the user-facing front door (flags + the swappable-seam note). The three pure concerns are one file each: `render_backlog_task.ts` (PlanTask → backlog markdown, including the body split, slug, priority, and frontmatter), `next_backlog_task_id.ts` (the recursive id scan), and `select_exportable_tasks.ts` (selection + idempotency + the exportable-status guard).

## Key decisions

- **`--priority` maps to `is_classifier_work`.** `PlanTask` has no `priority` field, so the `--priority core|classifier` selector filters on `is_classifier_work` (core-fix vs interim classifier work), and the backlog `priority:` frontmatter is derived from it: core → `high`, classifier → `medium`. This honors the engine's framing that classifier work is explicitly lower-priority than the core fix.
- **Direct filesystem write, scan-based id minting.** A `.ts` script cannot invoke MCP tools, and the firewall forbids granting a mutating `mcp__backlog__*` tool on the `plan` path, so the adapter writes `backlog/tasks/*.md` directly and mints its own ids by scanning the tree. The scan is whole-tree (incl. `archive/`, `completed/`) because a retired id can exceed the live max under `tasks/`.
- **Only live work is exportable.** Selection restricts to `{proposed, accepted}`; terminal states (`superseded`/`resolved`/`abandoned`) are retired work and are reported as non-exportable rather than promoted. Because the reconciler never leaves two live rows sharing a `dedup_key`, excluding terminal rows also guarantees no two selected rows collide on a key, so a multi-row run never writes a duplicate.
- **Reuse, don't re-render.** `PlanTask.title`/`body` are already `render_task_*` output (frozen at mint), so the adapter relocates that text into the backlog file's `## Description` / `## Acceptance Criteria` regions rather than re-rendering from a strategist node it no longer has.

## What to watch

- The adapter follows the same documented-bash-invocation idiom as the existing **Impact reporting (on demand)** section — there is deliberately no separate `/export-to-backlog` slash command (the `plan` skill is already `disable-model-invocation: true`).
- The dedup readback (`backlog_dedup.ts`) scans `backlog/tasks/` only, while the id-mint scans the whole tree; the crash-window dedup guard therefore holds while a promoted file stays under `tasks/`. The DB `status: exported` guard is the backstop for the normal flow.
<!-- SECTION:NOTES:END -->
