# Task: Fix Module and Export Issues

**Task ID**: task-epic-11.92.10
**Parent**: task-epic-11.92
**Status**: Pending
**Priority**: Medium
**Created**: 2025-01-22
**Estimated Effort**: 0.5 days

## Summary

Fix module resolution and export issues including missing exports, incorrect imports, and module declaration problems that prevent proper module loading.

## Problem Analysis

### Error Categories

1. **Missing Exports** (TS2459 - 3 errors)
   - `LocalMemberInfo` declared but not exported from type_members
   - `LocalParameterInfo` declared but not exported from type_members

2. **Module Not Found** (TS2307 - 2 errors)
   - Cannot find module './other-module'
   - Cannot find module './specific-module'

3. **Invalid Module Names** (TS2664 - 1 error)
   - Invalid module name in augmentation 'external-module'

4. **Missing Exports from Index** (TS2305 - 7 errors)
   - Module has no exported member errors

5. **Dynamic Import Issues** (TS7053 - 1 error)
   - String index type issues with module imports

## Affected Files

### Core Export Issues
- `semantic_index/type_members/index.ts:6-7` - Missing exports
- `semantic_index/type_members/type_members.test.ts:21` - Import failures

### Test Import Issues
- `semantic_index/definitions/fixtures/typescript/comprehensive_definitions.ts:302-303`
- `semantic_index/type_registry/index.test.ts:55`

## Implementation Strategy

### Step 1: Fix Missing Exports (1 hour)

```typescript
// semantic_index/type_members/index.ts
export {
  extract_type_members,
  LocalTypeMembers,
  LocalMemberInfo,        // Add export
  LocalParameterInfo,     // Add export
  // ... other exports
} from './type_members';
```

### Step 2: Fix Test Module Imports (1 hour)

Either create mock modules or update imports:

```typescript
// Option 1: Create mock modules
// fixtures/other-module.ts
export const mockData = {};

// Option 2: Remove invalid imports from test fixtures
// Remove lines trying to import non-existent modules
```

### Step 3: Fix Module Augmentation (30 min)

```typescript
// Before
declare module 'external-module' {  // Invalid
  // ...
}

// After - either:
// 1. Remove if not needed
// 2. Create actual external-module
// 3. Use proper augmentation syntax
declare module './actual-module' {
  // ...
}
```

### Step 4: Fix Index Barrel Exports (1 hour)

Review all index.ts files and ensure they export everything needed:

```typescript
// Check each index.ts
export * from './module1';
export * from './module2';
export { specific1, specific2 } from './module3';
```

## Detailed Fixes

### Type Members Export Fix

```typescript
// semantic_index/type_members/type_members.ts
export interface LocalMemberInfo {
  kind: "method" | "property" | "field" | "getter" | "setter";
  symbol_id?: SymbolId;
}

export interface LocalParameterInfo {
  name: string;
  type?: string;
  optional?: boolean;
}

// semantic_index/type_members/index.ts
export type {
  LocalMemberInfo,
  LocalParameterInfo,
  LocalTypeMembers
} from './type_members';

export { extract_type_members } from './type_members';
```

### Dynamic Import Fix

```typescript
// Before
const exported = module[exportName];  // TS7053 error

// After
const moduleExports = module as Record<string, any>;
const exported = moduleExports[exportName];
```

## Success Criteria

- All module resolution errors resolved
- All required types properly exported
- Tests can import needed types
- No circular dependency issues

## Verification

```bash
# Check module errors
npm run build 2>&1 | grep -E "TS2307|TS2459|TS2305|TS2664" | wc -l
# Expected: 0

# Verify exports
npm run build 2>&1 | grep "has no exported member" | wc -l
# Expected: 0

# Check imports work
npm test -- type_members
```

## Quick Fixes

```bash
# Find all missing exports
grep -r "declares.*locally, but it is not exported" src/

# Find all module not found errors
grep -r "Cannot find module" src/

# Check all index.ts exports
find src -name "index.ts" -exec echo "=== {} ===" \; -exec grep "export" {} \;
```

## Dependencies

- Can be done independently
- May affect other modules that import these types

## Follow-up

- Audit all public APIs for proper exports
- Consider using barrel exports consistently
- Document module structure and exports