/**
 * Type tracking dispatcher
 * 
 * Routes type tracking operations to language-specific implementations
 */

import { SyntaxNode } from 'tree-sitter';
import { Def, Language } from '@ariadnejs/types';
import {
  TypeInfo,
  FileTypeTracker,
  LocalTypeTracker,
  ProjectTypeRegistry,
  TypeTrackingContext,
  ImportedClassInfo,
  ExportedTypeInfo,
  // Core functions
  create_file_type_tracker,
  create_local_type_tracker,
  create_project_type_registry,
  set_variable_type,
  get_variable_type,
  set_imported_class,
  get_imported_class,
  mark_as_exported,
  is_exported,
  get_exported_definitions,
  clear_file_type_tracker,
  set_local_variable_type,
  get_local_variable_type,
  get_local_imported_class,
  register_export,
  get_imported_type,
  clear_file_exports,
  set_variable_types,
  set_imported_classes,
  mark_as_exported_batch,
  register_exports,
  infer_type_kind,
  is_type_assignable
} from './type_tracking';

// Language-specific imports
import {
  track_javascript_assignment,
  track_javascript_imports,
  track_javascript_parameters,
  infer_javascript_return_type,
  infer_javascript_type,
  is_constructor_function
} from './type_tracking.javascript';

import {
  track_typescript_assignment,
  track_typescript_imports,
  track_typescript_interface,
  track_typescript_type_alias,
  track_typescript_enum,
  infer_typescript_return_type,
  extract_typescript_type,
  is_generic_parameter as is_typescript_generic,
  extract_generic_constraint
} from './type_tracking.typescript';

import {
  track_python_assignment,
  track_python_imports,
  track_python_class,
  track_python_function,
  infer_python_return_type,
  infer_python_type,
  is_builtin_type as is_python_builtin
} from './type_tracking.python';

import {
  track_rust_assignment,
  track_rust_imports,
  track_rust_struct,
  track_rust_enum,
  track_rust_trait,
  track_rust_parameters,
  infer_rust_return_type,
  extract_rust_type,
  is_generic_parameter as is_rust_generic,
  extract_lifetime_parameters
} from './type_tracking.rust';

// Re-export core types and functions
export {
  // Types
  TypeInfo,
  FileTypeTracker,
  LocalTypeTracker,
  ProjectTypeRegistry,
  TypeTrackingContext,
  ImportedClassInfo,
  ExportedTypeInfo,
  // Core functions
  create_file_type_tracker,
  create_local_type_tracker,
  create_project_type_registry,
  set_variable_type,
  get_variable_type,
  set_imported_class,
  get_imported_class,
  mark_as_exported,
  is_exported,
  get_exported_definitions,
  clear_file_type_tracker,
  set_local_variable_type,
  get_local_variable_type,
  get_local_imported_class,
  register_export,
  get_imported_type,
  clear_file_exports,
  set_variable_types,
  set_imported_classes,
  mark_as_exported_batch,
  register_exports,
  infer_type_kind,
  is_type_assignable
};

/**
 * Track variable assignment based on language
 */
export function track_assignment(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  source_code: string,
  context: TypeTrackingContext
): FileTypeTracker {
  switch (context.language) {
    case 'javascript':
      return track_javascript_assignment(tracker, node, source_code, context);
    case 'typescript':
      return track_typescript_assignment(tracker, node, source_code, context);
    case 'python':
      return track_python_assignment(tracker, node, source_code, context);
    case 'rust':
      return track_rust_assignment(tracker, node, source_code, context);
    default:
      if (context.debug) {
        console.warn(`Type tracking not implemented for language: ${context.language}`);
      }
      return tracker;
  }
}

/**
 * Track imports based on language
 */
export function track_imports(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  source_code: string,
  context: TypeTrackingContext
): FileTypeTracker {
  switch (context.language) {
    case 'javascript':
      return track_javascript_imports(tracker, node, source_code, context);
    case 'typescript':
      return track_typescript_imports(tracker, node, source_code, context);
    case 'python':
      return track_python_imports(tracker, node, source_code, context);
    case 'rust':
      return track_rust_imports(tracker, node, source_code, context);
    default:
      if (context.debug) {
        console.warn(`Import tracking not implemented for language: ${context.language}`);
      }
      return tracker;
  }
}

/**
 * Infer return type based on language
 */
export function infer_return_type(
  func_node: SyntaxNode,
  source_code: string,
  tracker: FileTypeTracker,
  context: TypeTrackingContext
): TypeInfo | undefined {
  switch (context.language) {
    case 'javascript':
      return infer_javascript_return_type(func_node, source_code, tracker, context);
    case 'typescript':
      return infer_typescript_return_type(func_node, source_code, tracker, context);
    case 'python':
      return infer_python_return_type(func_node, source_code, tracker, context);
    case 'rust':
      return infer_rust_return_type(func_node, source_code, tracker, context);
    default:
      if (context.debug) {
        console.warn(`Return type inference not implemented for language: ${context.language}`);
      }
      return undefined;
  }
}

/**
 * Infer type from expression based on language
 */
