---
id: task-190.6
title: Implement finalize_triage.ts script
status: To Do
assignee: []
created_date: '2026-02-17 16:57'
labels: []
dependencies:
  - task-190.1
parent_task_id: task-190
---

## Description

Create the deterministic finalize_triage.ts script that runs after all triage and fix planning is complete. Reads the completed state file, builds output in the existing FalsePositiveTriageResults / EntryPointTriageResults format, saves to analysis_output/ with timestamp, updates the known-entrypoints registry (TPs → project source, dead code → dead-code source), writes new triage patterns for human review, removes the .claude/triage_active marker, and prints a summary.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Verifies phase=complete before proceeding
- [ ] #2 Outputs in existing FalsePositiveTriageResults / EntryPointTriageResults format
- [ ] #3 Saves output via save_json() to analysis_output/ with timestamp
- [ ] #4 Updates known-entrypoints registry: TPs → project source, dead code → dead-code source
- [ ] #5 Writes new triage patterns from meta_review to triage_patterns.json for human review
- [ ] #6 Removes .claude/triage_active marker file
- [ ] #7 Prints summary: counts per category, groups identified, tasks created
<!-- AC:END -->

## Implementation Plan

1. Create .claude/skills/self-repair-pipeline/scripts/finalize_triage.ts
2. Implement state file loading and phase=complete verification
3. Map TriageEntryResult to existing output format types
4. Implement save_json() output to analysis_output/
5. Implement known-entrypoints registry updates
6. Implement triage_patterns.json output from meta_review
7. Remove marker file and print summary
8. Test with mock completed state file
