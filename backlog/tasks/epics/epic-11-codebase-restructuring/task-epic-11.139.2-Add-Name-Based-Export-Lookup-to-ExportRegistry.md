# Sub-task 139.2: Add Name-Based Export Lookup to ExportRegistry

**Parent Task**: task-epic-11.139
**Status**: Not Started
**Priority**: High
**Complexity**: Medium
**Estimated Effort**: 1-1.5 days

## Overview

Enhance ExportRegistry to support looking up exported definitions by name, enabling migration of namespace member resolution and export chain following.

**Why needed?**
- 🎯 Required by `build_type_context()` for namespace member lookup
- 🎯 Required by `resolve_export_chain()` for import resolution
- 🔄 Currently SemanticIndex has `exported_symbols: Map<SymbolName, ExportableDefinition>`
- ❌ ExportRegistry only tracks `Set<SymbolId>` (no name lookup)

## Current Problem

### Client Need #1: Namespace Member Resolution
**File**: `type_resolution/type_context.ts:324`

```typescript
// Get namespace member from source file
get_namespace_member(namespace_id: SymbolId, member_name: SymbolName): SymbolId | null {
  const source_file = namespace_sources.get(namespace_id);
  if (!source_file) return null;

  const source_index = indices.get(source_file);
  if (!source_index) return null;

  // Look up exported symbol by NAME
  const exported_def = source_index.exported_symbols.get(member_name);  // ← NEED THIS!
  return exported_def?.symbol_id || null;
}
```

**Usage**: `utils.helper()` where `utils` is namespace import → look up `helper` in utils.ts exports

---

### Client Need #2: Export Chain Resolution
**File**: `import_resolution/import_resolver.ts:180`

```typescript
function find_export(export_name: SymbolName, index: SemanticIndex): ExportInfo | null {
  const def = index.exported_symbols.get(export_name);  // ← NEED THIS!
  if (!def) return null;
  // ...
}
```

**Usage**: Following re-export chains like `export { foo } from './base'`

---

## Design Decision: Dependency on DefinitionRegistry

ExportRegistry needs definition metadata (name, kind) to support name lookup.

### Option A: Inject DefinitionRegistry (Recommended)
**ExportRegistry depends on DefinitionRegistry via parameter**

```typescript
class ExportRegistry {
  private exports: Map<FilePath, Set<SymbolId>> = new Map()

  /**
   * Get exported definition by name.
   * Requires DefinitionRegistry to resolve symbol_id → definition → name
   */
  get_export_by_name(
    file_id: FilePath,
    name: SymbolName,
    definitions: DefinitionRegistry  // ← INJECT DEPENDENCY
  ): AnyDefinition | undefined {
    const exported_ids = this.exports.get(file_id);
    if (!exported_ids) return undefined;

    // Search exported symbol_ids for matching name
    for (const symbol_id of exported_ids) {
      const def = definitions.get(symbol_id);
      if (def && def.name === name) {
        return def;
      }
    }

    return undefined;
  }
}
```

