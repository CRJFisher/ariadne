# Task: Create Type Resolution Directory Structure

**Task ID**: task-epic-11.90.1
**Parent**: task-epic-11.90
**Status**: Created
**Priority**: High
**Created**: 2024-01-19
**Estimated Effort**: 2 hours
**Phase**: 1 - Prepare Infrastructure

## Objective

Create the directory structure and foundational interfaces for the new symbol_resolution/type_resolution module that will handle all cross-file type processing. This phase establishes the foundation for moving all cross-file type resolution out of semantic_index.

## Background

The semantic_index phase currently attempts cross-file type resolution, violating the architectural principle that semantic_index = single-file analysis. We're moving all cross-file type resolution to symbol_resolution Phase 3, which runs after imports and functions are resolved.

## Implementation

### 1. Create Directory Structure

```bash
# Create the new type_resolution module structure
mkdir -p packages/core/src/symbol_resolution/type_resolution
mkdir -p packages/core/src/symbol_resolution/type_resolution/tests
mkdir -p packages/core/src/symbol_resolution/type_resolution/fixtures
```

### 2. Create Core Interface Definitions

Create `packages/core/src/symbol_resolution/type_resolution/types.ts`:

```typescript
/**
 * Type Resolution - Core interfaces for Phase 3 of symbol resolution
 *
 * This module handles all cross-file type resolution after imports
 * and function calls have been resolved in Phases 1 and 2.
 */

import type {
  TypeId,
  SymbolId,
  Location,
  FilePath,
  SymbolName,
  ScopeId,
} from "@ariadnejs/types";

/**
 * Input to type resolution - local type info from semantic_index
 */
export interface LocalTypeExtraction {
  // Type definitions found in each file
  readonly type_definitions: Map<FilePath, LocalTypeDefinition[]>;

  // Type annotations found in each file
  readonly type_annotations: Map<FilePath, LocalTypeAnnotation[]>;

  // Assignment flows found in each file
  readonly type_flows: Map<FilePath, LocalTypeFlow[]>;
}

/**
 * A type definition extracted from a single file
 */
export interface LocalTypeDefinition {
  readonly name: SymbolName;
  readonly kind: "class" | "interface" | "type" | "enum";
  readonly location: Location;
  readonly file_path: FilePath;

  // Direct members only - no inheritance
  readonly direct_members: Map<SymbolName, LocalMemberInfo>;

  // Names only - not resolved
  readonly extends_names?: SymbolName[];
  readonly implements_names?: SymbolName[];
}

/**
 * A type annotation found in code (unresolved)
 */
export interface LocalTypeAnnotation {
  readonly location: Location;
  readonly annotation_text: string;  // Raw text like "Foo<Bar>"
  readonly annotation_kind: "variable" | "parameter" | "return" | "property";
  readonly scope_id: ScopeId;
}

/**
 * An assignment or type flow (unresolved)
 */
export interface LocalTypeFlow {
  readonly source_location: Location;
  readonly target_location: Location;
  readonly flow_kind: "assignment" | "return" | "parameter";
  readonly scope_id: ScopeId;
}

/**
 * Output of type resolution - fully resolved types
 */
export interface ResolvedTypes {
  // Global type registry with TypeIds
  readonly type_registry: GlobalTypeRegistry;

  // Symbol to type mappings
  readonly symbol_types: Map<SymbolId, TypeId>;

  // Location to type mappings
  readonly location_types: Map<Location, TypeId>;

  // Type inheritance hierarchy
  readonly type_hierarchy: TypeHierarchyGraph;

  // Constructor mappings
  readonly constructors: Map<TypeId, SymbolId>;
}

/**
 * Global registry of all types across files
 */
export interface GlobalTypeRegistry {
  readonly types: Map<TypeId, ResolvedTypeDefinition>;
  readonly type_names: Map<FilePath, Map<SymbolName, TypeId>>;
}

/**
 * Fully resolved type with all members including inherited
 */
export interface ResolvedTypeDefinition {
  readonly type_id: TypeId;
  readonly name: SymbolName;
  readonly kind: "class" | "interface" | "type" | "enum";
  readonly definition_location: Location;
  readonly file_path: FilePath;

  // All members including inherited
  readonly all_members: Map<SymbolName, ResolvedMemberInfo>;

  // Resolved TypeIds
  readonly base_types: TypeId[];
  readonly derived_types: TypeId[];
}

/**
 * Type hierarchy relationships
 */
export interface TypeHierarchyGraph {
  // Direct relationships
  readonly extends_map: Map<TypeId, TypeId[]>;
  readonly implements_map: Map<TypeId, TypeId[]>;

  // Transitive closures (pre-computed for efficiency)
  readonly all_ancestors: Map<TypeId, Set<TypeId>>;
  readonly all_descendants: Map<TypeId, Set<TypeId>>;
}

// Re-export for convenience
export type { LocalMemberInfo, ResolvedMemberInfo } from "./members";
```

