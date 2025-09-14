# Task 11.100.0.5.follow-up-3: Standardize Branded Type Access Patterns

## Context
After the Epic 11 refactoring to branded types (SymbolId, Import, Export), there are inconsistent access patterns throughout the codebase. Some code incorrectly tries to access `.value` on branded types, while other code uses improper type assertions.

## Problem Statement
Branded type usage issues:
1. Code attempting to access `.value` property (branded types are strings, not objects)
2. Inconsistent conversion between strings and branded types
3. Excessive use of 'as any' type assertions to bypass type checking
4. Missing helper functions for common branded type operations

## Acceptance Criteria
- [ ] No code attempts to access .value on branded types
- [ ] Consistent pattern for creating branded types from strings
- [ ] All 'as any' type assertions replaced with proper typing
- [ ] Helper functions created for common operations
- [ ] Type safety maintained throughout

## Required Changes

### Remove .value Accessor Attempts
Search for and fix all instances of:
```typescript
// WRONG
const name = symbolId.value;
const path = importType.value;

// CORRECT
const name = symbolId; // branded types ARE strings
const path = importType;
```

### Implement Consistent Conversion Pattern
```typescript
// Creating branded types
import { SymbolId, createSymbolId } from '@ariadnejs/types';

// WRONG
const id = someString as SymbolId;

// CORRECT
const id = createSymbolId(someString);
```

### Create Helper Functions
Add to packages/types/src/branded_utils.ts:
```typescript
export function isSymbolId(value: unknown): value is SymbolId {
  return typeof value === 'string' && value.length > 0;
}

export function symbolIdEquals(a: SymbolId, b: SymbolId): boolean {
  return a === b;
}

export function symbolIdToString(id: SymbolId): string {
  return id; // branded types are strings
}

// Similar helpers for Import, Export, etc.
```

### Fix Type Assertions
Replace all instances of:
```typescript
// WRONG
const symbolId = (someValue as any) as SymbolId;

// CORRECT
const symbolId = createSymbolId(validateString(someValue));
```

## Files to Update
- All modules using SymbolId, Import, Export branded types
- Focus on:
  - packages/core/src/symbol_resolution/
  - packages/core/src/import_resolution/
  - packages/core/src/export_detection/
  - packages/core/src/call_graph/
  - packages/core/src/type_tracking/

## Implementation Strategy
1. Create utility functions first
2. Search for .value accessor attempts and fix
3. Replace type assertions systematically
4. Update tests to use new patterns
5. Add lint rule to prevent .value access on branded types

## Testing
- No TypeScript errors related to branded type access
- All tests pass with proper type checking enabled
- No runtime errors from incorrect property access
- Lint rules catch incorrect patterns

## Notes
- This affects the entire codebase
- Consider adding ESLint rule to prevent .value access
- Document the correct patterns in contributing guide
- May require updating developer documentation