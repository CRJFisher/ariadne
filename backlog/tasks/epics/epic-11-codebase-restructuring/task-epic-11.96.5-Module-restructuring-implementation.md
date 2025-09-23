# Task: Module Restructuring Implementation

**Task ID**: task-epic-11.96.5
**Parent**: task-epic-11.96
**Status**: Open
**Priority**: High
**Created**: 2025-01-22
**Estimated Effort**: 2-3 days

## Problem Statement

After consolidating type resolution functionality and removing dead code, we need to restructure the modules according to the clean architecture planned in task-epic-11.96.1. The current implementation still has logic mixed in `symbol_resolution.ts` that should be moved to dedicated, focused modules.

## Objective

Implement the planned clean module architecture:
```
symbol_resolution → type_resolution → [specialized modules]
```

Each specialized module should:
- Have its own folder with focused responsibility
- Include companion test file
- Export only externally-used functions via focused `index.ts`
- Maintain single responsibility principle

## Current State vs Target State

### Current State (After Previous Tasks)
```
symbol_resolution/
├── symbol_resolution.ts          # Contains consolidated logic (needs extraction)
├── type_resolution/
│   ├── index.ts                  # Mixed exports
│   ├── type_resolution.ts        # Cleaned up, focused functions
│   ├── type_registry.ts          # Standalone
│   ├── resolve_members.ts        # Standalone
│   ├── type_flow.ts              # Standalone
│   ├── resolve_annotations.ts    # Standalone
│   ├── inheritance.ts            # Standalone
│   ├── track_types.ts            # Standalone
│   └── type_flow_integration.ts  # From task-epic-11.96.2
```

### Target State (From Architecture Plan)
```
symbol_resolution/
├── symbol_resolution.ts          # Simple orchestrator
├── type_resolution/
│   ├── index.ts                  # Main entry point
│   ├── type_registry/
│   │   ├── type_registry.ts      # Implementation
│   │   ├── type_registry.test.ts # Tests
│   │   └── index.ts              # Exports: build_global_type_registry
│   ├── type_tracking/
│   │   ├── type_tracking.ts      # Implementation
│   │   ├── type_tracking.test.ts # Tests
│   │   └── index.ts              # Exports: resolve_type_tracking
│   ├── type_flow/
│   │   ├── type_flow.ts          # Implementation
│   │   ├── type_flow.test.ts     # Tests
│   │   └── index.ts              # Exports: analyze_type_flow
│   ├── type_annotations/
│   │   ├── type_annotations.ts   # Implementation
│   │   ├── type_annotations.test.ts # Tests
│   │   └── index.ts              # Exports: resolve_type_annotations
│   ├── type_members/
│   │   ├── type_members.ts       # Implementation
│   │   ├── type_members.test.ts  # Tests
│   │   └── index.ts              # Exports: resolve_type_members
│   └── inheritance/
│       ├── inheritance.ts        # Implementation
│       ├── inheritance.test.ts   # Tests
│       └── index.ts              # Exports: resolve_inheritance
```

## Implementation Requirements

### 1. Create New Module Structure

#### 1.1 Create Specialized Module Directories
**Action**: Create the new folder structure

```bash
mkdir -p packages/core/src/symbol_resolution/type_resolution/type_registry
mkdir -p packages/core/src/symbol_resolution/type_resolution/type_tracking
mkdir -p packages/core/src/symbol_resolution/type_resolution/type_flow
mkdir -p packages/core/src/symbol_resolution/type_resolution/type_annotations
mkdir -p packages/core/src/symbol_resolution/type_resolution/type_members
mkdir -p packages/core/src/symbol_resolution/type_resolution/inheritance
```

#### 1.2 Plan Module Extractions
**Objective**: Determine what code goes where

