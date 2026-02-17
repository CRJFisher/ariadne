---
id: task-190.5
title: Build self-repair-pipeline skill directory and SKILL.md
status: To Do
assignee: []
created_date: '2026-02-17 16:57'
labels: []
dependencies:
  - task-190.1
  - task-190.2
  - task-190.3
  - task-190.4
parent_task_id: task-190
---

## Description

Create the multi-file skill directory that ties all components together. SKILL.md is the main orchestration document (always in context). It includes a pipeline overview, dynamic state injection via shell command, phase-specific instructions for what Claude should do at each step, and reference links. The reference/ directory documents the state machine and diagnosis routing table. The examples/ directory provides sample output. The skill references all sub-agents and scripts created in prior tasks.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SKILL.md has name, description, and allowed-tools frontmatter
- [ ] #2 SKILL.md includes dynamic state injection: cat triage_state/*_triage.json
- [ ] #3 SKILL.md documents all 5 phases: detect → prepare → triage loop → fix planning → finalize
- [ ] #4 SKILL.md references prompt templates for diagnosis-based routing
- [ ] #5 reference/state_machine.md documents all phase transitions and BLOCK/ALLOW logic
- [ ] #6 reference/diagnosis_routes.md documents the routing table and escape hatch
- [ ] #7 examples/sample_triage_output.json provides example final output
- [ ] #8 Skill allowed-tools include Bash(npx tsx:*,pnpm exec tsx:*), Read, Write, Task(all 7 sub-agents)
<!-- AC:END -->

## Implementation Plan

1. Create .claude/skills/self-repair-pipeline/ directory structure
2. Create SKILL.md with frontmatter and orchestration instructions
3. Add dynamic state injection section
4. Document phase-specific instructions referencing scripts and agents
5. Create reference/state_machine.md from plan's Stop Hook State Machine section
6. Create reference/diagnosis_routes.md from plan's routing table
7. Create examples/sample_triage_output.json
