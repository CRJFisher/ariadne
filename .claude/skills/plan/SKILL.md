---
name: plan
description: Offline plan engine over completed triage runs. Deterministically groups every false-positive by Ariadne fault area, dispatches one opus strategist per fault-area bucket to design a hierarchical fix plan, and reconciles the plans into the firewalled task-DB by dedup_key. Planning-only — never writes the user's backlog, the registry, or core code.
argument-hint: "[--project <name>] [--last <n>] [--run <path>]"
disable-model-invocation: true
allowed-tools: Bash(node --import tsx:*), AskUserQuestion, Read, Write, Glob, Task(plan-strategist)
---

# Plan

Offline three-pass engine over `triage` outputs: **group → strategize →
reconcile**. Pass A deterministically buckets every published false-positive by
`AriadneFaultArea`; Pass B dispatches one `plan-strategist` (opus) per bucket to
design a hierarchical fix-plan tree; Pass C reconciles the trees into the
firewalled task-DB at `~/.ariadne/plan/`, augmenting existing tasks by
`dedup_key` rather than duplicating them.

The engine is **planning-only and firewalled**: it reads
`analysis_output/<project>/triage_results/<run-id>.json` (schema v5, owned by
`@ariadnejs/skill-protocol`) and writes only `PlanTask` rows + a per-sweep event
log under `~/.ariadne/plan/`. It never writes the user's `backlog/`, the
classifier `registry.json`, or `packages/core`. Graduation of a plan task into
`backlog/` is the separate, user-invoked export adapter (see **Export to
backlog** below) — the only firewall crossing. See `.claude/rules/backlog-firewall.md`.

**Script invocation:** always `node --import tsx`. Never `pnpm exec tsx` or
`npx tsx`.

## Pipeline overview

| #   | Pass        | Actor                                     | Output                                                                                          |
| --- | ----------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A   | Group       | `scripts/group_runs.ts`                   | One `FaultAreaBucket` per `AriadneFaultArea`, staged under `~/.ariadne/plan/staging/<sweep>/buckets/`, plus a `manifest.json` recording the full scanned scope (projects + run_ids, incl. zero-FP runs) and a sweep summary |
| B   | Strategize  | `plan-strategist` (opus, ≤5 concurrent)   | One `StrategistPlan` (hierarchical fix tree) per bucket, self-validated via `scripts/validate_plan.ts` |
| C   | Reconcile   | `scripts/reconcile_plan.ts`               | `PlanTask` rows + a `PlanSweepEvent` log in `~/.ariadne/plan/`; live tasks augmented by `dedup_key`, orphans superseded/combined/resolved, user-promoted tasks marked `exported` |

## Arguments

**User input:** `$ARGUMENTS`

| Flag               | Effect                                                              |
| ------------------ | ------------------------------------------------------------------- |
| `--project <name>` | Restrict to one project directory under `analysis_output`           |
| `--last <n>`       | Keep the most recent N runs after filtering                         |
| `--run <path>`     | Short-circuit discovery; sweep a single `triage_results` JSON        |

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

### Pass B — dispatch the strategist wave

The strategist is opus/200-turn, so cap concurrency at
`MAX_CONCURRENT_STRATEGISTS = 5` and drain `SWEEP.buckets[]` in waves. For each
bucket, fire one `Task(plan-strategist)` (all buckets in a wave in a single
message so they run in parallel):

> Design the hierarchical fix plan for fault-area bucket `<fault_area>` in sweep
> `<sweep_id>`. Hydrate with `node --import tsx
> .claude/skills/plan/scripts/get_bucket_context.ts --bucket <bucket_path>
> --sweep <sweep_id>`. Run the validator (`scripts/validate_plan.ts --plan
> <output_path> --bucket <bucket_path>`) against your draft until it returns
> clean, then write the final `StrategistPlan` JSON to `<output_path>`
> (`~/.ariadne/plan/staging/<sweep_id>/plans/<fault_area>.json`). For an `other`
> bucket, emit BOTH a taxonomy-extension task and an underlying core-fix task.
> Classifier-script work is a lower-priority `localized` item only. Return
> nothing inline.

Wait for every `Task()` in a wave to return before starting the next.

### Pass C — reconcile into the task-DB

```bash
node --import tsx .claude/skills/plan/scripts/reconcile_plan.ts --sweep <sweep_id>
```

For each staged `(bucket, plan)` pair the reconciler validates the plan,
flattens it into `PlanTask` candidates (minting ids + parent/child links and the
immutable `dedup_key` = a hash of `fault_area` + the sorted evidence
`file:line` set), then reconciles within the DB:

- **create / augment** — a candidate whose `dedup_key` already names a live task
  **augments** it (evidence merged, rollups bumped, the latest tree's structural
  pointers adopted) instead of duplicating it; otherwise it is **created**.
