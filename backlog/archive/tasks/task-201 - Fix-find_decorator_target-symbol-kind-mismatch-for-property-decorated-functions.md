---
id: TASK-201
title: >-
  Fix find_decorator_target symbol kind mismatch for @property-decorated
  functions
status: To Do
assignee: []
created_date: "2026-03-28 22:50"
labels:
  - bug
  - python
  - symbol-factories
dependencies: []
references:
  - >-
    packages/core/src/index_single_file/query_code_tree/symbol_factories/symbol_factories.python.ts
  - packages/core/src/index_single_file/definitions/definitions.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`find_decorator_target` in `symbol_factories.python.ts` sees a `function_definition` inside a class's `decorated_definition` and produces a `method_symbol` SymbolId. But `handle_definition_property` registers the definition with `property_symbol`. The SymbolId kind mismatch (`method:...` vs `property:...`) means `add_decorator_to_target` can never find the property in its lookup, so the `@property` decorator is silently lost.

This affects all Python `@property` decorated methods — the decorator is resolved but never attached to the property definition.

**Root cause:** `find_decorator_target` assumes all `function_definition` nodes inside classes are methods, but Python properties are registered as properties, not methods.

**Fix:** `find_decorator_target` should check whether the decorated definition's name matches a registered property (via `builder.find_property_by_name` or similar), and if so, return a `property_symbol` instead of a `method_symbol`.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 @property decorator is attached to the property definition in the semantic index
- [ ] #2 find_decorator_target returns property_symbol for @property-decorated functions in classes
- [ ] #3 Test: decorator.property test asserts cls.properties[0].decorators[0].name === 'property'
<!-- AC:END -->
