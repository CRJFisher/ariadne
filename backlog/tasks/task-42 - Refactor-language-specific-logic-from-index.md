---
id: task-42
title: Refactor language-specific logic from `index.ts`
status: To Do
assignee: []
created_date: '2025-07-18'
labels: []
dependencies: []
---

## Description

The `get_function_calls` and `get_source_code` methods in `index.ts` currently contain language-specific logic. This approach is not scalable and makes it difficult to add or maintain language support.

This task is to refactor this logic by moving the language-specific parts into the language configuration objects. New fields should be added to the language configuration to store the tree-sitter queries.

## Acceptance Criteria

- [ ] Produce an analysis document based on a review of language-specific logic in the codebase which isn't routed through the language configuration objects.
- [ ] A new field (e.g., `callQuery`) is added to the language configuration interface for call expressions.
- [ ] A new field is added for getting source code.
- [ ] The `get_function_calls` method is updated to use the query from the language configuration.
- [ ] The `get_source_code` method is updated to use the new logic from the language configuration.
- [ ] Language-specific conditional logic is removed from `get_function_calls` and `get_source_code`.
- [ ] Existing language configurations (TypeScript, Python, etc.) are updated with the new query fields.
- [ ] All existing tests continue to pass.
