---
id: task-74
title: Fix file size limit preventing analysis of large files
status: Blocked
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

## Implementation Notes

**BLOCKED**: Waiting for response in issue from tree-sitter-node project regarding 32KB limit.

The file size limit is imposed by the tree-sitter parser, not our code. This requires either:
1. A fix/workaround from the tree-sitter-node project
2. Implementing our own chunking solution to parse files in segments
3. Using an alternative parsing approach for large files
