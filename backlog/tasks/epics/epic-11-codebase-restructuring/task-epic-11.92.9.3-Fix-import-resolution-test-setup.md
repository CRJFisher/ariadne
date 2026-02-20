# Task: Fix import_resolution Test Setup

**Task ID**: task-epic-11.92.9.3
**Parent**: task-epic-11.92.9
**Status**: Pending
**Priority**: High
**Created**: 2025-01-22
**Estimated Effort**: 2 hours

## Summary

Update import_resolution.comprehensive.test.ts test setup to match current implementation, fixing missing exports, mock implementations, and 24 compilation errors.

## Problem

Test infrastructure issues:
- Missing function exports from module
- Mock implementations not properly typed
- Test setup doesn't match current API
- File system mocks are incorrect
- 24 TypeScript errors total

## Specific Issues

1. Functions not exported: `create_import_resolution_context`, `resolve_module_path`
2. Mock fs functions have wrong signatures
3. Test helpers are outdated
4. Mock data doesn't match expected types

## Solution Approach

1. **Fix module imports/exports**
   ```typescript
   // Determine correct import path
   import { resolve_imports } from './index';
   import {
     create_import_resolution_context,
     resolve_module_path
   } from './import_resolver'; // Internal module
   ```

2. **Create proper test setup**
   ```typescript
   import { vi } from 'vitest';
   import * as fs from 'node:fs';

   function setupImportResolutionTest() {
     const mockFs = new Map<string, string>();

     vi.spyOn(fs, 'existsSync').mockImplementation(
       (path: fs.PathLike): boolean => {
         return mockFs.has(path.toString());
       }
     );

     vi.spyOn(fs, 'readFileSync').mockImplementation(
       (path: fs.PathLike): string => {
         return mockFs.get(path.toString()) || '';
       }
     );

     return {
       mockFs,
       addFile: (path: string, content: string) => {
         mockFs.set(path, content);
       }
     };
   }
   ```

3. **Update test patterns**
   ```typescript
   describe('import resolution', () => {
     let testSetup: ReturnType<typeof setupImportResolutionTest>;

     beforeEach(() => {
       testSetup = setupImportResolutionTest();
     });

     afterEach(() => {
       vi.restoreAllMocks();
     });

     it('should resolve relative imports', () => {
       testSetup.addFile('/project/src/a.ts', 'export const a = 1;');
       testSetup.addFile('/project/src/b.ts', 'import { a } from "./a";');

       // Test implementation
     });
   });
   ```

## Implementation Steps

1. **Analyze import structure** (30 min)
   - Find where functions are defined
   - Determine if they should be exported
   - Update imports or exports

2. **Fix mock setup** (45 min)
   - Create proper fs mock utilities
   - Type all mock functions correctly
   - Ensure vitest mocks work

3. **Update test cases** (45 min)
   - Use new test setup
   - Fix mock data types
   - Update assertions

## Detailed Fixes

### Fix 1: Module Structure
```typescript
// If functions are internal, import from correct file
import { resolve_imports } from './index';
import {
  create_import_resolution_context,
  resolve_module_path
} from './internal/resolution_context'; // Find actual location

// Or add to index.ts exports if they should be public
export {
  create_import_resolution_context,
  resolve_module_path
} from './import_resolver';
```

### Fix 2: Mock Implementation
```typescript
import { vi, MockedFunction } from 'vitest';
import * as fs from 'node:fs';

type MockFs = {
  existsSync: MockedFunction<typeof fs.existsSync>;
  readFileSync: MockedFunction<typeof fs.readFileSync>;
};

function createMockFs(): MockFs {
  const files = new Map<string, string>();

  const existsSync = vi.fn((path: fs.PathLike): boolean => {
    return files.has(String(path));
  });

  const readFileSync = vi.fn(
    (path: fs.PathLike, encoding?: BufferEncoding): string => {
      return files.get(String(path)) || '';
    }
  );

  vi.spyOn(fs, 'existsSync').mockImplementation(existsSync);
  vi.spyOn(fs, 'readFileSync').mockImplementation(readFileSync as any);

  return { existsSync, readFileSync };
}
```

## Success Criteria

- [ ] All 24 TypeScript errors resolved
- [ ] Import/export structure clarified
- [ ] Mock implementations properly typed
- [ ] Tests run successfully
- [ ] Test patterns consistent and maintainable

## Files to Modify

- `src/symbol_resolution/import_resolution/import_resolution.comprehensive.test.ts`
- Potentially: `src/symbol_resolution/import_resolution/index.ts`

## Testing

```bash
# Verify compilation
npm run build

# Run tests
npx vitest run src/symbol_resolution/import_resolution/

# Check for regressions
npm test
```

## Dependencies

- Related to task-epic-11.92.7.1 (import function calls)
- May benefit from task-epic-11.92.9.1 (mock factories)

## Notes

- Determine if missing functions should be public API
- Ensure mock setup is reusable
- Document any API changes
- Consider extracting mock utilities for other tests