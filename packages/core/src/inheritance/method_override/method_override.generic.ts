/**
 * Generic Method Override Detection
 * 
 * Configuration-driven processor that handles ~85% of override detection logic
 */

import { Parser, Query, SyntaxNode } from 'tree-sitter';
import { Def } from '@ariadnejs/types';
import { 
  ClassHierarchy,
  ClassInfo
} from '../class_hierarchy/class_hierarchy';
import {
  MethodOverride,
  OverrideInfo,
  MethodOverrideMap,
  MethodSignature,
  extract_method_signature,
  signatures_match
} from './method_override';
import {
  MethodOverrideConfig,
  get_language_config,
  has_override_marker,
  has_abstract_marker,
  is_static_method,
  should_skip_method
} from './language_configs';

/**
 * Module context for sharing between generic and bespoke handlers
 */
export interface MethodOverrideContext {
  config: MethodOverrideConfig;
  hierarchy: ClassHierarchy;
  all_methods: Map<string, Def[]>;
  overrides: Map<string, OverrideInfo>;
  override_edges: MethodOverride[];
  leaf_methods: Def[];
  abstract_methods: Def[];
}

export const MODULE_CONTEXT = 'method_override';

/**
 * Extract methods from a class using configuration
 */
export function extract_class_methods_generic(
  class_node: SyntaxNode,
  class_def: Def,
  file_path: string,
  config: MethodOverrideConfig
): Def[] {
  const methods: Def[] = [];
  
  // Find class body
  const body = class_node.childForFieldName(config.class_body_field);
  if (!body) return methods;
  
  // Iterate through class members
  for (let i = 0; i < body.childCount; i++) {
    const child = body.child(i);
    if (!child) continue;
    
    // Check for method definitions
    if (config.method_types.includes(child.type)) {
      const name_node = child.childForFieldName(config.method_name_field);
      if (!name_node) continue;
      
      const method_name = name_node.text;
      
      // Check skip patterns
      if (should_skip_method(method_name, config)) {
        continue;
      }
      
      // Skip static methods for override analysis
      if (is_static_method(child, config)) {
        continue;
      }
      
      const method: Def = {
        name: method_name,
        kind: 'method',
        file_path,
        start_line: child.startPosition.row + 1,
        start_column: child.startPosition.column,
        end_line: child.endPosition.row + 1,
        end_column: child.endPosition.column,
        extent_start_line: child.startPosition.row + 1,
        extent_start_column: child.startPosition.column,
        extent_end_line: child.endPosition.row + 1,
        extent_end_column: child.endPosition.column
      };
      
      methods.push(method);
    }
  }
  
  return methods;
}

/**
 * Find methods in parent classes that match a given method signature
 */
export function find_parent_method_generic(
  method: Def,
  class_info: ClassInfo,
  hierarchy: ClassHierarchy,
  all_methods: Map<string, Def[]>,
  config: MethodOverrideConfig
): Def | undefined {
  const method_sig = extract_method_signature(method);
  
  // Use MRO if available (for Python), otherwise use all_ancestors
  const ancestors = config.features.has_multiple_inheritance && 
                    class_info.method_resolution_order.length > 0
    ? class_info.method_resolution_order
    : class_info.all_ancestors;
  
  // Check each ancestor class
  for (const ancestor of ancestors) {
    const ancestor_methods = all_methods.get(ancestor.name) || [];
    
    for (const ancestor_method of ancestor_methods) {
      const ancestor_sig = extract_method_signature(ancestor_method);
      
      if (signatures_match(method_sig, ancestor_sig)) {
        return ancestor_method;
      }
    }
  }
  
  return undefined;
}

/**
 * Find methods in child classes that override a given method
 */
export function find_child_overrides_generic(
  method: Def,
  class_info: ClassInfo,
  hierarchy: ClassHierarchy,
  all_methods: Map<string, Def[]>
): Def[] {
  const overrides: Def[] = [];
  const method_sig = extract_method_signature(method);
  
  // Check each descendant class
  for (const descendant of class_info.all_descendants) {
    const descendant_methods = all_methods.get(descendant.name) || [];
    
    for (const descendant_method of descendant_methods) {
      const descendant_sig = extract_method_signature(descendant_method);
      
      if (signatures_match(method_sig, descendant_sig)) {
        overrides.push(descendant_method);
      }
    }
  }
  
  return overrides;
}

