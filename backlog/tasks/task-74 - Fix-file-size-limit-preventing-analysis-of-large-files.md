---
id: task-74
title: Fix file size limit preventing analysis of large files
status: To Do
assignee: []
created_date: '2025-08-03'
labels: []
dependencies: []
---

## Description

The 32KB file size limit in validate-ariadne.ts prevents analysis of critical files like project_call_graph.ts (57KB), causing false top-level node identification. Need to increase limit or implement file chunking.

## Acceptance Criteria

- [ ] File size limit increased or chunking implemented
- [ ] Large files like project_call_graph.ts are analyzed
- [ ] Top-level node identification accuracy improved
