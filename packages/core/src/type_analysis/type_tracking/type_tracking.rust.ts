/**
 * Rust-specific type tracking
 * 
 * Handles Rust type tracking patterns including:
 * - Type annotations
 * - Structs and enums
 * - Traits and impls
 * - Generics and lifetimes
 * - Module imports
 */

// TODO: Return Type Inference - Update type map with inferred types

import { SyntaxNode } from 'tree-sitter';
import { Def } from '@ariadnejs/types';
import {
  TypeInfo,
  FileTypeTracker,
  TypeTrackingContext,
  set_variable_type,
  set_imported_class,
  infer_type_kind
} from './type_tracking';

/**
 * Track Rust variable assignments with type annotations
 */
export function track_rust_assignment(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  source_code: string,
  context: TypeTrackingContext
): FileTypeTracker {
  // Handle let bindings: let x: Type = value
  if (node.type === 'let_declaration') {
    const pattern_node = node.childForFieldName('pattern');
    const type_node = node.childForFieldName('type');
    const value_node = node.childForFieldName('value');
    
    if (pattern_node) {
      const var_name = extract_pattern_name(pattern_node, source_code);
      
      // First check for explicit type annotation
      if (type_node) {
        const type_info = extract_rust_type(type_node, source_code, context);
        if (type_info && var_name) {
          return set_variable_type(tracker, var_name, type_info);
        }
      }
      
      // Otherwise infer from value
      if (value_node && var_name) {
        const type_info = infer_rust_type(value_node, source_code, context);
        if (type_info) {
          return set_variable_type(tracker, var_name, type_info);
        }
      }
    }
  }
  
  // Handle constant declarations: const X: Type = value
  if (node.type === 'const_item') {
    const name_node = node.childForFieldName('name');
    const type_node = node.childForFieldName('type');
    
    if (name_node && type_node) {
      const var_name = source_code.substring(name_node.startIndex, name_node.endIndex);
      const type_info = extract_rust_type(type_node, source_code, context);
      
      if (type_info) {
        return set_variable_type(tracker, var_name, type_info);
      }
    }
  }
  
  // Handle static declarations: static X: Type = value
  if (node.type === 'static_item') {
    const name_node = node.childForFieldName('name');
    const type_node = node.childForFieldName('type');
    
    if (name_node && type_node) {
      const var_name = source_code.substring(name_node.startIndex, name_node.endIndex);
      const type_info = extract_rust_type(type_node, source_code, context);
      
      if (type_info) {
        return set_variable_type(tracker, var_name, type_info);
      }
    }
  }
  
  return tracker;
}

/**
 * Extract variable name from pattern
 */
function extract_pattern_name(pattern_node: SyntaxNode, source_code: string): string | undefined {
  if (pattern_node.type === 'identifier') {
    return source_code.substring(pattern_node.startIndex, pattern_node.endIndex);
  }
  
  // Handle tuple patterns, struct patterns, etc.
  // For now, just return undefined for complex patterns
  return undefined;
}

/**
 * Extract Rust type from type annotation
 */
