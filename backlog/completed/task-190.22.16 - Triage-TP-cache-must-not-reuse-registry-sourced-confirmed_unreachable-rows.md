---
id: TASK-190.22.16
title: 'Triage: TP cache must not reuse registry-sourced confirmed_unreachable rows'
status: Done
assignee: []
created_date: '2026-06-09 20:04'
updated_date: '2026-06-10 09:17'
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
- [x] #1 An entry published with source.kind "registry" in the prior run at the same commit is NOT reused by the TP cache and re-enters the llm-triage route when its rule is deactivated
- [x] #2 An entry published with source.kind "previously-confirmed-tp" in the prior run is NOT reused by the TP cache (re-investigated once; no origin-tracking added to the published schema)
- [x] #3 An entry published with source.kind "llm-tp" in the prior run at the same commit is still reused (existing reuse behavior preserved)
- [x] #4 Test cases for all three source kinds live in the existing .claude/skills/triage/src/finalize/confirmed_unreachable_reuse.test.ts with exact toEqual assertions
- [x] #5 The module header of confirmed_unreachable_reuse.ts states the llm-tp-only cache rule canonically
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## High-level summary

The TP cache existed to skip re-investigation of entries already confirmed unreachable at the same commit. The bug was that `build_cache` indexed every row in `confirmed_unreachable[]` regardless of `source.kind`, so registry-classified entries would be cached and survive rule deactivation — the entry never returned to the llm-triage pool even after a human marked the rule fixed or detected drift. The same mechanism caused previously-confirmed-tp rows to chain indefinitely: run N reuses via cache (stamping `previously-confirmed-tp`), run N+1 caches that row, and so on — the original LLM verdict is unreachable.

The fix is one line in `build_cache`: `if (fp.source.kind !== "llm-tp") continue;`. Only entries with a direct LLM verdict are eligible for reuse. Registry rows return to the investigation pool when their rule is deactivated. Previously-confirmed-tp rows are re-investigated on the next run at the same commit (an accepted cost; no origin-tracking is added to the published schema).

The module header now documents the eligibility rule and the resulting cadence for previously-confirmed-tp entries. The `apply_tp_cache_to_entries` stamp site carries a comment linking the two roles of `previously-confirmed-tp` in this file. The pinned-source path now warns when a caller pins a run whose entries are all filtered (a likely misconfiguration).

Tests cover all three source kinds through `derive_tp_cache` (the public entry point), using `toEqual` against exact `PublishedConfirmedUnreachable` literals for the inclusion cases. `build_output_with_source` was merged back into `build_output` (optional `source` field, defaults to `llm-tp`).
<!-- SECTION:NOTES:END -->
