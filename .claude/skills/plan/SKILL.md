---
name: plan
description: Offline plan engine over completed triage runs. Deterministically groups every false-positive by Ariadne fault area, dispatches one opus strategist per fault-area bucket to design a hierarchical fix plan, and reconciles the plans into the task-DB by dedup_key. Planning-only — never writes the user's backlog, the registry, or core code.
argument-hint: "[--project <name>] [--last <n>] [--run <path>]"
disable-model-invocation: true
allowed-tools: Bash(node --import tsx:*), AskUserQuestion, Read, Write, Glob, Task(plan-strategist)
---

# Plan

**FIRST ACTION — run this immediately, before any other step:**

```bash
node --import tsx .claude/skills/plan/scripts/group_runs.ts $ARGUMENTS
```

Capture the printed JSON as `SWEEP`. Then follow Passes B and C below.
Do NOT call any other Skill. Do NOT search the backlog. Do NOT read any task file.
The pipeline is self-contained.

---

Offline three-pass engine over `triage` outputs: **group → strategize →
reconcile**. Pass A deterministically buckets every published false-positive by
`AriadneFaultArea`; Pass B dispatches one `plan-strategist` (opus) per bucket to
design a hierarchical fix-plan tree; Pass C reconciles the trees into the
task-DB at `~/.ariadne/plan/`, augmenting existing tasks by
`dedup_key` rather than duplicating them.

The engine is **planning-only**: it reads
`analysis_output/<project>/triage_results/<run-id>.json` (schema v5, owned by
`@ariadnejs/skill-protocol`) and writes only `PlanTask` rows + a per-sweep event
log under `~/.ariadne/plan/`. It never writes the user's `backlog/`, the
classifier `registry.json`, or `packages/core`. Graduation of a plan task into
`backlog/` is the separate, user-invoked export adapter (see **Export to
backlog** below) — the only path that writes `backlog/`.

**Script invocation:** always `node --import tsx`. Never `pnpm exec tsx` or
`npx tsx`.

## Pipeline overview

| #   | Pass       | Actor                                   | Output                                                                                                                                                                                                                                                                                                                                       |
| --- | ---------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Group      | `scripts/group_runs.ts`                 | One `FaultAreaBucket` per `AriadneFaultArea`, staged under `~/.ariadne/plan/staging/<sweep>/buckets/`, plus a `manifest.json` recording the full scanned scope (projects + run_ids, incl. zero-FP runs) and a sweep summary. Consults the membership-override store to re-route (or suppress) members a prior sweep judged mis-routed        |
| B   | Strategize | `plan-strategist` (opus, ≤5 concurrent) | One `StrategistPlan` (hierarchical fix tree) per bucket — including a total per-member `membership` review — self-validated via `scripts/validate_plan.ts`                                                                                                                                                                                   |
| C   | Reconcile  | `scripts/reconcile_plan.ts`             | `PlanTask` rows (grounded on confirmed members only) + a `PlanSweepEvent` log in `~/.ariadne/plan/`; live tasks augmented by `dedup_key`, orphans superseded/combined/resolved, user-promoted tasks marked `exported`; membership exclusions recorded as `exclude_member` events + override records + `derive_fault_area` correction signals |

## Arguments

**User input:** `$ARGUMENTS`

| Flag               | Effect                                                        |
| ------------------ | ------------------------------------------------------------- |
| `--project <name>` | Restrict to one project directory under `analysis_output`     |
| `--last <n>`       | Keep the most recent N runs after filtering                   |
| `--run <path>`     | Short-circuit discovery; sweep a single `triage_results` JSON |

## Flow

### Pass A — group the runs

```bash
node --import tsx .claude/skills/plan/scripts/group_runs.ts <FORWARDED_ARGS>
```

Capture the printed JSON as `SWEEP`. It holds `sweep_id`, `bucket_count`, and
`buckets[]` — each with `fault_area`, `observed_count`, `projects`,
`source_runs`, `needs_judgement`, `description_count`, and `bucket_path` (the
staged `FaultAreaBucket` file). The full evidence lives in the bucket files;
the summary is the dispatch manifest.

Pass A reads the membership-override store (`~/.ariadne/plan/membership_overrides.json`,
written by prior reconcile passes) and, for each false-positive, **follows the
override chain** from its derived area: checks for an override at the current area,
re-routes to `suggested_area`, then checks the destination for its own override and
follows again — stopping when no override exists (member lands there), an override
suppresses it (`suggested_area: null`), or a cycle is detected (all areas in the
chain have already excluded the member — suppressed). A member a strategist already
judged mis-routed is therefore corrected here instead of re-adjudicated every sweep.

