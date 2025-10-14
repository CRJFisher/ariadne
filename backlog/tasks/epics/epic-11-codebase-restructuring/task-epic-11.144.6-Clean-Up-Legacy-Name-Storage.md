# Task: Clean Up Legacy Name-Based Storage in TypeRegistry

**Epic**: Epic 11 - Codebase Restructuring
**Parent Task**: task-epic-11.144 - Merge TypeContext into TypeRegistry
**Status**: Deferred
**Priority**: Low
**Complexity**: Medium

## Overview

Remove legacy name-based storage from TypeRegistry now that all type information is stored as SymbolIds. Optimize the implementation and verify performance improvements.

## Context

TypeRegistry currently maintains **dual storage**:
1. **Name-based** (legacy): `type_bindings: Map<LocationKey, SymbolName>`
2. **SymbolId-based** (new): `symbol_types: Map<SymbolId, SymbolId>`

After completing tasks 11.144.1-5:
- All external APIs use SymbolId-based storage
- Name-based storage is only used during extraction phase
- We can potentially eliminate or minimize name-based storage

**Question to Answer:** Is name-based storage still needed anywhere?

Potential uses:
- During `resolve_type_metadata()` - reads type_bindings to know which symbols need resolution
- For debugging/introspection (get_all_type_bindings())
- For export metadata during symbol resolution

## Goals

1. Analyze whether name-based storage is still needed
2. Remove or minimize name-based storage if possible
3. Optimize storage and memory usage
4. Add performance benchmarks
5. Ensure all tests pass

## Implementation

### Phase 1: Analysis

**Check where name-based storage is used:**

```bash
# Find all references to type_bindings
grep -n "type_bindings" packages/core/src/project/type_registry.ts

# Find all references to type_members (name-based TypeMemberInfo)
grep -n "type_members\\.get\\|type_members\\.set" packages/core/src/project/type_registry.ts

# Check if get_all_type_bindings() is used
grep -r "get_all_type_bindings" packages/core/src --include="*.ts" | grep -v ".test.ts"
```

### Phase 2: Refactor resolve_type_metadata()

**Current approach:**
```typescript
// Reads from type_bindings
for (const loc_key of contributions.bindings) {
  const type_name = this.type_bindings.get(loc_key);
  // ... resolve type_name to type_id
}
```

**Option A: Keep name-based storage**
If name-based storage is needed (e.g., for incremental updates), keep it but document why.

**Option B: Transient name-based storage**
Extract names during update_file() but don't persist them:

```typescript
update_file(
  file_path: FilePath,
  index: SemanticIndex,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): void {
  // Phase 1: Remove old data
  this.remove_file(file_path);

  // Phase 2: Extract type metadata (names) - TRANSIENT
  const type_bindings = extract_type_bindings({
    variables: index.variables,
    functions: index.functions,
    classes: index.classes,
    interfaces: index.interfaces,
  });

  const type_bindings_from_ctors = extract_constructor_bindings(
    index.references
  );

  const merged_bindings = new Map([
    ...type_bindings,
    ...type_bindings_from_ctors,
  ]);

  const type_members = extract_type_members({
    classes: index.classes,
    interfaces: index.interfaces,
    enums: index.enums,
  });

  // Phase 3: Resolve immediately (don't store names)
  this.resolve_and_store(
    file_path,
    merged_bindings,
    type_members,
    definitions,
    resolutions
  );
}

/**
 * Resolve type metadata and store as SymbolIds.
 * Names are only used during this method - not persisted.
 */
private resolve_and_store(
  file_path: FilePath,
  type_bindings: Map<LocationKey, SymbolName>,
  type_members: Map<SymbolId, TypeMemberInfo>,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): void {
  const resolved_symbols = new Set<SymbolId>();

  // Resolve type bindings
  for (const [loc_key, type_name] of type_bindings) {
    const symbol_id = definitions.get_symbol_at_location(loc_key);
    if (!symbol_id) continue;

    const scope_id = definitions.get_symbol_scope(symbol_id);
    if (!scope_id) continue;

    const type_id = resolutions.resolve(scope_id, type_name);
    if (type_id) {
      this.symbol_types.set(symbol_id, type_id);
      resolved_symbols.add(symbol_id);
    }
  }

  // Resolve type members
  for (const [type_id, member_info] of type_members) {
    const member_map = definitions.get_type_members(type_id);
    if (member_map && member_map.size > 0) {
      this.resolved_type_members.set(type_id, member_map);
      resolved_symbols.add(type_id);
    }

    // Resolve inheritance
    if (member_info.extends && member_info.extends.length > 0) {
      const scope_id = definitions.get_symbol_scope(type_id);
      if (scope_id) {
        const resolved_parents: SymbolId[] = [];
        for (const parent_name of member_info.extends) {
          const parent_id = resolutions.resolve(scope_id, parent_name);
          if (parent_id) {
            resolved_parents.push(parent_id);
          }
        }

        if (resolved_parents.length > 0) {
          this.parent_classes.set(type_id, resolved_parents[0]);
          resolved_symbols.add(type_id);

          if (resolved_parents.length > 1) {
            this.implemented_interfaces.set(type_id, resolved_parents.slice(1));
          }
        }
      }
    }
  }

  // Track what this file contributed
  this.resolved_by_file.set(file_path, resolved_symbols);
}
```

