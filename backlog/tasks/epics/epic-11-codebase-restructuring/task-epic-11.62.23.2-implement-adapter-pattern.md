# Task 11.62.23.2: Implement Adapter Pattern for Class Hierarchy Types

**Parent Task:** 11.62.23 - Replace local types with shared types  
**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 2 hours  
**Dependencies:** Task 11.62.23.1 (Analyze type differences)  
**Created:** 2025-09-01  

## Summary

Implement an adapter pattern that allows class_hierarchy.ts to work internally with rich types while exposing the shared ClassHierarchy type as its public API.

## Design

### Internal Types (Keep for Building)

```typescript
// Internal types used during hierarchy construction
interface InternalClassInfo {
  definition: Def;  // Keep using Def internally for now
  parent_class?: string;
  parent_class_def?: Def;
  implemented_interfaces: string[];
  interface_defs: Def[];
  subclasses: Def[];
  all_ancestors: Def[];
  all_descendants: Def[];
  method_resolution_order: Def[];
}

interface InternalHierarchy {
  classes: Map<string, InternalClassInfo>;
  edges: Array<{
    child: Def;
    parent: Def;
    relationship_type: 'extends' | 'implements' | 'trait' | 'mixin';
    source_location: Position;
  }>;
  roots: Def[];
  language: string;
}
```

### Adapter Functions

```typescript
/**
 * Convert internal hierarchy to shared ClassHierarchy
 */
function to_shared_hierarchy(internal: InternalHierarchy): ClassHierarchy {
  const classes = new Map<string, ClassNode>();
  const inheritance_edges: InheritanceEdge[] = [];
  const root_classes = new Set<string>();
  
  // Convert each internal class to ClassNode
  for (const [key, info] of internal.classes) {
    const node = to_class_node(info);
    classes.set(key, node);
  }
  
  // Convert edges
  for (const edge of internal.edges) {
    inheritance_edges.push(to_shared_edge(edge));
  }
  
  // Convert roots
  for (const root of internal.roots) {
    root_classes.add(root.name);
  }
  
  return {
    classes,
    inheritance_edges,
    root_classes
  };
}

/**
 * Convert InternalClassInfo to ClassNode
 */
function to_class_node(info: InternalClassInfo): ClassNode {
  return {
    name: info.definition.name,
    file_path: info.definition.file_path,
    location: extract_location(info.definition),
    base_classes: info.parent_class ? [info.parent_class] : [],
    derived_classes: info.subclasses.map(s => s.name),
    interfaces: info.implemented_interfaces,
    is_abstract: extract_is_abstract(info.definition),
    is_interface: info.definition.symbol_kind === 'interface',
    is_trait: info.definition.symbol_kind === 'trait',
    methods: extract_methods(info.definition),
    properties: extract_properties(info.definition)
  };
}
```

### Supplementary Data Storage

For data that doesn't fit in shared types:

```typescript
// Store computed fields separately
class HierarchyMetadata {
  private ancestors = new Map<string, Def[]>();
  private descendants = new Map<string, Def[]>();
  private mro = new Map<string, Def[]>();
  private language: string;
  
  set_ancestors(class_id: string, ancestors: Def[]) {
    this.ancestors.set(class_id, ancestors);
  }
  
  get_ancestors(class_id: string): Def[] {
    return this.ancestors.get(class_id) || [];
  }
  
  // ... similar for other fields
}
```

## Implementation Steps

1. **Create internal type definitions**
   - Define InternalClassInfo
   - Define InternalHierarchy
   - Define InternalEdge

2. **Implement adapter functions**
   - to_shared_hierarchy()
   - to_class_node()
   - to_shared_edge()
   - Extract helper functions

3. **Create metadata storage**
   - HierarchyMetadata class
   - Methods for storing/retrieving computed fields
   - Methods for language tracking

4. **Update build_class_hierarchy**
   - Build with internal types
   - Convert to shared types before returning
   - Store metadata separately if needed

5. **Update helper functions**
   - Make them work with internal types
   - Add converters where needed

## Acceptance Criteria

- [ ] Internal types defined and documented
- [ ] Adapter functions fully implemented
- [ ] All computed fields preserved (even if not in shared type)
- [ ] build_class_hierarchy returns shared ClassHierarchy
- [ ] All existing functionality preserved
- [ ] No breaking changes to public API

## Benefits

1. **Compatibility** - Works with existing code using Def
2. **Rich Internal State** - Keep all computed fields internally
3. **Clean Public API** - Expose standard shared types
4. **Gradual Migration** - Can migrate internals later
5. **Separation of Concerns** - Building logic separate from type conversion

## Testing Plan

1. Unit test each adapter function
2. Test round-trip conversion (if possible)
3. Verify no data loss in critical fields
4. Test with all supported languages
5. Verify computed fields still accessible

## Related Tasks

- **Depends on:** Task 11.62.23.1 - Type analysis
- **Blocks:** Task 11.62.24 - Fix method_hierarchy_resolver
- **Related:** Task 11.62.26 - Type conversion utilities