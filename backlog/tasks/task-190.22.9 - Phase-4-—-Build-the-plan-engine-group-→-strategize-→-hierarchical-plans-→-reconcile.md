---
id: TASK-190.22.9
title: >-
  Phase 4 — Build the plan engine: group → strategize → hierarchical plans →
  reconcile
status: To Do
assignee: []
created_date: '2026-06-01 14:39'
updated_date: '2026-06-01 15:20'
labels:
  - self-repair
  - plan-skill
  - engine
dependencies:
  - TASK-190.22.5
  - TASK-190.22.3
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
parent_task_id: TASK-190.22
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

This is the heart of the restructure: turn the renamed `plan` skill (a shell after the Phase 3 rename + machinery-strip) into the actual planning engine. It is the largest piece of genuinely new code in TASK-190.22 — split out of the mechanical rename (190.22.5). Depends on: the rename (190.22.5), the shared contract (190.22.2), and the fault-area derivation (190.22.3).

The `plan` skill reads triage outputs across many repos, groups false-positives by `AriadneFaultArea`, has opus strategists propose architectural upgrades + the work path, splits that into a hierarchical body of tasks, and reconciles it against existing plans. **It writes only to its own queryable task-DB — never the user's `backlog/` (firewalled) and never code or the registry.**

## Related tasks (the plumbing this engine builds on)

- **190.22.7** — backlog firewall rule-doc + AST enforcement test.
- **190.22.8** — JSON task-store impl behind `PlanTaskRepository` (`~/.ariadne/plan/`).
- **190.22.10** — wire the engine to write `PlanTask` rows + reconcile within the DB.
- **190.22.11** — user-invoked export/promotion adapter (the sole backlog writer).
- **190.22.12** — tidy `backlog/tasks/`: migrate the 234 auto-filed tickets into the DB (archive-not-delete).
- **DRAFT-6** — deferred SQLite/vector upgrade behind the same interface.

## Scope — keep & evolve the readers

`src/store/{scan_runs,parse_triage_results}.ts` (read finalized runs across repos/projects); the pure `render_task_*` row-builders from `propose_backlog_tasks.ts` + `impact_report.ts` aggregation (the substrate to evolve — feeding `PlanTask` records now, not `mcp__backlog`).

## Scope — the strategist agent

Rewrite the renamed `plan-strategist` agent prompt (file moved in 190.22.5): group issues by root cause / `AriadneFaultArea` and produce a strategic, hierarchical fix plan — NOT a `BuiltinClassifierSpec`.

## Scope — grouping (lightweight, two-pass)

- **Prerequisite — close the disambiguator carry gap.** `derive_fault_area` (190.22.3) takes four inputs: `diagnosis`, `resolution_failure`, `has_uncaptured_indexed_grep_hit`, and `callers_only_in_unindexed_tests`. 190.22.3 added the last two to core's `EntryPointDiagnostics` and the derivation, but the **published `NovelIssue`** (`packages/skill-protocol/src/triage_results.ts`) and the carry helper `attach_fault_diagnostics` (`.claude/skills/triage-entrypoints/src/finalize/output.ts`) currently copy only `diagnosis`/`resolution_failure`/`receiver_kind`. Before Pass A can derive accurately, thread the two booleans through: add them to `NovelIssue` and copy them in `attach_fault_diagnostics`. Without this the plan engine must pass `false/false`, collapsing the `coverage_config` and deterministic-`syntactic_extraction` distinctions into `entry_point_classification`/needs-judgement.
- **Pass A (deterministic):** flatten every FP verdict across all runs; bucket by `AriadneFaultArea` via `derive_fault_area` (190.22.3) keyed on the stored `diagnosis`/`resolution_failure` (+ the two disambiguators carried per the prerequisite above); attach evidence + a per-bucket rollup (reuse `Map`-keyed `summarize_match_history`/`group_by_project`). Sort by occurrence desc.
- **Pass B (LLM strategists):** refine/split, merge across areas, emit the hierarchical fix-plan tree. No union-find/Jaccard/Pareto/DAG.
- **`other`-bucket handling (self-extending taxonomy):** FPs whose `AriadneFaultArea` is `other` carry a free-text `description` of the unclassified signal (the escape hatch authored in 190.22.3). For each such bucket the strategist produces TWO outputs: (1) a plan task to **extend the taxonomy** — add the missing folder-anchored area to `ariadne_fault_area.ts` + its `derive_fault_area` mapping — and (2) a plan task for the **underlying core fix**. This is how the taxonomy grows as core surfaces new fault modes.

