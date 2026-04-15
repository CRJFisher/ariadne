---
id: TASK-199.23.3
title: >-
  Fix: @assignment.constructor capture asymmetry between typescript.scm and
  javascript.scm
status: Done
assignee: []
created_date: "2026-04-15 10:49"
updated_date: "2026-04-15 15:43"
labels:
  - bug
  - information-architecture
  - typescript
  - javascript
dependencies: []
references:
  - packages/core/src/index_single_file/query_code_tree/queries/typescript.scm
  - packages/core/src/index_single_file/query_code_tree/queries/javascript.scm
  - >-
    packages/core/src/index_single_file/query_code_tree/queries/CAPTURE-SCHEMA.md
parent_task_id: TASK-199.23
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`typescript.scm` lines 314–320 has an `@assignment.constructor` capture for `const x = new Foo()` that sets the capture entity to `"constructor"`. The equivalent pattern in `javascript.scm` uses `@reference.call` instead, giving it a different entity. Both produce the same `ReferenceKind.CONSTRUCTOR_CALL` via the reference builder, so there is no runtime difference today — but it creates inconsistency in the capture schema and makes cross-language reasoning harder.

Audit both files to determine the canonical pattern and align them. Update CAPTURE-SCHEMA.md if needed.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 typescript.scm and javascript.scm use the same capture entity for the constructor-with-assignment pattern
- [x] #2 CAPTURE-SCHEMA.md reflects the canonical pattern
- [x] #3 All tests pass
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Removed the invalid `@assignment.constructor` pattern from `typescript.scm` and the incorrect `@reference.call` fragment pattern from `javascript.scm`'s declarations section. Both files now rely on the general `@assignment.variable` pattern for assignment tracking and the REFERENCES section's `(new_expression constructor: (identifier) @reference.constructor) @reference.call` for constructor call captures. The `@assignment.constructor.qualified` pattern (for namespace-qualified constructors) is preserved in both files as it is valid per the schema. CAPTURE-SCHEMA.md required no update — it correctly omits `@assignment.constructor` already. All 2628 tests pass.

<!-- SECTION:FINAL_SUMMARY:END -->
