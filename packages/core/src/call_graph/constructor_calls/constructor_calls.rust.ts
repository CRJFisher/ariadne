/**
 * Rust-specific bespoke constructor call features
 * 
 * This module handles Rust-specific constructor patterns that
 * cannot be expressed through configuration alone.
 */

import { SyntaxNode } from 'tree-sitter';
import { ConstructorCallInfo } from '@ariadnejs/types';
import { ConstructorCallContext } from './constructor_calls';
import { node_to_location } from '../../ast/node_utils';

/**
 * Handle Rust enum variant construction
 * 
 * Rust enums can have variants that act like constructors:
 * - Option::Some(value)
 * - Result::Ok(value)
 * - MyEnum::Variant { field: value }
 */
export function handle_enum_variant_construction(
  node: SyntaxNode,
  context: ConstructorCallContext
): ConstructorCallInfo | null {
  // Handle tuple enum variants: Enum::Variant(args)
  if (node.type === 'call_expression') {
    const func = node.childForFieldName('function');
    if (!func) return null;
    
    // Check for scoped identifier (Enum::Variant)
    if (func.type === 'scoped_identifier') {
      const path = func.childForFieldName('path');
      const name = func.childForFieldName('name');
      
      if (!path || !name) return null;
      
      const enum_name = context.source_code.substring(path.startIndex, path.endIndex);
      const variant_name = context.source_code.substring(name.startIndex, name.endIndex);
      
      // Check if variant name starts with uppercase (Rust convention)
      if (!/^[A-Z]/.test(variant_name)) return null;
      
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
        if (current.type === 'let_declaration') {
          const pattern = current.childForFieldName('pattern');
          if (pattern) {
            if (pattern.type === 'identifier') {
              assigned_to = context.source_code.substring(pattern.startIndex, pattern.endIndex);
              break;
            } else if (pattern.type === 'mutable_specifier') {
              const ident = pattern.nextSibling;
              if (ident && ident.type === 'identifier') {
                assigned_to = context.source_code.substring(ident.startIndex, ident.endIndex);
                break;
              }
            }
          }
        }
        if (current.type === 'expression_statement') break;
        current = current.parent;
      }
      
      return {
        constructor_name: `${enum_name}::${variant_name}`,
        location: node_to_location(node, context.file_path),
        arguments_count: arg_count,
        assigned_to,
        is_new_expression: false,
        is_factory_method: false,
        is_enum_variant: true
      } as ConstructorCallInfo & { is_enum_variant: boolean };
    }
  }
  
  // Handle struct-like enum variants: Enum::Variant { field: value }
  if (node.type === 'struct_expression') {
    const name = node.childForFieldName('name');
    if (!name || name.type !== 'scoped_identifier') return null;
    
    const path = name.childForFieldName('path');
    const variant = name.childForFieldName('name');
    
    if (!path || !variant) return null;
    
    const enum_name = context.source_code.substring(path.startIndex, path.endIndex);
    const variant_name = context.source_code.substring(variant.startIndex, variant.endIndex);
    
    // Count field initializers
    const body = node.childForFieldName('body');
    let field_count = 0;
    if (body) {
      for (let i = 0; i < body.childCount; i++) {
        const child = body.child(i);
        if (child && 
            (child.type === 'field_initializer' || 
             child.type === 'shorthand_field_initializer')) {
          field_count++;
        }
      }
    }
    
    // Find assignment target
    let assigned_to: string | undefined;
    let current = node.parent;
    while (current) {
      if (current.type === 'let_declaration') {
        const pattern = current.childForFieldName('pattern');
        if (pattern && pattern.type === 'identifier') {
          assigned_to = context.source_code.substring(pattern.startIndex, pattern.endIndex);
          break;
        }
      }
      if (current.type === 'expression_statement') break;
      current = current.parent;
    }
    
    return {
      constructor_name: `${enum_name}::${variant_name}`,
      location: {
        line: node.startPosition.row,
        column: node.startPosition.column
      },
      arguments_count: field_count,
      assigned_to,
      is_new_expression: false,
      is_factory_method: false
    };
  }
  
  return null;
}

/**
 * Handle Rust tuple struct construction
 * 
 * Rust tuple structs can be constructed like functions:
 * Point(x, y)
 */
export function handle_tuple_struct_construction(
  node: SyntaxNode,
  context: ConstructorCallContext
): ConstructorCallInfo | null {
  if (node.type !== 'call_expression') return null;
  
  const func = node.childForFieldName('function');
  if (!func || func.type !== 'identifier') return null;
  
  const struct_name = context.source_code.substring(func.startIndex, func.endIndex);
  
  // Check if it's a capitalized name (Rust convention for types)
  if (!/^[A-Z]/.test(struct_name)) return null;
  
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
    if (current.type === 'let_declaration') {
      const pattern = current.childForFieldName('pattern');
      if (pattern && pattern.type === 'identifier') {
        assigned_to = context.source_code.substring(pattern.startIndex, pattern.endIndex);
        break;
      }
    }
    if (current.type === 'expression_statement') break;
    current = current.parent;
  }
  
  return {
    constructor_name: struct_name,
    location: {
      line: node.startPosition.row,
      column: node.startPosition.column
    },
    arguments_count: arg_count,
    assigned_to,
    is_new_expression: false,
    is_factory_method: false,
    is_tuple_struct: true
  } as ConstructorCallInfo & { is_tuple_struct: boolean };
}

/**
 * Handle Rust macro-based construction patterns
 * 
 * Rust macros like vec![], hashmap!{}, etc. are constructor-like.
 */
