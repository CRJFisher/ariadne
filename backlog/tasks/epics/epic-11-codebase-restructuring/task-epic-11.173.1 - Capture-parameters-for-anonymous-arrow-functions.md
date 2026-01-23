---
id: task-epic-11.173.1
title: Capture parameters for anonymous arrow functions
status: Completed
assignee: []
created_date: '2026-01-21 13:07'
labels:
  - epic-11
dependencies: []
parent_task_id: task-epic-11.173
---

## Description

Anonymous arrow functions passed as callbacks (e.g., to .reduce(), .map()) don't have their parameters captured. This breaks method resolution for calls inside the callback body. Root cause: handle_definition_anonymous_function in capture_handlers.javascript.ts doesn't extract parameters.

## Implementation Notes

**Root Cause Identified**: SymbolId mismatch between:

1. Definition handler: `anonymous_function_symbol(location)` → `"function:path:loc:<anonymous>"`
2. Parameter lookup: `function_symbol("anonymous", location)` → `"function:path:loc:anonymous"`

The difference in the name (`<anonymous>` vs `anonymous`) caused parameters to be orphaned.

**Fix Applied**: Changed `find_containing_callable()` in all 4 language-specific symbol factory files to use `anonymous_function_symbol()` for anonymous functions:

- `symbol_factories.javascript.ts` - Arrow functions and function expressions
- `symbol_factories.typescript.ts` - Arrow functions and function expressions
- `symbol_factories.python.ts` - Lambda functions
- `symbol_factories.rust.ts` - Closure expressions

**Tests Added**: 6 new tests verifying `find_containing_callable` returns matching SymbolIds for parameters inside anonymous functions across TypeScript, Python, and Rust.

**Verification**: All 1671 tests pass with no regressions.
