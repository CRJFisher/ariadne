# Task: Fix Type Structure Inconsistencies

**Task ID**: task-epic-11.92.3
**Parent**: task-epic-11.92
**Status**: Pending
**Priority**: Critical
**Created**: 2025-01-22
**Estimated Effort**: 1-2 days

## Problem Statement

Multiple type definition inconsistencies across modules are causing 30+ compilation errors and preventing successful integration between semantic indexing and symbol resolution phases.

### Critical Type Mismatches Identified

#### 1. LocalMemberInfo Structure Divergence

**Semantic Index Version**: `packages/core/src/semantic_index/type_members/type_members.ts`
```typescript
interface LocalMemberInfo {
  kind: "method" | "constructor" | "property" | "field";
  // Missing: symbol_id property
}
```

**Type Resolution Version**: `packages/core/src/symbol_resolution/type_resolution/types.ts`
```typescript
interface LocalMemberInfo {
  kind: "method" | "property" | "field" | "getter" | "setter";
  symbol_id?: SymbolId;  // ← Missing in semantic_index version
}
```

**Compilation Error**:
```
src/symbol_resolution/symbol_resolution.ts(268,9): error TS2322: Type '"constructor"' is not assignable to type '"method" | "property" | "field" | "getter" | "setter"'.
```

#### 2. LocalTypeFlow Interface Mismatch

**Semantic Index Version**: `packages/core/src/semantic_index/references/type_flow_references/type_flow_references.ts`
```typescript
interface LocalTypeFlow {
  constructor_calls: ConstructorCall[];
  assignments: Assignment[];
  returns: Return[];
  call_assignments: CallAssignment[];
}
```

**Type Resolution Version**: `packages/core/src/symbol_resolution/type_resolution/types.ts`
```typescript
interface LocalTypeFlow {
  location: Location;
  flow_kind: "constructor" | "assignment" | "return";
}
```

**Compilation Error**:
```
src/symbol_resolution/type_resolution/type_resolution.test.ts(231,40): error TS2345: Argument of type 'Map<FilePath, LocalTypeFlow>' is not assignable to parameter of type 'Map<FilePath, LocalTypeFlow>'.
```

#### 3. Import/Export Type Inconsistencies

Multiple Import and Export type definitions across modules with different property requirements.

**Compilation Errors**:
```
src/semantic_index/imports/imports.ts(68,9): error TS2322: Type '{}' is not assignable to type 'Export'.
src/semantic_index/imports/imports.ts(107,9): error TS2322: Type 'string' is not assignable to type 'NamespaceName'.
```

#### 4. Test Interface Mutation Errors

Tests trying to call mutable methods on ReadonlyMap interfaces.

**Compilation Errors**:
```
src/symbol_resolution/type_resolution/type_registry_interfaces.test.ts(675,39): error TS2339: Property 'set' does not exist on type 'ReadonlyMap<SymbolId, TypeId>'.
```

## Solution Overview

Systematically align type structures across modules, create conversion utilities where needed, and fix test interface usage to achieve compilation success.

### Approach Strategy

1. **Unify Core Interfaces**: Align LocalMemberInfo, LocalTypeFlow across modules
2. **Create Type Adapters**: Convert between semantic_index and type_resolution formats
3. **Fix Import/Export Types**: Standardize Import/Export interfaces
4. **Update Test Utilities**: Fix ReadonlyMap usage in tests

## Implementation Plan

### Step 1: Unify LocalMemberInfo Interface

**Goal**: Create single, consistent LocalMemberInfo interface used by both modules.

**File**: `packages/types/src/common.ts` (new shared location)

```typescript
// Unified LocalMemberInfo interface
export interface LocalMemberInfo {
  kind: "method" | "constructor" | "property" | "field" | "getter" | "setter";
  symbol_id?: SymbolId;
  location: Location;
  // Add any other common properties
}
```

**Migration Steps**:

1. **Update Semantic Index Usage**:
   ```typescript
   // packages/core/src/semantic_index/type_members/type_members.ts
   import type { LocalMemberInfo } from "@ariadnejs/types";

   // Remove local LocalMemberInfo definition
   // Use shared interface
   ```

2. **Update Type Resolution Usage**:
   ```typescript
   // packages/core/src/symbol_resolution/type_resolution/types.ts
   import type { LocalMemberInfo } from "@ariadnejs/types";

   // Remove local LocalMemberInfo definition
   // Use shared interface
   ```

3. **Add symbol_id Population**:
   ```typescript
   // In semantic_index type_members extraction
   const member_info: LocalMemberInfo = {
     kind: member.kind,
     symbol_id: generate_member_symbol_id(member.name, class_symbol),
     location: member.location,
   };
   ```

### Step 2: Handle LocalTypeFlow Interface Divergence

