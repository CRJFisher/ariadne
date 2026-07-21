# Task: Fix Function Signature Mismatches

**Task ID**: task-epic-11.92.7
**Parent**: task-epic-11.92
**Status**: Pending
**Priority**: High
**Created**: 2025-01-22
**Estimated Effort**: 1 day

## Summary

Fix 52 TypeScript TS2554 errors where functions are called with wrong number of arguments, indicating API changes or inconsistent function signatures across the codebase.

## Problem Analysis

### Major Patterns

1. **Symbol Creation Functions** (20+ errors)
   - `class_symbol()` expects 2 args, getting 3
   - `function_symbol()` expects 2 args, getting 3
   - `method_symbol()` expects 3 args, getting 4
   - Extra location argument being passed

2. **Constructor Resolution** (10+ errors)
   - Changed function signatures in constructor_resolution
   - Mismatch between test expectations and implementation

3. **Type Creation Functions** (10+ errors)
   - Type factory functions have changed signatures
   - Tests using old API

## Affected Files

### Most Impacted
- `symbol_resolution/constructor_resolution.test.ts` (15+ errors)
- `symbol_resolution/data_export/data_export.test.ts` (5 errors)
- `symbol_resolution/type_resolution/type_resolution.comprehensive.test.ts` (10+ errors)

## Detailed Issues

### Symbol Creation API Change

**Old API (tests expect):**
```typescript
class_symbol(name: string, file: string, location: Location): SymbolId
```

**New API (actual):**
```typescript
class_symbol(name: string, file: string): SymbolId
```

### Type Factory Changes

**Old:**
```typescript
type_id("DataModel", TypeCategory.CLASS, "models.ts", location)
```

**New:**
```typescript
type_id("DataModel", "models.ts")  // Category inferred or separate
```

## Implementation Strategy

### Step 1: Audit Symbol Creation APIs (2 hours)
- Check current function signatures in symbol_utils
- Document the correct API
- Identify all call sites

### Step 2: Fix Symbol Creation Calls (3 hours)
- Update all test files to use correct signatures
- Remove extra location arguments
- Ensure consistency across codebase

### Step 3: Fix Type Creation Calls (2 hours)
- Update type_id usage
- Fix TypeCategory parameter issues
- Align with new API

### Step 4: Validate Other Functions (1 hour)
- Check remaining TS2554 errors
- Fix any other signature mismatches
- Update function documentation

## Code Fixes

### Symbol Creation Fix
```typescript
// Before
const classId = class_symbol('MyClass', 'file.ts', location);

// After
const classId = class_symbol('MyClass', 'file.ts');
```

### Type Creation Fix
```typescript
// Before
const typeId = type_id("DataModel", TypeCategory.CLASS, "models.ts", location);

// After
const typeId = type_id("DataModel", "models.ts");
```

## Success Criteria

- All TS2554 errors resolved
- Function calls match actual signatures
- Tests pass with correct APIs
- Documentation updated

## Verification

```bash
# Check function signature errors
npm run build 2>&1 | grep "TS2554" | wc -l
# Expected: 0

# Run affected tests
npm test -- constructor_resolution
npm test -- data_export
npm test -- type_resolution.comprehensive
```

## Dependencies

- Depends on task-epic-11.92.5 (ReadonlyMap fixes) for compilation
- May affect task-epic-11.92.8 (test data alignment)

## Risks

- Changing function signatures may affect other modules
- Need to ensure all call sites updated
- May reveal additional API inconsistencies

## Follow-up

- Document all public APIs clearly
- Add type checking for function signatures
- Consider using function overloads for backwards compatibility