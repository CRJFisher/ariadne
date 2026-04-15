---
id: DRAFT-4
title: Build a fix-planning skill that turns FP groups into backlog tasks
status: Draft
assignee: []
created_date: "2026-04-15 16:03"
labels:
  - self-repair-pipeline
  - fix-planning
dependencies: []
parent_task_id: TASK-190
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

After the self-repair pipeline identifies false-positive groups with confirmed root causes, a downstream skill should generate actionable fix tasks. For each false-positive group, this skill produces competing fix proposals, synthesizes the best approach, and creates a backlog task.

This is a separate, composable skill invoked after `finalize_triage.ts` when the operator decides that a group of false positives warrants a code fix in Ariadne.

The skill reads the finalization output (false_positive_groups) and orchestrates: 5x fix-planner agents per group → plan-synthesizer → 4x plan-reviewer → task-writer (creates backlog task via MCP).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A SKILL.md exists for the fix-planning skill
- [ ] #2 The skill accepts a triage results file or state path as input
- [ ] #3 For each false-positive group it launches 5 fix-planner agents, one plan-synthesizer, 4 plan-reviewer agents, and one task-writer
- [ ] #4 The task-writer creates a real backlog task via the backlog MCP tool
- [ ] #5 End-to-end test on a real finalization output produces at least one backlog task
<!-- AC:END -->
