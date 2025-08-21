/**
 * Rust trait implementation tracking
 * 
 * Handles Rust trait patterns:
 * - Trait definitions
 * - Trait implementations (impl Trait for Type)
 * - Associated types
 * - Default implementations
 * - Trait bounds
 */

import { SyntaxNode, Query } from 'tree-sitter';
import { Def } from '@ariadnejs/types';
import Parser from 'tree-sitter';
import { 
  InterfaceDefinition,
  InterfaceImplementation,
  MethodSignature,
  PropertySignature,
  extract_method_signature,
  extract_property_signature,
  check_implementation_compliance
} from './interface_implementation';

/**
 * Extract Rust trait definitions
 */
export function extract_rust_trait_definitions(
  tree: SyntaxNode,
  parser: Parser,
  source_code: string,
  file_path: string
): InterfaceDefinition[] {
  const traits: InterfaceDefinition[] = [];
  
  // Query for trait definitions
  const trait_query = new Query(
    parser.getLanguage(),
    `(trait_item
      name: (identifier) @trait_name
      body: (declaration_list) @body) @trait`
  );
  
  const matches = trait_query.matches(tree);
  
  for (const match of matches) {
    const trait_node = match.captures.find(c => c.name === 'trait')?.node;
    const name_node = match.captures.find(c => c.name === 'trait_name')?.node;
    const body_node = match.captures.find(c => c.name === 'body')?.node;
    
    if (!trait_node || !name_node || !body_node) continue;
    
    const trait_name = source_code.substring(name_node.startIndex, name_node.endIndex);
    
    // Create trait definition
    const trait_def: Def = {
      name: trait_name,
      symbol_id: `${file_path}:${trait_name}`,
      symbol_kind: 'interface',
      file_path,
      range: {
        start: { row: trait_node.startPosition.row, column: trait_node.startPosition.column },
        end: { row: trait_node.endPosition.row, column: trait_node.endPosition.column }
      }
    };
    
    // Extract members
    const members = extract_trait_members(body_node, source_code, file_path);
    
    // Build trait definition
    const definition = build_trait_definition(trait_def, members, trait_node, source_code);
    traits.push(definition);
  }
  
  return traits;
}

/**
 * Extract trait members
 */
function extract_trait_members(
  body: SyntaxNode,
  source_code: string,
  file_path: string
): Def[] {
  const members: Def[] = [];
  
  for (let i = 0; i < body.childCount; i++) {
    const child = body.child(i);
    if (!child) continue;
    
    switch (child.type) {
      case 'function_signature_item':
      case 'function_item': {
        const name_node = child.childForFieldName('name');
        if (name_node) {
          const method_name = source_code.substring(name_node.startIndex, name_node.endIndex);
          
          // Check if it has a body (default implementation)
          const has_body = child.type === 'function_item' && 
                          child.childForFieldName('body') !== null;
          
          members.push({
            name: method_name,
            symbol_id: `${file_path}:${method_name}`,
            symbol_kind: 'method',
            file_path,
            range: {
              start: { row: child.startPosition.row, column: child.startPosition.column },
              end: { row: child.endPosition.row, column: child.endPosition.column }
            },
            metadata: { has_default: has_body }
          });
        }
        break;
      }
      
      case 'associated_type': {
        const name_node = child.childForFieldName('name');
        if (name_node) {
          const type_name = source_code.substring(name_node.startIndex, name_node.endIndex);
          members.push({
            name: type_name,
            symbol_id: `${file_path}:${type_name}`,
            symbol_kind: 'property',
            file_path,
            range: {
              start: { row: child.startPosition.row, column: child.startPosition.column },
              end: { row: child.endPosition.row, column: child.endPosition.column }
            }
          });
        }
        break;
      }
    }
  }
  
  return members;
}

/**
 * Build trait definition
 */
