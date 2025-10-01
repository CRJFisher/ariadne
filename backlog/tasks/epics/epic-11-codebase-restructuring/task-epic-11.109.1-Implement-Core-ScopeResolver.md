# Task 11.109.1: Implement Core ScopeResolver

**Status:** Not Started
**Priority:** Critical
**Estimated Effort:** 3-4 days
**Parent:** task-epic-11.109
**Dependencies:** None (uses existing SemanticIndex)

## Objective

Implement the universal scope-walking algorithm that will be used by all symbol resolution phases. This is the **foundation** of the scope-aware architecture.

## Implementation

### File Structure

```
packages/core/src/resolve_references/
└── scope_resolver/
    ├── scope_resolver.ts
    └── scope_resolver.test.ts
```

### Core Interface

```typescript
export interface ScopeResolver {
  /**
   * Resolve a symbol name starting from a specific scope
   * Walks up the scope chain until a match is found
   */
  resolve_in_scope(name: SymbolName, scope_id: ScopeId): SymbolId | null;

  /**
   * Get all visible symbols at a scope (for debugging/testing)
   */
  get_visible_symbols(scope_id: ScopeId): ReadonlyMap<SymbolName, SymbolId>;
}

export function create_scope_resolver(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ImportMap
): ScopeResolver;
```

### Algorithm

```typescript
function resolve_in_scope(
  name: SymbolName,
  scope_id: ScopeId
): SymbolId | null {
  // Extract file path from scope_id
  const file_path = extract_file_path_from_scope_id(scope_id);
  const index = indices.get(file_path);

  let current_scope_id: ScopeId | null = scope_id;

  // Walk up the scope chain
  while (current_scope_id !== null) {
    const scope = index.scopes.get(current_scope_id);

    // 1. Check for definitions in this scope
    const candidates = index.symbols_by_name.get(name) || [];
    for (const symbol_id of candidates) {
      const definition = find_definition(symbol_id, index);
      if (definition && definition.scope_id === current_scope_id) {
        return symbol_id; // Found - shadows everything outer
      }
    }

    // 2. At module scope, check imports
    if (current_scope_id === index.root_scope_id) {
      const file_imports = imports.get(file_path);
      const imported_symbol = file_imports?.get(name);
      if (imported_symbol) {
        return imported_symbol;
      }
    }

    // 3. Move to parent scope
    current_scope_id = scope.parent_id;
  }

  return null;
}
```

## Test Coverage

### Unit Tests (`scope_resolver.test.ts`)

Test cases:

1. **Basic resolution** - Find symbol in same scope
2. **Parent scope resolution** - Find symbol in parent scope
3. **Shadowing** - Inner scope shadows outer scope
4. **Import visibility** - Imports visible at module scope only
5. **Import shadowing** - Local definition shadows import
6. **Nested shadowing** - Multiple levels of shadowing
7. **Not found** - Return null when symbol doesn't exist
8. **Cross-file** - Resolve symbols from different files

### Test Fixtures

Create minimal test fixtures:

- Simple nested scopes
- Import + local definition
- Multiple shadowing levels
- All 4 languages (JS/TS/Python/Rust)

## Helper Functions

```typescript
/**
 * Extract file path from scope_id
 * Format: "type:file_path:line:column:end_line:end_column"
 */
function extract_file_path_from_scope_id(scope_id: ScopeId): FilePath;

/**
 * Find definition across all definition maps
 */
function find_definition(
  symbol_id: SymbolId,
  index: SemanticIndex
): { scope_id: ScopeId } | null;
```

## Success Criteria

### Functional

- ✅ `resolve_in_scope` correctly walks scope chain
- ✅ Local definitions shadow outer definitions
- ✅ Imports only visible at module scope
- ✅ Returns null when symbol not found
- ✅ `get_visible_symbols` returns complete symbol table

### Testing

- ✅ 100% code coverage for `scope_resolver.ts`
- ✅ All test cases pass for all languages
- ✅ Edge cases (shadowing, imports) covered

### Code Quality

- ✅ Pythonic naming convention
- ✅ Full JSDoc documentation
- ✅ Clear error messages
- ✅ No performance regressions
- ✅ Type-safe (no `any` types)

## Technical Notes

### ScopeId Format

```
Format: "type:file_path:line:column:end_line:end_column"
Example: "function:src/utils.ts:10:0:20:1"
```

### Performance

- Scope walking is O(depth) - typically 3-5 iterations
- `symbols_by_name` provides O(1) candidate lookup
- No memoization needed for initial implementation

### Definition Lookup Order

Check these maps in order:

1. `index.functions`
2. `index.classes`
3. `index.variables`
4. `index.interfaces`
5. `index.enums`
6. `index.namespaces`
7. `index.types`
8. `index.imported_symbols`

## Dependencies

**Uses (already available):**

- `SemanticIndex` with scope trees
- `LexicalScope` interface
- `SymbolDefinition` types
- `symbols_by_name` quick lookup

**Requires from 11.109.2:**

- `ImportMap` type (can stub for now)

## Next Steps

After completion:

- Task 11.109.2 will use this for import resolution
- Tasks 11.109.4-6 will use this for call resolution
- This becomes the **single source of truth** for name lookups
