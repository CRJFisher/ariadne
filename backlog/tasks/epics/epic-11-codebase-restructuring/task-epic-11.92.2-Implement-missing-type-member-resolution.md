# Task: Implement Missing Type Member Resolution

**Task ID**: task-epic-11.92.2
**Parent**: task-epic-11.92
**Status**: Pending
**Priority**: Critical
**Created**: 2025-01-22
**Estimated Effort**: 2 days

## Executive Summary

The type member resolution system is the core of Phase 3 symbol resolution but is currently completely unimplemented. This task implements inheritance resolution, member merging, and complete type member lookup to enable method and constructor resolution in Phase 4.

## Current State

### Unimplemented Functions

#### 1. resolve_inheritance() - Returns Empty Data

**File**: `src/symbol_resolution/type_resolution/inheritance.ts`

```typescript
export function resolve_inheritance(
  type_definitions: Map<FilePath, LocalTypeDefinition[]>,
  type_registry: Map<string, TypeId>
): TypeHierarchyGraph {
  // TODO: Implement in later task - returning empty hierarchy for now
  return {
    extends_map: new Map(),
    implements_map: new Map(),
    all_descendants: new Map(),
    all_ancestors: new Map(),
  };
}
```

#### 2. resolve_type_members() - Returns Minimal Structure

**File**: `src/symbol_resolution/type_resolution/resolve_members.ts`

```typescript
export function resolve_type_members(
  type_id: TypeId,
  local_definition: LocalTypeDefinition,
  type_hierarchy: Map<TypeId, TypeId[]>
): ResolvedTypeDefinition {
  // TODO: Implement in later task - returning minimal structure for now
  return {
    type_id,
    name: local_definition.name,
    kind: local_definition.kind,
    location: local_definition.location,
    direct_members: local_definition.direct_members || new Map(),
    all_members: local_definition.direct_members || new Map(), // Wrong!
    inherited_members: new Map(), // Empty!
    parent_types: [], // Empty!
    child_types: [], // Empty!
  };
}
```

#### 3. Phase 3 Step 4 - Not Implemented

**File**: `src/symbol_resolution/symbol_resolution.ts:133-135`

```typescript
// Step 4: Resolve all type members including inherited
// TODO: resolve_type_members needs to be called for each type individually
// For now, return empty Map to avoid runtime errors
const resolved_members = new Map();
```

## Detailed Requirements

### TypeHierarchyGraph Structure

```typescript
interface TypeHierarchyGraph {
  // Direct relationships (single level)
  readonly extends_map: Map<TypeId, TypeId[]>;      // Child → Direct Parents
  readonly implements_map: Map<TypeId, TypeId[]>;   // Class → Direct Interfaces

  // Transitive closures (all levels)
  readonly all_ancestors: Map<TypeId, Set<TypeId>>; // Type → All Parents/Interfaces
  readonly all_descendants: Map<TypeId, Set<TypeId>>; // Type → All Children
}
```

### ResolvedTypeDefinition Structure

```typescript
interface ResolvedTypeDefinition {
  readonly type_id: TypeId;
  readonly name: SymbolName;
  readonly kind: "class" | "interface" | "type" | "enum";
  readonly location: Location;
  readonly direct_members: Map<SymbolName, LocalMemberInfo>;    // Own members only
  readonly all_members: Map<SymbolName, ResolvedMemberInfo>;    // Including inherited
  readonly inherited_members: Map<SymbolName, ResolvedMemberInfo>; // Inherited only
  readonly parent_types: TypeId[];  // Direct parents
  readonly child_types: TypeId[];   // Direct children
}
```

### LocalTypeDefinition Input Structure

```typescript
interface LocalTypeDefinition {
  readonly name: SymbolName;
  readonly kind: "class" | "interface" | "type" | "enum";
  readonly location: Location;
  readonly file_path: FilePath;
  readonly direct_members: Map<SymbolName, LocalMemberInfo>;
  readonly extends_names?: SymbolName[];     // e.g., ["BaseClass"]
  readonly implements_names?: SymbolName[];  // e.g., ["IDisposable", "ICloneable"]
}
```

## Implementation Design

### Algorithm 1: Inheritance Resolution

