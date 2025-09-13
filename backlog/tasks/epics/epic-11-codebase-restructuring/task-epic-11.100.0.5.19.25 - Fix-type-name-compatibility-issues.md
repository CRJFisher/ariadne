---
id: task-epic-11.100.0.5.19.25
title: Fix type name compatibility issues
status: To Do
assignee: []
created_date: "2025-01-13"
labels: ["type-system", "compatibility"]
dependencies: ["task-epic-11.100.0.5.19.2"]
parent_task_id: task-epic-11.100.0.5.19.2
priority: medium
---

## Description

Resolve type compatibility issues between different name types (TypeName vs SymbolId, VariableName vs SymbolId, QualifiedName) that emerged after the type system refactoring.

## Current Errors

### 1. TypeName vs SymbolId Incompatibility
```
error TS2322: Type 'TypeName[]' is not assignable to type 'readonly SymbolId[]'.
error TS2322: Type 'TypeName[] | undefined' is not assignable to type 'readonly SymbolId[] | undefined'.
error TS2352: Conversion of type 'SymbolId' to type 'TypeName' may be a mistake because neither type sufficiently overlaps with the other.
error TS2352: Conversion of type 'readonly SymbolId[]' to type 'TypeName[]' may be a mistake because neither type sufficiently overlaps with the other.
```

### 2. VariableName vs QualifiedName Issues
```
error TS2322: Type 'Map<string, VariableType>' is not assignable to type 'ReadonlyMap<QualifiedName, VariableType>'.
```

**Affected file:** `packages/core/src/type_analysis/type_registry/type_registry.ts`

## Root Cause Analysis

The type system refactoring introduced branded types (SymbolId) as the universal identifier, but several modules still use legacy name types:

- **TypeName**: Legacy type for type identifiers
- **VariableName**: Legacy type for variable identifiers
- **QualifiedName**: Legacy qualified name type
- **SymbolId**: New universal symbol identifier

## Type Compatibility Matrix

| Source Type | Target Type | Compatibility | Solution |
|-------------|-------------|---------------|----------|
| TypeName | SymbolId | ❌ Incompatible | Convert using `type_symbol()` |
| SymbolId | TypeName | ❌ Incompatible | Extract name from SymbolId |
| string | QualifiedName | ❌ Incompatible | Convert using qualified name factory |
| VariableName | SymbolId | ❌ Incompatible | Convert using `variable_symbol()` |

## Files to Update

### 1. type_registry.ts
File: `packages/core/src/type_analysis/type_registry/type_registry.ts`

**Lines 355-357**: Fix TypeName/SymbolId conversions:
```typescript
// Current problematic code:
hierarchy: parents?.map(symbol => symbol as TypeName) ?? [],
interfaces: hierarchy?.map(symbol => symbol as TypeName),
mixins: interfaces?.map(symbol => symbol as TypeName)

// Solution 1: Convert SymbolId to TypeName
hierarchy: parents?.map(symbol => extractTypeName(symbol)) ?? [],
interfaces: hierarchy?.map(symbol => extractTypeName(symbol)),
mixins: interfaces?.map(symbol => extractTypeName(symbol))

// Solution 2: Change property types to accept SymbolId
hierarchy: parents ?? [],
interfaces: hierarchy,
mixins: interfaces
```

### 2. type_tracking.ts
File: `packages/core/src/type_analysis/type_tracking/type_tracking.ts`

**Line 1355**: Fix Map type compatibility:
```typescript
// Current:
variable_types: legacy_variable_types as ReadonlyMap<QualifiedName, VariableType>

// Solution:
const qualifiedMap = new Map<QualifiedName, VariableType>();
for (const [key, value] of legacy_variable_types) {
  const qualifiedKey = createQualifiedName(key);
  qualifiedMap.set(qualifiedKey, value);
}
variable_types: qualifiedMap
```

## Solution Approaches

### Option 1: Type Conversion Utilities
Create helper functions for converting between type systems:
```typescript
export function symbolIdToTypeName(symbolId: SymbolId): TypeName;
export function typeNameToSymbolId(typeName: TypeName, context: FileContext): SymbolId;
export function stringToQualifiedName(str: string): QualifiedName;
export function symbolIdToQualifiedName(symbolId: SymbolId): QualifiedName;
```

### Option 2: Update Type Definitions
Modify interfaces to accept the actual types being used:
```typescript
// Instead of TypeName[], accept SymbolId[]
export interface TypeHierarchy {
  readonly hierarchy: readonly SymbolId[];  // Was TypeName[]
  readonly interfaces: readonly SymbolId[]; // Was TypeName[]
  readonly mixins: readonly SymbolId[];     // Was TypeName[]
}
```

### Option 3: Gradual Migration
Use union types during transition period:
```typescript
type CompatibleTypeName = TypeName | SymbolId;
type CompatibleQualifiedName = QualifiedName | string;
```

## Acceptance Criteria

- [ ] All TypeName/SymbolId conversion errors resolved
- [ ] Map type compatibility issues fixed
- [ ] type_registry module compiles without type errors
- [ ] type_tracking module compiles without qualification errors
- [ ] Consistent use of new type system throughout affected modules
- [ ] Backward compatibility maintained where necessary

## Implementation Strategy

1. **Analysis Phase**: Map all type conversions needed
2. **Utility Creation**: Build conversion helper functions
3. **Gradual Replacement**: Update modules one by one
4. **Type Definition Updates**: Modify interfaces to match usage
5. **Testing**: Verify type safety and functionality

## Related Tasks

- **task-epic-11.100.0.5.19.23**: SymbolId branding issues (related to VariableName conversion)
- **task-epic-11.100.0.5.19.24**: Import/export issues (may affect type availability)

## Priority Areas

1. **High**: type_registry.ts TypeName conversions (blocking type analysis)
2. **Medium**: type_tracking.ts QualifiedName issues
3. **Low**: Other legacy type compatibility issues