export function handle_macro_construction(
  node: SyntaxNode,
  context: ConstructorCallContext
): ConstructorCallInfo | null {
  if (node.type !== 'macro_invocation') return null;
  
  const macro = node.childForFieldName('macro');
  if (!macro) return null;
  
  const macro_name = context.source_code.substring(macro.startIndex, macro.endIndex);
  
  // Common constructor-like macros
  const constructor_macros = ['vec', 'hashmap', 'btreemap', 'hashset', 'btreeset', 'format'];
  if (!constructor_macros.includes(macro_name)) return null;
  
  // Try to count elements in the macro (approximation)
  const token_tree = node.childForFieldName('token_tree');
  let element_count = 0;
  if (token_tree) {
    // Count commas as a rough approximation of elements
    const content = context.source_code.substring(token_tree.startIndex, token_tree.endIndex);
    element_count = (content.match(/,/g) || []).length + 1;
  }
  
  // Find assignment target
  let assigned_to: string | undefined;
  let current = node.parent;
  while (current) {
    if (current.type === 'let_declaration') {
      const pattern = current.childForFieldName('pattern');
      if (pattern && pattern.type === 'identifier') {
        assigned_to = context.source_code.substring(pattern.startIndex, pattern.endIndex);
        break;
      }
    }
    if (current.type === 'expression_statement') break;
    current = current.parent;
  }
  
  // Map macro names to their constructed types
  const type_map: Record<string, string> = {
    'vec': 'Vec',
    'hashmap': 'HashMap',
    'btreemap': 'BTreeMap',
    'hashset': 'HashSet',
    'btreeset': 'BTreeSet',
    'format': 'String'
  };
  
  return {
    constructor_name: macro_name, // Use the macro name, not the type name
    location: {
      line: node.startPosition.row,
      column: node.startPosition.column
    },
    arguments_count: element_count,
    assigned_to,
    is_new_expression: false,
    is_factory_method: true, // Macros are factory-like
    is_macro_invocation: true
  } as ConstructorCallInfo & { is_macro_invocation: boolean };
}

/**
 * Handle Rust Box::new() and other smart pointer construction
 * 
 * Smart pointers in Rust have special construction patterns.
 */
export function handle_smart_pointer_construction(
  node: SyntaxNode,
  context: ConstructorCallContext
): ConstructorCallInfo | null {
  if (node.type !== 'call_expression') return null;
  
  const func = node.childForFieldName('function');
  if (!func || func.type !== 'scoped_identifier') return null;
  
  const path = func.childForFieldName('path');
  const name = func.childForFieldName('name');
  
  if (!path || !name) return null;
  
  const type_name = context.source_code.substring(path.startIndex, path.endIndex);
  const method_name = context.source_code.substring(name.startIndex, name.endIndex);
  
  // Check for smart pointer types
  const smart_pointers = ['Box', 'Rc', 'Arc', 'Cell', 'RefCell', 'Mutex', 'RwLock'];
  if (!smart_pointers.includes(type_name) || method_name !== 'new') {
    return null;
  }
  
  // Count arguments (usually 1 for smart pointers)
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
    if (current.type === 'let_declaration') {
      const pattern = current.childForFieldName('pattern');
      if (pattern && pattern.type === 'identifier') {
        assigned_to = context.source_code.substring(pattern.startIndex, pattern.endIndex);
        break;
      }
    }
    if (current.type === 'expression_statement') break;
    current = current.parent;
  }
  
  return {
    constructor_name: type_name,
    location: {
      line: node.startPosition.row,
      column: node.startPosition.column
    },
    arguments_count: arg_count,
    assigned_to,
    is_new_expression: false,
    is_factory_method: true,
    is_smart_pointer: true
  } as ConstructorCallInfo & { is_smart_pointer: boolean };
}

/**
 * Detect Default::default() pattern
 * 
 * Rust's Default trait provides a default constructor.
 */
export function handle_default_construction(
  node: SyntaxNode,
  context: ConstructorCallContext
): ConstructorCallInfo | null {
  if (node.type !== 'call_expression') return null;
  
  const func = node.childForFieldName('function');
  if (!func || func.type !== 'scoped_identifier') return null;
  
  const path = func.childForFieldName('path');
  const name = func.childForFieldName('name');
  
  if (!path || !name) return null;
  
  const type_or_trait = context.source_code.substring(path.startIndex, path.endIndex);
  const method_name = context.source_code.substring(name.startIndex, name.endIndex);
  
  // Check if it's calling the 'default' method
  if (method_name !== 'default') {
    return null;
  }
  
  // Determine the constructor name
  let constructor_name: string;
  if (type_or_trait === 'Default') {
    // For Default::default(), we use 'Default' as the constructor name
    constructor_name = 'Default';
  } else {
    // For Type::default() (like Config::default()), use the type name
    constructor_name = type_or_trait;
  }
  
  // Try to find assignment target
  let assigned_to: string | undefined;
  let current = node.parent;
  while (current) {
    if (current.type === 'let_declaration') {
      const pattern = current.childForFieldName('pattern');
      
      if (pattern && pattern.type === 'identifier') {
        assigned_to = context.source_code.substring(pattern.startIndex, pattern.endIndex);
      }
      break;
    }
    if (current.type === 'expression_statement') break;
    current = current.parent;
  }
  
  return {
    constructor_name,
    location: {
      line: node.startPosition.row,
      column: node.startPosition.column
    },
    arguments_count: 0, // Default::default() takes no arguments
    assigned_to,
    is_new_expression: false,
    is_factory_method: true,
    is_default_construction: true
  } as ConstructorCallInfo & { is_default_construction: boolean };
}