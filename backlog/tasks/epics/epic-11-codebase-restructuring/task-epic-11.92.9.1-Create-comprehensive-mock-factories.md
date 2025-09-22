# Task: Create Comprehensive Mock Factories

**Task ID**: task-epic-11.92.9.1
**Parent**: task-epic-11.92.9
**Status**: Pending
**Priority**: Critical
**Created**: 2025-01-22
**Estimated Effort**: 4 hours

## Summary

Create centralized, type-safe mock factory functions for all major types used in tests, reducing duplication and ensuring consistency across the test suite.

## Problem

Current issues with test mock data:
- Duplicated mock creation logic across test files
- Inconsistent mock structures
- Missing required properties
- Type safety issues
- Difficult to maintain when interfaces change

## Solution Design

Create three main factory modules:

1. **semantic_index_mocks.ts** - SemanticIndex and related types
2. **type_mocks.ts** - Type-related mocks (TypeId, TypeInfo, etc.)
3. **symbol_mocks.ts** - Symbol-related mocks (SymbolId, SymbolDefinition, etc.)

## Implementation

### 1. semantic_index_mocks.ts

```typescript
import type { SemanticIndex, LexicalScope, References, ... } from '@ariadnejs/types';

export function createMockSemanticIndex(
  overrides?: Partial<SemanticIndex>
): SemanticIndex {
  return {
    file_path: "test.ts" as FilePath,
    language: "typescript",
    root_scope_id: "scope_0" as ScopeId,
    scopes: new Map(),
    symbols: new Map(),
    references: createMockReferences(),
    imports: [],
    exports: [],
    file_symbols_by_name: new Map(),
    local_types: [],
    local_type_annotations: [],
    local_type_tracking: createMockTypeTracking(),
    local_type_flow: [],
    ...overrides
  };
}

export function createMockLexicalScope(
  overrides?: Partial<LexicalScope>
): LexicalScope {
  return {
    id: "scope_0" as ScopeId,
    parent_id: null,
    name: null,
    type: "module",
    location: createMockLocation(),
    child_ids: [],
    symbols: new Map(),
    ...overrides
  };
}

export function createMockReferences(
  overrides?: Partial<References>
): References {
  return {
    calls: [],
    returns: [],
    member_accesses: [],
    type_annotations: [],
    ...overrides
  };
}
```

### 2. type_mocks.ts

```typescript
import type { TypeId, TypeInfo, LocalTypeDefinition, ... } from '@ariadnejs/types';

export function createMockTypeId(name: string = "TestType"): TypeId {
  return `type_${name}` as TypeId;
}

export function createMockTypeInfo(
  overrides?: Partial<TypeInfo>
): TypeInfo {
  return {
    id: createMockTypeId(),
    name: "TestType" as SymbolName,
    category: TypeCategory.CLASS,
    location: createMockLocation(),
    members: new Map(),
    base_types: [],
    derived_types: [],
    ...overrides
  };
}

export function createMockLocalTypeDefinition(
  overrides?: Partial<LocalTypeDefinition>
): LocalTypeDefinition {
  return {
    name: "TestClass" as SymbolName,
    kind: "class",
    location: createMockLocation(),
    file_path: "test.ts" as FilePath,
    direct_members: new Map(),
    extends_names: [],
    implements_names: [],
    is_exported: false,
    generic_parameters: [],
    ...overrides
  };
}

export function createMockTypeRegistry(): GlobalTypeRegistry {
  return {
    types: new Map() as ReadonlyMap<TypeId, TypeInfo>,
    type_locations: new Map() as ReadonlyMap<TypeId, Location>,
    symbols_to_types: new Map() as ReadonlyMap<SymbolId, TypeId>,
  };
}
```

### 3. symbol_mocks.ts

```typescript
import type { SymbolId, SymbolDefinition, SymbolName, ... } from '@ariadnejs/types';

export function createMockSymbolId(name: string = "test_symbol"): SymbolId {
  return `sym_${name}` as SymbolId;
}

export function createMockSymbolDefinition(
  overrides?: Partial<SymbolDefinition>
): SymbolDefinition {
  return {
    id: createMockSymbolId(),
    name: "testSymbol" as SymbolName,
    kind: "variable",
    location: createMockLocation(),
    scope_id: "scope_0" as ScopeId,
    is_hoisted: false,
    is_exported: false,
    is_imported: false,
    ...overrides
  };
}

export function createMockLocation(
  overrides?: Partial<Location>
): Location {
  return {
    file_path: "test.ts" as FilePath,
    line: 1,
    column: 0,
    end_line: 1,
    end_column: 10,
    ...overrides
  };
}

// Builder pattern for complex mocks
export class MockSymbolBuilder {
  private symbol: SymbolDefinition;

  constructor() {
    this.symbol = createMockSymbolDefinition();
  }

  withName(name: string): this {
    this.symbol.name = name as SymbolName;
    this.symbol.id = createMockSymbolId(name);
    return this;
  }

  withKind(kind: SymbolKind): this {
    this.symbol.kind = kind;
    return this;
  }

  asExported(): this {
    this.symbol.is_exported = true;
    return this;
  }

  asImported(): this {
    this.symbol.is_imported = true;
    return this;
  }

  build(): SymbolDefinition {
    return { ...this.symbol };
  }
}
```

## Integration Steps

1. **Create the factory modules** (2 hours)
   - Implement all factory functions
   - Add comprehensive type coverage
   - Include builder patterns for complex types

2. **Add tests for factories** (1 hour)
   - Test factory functions
   - Verify type safety
   - Test builder patterns

3. **Create index export** (30 min)
   - Central export point
   - Documentation
   - Usage examples

4. **Update existing tests** (30 min)
   - Import factories in 2-3 test files
   - Replace inline mocks
   - Verify tests still pass

## Success Criteria

- [ ] All three factory modules created
- [ ] Comprehensive type coverage
- [ ] Factory tests passing
- [ ] At least 3 test files updated to use factories
- [ ] Documentation with examples
- [ ] No new TypeScript errors

## Files to Create

- `src/test_utils/mock_factories/semantic_index_mocks.ts`
- `src/test_utils/mock_factories/type_mocks.ts`
- `src/test_utils/mock_factories/symbol_mocks.ts`
- `src/test_utils/mock_factories/index.ts`
- `src/test_utils/mock_factories/mock_factories.test.ts`

## Testing

```bash
# Test the factories
npx vitest run src/test_utils/mock_factories/

# Verify integration
npm run build

# Run tests that use factories
npx vitest run
```

## Dependencies

This task blocks many others:
- task-epic-11.92.6.2 (SemanticIndex compliance)
- task-epic-11.92.8.1 (object literals)
- task-epic-11.92.8.2 (mock objects)
- task-epic-11.92.9.2 (test infrastructure)

## Notes

- Make factories composable
- Use builder pattern for complex objects
- Ensure type inference works well
- Consider performance for large mock data
- Document common usage patterns