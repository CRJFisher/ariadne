# Task: Consolidate Overlapping Type Definitions

**ID**: task-epic-11.75
**Epic**: Epic 11 - Codebase Restructuring
**Status**: Pending
**Priority**: High
**Complexity**: Medium

## Problem Statement

We have significant redundancy in our type system with overlapping type definitions in `@packages/types/src/common.ts` and `@packages/types/src/definitions.ts`. These duplicate types create confusion, maintenance burden, and inconsistency:

- `FunctionInfo` ↔ `FunctionDefinition`
- `ClassInfo` ↔ `ClassDefinition`
- `MethodInfo` ↔ `MethodDefinition`
- `PropertyInfo` ↔ `PropertyDefinition`

## Research Findings

### Usage Analysis

Based on codebase analysis:

1. **ClassInfo vs ClassDefinition**:

   - `ClassInfo`: 155 occurrences across 39 files (more heavily used in inheritance modules)
   - `ClassDefinition`: 144 occurrences across 32 files (primarily in type registry and class detection)
   - Both are heavily used, making this the hardest consolidation

2. **MethodInfo vs MethodDefinition**:

   - `MethodInfo`: 17 occurrences across 10 files
   - `MethodDefinition`: 31 occurrences across 10 files
   - `MethodDefinition` has more usage but difference is not significant

3. **FunctionInfo vs FunctionDefinition**:

   - `FunctionInfo`: Used primarily in code graph and scope analysis
   - `FunctionDefinition`: Less usage, mainly in type converters
   - Clear preference for `FunctionInfo`

4. **PropertyInfo vs PropertyDefinition**:
   - Clear preference for `PropertyDefinition` based on existing patterns

## Consolidation Strategy

### Recommended Type Preferences

1. **FunctionInfo** - Keep this as the primary function type

   - Already widely used in code graph
   - Better aligned with graph node representation

2. **PropertyDefinition** - Keep this as the primary property type

   - More complete with all necessary fields
   - Better naming convention

3. **ClassDefinition** - Keep this as the primary class type

   - Despite similar usage counts, `ClassDefinition` is better structured
   - Has more complete metadata (generics, traits, mixins)
   - Already integrated with type registry

4. **MethodDefinition** - Keep this as the primary method type
   - More complete with override tracking
   - Better aligned with class definition structure

## Implementation Plan

1. **Phase 1: Type Aliasing** (Backward Compatibility)

   - Create type aliases for deprecated types pointing to new ones
   - Add deprecation comments

2. **Phase 2: Migration**

   - Update all imports to use consolidated types
   - Remove all type conversion logic since types are now unified
   - **DELETE `packages/core/src/utils/type_converters.ts` entirely**
     - This file was a band-aid for type duplication
     - No longer needed with consolidated types

3. **Phase 3: Cleanup**
   - Remove deprecated type aliases
   - Ensure no references to type_converters.ts remain
   - Verify all modules directly use the unified types

## Acceptance Criteria

- [ ] All duplicate type definitions consolidated
- [ ] Single source of truth for each entity type
- [ ] **`utils/type_converters.ts` completely deleted**
- [ ] All imports updated to use consolidated types directly
- [ ] All existing functionality maintains compatibility
- [ ] No type errors introduced
- [ ] Tests pass for all modules

## Files to Update

### Primary Type Definition Files

- `packages/types/src/common.ts` - Remove Info types, keep as utilities
- `packages/types/src/definitions.ts` - Primary location for all entity definitions

### Major Consumers to Update

- `packages/core/src/code_graph.ts` - Update to use unified types
- `packages/core/src/inheritance/class_hierarchy/` - Update imports
- `packages/core/src/scope_analysis/` - Update imports
- `packages/core/src/file_analyzer.ts` - Update imports
- `packages/core/src/type_analysis/type_registry/` - Update to use unified types

### Files to Delete

- **`packages/core/src/utils/type_converters.ts`** - Complete removal

## Dependencies

- Must be done before further type registry work
- Blocks: task-epic-11.76 (Type Registry Refactoring)

## Notes

- This consolidation will significantly simplify the codebase
- Reduces cognitive overhead for developers
- Enables cleaner type registry implementation
- **Removal of type_converters.ts eliminates a major source of complexity**
  - This file was plastering over the type duplication problem
  - Its deletion forces proper type unification
  - No more conversion overhead or confusion about which type to use
- Consider adding a type migration guide for documentation
