---
name: prioritize
description: Review the plan engine's task-DB and promote selected PlanTask rows into the user's backlog/. Drives export_to_backlog.ts — the only writer of backlog/, run deliberately by the human when graduating planned work.
argument-hint: "[--status proposed|accepted] [--fault-area <area>] [--priority core|classifier] [--id <db-task-id>...] [--dry-run]"
disable-model-invocation: true
allowed-tools: Bash(node --import tsx:*), AskUserQuestion, Read, Write, Bash(open *)
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

Prioritization is a conversation, not a single command. You build the picture of
the candidate work, hand the user a comprehension doc to grasp it, decide
together which change groups graduate, then promote exactly that set.

Always invoke with `node --import tsx`. Never `pnpm exec tsx` or `npx tsx`
(those open IPC sockets the sandbox blocks).

### 1. Preview the candidates

Run with filters and `--dry-run`. This lists the would-be backlog tasks and
writes nothing — it is the raw prioritization view.

```bash
node --import tsx .claude/skills/plan/scripts/export_to_backlog.ts \
  --status proposed --dry-run
```

The output lists each candidate as `{id, backlog_task, path}`.

### 2. Gather the change groups

Read each candidate's source row at `~/.ariadne/plan/tasks/<id>.json` and group
them by `fault_area` — a **change group** is the set of candidate rows that fix
one fault area. For each group, pull from the rows the signal the user weighs:

- **What changes** — the group's `title`s and `body` prose: the concrete fix
  and the part of Ariadne it touches.
- **Impact (benefit)** — `observed_count` (how many false-positives the fix
  eliminates), `projects` and `source_runs` (how broadly the issue spans). A
  group seen across many projects and runs is high-impact.
- **Cost (blast radius)** — `core_fix_effort` and `core_fix_effort_rationale`:
  the strategist's estimate of how much complexity the core fix adds to Ariadne
  (1 = single-file edit, 3 = new resolver path, 5 = cross-folder pass). `0` on
  classifier-work and taxonomy-extension rows, where blast radius is not
  meaningful.
- **Kind** — `is_classifier_work` marks an interim classifier workaround,
  explicitly lower-priority than the core fix it routes around.

### 3. Create an HTML comprehension doc

Author a diagram-focussed HTML comprehension doc that lets the user grasp the proposed changes in each candidate set at a glance. Write it to a temp path and open it. The doc presents **one section per change group**, and for each group:

- a pair of diagrams side by side showing the proposed change in functionality, accompanied by some minimal explanaitory text
- the impact it will have — the false-positives it removes and how broadly,
  stated concretely (e.g. "eliminates 14 false unreachable-function flags across
  6 projects"),
- the cost/blast-radius and whether it is a core fix or interim classifier work,
- a clear benefit-vs-cost framing so the user can rank groups against each other.

Lead with the groups that have the highest impact-to-cost ratio. Keep it
scannable: the doc is a decision aid, not a transcript of the rows.

### 4. Decide together

Walk the user through the comprehension doc and use `AskUserQuestion` to settle
which change groups graduate this run. Offer the groups as options (and let the
user pick multiple), surfacing the impact-vs-cost tradeoff in each option so the
choice is informed. If the user wants to inspect or re-cut the set, narrow with
the selectors below and re-run `--dry-run`. Do not promote until the user has
confirmed the set.

### 5. Promote

Drop `--dry-run` to write the backlog tasks and flip the rows. Promote exactly
the rows the user confirmed, by id:

```bash
node --import tsx .claude/skills/plan/scripts/export_to_backlog.ts \
  --id <db-task-id> [--id <db-task-id> ...]
```

## Selectors

| Flag                          | Selects                                           |
| ----------------------------- | ------------------------------------------------- |
| `--status proposed\|accepted` | rows in that lifecycle state                      |
| `--fault-area <area>`         | rows in one `AriadneFaultArea`                    |
| `--priority core\|classifier` | core-fix rows, or classifier-authoring rows       |
| `--id <db-task-id>`           | one exact row (repeatable); overrides the filters |
| `--dry-run`                   | list the selection, write nothing                 |

With no selectors, every exportable (`proposed`/`accepted`) row is selected —
always preview that with `--dry-run` first.
