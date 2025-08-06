---
id: task-epic-9-test-maintenance.1
title: Split oversized call_graph.test.ts file
status: To Do
assignee: []
created_date: '2025-08-06 12:01'
labels: []
dependencies: []
parent_task_id: task-epic-9-test-maintenance
---

## Description

The call_graph.test.ts file is 51KB, exceeding the 32KB tree-sitter limit. Split it into logical modules for better organization and to stay within limits.

## Acceptance Criteria

- [ ] Original test file split into 2-3 logical modules
- [ ] Each resulting file under 32KB
- [ ] All tests still pass
- [ ] Clear naming for each module (e.g. call_graph_resolution.test.ts call_graph_api.test.ts)
- [ ] Apply testing-standards.md after split
