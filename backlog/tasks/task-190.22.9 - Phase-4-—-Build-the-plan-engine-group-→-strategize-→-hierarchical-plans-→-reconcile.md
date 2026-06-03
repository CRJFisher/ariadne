---
id: TASK-190.22.9
title: >-
  Phase 4 — Build the plan engine: group → strategize → hierarchical plans →
  reconcile
status: Done
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
- [x] #1 The `plan-strategist` agent is rewritten to group issues by `AriadneFaultArea` and produce a strategic hierarchical fix plan (not a `BuiltinClassifierSpec`)
- [x] #2 Grouping keys on `AriadneFaultArea` via `derive_fault_area` (190.22.3): deterministic Pass-A bucketing across runs + LLM Pass-B refine/merge; NO union-find/Jaccard/Pareto/DAG
- [x] #3 The skill emits the hierarchical, size-tiered plan as `PlanTask` rows in the task-DB (via `PlanTaskRepository`) + a per-sweep `PlanSweepEvent` log — NOT via `mcp__backlog`
- [x] #4 Reconciliation is computed within the task-DB (`dedup_key`); `backlog/` may be read read-only as a dedup signal only; a re-sweep augments rather than duplicates
- [x] #5 Classifier-script work is included as explicitly lower-priority plan items
- [x] #6 `meta.json` flows finalized to the planning-only reality; diagrams regenerated via the `mermaid-pre-render` skill
- [x] #7 Smoke test over ≥2 finalized runs makes ZERO writes to `backlog/`, `registry.json`, or `packages/core`
- [x] #8 `pnpm -r build && pnpm -r test` green (incl. the firewall enforcement test from 190.22.7)
- [x] #9 Each `other`-bucket (escape-hatch FPs with a `description`, per 190.22.3) yields BOTH a taxonomy-extension plan task (add the missing folder-anchored area to `ariadne_fault_area.ts` + `derive_fault_area`) and an underlying-core-fix plan task
- [x] #10 The published `NovelIssue` and `attach_fault_diagnostics` carry `has_uncaptured_indexed_grep_hit` + `callers_only_in_unindexed_tests` (the 190.22.3 disambiguators), so Pass-A `derive_fault_area` receives real values rather than `false/false`; a finalize test asserts both fields appear on a published FP row
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## High-level summary

**Intent.** Replace the `plan` skill's current per-novel-issue *classifier-spec-authoring* pipeline (`curate_all.ts` dispatches a `plan-strategist` that writes a `BuiltinClassifierSpec` + `ariadne_bug` per issue) with the actual **plan engine**: a deterministic fault-area grouping pass, an LLM strategist that turns each group into a hierarchical fix plan, and a deterministic reconcile-and-write pass that emits `PlanTask` rows + a `PlanSweepEvent` log into the firewalled task-DB at `~/.ariadne/plan/`. The whole classifier-authoring machinery is removed (not bridged) — its blast radius is entirely inside the skill, so callers do not change. Classifier-script work survives as explicitly *lower-priority* `localized` plan items the strategist proposes, not as something the skill does directly.

**Shape of the new engine (group → strategize → reconcile):**

