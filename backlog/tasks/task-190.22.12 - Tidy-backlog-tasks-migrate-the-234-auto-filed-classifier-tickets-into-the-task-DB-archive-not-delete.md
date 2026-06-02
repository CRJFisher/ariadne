---
id: TASK-190.22.12
title: >-
  Tidy backlog/tasks: migrate the 234 auto-filed classifier tickets into the
  task-DB (archive-not-delete)
status: To Do
assignee: []
created_date: "2026-06-01 15:20"
labels:
  - self-repair
  - cleanup
  - migration
dependencies:
  - TASK-190.22.8
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
parent_task_id: TASK-190.22
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

`backlog/tasks/` is swamped with auto-filed pipeline tickets. Census: **362 task files; 234 are auto-filed** (138 `[bug]` resolver-root-cause tickets, id block TASK-206→343; 96 `[gap]` signal-library tickets, TASK-190.16.21→116) + 15 stray `.md.tmp`. Migrate the auto-filed content into the new task-DB as its seed corpus (nothing lost), then archive the markdown — leaving `backlog/` as a clean, user-only surface (~128 human tasks).

## Mechanical selector (label-based, NOT substring)

A task is auto-filed clutter iff EITHER: `false-positive-root-cause` ∈ labels OR title matches `^\[bug\]`; OR `signal-gap` ∈ labels AND title matches `^\[gap\]`. Everything else is KEEP. (Flagged: TASK-190.16.13–17 carry `signal-gap` but are human infra with no `[gap]` title — the AND-conjunction correctly keeps them. Do NOT migrate.)

## One-shot migration script (`scripts/migrate-pipeline-tasks.ts`)

- Parse each `backlog/tasks/*.md` (skip `.tmp`) frontmatter + `## Description`; classify; skip KEEP.
- Map each auto-filed task → `PlanTask` seed: `id` preserved, `title`/`body`, `fault_area` from the `root-cause-*` / cluster-hint label, `observed_count`/`target_registry_entry` parsed from the bug body, `status`, `source_markdown` (reverse link). Upsert into the task-DB (idempotent on id).
- Then **archive** each migrated markdown via Backlog.md's native `task_archive` (moves to `backlog/archive/tasks/`) — NOT `rm`. Reversible.
- Sweep the 15 `.md.tmp` strays (delete; they're failed-write artifacts with live `.md` counterparts).

## Mandatory safety rails

- **Dry-run first** (default): print the classified buckets (counts + ids) and require explicit confirmation before any mutation. Assert migrated == 234 (138+96) and KEEP == 128 before archiving anything.
- **Idempotent + resumable** via a sidecar recording archived ids (re-run skips done).
- **git checkpoint** committed immediately before the bulk run (whole op is `git revert`-able); archive (not delete) is the reverse path.
- Print the exact inverse (un-archive) command; verify on 1–2 tasks first.

## Expected before/after

`backlog/tasks/`: 362 → **128** `.md` files (−234, ~65%); `.md.tmp`: 15 → 0. End-state: only human/product tasks (190.22.\* restructure, non-gap 190.x, 195/196 epics, etc.).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A one-shot idempotent `migrate-pipeline-tasks.ts` classifies auto-filed tasks by the label rule (`false-positive-root-cause`/`^[bug]` OR `signal-gap`+`^[gap]`); TASK-190.16.13–17 are correctly KEPT
- [ ] #2 Each auto-filed task's content is upserted into the task-DB as a `PlanTask` seed (id preserved, fault_area from label, body/observed_count parsed) before its markdown is touched
- [ ] #3 Markdown is ARCHIVED via `task_archive` (to `backlog/archive/tasks/`), never deleted; the 15 `.md.tmp` strays are removed
- [ ] #4 Mandatory dry-run prints buckets + asserts 234 migrate / 128 keep before any mutation; a git checkpoint is committed first; the inverse (un-archive) is documented and spot-checked
- [ ] #5 After running, `backlog/tasks/` holds ~128 human/product `.md` files and 0 `.tmp`; the 234 tickets are queryable in the task-DB
<!-- AC:END -->
