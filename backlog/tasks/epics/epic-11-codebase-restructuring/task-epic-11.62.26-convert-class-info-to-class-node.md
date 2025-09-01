# Task 11.62.26: Convert ClassInfo to ClassNode for ClassHierarchy

**Status:** Not Started  
**Assignee:** Unassigned  
**Priority:** Critical  
**Estimated Effort:** 2 hours  
**Dependencies:** Tasks 11.62.22-25  
**Created:** 2025-09-01  

## Summary

Create conversion functions to transform `ClassInfo` (from `common.ts`, used in `FileAnalysis`) into `ClassNode` (used in the shared `ClassHierarchy` type), and potentially update the shared types if they're missing necessary fields.

## Problem Statement

There's a type mismatch between:

1. **ClassInfo** (from `common.ts`) - Used in FileAnalysis for per-file class data
2. **ClassNode** (from `@ariadnejs/types/classes`) - Used in ClassHierarchy 
3. **ClassDefinition** (from `@ariadnejs/types/definitions`) - Rich definition type

The code_graph.ts needs to convert FileAnalysis classes (ClassInfo) into a format suitable for building the ClassHierarchy (ClassNode or ClassDefinition).

## Research & Analysis

### ClassInfo (from common.ts - what we have)

```typescript
export interface ClassInfo {
  readonly name: ClassName;
  readonly location: Location;
  readonly base_classes?: readonly ClassName[];
  readonly interfaces?: readonly string[];
  readonly is_abstract?: boolean;
  readonly is_exported?: boolean;
  readonly docstring?: DocString;
  readonly decorators?: readonly DecoratorName[];
  readonly methods: readonly MethodInfo[];
  readonly properties: readonly PropertyInfo[];
}
```

### ClassNode (from types/classes - what ClassHierarchy expects)

```typescript
export interface ClassNode {
  readonly name: ClassName;
  readonly file_path: FilePath;
  readonly location: Location;
  readonly base_classes: readonly ClassName[];
  readonly derived_classes: readonly ClassName[];  // Computed during hierarchy build
  readonly interfaces?: readonly InterfaceName[];
  readonly is_abstract?: boolean;
  readonly is_interface?: boolean;
  readonly is_trait?: boolean;
  readonly methods: ReadonlyMap<MethodName, MethodNode>;  // Different structure!
  readonly properties: ReadonlyMap<PropertyName, PropertyNode>;  // Different structure!
}
```

### Key Differences

1. **Methods/Properties structure** - ClassInfo uses arrays, ClassNode uses Maps
2. **Missing fields in ClassNode** - No docstring, decorators, is_exported
3. **Additional fields in ClassNode** - derived_classes (computed), is_interface, is_trait
4. **File path** - ClassNode needs file_path, ClassInfo doesn't have it

## Solution Design

### Option 1: Update Shared Types (Recommended)

Update ClassNode in `@ariadnejs/types/classes` to include missing fields:

```typescript
// In @ariadnejs/types/classes.ts
export interface ClassNode {
  readonly name: ClassName;
  readonly file_path: FilePath;
  readonly location: Location;
  readonly base_classes: readonly ClassName[];
  readonly derived_classes: readonly ClassName[];
  readonly interfaces?: readonly InterfaceName[];
  readonly is_abstract?: boolean;
  readonly is_interface?: boolean;
  readonly is_trait?: boolean;
  readonly is_exported?: boolean;  // ADD THIS
  readonly methods: ReadonlyMap<MethodName, MethodNode>;
  readonly properties: ReadonlyMap<PropertyName, PropertyNode>;
  readonly docstring?: DocString;  // ADD THIS
  readonly decorators?: readonly DecoratorName[];  // ADD THIS
  readonly generics?: readonly TypeParameter[];  // ADD THIS
}
```

### Option 2: Use ClassDefinition Instead

Since ClassDefinition already has all the needed fields, consider using it directly:

