---
id: task-190
title: Build self-repair pipeline with Claude Code native architecture
status: To Do
assignee: []
created_date: '2026-02-17 16:56'
updated_date: '2026-02-17 16:56'
labels:
  - self-repair
  - entrypoint-analysis
  - claude-code-native
dependencies:
  - task-189
priority: high
---

## Description

Replace the entrypoint-analysis triage pipeline's dependency on @anthropic-ai/claude-agent-sdk with a fully Claude Code native self-repair system. Uses a stop-hook-driven state machine + custom sub-agents for LLM work, with a multi-file skill directory containing scripts, prompt templates, and reference docs. The pipeline detects entry points, triages false positives via sub-agents, plans fixes for each issue group (5 competing plans → synthesis → multi-angle review), and creates backlog tasks. See plan file: .claude/plans/zazzy-brewing-gem.md

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Stop-hook-driven state machine replaces SDK-based triage orchestration
- [ ] #2 Custom sub-agents handle all LLM work in isolated contexts
- [ ] #3 Multi-file skill directory contains all scripts, templates, and reference docs
- [ ] #4 Diagnosis-based routing sends entries to specialized investigation prompts
- [ ] #5 Fix planning pipeline produces backlog tasks for each false positive group
- [ ] #6 Pipeline is resumable via persistent state file
- [ ] #7 @anthropic-ai/claude-agent-sdk dependency removed
- [ ] #8 Full pipeline verified on core package (self-analysis) and external project
<!-- AC:END -->
