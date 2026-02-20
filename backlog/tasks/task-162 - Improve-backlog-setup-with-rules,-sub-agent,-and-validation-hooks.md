---
id: task-162
title: 'Improve backlog setup with rules, sub-agent, and validation hooks'
status: Done
assignee: []
created_date: '2026-01-12 15:55'
updated_date: '2026-01-12 17:30'
labels: []
dependencies: []
priority: medium
---

## Description

Improve the backlog infrastructure in this project with three key enhancements:
## Goals

1. **Backlog Rules Folder**: Create a `.claude/rules/backlog/` folder containing documentation about backlog conventions, file naming patterns, task structure requirements, and workflow guidelines.

2. **Backlog Sub-Agent**: Create a `.claude/agents/backlog-navigator.md` sub-agent that:
   - Researches the latest incomplete tasks
   - Finds recently completed tasks
   - Identifies the most likely next task candidates based on dependencies, priorities, and completion patterns
   - Helps users navigate and prioritize the backlog effectively

3. **Validation Hook Script**: Create a hook script in `.claude/hooks/` that validates:
   - Task file naming conventions (e.g., `task-*.md` pattern)
   - Internal markdown structure requirements (required sections, formatting)
   - Task metadata consistency

4. **Fix Existing Backlog Tasks**: Apply the new naming and formatting conventions to all existing backlog task files:
   - Rename files to follow consistent naming conventions
   - Update internal structure to match required markdown format
   - Ensure metadata consistency across all tasks

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Backlog rules folder exists at `.claude/rules/backlog/` with comprehensive documentation
- [x] #2 Backlog sub-agent is functional and can be invoked to suggest next tasks
- [x] #3 Hook script validates backlog markdown files on creation/modification
- [x] #4 All components are documented in the agent/rules files themselves
- [x] #5 All existing backlog tasks conform to the new naming and formatting standards
<!-- AC:END -->


## Implementation Plan

1. Research Backlog.md documentation from GitHub repo
2. Create `.claude/rules/backlog/` folder with:
   - `task-structure.md` - Task anatomy and conventions
   - `workflow.md` - Workflow and Definition of Done
   - `cli-commands.md` - CLI command reference
3. Create `.claude/agents/backlog-navigator.md` sub-agent
4. Create `.claude/hooks/backlog_validator.cjs` validation hook
5. Register hook in `.claude/settings.json`
6. Audit existing backlog tasks for naming/formatting issues
7. Fix existing tasks (may require sub-task for scope)


## Implementation Notes

### Completed Infrastructure (Goals 1-3)

Created the following files:

- `.claude/rules/backlog/task-structure.md` - Task hierarchy, anatomy, section guidelines
- `.claude/rules/backlog/workflow.md` - Standard workflow, Definition of Done
- `.claude/rules/backlog/cli-commands.md` - CLI command reference
- `.claude/agents/backlog-navigator.md` - Backlog research sub-agent
- `.claude/hooks/backlog_validator.cjs` - Validation hook for task files

Updated `.claude/settings.json` to register the new hook.

### Existing Task Naming Issues Identified

**Non-task files in tasks folder:**

- `ANALYSIS-*.md` files (should be in docs)
- `order.md`, progress reports, summaries

**Missing " - " separator (using hyphen instead):**

- `task-151-Advanced-Rust-semantic-features.md`
- `task-153-Evaluate-TSX-and-TypeScript-grammar-separation.md`
- `task-155-type-flow-inference-through-builtins.md`
- `task-160-implement-multi-layer-caching-system.md`
- `task-161-performance-optimization-investigation.md`
- Many sub-task files (task-155.x, task-160.x, task-161.x)

**Non-numeric IDs:**

- `task-enhance-file-tracker-pattern-matching.md`

**Epic folder contamination:**

- `backlog/tasks/epics/epic-11-*/` contains many analysis/summary files that aren't tasks

**Recommendation:** Create sub-task 162.1 to systematically fix existing task naming
