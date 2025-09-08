/**
 * Rust-specific method override handling
 * 
 * Handles Rust's unique features:
 * - Trait implementations
 * - Default trait methods
 * - Associated functions vs methods
 */

import { Parser, Query, SyntaxNode } from 'tree-sitter';
import { Def } from '@ariadnejs/types';
import { MethodOverrideContext } from './method_override.generic';
import { MethodOverride } from './method_override';

/**
 * Handle Rust trait implementations
 * 
 * In Rust, "overrides" are trait method implementations
 */
export function handle_rust_trait_implementations(
  ast: SyntaxNode,
  file_path: string,
  parser: Parser,
  context: MethodOverrideContext
): void {
  const { config, override_edges, overrides } = context;
  
  // First, extract trait definitions
  const trait_methods = extract_trait_definitions(ast, file_path, parser);
  
  if (!config.queries.override_detection) {
    return;
  }
  
  // Query for trait implementations
  const impl_query = new Query(
    parser.getLanguage(),
    config.queries.override_detection
  );
  
  const matches = impl_query.matches(ast);
  const impl_methods = new Map<string, Def[]>();
  
  // Process impl blocks
  for (const match of matches) {
    const impl_node = match.captures.find(c => c.name === 'impl')?.node;
    const trait_name = match.captures.find(c => c.name === 'trait_name')?.node;
    const type_name = match.captures.find(c => c.name === 'type_name')?.node;
    const method_name = match.captures.find(c => c.name === 'method_name')?.node;
    
    if (!impl_node || !type_name || !method_name) continue;
    
    const impl_key = trait_name 
      ? `${type_name.text}::${trait_name.text}`
      : type_name.text;
    
    // Create method def
    const method: Def = {
      name: method_name.text,
      kind: 'method',
      file_path,
      start_line: method_name.startPosition.row + 1,
      start_column: method_name.startPosition.column,
      end_line: method_name.endPosition.row + 1,
      end_column: method_name.endPosition.column,
      extent_start_line: method_name.startPosition.row + 1,
      extent_start_column: method_name.startPosition.column,
      extent_end_line: method_name.endPosition.row + 1,
      extent_end_column: method_name.endPosition.column
    };
    
    // Store impl methods
    const methods = impl_methods.get(impl_key) || [];
    methods.push(method);
    impl_methods.set(impl_key, methods);
    
    // If this is a trait impl, create override relationship
    if (trait_name) {
      // Look for trait definition (would need cross-file support)
      const trait_method = find_trait_method(trait_name.text, method_name.text, trait_methods);
      
      if (trait_method) {
        // Create override edge
        const edge: MethodOverride = {
          method,
          base_method: trait_method,
          override_chain: [trait_method, method],
          is_abstract: false, // Rust doesn't have abstract methods
          is_virtual: false, // Rust uses static dispatch by default
          is_explicit: true, // Trait impls are always explicit
          language: 'rust'
        };
        
        override_edges.push(edge);
        
        // Update override info
        const key = `${type_name.text}.${method_name.text}`;
        overrides.set(key, {
          method_def: method,
          overrides: trait_method,
          overridden_by: [],
          override_chain: [trait_method, method],
          is_abstract: false,
          is_final: false
        });
      }
    }
  }
}

/**
 * Find trait method definition
 * 
 * This is a placeholder - would need cross-file support to properly
 * find trait definitions
 */
function find_trait_method(
  trait_name: string,
  method_name: string,
  trait_methods: Map<string, Def[]>
): Def | undefined {
  const methods = trait_methods.get(trait_name) || [];
  return methods.find(m => m.name === method_name);
}

/**
 * Extract trait definitions
 * 
 * This would extract trait method signatures for matching with implementations
 */
export function extract_trait_definitions(
  ast: SyntaxNode,
  file_path: string,
  parser: Parser
): Map<string, Def[]> {
  const trait_methods = new Map<string, Def[]>();
  
  // Query for trait definitions
  const trait_query = new Query(
    parser.getLanguage(),
    `
    (trait_item
      (type_identifier) @trait_name
      (declaration_list
        (function_signature_item
          (identifier) @method_name))) @trait
    (trait_item
      (type_identifier) @trait_name
      (declaration_list
        (function_item
          (identifier) @method_name))) @trait
    `
  );
  
  const matches = trait_query.matches(ast);
  
  for (const match of matches) {
    const trait_name = match.captures.find(c => c.name === 'trait_name')?.node;
    const method_name = match.captures.find(c => c.name === 'method_name')?.node;
    
    if (!trait_name || !method_name) continue;
    
    const method: Def = {
      name: method_name.text,
      kind: 'method',
      file_path,
      start_line: method_name.startPosition.row + 1,
      start_column: method_name.startPosition.column,
      end_line: method_name.endPosition.row + 1,
      end_column: method_name.endPosition.column,
      extent_start_line: method_name.startPosition.row + 1,
      extent_start_column: method_name.startPosition.column,
      extent_end_line: method_name.endPosition.row + 1,
      extent_end_column: method_name.endPosition.column
    };
    
    const methods = trait_methods.get(trait_name.text) || [];
    methods.push(method);
    trait_methods.set(trait_name.text, methods);
  }
  
  return trait_methods;
}