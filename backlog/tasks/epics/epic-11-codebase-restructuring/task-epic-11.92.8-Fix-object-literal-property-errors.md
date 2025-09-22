# Task: Fix Object Literal Property Errors

**Task ID**: task-epic-11.92.8
**Parent**: task-epic-11.92
**Status**: Pending
**Priority**: High
**Created**: 2025-01-22
**Estimated Effort**: 0.5 days

## Summary

Fix 33 TypeScript errors (TS2353, TS2561) where object literals have incorrect property names or extra properties, indicating interface changes or typos in property names.

## Problem Analysis

### Major Issues

1. **Property Name Changes** (15 errors - TS2561)
   - `arguments_count` should be `argument_count` in LocalConstructorCall
   - Systematic typo across multiple test files

2. **Extra Properties** (18 errors - TS2353)
   - `is_conditional` doesn't exist on ReturnReference
   - `definition_scope` doesn't exist on SymbolDefinition
   - Properties added in tests that don't exist in interfaces

## Affected Files

### Constructor Resolution Tests
- `constructor_resolution.test.ts` - 8 instances of `arguments_count` typo

### Reference Tests
- `reference_types.test.ts:48` - `is_conditional` on ReturnReference
- `references.test.ts:822` - `is_conditional` on ReturnReference

### Symbol Definition Issues
- Multiple files trying to use `definition_scope` instead of `scope_id`

## Implementation Strategy

### Step 1: Fix Property Typos (2 hours)
```typescript
// Find and replace all instances
// From: arguments_count
// To: argument_count
```

### Step 2: Remove Extra Properties (1 hour)
- Remove `is_conditional` from ReturnReference usages
- Update tests to not expect these properties

### Step 3: Fix Property Name Mismatches (1 hour)
- Change `definition_scope` to `scope_id`
- Align with actual interface definitions

## Detailed Fixes

### LocalConstructorCall Fix
```typescript
// Before
{
  class_name: "MyClass" as ClassName,
  arguments_count: 2,  // Wrong property name
  location: location
}

// After
{
  class_name: "MyClass" as ClassName,
  argument_count: 2,   // Correct property name
  location: location
}
```

### ReturnReference Fix
```typescript
// Before
{
  value: "result",
  is_conditional: false,  // Property doesn't exist
  location: location
}

// After
{
  value: "result",
  location: location
}
```

### SymbolDefinition Fix
```typescript
// Before
{
  id: symbolId,
  name: symbolName,
  kind: "class",
  location: location,
  definition_scope: scopeId  // Wrong property
}

// After
{
  id: symbolId,
  name: symbolName,
  kind: "class",
  location: location,
  scope_id: scopeId,         // Correct property
  is_hoisted: false,         // Add missing required properties
  is_exported: false,
  is_imported: false
}
```

## Success Criteria

- All TS2353 and TS2561 errors resolved
- Object literals match interface definitions
- No extra properties on objects
- Tests use correct property names

## Verification

```bash
# Check object literal errors
npm run build 2>&1 | grep -E "TS2353|TS2561" | wc -l
# Expected: 0

# Verify specific fixes
grep -r "arguments_count" src/ | wc -l
# Expected: 0

grep -r "is_conditional" src/symbol_resolution/ | wc -l
# Expected: 0 (or only in valid contexts)
```

## Quick Fixes Script

```bash
# Automated property name fixes
find src/symbol_resolution -name "*.ts" -type f -exec sed -i '' 's/arguments_count/argument_count/g' {} +
find src/symbol_resolution -name "*.ts" -type f -exec sed -i '' 's/definition_scope/scope_id/g' {} +
```

## Dependencies

- Can be done independently of other fixes
- Quick wins that reduce error count significantly

## Follow-up

- Add interface validation in tests
- Consider stricter TypeScript settings to catch earlier
- Document interface changes clearly