---
id: TASK-190.22.12
title: >-
  Tidy backlog/tasks: migrate the 234 auto-filed classifier tickets into the
  task-DB (archive-not-delete)
status: Done
assignee: []
created_date: "2026-06-01 15:20"
updated_date: "2026-06-05 00:00"
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

- [x] #1 A one-shot idempotent `migrate-pipeline-tasks.ts` classifies auto-filed tasks by the label rule (`false-positive-root-cause`/`^[bug]` OR `signal-gap`+`^[gap]`); TASK-190.16.13–17 are correctly KEPT
- [x] #2 Each auto-filed task's content is upserted into the task-DB as a `PlanTask` seed (id preserved, fault_area from label, body/observed_count parsed) before its markdown is touched
- [x] #3 Markdown is removed (the 234 tickets + 0 remaining `.md.tmp` strays); git history is the archive. (Superseded: the original "archive via `task_archive`" was replaced with delete — see Implementation Notes.)
- [x] #4 Mandatory dry-run prints buckets + asserts migrate == 234 before any mutation; the inverse (`git restore` / seed-removal loop) is documented and spot-checked. (Superseded: the keep count is reported informationally, not asserted — see Implementation Notes.)
- [x] #5 After running, `backlog/tasks/` holds 137 human/product `.md` files and 0 `.tmp`; the 234 tickets are queryable in the task-DB
<!-- AC:END -->

## Implementation Notes

### High-level summary

`scripts/migrate-pipeline-tasks.ts` is a one-shot, human-invoked migration that empties the auto-filed pipeline tickets out of `backlog/tasks/` and seeds them into the plan engine's task-DB (`~/.ariadne/plan/`) as its historical corpus. Running it took `backlog/tasks/` from 371 to **137** markdown files (−234) and wrote **234** queryable `PlanTask` rows. `backlog/` is now a clean, human-only surface.

The script classifies every `backlog/tasks/*.md` by a mechanical selector — a task is auto-filed iff (`false-positive-root-cause` ∈ labels OR title matches `^[bug]`) OR (`signal-gap` ∈ labels AND title matches `^[gap]`) — and KEEPs everything else. The gap rule is a conjunction so the human infra tasks TASK-190.16.13–17, which carry `signal-gap` but are not `[gap]`-titled, are correctly kept. Dry-run is the default (classify, print buckets, assert `migrate == 234`, mutate nothing); `--execute` is the explicit gate that seeds then deletes.

### Seed mapping (backlog ticket → `PlanTask`)

Each migrated ticket maps to a total `PlanTask` seed: `id` preserved from frontmatter (e.g. `TASK-206` → `tasks/TASK-206.json`); `tier: localized`, `parent_id: null`, `child_ids: []`, `evidence: []`, `projects: []`, `source_runs: []` (the historical tickets predate the structured per-call evidence model — the prose body is preserved verbatim, so nothing is lost); `title`/`body` carried whole; `observed_count` parsed from the bug body's `**Observed count:** N` (0 for gaps); `created_in_sweep`/`updated_in_sweep`/`strategist` set to the fixed slug `migrate-pipeline-tasks`.

- **`fault_area`** — bugs route their pre-taxonomy `root-cause-<category>` label onto an `AriadneFaultArea` (`receiver_resolution → receiver_type_inference`, `cross_file_flow → import_resolution`, `syntactic_extraction`, `import_resolution`, `coverage_config` map through, `other → other`); a bug with no root-cause label (TASK-343) and every gap map to `other`.
- **`is_classifier_work`** — `false` for bugs (core resolver fixes), `true` for gaps (triage signal-library work, explicitly lower priority).
- **`status` is TERMINAL** — `To Do`/`In Progress` → `abandoned`, `Done` → `resolved`. This is load-bearing: the plan engine's reconciler manages only the live `proposed`/`accepted` set, and a seed has empty `projects[]`, so seeding `proposed` would create 234 un-retireable "live" zombies the engine could never reconcile. Terminal seeds are never matched, augmented, or re-orphaned, yet stay fully queryable. If the same false-positive recurs, triage mints a fresh live task with real evidence.
- **`dedup_key = sha256("seed:" + id)`** — a per-id key, NOT the engine's evidence-location recipe (which, with empty evidence, collapses to `sha256(fault_area)` and would collide across every same-area seed). Safe because terminal seeds are never reconciled by `find_by_dedup_key`.

### Decisions that supersede the original task framing

- **Delete, not archive (AC#3).** The task originally specified archiving the markdown to `backlog/archive/tasks/` via `task_archive`. Per the user's direction this was changed to a plain `fs.rm` delete: **git history is the archive**, so a deleted ticket is recoverable at the pre-migration commit with no `backlog/archive/` copy and no archived-ids sidecar. The script prints the exact inverse on execute (a `rm -f ~/.ariadne/plan/tasks/<id>.json` loop for the seeds, and `git restore --source=HEAD -- backlog/tasks/` / `git revert` for the markdown); the markdown restore was spot-checked on one file.
- **Assert `migrate == 234` only (AC#4).** The repo drifted since the task was written (the user added human tasks), so the keep count is **137**, not the doc's 128. Hardcoding a keep constant would make the migration abort whenever a human task is added, so the script hard-asserts only the stable auto-filed corpus (`138 [bug] + 96 [gap] = 234`) and reports keep informationally. The 15 `.md.tmp` strays the doc mentions were already gone (0 at run time).

### Placement and firewall

The script lives at repo-root `scripts/` (not in the plan skill) because it writes the user's `backlog/` — the backlog firewall (`.claude/rules/backlog-firewall.md`) forbids that from pipeline code, and its AST test scans only `.claude/skills/**` and `packages/**`. Repo-root keeps the script the legitimate human-direct writer outside the scanned trees; a header comment warns against relocating it under those trees. The frontmatter parser is a small folded-YAML-aware regex/line-walk (no new dependency, matching the repo's existing `backlog_dedup.ts` readers) that degrades any malformed task toward KEEP, so a parse failure never silently migrates a human task.

### Tests

`scripts/migrate-pipeline-tasks.test.ts` (33 cases) covers the selector (all bug/gap/keep edges incl. the 190.16.13–17 keep edge and the gap conjunction), the parser (folded/single/double-quoted titles, observed-count, SECTION-vs-`## Description` body, malformed→empty defaults), full-record `toEqual` seed mapping for a bug and a gap plus the TASK-343 `other`/`resolved` fallback, the empty-id and duplicate-id guards, the arg-error branches, determinism, and the `run` integration over temp `ARIADNE_BACKLOG_DIR_OVERRIDE`/`ARIADNE_PLAN_DIR_OVERRIDE` dirs (dry-run mutates nothing; execute seeds + deletes + pins the printed recovery commands; count mismatch throws before any mutation).