**Problem**: Two completely different LocalTypeFlow interfaces serve different purposes.

**Solution**: Rename interfaces to reflect their distinct purposes.

**File Changes**:

1. **Semantic Index - Rename to LocalTypeFlowData**:
   ```typescript
   // packages/core/src/semantic_index/references/type_flow_references/type_flow_references.ts
   export interface LocalTypeFlowData {
     constructor_calls: ConstructorCall[];
     assignments: Assignment[];
     returns: Return[];
     call_assignments: CallAssignment[];
   }
   ```

2. **Type Resolution - Rename to LocalTypeFlowPattern**:
   ```typescript
   // packages/core/src/symbol_resolution/type_resolution/types.ts
   export interface LocalTypeFlowPattern {
     location: Location;
     flow_kind: "constructor" | "assignment" | "return";
   }
   ```

3. **Create Conversion Utility**:
   ```typescript
   // packages/core/src/symbol_resolution/symbol_resolution.ts
   function convert_type_flow_data_to_patterns(
     flow_data: LocalTypeFlowData
   ): LocalTypeFlowPattern[] {
     const patterns: LocalTypeFlowPattern[] = [];

     // Convert constructor calls
     for (const ctor_call of flow_data.constructor_calls) {
       patterns.push({
         location: ctor_call.location,
         flow_kind: "constructor"
       });
     }

     // Convert assignments
     for (const assignment of flow_data.assignments) {
       patterns.push({
         location: assignment.location,
         flow_kind: "assignment"
       });
     }

     // Convert returns
     for (const return_stmt of flow_data.returns) {
       patterns.push({
         location: return_stmt.location,
         flow_kind: "return"
       });
     }

     return patterns;
   }
   ```

### Step 3: Fix Import/Export Type Inconsistencies

**Problem**: Multiple Import/Export type definitions across modules.

**Solution**: Unify in @ariadnejs/types package.

**File**: `packages/types/src/common.ts`

```typescript
// Unified Import interface
export interface Import {
  import_name: SymbolName;
  source_path: string;
  import_kind: "named" | "default" | "namespace";
  local_name?: SymbolName;
  location: Location;
}

// Unified Export interface
export interface Export {
  export_name: SymbolName;
  export_kind: "named" | "default" | "namespace";
  exported_symbol: SymbolId;
  location: Location;
}

// Branded type for namespace names
export interface NamespaceName {
  __brand: "NamespaceName";
}

export function create_namespace_name(name: string): NamespaceName {
  return name as any as NamespaceName;
}
```

**Migration Steps**:

1. **Update Semantic Index**:
   ```typescript
   // packages/core/src/semantic_index/imports/imports.ts
   import type { Import, Export } from "@ariadnejs/types";

   // Remove local Import/Export definitions
   // Update usage to match unified interface
   ```

2. **Fix Type Assignments**:
   ```typescript
   // Fix error: Type '{}' is not assignable to type 'Export'
   const export_info: Export = {
     export_name: symbol_name,
     export_kind: "named",
     exported_symbol: symbol_id,
     location: symbol_location,
   };

   // Fix error: Type 'string' is not assignable to type 'NamespaceName'
   const namespace_name = create_namespace_name(namespace_string);
   ```

### Step 4: Fix Test Interface Mutation Errors

**Problem**: Tests calling mutable methods on ReadonlyMap interfaces.

**Solution**: Use proper Map construction and type casting in tests.

**File Changes**:

1. **Fix ReadonlyMap Mutations**:
   ```typescript
   // packages/core/src/symbol_resolution/type_resolution/type_registry_interfaces.test.ts

   // BEFORE (causes error):
   const registry: GlobalTypeRegistry = {
     types: new Map(),
     type_names: new Map(),
     // ...
   };
   registry.types.set(type_id, type_info); // ← Error: 'set' does not exist

   // AFTER (correct):
   const types = new Map<TypeId, TypeInfo>();
   types.set(type_id, type_info);

   const registry: GlobalTypeRegistry = {
     types: types as ReadonlyMap<TypeId, TypeInfo>,
     type_names: type_names as ReadonlyMap<SymbolName, TypeId>,
     // ...
   };
   ```

2. **Create Test Utilities**:
   ```typescript
   // packages/core/src/symbol_resolution/test_utilities.ts
   export function create_mutable_map<K, V>(): Map<K, V> {
     return new Map<K, V>();
   }

   export function create_readonly_map<K, V>(entries: [K, V][]): ReadonlyMap<K, V> {
     const map = new Map<K, V>();
     for (const [key, value] of entries) {
       map.set(key, value);
     }
     return map as ReadonlyMap<K, V>;
   }

   export function create_mutable_set<T>(): Set<T> {
     return new Set<T>();
   }

   export function create_readonly_set<T>(items: T[]): ReadonlySet<T> {
     const set = new Set<T>();
     for (const item of items) {
       set.add(item);
     }
     return set as ReadonlySet<T>;
   }
   ```