function build_trait_definition(
  trait_def: Def,
  members: Def[],
  trait_node: SyntaxNode,
  source_code: string
): InterfaceDefinition {
  const required_methods: MethodSignature[] = [];
  const optional_methods: MethodSignature[] = [];
  const required_properties: PropertySignature[] = [];
  
  for (const member of members) {
    if (member.symbol_kind === 'method') {
      const method_sig = extract_method_signature(member);
      if (member.metadata?.has_default) {
        optional_methods.push(method_sig);
      } else {
        required_methods.push(method_sig);
      }
    } else if (member.symbol_kind === 'property') {
      // Associated types are like required properties
      required_properties.push(extract_property_signature(member));
    }
  }
  
  // Extract super traits
  const extends_traits = extract_super_traits(trait_node, source_code);
  
  return {
    definition: trait_def,
    required_methods,
    optional_methods: optional_methods.length > 0 ? optional_methods : undefined,
    required_properties: required_properties.length > 0 ? required_properties : undefined,
    extends_interfaces: extends_traits,
    language: 'rust'
  };
}

/**
 * Extract super traits (trait bounds)
 */
function extract_super_traits(trait_node: SyntaxNode, source_code: string): string[] {
  const super_traits: string[] = [];
  
  // Look for trait_bounds
  const bounds_node = trait_node.childForFieldName('bounds');
  if (bounds_node) {
    for (let i = 0; i < bounds_node.childCount; i++) {
      const child = bounds_node.child(i);
      if (child && child.type === 'trait_bound') {
        const trait_name = extract_trait_name_from_bound(child, source_code);
        if (trait_name) {
          super_traits.push(trait_name);
        }
      }
    }
  }
  
  return super_traits;
}

/**
 * Extract trait name from trait bound
 */
function extract_trait_name_from_bound(bound_node: SyntaxNode, source_code: string): string | null {
  const type_node = bound_node.childForFieldName('type');
  if (type_node) {
    if (type_node.type === 'type_identifier' || type_node.type === 'scoped_type_identifier') {
      return source_code.substring(type_node.startIndex, type_node.endIndex);
    }
  }
  return null;
}

/**
 * Find all trait implementations in Rust
 */
export function find_rust_trait_implementations(
  tree: SyntaxNode,
  parser: Parser,
  source_code: string,
  file_path: string,
  traits: InterfaceDefinition[]
): InterfaceImplementation[] {
  const implementations: InterfaceImplementation[] = [];
  
  // Query for impl blocks
  const impl_query = new Query(
    parser.getLanguage(),
    `(impl_item
      trait: [(type_identifier) (scoped_type_identifier) (generic_type)]? @trait_name
      type: [(type_identifier) (generic_type)] @type_name
      body: (declaration_list) @body) @impl`
  );
  
  const matches = impl_query.matches(tree);
  
  for (const match of matches) {
    const impl_node = match.captures.find(c => c.name === 'impl')?.node;
    const trait_name_node = match.captures.find(c => c.name === 'trait_name')?.node;
    const type_name_node = match.captures.find(c => c.name === 'type_name')?.node;
    const body_node = match.captures.find(c => c.name === 'body')?.node;
    
    if (!impl_node || !type_name_node || !body_node) continue;
    
    // Only process trait implementations (not inherent impls)
    if (!trait_name_node) continue;
    
    const trait_name = extract_type_name(trait_name_node, source_code);
    const type_name = extract_type_name(type_name_node, source_code);
    
    // Find the trait definition
    const trait_def = traits.find(t => t.definition.name === trait_name);
    if (!trait_def) continue;
    
    // Create type definition
    const type_def: Def = {
      name: type_name,
      symbol_id: `${file_path}:${type_name}`,
      symbol_kind: 'struct', // Could also be enum, but we'll default to struct
      file_path,
      range: {
        start: { row: impl_node.startPosition.row, column: impl_node.startPosition.column },
        end: { row: impl_node.endPosition.row, column: impl_node.endPosition.column }
      }
    };
    
    // Extract implemented methods and associated types
    const { methods, properties } = extract_impl_members(body_node, source_code, file_path);
    
    // Check compliance
    const implementation = check_implementation_compliance(
      type_def,
      trait_def,
      methods,
      properties
    );
    
    implementations.push(implementation);
  }
  
  return implementations;
}