### Phase 3: Remove Obsolete Methods

If name-based storage is removed, remove these methods:

```typescript
// Remove or mark as deprecated
get_all_type_bindings(): ReadonlyMap<LocationKey, SymbolName> {
  return this.type_bindings;
}

get_all_type_members(): ReadonlyMap<SymbolId, TypeMemberInfo> {
  return this.type_members;
}

get_type_binding(location_key: LocationKey): SymbolName | null {
  return this.type_bindings.get(location_key) || null;
}
```

Check if these are used anywhere:
```bash
grep -r "get_all_type_bindings\|get_all_type_members\|get_type_binding" packages/core/src --include="*.ts" | grep -v ".test.ts"
```

### Phase 4: Simplify Storage

**Before (dual storage):**
```typescript
private type_bindings: Map<LocationKey, SymbolName> = new Map();
private type_members: Map<SymbolId, TypeMemberInfo> = new Map();
private type_aliases: Map<SymbolId, SymbolName> = new Map();
private symbol_types: Map<SymbolId, SymbolId> = new Map();
private resolved_type_members: Map<SymbolId, Map<SymbolName, SymbolId>> = new Map();
private parent_classes: Map<SymbolId, SymbolId> = new Map();
private implemented_interfaces: Map<SymbolId, SymbolId[]> = new Map();
```

**After (SymbolId-based only):**
```typescript
// Remove if not needed:
// private type_bindings: Map<LocationKey, SymbolName> = new Map();
// private type_members: Map<SymbolId, TypeMemberInfo> = new Map();

// Keep only SymbolId-based storage:
private type_aliases: Map<SymbolId, SymbolName> = new Map();  // Keep? (for type expressions)
private symbol_types: Map<SymbolId, SymbolId> = new Map();
private resolved_type_members: Map<SymbolId, Map<SymbolName, SymbolId>> = new Map();
private parent_classes: Map<SymbolId, SymbolId> = new Map();
private implemented_interfaces: Map<SymbolId, SymbolId[]> = new Map();
```

### Phase 5: Update FileTypeContributions

Simplify tracking:

```typescript
// Before
interface FileTypeContributions {
  bindings: Set<LocationKey>;
  member_types: Set<SymbolId>;
  aliases: Set<SymbolId>;
  resolved_symbols: Set<SymbolId>;
}

// After (if name-based storage removed)
interface FileTypeContributions {
  resolved_symbols: Set<SymbolId>;  // Only track resolved SymbolIds
  aliases: Set<SymbolId>;
}
```

## Testing

### 1. Verify Functionality

All existing tests should still pass:

```bash
npm test --workspace=@ariadnejs/core -- type_registry.test.ts
npm test --workspace=@ariadnejs/core -- project.test.ts
```

### 2. Add Performance Benchmarks

Add benchmarks to verify memory and speed improvements:

