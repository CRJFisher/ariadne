# Task 11.62.23.1: Analyze Type Differences Between Local and Shared Types

**Parent Task:** 11.62.23 - Replace local types with shared types  
**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 1 hour  
**Created:** 2025-09-01  

## Summary

Analyze and document the exact differences between the local types in class_hierarchy.ts and the shared types in @ariadnejs/types, to understand what needs to be bridged.

## Current State Analysis

### Local Types (class_hierarchy.ts)

```typescript
// Local ClassInfo
interface ClassInfo {
  definition: Def;
  parent_class?: string;
  parent_class_def?: Def;
  implemented_interfaces: string[];
  interface_defs: Def[];
  subclasses: Def[];
  all_ancestors: Def[];
  all_descendants: Def[];
  method_resolution_order: Def[];
}

// Local InheritanceEdge
interface InheritanceEdge {
  child: Def;
  parent: Def;
  relationship_type: 'extends' | 'implements' | 'trait' | 'mixin';
  source_location: Position;
}

// Local ClassHierarchy
interface ClassHierarchy {
  classes: Map<string, ClassInfo>;
  edges: InheritanceEdge[];
  roots: Def[];
  language: string;
}
```

### Shared Types (@ariadnejs/types/classes)

```typescript
// Shared ClassNode
interface ClassNode {
  readonly name: ClassName;
  readonly file_path: FilePath;
  readonly location: Location;
  readonly base_classes: readonly ClassName[];
  readonly derived_classes: readonly ClassName[];
  readonly interfaces?: readonly InterfaceName[];
  readonly is_abstract?: boolean;
  readonly is_interface?: boolean;
  readonly is_trait?: boolean;
  readonly methods: ReadonlyMap<MethodName, MethodNode>;
  readonly properties: ReadonlyMap<PropertyName, PropertyNode>;
}

// Shared InheritanceEdge
interface InheritanceEdge {
  readonly from: QualifiedName;
  readonly to: QualifiedName;
  readonly type: 'extends' | 'implements';
}

// Shared ClassHierarchy
interface ClassHierarchy {
  readonly classes: ReadonlyMap<QualifiedName, ClassNode>;
  readonly inheritance_edges: readonly InheritanceEdge[];
  readonly root_classes: ReadonlySet<ClassName>;
  readonly interface_implementations?: ReadonlyMap<InterfaceName, ReadonlySet<ClassName>>;
}
```

## Key Differences

### 1. ClassInfo vs ClassNode

| Local ClassInfo | Shared ClassNode | Gap |
|----------------|------------------|-----|
| definition: Def | name, file_path, location | Need to extract from Def |
| parent_class_def | (not present) | Local tracking only |
| interface_defs | (not present) | Local tracking only |
| subclasses | derived_classes | Same concept, different name |
| all_ancestors | (not present) | Computed field |
| all_descendants | (not present) | Computed field |
| method_resolution_order | (not present) | Computed field |
| (not present) | methods: Map | Need to populate |
| (not present) | properties: Map | Need to populate |

### 2. InheritanceEdge Differences

| Local | Shared | Gap |
|-------|--------|-----|
| child: Def | from: QualifiedName | Need to convert |
| parent: Def | to: QualifiedName | Need to convert |
| relationship_type includes 'trait', 'mixin' | Only 'extends', 'implements' | Need mapping |
| source_location: Position | (not present) | Local only |

### 3. ClassHierarchy Differences

| Local | Shared | Gap |
|-------|--------|-----|
| classes: Map<string, ClassInfo> | classes: ReadonlyMap<QualifiedName, ClassNode> | Different value type |
| edges: InheritanceEdge[] | inheritance_edges: readonly InheritanceEdge[] | Field name + readonly |
| roots: Def[] | root_classes: ReadonlySet<ClassName> | Different type + readonly |
| language: string | (not present) | Local only |
| (not present) | interface_implementations | Additional tracking |

## Missing Functionality in Shared Types

1. **No computed fields** - all_ancestors, all_descendants, method_resolution_order
2. **No resolution tracking** - parent_class_def, interface_defs
3. **No language field** - Can't track which language the hierarchy is for
4. **Limited relationship types** - No 'trait' or 'mixin'
5. **No source location for edges** - Can't track where inheritance is declared

## Proposed Solutions

### Option A: Extend Shared Types
Add the missing fields to shared types as optional fields.

### Option B: Adapter Pattern
Keep internal types for building, convert to shared types for public API.

### Option C: Hybrid Approach
Use shared types where possible, maintain supplementary maps for additional data.

## Deliverables

- [ ] Document all type differences
- [ ] Identify blocking differences vs nice-to-have
- [ ] Propose solution approach
- [ ] Get approval on approach

## Next Steps

Based on the chosen approach:
- If Option A: Create task to update shared types
- If Option B: Create task to implement adapters
- If Option C: Create task to design hybrid structure