# Task: Type Resolution Migration

**Task ID**: task-epic-11.90.4
**Parent**: task-epic-11.90
**Status**: Created
**Priority**: High
**Created**: 2024-01-19
**Estimated Effort**: 6 hours
**Phase**: 4 - Type Resolution Migration

## Objective

Move the entire `semantic_index/type_resolution` module to `symbol_resolution/type_resolution` and integrate it with Phase 3 of the symbol resolution pipeline. This module attempts cross-file type resolution that belongs in symbol_resolution, not semantic_index.

## Background

The type_resolution module currently violates architectural principles by:
1. Attempting to resolve type references across files
2. Creating TypeInfo with resolution logic
3. Tracking type relationships before imports are resolved
4. Building type hierarchies during single-file analysis

This functionality requires cross-file context only available after Phases 1-2 of symbol resolution.

## Implementation

### 1. Move Module to Symbol Resolution

```bash
# Move the entire module
mv packages/core/src/semantic_index/type_resolution \
   packages/core/src/symbol_resolution/type_resolution/

# Update the module structure
cd packages/core/src/symbol_resolution/type_resolution
```

### 2. Refactor for Phase 3 Integration

Update `packages/core/src/symbol_resolution/type_resolution/type_resolution.ts`:

```typescript
/**
 * Type Resolution - Phase 3 of symbol resolution
 *
 * Resolves all type references after imports and functions are resolved.
 * This module now has access to:
 * - Resolved imports (Phase 1)
 * - Resolved function signatures (Phase 2)
 * - Complete file index map
 */

import type {
  TypeId,
  SymbolId,
  Location,
  FilePath,
  SymbolName,
} from "@ariadnejs/types";
import type { ImportResolutionMap, FunctionResolutionMap } from "../types";
import type { LocalTypeExtraction, ResolvedTypes } from "./types";

/**
 * Main type resolution entry point - runs in Phase 3
 */
export function resolve_all_types(
  local_types: LocalTypeExtraction,
  imports: ImportResolutionMap,
  functions: FunctionResolutionMap,
  file_indices: Map<FilePath, SemanticIndex>
): ResolvedTypes {
  // Now we can properly resolve types with full context
  const registry = build_type_registry(local_types, imports);
  const hierarchy = build_type_hierarchy(registry, imports);
  const members = resolve_all_members(registry, hierarchy, local_types);
  const annotations = resolve_type_annotations(local_types.type_annotations, registry, imports);
  const flows = track_type_flows(local_types.type_flows, functions, registry);

  return {
    type_registry: registry,
    symbol_types: build_symbol_type_map(registry, annotations),
    location_types: build_location_type_map(annotations),
    type_hierarchy: hierarchy,
    constructors: find_constructors(registry, functions),
  };
}

/**
 * Resolve a type reference using imports
 */
function resolve_type_reference(
  type_name: SymbolName,
  file_path: FilePath,
  imports: ImportResolutionMap
): TypeId | undefined {
  // First check local types in same file
  const local_type = find_local_type(type_name, file_path);
  if (local_type) return local_type;

  // Then check imports
  const import_info = imports.get(file_path)?.get(type_name);
  if (import_info?.resolved_location) {
    return defined_type_id("class", type_name, import_info.resolved_location);
  }

  return undefined;
}
```

### 3. Update All Internal Dependencies

Update all functions to work with resolved context:

```typescript
// Before (semantic_index - no context)
function resolve_type(name: string): TypeInfo | undefined {
  // Can't actually resolve - no import information
  return undefined;
}

// After (symbol_resolution - full context)
function resolve_type(
  name: SymbolName,
  file: FilePath,
  imports: ImportResolutionMap
): TypeId | undefined {
  // Can properly resolve using imports
  return resolve_type_reference(name, file, imports);
}
```

### 4. Update Module Exports

Create `packages/core/src/symbol_resolution/type_resolution/index.ts`:

