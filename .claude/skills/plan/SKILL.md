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
`backlog/` is the separate, user-invoked export adapter (TASK-190.22.11) — the
only firewall crossing. See `.claude/rules/backlog-firewall.md`.

**Script invocation:** always `node --import tsx`. Never `pnpm exec tsx` or
`npx tsx`.

## Pipeline overview

| #   | Pass        | Actor                                     | Output                                                                                          |
| --- | ----------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A   | Group       | `scripts/group_runs.ts`                   | One `FaultAreaBucket` per `AriadneFaultArea`, staged under `~/.ariadne/plan/staging/<sweep>/buckets/` + a sweep summary |
| B   | Strategize  | `plan-strategist` (opus, ≤5 concurrent)   | One `StrategistPlan` (hierarchical fix tree) per bucket, self-validated via `scripts/validate_plan.ts` |
| C   | Reconcile   | `scripts/reconcile_plan.ts`               | `PlanTask` rows + a `PlanSweepEvent` log in `~/.ariadne/plan/`; live tasks augmented by `dedup_key` |

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
`file:line` set), then reconciles within the DB: a candidate whose `dedup_key`
already names a live task **augments** it (evidence merged, rollups bumped)
instead of duplicating it; otherwise it is **created**. Writes `PlanTask` rows
via `JsonPlanTaskRepository` and appends one `PlanSweepEvent` per decision to
`sweeps/<sweep_id>.jsonl`. A re-sweep of the same runs augments rather than
duplicates.

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
- **Sweep staging:** `~/.ariadne/plan/staging/<sweep-id>/buckets/<area>.json` (Pass A) + `plans/<area>.json` (Pass B)
- **Task-DB:** `~/.ariadne/plan/tasks/<id>.json` (`PlanTask` rows) + `~/.ariadne/plan/sweeps/<sweep-id>.jsonl` (`PlanSweepEvent` log)
- **Registry (read-only):** `.claude/skills/triage/known_issues/registry.json` — a dedup/grounding signal only

## Firewall (write boundaries)

`plan` never writes `backlog/`, `registry.json`, or `packages/core`. It writes
only the task-DB under `~/.ariadne/plan/`. The user's `backlog/` may be read as
an optional dedup signal but is never written by the pipeline; the only writer is
the user-invoked export adapter (TASK-190.22.11). The full contract and its
AST-enforcement test are in `.claude/rules/backlog-firewall.md`.
