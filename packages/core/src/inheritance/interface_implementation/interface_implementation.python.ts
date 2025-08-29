/**
 * Python protocol and ABC implementation tracking
 * 
 * Handles Python interface patterns:
 * - Protocol classes (PEP 544)
 * - Abstract Base Classes (ABC)
 * - Duck typing
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
 * Extract Python protocol/ABC definitions
 */
export function extract_python_interface_definitions(
  tree: SyntaxNode,
  parser: Parser,
  source_code: string,
  file_path: string
): InterfaceDefinition[] {
  const interfaces: InterfaceDefinition[] = [];
  
  // Query for Protocol and ABC classes
  const protocol_query = new Query(
    parser.getLanguage(),
    `(class_definition
      name: (identifier) @class_name
      superclasses: (argument_list) @bases
      body: (block) @body) @class`
  );
  
  const matches = protocol_query.matches(tree);
  
  for (const match of matches) {
    const class_node = match.captures.find(c => c.name === 'class')?.node;
    const name_node = match.captures.find(c => c.name === 'class_name')?.node;
    const bases_node = match.captures.find(c => c.name === 'bases')?.node;
    const body_node = match.captures.find(c => c.name === 'body')?.node;
    
    if (!class_node || !name_node || !body_node) continue;
    
    const class_name = source_code.substring(name_node.startIndex, name_node.endIndex);
    
    // Check if this is a Protocol or ABC
    if (bases_node && is_protocol_or_abc(bases_node, source_code)) {
      // Create interface definition
      const interface_def: Def = {
        name: class_name,
        symbol_id: `${file_path}:${class_name}`,
        symbol_kind: 'interface',
        file_path,
        range: {
          start: { row: class_node.startPosition.row, column: class_node.startPosition.column },
          end: { row: class_node.endPosition.row, column: class_node.endPosition.column }
        }
      };
      
      // Extract members
      const members = extract_protocol_members(body_node, source_code, file_path);
      
      // Build interface definition
      const definition = build_protocol_definition(interface_def, members, bases_node, source_code);
      interfaces.push(definition);
    }
  }
  
  return interfaces;
}

/**
 * Check if class inherits from Protocol or ABC
 */
function is_protocol_or_abc(bases_node: SyntaxNode, source_code: string): boolean {
  for (let i = 0; i < bases_node.childCount; i++) {
    const child = bases_node.child(i);
    if (!child) continue;
    
    const base_text = source_code.substring(child.startIndex, child.endIndex);
    if (base_text.includes('Protocol') || 
        base_text.includes('ABC') || 
        base_text.includes('ABCMeta')) {
      return true;
    }
  }
  return false;
}

/**
 * Extract protocol/ABC members
 */
