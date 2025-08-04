---
id: task-100.12.2
title: Extract file management logic from Project class
status: To Do
assignee: []
created_date: '2025-08-04 22:40'
labels: []
dependencies: []
parent_task_id: task-100.12
---

## Description

Move all file-related operations (add_or_update_file, parse logic, file_graphs, file_cache) into a separate FileManager module to reduce the size of index.ts.

## Acceptance Criteria

- [ ] FileManager class created
- [ ] File parsing logic moved
- [ ] File caching logic moved
- [ ] Tree-sitter parser management moved
- [ ] Project class delegates to FileManager