**Pros**:
- ✅ Clean separation of concerns (ExportRegistry doesn't own definitions)
- ✅ No data duplication
- ✅ Flexible (can use any DefinitionRegistry implementation)
- ✅ Follows dependency injection pattern

**Cons**:
- ❌ Caller must provide DefinitionRegistry
- ❌ API slightly more verbose

---

### Option B: Store DefinitionRegistry Reference
**ExportRegistry owns a reference to DefinitionRegistry**

```typescript
class ExportRegistry {
  private exports: Map<FilePath, Set<SymbolId>> = new Map()
  private definitions: DefinitionRegistry  // ← STORE REFERENCE

  constructor(definitions: DefinitionRegistry) {
    this.definitions = definitions;
  }

  get_export_by_name(
    file_id: FilePath,
    name: SymbolName
  ): AnyDefinition | undefined {
    const exported_ids = this.exports.get(file_id);
    if (!exported_ids) return undefined;

    for (const symbol_id of exported_ids) {
      const def = this.definitions.get(symbol_id);
      if (def && def.name === name) {
        return def;
      }
    }

    return undefined;
  }
}
```

**Pros**:
- ✅ Simpler API (no need to pass definitions every call)
- ✅ Cleaner caller code

**Cons**:
- ❌ Tight coupling (ExportRegistry depends on DefinitionRegistry)
- ❌ Harder to test in isolation
- ❌ Must be created AFTER DefinitionRegistry

---

### Option C: Cache Name Mappings
**ExportRegistry maintains its own name→symbol_id cache**

```typescript
class ExportRegistry {
  private exports: Map<FilePath, Set<SymbolId>> = new Map()
  private name_cache: Map<FilePath, Map<SymbolName, SymbolId>> = new Map()  // ← DUPLICATE DATA

  update_file(file_id: FilePath, exported_ids: Set<SymbolId>, definitions: DefinitionRegistry): void {
    this.exports.set(file_id, exported_ids);

    // Build name cache
    const name_map = new Map<SymbolName, SymbolId>();
    for (const symbol_id of exported_ids) {
      const def = definitions.get(symbol_id);
      if (def) {
        name_map.set(def.name, symbol_id);
      }
    }
    this.name_cache.set(file_id, name_map);
  }

  get_export_by_name(file_id: FilePath, name: SymbolName): SymbolId | undefined {
    return this.name_cache.get(file_id)?.get(name);
  }
}
```

**Pros**:
- ✅ O(1) lookup (very fast)
- ✅ No dependency in get method

**Cons**:
- ❌ Data duplication (name stored in both registries)
- ❌ Must rebuild cache on every update
- ❌ Memory overhead
- ❌ Synchronization complexity

---

## Recommended: Option A (Inject DefinitionRegistry)

**Rationale**:
1. Clean architecture - registries stay independent
2. No data duplication
3. Testable
4. Consistent with other registry patterns

**Trade-off**: Slightly more verbose caller code (must pass `definitions` parameter)

## API Design

### Primary Method

```typescript
/**
 * Get exported definition by name.
 *
 * Searches the file's exported symbols for one with a matching name.
 * Used for namespace member resolution and re-export chain following.
 *
 * Performance: O(n) where n = number of exports (typically small)
 * Future: Could add name→id cache if needed (currently not a bottleneck)
 *
 * @param file_id - The file containing the export
 * @param name - The exported symbol name to find
 * @param definitions - DefinitionRegistry to resolve symbol_id → definition
 * @returns The exported definition, or undefined if not found
 *
 * @example
 * ```typescript
 * // Look up exported function "helper" from utils.ts
 * const helper_def = exports.get_export_by_name(
 *   "src/utils.ts" as FilePath,
 *   "helper" as SymbolName,
 *   definitions
 * );
 *
 * if (helper_def) {
 *   console.log('Found export:', helper_def.symbol_id);
 * }
 * ```
 */
get_export_by_name(
  file_id: FilePath,
  name: SymbolName,
  definitions: DefinitionRegistry
): AnyDefinition | undefined
```

### Alternative: Return SymbolId Instead?

**Question**: Should we return `AnyDefinition` or just `SymbolId`?

```typescript
// Option 1: Return full definition
get_export_by_name(...): AnyDefinition | undefined

// Option 2: Return just ID
get_export_by_name_id(...): SymbolId | undefined
```

**Decision**: Return `AnyDefinition` (Option 1) because:
- Most callers need the definition anyway
- Avoids extra `definitions.get()` call by caller
- Matches SemanticIndex pattern (`exported_symbols.get()` returns definition)

### Helper Method: Get All Exported Definitions

**While we're here**, add method to get all exports as definitions:

```typescript
/**
 * Get all exported definitions from a file.
 *
 * @param file_id - The file to query
 * @param definitions - DefinitionRegistry to resolve symbol_ids
 * @returns Array of exported definitions (empty if file has no exports)
 */
get_exported_definitions(
  file_id: FilePath,
  definitions: DefinitionRegistry
): AnyDefinition[]
```

**Use case**: Listing all exports, debugging, analysis tools

## Implementation Plan

### Phase 1: Implement get_export_by_name (Day 1 AM)
**Duration**: 2-3 hours

```typescript
// In packages/core/src/project/export_registry.ts

get_export_by_name(
  file_id: FilePath,
  name: SymbolName,
  definitions: DefinitionRegistry
): AnyDefinition | undefined {
  const exported_ids = this.exports.get(file_id);
  if (!exported_ids) {
    return undefined;
  }

  // Linear search through exports
  // Typically small (< 50 exports per file), so O(n) is acceptable
  for (const symbol_id of exported_ids) {
    const def = definitions.get(symbol_id);

    // Match by name (case-sensitive)
    if (def && def.name === name) {
      return def;
    }
  }

  return undefined;
}
```

**Edge cases to handle**:
- File not in registry → return undefined
- Empty export set → return undefined
- Definition not found (orphaned symbol_id) → skip and continue
- Multiple exports with same name → return first match (shouldn't happen, but be defensive)

---

### Phase 2: Implement get_exported_definitions (Day 1 AM)
**Duration**: 1 hour

```typescript
get_exported_definitions(
  file_id: FilePath,
  definitions: DefinitionRegistry
): AnyDefinition[] {
  const exported_ids = this.exports.get(file_id);
  if (!exported_ids) {
    return [];
  }

  const result: AnyDefinition[] = [];

  for (const symbol_id of exported_ids) {
    const def = definitions.get(symbol_id);
    if (def) {
      result.push(def);
    }
  }

  return result;
}
```

---

### Phase 3: Write Unit Tests (Day 1 PM)
**Duration**: 3-4 hours

**File**: `export_registry.test.ts`

```typescript
import { ExportRegistry } from './export_registry';
import { DefinitionRegistry } from './definition_registry';
import { function_symbol, class_symbol, variable_symbol } from '@ariadnejs/types';

describe('ExportRegistry - Name-Based Lookup', () => {
  let exports: ExportRegistry;
  let definitions: DefinitionRegistry;

  beforeEach(() => {
    exports = new ExportRegistry();
    definitions = new DefinitionRegistry();
  });

  describe('get_export_by_name', () => {
    it('should find exported definition by name', () => {
      const file_id = 'utils.ts' as FilePath;

      // Setup definitions
      const helper = function_symbol('helper', file_id, {...});
      const util = variable_symbol('util', file_id, {...});

      definitions.update_file(file_id, [helper, util]);

      // Setup exports
      exports.update_file(file_id, new Set([helper.symbol_id, util.symbol_id]));

      // Look up by name
      const found = exports.get_export_by_name(file_id, 'helper' as SymbolName, definitions);

      expect(found).toBeDefined();
      expect(found?.symbol_id).toBe(helper.symbol_id);
      expect(found?.name).toBe('helper');
    });

    it('should return undefined for non-existent export', () => {
      const file_id = 'utils.ts' as FilePath;
      const helper = function_symbol('helper', file_id, {...});

      definitions.update_file(file_id, [helper]);
      exports.update_file(file_id, new Set([helper.symbol_id]));

      const found = exports.get_export_by_name(file_id, 'nonexistent' as SymbolName, definitions);

      expect(found).toBeUndefined();
    });

    it('should return undefined for file with no exports', () => {
      const file_id = 'empty.ts' as FilePath;

      exports.update_file(file_id, new Set());

      const found = exports.get_export_by_name(file_id, 'anything' as SymbolName, definitions);

      expect(found).toBeUndefined();
    });

    it('should return undefined for unknown file', () => {
      const found = exports.get_export_by_name(
        'unknown.ts' as FilePath,
        'foo' as SymbolName,
        definitions
      );

      expect(found).toBeUndefined();
    });

    it('should handle export with orphaned symbol_id gracefully', () => {
      const file_id = 'utils.ts' as FilePath;
      const helper = function_symbol('helper', file_id, {...});
      const orphan_id = 'function:deleted.ts:foo:1:0' as SymbolId;

      definitions.update_file(file_id, [helper]);
      exports.update_file(file_id, new Set([helper.symbol_id, orphan_id]));  // orphan_id not in definitions!

      // Should find helper despite orphaned ID
      const found = exports.get_export_by_name(file_id, 'helper' as SymbolName, definitions);

      expect(found).toBeDefined();
      expect(found?.symbol_id).toBe(helper.symbol_id);
    });

    it('should distinguish exports with same name in different files', () => {
      const file1 = 'a.ts' as FilePath;
      const file2 = 'b.ts' as FilePath;

      const helper1 = function_symbol('helper', file1, {...});
      const helper2 = function_symbol('helper', file2, {...});

      definitions.update_file(file1, [helper1]);
      definitions.update_file(file2, [helper2]);

      exports.update_file(file1, new Set([helper1.symbol_id]));
      exports.update_file(file2, new Set([helper2.symbol_id]));

      const found1 = exports.get_export_by_name(file1, 'helper' as SymbolName, definitions);
      const found2 = exports.get_export_by_name(file2, 'helper' as SymbolName, definitions);

      expect(found1?.symbol_id).toBe(helper1.symbol_id);
      expect(found2?.symbol_id).toBe(helper2.symbol_id);
      expect(found1?.symbol_id).not.toBe(found2?.symbol_id);
    });
  });

  describe('get_exported_definitions', () => {
    it('should return all exported definitions', () => {
      const file_id = 'utils.ts' as FilePath;

      const helper = function_symbol('helper', file_id, {...});
      const util = variable_symbol('util', file_id, {...});
      const Config = class_symbol('Config', file_id, {...});

      definitions.update_file(file_id, [helper, util, Config]);
      exports.update_file(file_id, new Set([helper.symbol_id, util.symbol_id, Config.symbol_id]));

      const exported_defs = exports.get_exported_definitions(file_id, definitions);

      expect(exported_defs).toHaveLength(3);
      expect(exported_defs.map(d => d.name).sort()).toEqual(['Config', 'helper', 'util']);
    });

    it('should return empty array for file with no exports', () => {
      const file_id = 'empty.ts' as FilePath;
      exports.update_file(file_id, new Set());

      const exported_defs = exports.get_exported_definitions(file_id, definitions);

      expect(exported_defs).toEqual([]);
    });

    it('should return empty array for unknown file', () => {
      const exported_defs = exports.get_exported_definitions(
        'unknown.ts' as FilePath,
        definitions
      );

      expect(exported_defs).toEqual([]);
    });

    it('should skip orphaned symbol_ids', () => {
      const file_id = 'utils.ts' as FilePath;
      const helper = function_symbol('helper', file_id, {...});
      const orphan_id = 'function:deleted.ts:foo:1:0' as SymbolId;

      definitions.update_file(file_id, [helper]);
      exports.update_file(file_id, new Set([helper.symbol_id, orphan_id]));

      const exported_defs = exports.get_exported_definitions(file_id, definitions);

      // Should only include helper (orphan skipped)
      expect(exported_defs).toHaveLength(1);
      expect(exported_defs[0].symbol_id).toBe(helper.symbol_id);
    });
  });
});
```

---

### Phase 4: Update Documentation (Day 1 PM)
**Duration**: 30 min

**Add JSDoc** (already shown in API Design section)
**Update ExportRegistry README section**
**Add usage examples**

## Performance Considerations

### Current: O(n) Linear Search
```typescript
for (const symbol_id of exported_ids) {
  const def = definitions.get(symbol_id);
  if (def && def.name === name) return def;
}
```

**Analysis**:
- Typical file has < 50 exports
- O(n) search is acceptable for n < 100
- Definition lookup is O(1) (Map.get)
- Total: O(n) with very small n

**Measurement**: Add benchmark in tests to confirm < 1ms for typical cases

### Future Optimization: Name Cache
**IF** profiling shows this is a bottleneck (unlikely), add cache:

```typescript
private name_cache: Map<FilePath, Map<SymbolName, SymbolId>> = new Map()

update_file(file_id: FilePath, exported_ids: Set<SymbolId>): void {
  this.exports.set(file_id, exported_ids);
  this.name_cache.delete(file_id);  // Invalidate cache
}

private build_name_cache(file_id: FilePath, definitions: DefinitionRegistry): Map<SymbolName, SymbolId> {
  const cache = new Map<SymbolName, SymbolId>();
  const exported_ids = this.exports.get(file_id) || new Set();

  for (const symbol_id of exported_ids) {
    const def = definitions.get(symbol_id);
    if (def) {
      cache.set(def.name, symbol_id);
    }
  }

  return cache;
}
```

**Decision**: Not implementing cache now. Add only if needed.

## Testing Strategy

### Unit Tests (Phase 3)
- ✅ Basic name lookup
- ✅ Not found cases
- ✅ Edge cases (orphaned IDs, empty exports, unknown files)
- ✅ Multiple files with same export name

### Performance Tests
```typescript
it('should handle large export sets efficiently', () => {
  const file_id = 'large.ts' as FilePath;

  // Create 100 exports
  const defs: AnyDefinition[] = [];
  const ids = new Set<SymbolId>();

  for (let i = 0; i < 100; i++) {
    const def = function_symbol(`func${i}`, file_id, {...});
    defs.push(def);
    ids.add(def.symbol_id);
  }

  definitions.update_file(file_id, defs);
  exports.update_file(file_id, ids);

  // Measure lookup time (worst case: last export)
  const start = performance.now();
  const found = exports.get_export_by_name(file_id, 'func99' as SymbolName, definitions);
  const time = performance.now() - start;

  expect(found).toBeDefined();
  expect(time).toBeLessThan(1);  // < 1ms for 100 exports
});
```

### Integration Tests (In 139.3)
- Will test when actually used by clients

## Acceptance Criteria

- [ ] `get_export_by_name()` implemented and tested
- [ ] `get_exported_definitions()` implemented and tested
- [ ] All unit tests passing (>95% coverage)
- [ ] Performance acceptable (< 1ms for typical files)
- [ ] JSDoc complete and accurate
- [ ] README updated with usage examples
- [ ] Edge cases handled gracefully

## Success Metrics

✅ Lookup works correctly for all test cases
✅ Performance acceptable (< 1ms for 100 exports)
✅ Zero regressions in existing ExportRegistry tests
✅ API is intuitive and easy to use

## Dependencies

**Prerequisites**:
- task-epic-11.138.8 (ExportRegistry exists)
- task-epic-11.138.8 (DefinitionRegistry exists)

**Enables**:
- 139.3 (migrate export lookups to use new method)

## Risks & Mitigations

### Risk: Performance with Large Export Sets
**Mitigation**: Benchmark tests, can add caching if needed

### Risk: Orphaned Symbol IDs
**Mitigation**: Defensive programming, skip invalid IDs

### Risk: API Verbosity
**Mitigation**: Consider Option B (store reference) if callers find it too verbose

## Future Work

After this sub-task:
- [ ] Consider name cache if profiling shows bottleneck
- [ ] Add method to get export by symbol_id (reverse lookup)
- [ ] Support wildcard/pattern matching for bulk lookups
