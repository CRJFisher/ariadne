---
id: DRAFT-5
title: 'Deferred — actuator (path A core fixes, path B classifier scripts)'
status: Draft
assignee: []
created_date: '2026-06-01 10:46'
labels:
  - self-repair
  - deferred
  - actuator
dependencies: []
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
parent_task_id: '190.22'
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why this is deferred (out of scope for the restructure)

The restructure (TASK-190.22) deliberately stops at planning: `triage` detects, `plan` produces a coherent, hierarchical body of fix plans. Carrying out fixes is the riskiest part and benefits from a human in the loop, so the **actuator** is a separate process, run manually to begin with. This Draft captures it so the loop-closure and classifier-application intent is not lost.

## Scope (future)

Executes the `plan` skill's output:
- **Path A — Ariadne core fixes:** localised bug fixes to the resolver/core that the strategist plans identify; opens PRs for sign-off.
- **Path B — classifier-script fixes (tier-2):** authoring/fixing the issue-classification scripts. This is where the curator's parked code-mutating machinery lands: `src/apply/*` (`apply_proposals` registry writes via `@ariadnejs/skill-fs` `atomic_update_registry`), `render_classifier.ts`, `render_authored_files`, `orphan_cleanup`, `sync_permanent_rules.ts`, `render_builtins_barrel.ts`, the promotion path (`find_promotion_candidates`, `promotion_candidates`), and the drift/observation registry bookkeeping.

## Loop closure (inherited design)

The reconciler design from the archived TASK-190.18.3 is the seed for closing the loop here: add `fixed_commit`/`fixed_in_run` to `KnownIssue`; scan the target repo's git log for Conventional-Commits scopes matching a rule's `backlog_task` (+ confirm call-site reachability) to flip `wip → fixed` via `atomic_update_registry`. The classifier-lifecycle write-boundary contract (`.claude/rules/classifier-lifecycle.md`) names this writer.

## Explicitly dropped

The fix-sequencer's clustering / Pareto-frontier / `graph.json`+`state.jsonl`+`calibration.jsonl` three-store DAG / worker-concurrency machinery (archived TASK-190.18.* ) is NOT inherited — YAGNI on a single-worker corpus. Ordering, if needed, is `observed_count`/occurrence DESC.

## Promote to a real plan when

The detect→plan loop is proven and `plan` is producing trustworthy, prioritised plans. At that point design the actuator (likely as its own skill) via the `plan` skill itself.
<!-- SECTION:DESCRIPTION:END -->
