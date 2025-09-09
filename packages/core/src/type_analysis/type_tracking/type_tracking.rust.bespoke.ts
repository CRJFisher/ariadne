/**
 * Rust-specific bespoke type tracking features
 * 
 * Handles Rust features that cannot be expressed through configuration:
 * - Ownership and borrowing
 * - Lifetimes
 * - Traits and trait implementations
 * - Associated types
 * - Pattern matching with type extraction
 * - Macro-generated types
 */

import { SyntaxNode } from 'tree-sitter';
import {
  TypeInfo,
  FileTypeTracker,
  TypeTrackingContext,
  set_variable_type,
  mark_as_exported
} from './type_tracking';
import { node_to_location } from '../../ast/node_utils';

/**
 * Track Rust ownership and borrowing
 * &T, &mut T, Box<T>, Rc<T>, Arc<T>
 */
export function track_rust_ownership(
  node: SyntaxNode,
  context: TypeTrackingContext
): TypeInfo | undefined {
  if (node.type === 'reference_type' || node.type === 'mutable_reference_type') {
    const type_node = node.childForFieldName('type');
    if (!type_node) return undefined;
    
    const base_type = context.source_code.substring(type_node.startIndex, type_node.endIndex);
    const is_mutable = node.type === 'mutable_reference_type';
    
    return {
      type_name: is_mutable ? `&mut ${base_type}` : `&${base_type}`,
      type_kind: 'unknown',
      location: node_to_location(node, context.file_path),
      confidence: 'explicit',
      source: 'annotation'
    };
  }
  
  // Smart pointers
  if (node.type === 'generic_type') {
    const name_node = node.childForFieldName('type');
    const args_node = node.childForFieldName('type_arguments');
    
    if (name_node && args_node) {
      const type_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
      
      if (['Box', 'Rc', 'Arc', 'RefCell', 'Mutex'].includes(type_name)) {
        return {
          type_name,
          type_kind: 'class',
          location: node_to_location(node, context.file_path),
          confidence: 'explicit',
          source: 'annotation'
        };
      }
    }
  }
  
  return undefined;
}

/**
 * Track Rust lifetime parameters
 * fn foo<'a>(x: &'a str) -> &'a str
 */
export function track_rust_lifetimes(
  node: SyntaxNode,
  context: TypeTrackingContext
): TypeInfo | undefined {
  if (node.type === 'lifetime') {
    const lifetime_name = context.source_code.substring(node.startIndex, node.endIndex);
    
    return {
      type_name: `lifetime:${lifetime_name}`,
      type_kind: 'unknown',
      location: node_to_location(node, context.file_path),
      confidence: 'explicit',
      source: 'annotation'
    };
  }
  
  return undefined;
}

/**
 * Track Rust trait definitions and implementations
 * trait Display { ... }
 * impl Display for MyType { ... }
 */
export function track_rust_trait(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  if (node.type === 'trait_item') {
    const name_node = node.childForFieldName('name');
    if (!name_node) return tracker;
    
    const trait_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
    
    const type_info: TypeInfo = {
      type_name: `trait:${trait_name}`,
      type_kind: 'interface',
      location: node_to_location(node, context.file_path),
      confidence: 'explicit',
      source: 'annotation'
    };
    
    return set_variable_type(tracker, `trait:${trait_name}`, type_info);
  }
  
  return tracker;
}

/**
 * Track trait implementations
 * impl Trait for Type { ... }
 */
export function track_rust_impl(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  if (node.type !== 'impl_item') {
    return tracker;
  }
  
  const trait_node = node.childForFieldName('trait');
  const type_node = node.childForFieldName('type');
  
  if (trait_node && type_node) {
    const trait_name = context.source_code.substring(trait_node.startIndex, trait_node.endIndex);
    const type_name = context.source_code.substring(type_node.startIndex, type_node.endIndex);
    
    const type_info: TypeInfo = {
      type_name: `${type_name}+${trait_name}`,
      type_kind: 'class',
      location: node_to_location(node, context.file_path),
      confidence: 'explicit',
      source: 'annotation'
    };
    
    return set_variable_type(tracker, `impl:${type_name}:${trait_name}`, type_info);
  }
  
  // Self implementations (impl Type { ... })
  if (type_node && !trait_node) {
    const type_name = context.source_code.substring(type_node.startIndex, type_node.endIndex);
    
    const type_info: TypeInfo = {
      type_name,
      type_kind: 'class',
      location: node_to_location(node, context.file_path),
      confidence: 'explicit',
      source: 'annotation'
    };
    
    return set_variable_type(tracker, `impl:${type_name}`, type_info);
  }
  
  return tracker;
}