```typescript
// Re-export from new location
export { resolve_all_types } from "./type_resolution";
export { build_type_registry } from "./type_registry";
export { resolve_all_members } from "./resolve_members";
export { track_type_flows } from "./type_flow";
export { resolve_type_annotations } from "./resolve_annotations";
export { build_type_hierarchy } from "./inheritance";
export type * from "./types";
```

### 5. Remove from Semantic Index

```typescript
// In semantic_index/index.ts - remove type_resolution exports
// DELETE: export * from "./type_resolution";

// Update SemanticIndex interface
export interface SemanticIndex {
  // ... other fields
  // Remove: type_resolution
  // Add: local_type_extraction
  readonly local_type_extraction: LocalTypeExtraction;
}
```

### 6. Wire into Symbol Resolution Pipeline

Update `packages/core/src/symbol_resolution/symbol_resolution.ts`:

```typescript
import { resolve_all_types } from "./type_resolution";

function phase3_type_resolution(
  indices: Map<FilePath, SemanticIndex>,
  phase1: ImportResolutionMap,
  phase2: FunctionResolutionMap
): TypeResolutionMap {
  // Collect all local type information
  const local_extraction = collect_local_types(indices);

  // Resolve with full context
  return resolve_all_types(local_extraction, phase1, phase2, indices);
}
```

## Testing

### Unit Tests

```typescript
describe("resolve_all_types", () => {
  it("should resolve types using import information", () => {
    const local_types = create_mock_local_types();
    const imports = create_mock_resolved_imports();
    const functions = create_mock_resolved_functions();

    const resolved = resolve_all_types(local_types, imports, functions, indices);

    // Should have resolved TypeIds
    expect(resolved.type_registry.types.size).toBeGreaterThan(0);

    // Should have resolved cross-file references
    const imported_type = resolved.type_registry.types.get("ImportedClass");
    expect(imported_type).toBeDefined();
  });

  it("should build correct inheritance hierarchy", () => {
    // Test that inheritance is resolved after imports
    const resolved = resolve_all_types(local_types, imports, functions, indices);

    const child_hierarchy = resolved.type_hierarchy.get(child_type_id);
    expect(child_hierarchy?.base_types).toContain(parent_type_id);
  });
});
```

### Integration Tests

```typescript
describe("Phase 3 Integration", () => {
  it("should integrate with symbol resolution pipeline", () => {
    // Run full pipeline
    const semantic_indices = run_semantic_indexing(files);
    const phase1 = resolve_imports(semantic_indices);
    const phase2 = resolve_functions(semantic_indices, phase1);
    const phase3 = resolve_types(semantic_indices, phase1, phase2);

    // Verify types are fully resolved
    expect(phase3.type_registry).toBeDefined();
    expect(phase3.symbol_types.size).toBeGreaterThan(0);
  });
});
```

## Success Criteria

1. ✅ Module completely moved to symbol_resolution/type_resolution
2. ✅ All type resolution happens with access to resolved imports
3. ✅ Integration with Phase 3 of symbol resolution pipeline
4. ✅ No type resolution logic remains in semantic_index
5. ✅ All tests updated and passing
6. ✅ Cross-file type references properly resolved

## Dependencies

- **Depends on**:
  - task-epic-11.90.1: Infrastructure created
  - task-epic-11.90.3: Type registry moved
- **Blocks**:
  - Method resolution improvements
  - Type flow tracking

## Risks and Mitigations

### Risk 1: Complex Module Dependencies
**Mitigation**: Move module incrementally, keeping both versions temporarily

### Risk 2: Breaking Type Resolution
**Mitigation**: Comprehensive test coverage before switching

### Risk 3: Performance Impact
**Mitigation**: Benchmark before/after, optimize if needed

## Next Steps

After this task:
- Type tracking split (Phase 5)
- Type flow references split (Phase 6)
- Integration testing (Phase 8)

## Notes

This migration is essential for correct type resolution. The module can only work properly when it has access to:
- Resolved import paths and locations
- Complete type registry with TypeIds
- Cross-file type definitions

Moving to Phase 3 gives it all the context it needs.