# Task 11.106.2: Remove source_type Field

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 30 minutes
**Parent:** task-epic-11.106
**Dependencies:** task-epic-11.106.1 (audit complete)

## Objective

Delete `type_flow.source_type` field from the codebase. This field is always `undefined` because source type requires inter-procedural analysis that tree-sitter cannot provide.

## Changes Required

### 1. Update TypeScript Interface

**File:** `packages/types/src/semantic_index.ts`

**Before:**
```typescript
readonly type_flow?: {
  source_type?: TypeInfo;      // ❌ DELETE THIS LINE
  target_type?: TypeInfo;
  is_narrowing: boolean;
  is_widening: boolean;
}
```

**After:**
```typescript
readonly type_flow?: {
  target_type?: TypeInfo;
  is_narrowing: boolean;
  is_widening: boolean;
}
```

### 2. Remove Assignment Code

**File:** `packages/core/src/index_single_file/query_code_tree/reference_builder.ts`

Find and remove the line (around line 415):
```typescript
source_type: undefined, // Could be enhanced with extractors  // ❌ DELETE
```

The code should change from:
```typescript
const type_flow_info = {
  source_type: undefined,      // ❌ DELETE THIS LINE
  target_type: extract_type_info(capture, this.extractors, this.file_path),
  is_narrowing: false,
  is_widening: false,
};
```

To:
```typescript
const type_flow_info = {
  target_type: extract_type_info(capture, this.extractors, this.file_path),
  is_narrowing: false,
  is_widening: false,
};
```

## Verification Steps

1. **Search for remaining references in production code:**
   ```bash
   rg "source_type" --type ts -g "!*test.ts"
   ```
   Expected: 0 results (or only unrelated usages)

2. **TypeScript compilation:**
   ```bash
   cd packages/core && npx tsc --noEmit
   ```
   Expected: 0 errors

3. **Run tests (will fail if tests assert on this field):**
   ```bash
   npm test -w @ariadnejs/core
   ```
   Expected: Some tests MAY fail - this is OK, task 11.106.8 will fix them

   Note: If tests fail with errors about `source_type`, those test assertions will be removed in task 11.106.8.

## Success Criteria

- ✅ `source_type` removed from interface
- ✅ Assignment to `source_type` removed
- ✅ No remaining references to `source_type` in codebase
- ✅ TypeScript compiles with 0 errors
- ✅ All tests pass

## Rollback Plan

If issues arise:
```bash
git checkout packages/types/src/semantic_index.ts
git checkout packages/core/src/index_single_file/query_code_tree/reference_builder.ts
```

## Notes

This field was identified in the metadata extraction work as always being `undefined` because:
- Source type requires tracing the value back through assignments
- This is inter-procedural analysis (beyond AST scope)
- Would require a full type inference engine

The field was never populated with actual data, so removal is safe.

### Test Failures Expected

After this change, any tests that assert on `source_type` will fail. This is EXPECTED and CORRECT. Task 11.106.8 will update/remove those test assertions. Do not fix failing tests in this task - just remove the field from the interface and implementation.