### Pass B — dispatch the strategist wave

The strategist is opus/200-turn, so cap concurrency at
`MAX_CONCURRENT_STRATEGISTS = 5` and drain `SWEEP.buckets[]` in waves. For each
bucket, fire one `Task(plan-strategist)` (all buckets in a wave in a single
message so they run in parallel):

> Design the hierarchical fix plan for fault-area bucket `<fault_area>` in sweep
> `<sweep_id>`. Hydrate with `node --import tsx
.claude/skills/plan/scripts/get_bucket_context.ts --bucket <bucket_path>
--sweep <sweep_id>`. Run the validator (`scripts/validate_plan.ts --plan
<output_path> --bucket <bucket_path> --sweep-id <sweep_id>`) against your draft until it returns
> clean, then write the final `StrategistPlan` JSON to `<output_path>`
> (`~/.ariadne/plan/staging/<sweep_id>/plans/<fault_area>.json`). First emit a
> total per-member `membership` review (one verdict per evidence index; mark a
> mis-routed member `belongs: false` with a reason and, when tellable, a
> `suggested_area`) and ground tasks on confirmed members only. For an `other`
> bucket, emit BOTH a taxonomy-extension task and an underlying core-fix task.
> Mark a group `is_permanent_limitation=true` only when the caller is
> fundamentally unknowable to static analysis (no realistic resolver fix) —
> such a group has no core fix and carries `core_fix_effort` 0; default
> everything else to core-fix work. Return nothing inline.

Wait for every `Task()` in a wave to return before starting the next.

### Pass C — reconcile into the task-DB

```bash
node --import tsx .claude/skills/plan/scripts/reconcile_plan.ts --sweep <sweep_id> [--strategist <id>]
```

`--strategist <id>` (optional, default `plan-strategist`) names which strategist's staged plans (`staging/<sweep-id>/plans/<area>.json`) the reconciler loads.

For each staged `(bucket, plan)` pair the reconciler validates the plan,
flattens it into `PlanTask` candidates (minting ids + parent/child links and the
immutable `dedup_key` = a hash of `fault_area` + the sorted evidence
`file:line` set), then reconciles within the DB:

- **create / augment** — a candidate whose `dedup_key` already names a live task
  **augments** it (evidence merged, rollups bumped, the latest tree's structural
  pointers adopted) instead of duplicating it; otherwise it is **created**.
