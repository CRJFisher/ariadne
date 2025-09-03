# Task: Refactor Type Registry to Immutable Pattern

**ID**: task-epic-11.76
**Epic**: Epic 11 - Codebase Restructuring  
**Status**: Pending
**Priority**: High
**Complexity**: Medium

## Problem Statement

The current type registry implementation in `packages/core/src/type_analysis/type_registry/index.ts` uses a mutable, imperative pattern with multiple registration functions that modify state:

- `create_type_registry()` creates empty structure
- Subsequent calls to `register_class()`, `register_interface()`, `register_type()` mutate the registry
- Many exported functions appear to be unused
- Pattern doesn't align with our functional programming principles

## Current Issues

1. **Mutable State Pattern**:
   - Registry is created empty then mutated via multiple function calls
   - Violates our preference for immutable data structures
   - Makes testing and reasoning about state difficult

2. **Excessive API Surface**:
   - Many exported but unused functions:
     - `clear_file_types()`
     - `get_file_types()`
     - `get_module_exports()`
     - `register_alias()`
   - Unclear which functions are actually needed

3. **Scattered Construction Logic**:
   - Registry building spread across multiple function calls
   - No single entry point for complete registry construction

## Proposed Solution

### New Immutable Pattern

Replace the current imperative approach with a single, pure function that builds the complete registry:

```typescript
export function build_type_registry(
  file_analyses: FileAnalysis[]
): TypeRegistry {
  // Build complete, immutable registry in one pass
  // No subsequent mutations needed
}
```

### API Simplification

Keep only essential query functions:
- `lookup_type()` - Primary type lookup
- `resolve_import()` - Import resolution

Remove or internalize:
- All mutation functions (register_*, clear_*)
- Unused query functions (unless wired into actual usage)

## Implementation Plan

1. **Analyze Current Usage**
   - Identify which registry functions are actually used
   - Document the real requirements

2. **Design New API**
   - Single `build_type_registry()` function
   - Minimal query interface
   - All construction logic internalized

3. **Refactor Implementation**
   - Move all registration logic inside `build_type_registry()`
   - Make TypeRegistry fields readonly
   - Return frozen/immutable structure

4. **Update Consumers**
   - Update all code that builds registries
   - Remove calls to individual register functions

5. **Cleanup**
   - Remove unused exported functions
   - Simplify type registry module structure

## Acceptance Criteria

- [ ] Single `build_type_registry()` function creates complete registry
- [ ] No mutable state or registration functions exposed
- [ ] All unused functions removed or made private
- [ ] TypeRegistry is immutable after creation
- [ ] All existing functionality preserved
- [ ] Tests updated to new pattern
- [ ] Clear documentation of registry API

## Technical Details

### Current Pattern (Remove)
```typescript
const registry = create_type_registry();
register_class(registry, classDefA);
register_class(registry, classDefB);
register_interface(registry, interfaceA);
// ... many more mutations
```

### New Pattern (Implement)
```typescript
const registry = build_type_registry(file_analyses);
// Registry is complete and immutable
// Only queries allowed from here
```

### Functions to Remove/Internalize
- `create_type_registry()` - Internalize
- `register_class()` - Internalize
- `register_interface()` - Internalize
- `register_type()` - Internalize
- `clear_file_types()` - Remove if unused
- `get_file_types()` - Remove if unused
- `get_module_exports()` - Remove if unused
- `register_alias()` - Internalize or remove

### Functions to Keep (Public API)
- `build_type_registry()` - New main entry point
- `lookup_type()` - Primary query function
- `resolve_import()` - Import resolution

## Dependencies

- Depends on: task-epic-11.75 (Type Definition Consolidation)
- Should use consolidated types from task-epic-11.75

## Benefits

1. **Simpler Mental Model**: One function builds complete registry
2. **Better Testing**: Pure function with predictable output
3. **Cleaner API**: Minimal surface area
4. **Immutability**: No accidental mutations
5. **Performance**: Can optimize single-pass construction

## Notes

- This aligns with our functional programming principles
- Reduces API surface area significantly
- Makes the registry easier to reason about
- Consider using Object.freeze() for runtime immutability enforcement