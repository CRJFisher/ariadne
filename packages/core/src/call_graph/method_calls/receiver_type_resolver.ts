/**
 * Receiver Type Resolver
 * 
 * Resolves the type of method receivers using type information
 * from the type_tracking layer (Layer 3).
 */

import { SyntaxNode } from 'tree-sitter';
import { TypeInfo } from '../../type_analysis/type_tracking';
import { Language } from '@ariadnejs/types';

/**
 * Extended method call info with resolved type information
 */
export interface MethodCallWithType {
  caller_name: string;
  method_name: string;
  receiver_name: string;
  receiver_type?: string;  // The resolved type of the receiver
  defining_class?: string; // The class that defines this method
  location: {
    line: number;
    column: number;
    end_line?: number;
    end_column?: number;
  };
  is_static_method: boolean;
  is_chained_call: boolean;
  arguments_count: number;
}

/**
 * Resolve the type of a method receiver
 * 
 * @param receiver The receiver AST node
 * @param type_map Map of variable names to their type information
 * @param source_code The source code string
 * @param language The programming language
 * @returns The resolved type name or undefined
 */
export function resolve_receiver_type(
  receiver: SyntaxNode,
  type_map: Map<string, TypeInfo[]> | undefined,
  source_code: string,
  language: Language
): string | undefined {
  if (!type_map) {
    return undefined;
  }

  const receiver_text = get_node_text(receiver, source_code);
  
  // Check if receiver is a simple variable with known type
  const type_history = type_map.get(receiver_text);
  if (type_history && type_history.length > 0) {
    // Get the most recent type assignment
    const latest_type = type_history[type_history.length - 1];
    return latest_type.type_name;
  }

  // Handle special cases by language
  switch (language) {
    case 'javascript':
    case 'typescript':
      return resolve_javascript_receiver(receiver, type_map, source_code);
    case 'python':
      return resolve_python_receiver(receiver, type_map, source_code);
    case 'rust':
      return resolve_rust_receiver(receiver, type_map, source_code);
    default:
      return undefined;
  }
}

/**
 * Resolve JavaScript/TypeScript receiver types
 */
function resolve_javascript_receiver(
  receiver: SyntaxNode,
  type_map: Map<string, TypeInfo[]>,
  source_code: string
): string | undefined {
  // Handle 'this' keyword
  if (receiver.type === 'this') {
    const this_type = type_map.get('this');
    if (this_type && this_type.length > 0) {
      return this_type[this_type.length - 1].type_name;
    }
    return 'this';
  }

  // Handle literal types
  if (receiver.type === 'string') {
    return 'string';
  }
  if (receiver.type === 'array') {
    return 'Array';
  }
  if (receiver.type === 'object') {
    return 'Object';
  }
  if (receiver.type === 'number') {
    return 'number';
  }

  // Handle chained calls (foo.bar().baz())
  if (receiver.type === 'call_expression') {
    // This is a method call result - we'd need return type inference
    // For now, return undefined
    return undefined;
  }

  // Handle member access (foo.bar.baz)
  if (receiver.type === 'member_expression') {
    const object = receiver.childForFieldName('object');
    const property = receiver.childForFieldName('property');
    
    if (object && property) {
      // Try to resolve the base object type first
      const base_type = resolve_receiver_type(object, type_map, source_code, 'javascript');
      if (base_type) {
        // For now, just return the base type
        // In a full implementation, we'd look up the property type
        return base_type;
      }
    }
  }

  return undefined;
}

/**
 * Resolve Python receiver types
 */
