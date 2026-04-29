---
id: TASK-190.18.9
title: "Render plan, run signoff loop, document worker contract"
status: To Do
assignee: []
created_date: "2026-04-29 10:33"
updated_date: "2026-04-29 14:26"
labels:
  - self-repair
  - fix-sequencer
  - rendering
dependencies:
  - TASK-190.18.7
parent_task_id: TASK-190.18
priority: high
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

The user-facing flow of fix-sequencer: render the plan → walk the user through accept/drop/defer per cluster → print the `/schedule` one-liner → document the worker contract that consumes the resulting graph. Reviewer 2 grouped these because they form one coherent UX seam from the user's perspective; ship them together to avoid intermediate states where one half exists without the other.

## Render plan + clusters.json sidecar

`prepare_plan.ts` writes:

- `~/.ariadne/fix-sequencer/runs/<run_id>/plan.md`
- `~/.ariadne/fix-sequencer/runs/<run_id>/clusters.json`

`plan.md` top-of-file ranked table columns:

| Column         | Meaning                                               |
| -------------- | ----------------------------------------------------- |
| `rank`         | 1-indexed position in score-descending order          |
| `cluster_id`   | `c-<sha1[:8]>` from 190.18.7                          |
| `size`         | complexity label (S / M / L / XL) from 190.18.7       |
| `blast_radius` | `isolated` / `shared` / `core_resolver` from 190.18.7 |
| `score`        | numeric score from 190.18.7 (3 sig figs)              |
| `pareto`       | `✦` if `is_pareto_frontier === true`, else blank      |
| `members`      | count of `member_task_ids`                            |

Per-cluster section: rationale, member task IDs as backlog links, suggested `intra_order`, refactor-candidate annotation when N ≥ 3 same-subsystem (NOT auto-spawned). Excludes empty fields rather than rendering "N/A".

`clusters.json` shape mirrors what 190.18.11 writes to `graph.json` (same field names, same types).

## Signoff loop

`finalize_plan.ts` invokes `record_signoff_decision.ts`:

- Iterate clusters in score order (Pareto-frontier first within ties)
- Per cluster: `AskUserQuestion` with options `accept` / `drop` / `defer`
- On `accept` when N ≥ 3 same-subsystem members: follow-up `AskUserQuestion`: "Spawn a refactor-proposal backlog task?" — record as `refactor_proposal_requested: bool`
- Persist decisions to `~/.ariadne/fix-sequencer/runs/<run_id>/decisions.json` after each answer (resumable)
- No `edit` branch — edits happen by re-running the skill
- `drop` is non-destructive
- `defer` records a free-text reason

Decision schema:

```ts
{
  "<cluster_id>": {
    "decision": "accept" | "drop" | "defer",
    "decided_at": "<iso-ts>",
    "refactor_proposal_requested"?: boolean,
    "defer_reason"?: string
  }
}
```

## Worker contract documentation

`reference/worker_contract.md` documents:

- **Fold rule**: a node has implicit state `ready` iff it appears in `graph.json` AND no event for it exists in `state.jsonl`. The explicit `ready` event written by 190.18.11 is observability-only; pickers MUST NOT require it. Latest event for a given node wins.
- **Pick rule**: lowest-rank node in state `ready`. v1 ships with no `blocks` edges.
- **Events**: `claim` (worker_id, ts), `progress` (note, ts), `done` (merge_commit, ts).
- **State machine**: `ready → claimed → in_progress → done`.
- **Single-worker assumption** — v1 has no `release` event, no race-handling, no crash-recovery janitor. Multi-worker concurrency is a v1.5 concern.
- **Calibration JSONL schema**: documented here in full (both `predicted` and `landed` row shapes), even though `predicted` rows are written by 190.18.11.

## Reference worker stub

`scripts/drain_graph.ts`:

- Folds state, picks lowest-rank ready node, appends `claim`, appends a synthetic `done` with `merge_commit: "<stub-sha>"`
- Appends a `landed` row to `calibration.jsonl` after the `done` event
- Prints what a real worker would do (file edits, tests, commit) but does NOT modify code or run tests

## `/schedule` one-liner print

After `finalize_plan.ts` completes its signoff + materialize cycle, print one copy-paste `/schedule` invocation referencing the graph path. Skill itself does NOT execute `/schedule`.

## Out of scope

- Graph node write + state.jsonl `ready` event append + calibration `predicted` row write — all live in 190.18.11

## Merge note

Originally split as TASK-190.18.9 (render) + TASK-190.18.10 (signoff) + TASK-190.18.12 (worker contract + calibration + /schedule). Merged after Reviewer 2 pointed out these form one coherent user-facing flow with shared test scaffolding (all run through `finalize_plan.ts` and `drain_graph.ts`). The calibration `predicted` writer was moved into 190.18.11 (its natural home alongside the graph node write); the rest landed here. .10 and .12 archived.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `plan.md` ranked table covers rank, cluster_id, size, blast_radius, score, pareto, members per the column table above
- [ ] #2 Per-cluster section: rationale, member task IDs (as backlog links), suggested `intra_order`, refactor-candidate annotation when N≥3 same-subsystem
- [ ] #3 Test asserts a fixture cluster set renders to a markdown string containing the expected ranks (`| 1 |`, `| 2 |`) and cluster_ids in the expected order
- [ ] #4 Excludes empty fields rather than rendering N/A
- [ ] #5 `clusters.json` validated against `fix_plan_types.ts` `Cluster` shape; uses `is_pareto_frontier` (not `frontier`)
- [ ] #6 Empty cluster set renders `plan.md` with header only (no crash); `clusters.json` is `{ "clusters": [] }`
- [ ] #7 Signoff resumable: SIGINT after 2/N decisions; re-running observes 2 in `decisions.json` and only asks about remaining N-2
- [ ] #8 Drop is non-destructive (no task deletion)
- [ ] #9 Defer records a free-text reason in `defer_reason`
- [ ] #10 On `accept` with N≥3 same-subsystem members, follow-up refactor-proposal question fires; answer persisted as `refactor_proposal_requested`
- [ ] #11 `decisions.json` schema validated against `fix_plan_types.ts`
- [ ] #12 Stale decision entries referencing missing cluster_ids: warn, ignore, do not crash
- [ ] #13 `reference/worker_contract.md` covers fold rule, pick rule, claim/progress/done events, implicit-ready convention, and full calibration JSONL schema (predicted + landed)
- [ ] #14 `scripts/drain_graph.ts` runs end-to-end on one ready node: appends `claim` → `done` → calibration `landed` row, no real edits or test runs
- [ ] #15 `finalize_plan.ts` stdout contains exactly one `/schedule` line per invocation regardless of cluster count
- [ ] #16 Skill itself does not execute `/schedule`
<!-- AC:END -->
