# Task: Fix import_resolution Imports

**Task ID**: task-epic-11.92.10.2
**Parent**: task-epic-11.92.10
**Status**: Pending
**Priority**: Medium
**Created**: 2025-01-22
**Estimated Effort**: 1.5 hours

## Summary

Fix missing exports in import_resolution module - specifically `create_import_resolution_context` and `resolve_module_path` functions that tests are trying to import.

## Problem

Two TS2305 errors in import_resolution.comprehensive.test.ts:
- Line 16: Module has no exported member 'create_import_resolution_context'
- Line 17: Module has no exported member 'resolve_module_path'

These functions are needed by tests but not exported from index.ts.

## Analysis Needed

1. Are these functions internal implementation details?
2. Should they be part of the public API?
3. Are they defined in a different module?

## Solution Options

### Option A: Export from index.ts (if public API)
```typescript
// src/symbol_resolution/import_resolution/index.ts
export {
  resolve_imports,
  create_import_resolution_context,
  resolve_module_path
} from './import_resolver';
```

### Option B: Import from internal module (if internal)
```typescript
// In test file
import {
  create_import_resolution_context,
  resolve_module_path
} from './import_resolver'; // Internal module, not index
```

### Option C: Create test-specific utilities
```typescript
// Create test-only versions if originals are truly internal
function createTestResolutionContext() {
  // Test-specific implementation
}
```

## Implementation Steps

1. **Locate the functions** (20 min)
   - Search for function definitions
   - Determine which module contains them
   - Check if they're already exported somewhere

2. **Determine proper visibility** (20 min)
   - Review function purposes
   - Check if other code uses them
   - Decide if public or internal

3. **Implement chosen solution** (30 min)
   - Either export from index
   - Or update test imports
   - Or create test utilities

4. **Update documentation** (20 min)
   - Document public API if expanded
   - Add comments about internal functions
   - Update test documentation

## Detailed Implementation

### Step 1: Find Functions
```bash
# Search for function definitions
grep -r "function create_import_resolution_context" src/symbol_resolution/import_resolution/
grep -r "export.*create_import_resolution_context" src/symbol_resolution/import_resolution/

grep -r "function resolve_module_path" src/symbol_resolution/import_resolution/
grep -r "export.*resolve_module_path" src/symbol_resolution/import_resolution/
```

### Step 2: If Functions Exist and Should Be Public
```typescript
// src/symbol_resolution/import_resolution/index.ts
// Add exports
export {
  // Existing exports
  resolve_imports,
  ImportResolutionMap,

  // New exports for testing/public use
  create_import_resolution_context,
  resolve_module_path
} from './import_resolver'; // or wherever they're defined
```

### Step 3: If Functions Don't Exist or Are Internal
```typescript
// src/symbol_resolution/import_resolution/test_helpers.ts
// Create test-specific versions

import type { ImportResolutionContext } from './types';

export function create_import_resolution_context(
  baseDir: string,
  options?: Partial<ImportResolutionContext>
): ImportResolutionContext {
  return {
    base_directory: baseDir,
    resolved_modules: new Map(),
    module_graph: new Map(),
    ...options
  };
}

export function resolve_module_path(
  from: string,
  to: string,
  context: ImportResolutionContext
): string | undefined {
  // Test implementation
  // May call internal implementation if available
}
```

## Success Criteria

- [ ] Both TS2305 errors resolved
- [ ] Functions accessible to tests
- [ ] Clear distinction between public/internal API
- [ ] Tests pass with correct functionality
- [ ] Documentation updated

## Files to Modify

- `src/symbol_resolution/import_resolution/index.ts` (potentially)
- `src/symbol_resolution/import_resolution/import_resolution.comprehensive.test.ts`
- Potentially create: `src/symbol_resolution/import_resolution/test_helpers.ts`

## Testing

```bash
# Verify imports work
npx tsc --noEmit src/symbol_resolution/import_resolution/import_resolution.comprehensive.test.ts

# Run tests
npx vitest run src/symbol_resolution/import_resolution/

# Check for API breaks
npm run build
```

## Dependencies

- Related to task-epic-11.92.7.1 (import function calls)
- May affect public API if functions are exported

## Notes

- Consider long-term API stability
- Document whether functions are public or test-only
- If creating test helpers, make them reusable
- Coordinate with module maintainer on API decisions