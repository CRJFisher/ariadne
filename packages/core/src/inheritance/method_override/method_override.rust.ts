/**
 * Rust Method Override Detection
 * 
 * Handles trait method implementations and default method overrides in Rust.
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
 * Extract trait name from impl block
 */
function extract_trait_name(impl_node: SyntaxNode): string | null {
  // Look for trait in impl block: impl Trait for Type
  const trait_node = impl_node.children.find((child, index) => {
    // Check if this is the trait part (comes before 'for')
    const next = impl_node.child(index + 1);
    return next?.type === 'for' && child.type !== 'impl';
  });
  
  if (trait_node) {
    if (trait_node.type === 'type_identifier') {
      return trait_node.text;
    } else if (trait_node.type === 'scoped_type_identifier') {
      // Handle path::to::Trait
      const name = trait_node.childForFieldName('name');
      return name?.text || null;
    }
  }
  
  return null;
}

/**
 * Extract type name from impl block
 */
function extract_impl_type(impl_node: SyntaxNode): string | null {
  // Look for type after 'for' keyword
  let found_for = false;
  for (const child of impl_node.children) {
    if (child.type === 'for') {
      found_for = true;
    } else if (found_for && 
               (child.type === 'type_identifier' || 
                child.type === 'generic_type')) {
      if (child.type === 'generic_type') {
        const type_node = child.childForFieldName('type');
        return type_node?.text || null;
      }
      return child.text;
    }
  }
  
  // If no 'for', this is a direct impl block
  if (!found_for) {
    for (const child of impl_node.children) {
      if (child.type === 'type_identifier' || child.type === 'generic_type') {
        if (child.type === 'generic_type') {
          const type_node = child.childForFieldName('type');
          return type_node?.text || null;
        }
        return child.text;
      }
    }
  }
  
  return null;
}

/**
 * Extract methods from a Rust impl block
 */
export function extract_impl_methods(
  impl_node: SyntaxNode,
  file_path: string
): Array<{ method: Def; trait_name: string | null; type_name: string | null }> {
  const methods: Array<{ method: Def; trait_name: string | null; type_name: string | null }> = [];
  
  const trait_name = extract_trait_name(impl_node);
  const type_name = extract_impl_type(impl_node);
  
  // Find impl body
  const body = impl_node.childForFieldName('body');
  if (!body) return methods;
  
  // Iterate through impl items
  for (let i = 0; i < body.childCount; i++) {
    const child = body.child(i);
    if (!child) continue;
    
    // Check for function items
    if (child.type === 'function_item') {
      const name_node = child.childForFieldName('name');
      if (!name_node) continue;
      
      const method_name = name_node.text;
      
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
      
      methods.push({ method, trait_name, type_name });
    }
  }
  
  return methods;
}

/**
 * Extract methods from trait definitions
 */