**Module Mappings**:
- **type_registry/**: `type_registry.ts` + `build_global_type_registry` from `type_resolution.ts`
- **type_tracking/**: `track_types.ts` + related functionality
- **type_flow/**: `type_flow.ts` + `type_flow_integration.ts` consolidation
- **type_annotations/**: `resolve_annotations.ts` + related functionality
- **type_members/**: `resolve_members.ts` + related functionality
- **inheritance/**: `inheritance.ts` + related functionality

### 2. Extract Specialized Modules

#### 2.1 Extract Type Registry Module
**Target**: `packages/core/src/symbol_resolution/type_resolution/type_registry/`

**Files to Create**:

**`type_registry.ts`**:
```typescript
/**
 * Type Registry Module
 *
 * Handles global type name resolution and TypeId creation.
 * Creates mapping from type names to TypeIds across all files.
 */

import type { /* relevant imports */ } from "@ariadnejs/types";
import type { LocalTypeDefinition, GlobalTypeRegistry } from "../types";

/**
 * Build global type registry with resolved imports
 */
export function build_global_type_registry(
  type_definitions: Map<FilePath, LocalTypeDefinition[]>,
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>
): GlobalTypeRegistry {
  // Implementation moved from type_registry.ts and type_resolution.ts
}

// Helper functions moved from type_registry.ts
```

**`type_registry.test.ts`**:
```typescript
import { build_global_type_registry } from './type_registry';
import { createMockTypeDefinitions, createMockImports } from '../test_utilities/mock_factories';

describe('Type Registry Module', () => {
  describe('build_global_type_registry', () => {
    test('creates TypeIds for all type definitions', () => {
      // Test basic functionality
    });

    test('resolves cross-file type references via imports', () => {
      // Test import resolution
    });

    test('handles duplicate type names across files', () => {
      // Test name collision handling
    });
  });
});
```

**`index.ts`**:
```typescript
/**
 * Type Registry Module
 *
 * Exports type registry functionality for external use.
 */

export { build_global_type_registry } from './type_registry';
export type { GlobalTypeRegistry } from '../types';
```

#### 2.2 Extract Type Tracking Module
**Target**: `packages/core/src/symbol_resolution/type_resolution/type_tracking/`

**Files to Create**:

**`type_tracking.ts`**: Move content from `track_types.ts`
**`type_tracking.test.ts`**: Comprehensive tests for type tracking
**`index.ts`**: Export `resolve_type_tracking` function

#### 2.3 Extract Type Flow Module
**Target**: `packages/core/src/symbol_resolution/type_resolution/type_flow/`

**Files to Create**:

**`type_flow.ts`**: Consolidate `type_flow.ts` and `type_flow_integration.ts`
**`type_flow.test.ts`**: Tests for flow analysis
**`index.ts`**: Export `analyze_type_flow` function

#### 2.4 Extract Type Annotations Module
**Target**: `packages/core/src/symbol_resolution/type_resolution/type_annotations/`

**Files to Create**:

**`type_annotations.ts`**: Move content from `resolve_annotations.ts`
**`type_annotations.test.ts`**: Tests for annotation resolution
**`index.ts`**: Export `resolve_type_annotations` function

#### 2.5 Extract Type Members Module
**Target**: `packages/core/src/symbol_resolution/type_resolution/type_members/`

**Files to Create**:

**`type_members.ts`**: Move content from `resolve_members.ts`
**`type_members.test.ts`**: Tests for member resolution
**`index.ts`**: Export `resolve_type_members` function

#### 2.6 Extract Inheritance Module
**Target**: `packages/core/src/symbol_resolution/type_resolution/inheritance/`

**Files to Create**:

**`inheritance.ts`**: Move content from `inheritance.ts`
**`inheritance.test.ts`**: Tests for inheritance resolution
**`index.ts`**: Export `resolve_inheritance` function

### 3. Implement Clean Module Interfaces

#### 3.1 Standardize Module Exports
**Objective**: Ensure each module follows the same export pattern

**Template for `index.ts` files**:
```typescript
/**
 * [Module Name] Module
 *
 * [Brief description of module purpose]
 */

