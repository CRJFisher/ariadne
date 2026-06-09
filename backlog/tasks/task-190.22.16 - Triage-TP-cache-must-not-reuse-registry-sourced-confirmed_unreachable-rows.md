---
id: TASK-190.22.16
title: "Triage: TP cache must not reuse registry-sourced confirmed_unreachable rows"
status: To Do
assignee: []
created_date: "2026-06-09 20:04"
labels:
  - self-repair
  - bug
dependencies: []
parent_task_id: TASK-190.22
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

The TP cache launders registry-suppressed entries past the classifier lifecycle's deactivation, defeating exactly the re-examination the registry lifecycle exists to enable.

## Failure scenario

Run A at commit X auto-classifies entry E via wip rule R → published in `confirmed_unreachable[]` with `source: {kind: "registry", group_id: R}`. The human then marks R `fixed` (or review flips `drift_detected: true`). Run B at the same commit X: `active_rules_for_classification` (`.claude/skills/triage/src/known_issues_registry.ts` ~95–103) correctly deactivates R, returning E to the investigation pool — but the TP cache immediately flips E back to `completed`/`known-unreachable` as `previously-confirmed-tp`, sourced from a registry row. The next run's cache then perpetuates it via the chained `previously-confirmed-tp` row.

## Root cause

`build_cache` in `.claude/skills/triage/src/finalize/confirmed_unreachable_reuse.ts` (~lines 79–86) indexes **every** row of the prior run's `confirmed_unreachable[]` with no filter on `source.kind`. That array mixes `llm-tp`, `registry`, and `previously-confirmed-tp` rows (see `parse_known_source` in `.claude/skills/triage/src/finalize/output.ts`).

## Fix direction

Cache only rows whose `source.kind === "llm-tp"`. Chained `previously-confirmed-tp` rows do not record their origin kind, so excluding them means a genuine TP confirmed two runs ago is re-investigated once — an accepted cost; do NOT add origin-tracking provenance to the published schema for this.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 An entry published with source.kind "registry" in the prior run at the same commit is NOT reused by the TP cache and re-enters the llm-triage route when its rule is deactivated
- [ ] #2 An entry published with source.kind "previously-confirmed-tp" in the prior run is NOT reused by the TP cache (re-investigated once; no origin-tracking added to the published schema)
- [ ] #3 An entry published with source.kind "llm-tp" in the prior run at the same commit is still reused (existing reuse behavior preserved)
- [ ] #4 Test cases for all three source kinds live in the existing .claude/skills/triage/src/finalize/confirmed_unreachable_reuse.test.ts with exact toEqual assertions
- [ ] #5 The module header of confirmed_unreachable_reuse.ts states the llm-tp-only cache rule canonically
<!-- AC:END -->
