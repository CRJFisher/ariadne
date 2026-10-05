# Task: Fix Implicit Any Types

**Task ID**: task-epic-11.92.11.1
**Parent**: task-epic-11.92.11
**Status**: Pending
**Priority**: High
**Created**: 2025-01-22
**Estimated Effort**: 2 hours

## Summary

Add explicit type annotations to fix 12 TS7006 errors where parameters have implicit 'any' type across various test files.

## Problem

12 instances of implicit 'any' type in test files:
- import_resolution.comprehensive.test.ts: 7 instances (mock function parameters)
- type_resolution.comprehensive.test.ts: Multiple instances
- Other test files with missing type annotations

## Common Patterns

1. **Mock function parameters**
   ```typescript
   // Before
   .mockImplementation((p) => { ... })

   // After
   .mockImplementation((p: PathLike) => { ... })
   ```

2. **Array method callbacks**
   ```typescript
   // Before
   items.map(item => item.value)

   // After
   items.map((item: ItemType) => item.value)
   ```

3. **Event handlers and callbacks**
   ```typescript
   // Before
   onSuccess(result => { ... })

   // After
   onSuccess((result: ResultType) => { ... })
   ```

## Implementation Steps

1. **Find all TS7006 errors** (20 min)
   ```bash
   npm run build 2>&1 | grep "TS7006"
   ```

2. **Group by file and pattern** (20 min)
   - Mock implementations
   - Callback functions
   - Array methods
   - Other patterns

3. **Fix mock implementations** (30 min)
   ```typescript
   import type { PathLike } from 'node:fs';

   vi.spyOn(fs, 'existsSync').mockImplementation(
     (path: PathLike): boolean => {
       return mockFs.has(path.toString());
     }
   );
   ```

4. **Fix array methods** (30 min)
   ```typescript
   // Explicit type in callback
   const results = items.map((item: Item) => item.value);

   // Or type the array
   const items: Item[] = getItems();
   const results = items.map(item => item.value); // Type inferred
   ```

5. **Fix other callbacks** (20 min)
   ```typescript
   function processData(callback: (data: DataType) => void) {
     // ...
   }

   processData((data) => { // Type inferred from function signature
     console.log(data);
   });
   ```

## Specific Fixes

### import_resolution.comprehensive.test.ts
```typescript
// Lines with (p) => or (p: any) =>
// Before
.mockImplementation((p) => {
  return p.includes('.js');
})

// After
import type { PathLike } from 'node:fs';

.mockImplementation((p: PathLike) => {
  const pathStr = p.toString();
  return pathStr.includes('.js');
})
```

### type_resolution.comprehensive.test.ts
```typescript
// Before
const processed = types.map(type => ({
  id: type.id,
  name: type.name
}));

// After
const processed = types.map((type: TypeInfo) => ({
  id: type.id,
  name: type.name
}));
```

## Type Sources

Common types to import:
```typescript
// Node.js types
import type { PathLike } from 'node:fs';
import type { Buffer } from 'node:buffer';

// Project types
import type {
  TypeInfo,
  SymbolInfo,
  Location,
  FilePath,
  TypeId,
  SymbolId
} from '@ariadnejs/types';

// Vitest types
import type { MockedFunction } from 'vitest';
```

## Success Criteria

- [ ] All 12 TS7006 errors resolved
- [ ] Explicit types added where needed
- [ ] Type imports organized
- [ ] No use of 'any' type
- [ ] Type inference used where appropriate

## Files to Modify

Primary targets:
- `src/symbol_resolution/import_resolution/import_resolution.comprehensive.test.ts`
- `src/symbol_resolution/type_resolution/type_resolution.comprehensive.test.ts`

Other files with TS7006 errors (check build output)

## Testing

```bash
# Check for remaining implicit any
npm run build 2>&1 | grep "TS7006"

# Verify types are correct
npx tsc --noEmit --strict

# Run affected tests
npx vitest run
```

## Best Practices

1. **Prefer specific types over 'any'**
   ```typescript
   // Bad
   (param: any) => param.value

   // Good
   (param: { value: string }) => param.value

   // Better
   (param: SpecificType) => param.value
   ```

2. **Use type inference where possible**
   ```typescript
   // Explicit but unnecessary
   const items: Array<Item> = getItems();
   items.map((item: Item) => item.value);

   // Better - type inferred
   const items = getItems(); // Return type provides type
   items.map(item => item.value);
   ```

3. **Import types properly**
   ```typescript
   // Use type imports for type-only imports
   import type { PathLike } from 'node:fs';
   ```

## Dependencies

None - fixing type annotations is independent

## Notes

- Don't use 'any' as a quick fix
- Consider enabling strict mode in tests
- Document complex type decisions
- Group related type imports together