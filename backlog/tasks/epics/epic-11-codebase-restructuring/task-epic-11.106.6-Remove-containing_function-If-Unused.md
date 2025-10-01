# Task 11.106.6: Remove containing_function (Conditional)

**Status:** Not Started (Conditional on 11.106.5 decision)
**Priority:** High
**Estimated Effort:** 15 minutes
**Parent:** task-epic-11.106
**Dependencies:** task-epic-11.106.5 (decision: DELETE)

## Objective

**ONLY execute this task if task 11.106.5 determined containing_function is unused.**

Delete the `containing_function` field from `ReferenceContext` interface.

## Conditional Execution

**Execute if:** Task 11.106.5 decision = DELETE
**Skip if:** Task 11.106.5 decision = KEEP

## Changes Required

### 1. Update ReferenceContext Interface

**File:** `packages/types/src/semantic_index.ts`

**Before:**
```typescript
export interface ReferenceContext {
  readonly receiver_location?: Location;
  readonly assignment_source?: Location;
  readonly assignment_target?: Location;
  readonly construct_target?: Location;
  readonly containing_function?: SymbolId;  // ❌ DELETE THIS LINE
  readonly property_chain?: readonly SymbolName[];
}
```

**After:**
```typescript
export interface ReferenceContext {
  readonly receiver_location?: Location;
  readonly assignment_source?: Location;
  readonly assignment_target?: Location;
  readonly construct_target?: Location;
  readonly property_chain?: readonly SymbolName[];
}
```

## Verification Steps

1. **Confirm no references remain in production code:**
   ```bash
   rg "containing_function" --type ts -g "!*test.ts"
   ```
   Expected: 0 results

2. **TypeScript compilation:**
   ```bash
   cd packages/types && npx tsc --noEmit
   cd packages/core && npx tsc --noEmit
   ```
   Expected: 0 errors

3. **Run tests (may fail - will be fixed in 11.106.8):**
   ```bash
   npm test
   ```
   Expected: Tests may fail if they assert on `containing_function` - this is OK, task 11.106.8 will delete those assertions

## Success Criteria

- ✅ `containing_function` removed from interface
- ✅ No remaining references in codebase
- ✅ TypeScript compiles with 0 errors
- ✅ All tests pass

## If Task is Skipped

If task 11.106.5 decided to KEEP the field:

1. Skip this task entirely
2. Create follow-up task: "Implement containing_function via ScopeBuilder"
3. Document the use case in that task
4. Add to epic 11 backlog

## Notes

This task is intentionally small and simple because:
- It's just deleting one line from the interface
- Conditional execution based on audit results
- Low risk (field was never populated)

**Test assertions:** Any test assertions on `containing_function` will be removed in task 11.106.8. Do not fix failing tests in this task.