export function extract_trait_methods(
  trait_node: SyntaxNode,
  file_path: string
): Def[] {
  const methods: Def[] = [];
  
  // Find trait body
  const body = trait_node.childForFieldName('body');
  if (!body) return methods;
  
  // Iterate through trait items
  for (let i = 0; i < body.childCount; i++) {
    const child = body.child(i);
    if (!child) continue;
    
    // Check for function signatures or default implementations
    if (child.type === 'function_signature_item' || 
        child.type === 'function_item') {
      const name_node = child.childForFieldName('name');
      if (!name_node) continue;
      
      const method_name = name_node.text;
      
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
 * Build a simple trait hierarchy for Rust
 */
function build_simple_hierarchy(
  ast: SyntaxNode,
  file_path: string
): ClassHierarchy {
  // For Rust, we create a minimal hierarchy focused on traits
  // Structs don't have inheritance, but traits can have super traits
  const hierarchy: ClassHierarchy = {
    classes: new Map(),
    edges: [],
    roots: [],
    language: 'rust'
  };
  
  // We'll treat traits as "classes" for the purpose of method override detection
  // This is a simplified model since Rust's trait system is different from OOP
  return hierarchy;
}

/**
 * Detect method overrides in Rust code
 */
export function detect_rust_overrides(
  ast: SyntaxNode,
  file_path: string,
  parser: Parser
): MethodOverrideMap {
  // Build a simple hierarchy (mostly empty for Rust)
  const hierarchy = build_simple_hierarchy(ast, file_path);
  
  // Map trait names to their methods
  const trait_methods = new Map<string, Def[]>();
  
  // Map type+trait to implemented methods
  const impl_methods = new Map<string, Def[]>();
  
  // Query for trait definitions
  const trait_query = new Query(
    parser.getLanguage(),
    `
    (trait_item
      name: (type_identifier) @trait_name) @trait
    `
  );
  
  const trait_matches = trait_query.matches(ast);
  
  for (const match of trait_matches) {
    const trait_node = match.captures.find(c => c.name === 'trait')?.node;
    const name_node = match.captures.find(c => c.name === 'trait_name')?.node;
    
    if (!trait_node || !name_node) continue;
    
    const trait_name = name_node.text;
    const methods = extract_trait_methods(trait_node, file_path);
    trait_methods.set(trait_name, methods);
  }
  
  // Query for impl blocks
  const impl_query = new Query(
    parser.getLanguage(),
    `
    (impl_item) @impl
    `
  );
  
  const impl_matches = impl_query.matches(ast);
  
  for (const match of impl_matches) {
    const impl_node = match.captures.find(c => c.name === 'impl')?.node;
    if (!impl_node) continue;
    
    const methods = extract_impl_methods(impl_node, file_path);
    
    for (const { method, trait_name, type_name } of methods) {
      if (trait_name && type_name) {
        const key = `${type_name}::${trait_name}`;
        const existing = impl_methods.get(key) || [];
        existing.push(method);
        impl_methods.set(key, existing);
      }
    }
  }
  
  // Now analyze override relationships
  const overrides = new Map<string, OverrideInfo>();
  const override_edges: MethodOverride[] = [];
  const leaf_methods: Def[] = [];
  const abstract_methods: Def[] = [];
  
  // Process trait implementations
  for (const [impl_key, methods] of impl_methods) {
    const [type_name, trait_name] = impl_key.split('::');
    const trait_method_list = trait_methods.get(trait_name) || [];
    
    for (const method of methods) {
      const method_key = `${impl_key}.${method.name}`;
      
      // Find corresponding trait method
      const trait_method = trait_method_list.find(
        tm => tm.name === method.name
      );
      
      // Build override chain
      const chain: Def[] = [method];
      if (trait_method) {
        chain.unshift(trait_method);
      }
      
      // Create override info
      const info: OverrideInfo = {
        method_def: method,
        overrides: trait_method,
        overridden_by: [], // TODO: Find other impls of same trait
        override_chain: chain,
        is_abstract: false, // Rust doesn't have abstract methods
        is_final: false    // Rust doesn't have final methods
      };
      
      overrides.set(method_key, info);
      
      // All impl methods are leaf methods unless overridden elsewhere
      leaf_methods.push(method);
      
      // Create override edge if this implements a trait method
      if (trait_method) {
        override_edges.push({
          method,
          base_method: trait_method,
          override_chain: chain,
          is_abstract: false,
          is_virtual: false, // Rust uses static dispatch by default
          is_explicit: true, // All trait impls are explicit
          language: 'rust'
        });
      }
    }
  }
  
  // Process trait default methods that might be overridden
  for (const [trait_name, methods] of trait_methods) {
    for (const method of methods) {
      const method_key = `trait::${trait_name}.${method.name}`;
      
      // Check if any type implements this trait and overrides this method
      const overriding_impls: Def[] = [];
      
      for (const [impl_key, impl_method_list] of impl_methods) {
        if (impl_key.endsWith(`::${trait_name}`)) {
          const override = impl_method_list.find(m => m.name === method.name);
          if (override) {
            overriding_impls.push(override);
          }
        }
      }
      
      // Only add to map if not already processed
      if (!overrides.has(method_key)) {
        const info: OverrideInfo = {
          method_def: method,
          overrides: undefined,
          overridden_by: overriding_impls,
          override_chain: [method],
          is_abstract: false,
          is_final: false
        };
        
        overrides.set(method_key, info);
        
        if (overriding_impls.length === 0) {
          leaf_methods.push(method);
        }
      }
    }
  }
  
  return {
    overrides,
    override_edges,
    leaf_methods,
    abstract_methods, // Rust doesn't have abstract methods
    language: 'rust'
  };
}

// TODO: Symbol Resolution - Find parent implementation
