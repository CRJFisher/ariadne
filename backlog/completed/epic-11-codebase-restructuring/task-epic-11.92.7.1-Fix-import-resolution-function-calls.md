# Task: Fix import_resolution Function Calls

**Task ID**: task-epic-11.92.7.1
**Parent**: task-epic-11.92.7
**Status**: Pending
**Priority**: High
**Created**: 2025-01-22
**Estimated Effort**: 2 hours

## Summary

Fix 24 TypeScript errors in import_resolution.comprehensive.test.ts related to incorrect function signatures and missing exports.

## Problem

Multiple issues with function calls and imports:
1. Missing exports (Lines 16-17): `create_import_resolution_context`, `resolve_module_path`
2. Mock function signature mismatches (multiple lines)
3. Wrong parameter types in function calls
4. Implicit any types in mock implementations

Specific errors:
- TS2305: Module has no exported member (2 instances)
- TS2339: Property 'mockImplementation' does not exist (7 instances)
- TS7006: Parameter implicitly has 'any' type (7 instances)
- Various argument type mismatches

## Solution Approach

1. **Fix missing exports**
   ```typescript
   // Either export from index.ts or import from correct module
   import {
     create_import_resolution_context,
     resolve_module_path
   } from "./import_resolution"; // Instead of "./index"
   ```

2. **Fix mock implementations**
   ```typescript
   // Properly type the mock
   const existsSyncMock = vi.fn<[PathLike], boolean>();
   existsSyncMock.mockImplementation((p: PathLike) => {
     // implementation
   });
   ```

3. **Add proper typing to parameters**
   ```typescript
   // Instead of implicit any
   .mockImplementation((p: any) => ...)

   // Use proper type
   .mockImplementation((p: PathLike) => ...)
   ```

## Implementation Steps

1. **Fix imports** (30 min)
   - Locate correct modules for missing functions
   - Update import statements
   - Or add exports to index.ts if appropriate

2. **Fix mock setup** (1 hour)
   - Import vitest mock types if needed
   - Properly type all mock functions
   - Ensure mockImplementation is available

3. **Fix parameter types** (30 min)
   - Add explicit types to all parameters
   - Use PathLike from node:fs types
   - Remove all implicit any

## Example Fixes

```typescript
// Fix 1: Import from correct module
import {
  resolve_imports,
  ImportResolutionMap
} from "./index";
import {
  create_import_resolution_context,
  resolve_module_path
} from "./import_resolver"; // Correct internal module

// Fix 2: Properly typed mock
import { vi } from 'vitest';
import type { PathLike } from 'node:fs';

const existsSyncMock = vi.fn<[PathLike], boolean>();
existsSyncMock.mockImplementation((p: PathLike): boolean => {
  const path = p.toString();
  return mockFileSystem.has(path);
});

// Fix 3: Replace fs.existsSync with mock
vi.spyOn(fs, 'existsSync').mockImplementation(existsSyncMock);
```

## Success Criteria

- [ ] All 24 TypeScript errors resolved
- [ ] No implicit any types remaining
- [ ] Mock functions properly typed
- [ ] Tests run successfully
- [ ] Import/export structure clear and maintainable

## Files to Modify

- `src/symbol_resolution/import_resolution/import_resolution.comprehensive.test.ts`
- Potentially: `src/symbol_resolution/import_resolution/index.ts`

## Testing

```bash
# Verify compilation
npm run build

# Run specific test
npx vitest run src/symbol_resolution/import_resolution/import_resolution.comprehensive.test.ts
```

## Dependencies

- May need to coordinate with task-epic-11.92.10.2 (import_resolution imports)
- Related to overall import/export structure

## Notes

- Check if functions should be internal or exported
- Ensure mock setup follows vitest best practices
- Consider creating mock utilities if pattern repeats