// Primary export function
export { [main_function_name] } from './[module_name]';

// Type exports if needed
export type { [relevant_types] } from './[module_name]';
export type { [shared_types] } from '../types';
```

#### 3.2 Create Consistent Interface Patterns
**Objective**: Ensure all modules follow similar patterns

**Interface Standards**:
- Function naming: `resolve_*`, `build_*`, `analyze_*`
- Parameter order: `(data, imports, context)`
- Return types: Always return immutable structures
- Error handling: Consistent error patterns

### 4. Update Main Type Resolution Orchestrator

#### 4.1 Create New Main Orchestrator
**File**: `packages/core/src/symbol_resolution/type_resolution/index.ts`

**New Implementation**:
```typescript
/**
 * Type Resolution Module - Main Orchestrator
 *
 * Coordinates all type resolution phases through specialized modules.
 */

import type {
  TypeId,
  SymbolId,
  FilePath,
  SymbolName,
  LocationKey
} from "@ariadnejs/types";
import type { SemanticIndex } from "../semantic_index/semantic_index";
import type { FunctionResolutionMap, TypeResolutionMap } from "./types";

// Import from specialized modules
import { build_global_type_registry } from './type_registry';
import { resolve_inheritance } from './inheritance';
import { resolve_type_annotations } from './type_annotations';
import { resolve_type_tracking } from './type_tracking';
import { analyze_type_flow } from './type_flow';
import { resolve_type_members } from './type_members';

/**
 * Main type resolution entry point
 *
 * Orchestrates all type resolution phases using specialized modules.
 */
export function resolve_all_types(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>,
  functions: FunctionResolutionMap
): TypeResolutionMap {
  // Step 1: Collect local type information from indices
  const local_extraction = collect_local_types(indices);

  // Step 2: Build global type registry
  const type_registry = build_global_type_registry(
    local_extraction.type_definitions,
    imports
  );

  // Step 3: Resolve inheritance hierarchy
  const type_hierarchy = resolve_inheritance(
    local_extraction.type_definitions,
    imports
  );

  // Step 4: Resolve type annotations
  const all_annotations = Array.from(local_extraction.type_annotations.values()).flat();
  const resolved_annotations = resolve_type_annotations(
    all_annotations,
    type_registry.type_names
  );

  // Step 5: Track variable types
  const type_tracking_data = collect_type_tracking(indices);
  const type_tracking = resolve_type_tracking(
    type_tracking_data,
    type_registry
  );

  // Step 6: Analyze type flow
  const type_flow_results = analyze_type_flow(
    local_extraction.type_flows,
    imports,
    functions,
    type_registry
  );

  // Step 7: Resolve type members with inheritance
  const resolved_members = resolve_all_type_members(
    local_extraction.type_definitions,
    type_hierarchy,
    type_registry
  );

  // Step 8: Consolidate results
  return consolidate_type_resolution_results(
    type_registry,
    type_hierarchy,
    resolved_annotations,
    type_tracking,
    type_flow_results,
    resolved_members,
    indices
  );
}

// Helper functions moved from symbol_resolution.ts
function collect_local_types(indices: ReadonlyMap<FilePath, SemanticIndex>) {
  // Implementation moved from symbol_resolution.ts
}

function collect_type_tracking(indices: ReadonlyMap<FilePath, SemanticIndex>) {
  // Implementation moved from symbol_resolution.ts
}

function resolve_all_type_members(
  type_definitions: Map<FilePath, LocalTypeDefinition[]>,
  type_hierarchy: TypeHierarchyGraph,
  type_registry: GlobalTypeRegistry
) {
  // Implementation consolidated from symbol_resolution.ts
}

