/**
 * Class hierarchy functionality
 * 
 * Tracks inheritance relationships between classes:
 * - Parent class relationships (extends)
 * - Interface implementations
 * - Trait implementations (Rust)
 * - Multiple inheritance (Python)
 * - Method resolution order
 */

import type { 
  ClassNode, 
  ClassHierarchy,
  InheritanceEdge,
  MethodNode,
  PropertyNode
} from '@ariadnejs/types';
import type { 
  ClassDefinition,
  MethodDefinition,
  PropertyDefinition
} from '@ariadnejs/types';
import type { Language } from '@ariadnejs/types';

/**
 * Context for building class hierarchy
 */
export interface ClassHierarchyContext {
  tree?: any; // Tree-sitter tree (optional)
  source_code: string;
  file_path: string;
  language: string;
  all_definitions?: any[]; // All class/interface definitions in project
}

/**
 * Build class hierarchy using enhanced shared types directly
 */
export function build_class_hierarchy(
  definitions: ClassDefinition[],
  contexts: Map<string, ClassHierarchyContext>
): ClassHierarchy {
  const classes = new Map<string, ClassNode>();
  const edges: InheritanceEdge[] = [];
  const roots = new Set<string>();
  
  // First pass: Create all ClassNodes
  for (const def of definitions) {
    const qualified_name = `${def.file_path}#${def.name}`;
    
    const node: ClassNode = {
      name: def.name,
      file_path: def.file_path,
      location: def.location,
      base_classes: def.extends || [],
      derived_classes: [],  // Will be populated in second pass
      interfaces: def.implements,
      is_abstract: def.is_abstract,
      is_interface: def.is_interface,
      is_trait: def.is_trait,
      is_mixin: def.is_mixin,
      methods: build_method_map(def.methods || []),
      properties: build_property_map(def.properties || []),
      
      // Enhanced fields - will be computed after building basic structure
      all_ancestors: undefined,
      all_descendants: undefined,
      method_resolution_order: undefined,
      parent_class: undefined,
      interface_nodes: undefined,
    };
    
    classes.set(qualified_name, node);
    
    // Track root classes (those with no base classes)
    if (!def.extends || def.extends.length === 0) {
      roots.add(def.name);
    }
    
    // Build inheritance edges
    if (def.extends) {
      for (const base of def.extends) {
        edges.push({
          from: def.name,
          to: base,
          type: 'extends',
          source_location: def.location,
        });
      }
    }
    
    if (def.implements) {
      for (const iface of def.implements) {
        edges.push({
          from: def.name,
          to: iface,
          type: 'implements',
          source_location: def.location,
        });
      }
    }
  }
  
  // Second pass: Populate derived_classes and compute enhanced fields
  compute_derived_classes(classes, edges);
  compute_enhanced_fields(classes, edges);
  
  // Determine language from contexts
  const language = contexts.values().next().value?.language || 'unknown';
  
  return {
    classes: classes as ReadonlyMap<string, ClassNode>,
    inheritance_edges: edges,
    root_classes: roots as ReadonlySet<string>,
    language: language as Language,
    metadata: {
      build_time: Date.now(),
      total_classes: classes.size,
      max_depth: compute_max_depth(classes, roots),
    },
  };
}

/**
 * Build a Map of methods from definitions
 */
function build_method_map(methods: MethodDefinition[]): ReadonlyMap<string, MethodNode> {
  const map = new Map<string, MethodNode>();
  
  for (const method of methods) {
    const node: MethodNode = {
      name: method.name,
      location: method.location,
      is_override: method.is_override || false,
      overrides: method.overrides,
      overridden_by: method.overridden_by || [],
      visibility: method.visibility,
      is_static: method.is_static,
      is_abstract: method.is_abstract,
    };
    
    map.set(method.name, node);
  }
  
  return map;
}

/**
 * Build a Map of properties from definitions
 */
function build_property_map(properties: PropertyDefinition[]): ReadonlyMap<string, PropertyNode> {
  const map = new Map<string, PropertyNode>();
  
  for (const property of properties) {
    const node: PropertyNode = {
      name: property.name,
      location: property.location,
      type: property.type,
      visibility: property.visibility,
      is_static: property.is_static,
      is_readonly: property.is_readonly,
    };
    
    map.set(property.name, node);
  }
  
  return map;
}

/**
 * Populate derived_classes based on inheritance edges
 */