export function extract_rust_type(
  type_node: SyntaxNode,
  source_code: string,
  context: TypeTrackingContext
): TypeInfo | undefined {
  const position = {
    row: type_node.startPosition.row,
    column: type_node.startPosition.column
  };
  
  // Primitive types
  if (type_node.type === 'primitive_type') {
    const type_name = source_code.substring(type_node.startIndex, type_node.endIndex);
    return {
      type_name,
      type_kind: 'primitive',
      position,
      confidence: 'explicit',
      source: 'annotation'
    };
  }
  
  // Type identifiers (custom types, structs, enums)
  if (type_node.type === 'type_identifier') {
    const type_name = source_code.substring(type_node.startIndex, type_node.endIndex);
    return {
      type_name,
      type_kind: determine_rust_type_kind(type_name),
      position,
      confidence: 'explicit',
      source: 'annotation'
    };
  }
  
  // Reference types (&Type, &mut Type)
  if (type_node.type === 'reference_type') {
    const inner_type = type_node.childForFieldName('type');
    if (inner_type) {
      const base_type = extract_rust_type(inner_type, source_code, context);
      if (base_type) {
        const is_mutable = source_code.substring(type_node.startIndex, inner_type.startIndex).includes('mut');
        return {
          type_name: `&${is_mutable ? 'mut ' : ''}${base_type.type_name}`,
          type_kind: base_type.type_kind,
          position,
          confidence: 'explicit',
          source: 'annotation'
        };
      }
    }
  }
  
  // Array types ([Type; N])
  if (type_node.type === 'array_type') {
    const element_type = type_node.childForFieldName('element');
    if (element_type) {
      const base_type = extract_rust_type(element_type, source_code, context);
      if (base_type) {
        const length_node = type_node.childForFieldName('length');
        const length = length_node 
          ? source_code.substring(length_node.startIndex, length_node.endIndex)
          : '_';
        return {
          type_name: `[${base_type.type_name}; ${length}]`,
          type_kind: 'array',
          position,
          confidence: 'explicit',
          source: 'annotation'
        };
      }
    }
  }
  
  // Slice types ([Type])
  if (type_node.type === 'slice_type') {
    const element_type = type_node.childForFieldName('element');
    if (element_type) {
      const base_type = extract_rust_type(element_type, source_code, context);
      if (base_type) {
        return {
          type_name: `[${base_type.type_name}]`,
          type_kind: 'array',
          position,
          confidence: 'explicit',
          source: 'annotation'
        };
      }
    }
  }
  
  // Tuple types ((Type1, Type2))
  if (type_node.type === 'tuple_type') {
    const types: string[] = [];
    for (let i = 0; i < type_node.childCount; i++) {
      const child = type_node.child(i);
      if (child && child.type !== ',' && child.type !== '(' && child.type !== ')') {
        const child_type = extract_rust_type(child, source_code, context);
        if (child_type) {
          types.push(child_type.type_name);
        }
      }
    }
    
    return {
      type_name: `(${types.join(', ')})`,
      type_kind: 'unknown',
      position,
      confidence: 'explicit',
      source: 'annotation'
    };
  }
  
  // Generic types (Vec<T>, Option<T>, etc.)
  if (type_node.type === 'generic_type') {
    const type_ident = type_node.childForFieldName('type');
    const type_args = type_node.childForFieldName('type_arguments');
    
    if (type_ident) {
      const base_name = source_code.substring(type_ident.startIndex, type_ident.endIndex);
      
      if (type_args) {
        const args_text = source_code.substring(type_args.startIndex, type_args.endIndex);
        return {
          type_name: `${base_name}${args_text}`,
          type_kind: base_name === 'Vec' ? 'array' : 'class',
          position,
          confidence: 'explicit',
          source: 'annotation'
        };
      }
      
      return {
        type_name: base_name,
        type_kind: 'class',
        position,
        confidence: 'explicit',
        source: 'annotation'
      };
    }
  }
  
  // Function pointer types (fn(...) -> Type)
  if (type_node.type === 'function_type') {
    return {
      type_name: 'fn',
      type_kind: 'function',
      position,
      confidence: 'explicit',
      source: 'annotation'
    };
  }
  
  // Pointer types (*const Type, *mut Type)
  if (type_node.type === 'pointer_type') {
    const inner_type = type_node.childForFieldName('type');
    if (inner_type) {
      const base_type = extract_rust_type(inner_type, source_code, context);
      if (base_type) {
        const is_mutable = source_code.substring(type_node.startIndex, inner_type.startIndex).includes('mut');
        return {
          type_name: `*${is_mutable ? 'mut' : 'const'} ${base_type.type_name}`,
          type_kind: base_type.type_kind,
          position,
          confidence: 'explicit',
          source: 'annotation'
        };
      }
    }
  }
  
  return undefined;
}