```typescript
// Update ClassHierarchy to use ClassDefinition
export interface ClassHierarchy {
  readonly classes: ReadonlyMap<QualifiedName, ClassDefinition>;  // Not ClassNode
  readonly inheritance_edges: readonly InheritanceEdge[];
  readonly root_classes: ReadonlySet<ClassName>;
}
```

### Conversion Functions

```typescript
// Convert ClassInfo to ClassNode
export function class_info_to_class_node(
  info: ClassInfo,
  file_path: string,
  language: Language
): ClassNode {
  // Convert methods array to Map
  const methods_map = new Map<MethodName, MethodNode>();
  for (const method of info.methods) {
    methods_map.set(method.name, {
      name: method.name,
      location: method.location,
      is_override: method.is_override || false,
      overrides: undefined,  // Computed later
      overridden_by: [],  // Computed later
      visibility: method.visibility,
      is_static: method.is_static,
      is_abstract: method.is_abstract
    });
  }
  
  // Convert properties array to Map
  const properties_map = new Map<PropertyName, PropertyNode>();
  for (const prop of info.properties) {
    properties_map.set(prop.name, {
      name: prop.name,
      location: prop.location,
      type: prop.type,
      visibility: prop.visibility,
      is_static: prop.is_static,
      is_readonly: prop.is_readonly
    });
  }
  
  return {
    name: info.name,
    file_path,
    location: info.location,
    base_classes: info.base_classes || [],
    derived_classes: [],  // Computed during hierarchy build
    interfaces: info.interfaces,
    is_abstract: info.is_abstract,
    is_interface: false,  // ClassInfo doesn't track this
    is_trait: false,  // ClassInfo doesn't track this
    is_exported: info.is_exported,  // If we add this field
    methods: methods_map,
    properties: properties_map,
    docstring: info.docstring,  // If we add this field
    decorators: info.decorators  // If we add this field
  };
}

// Convert ClassInfo to ClassDefinition (alternative)
export function class_info_to_class_definition(
  info: ClassInfo,
  file_path: string,
  language: Language
): ClassDefinition {
  return {
    name: info.name,
    location: info.location,
    file_path,
    language,
    extends: info.base_classes,
    implements: info.interfaces,
    is_abstract: info.is_abstract,
    is_final: false,  // Not tracked in ClassInfo
    methods: info.methods.map(m => method_info_to_definition(m)),
    properties: info.properties.map(p => property_info_to_definition(p)),
    decorators: info.decorators,
    generics: [],  // TODO: Extract from AST or type info
  };
}
```

## Implementation Steps

1. **Decide on approach** - Update shared types or use ClassDefinition
2. **Update shared types** if needed (add missing fields to ClassNode)
3. **Create conversion functions** in a new utility module
4. **Update code_graph.ts** to use conversions
5. **Update class_hierarchy.ts** to work with chosen approach
6. **Test conversions** with real data

## Acceptance Criteria

- [ ] Conversion functions handle all fields correctly
- [ ] No data loss during conversion
- [ ] Methods and properties correctly converted to Maps (if using ClassNode)
- [ ] File paths properly propagated
- [ ] Language-specific features handled
- [ ] Tests for conversion functions

## Benefits

1. **Type Safety:** Proper types throughout the pipeline
2. **Data Completeness:** All metadata preserved
3. **Flexibility:** Can work with either ClassNode or ClassDefinition
4. **Maintainability:** Clear conversion boundaries

## Testing Plan

1. Test conversion with minimal class
2. Test with complex class (inheritance, interfaces, generics)
3. Test with language-specific features
4. Verify no data loss
5. Test Map conversion for methods/properties

## Decision Required

**Which approach should we take?**

1. **Option A:** Update ClassNode to include missing fields
2. **Option B:** Use ClassDefinition instead of ClassNode in ClassHierarchy
3. **Option C:** Keep minimal ClassNode, store extra data elsewhere

## Implementation Notes

_To be filled during implementation_

## Completion Checklist

- [ ] Approach decided and approved
- [ ] Shared types updated (if needed)
- [ ] Conversion functions implemented
- [ ] Tests written and passing
- [ ] Integration with code_graph.ts verified
- [ ] Documentation updated