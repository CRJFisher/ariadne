---
id: TASK-202
title: >-
  Investigate TypeScript enum member capture — members not attached via full
  pipeline
status: To Do
assignee: []
created_date: '2026-03-28 22:59'
labels:
  - bug
  - typescript
  - capture-handlers
dependencies: []
references:
  - >-
    packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.typescript.ts
  - packages/core/src/index_single_file/query_code_tree/queries/typescript.scm
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When running `build_index_single_file` on TypeScript enum code like `enum Direction { Up = "UP", Down = "DOWN" }`, the resulting `EnumDefinition.members` array is empty (length 0).

The handler `handle_definition_enum_member` exists and is registered at key `definition.enum.member`. It calls `find_containing_enum(capture)` to traverse the AST parent chain and produce a matching `SymbolId`. If `find_containing_enum` returns `undefined`, the handler silently returns without adding the member.

**Likely root cause:** Either the tree-sitter query for `@definition.enum_member` doesn't match the expected AST node type, or `find_containing_enum` produces a `SymbolId` that doesn't match the one registered by `handle_definition_enum` (similar to the `@property` decorator mismatch in TASK-201).

**Found during:** Task 199.1 test improvements — adding enum member assertions to the TypeScript integration test revealed 0 members.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 EnumDefinition.members is populated for TypeScript enums through the full pipeline
- [ ] #2 Integration test asserts enum member names and values
<!-- AC:END -->
