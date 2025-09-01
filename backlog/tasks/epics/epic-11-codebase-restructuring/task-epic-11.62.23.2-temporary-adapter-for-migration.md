# Task 11.62.23.2: Implement Temporary Adapter for Migration

**Parent Task:** 11.62.23 - Achieve type harmony between local and shared types  
**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 3 hours  
**Dependencies:** Task 11.62.23.1 (Analyze and enrich shared types)  
**Created:** 2025-09-01  
**Updated:** 2025-09-01  

## Summary

Implement a TEMPORARY adapter layer to allow gradual migration from local types to enhanced shared types. This adapter will be removed once migration is complete - it's a bridge, not a permanent solution.

## Philosophy

**Adapters are scaffolding - useful during construction but removed when the building is complete.**

The adapter serves to:
- Allow the codebase to continue working during migration
- Enable incremental updates
- Validate that enhanced shared types work correctly
- Be easily removable once migration is done

## Migration Strategy

### Phase 1: Adapter Implementation (THIS TASK)
Create adapters that bridge current code to enhanced shared types.

### Phase 2: Direct Usage Migration
Update code to use enhanced shared types directly.

### Phase 3: Adapter Removal
Delete all adapter code once migration complete.

## Temporary Adapter Design

### 1. Build with Enhanced Shared Types Internally

```typescript
// Start using enhanced shared types immediately in new code
import { 
  ClassNode, 
  ClassHierarchy, 
  InheritanceEdge 
} from '@ariadnejs/types/classes';

// Build directly with shared types where possible
function build_class_hierarchy_new(
  definitions: ClassDefinition[],
  contexts: Map<string, ClassHierarchyContext>
): ClassHierarchy {
  const classes = new Map<string, ClassNode>();
  
  // Build ClassNode directly
  for (const def of definitions) {
    const node: ClassNode = {
      name: def.name,
      file_path: def.file_path,
      location: def.location,
      base_classes: def.extends || [],
      derived_classes: [],  // Populated later
      interfaces: def.implements,
      methods: convert_methods_to_map(def.methods),
      properties: convert_properties_to_map(def.properties),
      
      // New enhanced fields
      all_ancestors: [],  // Computed after
      all_descendants: [],  // Computed after
      method_resolution_order: [],  // Computed after
    };
    
    classes.set(`${def.file_path}#${def.name}`, node);
  }
  
  // Compute enhanced fields
  compute_all_relationships(classes);
  
  return {
    classes,
    inheritance_edges: build_edges(classes),
    root_classes: find_roots(classes),
    language: contexts.values().next().value?.language
  };
}
```

### 2. Compatibility Layer for Old Code

```typescript
// TEMPORARY: Convert old Def-based calls to new system
// Mark with @deprecated and TODO: REMOVE
export function build_class_hierarchy(
  definitions: Def[],  // Old signature
  contexts: Map<string, ClassHierarchyContext>
): ClassHierarchy {
  console.warn('DEPRECATED: build_class_hierarchy with Def[] - migrate to ClassDefinition[]');
  
  // Convert Def to ClassDefinition
  const classDefs = definitions.map(def_to_class_definition);
  
  // Call new implementation
  return build_class_hierarchy_new(classDefs, contexts);
}

// TEMPORARY: Convert Def to ClassDefinition
// @deprecated TODO: REMOVE after migration
function def_to_class_definition(def: Def): ClassDefinition {
  return {
    name: def.name,
    location: def.location,
    file_path: def.file_path,
    language: def.language || 'unknown',
    extends: extract_extends_from_def(def),
    implements: extract_implements_from_def(def),
    methods: [],  // Would need separate lookup
    properties: [],  // Would need separate lookup
  };
}
```

### 3. Helper Migration Functions

```typescript
// TEMPORARY: Helper to work with both old and new code
// @deprecated TODO: REMOVE
export function get_class_info(
  hierarchy: ClassHierarchy,
  class_name: string
): ClassNode | undefined {
  // Works with enhanced shared types
  return hierarchy.classes.get(class_name);
}

// TEMPORARY: Provide old-style access for legacy code
// @deprecated TODO: REMOVE
export function get_all_ancestors_legacy(
  hierarchy: ClassHierarchy,
  class_name: string
): Def[] {
  const node = hierarchy.classes.get(class_name);
  if (!node?.all_ancestors) return [];
  
  // Convert ClassNode[] back to Def[] for legacy code
  return node.all_ancestors.map(class_node_to_def);
}
```

## Migration Checklist

Track what needs migration and what's done:

### Files to Migrate

- [ ] `class_hierarchy.ts` - Use ClassDefinition instead of Def
- [ ] `method_hierarchy_resolver.ts` - Use ClassNode.methods Map
- [ ] `code_graph.ts` - Build with ClassDefinition
- [ ] `type_registry.ts` - Accept ClassDefinition
- [ ] Test files - Update to new types

### Functions to Update

- [ ] `build_class_hierarchy` - New signature
- [ ] `extract_class_relationships` - Use ClassNode
- [ ] `resolve_class_references` - Use enhanced types
- [ ] `get_all_ancestors` - Return ClassNode[]
- [ ] `get_all_descendants` - Return ClassNode[]

## Success Metrics

1. **All code compiles** with adapters in place
2. **Tests pass** with no regression
3. **Performance unchanged** or improved
4. **Clear deprecation warnings** guide migration
5. **Migration path documented** for each component

## Timeline

1. **Week 1**: Implement adapters (this task)
2. **Week 2-3**: Migrate components to use enhanced types directly
3. **Week 4**: Remove all adapter code
4. **End State**: Pure shared types throughout

## Acceptance Criteria

- [ ] Adapters allow existing code to work unchanged
- [ ] New code can use enhanced shared types
- [ ] All adapters marked @deprecated with removal TODOs
- [ ] Migration checklist created and tracked
- [ ] No permanent dependency on adapters

## Important Notes

⚠️ **Adapters are TEMPORARY** - Every adapter function should:
- Be marked `@deprecated`
- Have a `TODO: REMOVE after migration` comment
- Log a warning when used (in dev mode)
- Have a clear migration path documented

## Next Steps

1. Implement minimal adapters for critical paths
2. Start migrating high-value code first
3. Track migration progress
4. Schedule adapter removal date
5. Celebrate type harmony! 🎉