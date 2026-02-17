---
id: task-190.8
title: End-to-end verification and old code cleanup
status: To Do
assignee: []
created_date: '2026-02-17 16:58'
labels: []
dependencies:
  - task-190.7
parent_task_id: task-190
---

## Description

Verify the complete self-repair pipeline end-to-end and clean up old code. Run the pipeline on the core package (small set, ~14 entries) to verify the stop hook drives the triage loop correctly, sub-agents use MCP tools and return correct classifications, the state file progresses through all phases, and fix planning produces backlog tasks. Compare results against the old pipeline output. Then run on an external project (projections) to verify exhaustive triage completes. After validation, delete the old triage scripts.

**Original plan file**: `~/.claude/plans/zazzy-brewing-gem.md`

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Self-analysis on core package: state file progresses triage → aggregation → meta-review → fix-planning → complete
- [ ] #2 Stop hook correctly BLOCKs and ALLOWs at each phase transition
- [ ] #3 Sub-agents return valid TriageEntryResult JSON
- [ ] #4 Fix planning produces plan files, synthesis, reviews, and backlog task for at least one group
- [ ] #5 finalize_triage.ts produces output compatible with existing analysis_output format
- [ ] #6 Classification results comparable to old pipeline (triage_false_positives.ts) on same input
- [ ] #7 External analysis on projections: exhaustive triage completes without --limit
- [ ] #8 Pipeline resumes correctly after simulated interruption (kill + restart)
- [ ] #9 Old triage scripts deleted: triage_false_positives.ts, triage_entry_points.ts
<!-- AC:END -->

## Implementation Plan

1. Run self-repair-pipeline skill on --package core
2. Monitor state file progression through each phase
3. Verify sub-agent outputs (spot-check JSON classification quality)
4. Verify fix planning output files in triage_state/fix_plans/
5. Run finalize_triage.ts, compare output format with old pipeline output
6. Run on external project (projections scoped) with exhaustive triage
7. Test resumability: interrupt mid-triage, restart, verify continuation
8. After validation: delete triage_false_positives.ts and triage_entry_points.ts
9. Remove any remaining references to deleted files