/**
 * Extract type name from type node
 */
function extract_type_name(node: SyntaxNode, source_code: string): string {
  if (node.type === 'generic_type') {
    const type_node = node.childForFieldName('type');
    if (type_node) {
      return extract_type_name(type_node, source_code);
    }
  }
  
  if (node.type === 'scoped_type_identifier') {
    // For paths like std::fmt::Debug, just get the last part
    const name_node = node.childForFieldName('name');
    if (name_node) {
      return source_code.substring(name_node.startIndex, name_node.endIndex);
    }
  }
  
  return source_code.substring(node.startIndex, node.endIndex);
}

/**
 * Extract impl block members
 */
function extract_impl_members(
  body: SyntaxNode,
  source_code: string,
  file_path: string
): { methods: Def[]; properties: Def[] } {
  const methods: Def[] = [];
  const properties: Def[] = [];
  
  for (let i = 0; i < body.childCount; i++) {
    const child = body.child(i);
    if (!child) continue;
    
    switch (child.type) {
      case 'function_item': {
        const name_node = child.childForFieldName('name');
        if (name_node) {
          const method_name = source_code.substring(name_node.startIndex, name_node.endIndex);
          methods.push({
            name: method_name,
            symbol_id: `${file_path}:${method_name}`,
            symbol_kind: 'method',
            file_path,
            range: {
              start: { row: child.startPosition.row, column: child.startPosition.column },
              end: { row: child.endPosition.row, column: child.endPosition.column }
            }
          });
        }
        break;
      }
      
      case 'type_item': {
        // Associated type implementation
        const name_node = child.childForFieldName('name');
        if (name_node) {
          const type_name = source_code.substring(name_node.startIndex, name_node.endIndex);
          properties.push({
            name: type_name,
            symbol_id: `${file_path}:${type_name}`,
            symbol_kind: 'property',
            file_path,
            range: {
              start: { row: child.startPosition.row, column: child.startPosition.column },
              end: { row: child.endPosition.row, column: child.endPosition.column }
            }
          });
        }
        break;
      }
    }
  }
  
  return { methods, properties };
}

/**
 * Check if a type implements a trait through derive
 */
export function check_derive_implementation(
  struct_node: SyntaxNode,
  trait_name: string,
  source_code: string
): boolean {
  // Look for attribute items before the struct
  let current = struct_node.previousSibling;
  while (current) {
    if (current.type === 'attribute_item') {
      const attr_text = source_code.substring(current.startIndex, current.endIndex);
      if (attr_text.includes('derive') && attr_text.includes(trait_name)) {
        return true;
      }
    } else if (current.type !== 'line_comment' && current.type !== 'block_comment') {
      // Stop at non-attribute, non-comment nodes
      break;
    }
    current = current.previousSibling;
  }
  
  return false;
}

/**
 * Find structs and enums that might implement traits
 */
export function find_rust_types(
  tree: SyntaxNode,
  parser: Parser,
  source_code: string,
  file_path: string
): Def[] {
  const types: Def[] = [];
  
  // Query for structs and enums
  const type_query = new Query(
    parser.getLanguage(),
    `[(struct_item name: (type_identifier) @name)
      (enum_item name: (type_identifier) @name)] @type`
  );
  
  const matches = type_query.matches(tree);
  
  for (const match of matches) {
    const type_node = match.captures.find(c => c.name === 'type')?.node;
    const name_node = match.captures.find(c => c.name === 'name')?.node;
    
    if (!type_node || !name_node) continue;
    
    const type_name = source_code.substring(name_node.startIndex, name_node.endIndex);
    const type_kind = type_node.type === 'struct_item' ? 'struct' : 'enum';
    
    types.push({
      name: type_name,
      symbol_id: `${file_path}:${type_name}`,
      symbol_kind: type_kind as any,
      file_path,
      range: {
        start: { row: type_node.startPosition.row, column: type_node.startPosition.column },
        end: { row: type_node.endPosition.row, column: type_node.endPosition.column }
      }
    });
  }
  
  return types;
}