export function infer_type(
  node: SyntaxNode,
  source_code: string,
  context: TypeTrackingContext
): TypeInfo | undefined {
  switch (context.language) {
    case 'javascript':
      return infer_javascript_type(node, source_code, context);
    case 'typescript':
      // TypeScript can fall back to JavaScript inference
      return extract_typescript_type(node, source_code, context) || 
             infer_javascript_type(node, source_code, context);
    case 'python':
      return infer_python_type(node, source_code, context);
    case 'rust':
      return extract_rust_type(node, source_code, context);
    default:
      if (context.debug) {
        console.warn(`Type inference not implemented for language: ${context.language}`);
      }
      return undefined;
  }
}

/**
 * Track type definition based on language
 */
export function track_type_definition(
  tracker: FileTypeTracker,
  def: Def,
  source_code: string,
  context: TypeTrackingContext
): FileTypeTracker {
  switch (context.language) {
    case 'typescript':
      if (def.type === 'interface') {
        return track_typescript_interface(tracker, def, source_code, context);
      } else if (def.type === 'type_alias') {
        return track_typescript_type_alias(tracker, def, source_code, context);
      } else if (def.type === 'enum') {
        return track_typescript_enum(tracker, def, source_code, context);
      }
      break;
    case 'python':
      if (def.type === 'class') {
        return track_python_class(tracker, def, source_code, context);
      } else if (def.type === 'function') {
        return track_python_function(tracker, def, source_code, context);
      }
      break;
    case 'rust':
      if (def.type === 'struct') {
        return track_rust_struct(tracker, def, source_code, context);
      } else if (def.type === 'enum') {
        return track_rust_enum(tracker, def, source_code, context);
      } else if (def.type === 'trait') {
        return track_rust_trait(tracker, def, source_code, context);
      }
      break;
  }
  
  return tracker;
}

/**
 * Check if a name is a generic type parameter
 */
export function is_generic_parameter(
  type_name: string,
  language: Language
): boolean {
  switch (language) {
    case 'typescript':
      return is_typescript_generic(type_name);
    case 'rust':
      return is_rust_generic(type_name);
    default:
      // JavaScript and Python don't have static generics
      return false;
  }
}

/**
 * Check if a type is a built-in type
 */
export function is_builtin_type(
  type_name: string,
  language: Language
): boolean {
  switch (language) {
    case 'javascript':
    case 'typescript':
      const js_builtins = [
        'string', 'number', 'boolean', 'null', 'undefined', 'void', 'any', 'unknown',
        'String', 'Number', 'Boolean', 'Object', 'Array', 'Function', 'Symbol',
        'Date', 'RegExp', 'Error', 'Map', 'Set', 'WeakMap', 'WeakSet',
        'Promise', 'Proxy', 'Reflect'
      ];
      return js_builtins.includes(type_name);
    case 'python':
      return is_python_builtin(type_name);
    case 'rust':
      const rust_builtins = [
        'i8', 'i16', 'i32', 'i64', 'i128', 'isize',
        'u8', 'u16', 'u32', 'u64', 'u128', 'usize',
        'f32', 'f64', 'bool', 'char', 'str', '()',
        'Vec', 'String', 'Option', 'Result', 'Box', 'Rc', 'Arc'
      ];
      return rust_builtins.includes(type_name);
    default:
      return false;
  }
}

/**
 * Check if a variable is a constructor/class
 */
export function is_constructor(
  var_name: string,
  tracker: FileTypeTracker,
  language: Language
): boolean {
  switch (language) {
    case 'javascript':
    case 'typescript':
      return is_constructor_function(var_name, tracker);
    case 'python':
      // In Python, classes are just regular variables
      const type_info = get_variable_type(tracker, var_name);
      return type_info?.type_kind === 'class';
    case 'rust':
      // In Rust, structs/enums can be used as constructors
      const rust_type = get_variable_type(tracker, var_name);
      return rust_type?.type_kind === 'class';
    default:
      return false;
  }
}

/**
 * Process an entire file for type tracking
 */
export function process_file_for_types(
  source_code: string,
  tree: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  let tracker = create_file_type_tracker();
  
  // Walk the tree and track types
  function visit(node: SyntaxNode) {
    // Track assignments
    if (is_assignment_node(node, context.language)) {
      tracker = track_assignment(tracker, node, source_code, context);
    }
    
    // Track imports
    if (is_import_node(node, context.language)) {
      tracker = track_imports(tracker, node, source_code, context);
    }
    
    // Recurse
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        visit(child);
      }
    }
  }
  
  visit(tree);
  return tracker;
}

/**
 * Check if a node is an assignment
 */
function is_assignment_node(node: SyntaxNode, language: Language): boolean {
  switch (language) {
    case 'javascript':
    case 'typescript':
      return node.type === 'variable_declarator' || 
             node.type === 'assignment_expression';
    case 'python':
      return node.type === 'assignment';
    case 'rust':
      return node.type === 'let_declaration' || 
             node.type === 'const_item' || 
             node.type === 'static_item';
    default:
      return false;
  }
}

/**
 * Check if a node is an import
 */
function is_import_node(node: SyntaxNode, language: Language): boolean {
  switch (language) {
    case 'javascript':
    case 'typescript':
      return node.type === 'import_statement';
    case 'python':
      return node.type === 'import_statement' || 
             node.type === 'import_from_statement';
    case 'rust':
      return node.type === 'use_declaration';
    default:
      return false;
  }
}