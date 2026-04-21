---
id: TASK-190.16.7
title: Implement curator group QA (sonnet) and group investigation (opus) dispatchers
status: To Do
assignee: []
created_date: "2026-04-17 14:39"
labels:
  - triage-curator
  - skill
  - agent
dependencies: []
references:
  - /Users/chuck/.claude/plans/open-that-plan-up-hazy-cloud.md
  - .claude/skills/triage-curator/
  - .claude/skills/self-repair-pipeline/known_issues/registry.json
parent_task_id: TASK-190.16
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Plan reference: `~/.claude/plans/open-that-plan-up-hazy-cloud.md` — Phase F4.

Implement the two LLM-powered halves of the curator. Both are invoked per group within `curate_run.ts`.

**Part (a) — Auto-classified group QA (sonnet, lightweight).**
File: `src/group_qa.ts` + `templates/prompt_group_qa.md`.
Single sonnet sub-agent per auto-classified group. Input: `group_id`, registry entry, up to ~15 member entries (file paths + snippets + diagnostics summary) in one prompt. Task: spot obvious outliers — not deep investigation. Output JSON: `{ outliers: Array<{ entry_index, reason }>, confidence_remains_high: boolean, notes }`.
Cost discipline: one prompt, max ~5000 input tokens; agent does NOT read source files unless an outlier hint specifically demands it. Token-intensive deep dives negate the point of deterministic classification. QA outputs feed into drift detection: if a classifier's outlier rate exceeds ~15%, tag registry entry `drift_detected: true`.

**Part (b) — Residual / novel group investigation (opus, deep).**
File: `src/group_investigate.ts` + `templates/prompt_group_investigate.md`.
Opus sub-agent per residual group. Input: `group_id` (possibly `novel:`-prefixed), all member entries with full diagnostics, current classifier inventory (from `known_issues/registry.json`), signal inventory (from `reference/signal_inventory.md`), Ariadne introspection APIs. Task: propose a uniquely-identifying `ClassifierSpec`, linked backlog task, any new signal/API needed, and any code changes. Output JSON: `{ proposed_classifier, backlog_ref, new_signals_needed, code_changes, reasoning }`.

Allowed tools for the opus agent: full Read/Grep/Glob; Edit/Write on `known_issues/registry.json` and `.claude/skills/self-repair-pipeline/src/auto_classify/builtins/*.ts`; MCP `mcp__backlog__task_search`/`task_create`/`task_edit`; MCP `mcp__ariadne__*` for call-graph queries.

Reviewability: opus output is proposals + code diffs; a human approves in a PR. The investigation is autonomous; the application isn't — or if `--dry-run` is passed, nothing is written.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `src/group_qa.ts` and `src/group_investigate.ts` exist with tests
- [ ] #2 `templates/prompt_group_qa.md` and `templates/prompt_group_investigate.md` exist
- [ ] #3 End-to-end: running `curate_run` on an existing webpack triage run produces sonnet QA output for auto-classified groups (with single-prompt, no file reads) and opus investigation output for ≥1 residual group
- [ ] #4 Sonnet QA results populate `outcome.qa_outliers_found` in curator state
- [ ] #5 Opus investigation results populate `outcome.classifiers_proposed` and list backlog task proposals in curator state
- [ ] #6 Classifier drift tagging works: a synthetic high-outlier-rate result sets `drift_detected: true` on the registry entry
- [ ] #7 `--dry-run` prevents all writes to registry, backlog, and code
- [ ] #8 Drift-tagging threshold is 15% (outlier rate) as a configurable constant; test asserts tagging fires at 15% and not at 14%
- [ ] #9 Opus investigator output JSON matches the specified shape: `{ proposed_classifier, backlog_ref, new_signals_needed, code_changes, reasoning }`; sonnet QA output matches `{ outliers, confidence_remains_high, notes }`
- [ ] #10 When current signals are insufficient to uniquely identify a group, the opus investigator surfaces this by emitting a non-empty `new_signals_needed` array — tested with a synthetic residual group that requires a new resolver field
- [ ] #11 Opus write-scope is restricted to `known_issues/registry.json`, `.claude/skills/self-repair-pipeline/src/auto_classify/builtins/*.ts`, and MCP `backlog__task_*` calls; any write outside this set is rejected by the dispatcher
<!-- AC:END -->
