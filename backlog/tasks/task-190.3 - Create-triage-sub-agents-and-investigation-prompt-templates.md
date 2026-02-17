---
id: task-190.3
title: Create triage sub-agents and investigation prompt templates
status: To Do
assignee: []
created_date: '2026-02-17 16:57'
labels: []
dependencies:
  - task-190.1
parent_task_id: task-190
---

## Description

Create the three triage-phase custom sub-agents and their diagnosis-specific prompt templates. The triage-investigator agent investigates one entry using MCP tools (show_call_graph_neighborhood) and returns structured JSON classification. The triage-aggregator groups false positives by shared root cause. The triage-rule-reviewer identifies patterns in escape-hatch results that could become deterministic classification rules. Prompt templates are diagnosis-specific markdown files that separate investigation protocol from orchestration logic.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 triage-investigator agent: sonnet model, Read/Grep/Glob tools, ariadne MCP server, 15 max turns
- [ ] #2 triage-aggregator agent: opus model, Read tools, 5 max turns
- [ ] #3 triage-rule-reviewer agent: sonnet model, Read/Grep tools, 10 max turns
- [ ] #4 Template: prompt_callers_not_in_registry.md — for entries with textual callers but no registry matches
- [ ] #5 Template: prompt_resolution_failure.md — for entries where Ariadne failed to resolve the call target
- [ ] #6 Template: prompt_wrong_target.md — for entries where caller resolves to wrong target
- [ ] #7 Template: prompt_generic.md — escape-hatch for entries not matching any specific diagnosis
- [ ] #8 All agents output structured JSON matching TriageEntryResult interface
- [ ] #9 Agent instructions reference prompt templates from the skill directory
<!-- AC:END -->

## Implementation Plan

1. Create .claude/agents/triage-investigator.md with YAML frontmatter and investigation protocol
2. Create .claude/agents/triage-aggregator.md with grouping instructions
3. Create .claude/agents/triage-rule-reviewer.md with pattern identification instructions
4. Create .claude/skills/self-repair-pipeline/templates/prompt_callers_not_in_registry.md
5. Create .claude/skills/self-repair-pipeline/templates/prompt_resolution_failure.md
6. Create .claude/skills/self-repair-pipeline/templates/prompt_wrong_target.md
7. Create .claude/skills/self-repair-pipeline/templates/prompt_generic.md
8. Validate agents can be discovered by Claude Code (correct frontmatter format)
