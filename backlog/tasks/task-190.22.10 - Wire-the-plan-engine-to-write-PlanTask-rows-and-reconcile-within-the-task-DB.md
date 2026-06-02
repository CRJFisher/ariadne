---
id: TASK-190.22.10
title: Wire the plan engine to write PlanTask rows and reconcile within the task-DB
status: To Do
assignee: []
created_date: "2026-06-01 15:19"
labels:
  - self-repair
  - plan-skill
  - engine
dependencies:
  - TASK-190.22.8
  - TASK-190.22.3
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
parent_task_id: TASK-190.22
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

The plan engine's output target is the task-DB, not `backlog/`. This is the change to TASK-190.22.9's core: emit `PlanTask` rows via `JsonPlanTaskRepository` (190.22.8) and reconcile within the DB — replacing the old "emit via mcp\_\_backlog / reconcile against backlog/tasks" behavior.

## Scope

- The group→strategize→hierarchical-plan output writes `PlanTask` rows (one per node in the size-tiered tree: architectural → fault-area → localized) via `repository.put_many`, with a `PlanSweepEvent` log per sweep.
- **Reconcile within the task-DB:** for each new proposal compute its `dedup_key` (fault_area + sorted evidence file:line set) and `find_by_dedup_key`; if it collides with a live (`proposed`/`accepted`) task, AUGMENT it (merge evidence, bump rollups) rather than create a duplicate; supersede/combine via the strategist's judgement, recording the decision as a `PlanSweepEvent`. Reconciliation correctness depends only on the DB.
- **Read-only backlog dedup (optional):** the engine MAY `mcp__backlog__task_search` / parse `backlog/tasks/` frontmatter read-only to detect work the user already promoted (mark the DB task `exported`, suppress re-proposal) — never writing backlog.
- **Narrow the `plan-strategist` backlog grant:** `.claude/agents/plan-strategist.md` carries a leftover whole-server `mcpServers: - backlog` grant (admitting every mutator to a 200-turn autonomous agent) from the pre-restructure curator. As part of rewriting the strategist to planning-only, replace it with the specific read-only tools it needs (`mcp__backlog__task_search`, `mcp__backlog__task_view`). This is the agent-grant vector the 190.22.7 firewall rule-doc flags but its `.ts`-only AST test cannot reach.
- Grouping keys on `AriadneFaultArea` via `derive_fault_area` (190.22.3).

## Verification

A sweep over ≥2 finalized runs writes `PlanTask` rows + a sweep log under `~/.ariadne/plan/`, makes ZERO writes to `backlog/`, `registry.json`, or `packages/core`, and a second sweep over the same runs augments existing tasks (no duplicates) rather than re-creating them.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 The engine writes the hierarchical plan as `PlanTask` rows (architectural→fault-area→localized) via `PlanTaskRepository.put_many` + a per-sweep `PlanSweepEvent` log; ZERO writes to `backlog/`/`registry.json`/`packages/core`
- [ ] #2 Reconciliation is computed within the task-DB via `dedup_key`/`find_by_dedup_key`: a re-sweep over the same runs augments existing tasks (merges evidence, bumps rollups) instead of duplicating
- [ ] #3 supersede/combine decisions are recorded as `PlanSweepEvent`s; the DB is the authoritative reconciliation surface
- [ ] #4 Any backlog access is read-only (dedup signal only) and passes the 190.22.7 firewall test
- [ ] #5 Grouping keys on `AriadneFaultArea` via `derive_fault_area` (190.22.3); smoke test over ≥2 runs green
<!-- AC:END -->
