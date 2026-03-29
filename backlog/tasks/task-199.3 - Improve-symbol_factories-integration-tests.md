---
id: TASK-199.3
title: Improve symbol_factories integration tests
status: To Do
assignee: []
created_date: "2026-03-27 23:14"
updated_date: "2026-03-27 23:18"
labels:
  - testing
  - symbol-factories
dependencies: []
parent_task_id: TASK-199
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Findings

Across all 4 languages, symbol_factories test files are dominated by `typeof` export-existence smoke tests. ~80% of exported functions lack behavioral tests.

### TypeScript (50 tests: 24 smoke, 26 behavioral)

- 6 of 31 functions have behavioral tests
- **25 functions lack behavioral tests**: 13 not even imported
- Key gaps: `find_containing_class/interface/enum`, `find_decorator_target`, `detect_callback_context`, `is_parameter_in_function_type`, all `create_*_id` functions, all type extraction functions, all modifier boolean functions

### JavaScript (38 tests: 17 smoke, 21 behavioral)

- Key gaps: `find_function_scope_at_location` (complex proximity matching), `find_containing_class`, `detect_callback_context`, `extract_original_name`, documentation state triad (`store/consume/reset_documentation`)
- All `create_*_id` functions (7) lack behavioral tests

### Python (62 tests: 25 smoke, 37 behavioral)

- 7 of 35 functions have behavioral tests (20%)
- Key gaps: all `create_*_id` (10), container finders (3), type extraction (5), value extraction (3), `is_async_function`, `determine_method_type`, import extraction, docstring management (4 functions)
- Notable: `create_enum_id` manually formats SymbolId string instead of using `enum_symbol` factory — inconsistency risk

### Rust (35 tests: 26 smoke, 9 behavioral)

- 4 of 34 functions have behavioral tests
- Key gaps: all `create_*_id` (11), all type extraction (6), `is_self_parameter`, `find_containing_impl/struct/trait`, `extract_enum_variants`, `is_associated_function`, all documentation state (3), all import extraction (2), callback detection

### Collection (22 tests, cross-language)

- Well-covered for basic patterns. Gaps: `new Map()/Set()` constructors (JS/TS), `stored_functions` for anonymous functions/closures/lambdas, JS/TS `extract_collection_source`, negative/null-return cases

## Actions

1. Convert smoke-only tests to behavioral tests (parse real code, invoke function, verify output)
2. Prioritize: container finders, `detect_callback_context`, documentation state, import extraction
3. All tests should remain inline (appropriate for AST-level tests)
4. Fix production bugs discovered while improving tests: if straightforward, spin up an opus sub-agent to fix the bug. Then ensure the test assertions lock in the corrected behaviour — the test must fail if the fix is reverted. Only create a backlog task if the fix is complex and requires user decisions.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## Weak Assertion Remediation

This is the worst offender for weak assertions. The majority of symbol_factories tests across all languages are `typeof === "function"` smoke checks that verify nothing about behavior.

**All existing smoke-only tests must be converted to behavioral tests with exact value assertions:**

- `expect(typeof create_class_id).toBe("function")` → parse real code, call `create_class_id(captureNode)`, verify returned `SymbolId` matches expected format
- `expect(typeof extract_return_type).toBe("function")` → parse real code, call function, verify exact return type string
- Container finders: verify exact `SymbolId` or `SymbolName` returned, not just `toBeDefined()`
- Documentation state: verify exact stored/consumed docstring text
<!-- SECTION:NOTES:END -->