- **retire orphans** — a live task no candidate claimed, whose grounding
  projects were ALL scanned this sweep (`projects ⊆` the manifest's `projects`),
  is stale. If a fresh create in the same `(fault_area, tier)` shares an evidence
  `file:line`, the orphan was re-keyed into it → **supersede** (one) / **combine**
  (several → one); if nothing overlaps, its false-positives stopped recurring →
  **resolve** (`status: "resolved"` — the bug appears fixed). The manifest scope
  is what stops a partial sweep (`--project`, `--last`) from falsely resolving a
  task whose projects it never scanned.
- **export dedup** — the reconciler reads `backlog/tasks/*.md` frontmatter
  **read-only**, keyed on `plan_dedup_key` (stamped by the export adapter,
  `scripts/export_to_backlog.ts` — see **Export to backlog** below). A DB task
  whose `dedup_key` a backlog task already carries is marked `exported` and
  suppressed from re-proposal. No backlog write.

Writes `PlanTask` rows via `JsonPlanTaskRepository` and appends one
`PlanSweepEvent` per decision to `sweeps/<sweep_id>.jsonl`. A re-sweep of the
same runs augments rather than duplicates; an export is idempotent (re-emitted
only on the proposed→exported transition).

## Export to backlog (user-invoked)

Graduate proposed task-DB rows into the user's `backlog/` — the single firewall
crossing, run deliberately by the human and **never on the autonomous sweep**.
The adapter writes `backlog/tasks/*.md` **directly via the filesystem** (no
`mcp__backlog__*` tool), so the `plan` path never holds a mutating backlog grant;
the existing `Bash(node --import tsx:*)` grant is all it needs.

```bash
node --import tsx .claude/skills/plan/scripts/export_to_backlog.ts \
  [--status <status>] [--fault-area <area>] [--priority core|classifier] \
  [--id <db-task-id>...] [--dry-run]
```

| Flag                 | Effect                                                                         |
| -------------------- | ------------------------------------------------------------------------------ |
| `--status proposed\|accepted` | Select rows in this live state (default `proposed`); only live work is exportable — terminal rows (`superseded`/`resolved`/`exported`) are never promoted |
| `--fault-area <area>`| Restrict to one `AriadneFaultArea`                                              |
| `--priority core\|classifier` | `core` selects core-fix rows (stamped backlog `priority: high`), `classifier` the interim classifier work (`priority: medium`) |
| `--id <id>...`       | Export exactly these DB task ids — the filter flags are ignored, but a named row that is already exported (or whose `dedup_key` a backlog task carries) is still skipped, and a terminal-status row is reported as non-exportable |
| `--dry-run`          | Print the planned writes (incl. the would-be backlog ids); touch nothing       |

Each selected `PlanTask` becomes a new top-level `backlog/tasks/task-<id> - <slug>.md`,
its frontmatter stamped with `plan_dedup_key: <PlanTask.dedup_key>` (the
loop-closure link Pass C's read-only dedup reads back) and `plan_source_task` for
traceability; `priority` is `high` for a core fix, `medium` for classifier work.
On success the DB row flips `proposed → exported` (recording `exported_backlog_task`)
and one `export` `PlanSweepEvent` is logged. **Idempotent:** a row already
`exported`, or whose `dedup_key` a backlog task already carries, is skipped, so a
re-run is a no-op.

**Swappable adapter seam.** The export adapter is a thin, replaceable bridge: a
second target (`export_to_linear.ts`, `export_to_github_issues.ts`) re-implements
only **mint-id + render + write** against its tracker and reuses the shared
**select → flip `proposed → exported` → log `export` event** pipeline. The
verbatim `PlanTask.dedup_key`, persisted into a target-side dedup field, is the
fixed idempotency contract every target honors. The full interface lives in the
`export_to_backlog.ts` header; the firewall allowlist
(`ALLOWED_BACKLOG_WRITERS`) names each target that writes a firewalled surface.

## Impact reporting (on demand)

Generate a human-readable ranking of the known-issues registry by observed
impact. Not part of the sweep — invoked separately when the user wants a
snapshot.

```bash
node --import tsx .claude/skills/plan/scripts/generate_impact_report.ts \
  [--top-n 20] [--prior <json>] [--out <md>] [--snapshot <json>]
```

The report prints to stdout (and optionally `--out`) for the user to read; the
pipeline never writes it into `backlog/`.

## State

`triage-entrypoints` is the fixed on-disk namespace for triage's published
output; `~/.ariadne/plan/` is the plan engine's task-DB (defined in
`@ariadnejs/skill-protocol`). Both are overridable for tests
(`ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE`, `ARIADNE_PLAN_DIR_OVERRIDE`).

- **Input (read-only):** `~/.ariadne/triage-entrypoints/analysis_output/<project>/triage_results/<run-id>.json`
- **Sweep staging:** `~/.ariadne/plan/staging/<sweep-id>/buckets/<area>.json` + `manifest.json` (Pass A) + `plans/<area>.json` (Pass B)
- **Task-DB:** `~/.ariadne/plan/tasks/<id>.json` (`PlanTask` rows) + `~/.ariadne/plan/sweeps/<sweep-id>.jsonl` (`PlanSweepEvent` log)
- **Registry (read-only):** `.claude/skills/triage/known_issues/registry.json` — a dedup/grounding signal only

## Firewall (write boundaries)

`plan` never writes `backlog/`, `registry.json`, or `packages/core`. It writes
only the task-DB under `~/.ariadne/plan/`. Pass C reads `backlog/tasks/*.md`
frontmatter **read-only** (`src/store/backlog_dedup.ts`, keyed on
`plan_dedup_key`) as a dedup signal — it is never written by the pipeline; the
only writer is the user-invoked export adapter (`scripts/export_to_backlog.ts`,
the sole `ALLOWED_BACKLOG_WRITERS` entry). The full contract and its
AST-enforcement test are in `.claude/rules/backlog-firewall.md`.