```typescript
describe("TypeRegistry - Performance", () => {
  it("should handle large codebases efficiently", () => {
    const registry = new TypeRegistry();
    const definitions = new DefinitionRegistry();
    const resolutions = new ResolutionRegistry();

    // Create 1000 files with type annotations
    const file_count = 1000;
    const files: FilePath[] = [];

    for (let i = 0; i < file_count; i++) {
      const file = `file${i}.ts` as FilePath;
      const code = `
        class User${i} {
          method${i}() {}
        }
        const user${i}: User${i} = new User${i}();
      `;

      const index = index_single_file(file, code, "typescript");
      definitions.update_file(file, index);
      // ... populate resolutions ...

      const start = performance.now();
      registry.update_file(file, index, definitions, resolutions);
      const duration = performance.now() - start;

      // Should be fast (< 10ms per file)
      expect(duration).toBeLessThan(10);

      files.push(file);
    }

    // Verify memory usage is reasonable
    const stats = registry.get_stats();
    console.log(`TypeRegistry stats: ${JSON.stringify(stats)}`);
  });

  it("should have minimal memory overhead", () => {
    const registry = new TypeRegistry();
    // ... populate with test data ...

    // Check size of internal maps
    expect(registry['symbol_types'].size).toBeGreaterThan(0);
    expect(registry['resolved_type_members'].size).toBeGreaterThan(0);

    // If dual storage removed, these should not exist:
    // expect(registry['type_bindings']).toBeUndefined();
  });
});
```

### 3. Memory Profiling

Use Node.js memory profiling to verify improvements:

```bash
node --expose-gc --inspect packages/core/src/project/type_registry.test.ts
# Use Chrome DevTools to profile memory usage
```

## Decision Points

### Should We Keep Name-Based Storage?

**Keep if:**
- Needed for incremental updates (to know what changed)
- Used by other components during resolution
- Removal causes significant complexity

**Remove if:**
- Only used internally during update_file()
- Can be replaced with transient extraction
- No external dependencies

**Recommendation:** Start with Option B (transient storage) and verify all tests pass.

## Verification

After completing this task:

1. **Storage optimized**: Minimal or no name-based storage
2. **Tests pass**: All existing tests still work
3. **Performance measured**: Benchmarks show improvements
4. **Memory reduced**: Less memory usage per file
5. **Code cleaner**: Simpler implementation

## Success Criteria

- [ ] Analysis of name-based storage usage completed
- [ ] Decision made (keep, remove, or make transient)
- [ ] Implementation updated based on decision
- [ ] Obsolete methods removed
- [ ] Storage simplified
- [ ] All tests passing
- [ ] Performance benchmarks added
- [ ] Memory usage verified
- [ ] Documentation updated

## Notes

- This is an optimization task - be careful not to break functionality
- Measure before and after to verify improvements
- If removal causes issues, keep name-based storage and document why
- The key is to eliminate redundancy while maintaining correctness
- TypeRegistry should be as lean as possible

## Dependencies

- **Requires**: task-epic-11.144.5 completed (TypeContext deleted)
- **Blocks**: task-epic-11.144.7 (documentation of final architecture)

## Estimated Effort

- Analysis: 1 hour
- Implementation: 1.5-2 hours
- Testing & Benchmarking: 1-1.5 hours
- **Total**: 3.5-4.5 hours

## Deferral Decision

**Date**: 2025-10-14
**Reason for Deferral**: Non-critical optimization

### Analysis Summary

After completing tasks 11.144.1-5, an analysis was performed to determine if this optimization is necessary:

**Current State:**

- TypeRegistry maintains dual storage (name-based + SymbolId-based)
- Name-based storage is used internally during `extract_type_data()`
- External APIs exclusively use SymbolId-based storage

**External Usage Analysis:**

- Only `get_type_members()` is used externally by `Project.get_type_info()`
- All other external consumers use the new SymbolId-based methods
- Name-based data provides useful metadata during extraction phase

**Decision:**

- Keep current dual storage approach
- Name-based storage serves as intermediate representation during extraction
- No memory issues observed in current usage
- Can be revisited if profiling shows memory concerns

**Recommendation:**

- Defer until memory profiling indicates this is a bottleneck
- Focus on higher-priority tasks in Epic 11
- Document this decision for future reference

This task can be revisited in a future optimization pass if:

1. Memory profiling shows significant overhead from dual storage
2. TypeRegistry becomes a performance bottleneck
3. Codebase grows to scale where this matters
