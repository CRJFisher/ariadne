/**
 * TypeScript Bespoke Interface Implementation Handler
 * 
 * Handles TypeScript-specific features that cannot be expressed through configuration:
 * - Generic interfaces with type parameters
 * - Conditional types
 * - Mapped types
 * - Declaration merging
 * - Type guards
 */

import { SyntaxNode } from 'tree-sitter';
import { InterfaceDefinition, MethodSignature } from './types';

/**
 * Extract generic type parameters from interface
 * 
 * Example: interface Container<T, U extends Base>
 */
export function extract_typescript_generics(
  interface_node: SyntaxNode,
  source_code: string
): string[] | undefined {
  const type_params_node = interface_node.childForFieldName('type_parameters');
  if (!type_params_node) return undefined;
  
  const type_params: string[] = [];
  
  for (let i = 0; i < type_params_node.childCount; i++) {
    const param = type_params_node.child(i);
    if (param && param.type === 'type_parameter') {
      const name_node = param.childForFieldName('name');
      if (name_node) {
        type_params.push(source_code.substring(name_node.startIndex, name_node.endIndex));
      }
    }
  }
  
  return type_params.length > 0 ? type_params : undefined;
}

/**
 * Handle declaration merging for interfaces
 * 
 * TypeScript allows multiple interface declarations with the same name
 * to be merged into a single interface.
 */
export function merge_typescript_interfaces(
  interfaces: InterfaceDefinition[]
): InterfaceDefinition[] {
  const merged = new Map<string, InterfaceDefinition>();
  
  for (const iface of interfaces) {
    const existing = merged.get(iface.name);
    if (existing) {
      // Merge members
      existing.required_methods.push(...iface.required_methods);
      if (iface.required_properties) {
        if (!existing.required_properties) {
          existing.required_properties = [];
        }
        existing.required_properties.push(...iface.required_properties);
      }
      // Merge extends
      const extends_set = new Set(existing.extends_interfaces);
      iface.extends_interfaces.forEach(e => extends_set.add(e));
      existing.extends_interfaces = Array.from(extends_set);
    } else {
      merged.set(iface.name, { ...iface });
    }
  }
  
  return Array.from(merged.values());
}

/**
 * Extract index signatures from interface
 * 
 * Example: [key: string]: any
 */
export function extract_index_signatures(
  body_node: SyntaxNode,
  source_code: string
): { key_type: string; value_type: string }[] {
  const signatures: { key_type: string; value_type: string }[] = [];
  
  for (let i = 0; i < body_node.childCount; i++) {
    const child = body_node.child(i);
    if (child && child.type === 'index_signature') {
      const key_param = child.childForFieldName('parameters');
      const value_type = child.childForFieldName('type');
      
      if (key_param && value_type) {
        const key_type_node = key_param.childForFieldName('type');
        if (key_type_node) {
          signatures.push({
            key_type: source_code.substring(key_type_node.startIndex, key_type_node.endIndex),
            value_type: source_code.substring(value_type.startIndex, value_type.endIndex)
          });
        }
      }
    }
  }
  
  return signatures;
}

/**
 * Handle conditional types in method signatures
 * 
 * Example: method<T>(x: T): T extends string ? number : boolean
 */
export function extract_conditional_return_type(
  method_node: SyntaxNode,
  source_code: string
): string | undefined {
  const return_type_node = method_node.childForFieldName('return_type');
  if (!return_type_node) return undefined;
  
  // Check if it's a conditional type
  if (return_type_node.type === 'conditional_type') {
    return source_code.substring(return_type_node.startIndex, return_type_node.endIndex);
  }
  
  return undefined;
}

/**
 * Extract mapped type from interface body
 * 
 * Example: { [K in keyof T]: T[K] }
 */
export function extract_mapped_types(
  body_node: SyntaxNode,
  source_code: string
): string[] {
  const mapped_types: string[] = [];
  
  for (let i = 0; i < body_node.childCount; i++) {
    const child = body_node.child(i);
    if (child && child.type === 'mapped_type') {
      mapped_types.push(source_code.substring(child.startIndex, child.endIndex));
    }
  }
  
  return mapped_types;
}

/**
 * Check if method is a type guard
 * 
 * Example: isString(x: unknown): x is string
 */
export function is_type_guard_method(
  method: MethodSignature,
  method_node: SyntaxNode,
  source_code: string
): boolean {
  const return_type_node = method_node.childForFieldName('return_type');
  if (!return_type_node) return false;
  
  const return_text = source_code.substring(return_type_node.startIndex, return_type_node.endIndex);
  return return_text.includes(' is ');
}

/**
 * Extract construct signatures
 * 
 * Example: new (x: number): MyClass
 */
export function extract_construct_signatures(
  body_node: SyntaxNode,
  source_code: string
): MethodSignature[] {
  const signatures: MethodSignature[] = [];
  
  for (let i = 0; i < body_node.childCount; i++) {
    const child = body_node.child(i);
    if (child && child.type === 'construct_signature') {
      const params_node = child.childForFieldName('parameters');
      const return_type_node = child.childForFieldName('type');
      
      signatures.push({
        name: 'new',
        parameters: [], // TODO: Extract parameters
        return_type: return_type_node 
          ? source_code.substring(return_type_node.startIndex, return_type_node.endIndex)
          : undefined,
        is_static: true
      });
    }
  }
  
  return signatures;
}

/**
 * Handle heritage clauses (extends and implements)
 * 
 * TypeScript allows multiple extends for interfaces
 */
export function extract_heritage_clauses(
  class_node: SyntaxNode,
  source_code: string
): { extends: string[], implements: string[] } {
  const result = { extends: [], implements: [] };
  
  for (let i = 0; i < class_node.childCount; i++) {
    const child = class_node.child(i);
    if (child && child.type === 'extends_clause') {
      const types = extract_type_names(child, source_code);
      result.extends.push(...types);
    } else if (child && child.type === 'implements_clause') {
      const types = extract_type_names(child, source_code);
      result.implements.push(...types);
    }
  }
  
  return result;
}

function extract_type_names(node: SyntaxNode, source_code: string): string[] {
  const names: string[] = [];
  
  const traverse = (n: SyntaxNode) => {
    if (n.type === 'type_identifier') {
      names.push(source_code.substring(n.startIndex, n.endIndex));
    } else if (n.type === 'generic_type') {
      const name_node = n.childForFieldName('type');
      if (name_node && name_node.type === 'type_identifier') {
        names.push(source_code.substring(name_node.startIndex, name_node.endIndex));
      }
    }
    
    for (let i = 0; i < n.childCount; i++) {
      const child = n.child(i);
      if (child) traverse(child);
    }
  };
  
  traverse(node);
  return names;
}