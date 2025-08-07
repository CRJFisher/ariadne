---
id: task-epic-9-test-maintenance.2
title: Split oversized javascript.test.ts file
status: To Do
assignee: []
created_date: '2025-08-06 12:01'
labels: []
dependencies: []
parent_task_id: task-epic-9-test-maintenance
---

## Description

The tests/languages/javascript.test.ts file is 41KB, exceeding the 32KB tree-sitter limit. Split it into feature-based modules.

## Acceptance Criteria

- [ ] Original test file split into feature groups (parsing
- [ ] scoping
- [ ] edge cases)
- [ ] Each resulting file under 32KB
- [ ] All tests still pass
- [ ] Clear naming (e.g.
- [ ] javascript_parsing.test.ts
- [ ] javascript_scope.test.ts)
- [ ] Apply testing-standards.md after split
