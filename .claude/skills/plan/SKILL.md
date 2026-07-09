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
backlog** below; the writer set for `backlog/` is named under **Write boundaries**).

Pass A buckets only the run's `novel_issues[]` (confirmed false-positives). It
deliberately does **not** consume `uncertain[]`: an uncertain verdict is the
investigator's abstain, not a confirmed FP, so grounding a fix-plan on one would
mint work against an unproven signal. Persistently-uncertain entries are surfaced
to the human instead — as a cross-run repeat count in `get_triage_summary` — to
resolve or exclude, never fed into planning.

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
| `--sweep <id>`     | Resume an existing sweep dir (see Pass B resume)              |

## Flow

### Pass A — group the runs

```bash
node --import tsx .claude/skills/plan/scripts/group_runs.ts <FORWARDED_ARGS>
```

Capture the printed JSON as `SWEEP`. It holds `sweep_id`, `resumed`,
`bucket_count`, `skipped_planned` (the fault areas whose strategist plan is
already staged), and `buckets[]` — each with `fault_area`, `observed_count`,
`projects`, `source_runs`, `needs_judgement`, `description_count`, `bucket_path`
(the staged `FaultAreaBucket` file), and `plan_exists`. The full evidence lives
in the bucket files; the summary is the dispatch manifest.

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
`MAX_CONCURRENT_STRATEGISTS = 5` and drain `SWEEP.buckets[]` in waves. **Skip a
bucket whose `plan_exists` is `true`** — its `StrategistPlan` is already staged
(the `skipped_planned` rollup lists them), so re-dispatching would re-spend the
opus/200-turn fan-out the `--sweep <id>` resume exists to save. For each
remaining bucket, fire one `Task(plan-strategist)` (all buckets in a wave in a
single message so they run in parallel):

> Design the hierarchical fix plan for fault-area bucket `<fault_area>` in sweep
> `<sweep_id>`. Hydrate with `node --import tsx
.claude/skills/plan/scripts/get_bucket_context.ts --bucket <bucket_path>
--sweep <sweep_id>`, then follow your agent instructions (membership review,
> `other`-bucket dual task, permanent-limitation gate, grounded effort estimate)
> and self-validate against `scripts/validate_plan.ts --plan <output_path>
--bucket <bucket_path> --sweep-id <sweep_id>` until it returns clean. Write the
> final `StrategistPlan` JSON to `<output_path>`
> (`~/.ariadne/plan/staging/<sweep_id>/plans/<fault_area>.json`) and return a
> ~15-char `wrote <fault_area>` confirmation — the reconcile pass reads your plan
> from disk, but the confirmation lets the dispatcher distinguish a completed
> write from a pre-write crash without waiting for Pass C's `missing_plan`
> rejection.

Wait for every `Task()` in a wave to return before starting the next. A
strategist that returns without a `wrote <fault_area>` line — or whose
`plans/<fault_area>.json` is missing or zero-byte — crashed before committing its
plan; re-dispatch that bucket rather than letting Pass C reject it as
`missing_plan`.

### Pass C — reconcile into the task-DB

```bash
node --import tsx .claude/skills/plan/scripts/reconcile_plan.ts --sweep <sweep_id> [--strategist <id>]
```

`--strategist <id>` (optional, default `plan-strategist`) is the provenance stamp written onto every minted `PlanTask` (the authoring agent identity); it does not select which plans load — Pass C loads every staged plan under `staging/<sweep-id>/plans/`.

For each staged `(bucket, plan)` pair the reconciler validates the plan,
flattens it into `PlanTask` candidates (minting ids + parent/child links and the
immutable `dedup_key` = a hash of `fault_area` + the sorted `(file_path, name,
kind)` member set), then reconciles within the DB:

The `dedup_key` keys on the flagged **member** identity, not the call-site
`file:line`, so it is drift-tolerant to line shifts — a target-repo commit that
moves a flagged function down its file re-swaps to the SAME key and augments the
existing task instead of re-proposing it. `start_line` is excluded from the key
for exactly this reason (evidence union still keys on the call-site `file:line`,
so two distinct call sites stay distinct evidence). The residual cost is that a
member which changes FILE or NAME re-keys and re-proposes as fresh work; the
prioritize step-1 [exported-overlap advisory](../prioritize/SKILL.md) surfaces
such a candidate against already-exported backlog work for human review (no
auto-suppress).

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

Graduating proposed task-DB rows into the user's `backlog/` is driven by the
`prioritize` skill, which owns the export contract end-to-end: candidate review →
`refactor-task-architect` authoring → `export_to_backlog.ts --assignments <file>
--write` → `graduate_group_docs.ts`. A real write **requires** both `--assignments`
(the architect's `task_assignment.json`) and the explicit `--write` opt-in; a bare
invocation throws, and `--dry-run` previews the candidate rows without writing. See
`prioritize/SKILL.md` for the invocation and `scripts/export_to_backlog.ts`'s
docstring for the canonical flag reference.

**Write boundary:** the adapter runs deliberately by the human, **never on the
autonomous sweep**, and writes `backlog/tasks/*.md` **directly via the filesystem**
(no `mcp__backlog__*` tool), so the `plan` path never holds a mutating backlog
grant — the existing `Bash(node --import tsx:*)` grant is all it needs. Each
exported `PlanTask` becomes a `backlog/tasks/task-<id> - <slug>.md` stamped with
`plan_dedup_keys` (the loop-closure link Pass C's read-only dedup reads back) and
`plan_source_tasks`; the write is idempotent on the `proposed → exported`
transition. A permanent-limitation row is never exportable — its durable
deliverable is a registry classifier routed through `classifier-author`
(`prioritize` step 3a), not a backlog task.

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
`plan_dedup_keys`) as a dedup signal — it is never written by the autonomous
pipeline. `export_to_backlog.ts` is the only writer of `backlog/tasks/*.md` cards;
`graduate_group_docs.ts` moves graduated comprehension docs alongside them. Both
are user-invoked and never run on the sweep.
The registry's analogous human-invoked write path is the `reconcile-registry`
skill (`.claude/skills/reconcile-registry/SKILL.md`) over
`triage/scripts/reconcile_registry.ts`; `plan` never touches the registry.
