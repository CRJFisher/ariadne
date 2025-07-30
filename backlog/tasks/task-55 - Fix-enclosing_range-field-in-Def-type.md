---
id: task-55
title: Fix enclosing_range field in Def type
status: To Do
assignee: []
created_date: '2025-07-30'
labels: []
dependencies: []
---

## Description

The enclosing_range field in function definitions is currently undefined, but should contain the full range of the function body including braces. This prevents proper extraction of complete function implementations.

## Acceptance Criteria

- [ ] enclosing_range field is populated for function definitions
- [ ] enclosing_range includes the full function body from signature to closing brace
- [ ] Core tests pass with enclosing_range assertions
- [ ] MCP get_symbol_context can extract full function bodies
