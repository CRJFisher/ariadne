/**
 * Python-specific bespoke constructor call features
 * 
 * This module handles Python-specific constructor patterns that
 * cannot be expressed through configuration alone.
 */

import { SyntaxNode } from 'tree-sitter';
import { ConstructorCallInfo } from '@ariadnejs/types';
import { ConstructorCallContext } from './constructor_calls';
import { node_to_location } from '../../ast/node_utils';

/**
 * Handle Python's super().__init__() pattern
 * 
 * Python uses super() to call parent class constructors.
 * This is a unique pattern for constructor chaining.
 */
export function handle_super_init_call(
  node: SyntaxNode,
  context: ConstructorCallContext
): ConstructorCallInfo | null {
  if (node.type !== 'call') return null;
  
  const func = node.childForFieldName('function');
  if (!func || func.type !== 'attribute') return null;
  
  const object = func.childForFieldName('object');
  const attr = func.childForFieldName('attribute');
  
  if (!object || !attr) return null;
  
  // Check if it's super().__init__()
  if (object.type === 'call') {
    const super_func = object.childForFieldName('function');
    if (super_func && super_func.type === 'identifier') {
      const func_name = context.source_code.substring(super_func.startIndex, super_func.endIndex);
      const method_name = context.source_code.substring(attr.startIndex, attr.endIndex);
      
      if (func_name === 'super' && method_name === '__init__') {
        // Count arguments (excluding self which is implicit)
        const args = node.childForFieldName('arguments');
        let arg_count = 0;
        if (args) {
          for (let i = 0; i < args.childCount; i++) {
            const child = args.child(i);
            if (child && 
                child.type !== '(' && 
                child.type !== ')' && 
                child.type !== ',' &&
                child.type !== 'comment') {
              arg_count++;
            }
          }
        }
        
        return {
          constructor_name: 'super',
          location: node_to_location(node, context.file_path),
          arguments_count: arg_count,
          is_new_expression: false,
          is_factory_method: false,
          is_super_call: true
        } as ConstructorCallInfo & { is_super_call: boolean };
      }
    }
  }
  
  return null;
}

/**
 * Detect Python dataclass instantiation
 * 
 * Python dataclasses are a special form of class that automatically
 * generates __init__ and other methods. They follow specific patterns.
 */
export function detect_dataclass_instantiation(
  node: SyntaxNode,
  context: ConstructorCallContext
): ConstructorCallInfo | null {
  if (node.type !== 'call') return null;
  
  const func = node.childForFieldName('function');
  if (!func || func.type !== 'identifier') return null;
  
  const class_name = context.source_code.substring(func.startIndex, func.endIndex);
  
  // Check if it's a capitalized name (Python convention for classes)
  if (!/^[A-Z]/.test(class_name)) return null;
  
  // Look for keyword arguments which are common in dataclass instantiation
  const args = node.childForFieldName('arguments');
  let has_keyword_args = false;
  let arg_count = 0;
  
  if (args) {
    for (let i = 0; i < args.childCount; i++) {
      const child = args.child(i);
      if (child && child.type === 'keyword_argument') {
        has_keyword_args = true;
        arg_count++;
      } else if (child && 
                 child.type !== '(' && 
                 child.type !== ')' && 
                 child.type !== ',' &&
                 child.type !== 'comment') {
        arg_count++;
      }
    }
  }
  
  // Find assignment target
  let assigned_to: string | undefined;
  let current = node.parent;
  while (current) {
    if (current.type === 'assignment') {
      const left = current.childForFieldName('left');
      if (left && left.type === 'identifier') {
        assigned_to = context.source_code.substring(left.startIndex, left.endIndex);
        break;
      }
    }
    if (current.type === 'expression_statement') break;
    current = current.parent;
  }
  
  return {
    constructor_name: class_name,
    location: node_to_location(node, context.file_path),
    arguments_count: arg_count,
    assigned_to,
    is_new_expression: false,
    is_factory_method: false
  };
}

/**
 * Handle Python metaclass instantiation
 * 
 * Python metaclasses control class creation and can affect
 * how instances are constructed.
 */
