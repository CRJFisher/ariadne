---
id: TASK-202
title: Fix JavaScript class extends not captured
status: To Do
assignee: []
created_date: "2026-03-29 20:13"
labels:
  - bug
  - indexer
  - javascript
dependencies: []
references:
  - packages/core/src/index_single_file/query_code_tree/queries/javascript.scm
  - packages/core/src/index_single_file/query_code_tree/queries/typescript.scm
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Problem

JavaScript class inheritance info (`extends Animal`) is not captured by the indexer. `ClassDefinition.extends` is always `[]` for JavaScript classes. TypeScript and Python capture extends correctly.

```javascript
class Dog extends Animal {
  // extends: [] — should be ["Animal"]
  bark() {}
}
```

## Root Cause

The JavaScript tree-sitter query (`javascript.scm` lines 135-141) expects `class_heritage` to contain a direct `identifier` child:

```scm
(class_declaration
  name: (identifier) @definition.class
  (class_heritage
    (identifier) @reference.type_reference
  )?
)
```

But the JavaScript tree-sitter grammar actually produces `(class_heritage (extends_clause (identifier)))`. The TypeScript query correctly handles this by matching within `extends_clause`.

## Fix

Update the JavaScript `.scm` query to match the actual grammar structure, adding `extends_clause` wrapping. Compare with the TypeScript query pattern (lines 333-343) which works correctly.

## Files to modify

- `packages/core/src/index_single_file/query_code_tree/queries/javascript.scm` — Fix class_heritage pattern to include extends_clause

## Impact

- JavaScript class inheritance is invisible to call graph analysis and method resolution
- Discovered in task-199.6 via type_preprocessing integration tests
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 ClassDefinition.extends contains parent class names for JS classes with extends
- [ ] #2 extract_type_members returns correct extends array for JS classes
- [ ] #3 Existing tests continue to pass
<!-- AC:END -->
