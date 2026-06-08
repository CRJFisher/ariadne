---
name: prioritize
description: Review the plan engine's task-DB and promote selected PlanTask rows into the user's backlog/. Drives export_to_backlog.ts — the only writer of backlog/, run deliberately by the human when graduating planned work.
argument-hint: "[--status proposed|accepted] [--fault-area <area>] [--priority core|classifier] [--id <db-task-id>...] [--dry-run]"
disable-model-invocation: true
allowed-tools: Bash(node --import tsx:*), AskUserQuestion, Read
---

# Prioritize

Graduate planned work into the user's `backlog/`. The `plan` skill leaves
proposed fixes as `PlanTask` rows in its task-DB at `~/.ariadne/plan/tasks/`;
this skill is the deliberate, human-invoked step that picks which of those rows
become real backlog tasks.

It owns no logic of its own. All work runs through one script:

```
.claude/skills/plan/scripts/export_to_backlog.ts
```

That script is the **only writer of `backlog/`** in the pipeline. It is never
run on the autonomous sweep — graduation is always a human decision, which is
what this skill exists to make.

## What the export does

A real run, for each selected exportable row:

1. mints the next free top-level backlog id,
2. writes `backlog/tasks/<id>.md` (rendered from the `PlanTask`'s title/body),
3. stamps the row's verbatim `dedup_key` into the task's `plan_dedup_key`
   frontmatter — the idempotency link,
4. flips the DB row `→ exported` (recording `exported_backlog_task`) and logs
   one `export` `PlanSweepEvent`.

Only `proposed` and `accepted` rows are exportable. A row already `exported`,
or whose `dedup_key` a backlog task already carries, is skipped — so a re-run
with the same arguments is a no-op.

## Workflow

Always invoke with `node --import tsx`. Never `pnpm exec tsx` or `npx tsx`
(those open IPC sockets the sandbox blocks).

1. **Preview the candidates.** Run with filters and `--dry-run`. This lists the
   would-be backlog tasks and writes nothing — it is the prioritization view.

   ```bash
   node --import tsx .claude/skills/plan/scripts/export_to_backlog.ts \
     --status proposed --dry-run
   ```

2. **Review and narrow.** Inspect each candidate's title, `fault_area`, and
   `core_fix_effort`. Narrow the set with the selectors below, or name exact
   rows with `--id`, and re-run `--dry-run` until the list is the work you want.

3. **Promote.** Drop `--dry-run` to write the backlog tasks and flip the rows:

   ```bash
   node --import tsx .claude/skills/plan/scripts/export_to_backlog.ts \
     --id <db-task-id> [--id <db-task-id> ...]
   ```

## Selectors

| Flag                          | Selects                                              |
| ----------------------------- | ---------------------------------------------------- |
| `--status proposed\|accepted` | rows in that lifecycle state                         |
| `--fault-area <area>`         | rows in one `AriadneFaultArea`                       |
| `--priority core\|classifier` | core-fix rows, or classifier-authoring rows          |
| `--id <db-task-id>`           | one exact row (repeatable); overrides the filters    |
| `--dry-run`                   | list the selection, write nothing                    |

With no selectors, every exportable (`proposed`/`accepted`) row is selected —
always preview that with `--dry-run` first.