### 3. Create Index File

Create `packages/core/src/symbol_resolution/type_resolution/index.ts`:

```typescript
/**
 * Type Resolution Module
 *
 * Phase 3 of symbol resolution - handles all cross-file type resolution
 * after imports and functions have been resolved.
 */

export * from "./types";
export { resolve_types } from "./resolve_types";
export { build_type_registry } from "./type_registry";
export { resolve_type_members } from "./resolve_members";
export { track_type_flow } from "./type_flow";
export { resolve_type_annotations } from "./resolve_annotations";
export { resolve_inheritance } from "./inheritance";
```

### 4. Create Placeholder Implementation Files

Create minimal placeholder files that will be implemented in later tasks:

`packages/core/src/symbol_resolution/type_resolution/resolve_types.ts`:
```typescript
import type { LocalTypeExtraction, ResolvedTypes } from "./types";
import type { ImportResolutionMap, FunctionResolutionMap } from "../types";

/**
 * Main entry point for type resolution (Phase 3)
 */
export function resolve_types(
  local_types: LocalTypeExtraction,
  imports: ImportResolutionMap,
  functions: FunctionResolutionMap
): ResolvedTypes {
  // TODO: Implement in task-epic-11.90.26
  throw new Error("Not implemented - see task-epic-11.90.26");
}
```

### 5. Create Test Structure

Create `packages/core/src/symbol_resolution/type_resolution/tests/setup.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { LocalTypeExtraction, ResolvedTypes } from "../types";

describe("Type Resolution Setup", () => {
  it("should have correct directory structure", () => {
    // Verify imports work
    expect(LocalTypeExtraction).toBeDefined();
  });

  it("should export all necessary types", () => {
    // This test ensures the module structure is correct
    const modules = [
      "./types",
      "./resolve_types",
      "./type_registry",
      "./resolve_members",
      "./type_flow",
      "./resolve_annotations",
      "./inheritance",
    ];

    modules.forEach(mod => {
      expect(() => require(mod)).not.toThrow();
    });
  });
});
```

## Testing

1. Verify directory structure is created correctly
2. Ensure all TypeScript files compile without errors
3. Confirm imports from the new module work in symbol_resolution
4. Run the setup test to verify module structure

## Success Criteria

1. ✅ Directory structure exists under symbol_resolution/type_resolution
2. ✅ Core type definitions are in place
3. ✅ Placeholder files for all major functions exist
4. ✅ Module can be imported from symbol_resolution
5. ✅ Tests confirm the structure is correct

## Dependencies

- None - this is the foundation task

## Next Steps

After this task:
- task-epic-11.90.2: Define detailed interfaces for local vs resolved types
- task-epic-11.90.3: Create comprehensive test fixtures
- Later phases will implement the actual resolution logic

## Notes

This task establishes the foundation for moving all cross-file type resolution out of semantic_index. The interfaces define clear boundaries between:
- **Local extraction** (what semantic_index provides)
- **Resolved types** (what symbol_resolution produces)

The directory structure supports the full type resolution pipeline that will be implemented across the remaining tasks.