## Scope — output + reconciliation (to the task-DB, firewalled)

- Write the plan as `PlanTask` rows (architectural → fault-area → localized) via `PlanTaskRepository` (190.22.8) + a per-sweep `PlanSweepEvent` log. **No writes to `backlog/`.**
- Reconcile **within the task-DB** via `dedup_key` (augment/supersede/combine); MAY read `backlog/` read-only as a dedup signal. Classifier-script work (tier-2) included as lower-priority plan items.
- Graduation to `backlog/` is the user-invoked export adapter (190.22.11) — the only firewall crossing.

## Scope — docs

Finalize `meta.json` flows to the planning-only reality (190.22.5 left the flow/store topology pre-strip behind a `_deferred` marker); regenerate diagrams via the `mermaid-pre-render` skill. Include the `triage` skill's `README.per-step.{mmd,svg}`: it still renders the Phase-1-deleted `triage-coordinator` node, the removed in-run `novel_issues.json`/`classifier_regressions.jsonl` artifacts, and `schema v4` — regenerate it to the verdict-files-derive-finalize / schema-v5 model.

## Verification

Plan-skill smoke test over ≥2 finalized runs: writes grouped (by `AriadneFaultArea`) hierarchical `PlanTask` rows + sweep log under `~/.ariadne/plan/`, a re-sweep augments rather than duplicates, and it makes ZERO writes to `backlog/`, `registry.json`, or `packages/core`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The `plan-strategist` agent is rewritten to group issues by `AriadneFaultArea` and produce a strategic hierarchical fix plan (not a `BuiltinClassifierSpec`)
- [ ] #2 Grouping keys on `AriadneFaultArea` via `derive_fault_area` (190.22.3): deterministic Pass-A bucketing across runs + LLM Pass-B refine/merge; NO union-find/Jaccard/Pareto/DAG
- [ ] #3 The skill emits the hierarchical, size-tiered plan as `PlanTask` rows in the task-DB (via `PlanTaskRepository`) + a per-sweep `PlanSweepEvent` log — NOT via `mcp__backlog`
- [ ] #4 Reconciliation is computed within the task-DB (`dedup_key`); `backlog/` may be read read-only as a dedup signal only; a re-sweep augments rather than duplicates
- [ ] #5 Classifier-script work is included as explicitly lower-priority plan items
- [ ] #6 `meta.json` flows finalized to the planning-only reality; diagrams regenerated via the `mermaid-pre-render` skill
- [ ] #7 Smoke test over ≥2 finalized runs makes ZERO writes to `backlog/`, `registry.json`, or `packages/core`
- [ ] #8 `pnpm -r build && pnpm -r test` green (incl. the firewall enforcement test from 190.22.7)
- [ ] #9 Each `other`-bucket (escape-hatch FPs with a `description`, per 190.22.3) yields BOTH a taxonomy-extension plan task (add the missing folder-anchored area to `ariadne_fault_area.ts` + `derive_fault_area`) and an underlying-core-fix plan task
- [ ] #10 The published `NovelIssue` and `attach_fault_diagnostics` carry `has_uncaptured_indexed_grep_hit` + `callers_only_in_unindexed_tests` (the 190.22.3 disambiguators), so Pass-A `derive_fault_area` receives real values rather than `false/false`; a finalize test asserts both fields appear on a published FP row
<!-- AC:END -->