### Step 5: Fix Additional Type Inconsistencies

**Problem**: SymbolDefinition property mismatches.

**Compilation Errors**:
```
src/symbol_resolution/type_resolution/type_resolution.ts(121,16): error TS2339: Property 'return_type' does not exist on type 'SymbolDefinition'.
src/symbol_resolution/type_resolution/type_resolution.ts(126,16): error TS2339: Property 'value_type' does not exist on type 'SymbolDefinition'.
```

**Solution**: Update SymbolDefinition interface or use proper type guards.

```typescript
// Option 1: Update SymbolDefinition interface
export interface SymbolDefinition {
  // ... existing properties
  return_type?: TypeId;
  value_type?: TypeId;
}

// Option 2: Use type guards
function has_return_type(symbol: SymbolDefinition): symbol is SymbolDefinition & { return_type: TypeId } {
  return 'return_type' in symbol && symbol.return_type !== undefined;
}

// Usage:
if (has_return_type(symbol)) {
  const return_type = symbol.return_type; // ← Safe access
}
```

## Testing Requirements

### Compilation Test

```bash
npm run build
# Should complete without type structure errors
```

### Type Conversion Tests

**File**: `packages/core/src/symbol_resolution/type_conversions.test.ts`

```typescript
describe("Type conversions", () => {
  it("should convert LocalTypeFlowData to LocalTypeFlowPattern", () => {
    const flow_data: LocalTypeFlowData = create_test_flow_data();
    const patterns = convert_type_flow_data_to_patterns(flow_data);

    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].flow_kind).toBeDefined();
  });

  it("should handle unified LocalMemberInfo structure", () => {
    const member_info: LocalMemberInfo = {
      kind: "method",
      symbol_id: "test_symbol" as SymbolId,
      location: create_test_location(),
    };

    expect(member_info.symbol_id).toBeDefined();
    expect(member_info.kind).toBe("method");
  });
});
```

### Test Utility Tests

```typescript
describe("Test utilities", () => {
  it("should create proper ReadonlyMap from mutable Map", () => {
    const entries: [string, number][] = [["a", 1], ["b", 2]];
    const readonly_map = create_readonly_map(entries);

    expect(readonly_map.get("a")).toBe(1);
    expect(readonly_map.size).toBe(2);
    // Should not have 'set' method available
    expect((readonly_map as any).set).toBeUndefined();
  });
});
```

## Success Criteria

1. **Zero Compilation Errors**: All TypeScript type mismatch errors resolved
2. **Unified Interfaces**: Single LocalMemberInfo interface used across modules
3. **Proper Type Conversion**: LocalTypeFlow data converted correctly
4. **Working Tests**: All tests use proper ReadonlyMap/Map patterns
5. **Import/Export Consistency**: Unified Import/Export interfaces across modules

## Dependencies

- **Prerequisite**: None (can be done independently)
- **Enables**: task-epic-11.92.1, task-epic-11.92.2, task-epic-11.92.4
- **Coordination**: May require updates to @ariadnejs/types package

## Risks and Mitigations

### Risk 1: Breaking Changes to Interfaces

Interface changes may break other parts of the codebase.

**Mitigation**: Use gradual migration approach with backwards compatibility.

### Risk 2: Complex Type Conversions

Converting between different LocalTypeFlow formats may be error-prone.

**Mitigation**: Comprehensive testing of conversion utilities.

### Risk 3: Test Suite Disruption

Interface changes may break many existing tests.

**Mitigation**: Update tests incrementally, maintain test coverage throughout.

## Implementation Notes

**Critical Order**:
1. Fix type definitions first (compilation errors)
2. Create conversion utilities
3. Update test utilities
4. Migrate usage gradually

**Performance Considerations**:
- Type conversions should be minimal overhead
- Test utilities should not impact production code
- Interface unification should reduce memory usage

## Files Modified

1. `packages/types/src/common.ts` - Unified interfaces
2. `packages/core/src/semantic_index/type_members/type_members.ts` - Use unified LocalMemberInfo
3. `packages/core/src/semantic_index/references/type_flow_references/` - Rename LocalTypeFlow
4. `packages/core/src/symbol_resolution/type_resolution/types.ts` - Use unified interfaces
5. `packages/core/src/symbol_resolution/symbol_resolution.ts` - Type conversions
6. `packages/core/src/symbol_resolution/test_utilities.ts` - Test utilities
7. All affected test files - Fix ReadonlyMap usage

## References

- TypeScript compilation error analysis
- Interface definition consistency patterns
- ReadonlyMap vs Map usage best practices
- Type conversion utility patterns