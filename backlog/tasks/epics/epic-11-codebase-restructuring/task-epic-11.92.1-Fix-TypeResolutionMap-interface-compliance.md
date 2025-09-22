# Task: Fix TypeResolutionMap Interface Compliance

**Task ID**: task-epic-11.92.1
**Parent**: task-epic-11.92
**Status**: Pending
**Priority**: Critical
**Created**: 2025-01-22
**Estimated Effort**: 1-2 days

## Problem Statement

The `phase3_resolve_types` function in `symbol_resolution.ts:224` returns an incomplete structure that doesn't match the `TypeResolutionMap` interface, causing compilation errors and breaking the pipeline contract.

### Current Implementation Issue

**File**: `packages/core/src/symbol_resolution/symbol_resolution.ts:224`

```typescript
// Current return (incomplete - missing 2 required fields)
return { symbol_types, reference_types, type_members, constructors };
```

**Expected Interface**: `packages/core/src/symbol_resolution/types.ts:50-68`

```typescript
interface TypeResolutionMap {
  readonly symbol_types: ReadonlyMap<SymbolId, TypeId>;
  readonly reference_types: ReadonlyMap<LocationKey, TypeId>;
  readonly type_members: ReadonlyMap<TypeId, ReadonlyMap<SymbolName, SymbolId>>;
  readonly constructors: ReadonlyMap<TypeId, SymbolId>;
  readonly inheritance_hierarchy: ReadonlyMap<TypeId, readonly TypeId[]>;     // ← MISSING
  readonly interface_implementations: ReadonlyMap<TypeId, readonly TypeId[]>; // ← MISSING
}
```

### Root Cause Analysis

1. **Computed but Unused Data**: Lines 127-130 compute `type_hierarchy` but it's never used
2. **Interface Evolution**: TypeResolutionMap interface was extended but implementation wasn't updated
3. **TODO Comment**: Line 133 indicates missing step 4 implementation affects this

## Solution Overview

Extract inheritance relationship data from the computed `type_hierarchy` and map it to the required interface format.

### Data Flow Analysis

```typescript
// Step 3: resolve_inheritance returns TypeHierarchyGraph
const type_hierarchy = resolve_inheritance(
  local_extraction.type_definitions,
  imports.imports
);

// TypeHierarchyGraph structure:
interface TypeHierarchyGraph {
  readonly extends_map: Map<TypeId, TypeId[]>;      // → inheritance_hierarchy
  readonly implements_map: Map<TypeId, TypeId[]>;   // → interface_implementations
  readonly all_ancestors: Map<TypeId, Set<TypeId>>;
  readonly all_descendants: Map<TypeId, Set<TypeId>>;
}
```

## Implementation Plan

### Step 1: Extract Inheritance Hierarchy

Add mapping from `TypeHierarchyGraph.extends_map` to `inheritance_hierarchy`:

```typescript
// Extract inheritance hierarchy from type_hierarchy
const inheritance_hierarchy = new Map<TypeId, readonly TypeId[]>();
for (const [child_type, parent_types] of type_hierarchy.extends_map) {
  inheritance_hierarchy.set(child_type, parent_types);
}
```

### Step 2: Extract Interface Implementations

Add mapping from `TypeHierarchyGraph.implements_map` to `interface_implementations`:

```typescript
// Extract interface implementations from type_hierarchy
const interface_implementations = new Map<TypeId, readonly TypeId[]>();
for (const [impl_type, interface_types] of type_hierarchy.implements_map) {
  interface_implementations.set(impl_type, interface_types);
}
```

### Step 3: Update Return Statement

```typescript
return {
  symbol_types,
  reference_types,
  type_members,
  constructors,
  inheritance_hierarchy,
  interface_implementations
};
```

## Complete Implementation

**File**: `packages/core/src/symbol_resolution/symbol_resolution.ts`

**Location**: Lines 127-135 and 224

```typescript
// Step 3: Resolve type inheritance hierarchy
const type_hierarchy = resolve_inheritance(
  local_extraction.type_definitions,
  imports.imports
);

// Extract inheritance hierarchy (NEW)
const inheritance_hierarchy = new Map<TypeId, readonly TypeId[]>();
for (const [child_type, parent_types] of type_hierarchy.extends_map) {
  inheritance_hierarchy.set(child_type, parent_types);
}

// Extract interface implementations (NEW)
const interface_implementations = new Map<TypeId, readonly TypeId[]>();
for (const [impl_type, interface_types] of type_hierarchy.implements_map) {
  interface_implementations.set(impl_type, interface_types);
}

// Step 4: Resolve all type members including inherited
// ... existing implementation ...

// Build result maps for compatibility (UPDATED)
// ... existing symbol_types, reference_types, type_members, constructors ...

return {
  symbol_types,
  reference_types,
  type_members,
  constructors,
  inheritance_hierarchy,      // ← ADD
  interface_implementations   // ← ADD
};
```

## Testing Requirements

### Compilation Test

```bash
npm run build
# Should complete without TypeResolutionMap interface errors
```

### Unit Test

**File**: `packages/core/src/symbol_resolution/symbol_resolution.test.ts`

```typescript
describe("phase3_resolve_types interface compliance", () => {
  it("should return complete TypeResolutionMap structure", () => {
    const result = phase3_resolve_types(indices, imports, functions);

    // Verify all required fields exist
    expect(result.symbol_types).toBeDefined();
    expect(result.reference_types).toBeDefined();
    expect(result.type_members).toBeDefined();
    expect(result.constructors).toBeDefined();
    expect(result.inheritance_hierarchy).toBeDefined();
    expect(result.interface_implementations).toBeDefined();

    // Verify correct types
    expect(result.inheritance_hierarchy instanceof Map).toBe(true);
    expect(result.interface_implementations instanceof Map).toBe(true);
  });
});
```

## Success Criteria

1. **Interface Compliance**: TypeResolutionMap interface fully satisfied
2. **Compilation Success**: No TypeScript errors related to TypeResolutionMap
3. **Data Accessibility**: inheritance_hierarchy and interface_implementations accessible to Phase 4
4. **Test Coverage**: Unit tests verify complete interface implementation

## Dependencies

- **Prerequisite**: resolve_inheritance function exists (currently returns empty data)
- **Enables**: task-epic-11.92.2 (Type member resolution)
- **Enables**: Phase 4 method resolution improvements

## Risks and Mitigations

### Risk 1: Empty Data from resolve_inheritance

Current implementation returns empty maps, so inheritance data will be empty.

**Mitigation**: This task focuses on interface compliance; actual data population is task-epic-11.92.2.

### Risk 2: Performance Impact

Adding new data extraction might impact performance.

**Mitigation**: Simple map iteration is minimal overhead; real performance impact is in resolve_inheritance implementation.

## Implementation Notes

- This task only addresses interface compliance, not data correctness
- resolve_inheritance currently returns empty data (TODO implementation)
- The data flow works correctly once resolve_inheritance is implemented
- No breaking changes to existing functionality
- Simple, low-risk change that unblocks compilation

## Files Modified

1. `packages/core/src/symbol_resolution/symbol_resolution.ts`
   - Lines 127-135: Add inheritance data extraction
   - Line 224: Update return statement

## References

- TypeResolutionMap interface definition (types.ts:50-68)
- TypeHierarchyGraph interface (type_resolution/types.ts)
- resolve_inheritance function (inheritance.ts)