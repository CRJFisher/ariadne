# Task 11.169.8: Review test_utils.ts

## Status: To Do

## Parent: task-epic-11.169-Add-missing-test-files

## Overview

Review whether `test_utils.ts` should have its own tests or be excluded from test requirements.

## File in Question

- `packages/core/src/index_single_file/test_utils.ts`

## Considerations

1. **Test utilities are for tests** - These functions exist to support testing, not production code
2. **Circular dependency** - Testing test utilities may be awkward
3. **Exclusion option** - Consider adding `test_utils.ts` to `NO_TEST_REQUIRED` list

## Decision Criteria

- If the utilities are complex enough to warrant testing, add tests
- If they're simple helpers, exclude from test requirements

## Outcome Options

1. Add `test_utils.ts` to `NO_TEST_REQUIRED` in hook
2. Create `test_utils.test.ts` with basic coverage
3. Rename to `*.test_utils.ts` pattern for automatic exclusion
