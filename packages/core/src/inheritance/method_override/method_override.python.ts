/**
 * Python Method Override Detection
 * 
 * Handles method override detection for Python, including
 * @override decorators (Python 3.12+) and ABC abstract methods.
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
 * Check if a method has the @override decorator (Python 3.12+)
 */
function has_override_decorator(method_node: SyntaxNode): boolean {
  // Check for decorator list
  const decorator_list = method_node.children.find(c => c.type === 'decorator');
  if (!decorator_list) return false;
  
  // Look for @override decorator
  const decorator_name = decorator_list.childForFieldName('name');
  return decorator_name?.text === 'override';
}

/**
 * Check if a method is abstract (@abstractmethod)
 */
function is_abstract_method(method_node: SyntaxNode): boolean {
  // Check for decorator list
  for (const child of method_node.children) {
    if (child.type === 'decorator') {
      const name = child.childForFieldName('name');
      if (name?.text === 'abstractmethod' || 
          name?.text === 'abc.abstractmethod') {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if a method is a classmethod or staticmethod
 */
function is_class_or_static_method(method_node: SyntaxNode): boolean {
  for (const child of method_node.children) {
    if (child.type === 'decorator') {
      const name = child.childForFieldName('name');
      if (name?.text === 'classmethod' || name?.text === 'staticmethod') {
        return true;
      }
    }
  }
  return false;
}

/**
 * Extract methods from a Python class
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
    
    // Check for function definitions
    if (child.type === 'function_definition') {
      const name_node = child.childForFieldName('name');
      if (!name_node) continue;
      
      const method_name = name_node.text;
      
      // Skip magic methods except __init__
      if (method_name.startsWith('__') && method_name.endsWith('__') && 
          method_name !== '__init__') {
        continue;
      }
      
      // Skip class and static methods for override analysis
      if (is_class_or_static_method(child)) {
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
export function find_parent_method(
  method: Def,
  class_info: ClassInfo,
  hierarchy: ClassHierarchy,
  all_methods: Map<string, Def[]>
): Def | undefined {
  const method_sig = extract_method_signature(method);
  
  // Python uses Method Resolution Order (MRO) for multiple inheritance
  // Use the MRO from class_info if available
  const ancestors = class_info.method_resolution_order.length > 0 
    ? class_info.method_resolution_order 
    : class_info.all_ancestors;
  
  // Check each ancestor class in MRO order
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
 * Build a simple class hierarchy for Python
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
    language: 'python'
  };
  
  // Query for all class definitions with superclasses
  const hierarchy_query = new Query(
    parser.getLanguage(),
    `
    (class_definition
      name: (identifier) @class_name
      superclasses: (argument_list)? @parents) @class
    `
  );
  
  const matches = hierarchy_query.matches(ast);
  const class_map = new Map<string, { def: Def; parents: string[] }>();
  
  for (const match of matches) {
    const class_node = match.captures.find(c => c.name === 'class')?.node;
    const name_node = match.captures.find(c => c.name === 'class_name')?.node;
    const parents_node = match.captures.find(c => c.name === 'parents')?.node;
    
    if (!class_node || !name_node) continue;
    
    const class_name = name_node.text;
    const parents: string[] = [];
    
    // Extract parent class names
    if (parents_node) {
      for (let i = 0; i < parents_node.childCount; i++) {
        const child = parents_node.child(i);
        if (child?.type === 'identifier' || child?.type === 'attribute') {
          parents.push(child.text);
        }
      }
    }
    
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
    
    class_map.set(class_name, { def: class_def, parents });
  }
  
  // Build class info and hierarchy
  for (const [class_name, { def, parents }] of class_map) {
    const class_info: ClassInfo = {
      definition: def,
      parent_class: parents[0], // Primary parent
      parent_class_def: parents[0] ? class_map.get(parents[0])?.def : undefined,
      implemented_interfaces: [],
      interface_defs: [],
      subclasses: [],
      all_ancestors: [],
      all_descendants: [],
      method_resolution_order: []
    };
    
    // Find ancestors (simplified MRO)
    for (const parent of parents) {
      const parent_info = class_map.get(parent);
      if (parent_info?.def) {
        class_info.all_ancestors.push(parent_info.def);
        class_info.method_resolution_order.push(parent_info.def);
      }
    }
    
    hierarchy.classes.set(class_name, class_info);
  }
  
  // Find descendants
  for (const [class_name, class_info] of hierarchy.classes) {
    for (const [other_name, { parents }] of class_map) {
      if (parents.includes(class_name)) {
        const other_info = hierarchy.classes.get(other_name);
        if (other_info) {
          class_info.subclasses.push(other_info.definition);
          class_info.all_descendants.push(other_info.definition);
        }
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
 * Detect method overrides in Python code
 */
export function detect_python_overrides(
  ast: SyntaxNode,
  file_path: string,
  parser: Parser
): MethodOverrideMap {
  // First, build a simple class hierarchy
  const hierarchy = build_simple_hierarchy(ast, file_path, parser);
  
  // Extract all methods from all classes
  const all_methods = new Map<string, Def[]>();
  const all_classes: Array<{ node: SyntaxNode; def: Def }> = [];
  const method_nodes = new Map<string, SyntaxNode>();
  
  // Query for all class definitions
  const class_query = new Query(
    parser.getLanguage(),
    `
    (class_definition
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
    
    // Store method nodes for decorator checking
    const body = class_node.childForFieldName('body');
    if (body) {
      for (let i = 0; i < body.childCount; i++) {
        const child = body.child(i);
        if (child?.type === 'function_definition') {
          const name_node = child.childForFieldName('name');
          if (name_node) {
            method_nodes.set(`${class_name}.${name_node.text}`, child);
          }
        }
      }
    }
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
      const method_node = method_nodes.get(method_key);
      
      // Check if method is abstract
      const is_abstract = method_node ? is_abstract_method(method_node) : false;
      if (is_abstract) {
        abstract_methods.push(method);
      }
      
      // Check for explicit override decorator
      const has_explicit_override = method_node ? has_override_decorator(method_node) : false;
      
      // Find parent method if this overrides
      const parent_method = find_parent_method(method, class_info, hierarchy, all_methods);
      
      // Find child overrides
      const child_overrides = find_child_overrides(method, class_info, hierarchy, all_methods);
      
      // Build override chain
      const chain: Def[] = [method];
      if (parent_method) {
        // Walk up to find all ancestors using MRO
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
        is_abstract,
        is_final: false // Python doesn't have final methods (until @final decorator)
      };
      
      overrides.set(method_key, info);
      
      // Track leaf methods
      if (child_overrides.length === 0) {
        leaf_methods.push(method);
      }
      
      // Create override edge if this overrides something
      if (parent_method) {
        // Check if parent is abstract
        const parent_key = `${parent_method.file_path}.${parent_method.name}`;
        const parent_node = method_nodes.get(parent_key);
        const parent_is_abstract = parent_node ? is_abstract_method(parent_node) : false;
        
        override_edges.push({
          method,
          base_method: parent_method,
          override_chain: chain,
          is_abstract: parent_is_abstract,
          is_virtual: true, // All methods are virtual in Python
          is_explicit: has_explicit_override,
          language: 'python'
        });
      }
    }
  }
  
  return {
    overrides,
    override_edges,
    leaf_methods,
    abstract_methods,
    language: 'python'
  };
}

// TODO: Symbol Resolution - Find parent implementation
