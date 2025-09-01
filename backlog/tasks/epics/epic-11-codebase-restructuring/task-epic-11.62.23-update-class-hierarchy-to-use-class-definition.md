# Task 11.62.23: Replace Local Types in class_hierarchy.ts with Shared Types

**Status:** Not Started  
**Assignee:** Unassigned  
**Priority:** Critical  
**Estimated Effort:** 3 hours  
**Dependencies:** Task 11.62.22 (Definition interface and FunctionDefinition)  
**Created:** 2025-09-01  

## Summary

Completely replace all locally-defined types in `class_hierarchy.ts` with the shared types from `@ariadnejs/types`. This includes removing the local `ClassInfo`, `InheritanceEdge`, and `ClassHierarchy` interfaces and using the shared versions instead.

## Problem Statement

The `class_hierarchy.ts` module defines its own local types that duplicate and conflict with shared types:

1. **Duplicate ClassHierarchy** - Local definition conflicts with `@ariadnejs/types/classes`
2. **Duplicate InheritanceEdge** - Already exists in shared types
3. **Local ClassInfo** - Should use ClassNode or internal-only type
4. **Generic Def usage** - Should use ClassDefinition and other specific types
5. **Type fragmentation** - Multiple definitions of the same concepts

## Research & Analysis

### Current Local Types (TO BE REMOVED)

```typescript
// These duplicate shared types and should be removed:
export interface ClassInfo { ... }  // Replace with ClassNode or make internal
export interface InheritanceEdge { ... }  // Use from @ariadnejs/types
export interface ClassHierarchy { ... }  // Use from @ariadnejs/types
```

### Shared Types Available

From `@ariadnejs/types/classes`:
```typescript
export interface ClassNode {
  readonly name: ClassName;
  readonly file_path: FilePath;
  readonly location: Location;
  readonly base_classes: readonly ClassName[];
  readonly derived_classes: readonly ClassName[];
  readonly interfaces?: readonly InterfaceName[];
  readonly methods: ReadonlyMap<MethodName, MethodNode>;
  readonly properties: ReadonlyMap<PropertyName, PropertyNode>;
}

export interface ClassHierarchy {
  readonly classes: ReadonlyMap<QualifiedName, ClassNode>;
  readonly inheritance_edges: readonly InheritanceEdge[];
  readonly root_classes: ReadonlySet<ClassName>;
}

export interface InheritanceEdge {
  readonly from: QualifiedName;
  readonly to: QualifiedName;
  readonly type: 'extends' | 'implements';
}
```

From `@ariadnejs/types/definitions`:
```typescript
export interface ClassDefinition extends Definition {
  readonly extends?: readonly string[];
  readonly implements?: readonly string[];
  readonly methods: readonly MethodDefinition[];
  readonly properties: readonly PropertyDefinition[];
  // ... more fields
}
```

## Solution Design

### 1. Remove Local Type Definitions

```typescript
// DELETE these local interfaces:
// - export interface ClassInfo
// - export interface InheritanceEdge  
// - export interface ClassHierarchy
```

### 2. Import Shared Types

```typescript
import { 
  ClassHierarchy,
  ClassNode,
  InheritanceEdge,
  MethodNode,
  PropertyNode
} from "@ariadnejs/types/classes";

import { 
  ClassDefinition, 
  InterfaceDefinition,
  TraitDefinition,
  Definition,
  MethodDefinition,
  PropertyDefinition
} from "@ariadnejs/types/definitions";
```

### 3. Create Internal-Only Types (if needed)

```typescript
// Internal helper type for building the hierarchy
// This is ONLY used internally during construction
interface ClassBuildInfo {
  definition: ClassDefinition;
  parent_names: string[];
  interface_names: string[];
  resolved_parents?: ClassDefinition[];
  resolved_interfaces?: InterfaceDefinition[];
  mro?: ClassDefinition[];  // Method resolution order
}
```

### 4. Update Function Signatures to Use Shared Types

```typescript
export function build_class_hierarchy(
  definitions: ClassDefinition[],  // Not generic Def[]
  contexts: Map<string, ClassHierarchyContext>
): ClassHierarchy  // Returns the shared type!

export function is_class_like(def: Definition): def is ClassDefinition | InterfaceDefinition | TraitDefinition

export function find_class_by_name(
  name: string,
  definitions: ClassDefinition[]
): ClassDefinition | undefined

export function get_parent_class(
  class_def: ClassDefinition,
  hierarchy: ClassHierarchy
): ClassDefinition | undefined

// ... update all other function signatures
```

### 6. Fix Method Detection

```typescript
function class_has_method(class_info: ClassInfo): boolean {
  // Now we can directly access methods array
  return class_info.definition.methods.some(
    method => method.name === method_name
  );
}
```

### 7. Create Symbol ID from Definition

```typescript
function get_symbol_id(def: ClassDefinition): string {
  return `${def.file_path}#${def.name}`;
}
```

## Implementation Steps

1. **Update imports** in class_hierarchy.ts
2. **Update all interfaces** to use proper types
3. **Update function signatures** throughout the file
4. **Fix method detection logic** to use ClassDefinition fields
5. **Update symbol_id generation** to use definition fields
6. **Add type guards** where needed
7. **Update tests** to use proper types

## Acceptance Criteria

- [ ] All uses of `Def` replaced with appropriate definition types
- [ ] Method detection uses `ClassDefinition.methods` array
- [ ] No type errors in class_hierarchy.ts
- [ ] Integration with method_hierarchy_resolver.ts works
- [ ] All tests pass
- [ ] Type safety improved throughout

## Benefits

1. **Type Safety:** Proper typing with rich metadata
2. **No Unsafe Access:** Direct access to methods, properties, etc.
3. **Better Integration:** Works with enrichment functions
4. **Cleaner Code:** No need for existence checks
5. **IDE Support:** Full autocomplete for class metadata

## Testing Plan

1. Update unit tests to use ClassDefinition
2. Test method resolution with real class data
3. Verify inheritance chains work correctly
4. Test interface implementation detection
5. Ensure language-specific features work

## Migration Notes

- Need to update callers of build_class_hierarchy
- May need type converters from ClassInfo to ClassDefinition
- Ensure backward compatibility during transition

## Related Tasks

- **Depends on:** Task 11.62.22 - Add Definition interface
- **Next:** Task 11.62.24 - Fix method_hierarchy_resolver.ts
- **Related:** Task 11.62.26 - Type conversion utilities

## Implementation Notes

_To be filled during implementation_

## Completion Checklist

- [ ] Code updated to use ClassDefinition
- [ ] All type errors resolved
- [ ] Tests updated and passing
- [ ] Integration with method_hierarchy_resolver verified
- [ ] Documentation updated
- [ ] No regression in functionality