/**
 * Track Rust pattern matching with type extraction
 * match value { Some(x) => ..., None => ... }
 */
export function track_rust_pattern_match(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  if (node.type !== 'match_expression') {
    return tracker;
  }
  
  const value_node = node.childForFieldName('value');
  const body_node = node.childForFieldName('body');
  
  if (!body_node) return tracker;
  
  // Process each match arm
  for (let i = 0; i < body_node.childCount; i++) {
    const arm = body_node.child(i);
    if (arm && arm.type === 'match_arm') {
      const pattern = arm.childForFieldName('pattern');
      
      if (pattern) {
        tracker = extract_pattern_bindings(tracker, pattern, context);
      }
    }
  }
  
  return tracker;
}

/**
 * Track Rust associated types
 * type Item = String;
 */
export function track_rust_associated_type(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  if (node.type !== 'associated_type') {
    return tracker;
  }
  
  const name_node = node.childForFieldName('name');
  const type_node = node.childForFieldName('type');
  
  if (name_node && type_node) {
    const assoc_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
    const type_name = context.source_code.substring(type_node.startIndex, type_node.endIndex);
    
    const type_info: TypeInfo = {
      type_name,
      type_kind: 'unknown',
      location: node_to_location(node, context.file_path),
      confidence: 'explicit',
      source: 'annotation'
    };
    
    return set_variable_type(tracker, `assoc:${assoc_name}`, type_info);
  }
  
  return tracker;
}

/**
 * Track Rust enum variants
 * enum Result<T, E> { Ok(T), Err(E) }
 */
export function track_rust_enum(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  if (node.type !== 'enum_item') {
    return tracker;
  }
  
  const name_node = node.childForFieldName('name');
  if (!name_node) return tracker;
  
  const enum_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
  
  const type_info: TypeInfo = {
    type_name: enum_name,
    type_kind: 'class', // Enums are like classes with variants
    location: node_to_location(node, context.file_path),
    confidence: 'explicit',
    source: 'annotation'
  };
  
  tracker = set_variable_type(tracker, enum_name, type_info);
  
  // Track enum variants
  const body = node.childForFieldName('body');
  if (body) {
    for (let i = 0; i < body.childCount; i++) {
      const variant = body.child(i);
      if (variant && variant.type === 'enum_variant') {
        const variant_name_node = variant.childForFieldName('name');
        if (variant_name_node) {
          const variant_name = context.source_code.substring(
            variant_name_node.startIndex,
            variant_name_node.endIndex
          );
          
          const variant_info: TypeInfo = {
            type_name: `${enum_name}::${variant_name}`,
            type_kind: 'class',
            location: node_to_location(variant, context.file_path),
            confidence: 'explicit',
            source: 'annotation'
          };
          
          tracker = set_variable_type(tracker, `${enum_name}::${variant_name}`, variant_info);
        }
      }
    }
  }
  
  return tracker;
}

/**
 * Track types from if-let expressions
 * if let Some(x) = option { ... }
 */
export function track_rust_if_let(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  if (node.type !== 'if_let_expression') {
    return tracker;
  }
  
  const pattern = node.childForFieldName('pattern');
  
  if (pattern) {
    tracker = extract_pattern_bindings(tracker, pattern, context);
  }
  
  return tracker;
}

/**
 * Infer types from Rust typed literals
 * Examples: 42i64, 3.14f32, b"bytes", tuples, arrays
 */
