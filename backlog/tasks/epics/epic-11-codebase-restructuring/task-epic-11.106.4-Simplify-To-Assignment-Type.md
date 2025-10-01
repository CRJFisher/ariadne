# Task 11.106.4: Simplify type_flow to assignment_type

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 45 minutes
**Parent:** task-epic-11.106
**Dependencies:** task-epic-11.106.3 (boolean flags removed)

## Objective

Replace the complex `type_flow` object (which now only contains `target_type`) with a simpler `assignment_type` field. This makes the API clearer and removes unnecessary nesting.

## Rationale

After removing `source_type`, `is_narrowing`, and `is_widening`, the `type_flow` object only contains:

```typescript
type_flow?: {
  target_type?: TypeInfo;
}
```

This double-optional nesting (`type_flow?.target_type`) is awkward. A simple `assignment_type?: TypeInfo` is clearer.

## Changes Required

### 1. Update TypeScript Interface

**File:** `packages/types/src/semantic_index.ts`

**Before:**
```typescript
export interface SymbolReference {
  // ... other fields ...
  readonly type_flow?: {
    target_type?: TypeInfo;
  };
  // ... other fields ...
}
```

**After:**
```typescript
export interface SymbolReference {
  // ... other fields ...
  readonly assignment_type?: TypeInfo;
  // ... other fields ...
}
```

### 2. Update reference_builder.ts

**File:** `packages/core/src/index_single_file/query_code_tree/reference_builder.ts`

**Location:** Around line 412-427 in the `process()` method

**Before:**
```typescript
// Add type flow information for assignments
if (kind === ReferenceKind.ASSIGNMENT) {
  const type_flow_info = {
    target_type: extract_type_info(capture, this.extractors, this.file_path),
  };

  // Only add type_flow if we have meaningful information
  if (type_flow_info.target_type) {
    const updated_ref = { ...reference, type_flow: type_flow_info };
    this.references.push(updated_ref);
    return this;
  }
}
```

**After:**
```typescript
// Add assignment type information
if (kind === ReferenceKind.ASSIGNMENT) {
  const assignment_type = extract_type_info(capture, this.extractors, this.file_path);

  // Only add assignment_type if we have meaningful information
  if (assignment_type) {
    const updated_ref = { ...reference, assignment_type };
    this.references.push(updated_ref);
    return this;
  }
}
```

### 3. Update Test Files

**Note:** This will be done more comprehensively in task 11.106.8, but do a basic pass here to catch obvious test failures.

Search for test assertions on `type_flow.target_type`:

```bash
rg "type_flow\.target_type" --type ts --glob "*test.ts" -l
```

For each file found, update assertions to use `assignment_type`:

**Before:**
```typescript
expect(reference.type_flow?.target_type).toBeDefined();
expect(reference.type_flow?.target_type?.type_name).toBe("string");
```

**After:**
```typescript
expect(reference.assignment_type).toBeDefined();
expect(reference.assignment_type?.type_name).toBe("string");
```

**Important:** Also delete any assertions on `type_flow` structure itself:
```typescript
// ❌ DELETE these lines
expect(reference.type_flow).toBeDefined();
expect(reference.type_flow?.target_type).toBe(...);

// ✅ Keep only the direct assignment_type assertion
expect(reference.assignment_type).toBeDefined();
```

## Files Likely to Change

Based on typical patterns:

1. `packages/types/src/semantic_index.ts` - Interface
2. `packages/core/src/index_single_file/query_code_tree/reference_builder.ts` - Implementation
3. `packages/core/src/index_single_file/query_code_tree/reference_builder.test.ts` - Unit tests
4. `packages/core/src/index_single_file/semantic_index.*.test.ts` - Integration tests

## Verification Steps

1. **Find all type_flow references (should be 0):**
   ```bash
   rg "type_flow" --type ts
   ```

2. **Find assignment_type usage:**
   ```bash
   rg "assignment_type" --type ts
   ```
   Expected: Shows new usage

3. **TypeScript compilation:**
   ```bash
   npx tsc --noEmit
   ```
   Expected: 0 errors

4. **Run all tests:**
   ```bash
   npm test
   ```
   Expected: All tests pass (no regressions)

## Success Criteria

- ✅ `type_flow` completely removed from interface
- ✅ `assignment_type` added to interface
- ✅ All code updated to use `assignment_type`
- ✅ All tests updated to assert on `assignment_type`
- ✅ No references to `type_flow` remain
- ✅ TypeScript compiles with 0 errors
- ✅ All tests pass

## API Improvement

This change improves the API by:

1. **Reduced nesting:** `ref.assignment_type` vs `ref.type_flow?.target_type`
2. **Clearer naming:** "assignment_type" is more descriptive than "type_flow"
3. **Simpler typing:** One optional field vs nested optional object
4. **Less confusion:** No dead fields (source_type, etc.) to confuse users

## Migration Notes

Since this is pre-release, no migration guide is needed. If this were a public API:

```typescript
// Old way
const type = ref.type_flow?.target_type;

// New way
const type = ref.assignment_type;
```

## Notes

After this task, `SymbolReference` will have three type-related fields:
- `type_info?: TypeInfo` - Type at the reference location
- `assignment_type?: TypeInfo` - Type of assignment target (for assignments)
- `return_type?: TypeInfo` - Return type (for return statements)

Each field is independent and optional, making the interface cleaner.
