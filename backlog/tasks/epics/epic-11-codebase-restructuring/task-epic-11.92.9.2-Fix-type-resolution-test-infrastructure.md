# Task: Fix type_resolution Test Infrastructure

**Task ID**: task-epic-11.92.9.2
**Parent**: task-epic-11.92.9
**Status**: Pending
**Priority**: Critical
**Created**: 2025-01-22
**Estimated Effort**: 3 hours

## Summary

Complete overhaul of test setup and mock data in type_resolution.comprehensive.test.ts, using new mock factories to ensure type compliance and fix the 77 compilation errors.

## Problem

The test file has fundamental infrastructure issues:
- Mock data doesn't match actual interfaces
- Test setup is inconsistent
- Helper functions are type-unsafe
- Massive duplication of mock creation
- 77 TypeScript errors concentrated here

## Current State Analysis

Major issues found:
1. Mock SemanticIndex objects missing required properties
2. Type assertions incorrect or missing
3. Test utilities not type-safe
4. Inconsistent test patterns
5. Mock data creation scattered throughout

## Solution Approach

1. **Refactor to use mock factories**
   ```typescript
   import {
     createMockSemanticIndex,
     createMockLocalTypeDefinition,
     createMockTypeRegistry
   } from '../../test_utils/mock_factories';

   // Replace inline mocks
   const index = createMockSemanticIndex({
     file_path: "test.ts" as FilePath,
     local_types: [type_def]
   });
   ```

2. **Create test-specific helpers**
   ```typescript
   function setupTypeResolutionTest() {
     const indices = new Map<FilePath, SemanticIndex>();
     const registry = createMockTypeRegistry();
     const imports = new Map() as ImportResolutionMap;

     return { indices, registry, imports };
   }
   ```

3. **Fix test patterns systematically**
   - Group related tests
   - Share setup code
   - Use consistent assertions

## Implementation Steps

1. **Audit current test structure** (30 min)
   - Map test groups
   - Identify shared patterns
   - List all mock types needed

2. **Create test-specific utilities** (1 hour)
   ```typescript
   // test_utils.ts for this test file
   export function createTypeResolutionTestContext() {
     // ...
   }

   export function createTestTypeDefinition(
     name: string,
     kind: "class" | "interface" | "type" | "enum"
   ): LocalTypeDefinition {
     return createMockLocalTypeDefinition({
       name: name as SymbolName,
       kind,
       file_path: "test.ts" as FilePath
     });
   }

   export function expectTypeResolution(
     actual: TypeResolutionMap,
     expected: Partial<TypeResolutionMap>
   ) {
     // Type-safe assertions
   }
   ```

3. **Refactor test groups** (1.5 hours)
   - Start with simplest tests
   - Apply factories consistently
   - Fix type issues as you go
   - Group by functionality

## Detailed Refactoring Plan

### Phase 1: Setup Functions
```typescript
describe('type_resolution', () => {
  let testContext: TypeResolutionTestContext;

  beforeEach(() => {
    testContext = createTypeResolutionTestContext();
  });

  describe('basic type resolution', () => {
    it('should resolve simple class type', () => {
      const classDef = createTestTypeDefinition('MyClass', 'class');
      const index = createMockSemanticIndex({
        local_types: [classDef]
      });

      testContext.indices.set("test.ts" as FilePath, index);

      const result = resolve_types(
        testContext.indices,
        testContext.imports
      );

      expectTypeResolution(result, {
        symbol_types: expect.any(Map),
        // ...
      });
    });
  });
});
```

### Phase 2: Fix Mock Data
- Replace all inline mock creation
- Use factories consistently
- Ensure all required properties

### Phase 3: Type Safety
- Add type annotations everywhere
- Remove unsafe assertions
- Fix function arguments

## Success Criteria

- [ ] Reduce errors from 77 to under 10
- [ ] All tests use mock factories
- [ ] Test utilities are type-safe
- [ ] Consistent test patterns
- [ ] Tests still validate correct behavior
- [ ] Documentation updated

## Files to Modify

- `src/symbol_resolution/type_resolution/type_resolution.comprehensive.test.ts`
- Create: `src/symbol_resolution/type_resolution/test_utils.ts`

## Testing

```bash
# Monitor error reduction
npm run build 2>&1 | grep "type_resolution.comprehensive" | wc -l

# Run tests
npx vitest run src/symbol_resolution/type_resolution/type_resolution.comprehensive.test.ts

# Verify no regressions
npx vitest run src/symbol_resolution/
```

## Dependencies

- Requires task-epic-11.92.9.1 (mock factories) completed first
- Benefits from task-epic-11.92.5.4 (ReadonlyMap utilities)
- Related to task-epic-11.92.6.4 (interface fixes)

## Notes

- This is the highest impact task (77 errors)
- Take systematic approach, don't rush
- Document any workarounds needed
- Consider splitting if too complex
- Preserve test coverage and intent