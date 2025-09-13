/**
 * Generic class hierarchy builder
 * 
 * Provides configuration-driven processing for building class hierarchies
 * across all supported languages. Language-specific features are handled
 * through bespoke handlers.
 */

import { SyntaxNode } from 'tree-sitter';
import {
  ClassNode,
  ClassHierarchy,
  InheritanceEdge,
  MethodNode,
  PropertyNode,
  Language,
  QualifiedName,
  ClassDefinition,
  MethodDefinition,
  PropertyDefinition,
  FilePath,
  SourceCode,
  ClassName,
  InterfaceName,
  MethodName,
  PropertyName,
  SymbolId,
  method_symbol,
  property_symbol,
  Location
} from '@ariadnejs/types';
import {
  get_class_hierarchy_config,
  is_type_reference_node,
  ClassHierarchyConfig
} from './language_configs';
import { AnyLocationFormat, extract_target_position } from '../../ast/location_utils';

/**
 * Module context for refactoring tracking
 */
export const CLASS_HIERARCHY_CONTEXT = {
  module: 'class_hierarchy',
  refactored: true,
  version: '2.0.0'
};

/**
 * Context for building class hierarchy
 */
export interface ClassHierarchyContext {
  tree: any; // Parser.Tree
  source_code: SourceCode;
  file_path: FilePath;
  language: Language;
  all_definitions?: ClassDefinition[];
}

/**
 * Bespoke handlers for language-specific features
 */
export interface BespokeHandlers {
  /**
   * Extract trait implementations (Rust)
   */
  extract_trait_implementations?: (
    def: ClassDefinition,
    context: ClassHierarchyContext
  ) => string[];
  
  /**
   * Extract metaclass (Python)
   */
  extract_metaclass?: (
    def: ClassDefinition,
    context: ClassHierarchyContext
  ) => string | undefined;
  
  /**
   * Detect abstract base class (Python)
   */
  detect_abstract_base?: (
    def: ClassDefinition,
    context: ClassHierarchyContext
  ) => boolean;
  
  /**
   * Extract super traits (Rust)
   */
  extract_super_traits?: (
    def: ClassDefinition,
    context: ClassHierarchyContext
  ) => string[];
  
  /**
   * Post-process class node
   */
  post_process_node?: (
    node: ClassNode,
    def: ClassDefinition,
    context: ClassHierarchyContext
  ) => void;
}

/**
 * Build class hierarchy using generic processing
 */
export function build_generic_class_hierarchy(
  definitions: ClassDefinition[],
  contexts: Map<FilePath, ClassHierarchyContext>,
  handlers: Map<Language, BespokeHandlers> = new Map()
): ClassHierarchy {
  const classes = new Map<SymbolId, ClassNode>();
  const edges: InheritanceEdge[] = [];
  const roots = new Set<ClassName>();
  
  // First pass: Create all ClassNodes
  for (const def of definitions) {
    // Use symbol_id if available (for tests), otherwise use qualified name
    const key = (def as any).symbol_id || `${def.location.file_path}#${def.name}`;
    const context = contexts.get(def.location.file_path);
    
    if (!context) continue;
    
    // Extract inheritance relationships
    const relationships = extract_relationships_generic(def, context, handlers.get(context.language));
    
    const node: ClassNode = {
      name: def.name as ClassName,
      file_path: def.location.file_path,
      location: def.location,
      base_classes: relationships.base_classes,
      derived_classes: [],
      interfaces: relationships.interfaces,
      is_abstract: def.is_abstract ?? relationships.is_abstract ?? false,
      is_interface: def.is_interface ?? false,
      is_trait: def.is_trait ?? false,
      is_mixin: def.is_mixin ?? false,
      methods: build_method_map(def.methods, def.name as ClassName, def.location),
      properties: build_property_map(def.properties, def.name as ClassName, def.location),
      
      // Enhanced fields - defaults to empty arrays
      all_ancestors: [],
      all_descendants: [],
      method_resolution_order: [],
      parent_class: null, // Explicit null for no parent
      interface_nodes: [],
    };
    
    // Apply bespoke post-processing
    const handler = handlers.get(context.language);
    if (handler?.post_process_node) {
      handler.post_process_node(node, def, context);
    }
    
    classes.set(key, node);
    
    // Track root classes
    if (!relationships.base_classes || relationships.base_classes.length === 0) {
      roots.add(def.name as ClassName);
    }
    
    // Build inheritance edges
    for (const base of relationships.base_classes) {
      edges.push({
        from: def.name as QualifiedName,
        to: base as QualifiedName,
        type: 'extends',
        source_location: def.location,
      });
    }
    
    for (const iface of relationships.interfaces) {
      edges.push({
        from: def.name as QualifiedName,
        to: iface as QualifiedName,
        type: 'implements',
        source_location: def.location,
      });
    }
  }
  
  // Second pass: Populate derived_classes and compute enhanced fields
  compute_derived_classes(classes, edges);
  compute_enhanced_fields(classes, edges);
  
  return {
    classes,
    inheritance_edges: edges,
    root_classes: roots,
    metadata: {
      build_time: Date.now(),
      total_classes: classes.size,
      max_depth: compute_max_depth(classes, roots),
    },
  };
}