function extract_protocol_members(
  body: SyntaxNode,
  source_code: string,
  file_path: string
): Def[] {
  const members: Def[] = [];
  
  for (let i = 0; i < body.childCount; i++) {
    const child = body.child(i);
    if (!child) continue;
    
    switch (child.type) {
      case 'function_definition': {
        const name_node = child.childForFieldName('name');
        if (name_node) {
          const method_name = source_code.substring(name_node.startIndex, name_node.endIndex);
          
          // Check if abstract method
          const is_abstract = has_abstractmethod_decorator(child, source_code);
          
          members.push({
            name: method_name,
            symbol_id: `${file_path}:${method_name}`,
            symbol_kind: 'method',
            file_path,
            range: {
              start: { row: child.startPosition.row, column: child.startPosition.column },
              end: { row: child.endPosition.row, column: child.endPosition.column }
            },
            metadata: { is_abstract }
          });
        }
        break;
      }
      
      case 'expression_statement': {
        // Check for type annotations (property declarations)
        const annotation = child.childForFieldName('annotation');
        if (annotation) {
          const name_node = child.child(0);
          if (name_node && name_node.type === 'identifier') {
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
        }
        break;
      }
    }
  }
  
  return members;
}

/**
 * Check if method has @abstractmethod decorator
 */
function has_abstractmethod_decorator(func_node: SyntaxNode, source_code: string): boolean {
  // Look for decorator_list
  for (let i = 0; i < func_node.childCount; i++) {
    const child = func_node.child(i);
    if (child && child.type === 'decorator') {
      const decorator_text = source_code.substring(child.startIndex, child.endIndex);
      if (decorator_text.includes('abstractmethod')) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Build protocol/ABC definition
 */
function build_protocol_definition(
  interface_def: Def,
  members: Def[],
  bases_node: SyntaxNode,
  source_code: string
): InterfaceDefinition {
  const required_methods: MethodSignature[] = [];
  const optional_methods: MethodSignature[] = [];
  const required_properties: PropertySignature[] = [];
  
  for (const member of members) {
    if (member.symbol_kind === 'method') {
      const method_sig = extract_method_signature(member);
      if (member.metadata?.is_abstract) {
        required_methods.push(method_sig);
      } else {
        optional_methods.push(method_sig);
      }
    } else if (member.symbol_kind === 'property') {
      required_properties.push(extract_property_signature(member));
    }
  }
  
  // Extract parent protocols
  const extends_interfaces = extract_parent_protocols(bases_node, source_code);
  
  return {
    definition: interface_def,
    required_methods,
    optional_methods: optional_methods.length > 0 ? optional_methods : undefined,
    required_properties: required_properties.length > 0 ? required_properties : undefined,
    extends_interfaces,
    language: 'python'
  };
}

/**
 * Extract parent protocols/ABCs
 */
function extract_parent_protocols(bases_node: SyntaxNode, source_code: string): string[] {
  const parents: string[] = [];
  
  for (let i = 0; i < bases_node.childCount; i++) {
    const child = bases_node.child(i);
    if (!child || child.type === ',') continue;
    
    const base_text = source_code.substring(child.startIndex, child.endIndex);
    // Filter out Protocol and ABC base classes
    if (!base_text.includes('Protocol') && 
        !base_text.includes('ABC') && 
        !base_text.includes('ABCMeta')) {
      parents.push(base_text);
    }
  }
  
  return parents;
}

/**
 * Find all protocol/ABC implementations in Python
 */
export function find_python_interface_implementations(
  tree: SyntaxNode,
  parser: Parser,
  source_code: string,
  file_path: string,
  interfaces: InterfaceDefinition[]
): InterfaceImplementation[] {
  const implementations: InterfaceImplementation[] = [];
  
  // Query for all classes
  const class_query = new Query(
    parser.getLanguage(),
    `(class_definition
      name: (identifier) @class_name
      superclasses: (argument_list)? @bases
      body: (block) @body) @class`
  );
  
  const matches = class_query.matches(tree);
  
  for (const match of matches) {
    const class_node = match.captures.find(c => c.name === 'class')?.node;
    const name_node = match.captures.find(c => c.name === 'class_name')?.node;
    const bases_node = match.captures.find(c => c.name === 'bases')?.node;
    const body_node = match.captures.find(c => c.name === 'body')?.node;
    
    if (!class_node || !name_node || !body_node) continue;
    
    const class_name = source_code.substring(name_node.startIndex, name_node.endIndex);
    
    // Skip if this is itself a Protocol/ABC
    if (bases_node && is_protocol_or_abc(bases_node, source_code)) {
      continue;
    }
    
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
    
    // Check if class inherits from any protocols
    if (bases_node) {
      const inherited_protocols = extract_inherited_protocols(bases_node, source_code, interfaces);
      
      for (const interface_def of inherited_protocols) {
        // Extract class methods and properties
        const { methods, properties } = extract_class_members(body_node, source_code, file_path);
        
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
    
    // Also check for duck typing (structural implementation)
    // Python doesn't require explicit inheritance for protocols
    for (const interface_def of interfaces) {
      if (interface_def.definition.name.endsWith('Protocol')) {
        const { methods, properties } = extract_class_members(body_node, source_code, file_path);
        
        // Check if class structurally satisfies the protocol
        if (check_duck_typing_implementation(class_def, interface_def, methods, properties)) {
          const implementation = check_implementation_compliance(
            class_def,
            interface_def,
            methods,
            properties
          );
          
          // Only add if not already tracked
          const already_tracked = implementations.some(
            impl => impl.implementor.symbol_id === class_def.symbol_id &&
                   impl.interface_def.definition.symbol_id === interface_def.definition.symbol_id
          );
          
          if (!already_tracked) {
            implementations.push(implementation);
          }
        }
      }
    }
  }
  
  return implementations;
}

/**
 * Extract protocols that a class inherits from
 */
function extract_inherited_protocols(
  bases_node: SyntaxNode,
  source_code: string,
  interfaces: InterfaceDefinition[]
): InterfaceDefinition[] {
  const inherited: InterfaceDefinition[] = [];
  
  for (let i = 0; i < bases_node.childCount; i++) {
    const child = bases_node.child(i);
    if (!child || child.type === ',') continue;
    
    const base_name = source_code.substring(child.startIndex, child.endIndex);
    const interface_def = interfaces.find(i => i.definition.name === base_name);
    
    if (interface_def) {
      inherited.push(interface_def);
    }
  }
  
  return inherited;
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
      case 'function_definition': {
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
      
      case 'expression_statement': {
        // Check for attribute assignments
        const assignment = child.child(0);
        if (assignment && assignment.type === 'assignment') {
          const left = assignment.childForFieldName('left');
          if (left && left.type === 'attribute') {
            const attr_name = left.childForFieldName('attribute');
            if (attr_name) {
              const prop_name = source_code.substring(attr_name.startIndex, attr_name.endIndex);
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
          }
        }
        break;
      }
    }
  }
  
  return { methods, properties };
}

/**
 * Check if a class structurally implements a protocol (duck typing)
 */
function check_duck_typing_implementation(
  class_def: Def,
  protocol_def: InterfaceDefinition,
  class_methods: Def[],
  class_properties?: Def[]
): boolean {
  // Check all required methods exist
  for (const required_method of protocol_def.required_methods) {
    const has_method = class_methods.some(m => m.name === required_method.name);
    if (!has_method) {
      return false;
    }
  }
  
  // Check all required properties exist
  if (protocol_def.required_properties && class_properties) {
    for (const required_prop of protocol_def.required_properties) {
      const has_prop = class_properties.some(p => p.name === required_prop.name);
      if (!has_prop) {
        return false;
      }
    }
  }
  
  return true;
}