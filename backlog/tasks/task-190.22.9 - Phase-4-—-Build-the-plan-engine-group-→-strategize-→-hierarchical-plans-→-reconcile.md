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

`src/store/{scan_runs,parse_triage_results}.ts` (read finalized runs across repos/projects); the pure `render_task_*` row-builders from `render_task.ts` + `impact_report.ts` aggregation (the substrate to evolve — feeding `PlanTask` records now, not `mcp__backlog`).

## Scope — the strategist agent

Rewrite the renamed `plan-strategist` agent prompt (file moved in 190.22.5): group issues by root cause / `AriadneFaultArea` and produce a strategic, hierarchical fix plan — NOT a `BuiltinClassifierSpec`. This rewrite must also complete the backlog firewall at the agent boundary (190.22.6 firewalled the skill's `.ts`/SKILL.md surface but deferred the agent prompt here): drop the mutating `backlog` MCP access (`mcpServers`/`mcp_servers: ["backlog"]`, pinned by `agent_prompt_pin.test.ts`) and the task-filing prose, and remove the now-dangling `signal_library_gap_parent_task_id` references (prompt context-field list + the "file a sub-task under …" instruction) — 190.22.6 already removed that field from `get_investigate_context.ts`'s hydrated bundle, so the prompt currently documents a context field it is no longer fed.

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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## High-level summary

**Intent.** Replace the `plan` skill's current per-novel-issue *classifier-spec-authoring* pipeline (`curate_all.ts` dispatches a `plan-strategist` that writes a `BuiltinClassifierSpec` + `ariadne_bug` per issue) with the actual **plan engine**: a deterministic fault-area grouping pass, an LLM strategist that turns each group into a hierarchical fix plan, and a deterministic reconcile-and-write pass that emits `PlanTask` rows + a `PlanSweepEvent` log into the firewalled task-DB at `~/.ariadne/plan/`. The whole classifier-authoring machinery is removed (not bridged) — its blast radius is entirely inside the skill, so callers do not change. Classifier-script work survives as explicitly *lower-priority* `localized` plan items the strategist proposes, not as something the skill does directly.

**Shape of the new engine (group → strategize → reconcile):**

- **Pass A — deterministic grouping** (`scripts/group_runs.ts` + a pure `src/group/group_fault_areas.ts`, replacing `curate_all.ts`): scan finalized runs (`scan_runs`), flatten every false-positive `novel_issues[]` row, call `derive_fault_area({diagnosis, resolution_failure, has_uncaptured_indexed_grep_hit, callers_only_in_unindexed_tests})` on each, and bucket by `AriadneFaultArea`. Each bucket carries its `PlanTaskEvidence[]`, a per-bucket rollup (observed_count / projects / source_runs, reusing the `group_by_project`-style helper), the `other`-bucket free-text `description`s, and `needs_judgement` flags. Sorted by occurrence desc. No union-find / Jaccard / Pareto / DAG.
- **Pass B — LLM strategist** (rewritten `.claude/agents/plan-strategist.md` + a `get_bucket_context.ts` hydrator + a `validate_plan.ts` self-check loop): the agent receives ONE fault-area bucket and emits a hierarchical fix-plan tree (`architectural` → `fault_area` → `localized`) as a `StrategistPlan` JSON — *not* a classifier spec. For each `other` bucket it emits BOTH a taxonomy-extension task (add the missing folder-anchored area to `ariadne_fault_area.ts` + `derive_fault_area`) and an underlying-core-fix task. The agent's mutating `backlog` MCP grant is dropped (completing the backlog firewall at the agent boundary), along with all classifier-spec / `signal_library_gap_parent_task_id` / task-filing prose.
- **Pass C — reconcile + write** (`scripts/reconcile_plan.ts` + pure `src/reconcile/{compute_dedup_key,build_plan_tasks,reconcile_plan}.ts`): flatten the strategist tree into `PlanTask` candidates, mint ids + parent/child links, compute the immutable `dedup_key` (content hash of `fault_area` + sorted evidence `file:line` set, per the `PlanTask.dedup_key` recipe), then reconcile within the DB via `find_by_dedup_key` — a colliding live task is **augmented** (evidence merged, rollups bumped) rather than duplicated; otherwise **created**. Writes through `JsonPlanTaskRepository.put_many` + `append_sweep_event`. MAY read `backlog/` read-only as a dedup signal. ZERO writes to `backlog/`, `registry.json`, or `packages/core`.

**Prerequisite (AC #10).** Thread the two 190.22.3 disambiguator booleans (`has_uncaptured_indexed_grep_hit`, `callers_only_in_unindexed_tests`) onto the published `NovelIssue` (`@ariadnejs/skill-protocol`) and copy them in `attach_fault_diagnostics` (triage finalize), with a finalize test asserting both appear on a published FP row — otherwise Pass A must pass `false/false` and collapses the `coverage_config` / deterministic-`syntactic_extraction` distinctions.

**Substrate kept & evolved:** `scan_runs`, `JsonPlanTaskRepository`, `paths.ts`, `render_task.ts` (re-pointed from `KnownIssue` to building `PlanTask` body/title), `impact_report.ts` aggregation. **Removed:** `curate_all.ts`, `get_investigate_context.ts`, `validate_responses.ts`, `next_investigate_tasks.ts`, `validate_investigate_responses.ts`, `session_log.ts`, `reference/signal_inventory.md`, and the classifier-spec types (`BuiltinClassifierSpec`, `SignalCheck`, `InvestigateResponse`, `Investigator*`, `AriadneBug`, `SignalLibraryGap`, …). `agent_prompt_pin.test.ts` is rewritten to pin the new strategist contract.

**Docs (AC #6):** rewrite `meta.json` to the planning-only flow/store topology (drop the `_deferred` marker, the registry-write/core-builtins stores, the `novel-to-classifier` flow → `group → strategize → reconcile`), author a new plan-skill flow diagram, and regenerate the **triage** skill's `README.per-step.{mmd,svg}` to the verdict-files-derive-finalize / schema-v5 model (it still renders the deleted `triage-coordinator`, the in-run `novel_issues.json` / `classifier_regressions.jsonl` artifacts, and `schema v4`), via the `mermaid-pre-render` skill.

**Verification (AC #7, #8):** a plan-engine smoke test drives Pass A over ≥2 finalized fixture runs and the reconcile/write engine on a synthetic strategist plan (the opus agent is not run in-test), asserting grouped hierarchical `PlanTask` rows + a sweep log land under `~/.ariadne/plan/`, a re-sweep augments rather than duplicates, and ZERO writes hit `backlog/` / `registry.json` / `packages/core`. `pnpm -r build && pnpm -r test` green incl. the firewall enforcement test.

**Note on task boundary.** This task's ACs (#3, #4, #7) require the `PlanTask` write + in-DB reconcile here; the description's "Related tasks" list also names 190.22.10 as "wire the engine to write `PlanTask` rows + reconcile". Treating the ACs as ground truth, the engine + reconcile + smoke test land in this task; 190.22.10 remains the deeper wiring into the autonomous loop.

<!-- SECTION:NOTES:END -->