/**
 * Extract inheritance relationships using configuration
 */
function extract_relationships_generic(
  def: ClassDefinition,
  context: ClassHierarchyContext,
  handlers?: BespokeHandlers
): {
  base_classes: ClassName[];
  interfaces: InterfaceName[];
  is_abstract: boolean;
} {
  const config = get_class_hierarchy_config(context.language);
  const base_classes: ClassName[] = [];
  const interfaces: InterfaceName[] = [];
  let is_abstract = false;
  
  // Find the AST node for this definition
  // Handle both location and range formats from tests
  const location_info = def.location || (def as any).range;

  // Type guard: ensure tree and rootNode exist
  if (!context.tree || !context.tree.rootNode) {
    return { base_classes, interfaces, is_abstract };
  }

  const ast_node = find_node_at_location(
    context.tree.rootNode,
    location_info
  );
  
  if (!ast_node) {
    return { base_classes, interfaces, is_abstract };
  }
  
  // Extract extends relationships
  for (const pattern of config.inheritance_patterns.extends_patterns) {
    const bases = extract_by_pattern(ast_node, pattern, context, config);
    base_classes.push(...bases);
  }
  
  // Extract implements relationships
  for (const pattern of config.inheritance_patterns.implements_patterns) {
    const impls = extract_by_pattern(ast_node, pattern, context, config);
    interfaces.push(...impls);
  }
  
  // Handle multiple inheritance (Python)
  if (config.inheritance_patterns.multiple_inheritance) {
    const mi = config.inheritance_patterns.multiple_inheritance;
    const bases = extract_multiple_inheritance(ast_node, mi, context, config);
    if (bases.length > 0) {
      if (mi.first_is_primary) {
        base_classes.push(bases[0]);
        interfaces.push(...bases.slice(1));
      } else {
        base_classes.push(...bases);
      }
    }
  }
  
  // Extract derive attributes (Rust)
  if (config.attribute_patterns?.derive_pattern) {
    const derived = extract_derive_attributes(ast_node, config, context);
    interfaces.push(...derived);
  }
  
  // Apply bespoke handlers
  if (handlers) {
    // Rust trait implementations
    if (handlers.extract_trait_implementations) {
      const traits = handlers.extract_trait_implementations(def, context);
      interfaces.push(...traits);
    }
    
    // Python metaclass
    if (handlers.extract_metaclass) {
      const metaclass = handlers.extract_metaclass(def, context);
      if (metaclass) {
        interfaces.push(`metaclass:${metaclass}`);
      }
    }
    
    // Python ABC detection
    if (handlers.detect_abstract_base) {
      is_abstract = handlers.detect_abstract_base(def, context);
    }
    
    // Rust super traits
    if (handlers.extract_super_traits) {
      const super_traits = handlers.extract_super_traits(def, context);
      base_classes.push(...super_traits);
    }
  }
  
  return {
    base_classes: [...new Set(base_classes)],
    interfaces: [...new Set(interfaces)],
    is_abstract
  };
}

/**
 * Extract types by pattern
 */
