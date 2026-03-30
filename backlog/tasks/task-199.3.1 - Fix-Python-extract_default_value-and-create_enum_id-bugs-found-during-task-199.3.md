---
id: TASK-199.3.1
title: >-
  Fix Python extract_default_value and create_enum_id bugs (found during
  task-199.3)
status: Done
assignee: []
created_date: "2026-03-29 17:53"
labels:
  - bug-fix
  - python
  - symbol-factories
  - testing
dependencies: []
parent_task_id: TASK-199.3
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Bugs Found During Integration Test Improvement (task-199.3)

### Bug 1: `extract_default_value` never extracted Python default parameter values

**File:** `symbol_factories.python.ts:465`
**Root cause:** Used `childForFieldName("default")` but Python tree-sitter grammar names the field `"value"` on `default_parameter` and `typed_default_parameter` nodes.
**Impact:** All Python parameter default values were silently returning `undefined`. This means `ParameterDefinition.default_value` was always empty for Python.
**Fix:** Navigate from the identifier node to its parent `default_parameter`/`typed_default_parameter`, then use `childForFieldName("value")`.
**Locked in by:** 4 new tests in `symbol_factories.python.test.ts` (extract_default_value describe block) that verify extraction from both `default_parameter` and `typed_default_parameter` nodes.

### Bug 2: `create_enum_id` manually formatted SymbolId instead of using `enum_symbol()` factory

**File:** `symbol_factories.python.ts:74`
**Root cause:** Code used template literal `\`enum:${file_path}:...\``instead of`enum_symbol(name, location)`like all other languages.
**Impact:** Same output format, but fragile — if`enum_symbol`format ever changes, Python would diverge.
**Fix:** Replaced manual formatting with`enum_symbol(name, location)`call.
**Locked in by:**`create_enum_id`behavioral test verifies the SymbolId starts with`enum:` and contains the enum name.

<!-- SECTION:DESCRIPTION:END -->
