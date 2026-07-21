# Task 11.162.1: Fix body_scope_id Assignment in find_body_scope_for_definition

## Status: Completed

## Parent: task-epic-11.162

## Overview

The `find_body_scope_for_definition` function uses same-line proximity matching with exact name matching to ensure each function gets a unique `body_scope_id`.

## Problem Addressed

Multiple functions were incorrectly assigned the same `body_scope_id`, causing their enclosed calls to be incorrectly attributed.

### Evidence from Diagnostic Testing

```text
Functions with body_scope_id:
  inner (line 16): body_scope_id = function:...16:17:16:30
  with_reduce (line 20): body_scope_id = function:...16:17:16:30  ← SAME AS inner!
  <anonymous> (line 21): body_scope_id = function:...16:17:16:30  ← SAME AS inner!
```

Three different functions at different lines shared the same `body_scope_id`.

## Solution

The `find_body_scope_for_definition` function uses a 3-strategy approach:

### Strategy 1: Same-Line + Exact Name Match

The scope must start on the **same line** as the definition ends, with exact name matching:

- For named functions: `scope.name === def_name`
- For anonymous functions: Both definition and scope must be anonymous

### Strategy 2: Multi-Line Signature Fallback

For functions with multi-line signatures, allow scope to start within 5 lines of the definition end, still requiring exact name matching.

### Strategy 3: Location-Only Fallback

For edge cases where name extraction differs (e.g., tree-sitter captures differently), allow matching within 2 lines if at least one side is anonymous.

### Key Constraints

1. Scope must start **on or after** the line where the definition ends (no negative distance)
2. Scope must start **after** the column where the definition ends (positive column distance)
3. Named definitions require exact name match (no fuzzy matching)

## Files Modified

| File | Changes |
|------|---------|
| [scopes.utils.ts](packages/core/src/index_single_file/scopes/scopes.utils.ts) | Replaced permissive distance matching with same-line proximity matching |
| [scopes.utils.test.ts](packages/core/src/index_single_file/scopes/scopes.utils.test.ts) | Added 5 new test cases for stricter matching behavior |
| [definitions.ts](packages/core/src/index_single_file/definitions/definitions.ts) | Added try-catch and abstract method handling in `add_method_to_class` |

## Test Cases Added

1. `should NOT share body_scope_id between functions at different lines` - Core bug scenario
2. `should match by same-line proximity, not just distance` - Prevents scope-before-definition matches
3. `should require exact name match for named functions` - No fuzzy matching
4. `should handle multi-line function signatures` - Strategy 2 coverage
5. `should match anonymous definitions only with anonymous scopes` - Anonymous handling

## Validation

All 1577 tests pass across the full test suite:

- 54 test files passed
- No regressions detected
- E2E tests pass with 1512 entry points found
