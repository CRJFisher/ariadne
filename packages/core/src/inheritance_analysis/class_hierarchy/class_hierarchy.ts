/**
 * Core class hierarchy functionality
 * 
 * Tracks inheritance relationships between classes:
 * - Parent class relationships (extends)
 * - Interface implementations
 * - Trait implementations (Rust)
 * - Multiple inheritance (Python)
 * - Method resolution order
 */

// TODO: Integration with Method Calls
// - Walk class hierarchy for methods
// TODO: Integration with Constructor Calls
// - Link constructors to classes
// TODO: Integration with Type Tracking
// - Register class type information

import { SyntaxNode, Tree } from 'tree-sitter';
import { Def, Position } from '@ariadnejs/types';

/**
 * Represents a class/interface and its relationships
 */
export interface ClassInfo {
  definition: Def;
  parent_class?: string;           // Name of parent class
  parent_class_def?: Def;          // Definition of parent class (if resolved)
  implemented_interfaces: string[]; // Names of implemented interfaces
  interface_defs: Def[];           // Definitions of interfaces (if resolved)
  subclasses: Def[];               // Direct subclasses
  all_ancestors: Def[];            // All ancestor classes (computed)
  all_descendants: Def[];          // All descendant classes (computed)
  method_resolution_order: Def[];  // MRO for method lookup
}

/**
 * Represents an inheritance edge in the hierarchy
 */
export interface InheritanceEdge {
  child: Def;
  parent: Def;
  relationship_type: 'extends' | 'implements' | 'trait' | 'mixin';
  source_location: Position;
}

/**
 * Class hierarchy for a project
 */
export interface ClassHierarchy {
  classes: Map<string, ClassInfo>;     // symbol_id -> ClassInfo
  edges: InheritanceEdge[];            // All inheritance relationships
  roots: Def[];                        // Classes with no parents
  language: string;
}

/**
 * Context for building class hierarchy
 */
export interface ClassHierarchyContext {
  tree: Tree;
  source_code: string;
  file_path: string;
  language: string;
  all_definitions?: Def[];  // All class/interface definitions in project
}

/**
 * Build class hierarchy from definitions
 */
export function build_class_hierarchy(
  definitions: Def[],
  contexts: Map<string, ClassHierarchyContext>
): ClassHierarchy {
  const hierarchy: ClassHierarchy = {
    classes: new Map(),
    edges: [],
    roots: [],
    language: contexts.values().next().value?.language || 'unknown'
  };
  
  // First pass: Create ClassInfo for each class/interface
  for (const def of definitions) {
    if (!is_class_like(def)) {
      continue;
    }
    
    const context = contexts.get(def.file_path || '');
    if (!context) {
      continue;
    }
    
    const info: ClassInfo = {
      definition: def,
      implemented_interfaces: [],
      interface_defs: [],
      subclasses: [],
      all_ancestors: [],
      all_descendants: [],
      method_resolution_order: []
    };
    
    hierarchy.classes.set(def.symbol_id, info);
  }
  
  // Second pass: Extract relationships from AST
  for (const [symbol_id, info] of hierarchy.classes) {
    const context = contexts.get(info.definition.file_path || '');
    if (!context) {
      continue;
    }
    
    extract_class_relationships(info, context);
  }
  
  // Third pass: Resolve references to actual definitions
  resolve_class_references(hierarchy, definitions);
  
  // Fourth pass: Build edges and compute derived relationships
  build_inheritance_edges(hierarchy);
  compute_ancestors_descendants(hierarchy);
  compute_method_resolution_order(hierarchy);
  identify_root_classes(hierarchy);
  
  return hierarchy;
}

/**
 * Check if a definition is class-like
 */
export function is_class_like(def: Def): boolean {
  return ['class', 'interface', 'struct', 'trait'].includes(def.symbol_kind);
}

/**
 * Extract class relationships from AST
 */
export function extract_class_relationships(
  info: ClassInfo,
  context: ClassHierarchyContext
): void {
  const class_node = find_node_at_position(
    context.tree.rootNode,
    info.definition.range.start,
    info.definition.range.end
  );
  
  if (!class_node) {
    return;
  }
  
  // Language-specific extraction is handled by language modules
  // This is just the interface
}

