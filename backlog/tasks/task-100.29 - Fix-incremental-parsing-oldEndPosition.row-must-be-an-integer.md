---
id: task-100.29
title: Fix incremental parsing - oldEndPosition.row must be an integer
status: To Do
assignee: []
created_date: '2025-08-05 22:38'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

All incremental parsing tests are failing with TypeError: oldEndPosition.row must be an integer. The position objects in FileManager.parseFile are not properly structured for tree-sitter's edit() method.

## Acceptance Criteria

- [ ] All 7 incremental parsing tests pass
- [ ] update_file_range works correctly
- [ ] Tree-sitter incremental parsing is functional
