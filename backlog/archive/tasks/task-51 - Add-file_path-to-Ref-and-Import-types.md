---
id: task-51
title: Add file_path to Ref and Import types
status: To Do
assignee: []
created_date: '2025-07-29'
labels: []
dependencies: []
---

## Description

The Ref and Import types in @ariadnejs/types currently don't include file path information, which limits cross-file reference tracking. Add file_path property to these types to enable proper cross-file reference and import resolution.

## Acceptance Criteria

- [ ] Add file_path property to Ref interface in types package
- [ ] Add file_path property to Import interface in types package
- [ ] Update scope_resolution to populate file_path when creating Ref nodes
- [ ] Update scope_resolution to populate file_path when creating Import nodes
- [ ] Update all language implementations to pass file_path
- [ ] Update tests to verify file_path is populated
- [ ] Update MCP server to use actual file paths for references