```typescript
function resolve_inheritance(
  type_definitions: Map<FilePath, LocalTypeDefinition[]>,
  type_registry: Map<string, TypeId>
): TypeHierarchyGraph {
  const extends_map = new Map<TypeId, TypeId[]>();
  const implements_map = new Map<TypeId, TypeId[]>();
  const all_ancestors = new Map<TypeId, Set<TypeId>>();
  const all_descendants = new Map<TypeId, Set<TypeId>>();

  // Phase 1: Build direct relationships
  for (const [file_path, defs] of type_definitions) {
    for (const def of defs) {
      const type_id = create_type_id(def);

      // Resolve extends clause
      if (def.extends_names?.length > 0) {
        const parents = resolve_type_names(def.extends_names, file_path, type_registry);
        if (parents.length > 0) {
          extends_map.set(type_id, parents);
        }
      }

      // Resolve implements clause
      if (def.implements_names?.length > 0) {
        const interfaces = resolve_type_names(def.implements_names, file_path, type_registry);
        if (interfaces.length > 0) {
          implements_map.set(type_id, interfaces);
        }
      }
    }
  }

  // Phase 2: Compute transitive closures
  for (const [type_id] of [...extends_map, ...implements_map]) {
    compute_ancestors_dfs(type_id, extends_map, implements_map, all_ancestors, new Set());
  }

  // Phase 3: Compute descendants (reverse of ancestors)
  for (const [descendant, ancestors] of all_ancestors) {
    for (const ancestor of ancestors) {
      if (!all_descendants.has(ancestor)) {
        all_descendants.set(ancestor, new Set());
      }
      all_descendants.get(ancestor)!.add(descendant);
    }
  }

  return { extends_map, implements_map, all_ancestors, all_descendants };
}
```

### Algorithm 2: Type Name Resolution

```typescript
function resolve_type_names(
  names: SymbolName[],
  current_file: FilePath,
  type_registry: Map<string, TypeId>
): TypeId[] {
  const resolved: TypeId[] = [];

  for (const name of names) {
    // Try different resolution strategies
    const type_id =
      // 1. Try exact match
      type_registry.get(name) ||
      // 2. Try file-scoped
      type_registry.get(`${current_file}:${name}`) ||
      // 3. Try imported name
      resolve_imported_type(name, current_file, type_registry);

    if (type_id) {
      resolved.push(type_id);
    }
  }

  return resolved;
}
```

### Algorithm 3: Circular Inheritance Detection

```typescript
function compute_ancestors_dfs(
  type_id: TypeId,
  extends_map: Map<TypeId, TypeId[]>,
  implements_map: Map<TypeId, TypeId[]>,
  all_ancestors: Map<TypeId, Set<TypeId>>,
  visiting: Set<TypeId>
): Set<TypeId> {
  // Check for circular inheritance
  if (visiting.has(type_id)) {
    console.warn(`Circular inheritance detected for ${type_id}`);
    return new Set();
  }

  // Return cached result if available
  if (all_ancestors.has(type_id)) {
    return all_ancestors.get(type_id)!;
  }

  visiting.add(type_id);
  const ancestors = new Set<TypeId>();

  // Process extends relationships
  const parents = extends_map.get(type_id) || [];
  for (const parent of parents) {
    ancestors.add(parent);
    const parent_ancestors = compute_ancestors_dfs(
      parent, extends_map, implements_map, all_ancestors, visiting
    );
    for (const ancestor of parent_ancestors) {
      ancestors.add(ancestor);
    }
  }

  // Process implements relationships
  const interfaces = implements_map.get(type_id) || [];
  for (const iface of interfaces) {
    ancestors.add(iface);
    const iface_ancestors = compute_ancestors_dfs(
      iface, extends_map, implements_map, all_ancestors, visiting
    );
    for (const ancestor of iface_ancestors) {
      ancestors.add(ancestor);
    }
  }

  visiting.delete(type_id);
  all_ancestors.set(type_id, ancestors);
  return ancestors;
}
```

### Algorithm 4: Member Resolution with Inheritance