function compute_derived_classes(
  classes: Map<string, ClassNode>,
  edges: InheritanceEdge[]
): void {
  for (const edge of edges) {
    if (edge.type === 'extends') {
      // Find the base class and add this as a derived class
      for (const [key, node] of classes) {
        if (node.name === edge.to) {
          // Safe mutation during building phase
          (node as any).derived_classes = [...(node.derived_classes || []), edge.from];
          break;
        }
      }
    }
  }
}

/**
 * Compute enhanced fields: all_ancestors, all_descendants, method_resolution_order
 */
function compute_enhanced_fields(
  classes: Map<string, ClassNode>,
  edges: InheritanceEdge[]
): void {
  for (const [key, node] of classes) {
    // Compute all_ancestors
    const ancestors = compute_all_ancestors(node, classes, edges);
    if (ancestors.length > 0) {
      (node as any).all_ancestors = ancestors;
    }
    
    // Compute all_descendants  
    const descendants = compute_all_descendants(node, classes);
    if (descendants.length > 0) {
      (node as any).all_descendants = descendants;
    }
    
    // Compute method_resolution_order
    const mro = compute_mro(node, classes, edges);
    (node as any).method_resolution_order = mro;
    
    // Set parent_class reference
    if (node.base_classes && node.base_classes.length > 0) {
      const parent_name = node.base_classes[0];
      for (const [pkey, parent] of classes) {
        if (parent.name === parent_name) {
          (node as any).parent_class = parent;
          break;
        }
      }
    }
  }
}

/**
 * Compute all ancestors for a class
 */
function compute_all_ancestors(
  node: ClassNode,
  classes: Map<string, ClassNode>,
  edges: InheritanceEdge[]
): ClassNode[] {
  const ancestors: ClassNode[] = [];
  const visited = new Set<string>();
  
  function visit(current: ClassNode): void {
    if (!current.base_classes) return;
    
    for (const base_name of current.base_classes) {
      if (visited.has(base_name)) continue;
      visited.add(base_name);
      
      // Find the base class node
      for (const [key, base_node] of classes) {
        if (base_node.name === base_name) {
          ancestors.push(base_node);
          visit(base_node);  // Recursively get ancestors of ancestors
          break;
        }
      }
    }
  }
  
  visit(node);
  return ancestors;
}

/**
 * Compute all descendants for a class
 */
function compute_all_descendants(
  node: ClassNode,
  classes: Map<string, ClassNode>
): ClassNode[] {
  const descendants: ClassNode[] = [];
  const visited = new Set<string>();
  
  function visit(current: ClassNode): void {
    if (!current.derived_classes) return;
    
    for (const derived_name of current.derived_classes) {
      if (visited.has(derived_name)) continue;
      visited.add(derived_name);
      
      // Find the derived class node
      for (const [key, derived_node] of classes) {
        if (derived_node.name === derived_name) {
          descendants.push(derived_node);
          visit(derived_node);  // Recursively get descendants of descendants
          break;
        }
      }
    }
  }
  
  visit(node);
  return descendants;
}

/**
 * Compute method resolution order using C3 linearization (simplified)
 */
function compute_mro(
  node: ClassNode,
  classes: Map<string, ClassNode>,
  edges: InheritanceEdge[]
): ClassNode[] {
  const mro: ClassNode[] = [node];
  
  // Add ancestors in order
  const ancestors = compute_all_ancestors(node, classes, edges);
  for (const ancestor of ancestors) {
    if (!mro.includes(ancestor)) {
      mro.push(ancestor);
    }
  }
  
  return mro;
}

/**
 * Compute the maximum depth of the class hierarchy
 */
function compute_max_depth(
  classes: Map<string, ClassNode>,
  roots: Set<string>
): number {
  let max_depth = 0;
  
  function compute_depth(node: ClassNode, current_depth: number): void {
    max_depth = Math.max(max_depth, current_depth);
    
    if (node.derived_classes) {
      for (const derived_name of node.derived_classes) {
        for (const [key, derived] of classes) {
          if (derived.name === derived_name) {
            compute_depth(derived, current_depth + 1);
            break;
          }
        }
      }
    }
  }
  
  // Start from each root
  for (const root_name of roots) {
    for (const [key, node] of classes) {
      if (node.name === root_name) {
        compute_depth(node, 0);
        break;
      }
    }
  }
  
  return max_depth;
}

// Re-export the types for convenience
export type { ClassNode, ClassHierarchy, InheritanceEdge } from '@ariadnejs/types';