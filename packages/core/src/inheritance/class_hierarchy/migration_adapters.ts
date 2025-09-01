/**
 * TEMPORARY migration adapters for transitioning from local types to enhanced shared types.
 * 
 * @deprecated ALL functions in this file are temporary and will be removed after migration.
 * TODO: REMOVE this entire file once migration to enhanced shared types is complete.
 * 
 * These adapters allow gradual migration from local types to enhanced shared types
 * while maintaining backward compatibility during the transition period.
 */

import type { 
  ClassNode, 
  ClassHierarchy as SharedClassHierarchy,
  InheritanceEdge as SharedInheritanceEdge,
  MethodNode,
  PropertyNode
} from '@ariadnejs/types/classes';
import type { 
  ClassDefinition,
  MethodDefinition,
  PropertyDefinition,
  Definition
} from '@ariadnejs/types/definitions';
import type { Def } from '@ariadnejs/types';
import type { Language } from '@ariadnejs/types/common';
import type { ClassInfo, ClassHierarchy as LocalClassHierarchy, InheritanceEdge as LocalInheritanceEdge } from './types';
import type { ClassHierarchyContext } from './types';

/**
 * @deprecated TODO: REMOVE after migration
 * Convert old Def-based calls to new ClassDefinition-based system
 */
export function build_class_hierarchy_adapter(
  definitions: Def[],
  contexts: Map<string, ClassHierarchyContext>
): SharedClassHierarchy {
  console.warn('DEPRECATED: build_class_hierarchy with Def[] - migrate to ClassDefinition[]');
  
  // Convert Def to ClassDefinition
  const classDefs = definitions
    .filter((def): def is ClassDefinition => def.symbol_kind === 'class')
    .map(def => def as ClassDefinition);
  
  // Import the new implementation when ready
  const { build_class_hierarchy_new } = require('./class_hierarchy_new');
  return build_class_hierarchy_new(classDefs, contexts);
}

/**
 * @deprecated TODO: REMOVE after migration
 * Convert ClassInfo to ClassNode for new system
 */
export function class_info_to_class_node(
  info: ClassInfo,
  hierarchy: LocalClassHierarchy
): ClassNode {
  const def = info.definition;
  
  // Convert methods Map to ReadonlyMap
  const methods = new Map<string, MethodNode>();
  if (info.methods) {
    for (const [name, methodDef] of info.methods) {
      methods.set(name, method_definition_to_node(methodDef));
    }
  }
  
  // Convert properties Map to ReadonlyMap
  const properties = new Map<string, PropertyNode>();
  if (info.properties) {
    for (const [name, propDef] of info.properties) {
      properties.set(name, property_definition_to_node(propDef));
    }
  }
  
  return {
    name: def.name,
    file_path: def.file_path,
    location: def.location,
    base_classes: info.base_classes || [],
    derived_classes: info.derived_classes || [],
    interfaces: info.interfaces,
    is_abstract: info.is_abstract,
    is_interface: info.is_interface,
    is_trait: info.is_trait,
    methods: methods as ReadonlyMap<string, MethodNode>,
    properties: properties as ReadonlyMap<string, PropertyNode>,
    
    // Enhanced computed fields
    all_ancestors: info.all_ancestors?.map(a => 
      class_info_to_class_node(hierarchy.classes.get(get_qualified_name(a.definition))!, hierarchy)
    ),
    all_descendants: info.all_descendants?.map(d => 
      class_info_to_class_node(hierarchy.classes.get(get_qualified_name(d.definition))!, hierarchy)
    ),
    method_resolution_order: info.method_resolution_order?.map(m => 
      class_info_to_class_node(hierarchy.classes.get(get_qualified_name(m.definition))!, hierarchy)
    ),
    parent_class: info.parent_class_def ? 
      class_info_to_class_node(hierarchy.classes.get(get_qualified_name(info.parent_class_def))!, hierarchy) : 
      undefined,
  };
}

/**
 * @deprecated TODO: REMOVE after migration
 * Convert MethodDefinition to MethodNode
 */
function method_definition_to_node(def: MethodDefinition): MethodNode {
  return {
    name: def.name,
    location: def.location,
    is_override: def.is_override || false,
    overrides: def.overrides,
    overridden_by: def.overridden_by || [],
    visibility: def.visibility,
    is_static: def.is_static,
    is_abstract: def.is_abstract,
  };
}

/**
 * @deprecated TODO: REMOVE after migration
 * Convert PropertyDefinition to PropertyNode
 */
function property_definition_to_node(def: PropertyDefinition): PropertyNode {
  return {
    name: def.name,
    location: def.location,
    type: def.type,
    visibility: def.visibility,
    is_static: def.is_static,
    is_readonly: def.is_readonly,
  };
}

/**
 * @deprecated TODO: REMOVE after migration
 * Convert local hierarchy to shared hierarchy
 */
export function local_hierarchy_to_shared(
  local: LocalClassHierarchy
): SharedClassHierarchy {
  const classes = new Map<string, ClassNode>();
  
  // Convert all ClassInfo to ClassNode
  for (const [key, info] of local.classes) {
    classes.set(key, class_info_to_class_node(info, local));
  }
  
  // Convert edges
  const inheritance_edges: SharedInheritanceEdge[] = local.edges.map(edge => ({
    from: edge.from,
    to: edge.to,
    type: edge.type as 'extends' | 'implements' | 'trait' | 'mixin',
    source_location: edge.source_location,
  }));
  
  // Convert root classes
  const root_classes = new Set(local.roots);
  
  return {
    classes: classes as ReadonlyMap<string, ClassNode>,
    inheritance_edges,
    root_classes: root_classes as ReadonlySet<string>,
    language: local.language,
    metadata: {
      total_classes: classes.size,
    }
  };
}

/**
 * @deprecated TODO: REMOVE after migration
 * Convert ClassNode back to Def for legacy code
 */
export function class_node_to_def(node: ClassNode): Def {
  return {
    symbol_id: `${node.file_path}#${node.name}`,
    name: node.name,
    location: node.location,
    file_path: node.file_path,
    symbol_kind: node.is_interface ? 'interface' : 'class',
  } as Def;
}

/**
 * @deprecated TODO: REMOVE after migration
 * Get all ancestors as Def[] for legacy code
 */
export function get_all_ancestors_legacy(
  hierarchy: SharedClassHierarchy,
  class_name: string
): Def[] {
  const node = hierarchy.classes.get(class_name);
  if (!node?.all_ancestors) return [];
  
  return node.all_ancestors.map(class_node_to_def);
}

/**
 * @deprecated TODO: REMOVE after migration
 * Helper to get qualified name from Def
 */
function get_qualified_name(def: Def): string {
  return `${def.file_path}#${def.name}`;
}

/**
 * @deprecated TODO: REMOVE after migration
 * Wrapper for existing code that expects old signature
 */
export function build_class_hierarchy_with_contexts(
  defs: Def[],
  contexts: Map<string, ClassHierarchyContext>
): LocalClassHierarchy {
  // This would call the old implementation for now
  const { build_class_hierarchy } = require('./class_hierarchy');
  return build_class_hierarchy(defs, contexts);
}