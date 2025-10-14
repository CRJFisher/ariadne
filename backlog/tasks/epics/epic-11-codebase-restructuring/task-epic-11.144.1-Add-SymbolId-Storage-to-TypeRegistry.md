# Task: Add SymbolId Storage to TypeRegistry

**Epic**: Epic 11 - Codebase Restructuring
**Parent Task**: task-epic-11.144 - Merge TypeContext into TypeRegistry
**Status**: Not Started
**Priority**: High
**Complexity**: Medium

## Overview

Add new storage maps to TypeRegistry for SymbolId-based type information and implement the private `resolve_type_metadata()` method. Keep existing name-based storage temporarily for backward compatibility.

## Context

TypeRegistry currently stores type information as **names**:
- `type_bindings: Map<LocationKey, SymbolName>` - location → type name
- `type_members: Map<SymbolId, TypeMemberInfo>` - type → members (extends/implements as names)

We need to add **SymbolId-based storage** for resolved type information:
- Which symbol has which type (resolved)
- Which type has which members (resolved)
- Which class extends which parent (resolved)
- Which class implements which interfaces (resolved)

## Goals

1. Add new SymbolId-based storage maps
2. Implement private `resolve_type_metadata()` method
3. Keep existing name-based storage (don't break anything)
4. Add tests for resolution logic

## Implementation

### 1. Add New Storage Maps

Add to TypeRegistry class:

```typescript
export class TypeRegistry {
  // ===== Existing name-based storage (keep for now) =====
  private type_bindings: Map<LocationKey, SymbolName> = new Map();
  private type_members: Map<SymbolId, TypeMemberInfo> = new Map();
  private type_aliases: Map<SymbolId, SymbolName> = new Map();
  private by_file: Map<FilePath, FileTypeContributions> = new Map();

  // ===== NEW: SymbolId-based resolved storage =====

  /** Maps symbol → type (resolved). e.g., variable → class it's typed as */
  private symbol_types: Map<SymbolId, SymbolId> = new Map();

  /** Maps type → member name → member symbol (resolved) */
  private resolved_type_members: Map<SymbolId, Map<SymbolName, SymbolId>> = new Map();

  /** Maps class → parent class (resolved from extends clause) */
  private parent_classes: Map<SymbolId, SymbolId> = new Map();

  /** Maps class → implemented interfaces (resolved from implements/extends) */
  private implemented_interfaces: Map<SymbolId, SymbolId[]> = new Map();

  /** Track which file contributed resolved data (for cleanup) */
  private resolved_by_file: Map<FilePath, Set<SymbolId>> = new Map();

  // ... existing methods
}
```

### 2. Update FileTypeContributions

Add tracking for resolved data:

```typescript
interface FileTypeContributions {
  /** Location keys that have type bindings */
  bindings: Set<LocationKey>;

  /** Type SymbolIds that have members */
  member_types: Set<SymbolId>;

  /** Type alias SymbolIds */
  aliases: Set<SymbolId>;

  /** NEW: SymbolIds with resolved type information */
  resolved_symbols: Set<SymbolId>;
}
```

### 3. Implement resolve_type_metadata()

Add private method to resolve names → SymbolIds:

```typescript
/**
 * Resolve type metadata from names to SymbolIds.
 *
 * Process:
 * 1. Resolve type bindings: location → type_name → type_id
 * 2. Build member maps: type_id → member_name → member_id
 * 3. Resolve inheritance: type_id → parent_name → parent_id
 * 4. Resolve interfaces: type_id → interface_names → interface_ids
 *
 * This is called internally by update_file() after extraction.
 *
 * @param file_id - The file being processed
 * @param definitions - Definition registry for location/scope lookups
 * @param resolutions - Resolution registry for name → SymbolId lookups
 */
private resolve_type_metadata(
  file_id: FilePath,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): void {
  const contributions = this.by_file.get(file_id);
  if (!contributions) return;

  const resolved_symbols = new Set<SymbolId>();

  // STEP 1: Resolve type bindings (location → type_name → type_id)
  for (const loc_key of contributions.bindings) {
    // Get the symbol at this location (the variable/parameter being typed)
    const symbol_id = definitions.get_symbol_at_location(loc_key);
    if (!symbol_id) continue;

    // Get the type name from bindings
    const type_name = this.type_bindings.get(loc_key);
    if (!type_name) continue;

    // Get the scope where this symbol is defined
    const scope_id = definitions.get_symbol_scope(symbol_id);
    if (!scope_id) continue;

    // Resolve the type name to a type SymbolId
    const type_id = resolutions.resolve(scope_id, type_name);
    if (type_id) {
      this.symbol_types.set(symbol_id, type_id);
      resolved_symbols.add(symbol_id);
    }
  }

  // STEP 2: Build resolved member maps
  for (const type_id of contributions.member_types) {
    const member_info = this.type_members.get(type_id);
    if (!member_info) continue;

    // Get members directly from DefinitionRegistry (already SymbolIds)
    const member_map = definitions.get_type_members(type_id);
    if (member_map && member_map.size > 0) {
      this.resolved_type_members.set(type_id, member_map);
      resolved_symbols.add(type_id);
    }
  }

  // STEP 3: Resolve inheritance (extends clause)
  for (const type_id of contributions.member_types) {
    const member_info = this.type_members.get(type_id);
    if (!member_info || !member_info.extends || member_info.extends.length === 0) {
      continue;
    }

    // Get the scope where this type is defined
    const scope_id = definitions.get_symbol_scope(type_id);
    if (!scope_id) continue;

    // Resolve parent/interface names to SymbolIds
    const resolved_parents: SymbolId[] = [];
    for (const parent_name of member_info.extends) {
      const parent_id = resolutions.resolve(scope_id, parent_name);
      if (parent_id) {
        resolved_parents.push(parent_id);
      }
    }

    if (resolved_parents.length > 0) {
      // First is parent class, rest are interfaces
      this.parent_classes.set(type_id, resolved_parents[0]);
      resolved_symbols.add(type_id);

      if (resolved_parents.length > 1) {
        this.implemented_interfaces.set(type_id, resolved_parents.slice(1));
      }
    }
  }

  // Track what this file contributed
  this.resolved_by_file.set(file_id, resolved_symbols);
}
```

### 4. Add Cleanup for Resolved Data

Update `remove_file()` to clean up resolved data:

```typescript
remove_file(file_path: FilePath): void {
  // ... existing cleanup for name-based storage ...

  // NEW: Clean up resolved data
  const resolved_symbols = this.resolved_by_file.get(file_path);
  if (resolved_symbols) {
    for (const symbol_id of resolved_symbols) {
      this.symbol_types.delete(symbol_id);
      this.resolved_type_members.delete(symbol_id);
      this.parent_classes.delete(symbol_id);
      this.implemented_interfaces.delete(symbol_id);
    }
    this.resolved_by_file.delete(file_path);
  }
}
```

Update `clear()` to clear resolved data:

```typescript
clear(): void {
  // ... existing clears ...

  // NEW: Clear resolved data
  this.symbol_types.clear();
  this.resolved_type_members.clear();
  this.parent_classes.clear();
  this.implemented_interfaces.clear();
  this.resolved_by_file.clear();
}
```

## Testing

Add comprehensive tests for `resolve_type_metadata()`:

```typescript
describe("TypeRegistry - Resolution", () => {
  it("should resolve type bindings to SymbolIds", () => {
    const registry = new TypeRegistry();
    const definitions = new DefinitionRegistry();
    const resolutions = new ResolutionRegistry();

    // Setup: Create a variable with type annotation
    const file1 = "file1.ts" as FilePath;
    const code = `
      class User { }
      const user: User = new User();
    `;

    const index = index_single_file(file1, code, "typescript");

    // Populate registries
    definitions.update_file(file1, index);
    registry.update_file(file1, index); // Just extraction for now

    // Simulate resolution
    // ... populate resolutions registry ...

    // Resolve type metadata
    registry['resolve_type_metadata'](file1, definitions, resolutions);

    // Verify: user variable should have User type
    const user_symbol = /* get user variable symbol_id */;
    const user_type = registry['symbol_types'].get(user_symbol);
    expect(user_type).toBeDefined();
  });

  it("should resolve parent class relationships", () => {
    const registry = new TypeRegistry();
    const definitions = new DefinitionRegistry();
    const resolutions = new ResolutionRegistry();

    const file1 = "file1.ts" as FilePath;
    const code = `
      class Animal { }
      class Dog extends Animal { }
    `;

    // ... setup ...

    registry['resolve_type_metadata'](file1, definitions, resolutions);

    // Verify: Dog should have Animal as parent
    const dog_class = /* get Dog class symbol_id */;
    const parent = registry['parent_classes'].get(dog_class);
    expect(parent).toBeDefined();
    // expect parent to be Animal class symbol_id
  });

  it("should resolve implemented interfaces", () => {
    const registry = new TypeRegistry();
    const definitions = new DefinitionRegistry();
    const resolutions = new ResolutionRegistry();

    const file1 = "file1.ts" as FilePath;
    const code = `
      interface Flyable { }
      interface Swimmable { }
      class Duck implements Flyable, Swimmable { }
    `;

    // ... setup ...

    registry['resolve_type_metadata'](file1, definitions, resolutions);

    // Verify: Duck should implement both interfaces
    const duck_class = /* get Duck class symbol_id */;
    const interfaces = registry['implemented_interfaces'].get(duck_class);
    expect(interfaces).toHaveLength(2);
  });

  it("should clean up resolved data on remove_file", () => {
    const registry = new TypeRegistry();
    const file1 = "file1.ts" as FilePath;

    // ... populate with resolved data ...

    registry.remove_file(file1);

    // Verify all resolved data is gone
    expect(registry['resolved_by_file'].has(file1)).toBe(false);
  });
});
```

## Verification

After completing this task:

1. **Storage exists**: New maps are defined and initialized
2. **Resolution works**: `resolve_type_metadata()` correctly resolves names to SymbolIds
3. **Cleanup works**: `remove_file()` and `clear()` clean up resolved data
4. **Tests pass**: All new tests pass
5. **No breaking changes**: Existing functionality still works

## Success Criteria

- [ ] New SymbolId-based storage maps added
- [ ] `resolve_type_metadata()` implemented as private method
- [ ] Resolves type bindings (symbol → type)
- [ ] Resolves member maps (type → members)
- [ ] Resolves parent classes (class → parent)
- [ ] Resolves implemented interfaces (class → interfaces)
- [ ] `remove_file()` cleans up resolved data
- [ ] `clear()` clears resolved data
- [ ] Comprehensive tests added
- [ ] All tests passing

## Notes

- This task adds storage and resolution logic but doesn't integrate it yet
- Existing name-based storage remains unchanged (backward compatibility)
- Next task (11.144.2) will add TypeContext methods that use this storage
- The `resolve_type_metadata()` method is private - only called internally
- We use `DefinitionRegistry.get_type_members()` which returns SymbolIds directly

## Dependencies

- **Requires**: None (foundational task)
- **Blocks**: task-epic-11.144.2 (needs this storage for TypeContext methods)

## Estimated Effort

- Implementation: 1.5-2 hours
- Testing: 1-1.5 hours
- **Total**: 2.5-3.5 hours
