---
id: task-100.6
title: Add file size linting to prevent validation failures
status: To Do
assignee: []
created_date: '2025-08-04 12:03'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

Create a proactive file size check to ensure source files stay under the 32KB tree-sitter limit. This prevents validation failures and maintains codebase analyzability.

The script should:

- Check all TypeScript/JavaScript files
- Warn at 28KB (approaching limit)
- Error at 32KB (exceeds limit)
- Run in CI and validate-ariadne
- Automatically run before any commit
  - Is there a a way to do this with git hooks?
  - Or, is there a way to do this deterministically with claude code?
- Suggest refactoring for large files

Currently only project_call_graph.ts (60KB) exceeds the limit.

## Acceptance Criteria

- [ ] File size check implemented
- [ ] Integrated into CI workflow
- [ ] Added to validate-ariadne script
- [ ] Clear warning/error thresholds
- [ ] Refactoring guidance provided
