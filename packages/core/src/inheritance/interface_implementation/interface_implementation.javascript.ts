/**
 * JavaScript/TypeScript interface implementation tracking
 * 
 * Handles interface implementation patterns in JavaScript/TypeScript:
 * - TypeScript implements clause
 * - TypeScript interface extends
 * - Structural typing compatibility
 * - Abstract method implementation
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
 * Extract JavaScript interface definitions
 */
export function extract_javascript_interface_definitions(
  tree: SyntaxNode,
  parser: Parser,
  source_code: string,
  file_path: string
): InterfaceDefinition[] {
  const interfaces: InterfaceDefinition[] = [];
  
  // Query for interface declarations
  const interface_query = new Query(
    parser.getLanguage(),
    `(interface_declaration
      name: (type_identifier) @interface_name
      body: (interface_body) @body) @interface`
  );
  
  const matches = interface_query.matches(tree);
  
  for (const match of matches) {
    const interface_node = match.captures.find(c => c.name === 'interface')?.node;
    const name_node = match.captures.find(c => c.name === 'interface_name')?.node;
    const body_node = match.captures.find(c => c.name === 'body')?.node;
    
    if (!interface_node || !name_node || !body_node) continue;
    
    const interface_name = source_code.substring(name_node.startIndex, name_node.endIndex);
    
    // Create interface definition
    const interface_def: Def = {
      name: interface_name,
      symbol_id: `${file_path}:${interface_name}`,
      symbol_kind: 'interface',
      file_path,
      range: {
        start: { row: interface_node.startPosition.row, column: interface_node.startPosition.column },
        end: { row: interface_node.endPosition.row, column: interface_node.endPosition.column }
      }
    };
    
    // Extract members
    const members = extract_interface_members(body_node, source_code, file_path);
    
    // Build interface definition
    const definition = build_interface_definition(interface_def, members, interface_node, source_code);
    interfaces.push(definition);
  }
  
  return interfaces;
}

/**
 * Extract interface members from body
 */
