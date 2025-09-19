# Task: Move type_registry to symbol_resolution

**Task ID**: task-epic-11.90.3
**Parent**: task-epic-11.90
**Status**: Created
**Priority**: Critical
**Created**: 2024-01-19
**Estimated Effort**: 6 hours

## Objective

Move the entire `semantic_index/type_registry` module to `symbol_resolution/type_resolution/type_registry` since it requires cross-file information that's only available after symbol resolution.

## Current Problem

The type_registry in semantic_index attempts to:

1. Generate TypeIds (which require definition locations from other files)
2. Map types across module boundaries
3. Track global type relationships
4. Resolve type references before imports are resolved

These operations violate the single-file analysis principle of semantic_index.

## Implementation Plan

### 1. Create New Location

```bash
mkdir -p packages/core/src/symbol_resolution/type_resolution
```

### 2. Move and Refactor type_registry.ts

```typescript
// packages/core/src/symbol_resolution/type_resolution/type_registry.ts

import type {
  TypeId,
  SymbolId,
  Location,
  FilePath,
  SymbolName,
} from "@ariadnejs/types";
import type { ImportResolutionMap } from "../types";
import type { LocalTypeMembers } from "../../semantic_index/type_members";

export interface GlobalTypeRegistry {
  // Type definitions with resolved TypeIds
  readonly types: Map<TypeId, TypeDefinition>;

  // Type name to TypeId mapping (per file to handle scoping)
  readonly type_names: Map<FilePath, Map<SymbolName, TypeId>>;

  // Type hierarchy (inheritance relationships)
  readonly type_hierarchy: Map<TypeId, TypeHierarchy>;

  // Type to constructor mapping
  readonly constructors: Map<TypeId, SymbolId>;
}

export interface TypeDefinition {
  readonly type_id: TypeId;
  readonly name: SymbolName;
  readonly kind: "class" | "interface" | "type" | "enum";
  readonly definition_location: Location;
  readonly file_path: FilePath;
  readonly members: Map<SymbolName, MemberDefinition>;
}

export interface TypeHierarchy {
  readonly base_types: TypeId[]; // Direct parents
  readonly derived_types: TypeId[]; // Direct children
  readonly all_ancestors: TypeId[]; // Transitive closure up
  readonly all_descendants: TypeId[]; // Transitive closure down
}

/**
 * Build the global type registry after imports are resolved
 */
export function build_global_type_registry(
  local_types: Map<FilePath, LocalTypeMembers[]>,
  resolved_imports: ImportResolutionMap
): GlobalTypeRegistry {
  const registry: GlobalTypeRegistry = {
    types: new Map(),
    type_names: new Map(),
    type_hierarchy: new Map(),
    constructors: new Map(),
  };

  // Phase 1: Create TypeIds for all type definitions
  for (const [file_path, types] of local_types) {
    for (const type of types) {
      const type_id = defined_type_id(
        type.kind as any,
        type.type_name,
        type.location
      );

      // Add to registry
      registry.types.set(type_id, {
        type_id,
        name: type.type_name,
        kind: type.kind,
        definition_location: type.location,
        file_path,
        members: new Map(), // Will be filled in Phase 3
      });

      // Add to name mapping
      if (!registry.type_names.has(file_path)) {
        registry.type_names.set(file_path, new Map());
      }
      registry.type_names.get(file_path)!.set(type.type_name, type_id);
    }
  }

  // Phase 2: Resolve inheritance relationships
  for (const [file_path, types] of local_types) {
    for (const type of types) {
      const type_id = registry.type_names.get(file_path)?.get(type.type_name);
      if (!type_id) continue;

      const hierarchy = resolve_type_hierarchy(
        type,
        file_path,
        registry,
        resolved_imports
      );

      registry.type_hierarchy.set(type_id, hierarchy);
    }
  }

  // Phase 3: Build complete member maps with inheritance
  resolve_all_members(registry, local_types);

  return registry;
}
```

### 3. Remove Old Location

```bash
rm -rf packages/core/src/semantic_index/type_registry
```

### 4. Update Imports

Find and update all imports:

```typescript
// OLD
import { TypeRegistry } from "../semantic_index/type_registry";

// NEW
import { GlobalTypeRegistry } from "../symbol_resolution/type_resolution/type_registry";
```

### 5. Wire into Symbol Resolution Phase 3

```typescript
// In symbol_resolution.ts
function phase3_resolve_types(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ImportResolutionMap,
  functions: FunctionResolutionMap
): TypeResolutionMap {
  // Collect local types from all semantic indices
  const local_types = new Map<FilePath, LocalTypeMembers[]>();
  for (const [file_path, index] of indices) {
    local_types.set(file_path, index.type_members);
  }

  // Build global registry with cross-file resolution
  const type_registry = build_global_type_registry(local_types, imports);

  // ... rest of type resolution
}
```

## Testing Strategy

### Unit Tests

```typescript
describe("build_global_type_registry", () => {
  it("should generate TypeIds with definition locations", () => {
    const local_types = new Map([
      [
        "file1.ts",
        [
          {
            type_name: "MyClass",
            kind: "class",
            location: mockLocation,
            direct_members: new Map(),
          },
        ],
      ],
    ]);

    const registry = build_global_type_registry(local_types, imports);

    const type_id = registry.type_names.get("file1.ts")?.get("MyClass");
    expect(type_id).toContain("file1.ts");
    expect(type_id).toContain("MyClass");
  });

  it("should resolve inheritance across files", () => {
    // Test cross-file inheritance resolution
  });
});
```

### Integration Tests

- Test with multi-file projects
- Verify TypeIds are consistent across references
- Test inheritance chain resolution

## Acceptance Criteria

1. type_registry module completely moved to symbol_resolution
2. No TypeId generation in semantic_index
3. All imports updated and tests passing
4. Cross-file type resolution working correctly
5. Integration with Phase 3 of symbol_resolution

## Risks

- **Risk**: Breaking existing functionality
- **Mitigation**: Keep old module until new one fully tested

## Dependencies

- Depends on: task-epic-11.90.1 (directory structure)
- Blocks: task-epic-11.90.11 (TypeId generation implementation)

## Notes

This is a critical architectural change that fixes the fundamental issue of attempting cross-file resolution during single-file analysis. The type registry naturally belongs in symbol_resolution where it has access to all the information it needs.
