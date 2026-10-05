---
id: TASK-190.18.10
title: "`AskUserQuestion` signoff loop (accept / drop / defer per cluster)"
status: To Do
assignee: []
created_date: "2026-04-29 10:33"
labels:
  - self-repair
  - fix-sequencer
  - user-interaction
dependencies:
  - TASK-190.18.9
parent_task_id: TASK-190.18
priority: high
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

The skill is the only stage in the chain that asks the user a _strategic_ question. Signoff is the gate that turns a planning artifact into queued work — it must be ergonomic, resumable across sessions, and never destructive.

## Scope

- File: `.claude/skills/fix-sequencer/src/record_signoff_decision.ts`
- Iterate clusters in score order (Pareto-frontier first within ties)
- Per cluster: `AskUserQuestion` with options `accept` / `drop` / `defer`
- **On `accept`, when the cluster has N ≥ 3 same-subsystem members**, follow up with a second `AskUserQuestion`: "Spawn a refactor-proposal backlog task for this cluster?" — record the boolean answer as `refactor_proposal_requested` on the decision. (190.18.11 reads this flag and creates the backlog task on the materialization side.)
- Persist decisions to `~/.ariadne/fix-sequencer/runs/<run_id>/decisions.json` after each answer so partial signoff resumes on re-run
- No `edit` branch — edits happen by re-running the skill
- `drop` is non-destructive (no task deletion; just excludes the cluster from materialization)
- `defer` records a free-text reason for the curator's feedback loop

## Decision schema

```ts
{
  "<cluster_id>": {
    "decision": "accept" | "drop" | "defer",
    "decided_at": "<iso-ts>",
    "refactor_proposal_requested"?: boolean,   // only when decision === "accept"
    "defer_reason"?: string                     // only when decision === "defer"
  }
}
```

## Out of scope

- Materialization of accepted clusters (lives in 190.18.11)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Decisions resumable: test simulates SIGINT after 2/N decisions; re-running observes 2 decisions in `decisions.json` and AskUserQuestion is invoked only for the remaining N-2 clusters
- [ ] #2 Drop is non-destructive (no task deletion); only the decision record is written
- [ ] #3 Defer records a free-text reason in `defer_reason`
- [ ] #4 On `accept` with N≥3 same-subsystem members, the follow-up refactor-proposal question fires; answer persisted as `refactor_proposal_requested: bool`
- [ ] #5 `decisions.json` schema validated against `fix_plan_types.ts`
- [ ] #6 Stale decision entries referencing cluster_ids not present in the current run are warned about and ignored (do not crash)
<!-- AC:END -->
