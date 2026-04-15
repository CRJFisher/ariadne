---
id: TASK-199.19
title: "Fix: JS class extends extraction + TS class decorator attachment"
status: Done
assignee: []
created_date: "2026-03-30 14:00"
labels:
  - bugfix
  - type-preprocessing
  - javascript
  - typescript
dependencies: []
references:
  - packages/core/src/index_single_file/type_preprocessing/
  - packages/core/src/index_single_file/query_code_tree/capture_handlers/
  - packages/core/src/index_single_file/query_code_tree/queries/javascript.scm
parent_task_id: TASK-199
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Two related class-level extraction gaps found during the task-199 epic:

### JS class `extends` not captured

JavaScript classes with `extends` (e.g., `class Dog extends Animal`) produce empty `extends` arrays. The type preprocessing member extraction does not capture the superclass for JS. This affects cross-class call graph traversal — inherited method calls cannot be resolved.

Found in tasks 199.6 and 199.6.1. The test at `member.test.ts` line 191-192 documents this: `expect(dog.extends).toEqual([])`.

### TS class decorator attachment

`find_decorator_target` walks `capture.node.parent` upward to find the class declaration, but may not reach `class_declaration` depending on AST structure. The test in `capture_handlers.javascript.test.ts` (line 495-497) verifies the class is registered but does not verify the decorator was actually attached.

Found in task 199.1.

### Actions

1. Fix JS `extends` extraction: identify why the superclass name isn't captured (likely missing `.scm` query or extraction logic)
2. Add exact assertion for `extends` in the JS member test
3. Investigate the TS decorator attachment — determine if `find_decorator_target` reliably reaches class declarations
4. Fix the parent walk if needed, add a test that verifies the decorator is attached (not just that the class exists)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

### JS class `extends` fix

**Root cause:** `handle_definition_class` in `capture_handlers.javascript.ts` called `extract_extends(capture.node)` where `capture.node` is the class name identifier (e.g., "Dog"). The `extract_extends` function expects the `class_declaration` node to find `class_heritage` children.

**Fix:** Changed to `extract_extends(capture.node.parent)` — the parent of the captured identifier is the `class_declaration` node which contains the `class_heritage` child with the superclass name.

**Files changed:**

- `capture_handlers.javascript.ts:62-82` — pass `capture.node.parent` instead of `capture.node`
- `member.test.ts:191-192` — assertion updated from `expect(dog.extends).toEqual([])` to `expect(dog.extends).toEqual(["Animal"])`

### TS class decorator attachment fix

**Root cause:** `find_decorator_target` in `symbol_factories.typescript.ts` checked `capture.node.parent` against `class_declaration`, but `capture.node` is the identifier inside the decorator (e.g., "Component"). Its parent is the `decorator` node, not the `class_declaration`.

**Fix:** Walk up from `capture.node` to the `decorator` node first, then check `decorator.parent`:

- `class_declaration` / `abstract_class_declaration` → class decorator (Case 1)
- `class_body` → method decorator, find next non-decorator sibling (Case 2)
- `public_field_definition` → property decorator (Case 3)

This also correctly handles parameterized decorators like `@Component({})` where `capture.node.parent` is `call_expression` (inside the decorator).

**Files changed:**

- `symbol_factories.typescript.ts:720-790` — rewritten `find_decorator_target` with decorator-first walk
- `capture_handlers.typescript.test.ts:490-502` — decorator test now asserts `cls.decorators.length === 1` and `cls.decorators[0].name === "Component"`
