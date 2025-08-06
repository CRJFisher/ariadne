---
id: task-100.31
title: Fix large file handling - files over 32KB fail to parse
status: To Do
assignee: []
created_date: '2025-08-05 22:38'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

Files larger than 32KB are failing to parse with 'Invalid argument' error from tree-sitter. The FileManager is not handling large files properly and needs to either split them or handle the error gracefully.

## Acceptance Criteria

- [ ] Files larger than 32KB can be parsed successfully
- [ ] Large file tests pass
- [ ] Tree-sitter limit warnings are shown when appropriate
