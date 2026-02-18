---
id: task-190.6
title: Implement finalize_triage.ts script
status: Done
assignee: []
created_date: '2026-02-17 16:57'
updated_date: '2026-02-18 10:23'
labels: []
dependencies:
  - task-190.1
parent_task_id: task-190
---

## Description

Create the deterministic `finalize_triage.ts` script that runs after all triage and fix planning is complete. Reads the completed state file, builds output with true_positives, dead_code, and false_positive groups, saves to `analysis_output/` with timestamp, updates the known-entrypoints registry (TPs → "project" source, dead code → "dead-code" source), writes new triage patterns for human review, and prints a summary. `finalize_triage.ts` writes triage results back to the registry, preserving existing sources and adding new `source="project"` / `source="dead-code"` entries.

**Original plan file**: `~/.claude/plans/zazzy-brewing-gem.md`

### finalize_triage.ts Process

**File**: `.claude/skills/self-repair-pipeline/scripts/finalize_triage.ts`

**Inputs**: `--state <path>`

1. Load state file, verify `phase === "complete"`
2. Build output in existing `FalsePositiveTriageResults` / `EntryPointTriageResults` format
3. Save via `save_json()` to `analysis_output/` with timestamp
4. Update known-entrypoints registry (TPs → "project" source, dead code → "dead-code" source)
5. If `meta_review` has new patterns, write to `entrypoint-analysis/triage_patterns.json` for human review
6. Print summary

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Verifies phase=complete before proceeding
- [x] #2 Outputs in existing FalsePositiveTriageResults / EntryPointTriageResults format
- [x] #3 Saves output via save_json() to analysis_output/ with timestamp
- [x] #4 Updates known-entrypoints registry: TPs → project source, dead code → dead-code source
- [x] #5 Writes new triage patterns from meta_review to triage_patterns.json for human review
- [x] #6 Prints summary: counts per category, groups identified, tasks created
<!-- AC:END -->


## Implementation Plan

1. Create .claude/skills/self-repair-pipeline/scripts/finalize_triage.ts
2. Implement state file loading and phase=complete verification
3. Map TriageEntryResult to existing output format types
4. Implement save_json() output to analysis_output/
5. Implement known-entrypoints registry updates
6. Implement triage_patterns.json output from meta_review
7. Print summary
8. Test with mock completed state file


## Implementation Notes

- Created `.claude/skills/self-repair-pipeline/scripts/finalize_triage.ts` as the finalization script
- Extracted pure-function logic into `entrypoint-analysis/src/build_finalization_output.ts` (`build_finalization_output`, `build_finalization_summary`) for testability
- 10 tests in `build_finalization_output.test.ts` covering: all-TP, all-dead-code, mixed classification, FP grouping, multi-group, task file collection, failed entry handling
- Output type is structurally equivalent to `EntryPointTriageResults` — uses `save_json()` with existing `AnalysisCategory`/`ScriptType` enums
- Triage patterns access uses typed `MetaReviewResult.patterns` field (unsafe cast removed)
