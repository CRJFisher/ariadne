# Task: Fix Integration Test Infrastructure

**Task ID**: task-epic-11.92.9.4
**Parent**: task-epic-11.92.9
**Status**: Pending
**Priority**: High
**Created**: 2025-01-22
**Estimated Effort**: 3 hours

## Summary

Update integration test helpers and utilities across all files in integration_tests/ directory to fix type mismatches and missing properties.

## Problem

Integration tests have various infrastructure issues:
- `end_to_end.test.ts`: 6 errors
- `performance.test.ts`: 3 errors
- `cross_language.test.ts`: 2 errors
- `symbol_resolution_fixes.test.ts`: 1 error

Common issues:
- Mock data doesn't match production types
- Test utilities are outdated
- Helper functions have type mismatches

## Affected Files Analysis

### end_to_end.test.ts (6 errors)
- Lines 60, 245, 273, 359, 481, 505
- Type mismatches in test data
- Missing properties in mock objects

### performance.test.ts (3 errors)
- Lines 81, 179, 331
- Performance measurement setup issues
- Mock data size/structure problems

### cross_language.test.ts (2 errors)
- Lines 572, 583
- Language-specific mock data issues

### symbol_resolution_fixes.test.ts (1 error)
- Line 75
- Single type mismatch

## Solution Approach

1. **Create shared integration test utilities**
   ```typescript
   // integration_tests/test_utils.ts
   export function createIntegrationTestContext() {
     return {
       indices: new Map<FilePath, SemanticIndex>(),
       imports: new Map() as ImportResolutionMap,
       functions: new Map() as FunctionResolutionMap,
       types: createMockTypeResolutionMap(),
       methods: new Map() as MethodResolutionMap
     };
   }

   export function createMultiFileProject(
     files: Array<{ path: string; content: string; language: Language }>
   ): Map<FilePath, SemanticIndex> {
     // Parse and create indices for multiple files
   }

   export function measurePerformance<T>(
     name: string,
     fn: () => T
   ): { result: T; duration: number } {
     const start = performance.now();
     const result = fn();
     const duration = performance.now() - start;
     return { result, duration };
   }
   ```

2. **Fix language-specific helpers**
   ```typescript
   export function createCrossLanguageTestData() {
     return {
       javascript: createMockSemanticIndex({ language: 'javascript' }),
       typescript: createMockSemanticIndex({ language: 'typescript' }),
       python: createMockSemanticIndex({ language: 'python' }),
       rust: createMockSemanticIndex({ language: 'rust' })
     };
   }
   ```

3. **Update test patterns**
   - Use consistent setup across all integration tests
   - Share common utilities
   - Ensure type safety

## Implementation Steps

1. **Create shared utilities** (1 hour)
   - Integration test context
   - Multi-file project helpers
   - Performance utilities
   - Cross-language helpers

2. **Fix end_to_end.test.ts** (45 min)
   - Update all 6 error locations
   - Use shared utilities
   - Fix type mismatches

3. **Fix performance.test.ts** (30 min)
   - Update performance measurement
   - Fix mock data generation
   - Use proper types

4. **Fix cross_language.test.ts** (30 min)
   - Update language-specific mocks
   - Fix type issues
   - Ensure consistency

5. **Fix symbol_resolution_fixes.test.ts** (15 min)
   - Single fix needed
   - Update to match current types

## Detailed Fixes

### Integration Test Context
```typescript
// integration_tests/test_utils.ts
import {
  createMockSemanticIndex,
  createMockTypeRegistry,
  createMockSymbolDefinition
} from '../test_utils/mock_factories';

export interface IntegrationTestContext {
  indices: Map<FilePath, SemanticIndex>;
  imports: ImportResolutionMap;
  functions: FunctionResolutionMap;
  types: TypeResolutionMap;
  methods: MethodResolutionMap;
}

export function createIntegrationTestContext(
  overrides?: Partial<IntegrationTestContext>
): IntegrationTestContext {
  return {
    indices: new Map(),
    imports: new Map() as ImportResolutionMap,
    functions: new Map() as FunctionResolutionMap,
    types: {
      symbol_types: new Map() as ReadonlyMap<SymbolId, TypeId>,
      reference_types: new Map() as ReadonlyMap<LocationKey, TypeId>,
      type_members: new Map() as ReadonlyMap<TypeId, ReadonlyMap<SymbolName, SymbolId>>,
      constructors: new Map() as ReadonlyMap<TypeId, SymbolId>,
      inheritance_hierarchy: new Map() as ReadonlyMap<TypeId, readonly TypeId[]>,
      interface_implementations: new Map() as ReadonlyMap<TypeId, readonly TypeId[]>
    },
    methods: new Map() as MethodResolutionMap,
    ...overrides
  };
}
```

### Performance Test Helper
```typescript
export interface PerformanceResult<T> {
  result: T;
  duration: number;
  memoryUsed?: number;
}

export function measurePerformance<T>(
  name: string,
  fn: () => T,
  options?: { measureMemory?: boolean }
): PerformanceResult<T> {
  const startMemory = options?.measureMemory
    ? process.memoryUsage().heapUsed
    : 0;
  const startTime = performance.now();

  const result = fn();

  const duration = performance.now() - startTime;
  const memoryUsed = options?.measureMemory
    ? process.memoryUsage().heapUsed - startMemory
    : undefined;

  console.log(`${name}: ${duration.toFixed(2)}ms${
    memoryUsed ? `, ${(memoryUsed / 1024 / 1024).toFixed(2)}MB` : ''
  }`);

  return { result, duration, memoryUsed };
}
```

## Success Criteria

- [ ] All 12 integration test errors resolved
- [ ] Shared utilities created and documented
- [ ] Consistent patterns across integration tests
- [ ] Performance tests properly measure metrics
- [ ] Cross-language tests handle all 4 languages
- [ ] No new errors introduced

## Files to Create/Modify

- Create: `src/symbol_resolution/integration_tests/test_utils.ts`
- Modify: `src/symbol_resolution/integration_tests/end_to_end.test.ts`
- Modify: `src/symbol_resolution/integration_tests/performance.test.ts`
- Modify: `src/symbol_resolution/integration_tests/cross_language.test.ts`
- Modify: `src/symbol_resolution/integration_tests/symbol_resolution_fixes.test.ts`

## Testing

```bash
# Verify compilation
npm run build

# Run all integration tests
npx vitest run src/symbol_resolution/integration_tests/

# Check performance tests specifically
npx vitest run src/symbol_resolution/integration_tests/performance.test.ts
```

## Dependencies

- Requires task-epic-11.92.9.1 (mock factories)
- Benefits from other test infrastructure tasks

## Notes

- Integration tests are critical for confidence
- Ensure performance measurements are accurate
- Document any changes to test behavior
- Consider CI implications of performance tests