/**
 * Infer type from a Rust expression
 */
export function infer_rust_type(
  node: SyntaxNode,
  source_code: string,
  context: TypeTrackingContext
): TypeInfo | undefined {
  const position = {
    row: node.startPosition.row,
    column: node.startPosition.column
  };
  
  // String literals
  if (node.type === 'string_literal') {
    return {
      type_name: '&str',
      type_kind: 'primitive',
      position,
      confidence: 'explicit',
      source: 'assignment'
    };
  }
  
  // Integer literals
  if (node.type === 'integer_literal') {
    const text = source_code.substring(node.startIndex, node.endIndex);
    // Check for type suffix (e.g., 42i32, 100u64)
    const suffix_match = text.match(/[iu](8|16|32|64|128|size)$/);
    if (suffix_match) {
      return {
        type_name: suffix_match[0],
        type_kind: 'primitive',
        position,
        confidence: 'explicit',
        source: 'assignment'
      };
    }
    // Default to i32
    return {
      type_name: 'i32',
      type_kind: 'primitive',
      position,
      confidence: 'inferred',
      source: 'assignment'
    };
  }
  
  // Float literals
  if (node.type === 'float_literal') {
    const text = source_code.substring(node.startIndex, node.endIndex);
    // Check for type suffix (e.g., 3.14f32, 2.71f64)
    const suffix_match = text.match(/f(32|64)$/);
    if (suffix_match) {
      return {
        type_name: suffix_match[0],
        type_kind: 'primitive',
        position,
        confidence: 'explicit',
        source: 'assignment'
      };
    }
    // Default to f64
    return {
      type_name: 'f64',
      type_kind: 'primitive',
      position,
      confidence: 'inferred',
      source: 'assignment'
    };
  }
  
  // Boolean literals
  if (node.type === 'boolean_literal') {
    return {
      type_name: 'bool',
      type_kind: 'primitive',
      position,
      confidence: 'explicit',
      source: 'assignment'
    };
  }
  
  // Array expressions
  if (node.type === 'array_expression') {
    return {
      type_name: 'array',
      type_kind: 'array',
      position,
      confidence: 'inferred',
      source: 'assignment'
    };
  }
  
  // Tuple expressions
  if (node.type === 'tuple_expression') {
    return {
      type_name: 'tuple',
      type_kind: 'unknown',
      position,
      confidence: 'inferred',
      source: 'assignment'
    };
  }
  
  // Struct expressions
  if (node.type === 'struct_expression') {
    const type_node = node.childForFieldName('name');
    if (type_node) {
      const struct_name = source_code.substring(type_node.startIndex, type_node.endIndex);
      return {
        type_name: struct_name,
        type_kind: 'class',
        position,
        confidence: 'explicit',
        source: 'constructor'
      };
    }
  }
  
  // Call expressions - check for known constructors
  if (node.type === 'call_expression') {
    const function_node = node.childForFieldName('function');
    if (function_node) {
      const func_text = source_code.substring(function_node.startIndex, function_node.endIndex);
      
      // Common constructors
      if (func_text.endsWith('::new')) {
        const type_name = func_text.replace('::new', '');
        return {
          type_name,
          type_kind: 'class',
          position,
          confidence: 'inferred',
          source: 'constructor'
        };
      }
      
      // Vec! macro
      if (func_text === 'vec!') {
        return {
          type_name: 'Vec',
          type_kind: 'array',
          position,
          confidence: 'inferred',
          source: 'constructor'
        };
      }
    }
  }
  
  return undefined;
}

/**
 * Track Rust imports (use statements)
 */
export function track_rust_imports(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  source_code: string,
  context: TypeTrackingContext
): FileTypeTracker {
  if (node.type === 'use_declaration') {
    const use_list = node.childForFieldName('argument');
    if (use_list) {
      return track_use_list(tracker, use_list, source_code, context, '');
    }
  }
  
  return tracker;
}

/**
 * Track items from a use list
 */
