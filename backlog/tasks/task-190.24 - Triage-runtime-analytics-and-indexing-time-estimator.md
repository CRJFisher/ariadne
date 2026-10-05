---
id: TASK-190.24
title: Triage runtime analytics and indexing-time estimator
status: To Do
assignee: []
created_date: "2026-06-22 00:00"
labels:
  - self-repair
  - triage
  - analytics
parent_task_id: TASK-190
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Large external codebases (pytorch at ~7,889 files before exclusions, rust-lang/rust at comparable scale) expose a usability gap in the triage pipeline: before running detection, neither the user nor the agent has an informed estimate of how long indexing will take. Exclusions are currently chosen against a ~4,000-file heuristic, but the right trade-off is **time and CPU budget**, not a file ceiling. The ceiling is a proxy for what actually matters; the proxy should be replaced once observed data is available.

Closing the gap requires two things:

1. **Observed data** — instrument the pipeline to record file count, LOC, and wall-clock indexing time per run, building a corpus of (size → time) observations.
2. **Estimator** — fit a scaling model to that data and expose a script that, given a project's estimated post-exclusion file count, returns a predicted indexing time. The agent uses this to frame exclusion choices in terms of the user's actual budget.

## Scope

### Part 1 — Analytics instrumentation

Extend `detect_entrypoints.ts` (Phase 1) to append one JSON row to a project-scoped analytics store at `~/.ariadne/triage-entrypoints/analytics/<project>/rows.jsonl` after each successful detection run:

| Field           | Value                                                                               |
| --------------- | ----------------------------------------------------------------------------------- |
| `files_indexed` | total source files seen by the indexer                                              |
| `loc_total`     | sum of line counts across all indexed files (fast approximate: read each file once) |
| `duration_ms`   | wall-clock time from indexer start to completion                                    |
| `run_id`        | the run-id the detection output belongs to                                          |
| `timestamp`     | ISO timestamp                                                                       |

The store is append-only. It is never read by the detection or triage pipeline itself — it is a data source only for the estimator script and for offline analysis.

### Part 2 — Estimator script

Add `scripts/estimate_indexing_time.ts` that:

1. Reads all `rows.jsonl` files from `~/.ariadne/triage-entrypoints/analytics/` across all projects.
2. Fits a linear regression of `duration_ms` vs `files_indexed` to the observed rows.
3. Accepts `--files <n>` (the estimated post-exclusion file count from `preview_folders.ts`).
4. Prints a human-readable estimate: predicted time, 95 % prediction interval, and the observation count the model is based on.

If fewer than a configurable minimum (default: 3) observations exist, the script prints a "not enough data — fall back to the ~4,000-file heuristic" message rather than a spurious estimate.

### Part 3 — Skill integration

Update the "Creating a New Project Config" flow in `SKILL.md`:

- After computing the estimated post-exclusion file count (step 3), run the estimator:
  ```bash
  node --import tsx .claude/skills/triage/scripts/estimate_indexing_time.ts --files <n>
  ```
- If the estimator has enough data, include the predicted time alongside the file count in the exclusion proposal shown to the user (step 4). Frame the ask as a time/CPU budget choice — "this exclusion set is estimated to take ~X minutes; does that fit your budget?" — rather than a raw file count.
- If the estimator lacks data, fall back to the existing ~4,000-file heuristic with a note that the estimate will improve as more runs are recorded.
- Update the `Pre-flight: File Count Check` section in `SKILL.md` similarly: for existing configs, run the estimator after computing the post-exclusion count and show the predicted time before proceeding.

## Out of scope

- Complex models (polynomial, per-language, per-machine) — linear regression over `files_indexed` is sufficient for a first pass; LOC is collected for future model refinement.
- Backfilling analytics from prior runs that predate instrumentation.
- Exposing the analytics store via the MCP server.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `detect_entrypoints.ts` appends one analytics row (`files_indexed`, `loc_total`, `duration_ms`, `run_id`, `timestamp`) to `~/.ariadne/triage-entrypoints/analytics/<project>/rows.jsonl` after each successful detection run
- [ ] #2 `scripts/estimate_indexing_time.ts --files <n>` reads all analytics rows across all projects, fits a linear model, and prints a human-readable time estimate with observation count and prediction interval; prints "not enough data" when fewer than 3 rows exist
- [ ] #3 The analytics store is never read by the detection or triage pipeline itself — only by the estimator script
- [ ] #4 The "Creating a New Project Config" flow and the `Pre-flight: File Count Check` section in `SKILL.md` run the estimator after computing the post-exclusion file count and include the predicted time in the proposal when data is available; fall back to the file-count heuristic when data is absent
- [ ] #5 `pnpm -r build && pnpm -r test && pnpm typecheck && pnpm lint` are green
<!-- AC:END -->
