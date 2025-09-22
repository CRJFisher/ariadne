# Task: Fix Type Registry Issues

**Task ID**: task-epic-11.92.11.2
**Parent**: task-epic-11.92.11
**Status**: Pending
**Priority**: High
**Created**: 2025-01-22
**Estimated Effort**: 1.5 hours

## Summary

Fix TS7053 error in type_registry/index.test.ts where dynamic property access on module exports has implicit 'any' type.

## Problem

Line 55: TS7053 - Element implicitly has 'any' type because expression of type 'string' can't be used to index type 'typeof import(...)'.

This occurs when trying to dynamically access exports from a module using a string key.

## Common Pattern

```typescript
// Problem code
import * as module from './index';
const exportName = 'someFunction';
const exported = module[exportName]; // TS7053: implicit any

// The issue: TypeScript doesn't know if exportName is a valid key
```

## Solution Options

### Option A: Type-safe key access
```typescript
import * as module from './index';

// Define valid keys
type ModuleExports = keyof typeof module;

// Ensure key is valid
function getExport(key: ModuleExports) {
  return module[key];
}
```

### Option B: Type assertion
```typescript
const exportName = 'someFunction' as keyof typeof module;
const exported = module[exportName];
```

### Option C: Type guard
```typescript
function isValidExport(key: string): key is keyof typeof module {
  return key in module;
}

if (isValidExport(exportName)) {
  const exported = module[exportName]; // Type-safe
}
```

### Option D: Explicit type map
```typescript
const MODULE_EXPORTS = {
  build_global_type_registry: module.build_global_type_registry,
  create_type_id: module.create_type_id,
  // ... other exports
} as const;

const exported = MODULE_EXPORTS[exportName as keyof typeof MODULE_EXPORTS];
```

## Implementation Steps

1. **Analyze the test** (20 min)
   - Understand what's being tested
   - Determine if dynamic access is needed
   - Review module exports

2. **Choose approach** (10 min)
   - If testing specific exports: use explicit list
   - If testing all exports: use type-safe iteration
   - If dynamic needed: use type guards

3. **Implement fix** (30 min)
   - Apply chosen solution
   - Ensure test logic preserved
   - Add type safety

4. **Refactor if needed** (30 min)
   - Consider if test approach should change
   - Improve type safety throughout
   - Document approach

## Detailed Fix

### Current problematic code (likely pattern)
```typescript
// index.test.ts line 55
describe('module exports', () => {
  it('should export expected functions', () => {
    const expectedExports = [
      'build_global_type_registry',
      'create_type_id',
      'resolve_types'
    ];

    expectedExports.forEach(exportName => {
      const exported = module[exportName]; // TS7053 here
      expect(exported).toBeDefined();
    });
  });
});
```

### Fixed version - Option 1: Type-safe iteration
```typescript
import * as module from './index';

describe('module exports', () => {
  it('should export expected functions', () => {
    // Define expected exports with proper typing
    const expectedExports: (keyof typeof module)[] = [
      'build_global_type_registry',
      'create_type_id',
      'resolve_types'
    ];

    expectedExports.forEach(exportName => {
      const exported = module[exportName]; // Now type-safe
      expect(exported).toBeDefined();
      expect(typeof exported).toBe('function');
    });
  });
});
```

### Fixed version - Option 2: Explicit checks
```typescript
import {
  build_global_type_registry,
  create_type_id,
  resolve_types
} from './index';

describe('module exports', () => {
  it('should export build_global_type_registry', () => {
    expect(build_global_type_registry).toBeDefined();
    expect(typeof build_global_type_registry).toBe('function');
  });

  it('should export create_type_id', () => {
    expect(create_type_id).toBeDefined();
    expect(typeof create_type_id).toBe('function');
  });

  it('should export resolve_types', () => {
    expect(resolve_types).toBeDefined();
    expect(typeof resolve_types).toBe('function');
  });
});
```

### Fixed version - Option 3: Type guard approach
```typescript
import * as module from './index';

describe('module exports', () => {
  // Type guard for checking exports
  function hasExport<T extends string>(
    mod: any,
    key: T
  ): mod is Record<T, unknown> {
    return key in mod;
  }

  it('should export expected functions', () => {
    const expectedExports = [
      'build_global_type_registry',
      'create_type_id',
      'resolve_types'
    ];

    expectedExports.forEach(exportName => {
      expect(hasExport(module, exportName)).toBe(true);

      if (hasExport(module, exportName)) {
        const exported = module[exportName];
        expect(typeof exported).toBe('function');
      }
    });
  });
});
```

## Success Criteria

- [ ] TS7053 error resolved
- [ ] Test still validates exports
- [ ] Type-safe implementation
- [ ] No dynamic 'any' access
- [ ] Clear and maintainable code

## Files to Modify

- `src/semantic_index/type_registry/index.test.ts`

## Testing

```bash
# Verify type error fixed
npx tsc --noEmit src/semantic_index/type_registry/index.test.ts

# Run the test
npx vitest run src/semantic_index/type_registry/index.test.ts

# Full build check
npm run build
```

## Dependencies

None - isolated test file fix

## Notes

- Consider if dynamic export testing is necessary
- Explicit imports might be clearer
- Type-safe approach prevents future issues
- Document why specific exports are tested