/**
 * Find AST node at a specific position
 */
export function find_node_at_position(
  root: SyntaxNode,
  start: Position,
  end: Position
): SyntaxNode | null {
  return root.descendantForPosition(
    { row: start.row, column: start.column },
    { row: end.row, column: end.column }
  );
}

/**
 * Resolve class names to actual definitions
 */
function resolve_class_references(
  hierarchy: ClassHierarchy,
  all_definitions: Def[]
): void {
  for (const info of hierarchy.classes.values()) {
    // Resolve parent class
    if (info.parent_class) {
      const parent_def = find_class_by_name(info.parent_class, all_definitions);
      if (parent_def) {
        info.parent_class_def = parent_def;
      }
    }
    
    // Resolve interfaces
    for (const interface_name of info.implemented_interfaces) {
      const interface_def = find_class_by_name(interface_name, all_definitions);
      if (interface_def) {
        info.interface_defs.push(interface_def);
      }
    }
  }
}

/**
 * Find a class definition by name
 */
export function find_class_by_name(
  name: string,
  definitions: Def[]
): Def | undefined {
  return definitions.find(d => 
    is_class_like(d) && d.name === name
  );
}

/**
 * Build inheritance edges from resolved references
 */
function build_inheritance_edges(hierarchy: ClassHierarchy): void {
  for (const info of hierarchy.classes.values()) {
    // Add extends edge
    if (info.parent_class_def) {
      hierarchy.edges.push({
        child: info.definition,
        parent: info.parent_class_def,
        relationship_type: 'extends',
        source_location: info.definition.range.start
      });
      
      // Update parent's subclasses
      const parent_info = hierarchy.classes.get(info.parent_class_def.symbol_id);
      if (parent_info) {
        parent_info.subclasses.push(info.definition);
      }
    }
    
    // Add implements edges
    for (const interface_def of info.interface_defs) {
      hierarchy.edges.push({
        child: info.definition,
        parent: interface_def,
        relationship_type: 'implements',
        source_location: info.definition.range.start
      });
    }
  }
}

/**
 * Compute all ancestors and descendants for each class
 */
function compute_ancestors_descendants(hierarchy: ClassHierarchy): void {
  for (const info of hierarchy.classes.values()) {
    info.all_ancestors = get_all_ancestors(info, hierarchy);
    info.all_descendants = get_all_descendants(info, hierarchy);
  }
}

/**
 * Get all ancestor classes (recursive)
 */
export function get_all_ancestors(
  info: ClassInfo,
  hierarchy: ClassHierarchy,
  visited: Set<string> = new Set()
): Def[] {
  const ancestors: Def[] = [];
  
  // Avoid cycles
  if (visited.has(info.definition.symbol_id)) {
    return ancestors;
  }
  visited.add(info.definition.symbol_id);
  
  // Add parent
  if (info.parent_class_def) {
    ancestors.push(info.parent_class_def);
    const parent_info = hierarchy.classes.get(info.parent_class_def.symbol_id);
    if (parent_info) {
      ancestors.push(...get_all_ancestors(parent_info, hierarchy, visited));
    }
  }
  
  // Add interfaces
  for (const interface_def of info.interface_defs) {
    if (!ancestors.some(a => a.symbol_id === interface_def.symbol_id)) {
      ancestors.push(interface_def);
    }
  }
  
  return ancestors;
}

/**
 * Get all descendant classes (recursive)
 */
export function get_all_descendants(
  info: ClassInfo,
  hierarchy: ClassHierarchy,
  visited: Set<string> = new Set()
): Def[] {
  const descendants: Def[] = [];
  
  // Avoid cycles
  if (visited.has(info.definition.symbol_id)) {
    return descendants;
  }
  visited.add(info.definition.symbol_id);
  
  // Add direct subclasses
  for (const subclass of info.subclasses) {
    descendants.push(subclass);
    const subclass_info = hierarchy.classes.get(subclass.symbol_id);
    if (subclass_info) {
      descendants.push(...get_all_descendants(subclass_info, hierarchy, visited));
    }
  }
  
  return descendants;
}

/**
 * Compute method resolution order (C3 linearization for Python, simple for others)
 */
