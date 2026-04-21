---
id: TASK-190.16
title: Pre-triage auto-classifier and curator loop
status: To Do
assignee: []
created_date: "2026-04-17 14:50"
labels:
  - self-repair
  - auto-classifier
  - curator
  - initiative
dependencies: []
references:
  - /Users/chuck/.claude/plans/open-that-plan-up-hazy-cloud.md
  - .claude/skills/self-repair-pipeline/SKILL.md
  - ~/.ariadne/self-repair-pipeline/triage_patterns.json
  - ~/.ariadne/self-repair-pipeline/analysis_output/webpack/triage_results
parent_task_id: TASK-190
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

### Plan source

The full architectural plan for this initiative lives at `~/.claude/plans/open-that-plan-up-hazy-cloud.md`. That file is the authoritative source of truth for the design — this task and its sub-tasks (TASK-190.16.1 through TASK-190.16.12) are the execution decomposition. Use the plan file during final review of each sub-task to cross-check that intent and acceptance criteria align with the originating design.

### Summary

This task is the umbrella for a new initiative: **stop re-discovering Ariadne's known failure modes on every pipeline run; start classifying them deterministically.** The self-repair pipeline currently sends every flagged entry point through an LLM triage agent, which re-derives the same conclusions every run. We replace that with a two-sided loop.

### The two sides of the loop

**Consumer side — `self-repair-pipeline` (existing skill, updated).** Between entry-point detection and LLM triage, a new `auto_classify` stage runs entries against a canonical registry of known Ariadne gaps. High-confidence matches get labelled automatically; the LLM only sees residual entries that genuinely might be true positives or unknown failure modes. Deterministic signals come from Ariadne itself — new `CallReference` fields carry _why_ a call didn't resolve (resolver stage + reason, receiver kind, syntactic features) so classifiers can read the resolver's internal state instead of re-implementing it.

**Curator side — new `triage-curator` skill.** Analyses completed pipeline runs. Sonnet agents QA auto-classified groups (single-prompt outlier checks, no source-file deep dives). Opus agents investigate residual groups, proposing new classifier specs, linked backlog tasks, and — when current signals aren't sufficient — new Ariadne introspection APIs or resolver fields. Every registry entry links to a backlog task via `group_id`, so an impact report can rank Ariadne's unsupported language constructs by real-world `observed_count` across projects. This is how backlog prioritisation becomes data-driven rather than intuition-driven.

### Why this is its own initiative

Removing the self-repair pipeline's triage cache is a fundamental architectural shift, not a bug fix. The Stop hook's static whitelist (`~/.ariadne/self-repair-pipeline/known_entrypoints/<pkg>.json`) is a separate concern — it's the dead-code guardrail that fires on coding sessions, is human-maintained, and remains in place. What changes here is the pipeline's own interaction with that file:

1. **Stateless pipeline runs.** The pipeline no longer reads or writes the whitelist; its previous memoization of triage results into those files drifted silently when the target repo changed. The auto-classifier re-derives labels each run from the current tree-sitter queries, current resolver state, and current (version-controlled) registry. No pipeline-maintained per-project state; no drift. (The human-maintained whitelist consumed by the Stop hook is deliberately stateful — it's the codebase's own record of legitimate entry points.)
2. **LLM effort becomes narrow and purposeful.** The residual set shrinks as classifiers cover dominant failure modes (webpack corpus shows 4 groups account for ~70% of false positives). When the LLM does emit a novel `group_id`, that's a signal we've found a genuinely new gap worth tracking.
3. **Closed feedback loop.** Curator verifies consumer output, adds classifiers, creates backlog tasks. Every pipeline run generates data; every curator run either confirms existing classifications or improves them. Registry + backlog stay in sync.

### Three axes of failure

Each axis needs its own classifier family because the evidence differs:

- **Axis A — Tree-sitter capture gaps.** The indexer's `.scm` query didn't fire `@reference.call` / `@reference.constructor`. Evidence: grep hit line has no relevant capture.
- **Axis B — Resolution failures.** Call captured but `resolutions` is empty or wrong. Evidence: new `CallReference.resolution_failure.{stage, reason}` from resolver.
- **Axis C — Framework / decorator patterns.** Legitimate framework entry points (`@pytest.fixture`, `@app.route`, `@Component`). Classifies as **true positive** with `group_id: framework-<name>` — still a useful deterministic label.

### Architecture: core emits facts, skill owns opinions

This initiative draws a hard layering boundary that every subtask respects:

- **`@ariadnejs/core` and `@ariadnejs/types` emit neutral facts only** — resolver-state diagnostics (what stage/reason the resolver tripped on) and AST-shape metadata (receiver kind, syntactic discriminators). Core has *no knowledge* of F-codes, classifier rules, registry entries, or the triage taxonomy. **Adding a new failure category must require zero changes to core.**
- **The skills own all opinions** — `self-repair-pipeline` owns the F-code taxonomy, the predicate DSL, `known_issues/registry.json`, and the classifiers; `triage-curator` owns investigation, drift detection, and backlog linkage. New signals are added to core only when the curator (TASK-190.16.7) proves that existing facts cannot disambiguate a group.