function track_use_list(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  source_code: string,
  context: TypeTrackingContext,
  base_path: string
): FileTypeTracker {
  let updated_tracker = tracker;
  
  // Handle simple identifier
  if (node.type === 'identifier') {
    const name = source_code.substring(node.startIndex, node.endIndex);
    const full_path = base_path ? `${base_path}::${name}` : name;
    
    updated_tracker = set_imported_class(updated_tracker, name, {
      class_name: name,
      source_module: full_path,
      local_name: name,
      is_default: false
    });
  }
  
  // Handle scoped identifier (module::Type)
  if (node.type === 'scoped_identifier') {
    const path_parts: string[] = [];
    let current = node;
    
    while (current.type === 'scoped_identifier') {
      const name_node = current.childForFieldName('name');
      if (name_node) {
        path_parts.unshift(source_code.substring(name_node.startIndex, name_node.endIndex));
      }
      const path_node = current.childForFieldName('path');
      if (path_node && path_node.type === 'scoped_identifier') {
        current = path_node;
      } else if (path_node) {
        path_parts.unshift(source_code.substring(path_node.startIndex, path_node.endIndex));
        break;
      } else {
        break;
      }
    }
    
    const full_path = path_parts.join('::');
    const local_name = path_parts[path_parts.length - 1];
    
    updated_tracker = set_imported_class(updated_tracker, local_name, {
      class_name: local_name,
      source_module: full_path,
      local_name,
      is_default: false
    });
  }
  
  // Handle use list (use mod::{Type1, Type2})
  if (node.type === 'use_list') {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type !== '{' && child.type !== '}' && child.type !== ',') {
        updated_tracker = track_use_list(updated_tracker, child, source_code, context, base_path);
      }
    }
  }
  
  // Handle use as (use mod::Type as Alias)
  if (node.type === 'use_as_clause') {
    const path_node = node.childForFieldName('path');
    const alias_node = node.childForFieldName('alias');
    
    if (path_node && alias_node) {
      const path = source_code.substring(path_node.startIndex, path_node.endIndex);
      const alias = source_code.substring(alias_node.startIndex, alias_node.endIndex);
      
      updated_tracker = set_imported_class(updated_tracker, alias, {
        class_name: path.split('::').pop() || path,
        source_module: path,
        local_name: alias,
        is_default: false
      });
    }
  }
  
  // Handle glob imports (use mod::*)
  if (node.type === 'use_wildcard') {
    // We can't track specific types from glob imports
    // Just mark that we have a glob import from this module
  }
  
  return updated_tracker;
}

/**
 * Track Rust struct definitions
 */
export function track_rust_struct(
  tracker: FileTypeTracker,
  struct_def: Def,
  source_code: string,
  context: TypeTrackingContext
): FileTypeTracker {
  // Register the struct as a type
  const type_info: TypeInfo = {
    type_name: struct_def.name,
    type_kind: 'class',
    position: {
      row: struct_def.range.start.row,
      column: struct_def.range.start.column
    },
    confidence: 'explicit',
    source: 'annotation'
  };
  
  return set_variable_type(tracker, struct_def.name, type_info);
}

/**
 * Track Rust enum definitions
 */
export function track_rust_enum(
  tracker: FileTypeTracker,
  enum_def: Def,
  source_code: string,
  context: TypeTrackingContext
): FileTypeTracker {
  // Register the enum as a type
  const type_info: TypeInfo = {
    type_name: enum_def.name,
    type_kind: 'unknown', // Enums are special in Rust
    position: {
      row: enum_def.range.start.row,
      column: enum_def.range.start.column
    },
    confidence: 'explicit',
    source: 'annotation'
  };
  
  return set_variable_type(tracker, enum_def.name, type_info);
}

/**
 * Track Rust trait definitions
 */
