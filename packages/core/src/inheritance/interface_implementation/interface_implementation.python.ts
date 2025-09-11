/**
 * Python Bespoke Interface Implementation Handler
 * 
 * Handles Python-specific protocol and ABC features:
 * - Runtime protocol checking
 * - ABC registration
 * - @runtime_checkable decorator
 * - Multiple inheritance with MRO
 * - Duck typing patterns
 */

import { SyntaxNode } from 'tree-sitter';
import { InterfaceDefinition, MethodSignature, PropertySignature } from './types';

/**
 * Check if a class uses @runtime_checkable decorator
 * 
 * This decorator allows isinstance() checks at runtime
 */
export function is_runtime_checkable_protocol(
  class_node: SyntaxNode,
  source_code: string
): boolean {
  // Look for decorators before the class
  const parent = class_node.parent;
  if (!parent) return false;
  
  let found_class = false;
  for (let i = parent.childCount - 1; i >= 0; i--) {
    const child = parent.child(i);
    if (!child) continue;
    
    if (child === class_node) {
      found_class = true;
      continue;
    }
    
    if (found_class && child.type === 'decorated_definition') {
      const decorators = child.childForFieldName('decorators');
      if (decorators) {
        const text = source_code.substring(decorators.startIndex, decorators.endIndex);
        if (text.includes('runtime_checkable')) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Extract ABC register() calls
 * 
 * Example: MyABC.register(ConcreteClass)
 */
export function extract_abc_registrations(
  root_node: SyntaxNode,
  source_code: string
): { abc_name: string; registered_class: string }[] {
  const registrations: { abc_name: string; registered_class: string }[] = [];
  
  const traverse = (node: SyntaxNode) => {
    if (node.type === 'call') {
      const function_node = node.childForFieldName('function');
      if (function_node && function_node.type === 'attribute') {
        const attr_text = source_code.substring(function_node.startIndex, function_node.endIndex);
        if (attr_text.endsWith('.register')) {
          const abc_name = attr_text.replace('.register', '');
          const args = node.childForFieldName('arguments');
          if (args && args.childCount > 0) {
            const arg = args.child(0);
            if (arg) {
              const registered_class = source_code.substring(arg.startIndex, arg.endIndex);
              registrations.push({ abc_name, registered_class });
            }
          }
        }
      }
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) traverse(child);
    }
  };
  
  traverse(root_node);
  return registrations;
}

/**
 * Extract class variables and type annotations
 * 
 * Python protocols can specify class variables
 */
export function extract_class_variables(
  body_node: SyntaxNode,
  source_code: string
): PropertySignature[] {
  const variables: PropertySignature[] = [];
  
  for (let i = 0; i < body_node.childCount; i++) {
    const child = body_node.child(i);
    if (!child) continue;
    
    if (child.type === 'expression_statement') {
      const expr = child.child(0);
      if (expr && expr.type === 'assignment') {
        const left = expr.childForFieldName('left');
        const type_node = expr.childForFieldName('type');
        
        if (left && left.type === 'identifier') {
          const name = source_code.substring(left.startIndex, left.endIndex);
          // Skip private/protected
          if (!name.startsWith('_')) {
            variables.push({
              name,
              type: type_node 
                ? source_code.substring(type_node.startIndex, type_node.endIndex)
                : undefined,
              is_readonly: false,
              is_optional: false
            });
          }
        }
      } else if (expr && expr.type === 'type_alias_statement') {
        // Handle type annotations without assignment
        const name_node = expr.childForFieldName('name');
        const type_node = expr.childForFieldName('type');
        
        if (name_node) {
          const name = source_code.substring(name_node.startIndex, name_node.endIndex);
          variables.push({
            name,
            type: type_node 
              ? source_code.substring(type_node.startIndex, type_node.endIndex)
              : undefined,
            is_readonly: false,
            is_optional: false
          });
        }
      }
    }
  }
  
  return variables;
}

/**
 * Check if method has @property decorator
 * 
 * Properties in Python are methods with special decorators
 */
export function is_property_method(
  method_node: SyntaxNode,
  source_code: string
): boolean {
  // Check for @property decorator
  const parent = method_node.parent;
  if (!parent) return false;
  
  for (let i = 0; i < parent.childCount; i++) {
    const child = parent.child(i);
    if (child === method_node) break;
    
    if (child && child.type === 'decorator') {
      const text = source_code.substring(child.startIndex, child.endIndex);
      if (text.includes('@property')) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Extract special methods (dunder methods)
 * 
 * Python protocols often define special methods like __len__, __iter__, etc.
 */
export function extract_special_methods(
  body_node: SyntaxNode,
  source_code: string
): MethodSignature[] {
  const special_methods: MethodSignature[] = [];
  
  for (let i = 0; i < body_node.childCount; i++) {
    const child = body_node.child(i);
    if (!child) continue;
    
    if (child.type === 'function_definition') {
      const name_node = child.childForFieldName('name');
      if (name_node) {
        const name = source_code.substring(name_node.startIndex, name_node.endIndex);
        if (name.startsWith('__') && name.endsWith('__')) {
          special_methods.push({
            name,
            parameters: [], // TODO: Extract parameters
            is_abstract: has_abstractmethod_decorator(child, source_code)
          });
        }
      }
    }
  }
  
  return special_methods;
}

/**
 * Check if class has __subclasshook__ for structural subtyping
 */
export function has_subclasshook(
  body_node: SyntaxNode,
  source_code: string
): boolean {
  for (let i = 0; i < body_node.childCount; i++) {
    const child = body_node.child(i);
    if (!child) continue;
    
    if (child.type === 'function_definition') {
      const name_node = child.childForFieldName('name');
      if (name_node) {
        const name = source_code.substring(name_node.startIndex, name_node.endIndex);
        if (name === '__subclasshook__') {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Extract generic type parameters from Protocol
 * 
 * Example: class MyProtocol(Protocol[T, U]):
 */
export function extract_protocol_generics(
  bases_node: SyntaxNode,
  source_code: string
): string[] {
  const generics: string[] = [];
  
  for (let i = 0; i < bases_node.childCount; i++) {
    const child = bases_node.child(i);
    if (!child) continue;
    
    if (child.type === 'subscript') {
      const value = child.childForFieldName('value');
      if (value) {
        const text = source_code.substring(value.startIndex, value.endIndex);
        if (text === 'Protocol' || text.endsWith('.Protocol')) {
          const subscript = child.childForFieldName('subscript');
          if (subscript) {
            // Extract type parameters
            const params_text = source_code.substring(subscript.startIndex, subscript.endIndex);
            const params = params_text.split(',').map(p => p.trim());
            generics.push(...params);
          }
        }
      }
    }
  }
  
  return generics;
}

/**
 * Check for @abstractmethod decorator
 */
function has_abstractmethod_decorator(
  method_node: SyntaxNode,
  source_code: string
): boolean {
  const parent = method_node.parent;
  if (!parent) return false;
  
  for (let i = 0; i < parent.childCount; i++) {
    const child = parent.child(i);
    if (child === method_node) break;
    
    if (child && child.type === 'decorator') {
      const text = source_code.substring(child.startIndex, child.endIndex);
      if (text.includes('abstractmethod')) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Extract metaclass from class definition
 * 
 * Example: class MyClass(metaclass=ABCMeta):
 */
export function extract_metaclass(
  bases_node: SyntaxNode,
  source_code: string
): string | undefined {
  for (let i = 0; i < bases_node.childCount; i++) {
    const child = bases_node.child(i);
    if (!child) continue;
    
    if (child.type === 'keyword_argument') {
      const name_node = child.childForFieldName('name');
      const value_node = child.childForFieldName('value');
      
      if (name_node && value_node) {
        const name = source_code.substring(name_node.startIndex, name_node.endIndex);
        if (name === 'metaclass') {
          return source_code.substring(value_node.startIndex, value_node.endIndex);
        }
      }
    }
  }
  
  return undefined;
}