- **Pass A — deterministic grouping** (`scripts/group_runs.ts` + the pure `src/group/group_fault_areas.ts`, replacing `curate_all.ts`): scans finalized runs (`scan_runs`), flattens every false-positive `novel_issues[]` row, maps each to a `PlanTaskEvidence` (the published row's two disambiguator booleans verbatim, `resolution_failure ?? null`), and calls `derive_fault_area(evidence)` — `PlanTaskEvidence` is a structural superset of `DeriveFaultAreaInput`, so no adapter. It buckets by `AriadneFaultArea` into a local `Map`-keyed accumulator (distinct sorted `projects`/`source_runs`/`descriptions`, `needs_judgement` OR-folded), `observed_count = evidence.length`, sorted by occurrence desc, ties broken by area. (`group_by_project` from `impact_report.ts` is intentionally NOT reused — it is `ImpactRow`-shaped; forcing it would need an adapter.) `group_runs.ts` stages one `FaultAreaBucket` per area at `~/.ariadne/plan/staging/<sweep-id>/buckets/<area>.json` and prints a dispatch summary. No union-find / Jaccard / Pareto / DAG.
- **Pass B — LLM strategist** (rewritten `.claude/agents/plan-strategist.md` + `get_bucket_context.ts` hydrator + `validate_plan.ts` self-check loop): the agent receives ONE fault-area bucket and emits a hierarchical fix-plan tree (`architectural` → `fault_area` → `localized`) as a `StrategistPlan` JSON to `staging/<sweep-id>/plans/<area>.json` — *not* a classifier spec. For each `other` bucket it emits BOTH a taxonomy-extension node (`is_taxonomy_extension: true`) and an evidence-grounded core-fix node; classifier-script work appears only as a lower-priority `localized` node (`is_classifier_work: true`). The pure validator (`src/propose/validate_plan.ts`) enforces tier ordering, evidence-index ranges, the `other`-bucket dual-task rule (keyed on `bucket_fault_area === "other"`), and the taxonomy-extension guard. The agent's frontmatter drops the whole-server `backlog` MCP grant (completing the firewall at the agent boundary — `mcp_servers: []`) and narrows `Write` to `~/.ariadne/plan/staging/**`; all classifier-spec / `signal_library_gap` / `ariadne_bug` / task-filing prose is gone.
- **Pass C — reconcile + write** (`scripts/reconcile_plan.ts` + pure `src/reconcile/{compute_dedup_key,build_plan_tasks,reconcile_plan}.ts`): `build_plan_tasks` flattens the tree into `PlanTask` candidates, aggregating evidence up the tree by `file:line` union, minting a deterministic id (`pt-` + sha256(`dedup_key:tier:ordinal`), the single audited `as PlanTaskId` cast) and the immutable `dedup_key` (sha256 of `fault_area` + the sorted-unique evidence `file:line` set — pure, never tier/title/provenance). `reconcile_plan` snapshots the live DB once, then matches each candidate **id-first** (an identical re-sweep matches by content-derived id) falling back to the first *unclaimed* live task with the same `(dedup_key, tier)`; matched tasks are **augmented** (evidence merged, rollups bumped, `updated_in_sweep` set, `created_in_sweep`/title/body preserved) and unmatched ones **created**, with a remap rewiring `parent_id`/`child_ids` to final ids so the tree never forks. Matching is 1:1 — each live task is claimed at most once, so two same-`(dedup_key, tier)` siblings reconcile to distinct tasks. Writes via `JsonPlanTaskRepository.put_many` + one `append_sweep_event` per decision. ZERO writes to `backlog/`, `registry.json`, or `packages/core`. The reconciler emits only `create`/`augment`; retiring nodes a later sweep drops (and the `backlog/` read-only dedup-signal that AC #4 permits) is deferred.

**Prerequisite (AC #10).** The two 190.22.3 disambiguator booleans (`has_uncaptured_indexed_grep_hit`, `callers_only_in_unindexed_tests`) are added as **required** fields on the published `NovelIssue` (`@ariadnejs/skill-protocol`) and copied in `attach_fault_diagnostics` (triage finalize); a finalize test drives `true/true` through to a published FP row and asserts it. No schema-version bump (additive fields the sole producer always sets). Without this Pass A would pass `false/false` and collapse the `coverage_config` / deterministic-`syntactic_extraction` distinctions.

**Substrate kept & evolved:** `scan_runs`, `JsonPlanTaskRepository`, `paths.ts` (gains `plan_staging_*` helpers; `plan_dir` is exported from `@ariadnejs/skill-protocol`; the dead `get_scripts_rel`/`run_output_dir` are removed), `render_task.ts` (re-pointed from `KnownIssue` to rendering a `PlanTask` title/body from a `StrategistPlanNode` + its evidence, with fault-area-folder-anchored acceptance criteria), `impact_report.ts`. **Removed:** `curate_all.ts`, `get_investigate_context.ts`, `validate_responses.ts`, `next_investigate_tasks.ts`, `validate_investigate_responses.ts`, `session_log.ts`, `reference/signal_inventory.md`, and the classifier-spec types (`BuiltinClassifierSpec`, `SignalCheck`, `InvestigateResponse`, `Investigator*`, `AriadneBug`, `SignalLibraryGap`, …). A new `PlanTask.is_classifier_work` field carries the lower-priority signal onto the record so a consumer can order core-fix ahead of classifier-workaround (AC #5). `agent_prompt_pin.test.ts` is rewritten to pin the new contract.

**Docs (AC #6):** `meta.json` is rewritten to the planning-only `group → strategize → reconcile` topology (no `_deferred`, no registry-write/core-builtins stores; plan-tasks/plan-sweeps/plan-staging as write stores, registry + backlog read-only). A new plan-skill `README.per-step.{mmd,svg}` is authored, and the **triage** `README.per-step.{mmd,svg}` + `README.pipeline.{mmd,svg}` are regenerated to the verdict-files-derive-finalize / schema-v5 / planning-only model (dropping the deleted `triage-coordinator`, the in-run `novel_issues.json`/`classifier_regressions.jsonl` artifacts, `schema v4`, and the stale "plan writes wip/backlog" edges) via the `mermaid-pre-render` skill.

**Verification (AC #7, #8):** `tests/plan_engine_smoke.test.ts` drives Pass A over ≥2 finalized fixture runs and the reconcile/write engine on a synthetic strategist plan (the opus agent is not run in-test), asserting grouped hierarchical `PlanTask` rows + a sweep log land under `~/.ariadne/plan/`, a re-sweep augments rather than duplicates, and a before/after content+mtime snapshot of `backlog/`, `registry.json`, and `packages/core/src` is byte-identical. `pnpm -r build`, `pnpm typecheck`, and `pnpm -r test` are green incl. the `backlog_writers`/`registry_writers` firewall enforcement tests.

**Review hardening.** An eight-lens opus review (three correctness, completeness, IA, constitution, test-coverage, adversarial) confirmed the firewall posture, prompt-pin, smoke hermeticity, AC#10 thread-through, and dedup_key purity, and surfaced fixes, all applied: (1) **blocker** — two independent lenses reproduced a re-sweep bug where same-`(dedup_key, tier)` siblings collapsed onto one task (racy double-write, orphaned live task); fixed by 1:1 id-first/claim-once matching in `reconcile_plan` with a regression test; (2) **major** — `is_classifier_work` was dropped at the `PlanTask` boundary, so AC #5's "explicitly lower-priority" was body-prose only; now persisted on the record; (3) the `reconcile_plan.ts` script no longer aborts a whole sweep when one plan lacks its bucket file (per-plan reject, mirroring the validation path); (4) the validator's `other`-bucket rule keys on the true bucket area, not a description-count proxy (unused `other_description_count` removed); (5) dead `paths.ts` helpers removed; (6) `build_plan_tasks` throws a clear error on an out-of-range evidence index; (7) doc honesty — the not-yet-wired `backlog/` read edge removed from the diagram, the stale `package.json`/`impact_report.ts` curation vocabulary scrubbed. Added tests: same-key sibling reconcile, re-ordered-tree fallback match, two previously-unasserted validation codes, multi-root forest + self-grounded parent, and `is_classifier_work` persistence. **Considered, not actioned** (noted for a focused follow-up): dissolving `src/propose/` and renaming the `scripts/validate_plan.ts` CLI to avoid the twin filename (concrete IA wins but coupled to the agent prompt + pin test); script-level unit tests for `group_runs`/`reconcile_plan` (thin glue, covered indirectly by the smoke test); and `supersede`/`combine`/subtractive-tree GC (a node a later sweep drops stays live until a deferred GC/actuator pass — the `dedup_key`-over-aggregated-evidence contract means evidence churn re-keys affected ancestors, so the augment guarantee holds for identical re-sweeps and unchanged-evidence re-authoring).

**Note on task boundary.** This task's ACs (#3, #4, #7) require the `PlanTask` write + in-DB reconcile here; the description's "Related tasks" list also names 190.22.10 as "wire the engine to write `PlanTask` rows + reconcile". Treating the ACs as ground truth, the engine + reconcile + smoke test land in this task; 190.22.10 remains the deeper wiring into the autonomous loop (and the deferred items above).

<!-- SECTION:NOTES:END -->
