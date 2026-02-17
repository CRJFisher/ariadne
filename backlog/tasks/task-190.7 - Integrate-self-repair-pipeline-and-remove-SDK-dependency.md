---
id: task-190.7
title: Integrate self-repair pipeline and remove SDK dependency
status: To Do
assignee: []
created_date: '2026-02-17 16:58'
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
- [ ] #1 self-entrypoint-analysis SKILL.md updated to reference self-repair-pipeline for triage step
- [ ] #2 external-entrypoint-analysis SKILL.md updated to reference self-repair-pipeline for triage step
- [ ] #3 @anthropic-ai/claude-agent-sdk removed from entrypoint-analysis/package.json
- [ ] #4 entrypoint-analysis/src/agent_queries.ts deleted
- [ ] #5 All imports of agent_queries.ts removed or replaced
- [ ] #6 pnpm install succeeds without the SDK dependency
- [ ] #7 Old triage scripts kept temporarily for comparison (marked for deletion in task-190.8)
<!-- AC:END -->

## Implementation Plan

1. Read current self-entrypoint-analysis/SKILL.md and external-entrypoint-analysis/SKILL.md
2. Update both to invoke self-repair-pipeline skill for triage + fix planning
3. Remove @anthropic-ai/claude-agent-sdk from entrypoint-analysis/package.json
4. Delete entrypoint-analysis/src/agent_queries.ts
5. Find and update all imports of agent_queries
6. Run pnpm install to verify clean dependency resolution
7. Run TypeScript compilation to verify no broken imports