function resolve_python_receiver(
  receiver: SyntaxNode,
  type_map: Map<string, TypeInfo[]>,
  source_code: string
): string | undefined {
  // Handle 'self' keyword
  if (receiver.type === 'identifier') {
    const text = get_node_text(receiver, source_code);
    if (text === 'self') {
      const self_type = type_map.get('self');
      if (self_type && self_type.length > 0) {
        return self_type[self_type.length - 1].type_name;
      }
      return 'self';
    }
    if (text === 'cls') {
      const cls_type = type_map.get('cls');
      if (cls_type && cls_type.length > 0) {
        return cls_type[cls_type.length - 1].type_name;
      }
      return 'cls';
    }
  }

  // Handle literal types
  if (receiver.type === 'string') {
    return 'str';
  }
  if (receiver.type === 'list') {
    return 'list';
  }
  if (receiver.type === 'dictionary') {
    return 'dict';
  }
  if (receiver.type === 'integer' || receiver.type === 'float') {
    return 'number';
  }

  // Handle chained calls
  if (receiver.type === 'call') {
    // Method call result - need return type inference
    return undefined;
  }

  // Handle attribute access
  if (receiver.type === 'attribute') {
    const object = receiver.childForFieldName('object');
    if (object) {
      return resolve_receiver_type(object, type_map, source_code, 'python');
    }
  }

  return undefined;
}

/**
 * Resolve Rust receiver types
 */
function resolve_rust_receiver(
  receiver: SyntaxNode,
  type_map: Map<string, TypeInfo[]>,
  source_code: string
): string | undefined {
  // Handle 'self' keyword
  if (receiver.type === 'self') {
    const self_type = type_map.get('self');
    if (self_type && self_type.length > 0) {
      return self_type[self_type.length - 1].type_name;
    }
    return 'Self';
  }

  // Handle literal types
  if (receiver.type === 'string_literal') {
    return '&str';
  }
  if (receiver.type === 'array_expression') {
    return 'Vec';
  }
  if (receiver.type === 'integer_literal') {
    return 'i32'; // Default integer type
  }

  // Handle method call chains
  if (receiver.type === 'call_expression') {
    return undefined;
  }

  // Handle field access
  if (receiver.type === 'field_expression') {
    const value = receiver.childForFieldName('value');
    if (value) {
      return resolve_receiver_type(value, type_map, source_code, 'rust');
    }
  }

  return undefined;
}

/**
 * Get the text content of a node
 */
export function get_node_text(node: SyntaxNode, source_code: string): string {
  return source_code.substring(node.startIndex, node.endIndex);
}

/**
 * Check if a method call is chained
 */
export function is_chained_call(node: SyntaxNode, language: Language): boolean {
  const parent = node.parent;
  if (!parent) return false;

  switch (language) {
    case 'javascript':
    case 'typescript':
      // Check if parent is another member expression
      return parent.type === 'member_expression' && 
             parent.childForFieldName('object') === node;
    case 'python':
      // Check if parent is another attribute access
      return parent.type === 'attribute' &&
             parent.childForFieldName('object') === node;
    case 'rust':
      // Check if parent is another field expression
      return parent.type === 'field_expression' &&
             parent.childForFieldName('value') === node;
    default:
      return false;
  }
}

/**
 * Determine if a method is static based on receiver type
 */
export function is_static_method(
  receiver_text: string,
  receiver_type: string | undefined,
  language: Language
): boolean {
  switch (language) {
    case 'javascript':
    case 'typescript':
      // Static methods are called on class names (uppercase)
      return receiver_text[0] === receiver_text[0].toUpperCase() &&
             receiver_text[0] !== receiver_text[0].toLowerCase();
    case 'python':
      // Check for @classmethod or @staticmethod
      return receiver_text === 'cls' || 
             (receiver_text[0] === receiver_text[0].toUpperCase() &&
              receiver_text !== 'self');
    case 'rust':
      // Associated functions don't use self
      return receiver_text !== 'self' && receiver_type !== 'Self';
    default:
      return false;
  }
}

/**
 * Try to determine the defining class for a method
 * 
 * @param method_name The method name (for future class hierarchy lookup)
 * @param receiver_type The resolved receiver type
 * @returns The class that likely defines this method
 */
export function infer_defining_class(
  _method_name: string,
  receiver_type: string | undefined
): string | undefined {
  if (!receiver_type) {
    return undefined;
  }

  // For now, just return the receiver type as the defining class
  // In a full implementation, we'd look up the method in the class hierarchy
  // using method_name to find where it's defined
  return receiver_type;
}