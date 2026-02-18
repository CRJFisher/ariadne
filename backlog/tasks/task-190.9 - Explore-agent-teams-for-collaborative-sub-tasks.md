---
id: task-190.9
title: Explore agent teams for collaborative sub-tasks
status: To Do
assignee: []
created_date: '2026-02-17 17:15'
labels: []
dependencies:
  - task-190.8
parent_task_id: task-190
---

## Description

Explore replacing independent sub-agents with agent teams for three sub-task types. Agent teams allow teammates to share findings via a mailbox system, reducing redundant investigation and producing more coherent outputs. Requires the experimental CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 flag. Implement after the core pipeline is proven with independent sub-agents.

Original plan file: ~/.claude/plans/zazzy-brewing-gem.md

### 1. Entry triage: Team of 3 haiku investigators

Replaces 1 sonnet sub-agent per entry with a team of 3 haiku investigators per batch.

- Investigator A finds a pattern in file X → messages team via mailbox
- Investigator B encountering the same module benefits from A's finding
- Shared context reduces redundant investigation; 3 haiku agents may match 1 sonnet at lower cost
- Haiku is ~10x cheaper than sonnet. Even with 3 agents + coordination overhead, potential ~50% cost reduction

### 2. Fix planning: Team of 5 planners

Replaces 5 independent fix-planner sub-agents with a team of 5 planners.

- Planner A: 'I found the resolution logic in call_resolver.ts:142' → all planners work from same code understanding
- Planner B: 'My approach requires changes to the type registry too' → others adjust proposals
- The synthesis step becomes lighter because plans are already informed by shared context
- Reduces the need for a separate plan-synthesizer agent

### 3. Plan review: Team of 4 reviewers

Replaces 4 independent plan-reviewer sub-agents with a team of 4 reviewers.

- Info-arch reviewer: 'The proposed file split creates a circular dependency'
- Simplicity reviewer sees this → adjusts their suggestion to avoid the same issue
- Fundamentality reviewer: 'The approach only fixes the symptom' → others factor this in
- Reviews are more coherent and address cross-cutting concerns

### Implementation Notes

- Requires CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 in environment
- Each team spawns from the top-level session (no nesting)
- The state file (`triage_state/*_triage.json`) still tracks progress — the stop hook (`scripts/triage_loop_stop.ts`) does not change
- `.claude/skills/self-repair-pipeline/SKILL.md` would document when to use teams vs independent sub-agents
- Could be gated on the experimental flag: use teams if available, fall back to independent sub-agents if not
- The state file is the key abstraction — it works with both approaches. Migration is a swap of the orchestration layer, not a redesign

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Agent teams variant implemented for entry triage (3 haiku investigators per batch)
- [ ] #2 Agent teams variant implemented for fix planning (5 planners sharing findings)
- [ ] #3 Agent teams variant implemented for plan review (4 reviewers building on each other)
- [ ] #4 Fallback to independent sub-agents when CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS is not set
- [ ] #5 Cost comparison: measure token usage of team variant vs independent sub-agent variant on same input
- [ ] #6 Quality comparison: compare triage accuracy and plan quality between approaches
<!-- AC:END -->

## Implementation Plan

1. Verify CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 is available and stable
2. Implement team variant for entry triage (3 haiku investigators)
3. Test on core package, compare accuracy and cost vs sonnet sub-agent
4. Implement team variant for fix planning (5 planners)
5. Test plan quality vs independent planners + synthesizer
6. Implement team variant for plan review (4 reviewers)
7. Add experimental flag gating in SKILL.md orchestration
8. Document team vs sub-agent tradeoffs in skill reference docs