function compute_method_resolution_order(hierarchy: ClassHierarchy): void {
  for (const info of hierarchy.classes.values()) {
    if (hierarchy.language === 'python') {
      info.method_resolution_order = compute_c3_linearization(info, hierarchy);
    } else {
      // Simple depth-first for other languages
      info.method_resolution_order = [
        info.definition,
        ...info.all_ancestors
      ];
    }
  }
}

/**
 * C3 linearization algorithm for Python MRO
 */
function compute_c3_linearization(
  info: ClassInfo,
  hierarchy: ClassHierarchy
): Def[] {
  // Simplified version - full C3 is complex
  // For now, just return class + ancestors in order
  return [
    info.definition,
    ...info.all_ancestors
  ];
}

/**
 * Identify root classes (no parents)
 */
function identify_root_classes(hierarchy: ClassHierarchy): void {
  for (const info of hierarchy.classes.values()) {
    if (!info.parent_class_def && info.interface_defs.length === 0) {
      hierarchy.roots.push(info.definition);
    }
  }
}

/**
 * Get the parent class of a given class
 */
export function get_parent_class(
  class_def: Def,
  hierarchy: ClassHierarchy
): Def | undefined {
  const info = hierarchy.classes.get(class_def.symbol_id);
  return info?.parent_class_def;
}

/**
 * Get all subclasses of a given class
 */
export function get_subclasses(
  class_def: Def,
  hierarchy: ClassHierarchy
): Def[] {
  const info = hierarchy.classes.get(class_def.symbol_id);
  return info?.subclasses || [];
}

/**
 * Get all implemented interfaces of a class
 */
export function get_implemented_interfaces(
  class_def: Def,
  hierarchy: ClassHierarchy
): Def[] {
  const info = hierarchy.classes.get(class_def.symbol_id);
  return info?.interface_defs || [];
}

/**
 * Check if a class implements an interface
 */
export function implements_interface(
  class_def: Def,
  interface_def: Def,
  hierarchy: ClassHierarchy
): boolean {
  const info = hierarchy.classes.get(class_def.symbol_id);
  if (!info) return false;
  
  // Check direct implementation
  if (info.interface_defs.some(i => i.symbol_id === interface_def.symbol_id)) {
    return true;
  }
  
  // Check parent implementation
  if (info.parent_class_def) {
    return implements_interface(info.parent_class_def, interface_def, hierarchy);
  }
  
  return false;
}

/**
 * Check if a class is a subclass of another
 */
export function is_subclass_of(
  child: Def,
  parent: Def,
  hierarchy: ClassHierarchy
): boolean {
  const info = hierarchy.classes.get(child.symbol_id);
  if (!info) return false;
  
  return info.all_ancestors.some(a => a.symbol_id === parent.symbol_id);
}

/**
 * Get the inheritance path between two classes
 */
export function get_inheritance_path(
  child: Def,
  ancestor: Def,
  hierarchy: ClassHierarchy
): Def[] | undefined {
  const info = hierarchy.classes.get(child.symbol_id);
  if (!info) return undefined;
  
  // Build path recursively
  const path: Def[] = [child];
  
  if (child.symbol_id === ancestor.symbol_id) {
    return path;
  }
  
  if (info.parent_class_def) {
    const parent_path = get_inheritance_path(info.parent_class_def, ancestor, hierarchy);
    if (parent_path) {
      return [...path, ...parent_path];
    }
  }
  
  return undefined;
}

/**
 * Get all methods available to a class (including inherited)
 */
export function get_all_methods(
  class_def: Def,
  hierarchy: ClassHierarchy,
  method_provider?: (def: Def) => Def[]
): Def[] {
  const info = hierarchy.classes.get(class_def.symbol_id);
  if (!info) return [];
  
  const methods: Def[] = [];
  const seen = new Set<string>();
  
  // Walk MRO to collect methods
  for (const ancestor of info.method_resolution_order) {
    if (method_provider) {
      const ancestor_methods = method_provider(ancestor);
      for (const method of ancestor_methods) {
        if (!seen.has(method.name)) {
          seen.add(method.name);
          methods.push(method);
        }
      }
    }
  }
  
  return methods;
}