```typescript
function resolve_type_members(
  type_id: TypeId,
  local_definition: LocalTypeDefinition,
  type_hierarchy: TypeHierarchyGraph,
  all_definitions: Map<TypeId, LocalTypeDefinition>
): ResolvedTypeDefinition {
  const direct_members = local_definition.direct_members || new Map();
  const all_members = new Map<SymbolName, ResolvedMemberInfo>();
  const inherited_members = new Map<SymbolName, ResolvedMemberInfo>();

  // Step 1: Add direct members (highest priority)
  for (const [name, info] of direct_members) {
    all_members.set(name, {
      ...info,
      symbol_id: info.symbol_id || create_member_symbol(name, type_id),
      source_type: type_id,
      is_inherited: false,
      is_override: check_if_override(name, type_hierarchy, type_id)
    });
  }

  // Step 2: Add inherited members (lower priority)
  const ancestors = type_hierarchy.all_ancestors.get(type_id) || new Set();

  // Process in inheritance order (nearest parents first)
  const ordered_ancestors = order_ancestors_by_distance(
    ancestors,
    type_hierarchy.extends_map.get(type_id) || [],
    type_hierarchy
  );

  for (const ancestor_id of ordered_ancestors) {
    const ancestor_def = all_definitions.get(ancestor_id);
    if (!ancestor_def) continue;

    for (const [name, info] of ancestor_def.direct_members || new Map()) {
      // Skip if already defined (overridden)
      if (!all_members.has(name)) {
        const resolved_member: ResolvedMemberInfo = {
          ...info,
          symbol_id: info.symbol_id || create_member_symbol(name, ancestor_id),
          source_type: ancestor_id,
          is_inherited: true,
          is_override: false
        };
        all_members.set(name, resolved_member);
        inherited_members.set(name, resolved_member);
      }
    }
  }

  return {
    type_id,
    name: local_definition.name,
    kind: local_definition.kind,
    location: local_definition.location,
    direct_members,
    all_members,
    inherited_members,
    parent_types: type_hierarchy.extends_map.get(type_id) || [],
    child_types: Array.from(type_hierarchy.all_descendants.get(type_id) || [])
  };
}
```

### Algorithm 5: Integration into Phase 3

```typescript
// In symbol_resolution.ts phase3_resolve_types()

// Step 4: Resolve all type members including inherited
const all_type_definitions = new Map<TypeId, LocalTypeDefinition>();
const resolved_members = new Map<TypeId, Map<SymbolName, ResolvedMemberInfo>>();

// Build TypeId -> LocalTypeDefinition map
for (const [file_path, defs] of local_extraction.type_definitions) {
  for (const def of defs) {
    const type_id = create_type_id(def);
    all_type_definitions.set(type_id, def);
  }
}

// Resolve members for each type
for (const [type_id, def] of all_type_definitions) {
  const resolved = resolve_type_members(
    type_id,
    def,
    type_hierarchy,
    all_type_definitions
  );
  resolved_members.set(type_id, resolved.all_members);
}

// Convert to required format
const type_members = new Map<TypeId, Map<SymbolName, SymbolId>>();
for (const [type_id, members] of resolved_members) {
  const member_ids = new Map<SymbolName, SymbolId>();
  for (const [name, info] of members) {
    member_ids.set(name, info.symbol_id);
  }
  type_members.set(type_id, member_ids);
}
```

## Edge Cases to Handle

### 1. Diamond Inheritance

```typescript
// A → B → D
// A → C → D
class D extends A {}
class B extends D {}
class C extends D {}
class A extends B, C {} // Diamond!
```

**Solution**: Use Set for ancestors to avoid duplicates. Process in BFS order for consistent resolution.

### 2. Circular Inheritance

```typescript
class A extends B {}
class B extends A {} // Circular!
```

**Solution**: Track visiting set during DFS. Return empty ancestors if cycle detected.

### 3. Missing Parent Types

```typescript
class Child extends NonExistentParent {} // Parent not found
```

**Solution**: Log warning and continue. Child will have no inherited members from missing parent.

### 4. Interface vs Class Inheritance

```typescript
interface I { method(): void; }
class Base { method() { return "base"; } }
class Derived extends Base implements I {}
```

**Solution**: Extends takes precedence over implements. Process extends before implements.

### 5. Multiple Interface Implementation

```typescript
interface IA { a(): void; }
interface IB { b(): void; }
interface IC { a(): void; } // Duplicate method name
class C implements IA, IB, IC {}
```

**Solution**: Merge interface members. If duplicate names, first interface wins.

## Testing Strategy

### Unit Tests

```typescript
describe("resolve_inheritance", () => {
  it("should build simple inheritance chain", () => {
    const defs = new Map([
      ["file.ts", [
        { name: "Base", kind: "class", direct_members: new Map([["method", {}]]) },
        { name: "Derived", kind: "class", extends_names: ["Base"], direct_members: new Map() }
      ]]
    ]);

    const result = resolve_inheritance(defs, create_test_registry());

    expect(result.extends_map.size).toBe(1);
    expect(result.all_ancestors.get("Derived")).toContain("Base");
  });

  it("should handle circular inheritance gracefully", () => {
    const defs = create_circular_inheritance_defs();

    expect(() => resolve_inheritance(defs, create_test_registry())).not.toThrow();
  });

  it("should resolve diamond inheritance correctly", () => {
    const defs = create_diamond_inheritance_defs();
    const result = resolve_inheritance(defs, create_test_registry());

    // Should not have duplicate ancestors
    const ancestors = result.all_ancestors.get("Bottom");
    expect(ancestors?.size).toBe(3); // Middle1, Middle2, Top (no duplicates)
  });
});
```

