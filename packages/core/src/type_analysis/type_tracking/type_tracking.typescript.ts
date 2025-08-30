/**
 * TypeScript-specific type tracking
 * 
 * Handles TypeScript type tracking patterns including:
 * - Type annotations
 * - Interfaces
 * - Generics
 * - Type aliases
 * - Enums
 */

// TODO: Return Type Inference - Update type map with inferred types

import { SyntaxNode } from 'tree-sitter';
import { Def } from '@ariadnejs/types';
import {
  TypeInfo,
  FileTypeTracker,
  TypeTrackingContext,
  set_variable_type,
  set_imported_class
} from './type_tracking';
import {
  track_javascript_assignment,
  track_javascript_imports,
  infer_javascript_type
} from './type_tracking.javascript';

/**
 * Track TypeScript variable assignments with type annotations
 */
export function track_typescript_assignment(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  source_code: string,
  context: TypeTrackingContext
): FileTypeTracker {
  // First try JavaScript tracking
  let updated_tracker = track_javascript_assignment(tracker, node, source_code, context);
  
  // Then enhance with TypeScript-specific type annotations
  if (node.type === 'variable_declarator') {
    const name_node = node.childForFieldName('name');
    const type_node = node.childForFieldName('type');
    
    if (name_node && type_node) {
      const var_name = source_code.substring(name_node.startIndex, name_node.endIndex);
      const type_info = extract_typescript_type(type_node, source_code, context, tracker);
      
      if (type_info) {
        updated_tracker = set_variable_type(updated_tracker, var_name, type_info);
      }
    }
  }
  
  // Handle function parameters with type annotations
  if (node.type === 'function_declaration' || node.type === 'method_definition') {
    const params_node = node.childForFieldName('parameters');
    if (params_node) {
      updated_tracker = track_typed_parameters(updated_tracker, params_node, source_code, context);
    }
  }
  
  return updated_tracker;
}

/**
 * Extract TypeScript type from type annotation
 */
