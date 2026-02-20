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

Verify the complete self-repair pipeline end-to-end. Run detection on core via the unified `detect_entrypoints.ts --config` flow, then run the full triage pipeline to verify the stop hook drives the triage loop correctly, sub-agents use MCP tools and return correct classifications, the state file progresses through all phases, and fix planning produces backlog tasks. Then run on an external project (projections) using `--path` to verify exhaustive triage completes.

**Original plan file**: `~/.claude/plans/zazzy-brewing-gem.md`

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Self-analysis on core: `detect_entrypoints.ts --config project_configs/core.json` produces valid analysis output, state file progresses triage → aggregation → meta-review → fix-planning → complete
- [ ] #2 Stop hook fires on skill invocation and correctly BLOCKs/ALLOWs at each phase transition
- [ ] #3 Sub-agents return valid TriageEntryResult JSON
- [ ] #4 Fix planning produces plan files, synthesis, reviews, and backlog task for at least one group
- [ ] #5 finalize_triage.ts produces output compatible with existing analysis_output format
- [ ] #6 Classification quality is reasonable: known true positives classified correctly, false positives identified with diagnoses
- [ ] #7 External analysis on projections: `detect_entrypoints.ts --path <projections-path>` runs detection, exhaustive triage completes
- [ ] #8 Pipeline resumes correctly after interruption: re-invoke `/self-repair-pipeline` to resume (state file persists, hook re-activates)
- [x] #9 Old triage scripts deleted: triage_false_positives.ts, triage_entry_points.ts (completed in task-190.7)
<!-- AC:END -->

## Implementation Plan

1. Run detection: `npx tsx scripts/detect_entrypoints.ts --config project_configs/core.json` (from `.claude/skills/self-repair-pipeline/`)
2. Run triage: `npx tsx scripts/prepare_triage.ts` then invoke `/self-repair-pipeline` skill
3. Monitor state file progression through each phase (`triage_state/*_triage.json`)
4. Verify sub-agent outputs (spot-check JSON classification quality)
5. Verify fix planning output files in `triage_state/fix_plans/`
6. Run `npx tsx scripts/finalize_triage.ts`, verify output format in `analysis_output/`
7. Run external: `npx tsx scripts/detect_entrypoints.ts --path <projections-path>`, then full triage
8. Test resumability: interrupt mid-triage, re-invoke `/self-repair-pipeline`, verify continuation from state file