export function track_rust_trait(
  tracker: FileTypeTracker,
  trait_def: Def,
  source_code: string,
  context: TypeTrackingContext
): FileTypeTracker {
  // Register the trait as a type (similar to interface)
  const type_info: TypeInfo = {
    type_name: trait_def.name,
    type_kind: 'interface',
    position: {
      row: trait_def.range.start.row,
      column: trait_def.range.start.column
    },
    confidence: 'explicit',
    source: 'annotation'
  };
  
  return set_variable_type(tracker, trait_def.name, type_info);
}

/**
 * Track Rust function parameters
 */
export function track_rust_parameters(
  tracker: FileTypeTracker,
  func_node: SyntaxNode,
  source_code: string,
  context: TypeTrackingContext
): FileTypeTracker {
  let updated_tracker = tracker;
  const params_node = func_node.childForFieldName('parameters');
  
  if (params_node) {
    for (let i = 0; i < params_node.childCount; i++) {
      const param = params_node.child(i);
      if (param && param.type === 'parameter') {
        const pattern_node = param.childForFieldName('pattern');
        const type_node = param.childForFieldName('type');
        
        if (pattern_node && type_node) {
          const param_name = extract_pattern_name(pattern_node, source_code);
          const type_info = extract_rust_type(type_node, source_code, context);
          
          if (param_name && type_info) {
            updated_tracker = set_variable_type(updated_tracker, param_name, type_info);
          }
        }
      }
    }
  }
  
  return updated_tracker;
}

/**
 * Infer return type from Rust function
 */
export function infer_rust_return_type(
  func_node: SyntaxNode,
  source_code: string,
  tracker: FileTypeTracker,
  context: TypeTrackingContext
): TypeInfo | undefined {
  // Check for explicit return type annotation
  const return_type_node = func_node.childForFieldName('return_type');
  if (return_type_node) {
    // Skip the arrow (->)
    for (let i = 0; i < return_type_node.childCount; i++) {
      const child = return_type_node.child(i);
      if (child && child.type !== '->') {
        return extract_rust_type(child, source_code, context);
      }
    }
  }
  
  // No explicit return type means () (unit type) in Rust
  return {
    type_name: '()',
    type_kind: 'primitive',
    position: {
      row: func_node.startPosition.row,
      column: func_node.startPosition.column
    },
    confidence: 'inferred',
    source: 'return'
  };
}

/**
 * Determine the kind of a Rust type
 */
function determine_rust_type_kind(type_name: string): TypeInfo['type_kind'] {
  // Common Rust collections
  const collections = ['Vec', 'HashMap', 'HashSet', 'BTreeMap', 'BTreeSet', 'VecDeque'];
  if (collections.includes(type_name)) {
    return 'array';
  }
  
  // Common smart pointers and wrappers
  const wrappers = ['Box', 'Rc', 'Arc', 'RefCell', 'Mutex', 'RwLock', 'Option', 'Result'];
  if (wrappers.includes(type_name)) {
    return 'class';
  }
  
  // Check for common patterns
  if (type_name[0] === type_name[0].toUpperCase()) {
    // Likely a struct or enum
    return 'class';
  }
  
  return 'unknown';
}

/**
 * Check if a type is a generic type parameter
 */
export function is_generic_parameter(type_name: string): boolean {
  // Common generic parameter names in Rust
  const generic_names = ['T', 'U', 'V', 'K', 'E', 'R'];
  
  // Single uppercase letter is likely generic
  if (type_name.length === 1 && type_name[0] === type_name[0].toUpperCase()) {
    return true;
  }
  
  return generic_names.includes(type_name);
}

/**
 * Extract lifetime parameters from a type
 */
export function extract_lifetime_parameters(
  type_node: SyntaxNode,
  source_code: string
): string[] {
  const lifetimes: string[] = [];
  
  function traverse(node: SyntaxNode) {
    if (node.type === 'lifetime') {
      const lifetime = source_code.substring(node.startIndex, node.endIndex);
      lifetimes.push(lifetime);
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        traverse(child);
      }
    }
  }
  
  traverse(type_node);
  return lifetimes;
}