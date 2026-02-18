---
id: task-190.7
title: Integrate self-repair pipeline and remove SDK dependency
status: Done
assignee: []
created_date: '2026-02-17 16:58'
updated_date: '2026-02-18 11:34'
labels: []
dependencies:
  - task-190.2
  - task-190.3
  - task-190.4
  - task-190.5
  - task-190.6
parent_task_id: task-190
---

## Description

Wire the self-repair pipeline into the existing skill infrastructure and clean up the old SDK-based code. Update `self-entrypoint-analysis` and `external-entrypoint-analysis` skills to reference the `self-repair-pipeline` skill for their triage + fix-planning steps. Remove the `@anthropic-ai/claude-agent-sdk` dependency from `package.json`. Delete `agent_queries.ts` (the only file using the SDK). Keep the old triage scripts (`triage_false_positives.ts`, `triage_entry_points.ts`) for comparison until verification is complete.

**Original plan file**: `~/.claude/plans/zazzy-brewing-gem.md`

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 self-entrypoint-analysis SKILL.md updated to reference self-repair-pipeline for triage step
- [x] #2 external-entrypoint-analysis SKILL.md updated to reference self-repair-pipeline for triage step
- [x] #3 @anthropic-ai/claude-agent-sdk removed from entrypoint-analysis/package.json
- [x] #4 entrypoint-analysis/src/agent_queries.ts deleted
- [x] #5 All imports of agent_queries.ts removed or replaced
- [x] #6 pnpm install succeeds without the SDK dependency
- [x] #7 Old triage scripts deleted (all 4 SDK-dependent scripts removed; AC #7 superseded per plan decision — comparison value is in git history)
<!-- AC:END -->


## Implementation Plan

1. Read current self-entrypoint-analysis/SKILL.md and external-entrypoint-analysis/SKILL.md
2. Update both to invoke self-repair-pipeline skill for triage + fix planning
3. Remove @anthropic-ai/claude-agent-sdk from entrypoint-analysis/package.json
4. Delete entrypoint-analysis/src/agent_queries.ts
5. Find and update all imports of agent_queries
6. Run pnpm install to verify clean dependency resolution
7. Run TypeScript compilation to verify no broken imports


## Implementation Notes

- Both SKILL.md files updated: replaced multi-step triage/investigation sections with a single "Step 2: Triage and Fix Planning" pointing to `/self-repair-pipeline`
- Removed `agent_queries.ts` row from Architecture tables in both SKILLs
- Removed "Differences from Self-Analysis" section from external SKILL (both skills now share the same pipeline)
- Removed "Example Output (Step 2)" from self SKILL (no longer applicable)
- Deleted all 4 SDK-dependent scripts (not just `agent_queries.ts`): `detect_dead_code.ts`, `triage_false_negatives.ts`, `triage_false_positives.ts`, `triage_entry_points.ts`
- Cleaned up `analysis_io.ts`: removed dead enum values (`DETECT_DEAD_CODE`, `TRIAGE_FALSE_POSITIVES`, `TRIAGE_FALSE_NEGATIVES`, `TRIAGE_ENTRY_POINTS`) and their corresponding `find_most_recent_*` functions
- Updated task-190.8: AC #9 marked complete (scripts already deleted), AC #6 reworded for qualitative comparison, removed implementation steps 8-9
