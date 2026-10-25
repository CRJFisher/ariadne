---
id: TASK-190.23
title: Adopt Claude Code dynamic workflows for the plan investigation wave
status: To Do
assignee: []
created_date: "2026-06-01 21:44"
updated_date: "2026-10-20 08:28"
labels:
  - self-repair
  - architecture
  - orchestration
dependencies:
  - TASK-190.22
references:
  - "https://code.claude.com/docs/en/workflows"
  - "https://code.claude.com/docs/en/workflows#save-the-workflow-for-reuse"
  - TASK-410
documentation:
  - >-
    /Users/chuck/workspace/ariadne/.worktrees/self-healing-pipeline/self-healing-pipeline-architecture-review.md
parent_task_id: TASK-190
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

`/plan` turns triage's false-positive verdicts into the hierarchical fix plans that become backlog tasks: one `StrategistPlan` per fault-area bucket. Every call-graph fix starts from one of those plans, so how quickly and reliably a sweep produces them sets the pace at which entry-point detection improves.

Pass B runs one `plan-strategist` (Sonnet, up to 200 turns) per bucket. The skill agent fires buckets in waves of `MAX_CONCURRENT_STRATEGISTS = 5` and waits for the whole wave before starting the next. The slowest strategist holds four slots idle, and the dispatch, the wait and the crash re-dispatch are prose in `SKILL.md` that the skill agent re-reads and executes turn by turn.

## Approach

Pass B runs as a saved dynamic workflow, `.claude/workflows/plan-strategists.js`. The script takes the sweep's bucket list from its `args`, skips buckets whose `plan_exists` is `true`, and runs the remaining buckets through `pipeline()`. A slot frees the moment its strategist finishes, so concurrency stays at the cap with no wave barrier. Each strategist keeps its full Claude Code toolset: it hydrates with `get_bucket_context.ts`, self-validates with `validate_plan.ts`, and writes its plan to `~/.ariadne/plan/staging/<sweep_id>/plans/<fault_area>.json`, as it does today. `agent()` with a `schema` returns a validated `{ fault_area, wrote: boolean }` confirmation. The script re-dispatches a bucket once when it returns no confirmation or `null`, and returns the list of buckets that still failed.

The durable state stays on disk: staged plans, `plan_exists`, and the `--sweep <id>` resume. A run interrupted mid-sweep resumes from the staged plans in a fresh session. The workflow replaces only the in-run orchestration.

Triage's investigation loop runs on TASK-410's deterministic Agent SDK dispatch script. Triage investigators are short, numerous and cost-gated, so they need a lean custom system prompt, a turn cap, per-investigation usage, and a clean stop on spend limits. Strategists are few, long and need the full harness, which a workflow agent provides.

## Workflow constraints

- Research preview, Claude Code v2.1.154+. Treat the API as subject to change.
- The script body has no filesystem or shell access. The bucket list comes in through `args`, and the strategists do all disk I/O.
- Concurrency is `min(16, CPUs − 2)` per workflow. The cap of 5 strategists fits within it.
- Resume through `resumeFromRunId` works only in the same session. Cross-session resume relies on the staged plans, as it does today.

## Out of scope

- The triage investigation loop, which is owned by TASK-410.
- Changes to the `StrategistPlan` contract, `validate_plan.ts`, or Pass C's reconcile.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Pass B runs as a saved dynamic workflow in `.claude/workflows/` that dispatches one `plan-strategist` per unplanned bucket through `pipeline()`, with no wave barrier, at a concurrency cap of 5
- [ ] #2 The workflow re-dispatches a bucket once when its strategist returns no confirmation, and reports every bucket that still has no staged plan
- [ ] #3 Staged plans, `plan_exists` skipping, and `--sweep <id>` resume behave as before; Pass C's reconcile reads the same staged plans
- [ ] #4 `.claude/skills/plan/SKILL.md` documents the workflow as Pass B's entry point in canonical, self-contained style, and no prose wave-dispatch algorithm remains
- [ ] #5 `pnpm -r build && pnpm -r test && pnpm typecheck && pnpm lint` are green
<!-- AC:END -->
