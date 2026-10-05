# Task: Fix query_loader Mock Functions

**Task ID**: task-epic-11.92.7.2
**Parent**: task-epic-11.92.7
**Status**: Pending
**Priority**: High
**Created**: 2025-01-22
**Estimated Effort**: 1.5 hours

## Summary

Fix mock function signature mismatches in query_loader.test.ts where mock implementations don't match fs.readFileSync signatures.

## Problem

Two TypeScript errors (TS2345) where mock functions have incompatible signatures:
- Line 385: Mock function signature incompatible with fs.readFileSync
- Line 505: Mock function signature incompatible with fs.readFileSync

The issue: fs.readFileSync accepts `PathOrFileDescriptor` (string | number | Buffer | URL) but mock only handles `string`.

## Current Code Pattern

```typescript
// Current problematic mock
const mockReadFileSync = vi.fn((path: string) => {
  // Only handles string, not PathOrFileDescriptor
  return fileContents[path];
});
```

## Solution Approach

1. **Match fs.readFileSync signature**
   ```typescript
   import type { PathOrFileDescriptor } from 'node:fs';

   const mockReadFileSync = vi.fn((path: PathOrFileDescriptor, options?: any) => {
     const pathStr = path.toString();
     return fileContents[pathStr];
   });
   ```

2. **Use vitest's type-safe mocking**
   ```typescript
   import { readFileSync } from 'node:fs';

   vi.mock('node:fs');
   const mockReadFileSync = vi.mocked(readFileSync);
   mockReadFileSync.mockImplementation((path, options) => {
     const pathStr = path.toString();
     return fileContents[pathStr];
   });
   ```

## Implementation Steps

1. **Import proper types** (15 min)
   - Import PathOrFileDescriptor from node:fs
   - Import vitest mock utilities

2. **Fix Line 385** (30 min)
   - Update mock function signature
   - Handle different path input types
   - Ensure return type matches

3. **Fix Line 505** (30 min)
   - Apply same pattern as Line 385
   - Test with different input types
   - Verify mock behavior

4. **Test edge cases** (15 min)
   - Test with string paths
   - Test with Buffer paths
   - Ensure backwards compatibility

## Example Fix

```typescript
// Before
const mockReadFileSync = vi.fn((path: string) => {
  if (path.endsWith('.scm')) {
    return "(javascript) @test";
  }
  return "(typescript) @test";
});

// After
import type { PathOrFileDescriptor, BufferEncoding } from 'node:fs';

const mockReadFileSync = vi.fn(
  (path: PathOrFileDescriptor, options?: { encoding?: BufferEncoding } | BufferEncoding) => {
    // Convert to string for lookup
    const pathStr = typeof path === 'string' ? path :
                    Buffer.isBuffer(path) ? path.toString() :
                    typeof path === 'number' ? `fd:${path}` :
                    path.toString();

    if (pathStr.endsWith('.scm')) {
      return "(javascript) @test";
    }
    return "(typescript) @test";
  }
);
```

## Success Criteria

- [ ] Both TS2345 errors resolved
- [ ] Mock functions handle all valid input types
- [ ] Tests continue to pass
- [ ] No new TypeScript errors introduced
- [ ] Mock behavior unchanged for existing tests

## Files to Modify

- `src/semantic_index/query_loader.test.ts`

## Testing

```bash
# Verify compilation
npm run build

# Run specific test
npx vitest run src/semantic_index/query_loader.test.ts
```

## Dependencies

None - isolated mock function fixes

## Notes

- Consider extracting mock to shared test utilities if used elsewhere
- Document why path type conversion is needed
- Ensure mock handles encoding parameter if tests need it