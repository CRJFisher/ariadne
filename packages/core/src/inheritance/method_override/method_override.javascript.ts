/**
 * JavaScript/TypeScript Method Override Detection
 * 
 * Handles method override detection for JavaScript ES6+ and TypeScript,
 * including explicit override annotations in TypeScript.
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

/**
 * Extract methods from a JavaScript/TypeScript class
 */
export function extract_class_methods(
  class_node: SyntaxNode,
  class_def: Def,
  file_path: string
): Def[] {
  const methods: Def[] = [];
  
  // Find class body
  const body = class_node.childForFieldName('body');
  if (!body) return methods;
  
  // Iterate through class members
  for (let i = 0; i < body.childCount; i++) {
    const child = body.child(i);
    if (!child) continue;
    
    // Check for method definitions
    if (child.type === 'method_definition' || 
        child.type === 'public_field_definition') {
      
      const name_node = child.childForFieldName('name');
      if (!name_node) continue;
      
      const method_name = name_node.text;
      const is_static = child.children.some(c => c.type === 'static');
      const is_private = name_node.text.startsWith('#') || 
                         child.children.some(c => c.type === 'private');
      const is_protected = child.children.some(c => c.type === 'protected');
      const is_abstract = child.children.some(c => c.type === 'abstract');
      const has_override = child.children.some(c => c.type === 'override');
      
      // Skip static methods for override analysis
      if (is_static) continue;
      
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
export function find_parent_method(
  method: Def,
  class_info: ClassInfo,
  hierarchy: ClassHierarchy,
  all_methods: Map<string, Def[]>
): Def | undefined {
  const method_sig = extract_method_signature(method);
  
  // Check each ancestor class
  for (const ancestor of class_info.all_ancestors) {
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
export function find_child_overrides(
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
 * Build a simple class hierarchy for override detection
 */
function build_simple_hierarchy(
  ast: SyntaxNode,
  file_path: string,
  parser: Parser
): ClassHierarchy {
  const hierarchy: ClassHierarchy = {
    classes: new Map(),
    edges: [],
    roots: [],
    language: 'javascript'
  };
  
  // Query for all class declarations with inheritance
  // JavaScript uses class_heritage directly with the parent identifier
  const hierarchy_query = new Query(
    parser.getLanguage(),
    `
    (class_declaration
      name: (identifier) @class_name
      (class_heritage [(identifier) (member_expression)] @parent_name)?) @class
    `
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
 * Detect method overrides in JavaScript/TypeScript code
 */
export function detect_javascript_overrides(
  ast: SyntaxNode,
  file_path: string,
  parser: Parser
): MethodOverrideMap {
  // First, build a simple class hierarchy
  const hierarchy = build_simple_hierarchy(ast, file_path, parser);
  
  // Extract all methods from all classes
  const all_methods = new Map<string, Def[]>();
  const all_classes: Array<{ node: SyntaxNode; def: Def }> = [];
  
  // Query for all class declarations
  const class_query = new Query(
    parser.getLanguage(),
    `
    (class_declaration
      name: (identifier) @class_name) @class
    `
  );
  
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
    const methods = extract_class_methods(class_node, class_def, file_path);
    all_methods.set(class_name, methods);
  }
  
  // Now analyze override relationships
  const overrides = new Map<string, OverrideInfo>();
  const override_edges: MethodOverride[] = [];
  const leaf_methods: Def[] = [];
  const abstract_methods: Def[] = [];
  
  // Process each class and its methods
  for (const [class_name, class_info] of hierarchy.classes) {
    const methods = all_methods.get(class_name) || [];
    
    for (const method of methods) {
      const method_key = `${class_name}.${method.name}`;
      
      // Find parent method if this overrides
      const parent_method = find_parent_method(method, class_info, hierarchy, all_methods);
      
      // Find child overrides
      const child_overrides = find_child_overrides(method, class_info, hierarchy, all_methods);
      
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
            const ancestor_parent = find_parent_method(
              current, 
              ancestor_info, 
              hierarchy, 
              all_methods
            );
            if (ancestor_parent) {
              ancestors.unshift(ancestor_parent);
              current = ancestor_parent;
            }
          }
        }
        
        chain.unshift(...ancestors);
      }
      
      // Create override info
      const info: OverrideInfo = {
        method_def: method,
        overrides: parent_method,
        overridden_by: child_overrides,
        override_chain: chain,
        is_abstract: false, // TODO: Detect abstract methods in TypeScript
        is_final: false    // JavaScript doesn't have final methods
      };
      
      overrides.set(method_key, info);
      
      // Track leaf methods
      if (child_overrides.length === 0) {
        leaf_methods.push(method);
      }
      
      // Create override edge if this overrides something
      if (parent_method) {
        override_edges.push({
          method,
          base_method: parent_method,
          override_chain: chain,
          is_abstract: false,
          is_virtual: true, // All methods are virtual in JS
          is_explicit: false, // TODO: Check for TypeScript override keyword
          language: 'javascript'
        });
      }
    }
  }
  
  return {
    overrides,
    override_edges,
    leaf_methods,
    abstract_methods,
    language: 'javascript'
  };
}

// TODO: Symbol Resolution - Find parent implementation
