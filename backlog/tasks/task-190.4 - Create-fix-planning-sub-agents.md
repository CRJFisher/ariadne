---
id: task-190.4
title: Create fix planning sub-agents
status: To Do
assignee: []
created_date: '2026-02-17 16:57'
labels: []
dependencies:
  - task-190.1
parent_task_id: task-190
---

## Description

Create the four fix-planning-phase custom sub-agents. For each false positive issue group: fix-planner agents investigate Ariadne core code and propose concrete fix plans, plan-synthesizer combines 5 competing plans into the best overall approach, plan-reviewer reviews the synthesis from specific angles (info-arch, simplicity, fundamentality, lang-coverage), and task-writer creates a backlog task incorporating all reviews. Sub-agents write output to files on disk (not returned to top-level), keeping context clean.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 fix-planner agent: sonnet model, Read/Grep/Glob/Write tools, ariadne MCP server, 20 max turns
- [ ] #2 plan-synthesizer agent: opus model, Read/Write tools, 10 max turns
- [ ] #3 plan-reviewer agent: sonnet model, Read/Grep/Glob/Write tools, 15 max turns
- [ ] #4 task-writer agent: sonnet model, Read/Write/Bash(backlog:*) tools, 10 max turns
- [ ] #5 Fix-planner writes plans to triage_state/fix_plans/{group_id}/plan_{n}.md
- [ ] #6 Plan-synthesizer reads all 5 plans and writes synthesis to fix_plans/{group_id}/synthesis.md
- [ ] #7 Plan-reviewer writes reviews to fix_plans/{group_id}/review_{angle}.md
- [ ] #8 Task-writer creates backlog task using backlog CLI
- [ ] #9 Template: backlog_task_template.md for task-writer output format
<!-- AC:END -->

## Implementation Plan

1. Create .claude/agents/fix-planner.md — investigates core code, proposes fix plan, writes to file
2. Create .claude/agents/plan-synthesizer.md — reads 5 plans, evaluates on correctness/simplicity/scope/tests/impact, synthesizes best plan
3. Create .claude/agents/plan-reviewer.md — reviews from one of 4 angles, writes review to file
4. Create .claude/agents/task-writer.md — reads synthesis + 4 reviews, creates backlog task
5. Create .claude/skills/self-repair-pipeline/templates/backlog_task_template.md