function extract_interface_members(
  body: SyntaxNode,
  source_code: string,
  file_path: string
): Def[] {
  const members: Def[] = [];
  
  for (let i = 0; i < body.childCount; i++) {
    const child = body.child(i);
    if (!child) continue;
    
    switch (child.type) {
      case 'method_signature':
      case 'abstract_method_signature': {
        const name_node = child.childForFieldName('name');
        if (name_node) {
          const method_name = source_code.substring(name_node.startIndex, name_node.endIndex);
          members.push({
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
      
      case 'property_signature': {
        const name_node = child.childForFieldName('name');
        if (name_node) {
          const prop_name = source_code.substring(name_node.startIndex, name_node.endIndex);
          members.push({
            name: prop_name,
            symbol_id: `${file_path}:${prop_name}`,
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
 * Build interface definition from def and members
 */
function build_interface_definition(
  interface_def: Def,
  members: Def[],
  interface_node: SyntaxNode,
  source_code: string
): InterfaceDefinition {
  const required_methods: MethodSignature[] = [];
  const required_properties: PropertySignature[] = [];
  
  for (const member of members) {
    if (member.symbol_kind === 'method') {
      required_methods.push(extract_method_signature(member));
    } else if (member.symbol_kind === 'property') {
      required_properties.push(extract_property_signature(member));
    }
  }
  
  // Extract extended interfaces
  const extends_interfaces = extract_extended_interfaces(interface_node, source_code);
  
  return {
    definition: interface_def,
    required_methods,
    optional_methods: undefined,
    required_properties: required_properties.length > 0 ? required_properties : undefined,
    extends_interfaces,
    language: 'javascript'
  };
}

/**
 * Extract interfaces that this interface extends
 */
function extract_extended_interfaces(
  interface_node: SyntaxNode,
  source_code: string
): string[] {
  const extends_interfaces: string[] = [];
  
  // Look for extends_type_clause
  for (let i = 0; i < interface_node.childCount; i++) {
    const child = interface_node.child(i);
    if (child && child.type === 'extends_type_clause') {
      // Extract all extended interfaces
      for (let j = 0; j < child.childCount; j++) {
        const type_child = child.child(j);
        if (type_child && (type_child.type === 'type_identifier' || type_child.type === 'generic_type')) {
          const name = extract_type_name(type_child, source_code);
          if (name && name !== 'extends') {
            extends_interfaces.push(name);
          }
        }
      }
    }
  }
  
  return extends_interfaces;
}

/**
 * Extract type name from type node
 */
function extract_type_name(node: SyntaxNode, source_code: string): string {
  if (node.type === 'generic_type') {
    const name_node = node.childForFieldName('name');
    if (name_node) {
      return source_code.substring(name_node.startIndex, name_node.endIndex);
    }
  }
  return source_code.substring(node.startIndex, node.endIndex);
}

/**
 * Find all implementations of interfaces in JavaScript/TypeScript
 */
export function find_javascript_interface_implementations(
  tree: SyntaxNode,
  parser: Parser,
  source_code: string,
  file_path: string,
  interfaces: InterfaceDefinition[]
): InterfaceImplementation[] {
  const implementations: InterfaceImplementation[] = [];
  
  // Query for classes - use type_identifier for TypeScript
  const class_query = new Query(
    parser.getLanguage(),
    `(class_declaration
      name: (type_identifier) @class_name) @class`
  );
  
  const matches = class_query.matches(tree);
  
  for (const match of matches) {
    const class_node = match.captures.find(c => c.name === 'class')?.node;
    const name_node = match.captures.find(c => c.name === 'class_name')?.node;
    
    if (!class_node || !name_node) continue;
    
    // Look for implements clause in the class heritage
    let implements_node: SyntaxNode | null = null;
    
    // Find class_heritage child (not a field)
    for (let i = 0; i < class_node.childCount; i++) {
      const child = class_node.child(i);
      if (child && child.type === 'class_heritage') {
        // Look for implements_clause within heritage
        for (let j = 0; j < child.childCount; j++) {
          const heritage_child = child.child(j);
          if (heritage_child && heritage_child.type === 'implements_clause') {
            implements_node = heritage_child;
            break;
          }
        }
        break;
      }
    }
    
    const class_name = source_code.substring(name_node.startIndex, name_node.endIndex);
    
    // Create class definition
    const class_def: Def = {
      name: class_name,
      symbol_id: `${file_path}:${class_name}`,
      symbol_kind: 'class',
      file_path,
      range: {
        start: { row: class_node.startPosition.row, column: class_node.startPosition.column },
        end: { row: class_node.endPosition.row, column: class_node.endPosition.column }
      }
    };
    
    if (implements_node) {
      // Extract implemented interface names
      const implemented_interfaces = extract_implemented_interfaces(implements_node, source_code);
      
      // Check compliance for each interface
      for (const interface_name of implemented_interfaces) {
        const interface_def = interfaces.find(i => i.definition.name === interface_name);
        if (interface_def) {
          // Extract class methods and properties
          const class_body = class_node.childForFieldName('body');
          if (class_body) {
            const { methods, properties } = extract_class_members(class_body, source_code, file_path);
            
            // Check compliance
            const implementation = check_implementation_compliance(
              class_def,
              interface_def,
              methods,
              properties
            );
            
            implementations.push(implementation);
          }
        }
      }
    }
  }
  
  return implementations;
}

/**
 * Extract interface names from implements clause
 */
function extract_implemented_interfaces(
  implements_node: SyntaxNode,
  source_code: string
): string[] {
  const interfaces: string[] = [];
  
  for (let i = 0; i < implements_node.childCount; i++) {
    const child = implements_node.child(i);
    if (child && (child.type === 'type_identifier' || child.type === 'generic_type')) {
      const name = extract_type_name(child, source_code);
      if (name && name !== 'implements') {
        interfaces.push(name);
      }
    }
  }
  
  return interfaces;
}

/**
 * Extract class members
 */
function extract_class_members(
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
      case 'method_definition': {
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
      
      case 'public_field_definition':
      case 'property_definition': {
        const name_node = child.childForFieldName('name');
        if (name_node) {
          const prop_name = source_code.substring(name_node.startIndex, name_node.endIndex);
          properties.push({
            name: prop_name,
            symbol_id: `${file_path}:${prop_name}`,
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
 * Check if a class structurally implements an interface
 * (for implicit interface satisfaction in TypeScript)
 */
export function check_structural_implementation(
  class_def: Def,
  interface_def: InterfaceDefinition,
  class_methods: Def[],
  class_properties?: Def[]
): boolean {
  // Check all required methods exist
  for (const required_method of interface_def.required_methods) {
    const has_method = class_methods.some(m => m.name === required_method.name);
    if (!has_method) {
      return false;
    }
  }
  
  // Check all required properties exist
  if (interface_def.required_properties && class_properties) {
    for (const required_prop of interface_def.required_properties) {
      const has_prop = class_properties.some(p => p.name === required_prop.name);
      if (!has_prop) {
        return false;
      }
    }
  }
  
  return true;
}