export function infer_rust_typed_literal(
  node: SyntaxNode,
  context: TypeTrackingContext
): TypeInfo | undefined {
  const location = node_to_location(node, context.file_path);
  
  // Tuple expressions
  if (node.type === 'tuple_expression') {
    // For now, just return 'tuple' as the type name
    // A more complete implementation would track element types
    return {
      type_name: 'tuple',
      type_kind: 'unknown', // Tuples are their own type kind
      location,
      confidence: 'explicit',
      source: 'assignment'
    };
  }
  
  // Array expressions
  if (node.type === 'array_expression') {
    return {
      type_name: 'array',
      type_kind: 'array',
      location,
      confidence: 'explicit',
      source: 'assignment'
    };
  }
  
  // Integer literals with type suffix
  if (node.type === 'integer_literal') {
    const text = context.source_code.substring(node.startIndex, node.endIndex);
    
    // Check for type suffix
    const suffixMatch = text.match(/^[0-9_]+(i8|i16|i32|i64|i128|isize|u8|u16|u32|u64|u128|usize)$/);
    if (suffixMatch) {
      return {
        type_name: suffixMatch[1],
        type_kind: 'primitive',
        location,
        confidence: 'explicit',
        source: 'assignment'
      };
    }
    
    // Default to i32 for untyped integers
    return {
      type_name: 'i32',
      type_kind: 'primitive',
      location,
      confidence: 'inferred',
      source: 'assignment'
    };
  }
  
  // Float literals with type suffix
  if (node.type === 'float_literal') {
    const text = context.source_code.substring(node.startIndex, node.endIndex);
    
    // Check for type suffix
    const suffixMatch = text.match(/^[0-9_.]+[eE]?[+-]?[0-9]*(f32|f64)$/);
    if (suffixMatch) {
      return {
        type_name: suffixMatch[1],
        type_kind: 'primitive',
        location,
        confidence: 'explicit',
        source: 'assignment'
      };
    }
    
    // Default to f64 for untyped floats
    return {
      type_name: 'f64',
      type_kind: 'primitive',
      location,
      confidence: 'inferred',
      source: 'assignment'
    };
  }
  
  // Byte string literals
  if (node.type === 'string_literal') {
    const text = context.source_code.substring(node.startIndex, node.endIndex);
    
    if (text.startsWith('b"') || text.startsWith("b'")) {
      return {
        type_name: '&[u8]',
        type_kind: 'primitive',
        location,
        confidence: 'explicit',
        source: 'assignment'
      };
    }
    
    // Regular string literal
    return {
      type_name: '&str',
      type_kind: 'primitive',
      location,
      confidence: 'explicit',
      source: 'assignment'
    };
  }
  
  return undefined;
}

/**
 * Track macro-generated types
 * derive macros, procedural macros
 */
export function track_rust_macro_types(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  if (node.type === 'attribute_item') {
    const attr = node.child(1); // Skip the #
    if (attr && attr.type === 'meta_item') {
      const name_node = attr.childForFieldName('name');
      if (name_node) {
        const attr_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
        
        // Common derive macros that affect types
        if (attr_name === 'derive') {
          const args = attr.childForFieldName('arguments');
          if (args) {
            // Track derived traits
            for (let i = 0; i < args.childCount; i++) {
              const arg = args.child(i);
              if (arg && arg.type === 'identifier') {
                const trait_name = context.source_code.substring(arg.startIndex, arg.endIndex);
                
                // These traits affect type behavior
                if (['Clone', 'Copy', 'Debug', 'PartialEq', 'Eq', 'Hash'].includes(trait_name)) {
                  // Mark that this type implements these traits
                  // This would be used for type compatibility checking
                }
              }
            }
          }
        }
      }
    }
  }
  
  return tracker;
}

// Helper functions

function extract_pattern_bindings(
  tracker: FileTypeTracker,
  pattern: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  // Extract variable bindings from patterns
  if (pattern.type === 'identifier_pattern') {
    const var_name = context.source_code.substring(pattern.startIndex, pattern.endIndex);
    
    const type_info: TypeInfo = {
      type_name: 'unknown', // Type will be inferred from context
      type_kind: 'unknown',
      location: node_to_location(pattern, context.file_path),
      confidence: 'inferred',
      source: 'assignment'
    };
    
    return set_variable_type(tracker, var_name, type_info);
  }
  
  // Tuple patterns
  if (pattern.type === 'tuple_pattern') {
    for (let i = 0; i < pattern.childCount; i++) {
      const child = pattern.child(i);
      if (child && child.type !== '(' && child.type !== ')' && child.type !== ',') {
        tracker = extract_pattern_bindings(tracker, child, context);
      }
    }
  }
  
  // Struct patterns
  if (pattern.type === 'struct_pattern') {
    const fields = pattern.childForFieldName('fields');
    if (fields) {
      for (let i = 0; i < fields.childCount; i++) {
        const field = fields.child(i);
        if (field) {
          tracker = extract_pattern_bindings(tracker, field, context);
        }
      }
    }
  }
  
  return tracker;
}