Future iteration happens almost entirely in the skills: adding/refining classifiers, editing the registry, tuning predicates. Core stays still; the skills evolve. When reviewing a subtask PR, ask: "Would adding F11 tomorrow need to touch this file?" If the answer is yes and the file is under `packages/`, the abstraction is wrong.

### Sub-task map

Phase A — Ariadne core enablers (prerequisite metadata):

- **TASK-190.16.1** — `CallReference.resolution_failure` diagnostic (`Result<SymbolId[], ResolutionFailure>` resolver refactor)
- **TASK-190.16.2** — `CallReference.receiver_kind` + `syntactic_features` (indexer-side metadata)
- **TASK-190.16.3** — `explain_call_site()` + `list_name_collisions()` introspection APIs

Phase B — Canonical registry:

- **TASK-190.16.4** — `known_issues/registry.json` schema + seed content + rendered per-language references

Phase C1 — Auto-classify pipeline stage (predicate DSL):

- **TASK-190.16.5** — `auto_classify` stage + predicate DSL evaluator, wired into `prepare_triage.ts`

Phase F — Curator skill (built before classifiers so the curator can bootstrap them):

- **TASK-190.16.6** — Skill scaffold (`scan_runs`, `curator_state`, CLI options `--project`/`--last`/`--run`/`--dry-run`)
- **TASK-190.16.7** — Sonnet group-QA and opus group-investigation dispatchers

Phase C2 — Initial classifier generation (curator-driven):

- **TASK-190.16.8** — Run the curator over the webpack triage corpus with an empty classifier set; opus proposes `ClassifierSpec` entries + co-located builtin `.ts` files for dominant groups
- **TASK-190.16.9** — Validate generated classifiers against the reference benchmark cases documented in TASK-190.16.8; close gaps or justify divergence

Phase D — Residual-only agent + feedback loop:

- **TASK-190.16.10** — Triage agent updated for residual-only workflow; `novel:` prefix feedback; drift monitoring

Phase E — Triage-pipeline cache removal + hook rename:

- **TASK-190.16.11** — Remove the triage pipeline's `known_entrypoints.ts` module and its types; rename the Stop hook from `entrypoint_stop.ts` to `detect_dead_code.ts` (purpose-descriptive); whitelist files and hook behaviour retained

Phase F2 — Curator backlog linkage + reporting:

- **TASK-190.16.12** — Backlog-task linkage + cross-run impact reporting

### Cross-cutting norms

- **No backwards-compatibility hedging.** Rename types, remove old fields, change resolver signatures in the same PR as the replacement. If `EntryPointDiagnostics` should become `EntryPointContext`, do it; don't leave shims.
- **Curator is invoked explicitly.** Running the self-repair-pipeline does NOT trigger the curator. The curator is run manually, on cron, or in CI on a regular cadence. The two skills communicate through files on disk only.
- **Feedback loop only proposes.** The pipeline's registry-update path never auto-writes an active `ClassifierSpec` — only `kind: "none"` entries with `status: "wip"`. Promotion to an active classifier is always a human-reviewed PR.

### What "done" looks like

- Every pipeline run is stateless with respect to previous runs; `known_issues/registry.json` is the only persisted signal and it is version-controlled.
- On webpack corpus, auto-classify matches ≥40% of flagged entries at ≥0.9 confidence.
- Agent-to-classifier disagreement rate <10% per classifier with `min_confidence: 0.9`.
- Curator runs across completed pipeline outputs, inserting `wip`-status registry entries for novel groups and creating backlog tasks with impact-weighted `observed_count`.
- Impact report ranks Ariadne's unsupported constructs by observed frequency, bridging code behaviour to backlog prioritisation.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 All 12 sub-tasks (TASK-190.16.1 through TASK-190.16.12) are complete
- [ ] #2 Pipeline runs produce identical output back-to-back on webpack with no pipeline-maintained per-project state between runs (cache removal verified). The static dead-code whitelist at `~/.ariadne/self-repair-pipeline/known_entrypoints/<pkg>.json` is outside the pipeline's scope and is unchanged.
- [ ] #3 `known_issues/registry.json` seeded with ≥15 entries covering webpack-dominant groups, Axis B F1–F10, Axis C framework patterns
- [ ] #4 Auto-classify rate ≥40% on webpack corpus; per-classifier precision ≥ registered `min_confidence`
- [ ] #5 `triage-curator` skill can curate a full run end-to-end: sonnet QA on auto-classified groups, opus investigation on residual groups, registry/backlog updates with bidirectional links
- [ ] #6 Cross-run impact report ranks Ariadne gaps by `observed_count`; top entries cross-referenced with open backlog tasks
<!-- AC:END -->