- **retire orphans** — a live task no candidate claimed is stale when BOTH hold:
  (a) its grounding projects were ALL scanned this sweep (`projects ⊆` the
  manifest's `projects`), AND (b) its fault area is not in `blocked_fault_areas`
  (areas that had a bucket this sweep but whose strategist plan was rejected or
  missing). Condition (a) prevents a partial sweep from falsely resolving a task
  whose projects it never scanned. Condition (b) prevents a plan failure from
  being misread as "FPs stopped recurring" — an area with no bucket at all is
  unblocked and its orphaned tasks resolve normally. An eligible orphan is either
  re-keyed into a fresh create of the same `(fault_area, tier)` that shares a
  `file:line` → **supersede** (one) / **combine** (several → one); or if nothing
  overlaps, its false-positives stopped recurring → **resolve**
  (`status: "resolved"` — the bug appears fixed).
- **export dedup** — the reconciler reads `backlog/tasks/*.md` frontmatter
  **read-only**, keyed on `plan_dedup_keys` (stamped by the export adapter,
  `scripts/export_to_backlog.ts` — see **Export to backlog** below). A DB task
  whose `dedup_key` a backlog task already carries is marked `exported` and
  suppressed from re-proposal. No backlog write.

- **membership decisions** — each plan carries a per-member `membership` review.
  Tasks are built from `belongs: true` members only (an excluded member grounds no
  node, so it never enters a node's evidence or `dedup_key`). Every `belongs: false`
  verdict is recorded three ways: an `exclude_member` `PlanSweepEvent` (audit), a
  record in the membership-override store (so Pass A re-routes/suppresses it next
  sweep, keyed on the flagged member's identity — drift-tolerant on
  `(file_path, name, kind)`; `start_line` is a collision-breaker that can still
  shift, so a line-moved member re-enters the review), and — when it names a
  `suggested_area` — a `derive_fault_area` correction signal in the sweep summary
  (`derive_fault_area_corrections[]`), the durable signal to fix the deterministic
  derivation, same spirit as the `other`-bucket taxonomy extension.

Writes `PlanTask` rows via `JsonPlanTaskRepository`, the membership-override store,
and appends one `PlanSweepEvent` per decision to `sweeps/<sweep_id>.jsonl`. A
re-sweep of the same runs augments rather than duplicates; an export is idempotent
(re-emitted only on the proposed→exported transition).

## Export to backlog (user-invoked)

Graduate proposed task-DB rows into the user's `backlog/` — the only write into
`backlog/`, run deliberately by the human and **never on the autonomous sweep**.
The adapter writes `backlog/tasks/*.md` **directly via the filesystem** (no
`mcp__backlog__*` tool), so the `plan` path never holds a mutating backlog grant;
the existing `Bash(node --import tsx:*)` grant is all it needs.

```bash
node --import tsx .claude/skills/plan/scripts/export_to_backlog.ts \
  [--status <status>] [--fault-area <area>] \
  [--id <db-task-id>...] [--dry-run]
```

| Flag                          | Effect                                                                                                                                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--status proposed\|accepted` | Select rows in this live state (default `proposed`); only live work is exportable — terminal rows (`superseded`/`resolved`/`exported`) are never promoted                                                                         |
| `--fault-area <area>`         | Restrict to one `AriadneFaultArea`                                                                                                                                                                                                |
| `--id <id>...`                | Export exactly these DB task ids — the filter flags are ignored, but a named row that is already exported (or whose `dedup_key` a backlog task carries) is still skipped, and a terminal-status row is reported as non-exportable |
| `--dry-run`                   | Print the planned writes (incl. the would-be backlog ids); touch nothing                                                                                                                                                          |

Each selected `PlanTask` becomes a new top-level `backlog/tasks/task-<id> - <slug>.md`,
its frontmatter stamped with `plan_dedup_keys: [<PlanTask.dedup_key>, …]` (the
loop-closure link Pass C's read-only dedup reads back, one entry per source group)
and `plan_source_tasks` for traceability; every exported row is a core fix, so
`priority` is always `high`. A permanent-limitation row is never exportable — in
either selection mode — and is reported as `skipped_permanent_limitation`: its
durable deliverable is a registry classifier routed through `classifier-author`
(`prioritize` step 3a), not a backlog task.
On success the DB row flips `proposed → exported` (recording `exported_backlog_task`)
and one `export` `PlanSweepEvent` is logged. **Idempotent:** a row already
`exported`, or whose `dedup_key` a backlog task already carries, is skipped, so a
re-run is a no-op.

## State

`triage-entrypoints` is the fixed on-disk namespace for triage's published
output; `~/.ariadne/plan/` is the plan engine's task-DB (defined in the plan
skill's `src/store/paths.ts`). Both are overridable for tests
(`ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE`, `ARIADNE_PLAN_DIR_OVERRIDE`).

- **Input (read-only):** `~/.ariadne/triage-entrypoints/analysis_output/<project>/triage_results/<run-id>.json`
- **Sweep staging:** `~/.ariadne/plan/staging/<sweep-id>/buckets/<area>.json` + `manifest.json` (Pass A) + `plans/<area>.json` (Pass B)
- **Task-DB:** `~/.ariadne/plan/tasks/<id>.json` (`PlanTask` rows) + `~/.ariadne/plan/sweeps/<sweep-id>.jsonl` (`PlanSweepEvent` log)
- **Membership overrides:** `~/.ariadne/plan/membership_overrides.json` — members a strategist judged mis-routed, keyed on the flagged member's identity (drift-tolerant on `(file_path, name, kind)`; `start_line` can still shift). Written by Pass C, read by Pass A
- **Backlog dedup keys (read-only):** `backlog/tasks/*.md` frontmatter (`plan_dedup_keys`) — the only dedup signal; read by Pass C (`src/store/backlog_dedup.ts`). The plan engine never reads `registry.json`.

## Write boundaries

`plan` never writes `backlog/`, `registry.json`, or `packages/core`. It writes
only the task-DB under `~/.ariadne/plan/` — `tasks/`, `sweeps/`, and the
membership-override store, of which the reconcile pass (Pass C) is the sole
writer; the strategist writes only its staged `StrategistPlan`. Pass C reads `backlog/tasks/*.md`
frontmatter **read-only** (`src/store/backlog_dedup.ts`, keyed on
`plan_dedup_keys`) as a dedup signal — it is never written by the pipeline; the
only writer is the user-invoked export adapter (`scripts/export_to_backlog.ts`).
The registry's analogous human-invoked write path is the `reconcile-registry`
skill (`.claude/skills/reconcile-registry/SKILL.md`) over
`triage/scripts/reconcile_registry.ts`; `plan` never touches the registry.