function consolidate_type_resolution_results(
  type_registry: GlobalTypeRegistry,
  type_hierarchy: TypeHierarchyGraph,
  resolved_annotations: ReadonlyMap<LocationKey, TypeId>,
  type_tracking: ResolvedTypeTracking,
  type_flow_results: TypeFlowResults,
  resolved_members: Map<TypeId, Map<SymbolName, ResolvedMemberInfo>>,
  indices: ReadonlyMap<FilePath, SemanticIndex>
): TypeResolutionMap {
  // Implementation moved from symbol_resolution.ts with clean structure
}
```

### 5. Update Symbol Resolution Integration

#### 5.1 Simplify symbol_resolution.ts
**File**: `packages/core/src/symbol_resolution/symbol_resolution.ts`

**Updated phase3_resolve_types**:
```typescript
/**
 * Phase 3: Type Resolution
 *
 * Delegates to the clean type resolution module.
 */
function phase3_resolve_types(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>,
  functions: FunctionResolutionMap
): TypeResolutionMap {
  // Simple delegation to the new clean interface
  return resolve_all_types(indices, imports, functions);
}
```

**Updated Imports**:
```typescript
import { resolve_all_types } from "./type_resolution";
```

## Implementation Steps

### Step 1: Create Module Structure
1. Create all new module directories
2. Set up template files for each module
3. Plan content migration from existing files

### Step 2: Extract and Migrate Code
1. Move existing implementations to specialized modules
2. Update imports and exports in each module
3. Ensure proper separation of concerns

### Step 3: Create Module Index Files
1. Create focused `index.ts` for each module
2. Export only externally-needed functions
3. Add proper documentation for each export

### Step 4: Update Main Orchestrator
1. Create new main type resolution function
2. Move helper functions from symbol_resolution.ts
3. Implement clean coordination between modules

### Step 5: Update Symbol Resolution
1. Simplify symbol_resolution.ts to delegation
2. Update imports to use new module structure
3. Remove extracted code from symbol_resolution.ts

### Step 6: Update All Import Chains
1. Update any external imports of type resolution functions
2. Ensure all test files import from correct locations
3. Update documentation and references

## Testing Requirements

### 1. Module-Level Testing
Each module should have comprehensive tests covering:
- Primary function behavior
- Edge cases and error handling
- Interface compliance
- Performance characteristics

### 2. Integration Testing
Test the new orchestrator:
- End-to-end type resolution pipeline
- Module coordination and data flow
- Result consolidation accuracy

### 3. Regression Testing
Ensure no functionality loss:
- All existing tests continue to pass
- Same output format and accuracy
- No performance degradation

## Acceptance Criteria

### Structural Requirements
- [ ] All 6 specialized modules created with proper structure
- [ ] Each module has implementation, test, and index files
- [ ] Clean separation of concerns between modules
- [ ] No circular dependencies between modules

### Functional Requirements
- [ ] All type resolution functionality works correctly
- [ ] New orchestrator properly coordinates modules
- [ ] Symbol resolution delegates cleanly to type resolution
- [ ] All imports and exports are properly updated

### Quality Requirements
- [ ] Each module has focused, single responsibility
- [ ] Interface patterns are consistent across modules
- [ ] Tests provide comprehensive coverage
- [ ] Documentation is clear and complete

## Success Metrics

1. **Modularity**: Each module can be tested and understood independently
2. **Maintainability**: Changes to one module don't affect others
3. **Clarity**: Module purposes are obvious from structure and documentation
4. **Performance**: No degradation from restructuring

## Risk Assessment

### Medium Risk
- **Complex refactoring**: Moving code between many files
- **Import chain updates**: Many files may need import updates

### Mitigation Strategies
- **Incremental approach**: Move one module at a time
- **Comprehensive testing**: Test each module before moving to next
- **Import tracking**: Maintain list of all files that import type resolution

## Next Steps

After completion:
- **Validate**: All tests pass and functionality is preserved
- **Document**: Update architectural documentation
- **Proceed to**: task-epic-11.96.6 (Final Validation and Integration Testing)

This creates the clean, modular architecture planned in the initial design phase.