function extract_by_pattern(
  node: SyntaxNode,
  pattern: { node_type?: string; field_name?: string; keyword?: string },
  context: ClassHierarchyContext,
  config: ClassHierarchyConfig
  ): ClassName[] {
  const results: ClassName[] = [];
  
  // Find the pattern node
  let pattern_node: SyntaxNode | null = null;
  
  if (pattern.field_name) {
    pattern_node = node.childForFieldName(pattern.field_name);
  } else if (pattern.node_type) {
    pattern_node = find_child_by_type(node, pattern.node_type);
  }
  
  if (!pattern_node) return results;
  
  // Extract type references from the pattern node
  for (let i = 0; i < pattern_node.childCount; i++) {
    const child = pattern_node.child(i);
    if (!child) continue;
    
    // Skip keywords
    if (child.type === pattern.keyword) continue;
    
    // Extract type reference
    if (is_type_reference_node(child.type, context.language)) {
      const name = extract_type_name(child, context.source_code, config);
      if (name) results.push(name as ClassName);
    }
  }
  
  return results;
}

/**
 * Extract multiple inheritance (Python)
 */
function extract_multiple_inheritance(
  node: SyntaxNode,
  mi_config: { container_type: string; container_field?: string; first_is_primary: boolean },
  context: ClassHierarchyContext,
  config: ClassHierarchyConfig
): string[] {
  const results: ClassName[] = [];
  
  // Find the container node
  let container: SyntaxNode | null = null;
  
  if (mi_config.container_field) {
    container = node.childForFieldName(mi_config.container_field);
  } else {
    container = find_child_by_type(node, mi_config.container_type);
  }
  
  if (!container || container.type !== mi_config.container_type) {
    return results;
  }
  
  // Extract all base classes
  for (let i = 0; i < container.childCount; i++) {
    const child = container.child(i);
    if (!child) continue;
    
    // Skip punctuation
    if (child.type === '(' || child.type === ')' || child.type === ',') continue;
    
    // Skip keyword arguments (Python metaclass)
    if (child.type === 'keyword_argument') continue;
    
    // Extract base class name
    const name = extract_type_name(child, context.source_code, config);
    if (name) results.push(name as ClassName);
  }
  
  return results;
}

/**
 * Extract derive attributes (Rust)
 */
function extract_derive_attributes(
  node: SyntaxNode,
  config: ClassHierarchyConfig,
  context: ClassHierarchyContext
): ClassName[] {
  const results: ClassName[] = [];
  
  if (!config.attribute_patterns?.derive_pattern) return results;
  
  const derive = config.attribute_patterns.derive_pattern;
  
  // Look for attribute items before the node
  let prev = node.previousSibling;
  while (prev) {
    if (prev.type === derive.attribute_type) {
      // Check if it's a derive attribute
      const attr = find_child_by_type(prev, 'attribute');
      if (attr && attr.childCount > 0) {
        const first = attr.child(0);
        if (first && first.text === derive.attribute_name) {
          // Extract trait names from the container
          const container = find_child_by_type(attr, derive.traits_container);
          if (container) {
            const traits = extract_derive_traits(container, context.source_code);
            results.push(...traits as ClassName[]);
          }
        }
      }
    }
    prev = prev.previousSibling;
  }
  
  return results;
}

/**
 * Extract trait names from derive attribute
 */
function extract_derive_traits(node: SyntaxNode, source_code: string): string[] {
  const traits: string[] = [];
  const text = source_code.substring(node.startIndex, node.endIndex);
  
  // Simple extraction from derive(...) text
  const match = text.match(/\(([^)]+)\)/);
  if (match) {
    const trait_list = match[1];
    const trait_names = trait_list.split(',').map(t => t.trim());
    traits.push(...trait_names);
  }
  
  return traits;
}

/**
 * Extract type name from reference node
 */
function extract_type_name(
  node: SyntaxNode,
  source_code: string,
  config: ClassHierarchyConfig
): string | null {
  // Handle generic types
  if (config.type_reference_patterns.generic_type_pattern &&
      node.type === config.type_reference_patterns.generic_type_pattern.node_type) {
    const name_node = node.childForFieldName(
      config.type_reference_patterns.generic_type_pattern.name_field
    );
    if (name_node) {
      return extract_type_name(name_node, source_code, config);
    }
  }
  
  // For most cases, return the full text
  return source_code.substring(node.startIndex, node.endIndex);
}

/**
 * Find child node by type
 */
function find_child_by_type(node: SyntaxNode, type: string): SyntaxNode | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && child.type === type) {
      return child;
    }
  }
  
  // Recursively search children
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      const found = find_child_by_type(child, type);
      if (found) return found;
    }
  }
  
  return null;
}

