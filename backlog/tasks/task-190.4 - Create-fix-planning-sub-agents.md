---
id: task-190.4
title: Create fix planning sub-agents
status: Done
assignee: []
created_date: '2026-02-17 16:57'
updated_date: '2026-02-18 10:23'
labels: []
dependencies:
  - task-190.1
parent_task_id: task-190
---

## Description

Create the four fix-planning-phase custom sub-agents. For each false positive issue group: fix-planner agents investigate Ariadne core code and propose concrete fix plans, plan-synthesizer combines 5 competing plans into the best overall approach, plan-reviewer reviews the synthesis from specific angles (info-arch, simplicity, fundamentality, lang-coverage), and task-writer creates a backlog task incorporating all reviews. Sub-agents write output to files on disk (not returned to top-level), keeping context clean.

**Original plan file**: `~/.claude/plans/zazzy-brewing-gem.md`

### Agent Definitions

#### fix-planner

```yaml
---
name: fix-planner
description: Proposes a fix plan for a specific false positive issue group. Reads Ariadne core code to understand the detection gap and designs a concrete fix. Writes plan to a file.
model: sonnet
tools: Read, Grep, Glob, Write
mcpServers:
  - ariadne
maxTurns: 20
---
```

**Instructions**: Receives a group_id, root_cause description, and list of affected entries. Investigates the Ariadne core code to understand exactly where the detection fails. Proposes a concrete fix plan including: which files to modify, what logic to add/change, regression test cases, and expected impact on false positive count. Writes the plan to the specified output file path.

#### plan-synthesizer

```yaml
---
name: plan-synthesizer
description: Reads 5 competing fix plans for an issue group and synthesizes the best overall plan, combining the strongest elements from each.
model: opus
tools: Read, Write
maxTurns: 10
---
```

**Instructions**: Reads all 5 plans from the specified directory. Evaluates each plan on: correctness, simplicity, scope of fix (does it fix the root cause or just symptoms?), test coverage, and impact on other code. Synthesizes a single best plan that combines the strongest elements. Writes to the specified output file.

#### plan-reviewer

```yaml
---
name: plan-reviewer
description: Reviews a synthesized fix plan from a specific angle (info-architecture, simplicity, fundamentality, or language-coverage). Writes review to a file.
model: sonnet
tools: Read, Grep, Glob, Write
maxTurns: 15
---
```

**Instructions**: Receives the synthesis plan path and a review angle:

- **info-architecture**: Do the changes fit with naming conventions, folder structure, module organization?
- **simplicity**: Could the implementation be simpler? Better function delegation or intermediary data models?
- **fundamentality**: Does the fix address the root cause in the most fundamental way?
- **language-coverage**: If language-specific, does it cover all relevant languages with tests/fixtures?

Writes review (suggestions, concerns, approval) to the specified output file.

#### task-writer

```yaml
---
name: task-writer
description: Creates a backlog task file from a synthesized plan and its reviews. Incorporates reviewer feedback into the final task document.
model: sonnet
tools: Read, Write, Bash(backlog:*)
maxTurns: 10
---
```

**Instructions**: Reads the synthesis plan and all 4 reviews. Incorporates review feedback (addressing concerns, integrating suggestions). Creates a properly formatted backlog task file using the `backlog` CLI. The task includes: title, description, acceptance criteria, implementation plan, and review notes.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 fix-planner agent: sonnet model, Read/Grep/Glob/Write tools, ariadne MCP server, 20 max turns
- [x] #2 plan-synthesizer agent: opus model, Read/Write tools, 10 max turns
- [x] #3 plan-reviewer agent: sonnet model, Read/Grep/Glob/Write tools, ariadne MCP server, 15 max turns
- [x] #4 task-writer agent: sonnet model, Read/Write/Bash tools, 10 max turns (Bash scoping to `backlog` CLI enforced via instructions, not frontmatter)
- [x] #5 Fix-planner writes plans to triage_state/fix_plans/{group_id}/plan_{n}.md
- [x] #6 Plan-synthesizer reads all 5 plans and writes synthesis to fix_plans/{group_id}/synthesis.md
- [x] #7 Plan-reviewer writes reviews to fix_plans/{group_id}/review_{angle}.md
- [x] #8 Task-writer creates backlog task using backlog CLI
- [x] #9 Template: backlog_task_template.md for task-writer output format
<!-- AC:END -->


## Implementation Plan

1. Create .claude/agents/fix-planner.md — investigates core code, proposes fix plan, writes to file
2. Create .claude/agents/plan-synthesizer.md — reads 5 plans, evaluates on correctness/simplicity/scope/tests/impact, synthesizes best plan
3. Create .claude/agents/plan-reviewer.md — reviews from one of 4 angles, writes review to file
4. Create .claude/agents/task-writer.md — reads synthesis + 4 reviews, creates backlog task
5. Create .claude/skills/self-repair-pipeline/templates/backlog_task_template.md


## Implementation Notes

- Created 4 agent definitions: `fix-planner.md`, `plan-synthesizer.md`, `plan-reviewer.md`, `task-writer.md`
- Created 1 template: `backlog_task_template.md` for task-writer output format
- `plan-reviewer.md` includes `mcpServers: [ariadne]` so reviewers can ground feedback in actual code (AC#3 updated to reflect this)
- Claude Code agent frontmatter does not support tool-scoping syntax (e.g., `Bash(backlog:*)`). `task-writer.md` uses `tools: Read, Write, Bash` with a constraint in instructions: "Only use Bash for `backlog` CLI commands" (AC#4 updated)