export function extract_typescript_type(
  type_node: SyntaxNode,
  source_code: string,
  context: TypeTrackingContext,
  tracker?: FileTypeTracker
): TypeInfo | undefined {
  const position = {
    row: type_node.startPosition.row,
    column: type_node.startPosition.column
  };
  
  // Handle type annotations (: type)
  if (type_node.type === 'type_annotation') {
    const actual_type = type_node.child(1); // Skip the colon
    if (actual_type) {
      return extract_typescript_type(actual_type, source_code, context, tracker);
    }
  }
  
  // Predefined types
  if (type_node.type === 'predefined_type') {
    const type_name = source_code.substring(type_node.startIndex, type_node.endIndex);
    return {
      type_name,
      type_kind: 'primitive',
      position,
      confidence: 'explicit',
      source: 'annotation'
    };
  }
  
  // Type identifiers (custom types, interfaces, classes)
  if (type_node.type === 'type_identifier') {
    const type_name = source_code.substring(type_node.startIndex, type_node.endIndex);
    
    // Check if this type is imported
    let qualified_name = type_name;
    let is_imported = false;
    if (tracker && tracker.imported_classes) {
      const import_info = tracker.imported_classes.get(type_name);
      if (import_info) {
        qualified_name = `${import_info.source_module}#${import_info.class_name}`;
        is_imported = true;
      }
    }
    
    return {
      type_name: qualified_name,
      type_kind: is_imported ? 'imported' : determine_type_kind(type_name),
      position,
      confidence: 'explicit',
      source: 'annotation',
      is_imported
    };
  }
  
  // Array types (type[])
  if (type_node.type === 'array_type') {
    const element_type = type_node.child(0);
    if (element_type) {
      const base_type = extract_typescript_type(element_type, source_code, context, tracker);
      if (base_type) {
        return {
          type_name: `${base_type.type_name}[]`,
          type_kind: 'array',
          position,
          confidence: 'explicit',
          source: 'annotation'
        };
      }
    }
  }
  
  // Generic types (Array<type>, Promise<type>, etc.)
  if (type_node.type === 'generic_type') {
    const identifier = type_node.childForFieldName('name');
    const type_arguments = type_node.childForFieldName('type_arguments');
    
    if (identifier) {
      const base_name = source_code.substring(identifier.startIndex, identifier.endIndex);
      
      if (type_arguments) {
        const args_text = source_code.substring(type_arguments.startIndex, type_arguments.endIndex);
        return {
          type_name: `${base_name}${args_text}`,
          type_kind: base_name === 'Array' ? 'array' : 'class',
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
  
  // Union types (type1 | type2)
  if (type_node.type === 'union_type') {
    const types: string[] = [];
    for (let i = 0; i < type_node.childCount; i++) {
      const child = type_node.child(i);
      if (child && child.type !== '|') {
        const child_type = extract_typescript_type(child, source_code, context, tracker);
        if (child_type) {
          types.push(child_type.type_name);
        }
      }
    }
    
    return {
      type_name: types.join(' | '),
      type_kind: 'unknown',
      position,
      confidence: 'explicit',
      source: 'annotation'
    };
  }
  
  // Intersection types (type1 & type2)
  if (type_node.type === 'intersection_type') {
    const types: string[] = [];
    for (let i = 0; i < type_node.childCount; i++) {
      const child = type_node.child(i);
      if (child && child.type !== '&') {
        const child_type = extract_typescript_type(child, source_code, context, tracker);
        if (child_type) {
          types.push(child_type.type_name);
        }
      }
    }
    
    return {
      type_name: types.join(' & '),
      type_kind: 'unknown',
      position,
      confidence: 'explicit',
      source: 'annotation'
    };
  }
  
  // Object types ({ prop: type })
  if (type_node.type === 'object_type') {
    return {
      type_name: 'object',
      type_kind: 'object',
      position,
      confidence: 'explicit',
      source: 'annotation'
    };
  }
  
  // Function types (() => type)
  if (type_node.type === 'function_type') {
    return {
      type_name: 'Function',
      type_kind: 'function',
      position,
      confidence: 'explicit',
      source: 'annotation'
    };
  }
  
  // Literal types
  if (type_node.type === 'literal_type') {
    const literal = type_node.child(0);
    if (literal) {
      const literal_value = source_code.substring(literal.startIndex, literal.endIndex);
      return {
        type_name: literal_value,
        type_kind: 'primitive',
        position,
        confidence: 'explicit',
        source: 'annotation'
      };
    }
  }
  
  return undefined;
}

/**
 * Track typed function parameters
 */
function track_typed_parameters(
  tracker: FileTypeTracker,
  params_node: SyntaxNode,
  source_code: string,
  context: TypeTrackingContext
): FileTypeTracker {
  let updated_tracker = tracker;
  
  for (let i = 0; i < params_node.childCount; i++) {
    const param = params_node.child(i);
    if (param && (param.type === 'required_parameter' || param.type === 'optional_parameter')) {
      const pattern = param.childForFieldName('pattern');
      const type_node = param.childForFieldName('type');
      
      if (pattern && type_node) {
        const param_name = source_code.substring(pattern.startIndex, pattern.endIndex);
        const type_info = extract_typescript_type(type_node, source_code, context, updated_tracker);
        
        if (type_info) {
          updated_tracker = set_variable_type(updated_tracker, param_name, type_info);
        }
      }
    }
  }
  
  return updated_tracker;
}

/**
 * Track TypeScript imports with type-only imports
 */
export function track_typescript_imports(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  source_code: string,
  context: TypeTrackingContext
): FileTypeTracker {
  // First handle regular JavaScript imports
  let updated_tracker = track_javascript_imports(tracker, node, source_code, context);
  
  // Handle type-only imports: import type { Type } from 'module'
  if (node.type === 'import_statement') {
    const type_keyword = node.child(1);
    if (type_keyword && type_keyword.type === 'type') {
      // Mark all imports from this statement as type-only
      const import_clause = node.childForFieldName('import');
      const source = node.childForFieldName('source');
      
      if (import_clause && source) {
        const source_module = source_code.substring(source.startIndex + 1, source.endIndex - 1);
        
        // Named imports
        const named_imports = import_clause.childForFieldName('named_imports');
        if (named_imports) {
          for (let i = 0; i < named_imports.childCount; i++) {
            const import_spec = named_imports.child(i);
            if (import_spec && import_spec.type === 'import_specifier') {
              const name_node = import_spec.childForFieldName('name');
              const alias_node = import_spec.childForFieldName('alias');
              
              if (name_node) {
                const import_name = source_code.substring(
                  name_node.startIndex,
                  name_node.endIndex
                );
                const local_name = alias_node
                  ? source_code.substring(alias_node.startIndex, alias_node.endIndex)
                  : import_name;
                
                updated_tracker = set_imported_class(updated_tracker, local_name, {
                  class_name: import_name,
                  source_module,
                  local_name,
                  is_default: false,
                  is_type_only: true
                });
              }
            }
          }
        }
      }
    }
  }
  
  return updated_tracker;
}

/**
 * Track TypeScript interface definitions
 */
export function track_typescript_interface(
  tracker: FileTypeTracker,
  interface_def: Def,
  source_code: string,
  context: TypeTrackingContext
): FileTypeTracker {
  // Register the interface as a type
  const type_info: TypeInfo = {
    type_name: interface_def.name,
    type_kind: 'interface',
    position: {
      row: interface_def.range.start.row,
      column: interface_def.range.start.column
    },
    confidence: 'explicit',
    source: 'annotation'
  };
  
  return set_variable_type(tracker, interface_def.name, type_info);
}

/**
 * Track TypeScript type aliases
 */
export function track_typescript_type_alias(
  tracker: FileTypeTracker,
  alias_def: Def,
  source_code: string,
  context: TypeTrackingContext
): FileTypeTracker {
  // Register the type alias
  const type_info: TypeInfo = {
    type_name: alias_def.name,
    type_kind: 'unknown', // Could be any kind depending on the alias
    position: {
      row: alias_def.range.start.row,
      column: alias_def.range.start.column
    },
    confidence: 'explicit',
    source: 'annotation'
  };
  
  return set_variable_type(tracker, alias_def.name, type_info);
}

/**
 * Track TypeScript enum definitions
 */
export function track_typescript_enum(
  tracker: FileTypeTracker,
  enum_def: Def,
  source_code: string,
  context: TypeTrackingContext
): FileTypeTracker {
  // Register the enum as a type
  const type_info: TypeInfo = {
    type_name: enum_def.name,
    type_kind: 'unknown', // Enums are special
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
 * Infer return type from TypeScript function with type annotation
 */
export function infer_typescript_return_type(
  func_node: SyntaxNode,
  source_code: string,
  tracker: FileTypeTracker,
  context: TypeTrackingContext
): TypeInfo | undefined {
  // Check for explicit return type annotation
  const return_type_node = func_node.childForFieldName('return_type');
  if (return_type_node) {
    return extract_typescript_type(return_type_node, source_code, context, tracker);
  }
  
  // Fall back to JavaScript inference
  return infer_javascript_type(func_node, source_code, context);
}

/**
 * Determine the kind of a TypeScript type
 */
function determine_type_kind(type_name: string): TypeInfo['type_kind'] {
  // Check for common patterns
  if (type_name.startsWith('I') && type_name[1] === type_name[1].toUpperCase()) {
    // Convention: interfaces often start with I
    return 'interface';
  }
  
  if (type_name[0] === type_name[0].toUpperCase()) {
    // Likely a class or interface
    return 'class';
  }
  
  return 'unknown';
}

/**
 * Check if a type is a generic type parameter
 */
export function is_generic_parameter(type_name: string): boolean {
  // Common generic parameter names
  const generic_names = ['T', 'U', 'V', 'K', 'P', 'TKey', 'TValue', 'TResult'];
  return generic_names.includes(type_name) || /^T[A-Z]/.test(type_name);
}

/**
 * Extract generic constraints from a type parameter
 */
export function extract_generic_constraint(
  type_param_node: SyntaxNode,
  source_code: string
): string | undefined {
  const constraint_node = type_param_node.childForFieldName('constraint');
  if (constraint_node) {
    return source_code.substring(constraint_node.startIndex, constraint_node.endIndex);
  }
  return undefined;
}