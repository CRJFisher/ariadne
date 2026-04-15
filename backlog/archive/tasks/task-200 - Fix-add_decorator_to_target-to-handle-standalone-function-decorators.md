---
id: TASK-200
title: Fix add_decorator_to_target to handle standalone function decorators
status: To Do
assignee: []
created_date: "2026-03-28 22:49"
labels:
  - bug
  - python
  - definitions
dependencies: []
references:
  - packages/core/src/index_single_file/definitions/definitions.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`add_decorator_to_target` in `definitions.ts` only checks classes, class methods, class properties, and interface methods. If `find_decorator_target` resolves to a function SymbolId (e.g., `@app.route` on a top-level Python function, or `@pytest.mark.parametrize`), the decorator is silently dropped — the method falls through to `return this` without attaching anything.

This means function decorators like Flask routes, pytest markers, and similar patterns are lost from the semantic index.

**Root cause:** `add_decorator_to_target` checks `this.classes`, `this.class_methods`, `this.class_properties`, and `this.interface_methods` but never checks `this.functions`.

**Fix:** Add a `this.functions.get(target_id)` check in `add_decorator_to_target` that pushes the decorator to the function's decorator array. The `FunctionBuilderState` already has a `decorators` array (used by `build_function`), so the plumbing exists — it's just not wired up.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 add_decorator_to_target checks this.functions and attaches decorators to standalone functions
- [ ] #2 Python @decorator on top-level functions appears in the semantic index
- [ ] #3 Test: decorator.function test asserts func.decorators[0].name
<!-- AC:END -->
