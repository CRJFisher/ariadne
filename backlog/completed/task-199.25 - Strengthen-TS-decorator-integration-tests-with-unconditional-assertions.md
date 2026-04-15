---
id: TASK-199.25
title: Strengthen TS decorator integration tests with unconditional assertions
status: Done
assignee: []
created_date: "2026-04-01 15:10"
updated_date: "2026-04-15 21:38"
labels:
  - test-coverage
  - typescript
  - integration-test
dependencies: []
references:
  - >-
    packages/core/src/index_single_file/query_code_tree/symbol_factories/symbol_factories.typescript.ts
  - packages/core/src/index_single_file/index_single_file.typescript.test.ts
parent_task_id: TASK-199
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

The decorator tests in `index_single_file.typescript.test.ts` (lines 1206-1428) use conditional branches that silently pass when zero decorators are extracted:

```typescript
if (user_class.decorators.length > 0) { ... }
// else logs "Note: Class decorators not extracted - may need implementation"
```

With the `find_decorator_target` fix in TASK-199.19, decorators are now correctly attached. These conditional branches should be replaced with unconditional exact assertions (e.g., `expect(cls.decorators.length).toBe(1)`).

Applies to class decorator test (line 1206), method decorator test (line 1280), and property decorator test (line ~1350).

<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Replaced conditional decorator assertion branches with unconditional exact assertions in the class and property decorator integration tests.

- Class decorator test: removed `if (decorators.length > 0) / else console.log` guard and replaced with `expect(decorators.length).toBe(2)`, `expect(decorators[0].name).toBe("Entity")`, `expect(decorators[1].name).toBe("Sealed")`.
- Property decorator test: same treatment — `expect(decorators.length).toBe(2)`, `expect(decorators[0].name).toBe("Required")`, `expect(decorators[1].name).toBe("MinLength")`.

Order is source order (tree-sitter returns captures left-to-right; `add_decorator_to_target` appends with `push`). All 4 decorator tests pass.

<!-- SECTION:FINAL_SUMMARY:END -->
