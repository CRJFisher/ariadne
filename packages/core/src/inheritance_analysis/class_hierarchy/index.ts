/**
 * Class hierarchy dispatcher
 * 
 * Routes class hierarchy operations to language-specific implementations
 */

import {
  ClassInfo,
  ClassHierarchy,
  ClassHierarchyContext,
  InheritanceEdge,
  build_class_hierarchy,
  is_class_like,
  extract_class_relationships as extract_class_relationships_core,
  find_class_by_name,
  get_parent_class,
  get_subclasses,
  get_implemented_interfaces,
  implements_interface,
  is_subclass_of,
  get_inheritance_path,
  get_all_methods,
  get_all_ancestors,
  get_all_descendants
} from './class_hierarchy';

import { extract_javascript_class_relationships } from './class_hierarchy.javascript';
import { extract_python_class_relationships } from './class_hierarchy.python';
import { extract_rust_class_relationships } from './class_hierarchy.rust';

// Re-export core types and functions
export {
  ClassInfo,
  ClassHierarchy,
  ClassHierarchyContext,
  InheritanceEdge,
  build_class_hierarchy,
  is_class_like,
  find_class_by_name,
  get_parent_class,
  get_subclasses,
  get_implemented_interfaces,
  implements_interface,
  is_subclass_of,
  get_inheritance_path,
  get_all_methods,
  get_all_ancestors,
  get_all_descendants
};

/**
 * Language-specific extraction routing
 */
export function extract_class_relationships(
  info: ClassInfo,
  context: ClassHierarchyContext
): void {
  const language = context.language.toLowerCase();
  
  switch (language) {
    case 'javascript':
    case 'jsx':
    case 'typescript':
    case 'tsx':
      extract_javascript_class_relationships(info, context);
      break;
    
    case 'python':
      extract_python_class_relationships(info, context);
      break;
    
    case 'rust':
      extract_rust_class_relationships(info, context);
      break;
    
    default:
      // Use core implementation as fallback
      extract_class_relationships_core(info, context);
      break;
  }
}

/**
 * Build class hierarchy with language-specific extraction
 */
export function build_class_hierarchy_with_extraction(
  definitions: import('@ariadnejs/types').Def[],
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
  
  // Second pass: Extract relationships using language-specific functions
  for (const [symbol_id, info] of hierarchy.classes) {
    const context = contexts.get(info.definition.file_path || '');
    if (!context) {
      continue;
    }
    
    // Use dispatcher to route to language-specific extraction
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
 * Resolve class names to actual definitions
 */
function resolve_class_references(
  hierarchy: ClassHierarchy,
  all_definitions: import('@ariadnejs/types').Def[]
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
      // Skip special markers like 'abstract' and 'metaclass:...'
      if (interface_name === 'abstract' || interface_name.startsWith('metaclass:')) {
        continue;
      }
      
      const interface_def = find_class_by_name(interface_name, all_definitions);
      if (interface_def) {
        info.interface_defs.push(interface_def);
      }
    }
  }
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
    
    // Add implements edges (or trait implementations for Rust)
    for (const interface_def of info.interface_defs) {
      const relationship_type = hierarchy.language === 'rust' ? 'trait' : 'implements';
      hierarchy.edges.push({
        child: info.definition,
        parent: interface_def,
        relationship_type,
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
 * Compute method resolution order
 */
function compute_method_resolution_order(hierarchy: ClassHierarchy): void {
  for (const info of hierarchy.classes.values()) {
    if (hierarchy.language === 'python') {
      // Python uses C3 linearization
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
): import('@ariadnejs/types').Def[] {
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
 * Export convenience function that matches the module pattern
 */
export default {
  build_class_hierarchy: build_class_hierarchy_with_extraction,
  extract_class_relationships,
  is_class_like,
  find_class_by_name,
  get_parent_class,
  get_subclasses,
  get_implemented_interfaces,
  implements_interface,
  is_subclass_of,
  get_inheritance_path,
  get_all_methods,
  get_all_ancestors,
  get_all_descendants
};