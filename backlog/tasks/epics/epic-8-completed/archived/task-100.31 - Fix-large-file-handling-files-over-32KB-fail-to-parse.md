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

- [x] Files larger than 32KB can be parsed successfully
- [x] Large file tests pass
- [x] Tree-sitter limit warnings are shown when appropriate

## Implementation Notes

Fixed the issue where Project.add_or_update_file was throwing an error when FileManager.processFile returned null for large files. Now:

1. Large files (>32KB) are stored in the file cache but not parsed
2. A warning is logged explaining the file exceeds tree-sitter limits
3. The file content is still accessible, just without AST/scope graph
4. Methods like get_functions_in_file return empty arrays for unparsed files

This allows projects with large files to still function, just without analysis for those specific files.