/**
 * Build a simple class hierarchy using configuration
 */
export function build_hierarchy_generic(
  ast: SyntaxNode,
  file_path: string,
  parser: Parser,
  config: MethodOverrideConfig
): ClassHierarchy {
  const hierarchy: ClassHierarchy = {
    classes: new Map(),
    edges: [],
    roots: [],
    language: parser.getLanguage().name
  };
  
  if (!config.queries.class_hierarchy) {
    return hierarchy;
  }
  
  // Use configured query to extract class hierarchy
  const hierarchy_query = new Query(
    parser.getLanguage(),
    config.queries.class_hierarchy
  );
  
  const matches = hierarchy_query.matches(ast);
  const class_map = new Map<string, { def: Def; parent?: string }>();
  
  for (const match of matches) {
    const class_node = match.captures.find(c => c.name === 'class')?.node;
    const name_node = match.captures.find(c => c.name === 'class_name')?.node;
    const parent_node = match.captures.find(c => c.name === 'parent_name')?.node;
    
    if (!class_node || !name_node) continue;
    
    const class_name = name_node.text;
    const parent_name = parent_node?.text;
    
    const class_def: Def = {
      name: class_name,
      kind: 'class',
      file_path,
      start_line: class_node.startPosition.row + 1,
      start_column: class_node.startPosition.column,
      end_line: class_node.endPosition.row + 1,
      end_column: class_node.endPosition.column,
      extent_start_line: class_node.startPosition.row + 1,
      extent_start_column: class_node.startPosition.column,
      extent_end_line: class_node.endPosition.row + 1,
      extent_end_column: class_node.endPosition.column
    };
    
    class_map.set(class_name, { def: class_def, parent: parent_name });
  }
  
  // Build class info and hierarchy
  for (const [class_name, { def, parent }] of class_map) {
    const class_info: ClassInfo = {
      definition: def,
      parent_class: parent,
      parent_class_def: parent ? class_map.get(parent)?.def : undefined,
      implemented_interfaces: [],
      interface_defs: [],
      subclasses: [],
      all_ancestors: [],
      all_descendants: [],
      method_resolution_order: []
    };
    
    // Find ancestors
    let current_parent = parent;
    while (current_parent) {
      const parent_info = class_map.get(current_parent);
      if (parent_info?.def) {
        class_info.all_ancestors.push(parent_info.def);
      }
      current_parent = parent_info?.parent;
    }
    
    hierarchy.classes.set(class_name, class_info);
  }
  
  // Find descendants
  for (const [class_name, class_info] of hierarchy.classes) {
    for (const [other_name, other_info] of hierarchy.classes) {
      if (other_info.parent_class === class_name) {
        class_info.subclasses.push(other_info.definition);
        class_info.all_descendants.push(other_info.definition);
      }
    }
  }
  
  // Find roots
  for (const [class_name, class_info] of hierarchy.classes) {
    if (!class_info.parent_class) {
      hierarchy.roots.push(class_info.definition);
    }
  }
  
  return hierarchy;
}

/**
 * Generic method override detection
 */
