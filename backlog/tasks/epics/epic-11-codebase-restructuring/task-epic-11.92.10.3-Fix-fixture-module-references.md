# Task: Fix Fixture Module References

**Task ID**: task-epic-11.92.10.3
**Parent**: task-epic-11.92.10
**Status**: Pending
**Priority**: Medium
**Created**: 2025-01-22
**Estimated Effort**: 1.5 hours

## Summary

Fix module reference errors in TypeScript test fixtures where the fixture code references non-existent modules for testing purposes.

## Problem

In `definitions/fixtures/typescript/comprehensive_definitions.ts`:
- Line 302: TS2307 - Cannot find module './other-module'
- Line 303: TS2307 - Cannot find module './specific-module'

These are test fixtures that import non-existent modules, causing compilation errors.

## Context

This is a test fixture file used to test TypeScript parsing and analysis. The imports are intentionally testing import handling, but TypeScript compiler still reports them as errors.

## Solution Options

### Option A: Create Stub Modules
Create minimal stub files that satisfy the imports:
```typescript
// fixtures/typescript/other-module.ts
export const dummy = true;

// fixtures/typescript/specific-module.ts
export function specificFunction() {}
export class SpecificClass {}
```

### Option B: Use Type-Only Imports
Change to type-only imports if testing type imports:
```typescript
// Instead of
import { Something } from './other-module';

// Use
import type { Something } from './other-module';
// With ambient declaration
declare module './other-module' {
  export interface Something {}
}
```

### Option C: Disable TypeScript Checking
Add TypeScript ignore comments:
```typescript
// @ts-ignore - Intentional missing module for testing
import { Something } from './other-module';
```

### Option D: Use Module Declarations
Add ambient module declarations:
```typescript
// At top of file or in separate .d.ts
declare module './other-module' {
  export const value: string;
}

declare module './specific-module' {
  export function specificFunction(): void;
  export class SpecificClass {}
}
```

## Implementation Steps

1. **Analyze fixture purpose** (20 min)
   - Review what the fixture is testing
   - Determine if imports need to be real
   - Check test expectations

2. **Choose appropriate solution** (10 min)
   - If testing import parsing: use stubs
   - If testing type imports: use declarations
   - If modules don't matter: use @ts-ignore

3. **Implement fix** (30 min)
   - Create stubs/declarations as needed
   - Update fixture if necessary
   - Ensure tests still work

4. **Verify tests** (30 min)
   - Run semantic index tests
   - Verify fixture parsing still works
   - Check no test regressions

## Recommended Solution: Create Stub Modules

```typescript
// src/semantic_index/definitions/fixtures/typescript/other-module.ts
/**
 * Stub module for comprehensive_definitions.ts fixture
 * This file exists only to satisfy TypeScript imports in test fixtures
 */
export const testValue = 'test';
export function testFunction() {
  return 'test';
}
export class TestClass {
  method() {
    return 'test';
  }
}
export interface TestInterface {
  prop: string;
}
export type TestType = string | number;

// src/semantic_index/definitions/fixtures/typescript/specific-module.ts
/**
 * Stub module for comprehensive_definitions.ts fixture
 */
export function specificFunction() {
  return 'specific';
}
export class SpecificClass {
  specificMethod() {
    return 'specific';
  }
}
export const { destructured } = { destructured: 'value' };
export default class DefaultClass {}
```

## Alternative: Module Declarations

```typescript
// src/semantic_index/definitions/fixtures/typescript/module-stubs.d.ts
declare module './other-module' {
  export const testValue: string;
  export function testFunction(): string;
  export class TestClass {
    method(): string;
  }
  export interface TestInterface {
    prop: string;
  }
  export type TestType = string | number;
}

declare module './specific-module' {
  export function specificFunction(): string;
  export class SpecificClass {
    specificMethod(): string;
  }
  export const destructured: string;
  export default class DefaultClass {}
}
```

## Success Criteria

- [ ] Both TS2307 errors resolved
- [ ] Fixture still serves its testing purpose
- [ ] No test regressions
- [ ] Solution documented for future reference
- [ ] Build passes without errors

## Files to Create/Modify

- Modify: `src/semantic_index/definitions/fixtures/typescript/comprehensive_definitions.ts` (potentially)
- Create: `src/semantic_index/definitions/fixtures/typescript/other-module.ts`
- Create: `src/semantic_index/definitions/fixtures/typescript/specific-module.ts`
- Or create: `src/semantic_index/definitions/fixtures/typescript/module-stubs.d.ts`

## Testing

```bash
# Verify compilation
npm run build

# Run definition extraction tests
npx vitest run src/semantic_index/definitions/

# Verify fixture still works correctly
npx vitest run -t "comprehensive_definitions"
```

## Dependencies

None - isolated to test fixtures

## Notes

- These are test fixtures, not production code
- Solution should be minimal - just enough to satisfy TypeScript
- Document why these stub modules exist
- Consider if fixtures should be excluded from TypeScript checking