/**
 * Find node at location
 */
function find_node_at_location(
  root: SyntaxNode,
  location: AnyLocationFormat
): SyntaxNode | null {
  // Extract target position using shared utility
  const position = extract_target_position(location);
  const { row: target_row, column: target_column } = position;
  
  // Find node that contains the location
  function search(node: SyntaxNode): SyntaxNode | null {
    const start = node.startPosition;
    const end = node.endPosition;
    
    // Check if location is within this node
    if (target_row >= start.row && target_row <= end.row) {
      // If this is a class/interface/struct definition node, return it
      if (node.type === 'class_declaration' ||
          node.type === 'abstract_class_declaration' ||
          node.type === 'interface_declaration' ||
          node.type === 'class_definition' ||
          node.type === 'struct_item' ||
          node.type === 'enum_item' ||
          node.type === 'trait_item') {
        return node;
      }
      
      // Check children for more specific match
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          const found = search(child);
          if (found) return found;
        }
      }
      return node;
    }
    
    return null;
  }
  
  return search(root);
}

// Helper functions from original implementation

/**
 * Build a Map of methods from definitions
 */
function build_method_map(
  methods: readonly MethodDefinition[],
  class_name: ClassName,
  class_location: Location
): ReadonlyMap<SymbolId, MethodNode> {
  const map = new Map<SymbolId, MethodNode>();
  
  for (const method of methods) {
    const node: MethodNode = {
      name: method.name as MethodName,
      location: method.location,
      is_override: method.is_override || false,
      overrides: method.overrides,
      overridden_by: method.overridden_by || [],
      visibility: method.visibility ?? (method.is_private ? "private" : method.is_protected ? "protected" : "public"),
      is_static: method.is_static,
      is_abstract: method.is_abstract,
    };
    
    const symbol_id = method_symbol(method.name, class_name, class_location);
    map.set(symbol_id, node);
  }
  
  return map;
}

/**
 * Build a Map of properties from definitions
 */
function build_property_map(
  properties: readonly PropertyDefinition[],
  class_name: ClassName,
  class_location: Location
): ReadonlyMap<SymbolId, PropertyNode> {
  const map = new Map<SymbolId, PropertyNode>();
  
  for (const property of properties) {
    const node: PropertyNode = {
    name: property.name as PropertyName,
      location: property.location,
      type: property.type,
      visibility: property.visibility ?? (property.is_private ? "private" : property.is_protected ? "protected" : "public"),
      is_static: property.is_static,
      is_readonly: property.is_readonly,
    };
    
    const symbol_id = property_symbol(property.name, class_name, class_location);
    map.set(symbol_id, node);
  }
  
  return map;
}

/**
 * Populate derived_classes based on inheritance edges
 */
function compute_derived_classes(
  classes: Map<SymbolId, ClassNode>,
  edges: InheritanceEdge[]
): void {
  for (const edge of edges) {
    if (edge.type === 'extends') {
      // Find the base class and add this as a derived class
      for (const [key, node] of classes) {
        if (node.name === edge.to as ClassName) {
          // Safe mutation during building phase
          (node as any).derived_classes = [...(node.derived_classes || []), edge.from];
          break;
        }
      }
    }
  }
}

/**
 * Compute enhanced fields
 */
function compute_enhanced_fields(
  classes: Map<SymbolId, ClassNode>,
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
        if (parent.name === parent_name as ClassName) {
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
  classes: Map<SymbolId, ClassNode>,
  edges: InheritanceEdge[]
): ClassNode[] {
  const ancestors: ClassNode[] = [];
  const visited = new Set<ClassName>();
  
  function visit(current: ClassNode): void {
    if (!current.base_classes) return;
    
    for (const base_name of current.base_classes) {
      if (visited.has(base_name as ClassName)) continue;
      visited.add(base_name);
      
      // Find the base class node
      for (const [key, base_node] of classes) {
        if (base_node.name === base_name as ClassName) {
          ancestors.push(base_node);
          visit(base_node);
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
  classes: Map<SymbolId, ClassNode>
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
          visit(derived_node);
          break;
        }
      }
    }
  }
  
  visit(node);
  return descendants;
}

/**
 * Compute method resolution order
 */
function compute_mro(
  node: ClassNode,
  classes: Map<SymbolId, ClassNode>,
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
  classes: Map<SymbolId, ClassNode>,
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