export function detect_metaclass_usage(
  node: SyntaxNode,
  context: ConstructorCallContext
): { class_name: string; metaclass: string } | null {
  if (node.type !== 'class_definition') return null;
  
  const name = node.childForFieldName('name');
  const superclasses = node.childForFieldName('superclasses');
  
  if (!name || !superclasses) return null;
  
  const class_name = context.source_code.substring(name.startIndex, name.endIndex);
  
  // Look for metaclass keyword argument
  for (let i = 0; i < superclasses.childCount; i++) {
    const child = superclasses.child(i);
    if (child && child.type === 'keyword_argument') {
      const keyword = child.childForFieldName('name');
      const value = child.childForFieldName('value');
      
      if (keyword && value) {
        const keyword_text = context.source_code.substring(keyword.startIndex, keyword.endIndex);
        if (keyword_text === 'metaclass') {
          const metaclass = context.source_code.substring(value.startIndex, value.endIndex);
          return { class_name, metaclass };
        }
      }
    }
  }
  
  return null;
}

/**
 * Detect Python __new__ method calls
 * 
 * Python's __new__ is the actual constructor that creates instances,
 * called before __init__.
 */
export function detect_new_method_call(
  node: SyntaxNode,
  context: ConstructorCallContext
): ConstructorCallInfo | null {
  if (node.type !== 'call') return null;
  
  const func = node.childForFieldName('function');
  if (!func || func.type !== 'attribute') return null;
  
  const attr = func.childForFieldName('attribute');
  if (!attr) return null;
  
  const method_name = context.source_code.substring(attr.startIndex, attr.endIndex);
  if (method_name !== '__new__') return null;
  
  const object = func.childForFieldName('object');
  if (!object) return null;
  
  let class_name: string;
  if (object.type === 'identifier') {
    class_name = context.source_code.substring(object.startIndex, object.endIndex);
  } else {
    return null;
  }
  
  // Count arguments
  const args = node.childForFieldName('arguments');
  let arg_count = 0;
  if (args) {
    for (let i = 0; i < args.childCount; i++) {
      const child = args.child(i);
      if (child && 
          child.type !== '(' && 
          child.type !== ')' && 
          child.type !== ',' &&
          child.type !== 'comment') {
        arg_count++;
      }
    }
  }
  
  return {
    constructor_name: class_name,
    location: node_to_location(node, context.file_path),
    arguments_count: arg_count,
    is_new_expression: false,
    is_factory_method: false
  };
}

/**
 * Handle Python class method factory patterns
 * 
 * Python often uses @classmethod decorators for alternative constructors
 * like from_dict, from_json, etc.
 */
export function detect_classmethod_factory(
  node: SyntaxNode,
  context: ConstructorCallContext
): ConstructorCallInfo | null {
  if (node.type !== 'call') return null;
  
  const func = node.childForFieldName('function');
  if (!func || func.type !== 'attribute') return null;
  
  const object = func.childForFieldName('object');
  const attr = func.childForFieldName('attribute');
  
  if (!object || !attr) return null;
  
  // Check if calling a class method
  if (object.type === 'identifier') {
    const class_name = context.source_code.substring(object.startIndex, object.endIndex);
    const method_name = context.source_code.substring(attr.startIndex, attr.endIndex);
    
    // Check if it's a capitalized class name and a factory method pattern
    if (/^[A-Z]/.test(class_name) && 
        ['from_dict', 'from_json', 'from_string', 'create', 'build'].includes(method_name)) {
      
      // Count arguments
      const args = node.childForFieldName('arguments');
      let arg_count = 0;
      if (args) {
        for (let i = 0; i < args.childCount; i++) {
          const child = args.child(i);
          if (child && 
              child.type !== '(' && 
              child.type !== ')' && 
              child.type !== ',' &&
              child.type !== 'comment') {
            arg_count++;
          }
        }
      }
      
      // Find assignment target
      let assigned_to: string | undefined;
      let current = node.parent;
      while (current) {
        if (current.type === 'assignment') {
          const left = current.childForFieldName('left');
          if (left && left.type === 'identifier') {
            assigned_to = context.source_code.substring(left.startIndex, left.endIndex);
            break;
          }
        }
        if (current.type === 'expression_statement') break;
        current = current.parent;
      }
      
      return {
        constructor_name: class_name,
        location: node_to_location(node, context.file_path),
        arguments_count: arg_count,
        assigned_to,
        is_new_expression: false,
        is_factory_method: true
      };
    }
  }
  
  return null;
}