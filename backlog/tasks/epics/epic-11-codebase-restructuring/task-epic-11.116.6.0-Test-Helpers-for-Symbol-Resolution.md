# Task epic-11.116.6.0: Test Helpers for symbol_resolution Tests

**Status:** Not Started
**Parent:** task-epic-11.116.6
**Depends On:** 116.5.0
**Priority:** High (blocks 116.6.1-116.6.4)
**Estimated Effort:** 2 hours

## Objective

Extend test helpers to support symbol_resolution tests. These tests use semantic_index JSON as input and compare against resolved_symbols JSON.

## Additional Test Helpers

**Location:** `packages/core/tests/fixtures/test_helpers.ts` (extend existing)

### 1. load_resolved_symbols_fixture()

```typescript
export function load_resolved_symbols_fixture(path: string): ResolvedSymbolsFixture
```

### 2. deserialize_semantic_index()

```typescript
export function deserialize_semantic_index(json: SemanticIndexFixture): SemanticIndex
```

Converts JSON back to SemanticIndex with proper Maps and types.

### 3. compare_resolved_symbols()

```typescript
export function compare_resolved_symbols(
  actual: ResolvedSymbols,
  expected: ResolvedSymbolsFixture
): ComparisonResult
```

Validates:
- All definitions match
- All references match
- resolved_references mapping correct
- references_to_symbol mapping correct

### 4. serialize_resolved_symbols()

```typescript
export function serialize_resolved_symbols(resolved: ResolvedSymbols): ResolvedSymbolsFixture
```

### 5. Supporting Types

```typescript
export interface ResolvedSymbolsFixture {
  file_path: string;
  definitions: { [key: string]: DefinitionFixture };
  references: SymbolReferenceFixture[];
  resolved_references: { [key: string]: string }; // LocationKey → SymbolId
  references_to_symbol: { [key: string]: string[] }; // SymbolId → LocationKey[]
}
```

## Deliverables

- [ ] Extended helpers implemented
- [ ] Deserialization logic working
- [ ] Comparison validates all fields
- [ ] Ready for 116.6.1-116.6.4