### Integration Tests

```typescript
describe("Phase 3 with member resolution", () => {
  it("should resolve complete inheritance hierarchy", () => {
    const indices = create_test_indices_with_complex_inheritance();
    const imports = phase1_resolve_imports(indices);
    const functions = phase2_resolve_functions(indices, imports);
    const types = phase3_resolve_types(indices, imports, functions);

    // Verify inheritance
    expect(types.inheritance_hierarchy.size).toBeGreaterThan(0);

    // Verify member resolution
    for (const [type_id, members] of types.type_members) {
      // Derived classes should have parent members
      const parent_types = types.inheritance_hierarchy.get(type_id);
      if (parent_types && parent_types.length > 0) {
        expect(members.size).toBeGreaterThan(0);
      }
    }
  });
});
```

### Performance Tests

```typescript
describe("Performance", () => {
  it("should handle deep inheritance efficiently", () => {
    // Create 50-level deep inheritance chain
    const deep_chain = create_deep_inheritance_chain(50);

    const start = performance.now();
    const result = resolve_inheritance(deep_chain, create_test_registry());
    const time = performance.now() - start;

    expect(time).toBeLessThan(100); // Should complete in < 100ms
    expect(result.all_ancestors.get("Level50")?.size).toBe(49);
  });

  it("should handle wide inheritance efficiently", () => {
    // Create 100 classes all inheriting from same base
    const wide_tree = create_wide_inheritance_tree(100);

    const start = performance.now();
    const result = resolve_inheritance(wide_tree, create_test_registry());
    const time = performance.now() - start;

    expect(time).toBeLessThan(100);
    expect(result.all_descendants.get("Base")?.size).toBe(100);
  });
});
```

## Success Criteria

### Functional Requirements

- ✅ resolve_inheritance returns complete TypeHierarchyGraph
- ✅ All extends relationships correctly resolved
- ✅ All implements relationships correctly resolved
- ✅ Transitive closures computed correctly
- ✅ Circular inheritance handled without crashes
- ✅ resolve_type_members returns complete ResolvedTypeDefinition
- ✅ Direct members included in all_members
- ✅ Inherited members correctly resolved
- ✅ Member overriding handled correctly
- ✅ Phase 3 Step 4 fully implemented

### Performance Requirements

- ✅ < 10ms per type for member resolution
- ✅ < 100ms for 1000-type hierarchy resolution
- ✅ < 1GB memory for 10,000 types

### Quality Requirements

- ✅ 100% test coverage for new code
- ✅ No TODO comments remaining
- ✅ Handles all edge cases documented

## Implementation Checklist

- [ ] Implement create_type_id utility function
- [ ] Implement resolve_type_names with import support
- [ ] Implement compute_ancestors_dfs with cycle detection
- [ ] Implement resolve_inheritance main function
- [ ] Implement create_member_symbol utility
- [ ] Implement check_if_override helper
- [ ] Implement order_ancestors_by_distance
- [ ] Implement resolve_type_members main function
- [ ] Integrate into phase3_resolve_types
- [ ] Add comprehensive unit tests
- [ ] Add integration tests
- [ ] Add performance tests
- [ ] Update documentation

## Dependencies

- **Prerequisite**: task-epic-11.92.1 (Interface compliance)
- **Prerequisite**: task-epic-11.92.3 (Type structure alignment)
- **Enables**: Phase 4 method resolution
- **Enables**: Constructor resolution
- **Enables**: Complete symbol resolution

## Risk Mitigation

### Risk: Complex Real-World Inheritance

**Mitigation**: Start with simple cases, incrementally add complexity. Test with real TypeScript stdlib types.

### Risk: Performance on Large Codebases

**Mitigation**: Implement caching for ancestry computation. Consider lazy evaluation for unused types.

### Risk: Language-Specific Semantics

**Mitigation**: Focus on TypeScript first, document limitations for other languages.

## References

- TypeScript Handbook: [Inheritance](https://www.typescriptlang.org/docs/handbook/2/classes.html#inheritance)
- ECMAScript: [Class Inheritance](https://tc39.es/ecma262/#sec-class-definitions)
- Design Patterns: Method Resolution Order (MRO) algorithms
- Original design: task-epic-11.91.2, task-epic-11.91.3