export function detect_overrides_generic(
  ast: SyntaxNode,
  file_path: string,
  parser: Parser,
  language: string,
  bespoke_handler?: (context: MethodOverrideContext) => void
): MethodOverrideMap {
  const config = get_language_config(language);
  
  if (!config) {
    return {
      overrides: new Map(),
      override_edges: [],
      leaf_methods: [],
      abstract_methods: [],
      language
    };
  }
  
  // Build class hierarchy
  const hierarchy = build_hierarchy_generic(ast, file_path, parser, config);
  
  // Extract all methods from all classes
  const all_methods = new Map<string, Def[]>();
  const all_classes: Array<{ node: SyntaxNode; def: Def }> = [];
  
  // Query for all class declarations
  let class_query_text: string;
  
  if (language === 'typescript' || language === 'javascript') {
    class_query_text = `(class_declaration name: (_) @class_name) @class`;
  } else if (language === 'python') {
    class_query_text = `(class_definition name: (identifier) @class_name) @class`;
  } else if (language === 'rust') {
    // For Rust, we need to handle impl blocks differently
    class_query_text = `
      (impl_item type: (_) @class_name) @class
      (struct_item name: (type_identifier) @class_name) @class
    `;
  } else {
    // Default fallback
    class_query_text = config.class_types
      .map(type => `(${type} name: (_) @class_name) @class`)
      .join('\n');
  }
  
  const class_query = new Query(parser.getLanguage(), class_query_text);
  const class_matches = class_query.matches(ast);
  
  for (const match of class_matches) {
    const class_node = match.captures.find(c => c.name === 'class')?.node;
    const name_node = match.captures.find(c => c.name === 'class_name')?.node;
    
    if (!class_node || !name_node) continue;
    
    const class_name = name_node.text;
    const class_def: Def = {
      name: class_name,
      kind: 'class',
      file_path,
      start_line: class_node.startPosition.row + 1,
      start_column: class_node.startPosition.column,
      end_line: class_node.endPosition.row + 1,
      end_column: class_node.endPosition.column,
      extent_start_line: class_node.startPosition.row + 1,
      extent_start_column: class_node.startPosition.column,
      extent_end_line: class_node.endPosition.row + 1,
      extent_end_column: class_node.endPosition.column
    };
    
    all_classes.push({ node: class_node, def: class_def });
    
    // Extract methods from this class
    const methods = extract_class_methods_generic(class_node, class_def, file_path, config);
    all_methods.set(class_name, methods);
  }
  
  // Initialize context
  const context: MethodOverrideContext = {
    config,
    hierarchy,
    all_methods,
    overrides: new Map(),
    override_edges: [],
    leaf_methods: [],
    abstract_methods: []
  };
  
  // Process each class and its methods
  for (const [class_name, class_info] of hierarchy.classes) {
    const methods = all_methods.get(class_name) || [];
    
    for (const method of methods) {
      const method_key = `${class_name}.${method.name}`;
      
      // Find parent method if this overrides
      const parent_method = find_parent_method_generic(
        method, 
        class_info, 
        hierarchy, 
        all_methods, 
        config
      );
      
      // Find child overrides
      const child_overrides = find_child_overrides_generic(
        method, 
        class_info, 
        hierarchy, 
        all_methods
      );
      
      // Build override chain
      const chain: Def[] = [method];
      if (parent_method) {
        // Walk up to find all ancestors
        let current = parent_method;
        const ancestors = [current];
        
        // Find parent class of current method
        for (const [ancestor_name, ancestor_info] of hierarchy.classes) {
          const ancestor_methods = all_methods.get(ancestor_name) || [];
          if (ancestor_methods.includes(current)) {
            const ancestor_parent = find_parent_method_generic(
              current, 
              ancestor_info, 
              hierarchy, 
              all_methods,
              config
            );
            if (ancestor_parent) {
              ancestors.unshift(ancestor_parent);
              current = ancestor_parent;
            }
          }
        }
        
        chain.unshift(...ancestors);
      }
      
      // Check for abstract/override markers
      const is_abstract = false; // Will be set by bespoke handler if needed
      const is_explicit = false; // Will be set by bespoke handler if needed
      
      // Create override info
      const info: OverrideInfo = {
        method_def: method,
        overrides: parent_method,
        overridden_by: child_overrides,
        override_chain: chain,
        is_abstract,
        is_final: false // JavaScript/Python don't have final methods
      };
      
      context.overrides.set(method_key, info);
      
      // Track leaf methods
      if (child_overrides.length === 0) {
        context.leaf_methods.push(method);
      }
      
      // Create override edge if this overrides something
      if (parent_method) {
        context.override_edges.push({
          method,
          base_method: parent_method,
          override_chain: chain,
          is_abstract: false,
          is_virtual: true, // Most methods are virtual by default
          is_explicit: false,
          language
        });
      }
    }
  }
  
  // Call bespoke handler for language-specific logic
  if (bespoke_handler) {
    bespoke_handler(context);
  }
  
  return {
    overrides: context.overrides,
    override_edges: context.override_edges,
    leaf_methods: context.leaf_methods,
    abstract_methods: context.abstract_methods,
    language
  };
}