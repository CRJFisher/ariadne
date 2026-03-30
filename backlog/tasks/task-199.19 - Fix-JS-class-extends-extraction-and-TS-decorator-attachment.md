---
id: TASK-199.19
title: "Fix: JS class extends extraction + TS class decorator attachment"
status: To Do
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
