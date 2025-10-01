# Task 11.106.3: Remove is_narrowing and is_widening Flags

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 30 minutes
**Parent:** task-epic-11.106
**Dependencies:** task-epic-11.106.2 (source_type removed)

## Objective

Delete `type_flow.is_narrowing` and `type_flow.is_widening` boolean flags. These are always `false` because determining narrowing/widening requires type system analysis beyond tree-sitter capabilities.

## Background

Type narrowing/widening detection requires:
- Understanding subtype relationships
- Tracking control flow (if/else branches)
- Type inference across statements
- Language-specific type system rules

This is beyond the scope of AST-based metadata extraction.

## Changes Required

### 1. Update TypeScript Interface

**File:** `packages/types/src/semantic_index.ts`

**Before:**
```typescript
readonly type_flow?: {
  target_type?: TypeInfo;
  is_narrowing: boolean;      // ❌ DELETE THIS LINE
  is_widening: boolean;       // ❌ DELETE THIS LINE
}
```

**After:**
```typescript
readonly type_flow?: {
  target_type?: TypeInfo;
}
```

### 2. Remove Assignment Code

**File:** `packages/core/src/index_single_file/query_code_tree/reference_builder.ts`

Find and remove lines (around line 417-418):
```typescript
const type_flow_info = {
  target_type: extract_type_info(capture, this.extractors, this.file_path),
  is_narrowing: false,        // ❌ DELETE THIS LINE
  is_widening: false,         // ❌ DELETE THIS LINE
};
```

**After:**
```typescript
const type_flow_info = {
  target_type: extract_type_info(capture, this.extractors, this.file_path),
};
```

## Impact Analysis

After this change, `type_flow` will only contain:
- `target_type?: TypeInfo` (the only field that's actually populated)

This sets up task 11.106.4 to simplify `type_flow` to a single `assignment_type` field.

## Verification Steps

1. **Search for remaining references in production code:**
   ```bash
   rg "is_narrowing" --type ts -g "!*test.ts"
   rg "is_widening" --type ts -g "!*test.ts"
   ```
   Expected: 0 results

2. **TypeScript compilation:**
   ```bash
   cd packages/core && npx tsc --noEmit
   cd packages/types && npx tsc --noEmit
   ```
   Expected: 0 errors

3. **Run tests (may fail - will be fixed in 11.106.8):**
   ```bash
   npm test
   ```
   Expected: Tests may fail if they assert on these fields - this is OK, task 11.106.8 will fix them

## Success Criteria

- ✅ `is_narrowing` removed from interface
- ✅ `is_widening` removed from interface
- ✅ Assignments to these flags removed
- ✅ No remaining references in codebase
- ✅ TypeScript compiles with 0 errors
- ✅ All tests pass

## Notes

### Why These Flags Don't Work

**Narrowing example (TypeScript):**
```typescript
function process(x: string | number) {
  if (typeof x === "string") {
    // x narrowed to string
    return x.length;
  }
  // x narrowed to number
  return x * 2;
}
```

Detecting this requires:
1. Understanding TypeScript's type system
2. Tracking control flow branches
3. Maintaining type state across statements

**Widening example:**
```typescript
let x = 42;           // inferred as number
let y: any = x;       // widened to any
```

Detecting this requires comparing type hierarchies.

Both are beyond AST-based extraction.

## Related Documentation

After this task, update any docs that mention narrowing/widening:
- Remove examples showing these flags
- Note that type flow is simplified to target type only

## Test Assertions

**Do NOT fix failing tests in this task.** If tests fail because they assert on `is_narrowing` or `is_widening`, let them fail. Task 11.106.8 will systematically update all tests to remove assertions on deleted fields.
