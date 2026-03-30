---
id: TASK-200
title: "Fix TypeScript duplicate entries for interfaces, enums, and type aliases"
status: Done
assignee: []
created_date: "2026-03-29 20:13"
updated_date: "2026-03-29 20:42"
labels:
  - bug
  - indexer
  - typescript
dependencies: []
references:
  - packages/core/src/index_single_file/query_code_tree/queries/typescript.scm
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Problem

The TypeScript tree-sitter query file (`typescript.scm`) creates **duplicate index entries** for interfaces, enums, type aliases, and namespaces. Each definition gets two entries:

1. An **identifier entry** (e.g., `interface:test.ts:2:11:2:15:IUser`) with actual methods/properties
2. A **full-text entry** (e.g., `interface:test.ts:2:1:7:1:interface IUser { ... }`) with empty methods/properties

This does NOT happen for classes.

## Root Cause

The `.scm` query patterns use the same capture name on both the identifier and the entire declaration:

```scm
; Interface (lines 64-67)
(interface_declaration
  name: (type_identifier) @definition.interface
) @definition.interface

; Type alias (lines 87-90)
(type_alias_declaration
  name: (type_identifier) @definition.type_alias
) @definition.type_alias

; Enum (lines 92-95)
(enum_declaration
  name: (identifier) @definition.enum
) @definition.enum
```

Both captures produce entries with the same capture name, so the capture handler processes both as separate definitions.

## Fix

Remove the outer `@definition.X` capture from each pattern. Only the inner (identifier) capture should be kept, matching the class pattern which only captures the identifier.

## Files to modify

- `packages/core/src/index_single_file/query_code_tree/queries/typescript.scm` — Remove outer captures for interface, type_alias, enum, and namespace definitions

## Impact

- Doubles the size of interface/enum/type maps unnecessarily
- The full-text entries have empty methods/properties which can cause incorrect results if consumers pick the wrong entry
- Discovered in task-199.6 via type_preprocessing integration tests
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Each TS interface/enum/type_alias produces exactly ONE entry in its respective SemanticIndex map
- [x] #2 Existing tests continue to pass
- [x] #3 type_preprocessing tests updated to assert exact map sizes
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Fixed in task-199.6 worktree. Removed duplicate outer `@definition.X` captures from `typescript.scm` for: interface (line 67), type_alias (line 90), enum (line 95), namespace (line 111), type_parameter (line 116), and field (lines 149, 155, 166, 401). All 1427 index_single_file tests pass. type_preprocessing tests now assert exact index sizes to lock in the fix.

<!-- SECTION:FINAL_SUMMARY:END -->
