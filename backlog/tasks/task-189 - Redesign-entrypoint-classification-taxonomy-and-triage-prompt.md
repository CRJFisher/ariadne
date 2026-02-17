---
id: task-189
title: Redesign entrypoint classification taxonomy and triage prompt
status: To Do
assignee: []
created_date: '2026-02-17 12:34'
labels:
  - triage-pipeline
  - classification
dependencies: []
---

## Description

The entrypoint triage system uses two boolean flags (`is_true_positive`, `is_likely_dead_code`) to encode a three-way classification, with a free-form `group_id` string for false positive sub-categorization. This creates semantic confusion: `commented-out-callers` and `test-only-callers` are classified as "false positives" (detection bugs) when they are actually dead code. The `name-collision-wrong-target` group from the projections analysis was a complete misclassification (genuinely dead code, not a detection bug).

The classification model and the LLM prompt that produces it are tightly coupled and need to be redesigned together. The prompt instructs the agent what work to perform; the extraction format is the receptacle for the useful outputs of that work.

This task is architecture-agnostic — the classification taxonomy, prompt design, and extraction format apply regardless of whether the triage runs via scripts, Claude Code custom agents, MCP tools, or hooks.

### Classification Taxonomy

Three top-level categories, each with kebab-case sub-categories (`classification_reason`):

**true-positive** — Legitimate entry point with no internal callers

- `public-api`, `cli-handler`, `framework-callback`, `lambda-handler`

**dead-code** — Function with no live production callers

- `no-callers`, `commented-out-callers`, `test-only-callers`

**false-positive** — Function HAS real callers that the call graph missed

- `module-qualified-call-resolution`, `protocol-method-implementation`, `name-collision-wrong-target`, or LLM-proposed new values

### Extraction Format

Per-entry (LLM output):

```
{ category, classification_reason, analysis }
```

- `category`: one of the three top-level categories
- `classification_reason`: kebab-case sub-category within category (e.g. "dead-code" → "test-only-callers")
- `analysis`: the agent's full investigation findings — evidence, code paths, and (for false positives) what detection gap caused it and where to fix it. Written so another agent could reproduce the finding and act on it.

Per-group (after aggregation):

```
{ category, classification_reason, root_cause, entries[] }
```

- `root_cause`: synthesized from individual analyses by the aggregation step — describes the shared detection gap

### Prompt Design Principles

The prompt and extraction format are designed as a pair:

1. The prompt instructs the agent what investigation work to perform
2. The extraction format captures the useful outputs of that work
3. `analysis` is a single field — the agent writes one coherent investigation, not artificially split fields
4. The prompt explicitly distinguishes "no live callers" (dead-code) from "has callers that were missed" (false-positive)
5. The prompt provides the known `classification_reason` values as a menu but allows new ones

### Evidence: Projections Analysis (Feb 2026)

External analysis of `~/workspace/AmazonAdv/projections` (82 entries, 20 triaged):

- `test-file-callers-not-in-registry` (5 entries) → should be `dead-code/test-only-callers`
- `commented-out-callers` (1 entry) → should be `dead-code/commented-out-callers`
- `name-collision-wrong-target` (1 entry) → was a misclassification, function is genuinely dead code
- `module-qualified-call-resolution` (2 entries) → correctly `false-positive` (Ariadne core bug, task-188)
- `protocol-method-implementation` (1 entry) → correctly `false-positive` (Ariadne core gap)

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Single classification replaces boolean flags: `category` (true-positive | dead-code | false-positive) plus `classification_reason` (kebab-case sub-category within category)
- [ ] #2 Entries grouped by `category/classification_reason` composite key in output
- [ ] #3 Triage prompt explicitly distinguishes dead-code (no live production callers) from false-positive (has callers that Ariadne missed)
- [ ] #4 `test-only-callers` and `commented-out-callers` classified under dead-code, not false-positive
- [ ] #5 LLM extraction format emits `{ category, classification_reason, analysis }` — single `analysis` field for full investigation findings
- [ ] #6 Aggregation synthesizes shared `root_cause` at group level from individual `analysis` fields
- [ ] #7 Exhaustive triage by default (no --limit) to get complete group sizes for better root cause analysis
<!-- AC:END -->
