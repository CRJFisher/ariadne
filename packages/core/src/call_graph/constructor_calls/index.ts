/**
 * Constructor call detection and type tracking
 * 
 * Dispatcher for language-specific constructor call detection
 */

import { Language } from '@ariadnejs/types';
import { SyntaxNode } from 'tree-sitter';
import { ConstructorCallInfo, ConstructorCallContext, TypeAssignment } from './constructor_calls';
import { find_constructor_calls_javascript, get_type_assignments_javascript } from './constructor_calls.javascript';
import { find_constructor_calls_typescript, get_type_assignments_typescript } from './constructor_calls.typescript';
import { find_constructor_calls_python, get_type_assignments_python } from './constructor_calls.python';
import { find_constructor_calls_rust, get_type_assignments_rust } from './constructor_calls.rust';

// Re-export types and common functions
export {
  ConstructorCallInfo,
  ConstructorCallContext,
  TypeAssignment,
  is_constructor_call_node,
  extract_constructor_name,
  find_assignment_target,
  count_constructor_arguments,
  uses_new_keyword,
  is_factory_method_pattern,
  get_assignment_scope,
  create_type_assignment
} from './constructor_calls';

// Re-export language-specific utilities
export { 
  is_object_create_pattern,
  is_class_extends,
  get_parent_class
} from './constructor_calls.javascript';

export { 
  has_type_arguments_constructor,
  extract_constructor_type_arguments,
  is_abstract_class,
  get_implemented_interfaces,
  has_satisfies_constraint
} from './constructor_calls.typescript';

export { 
  is_super_init_call,
  is_metaclass_instantiation,
  is_namedtuple_creation,
  extract_init_parameters
} from './constructor_calls.python';

export { 
  is_box_new_pattern,
  is_smart_pointer_creation,
  has_derive_default
} from './constructor_calls.rust';

/**
 * Find all constructor calls in code
 * 
 * Dispatches to language-specific implementations based on the language parameter.
 * Each implementation handles the unique syntax and patterns of its language.
 * 
 * @param context The context containing source code, AST, and metadata
 * @returns Array of constructor call information
 */
export function find_constructor_calls(
  context: ConstructorCallContext
): ConstructorCallInfo[] {
  switch (context.language) {
    case 'javascript':
      return find_constructor_calls_javascript(context);
    
    case 'typescript':
      return find_constructor_calls_typescript(context);
    
    case 'python':
      return find_constructor_calls_python(context);
    
    case 'rust':
      return find_constructor_calls_rust(context);
    
    default:
      // Return empty array for unsupported languages
      return [];
  }
}

/**
 * Get type assignments from constructor calls
 * 
 * Analyzes constructor calls to determine variable type assignments.
 * This is useful for type tracking and method resolution.
 * 
 * @param context The context containing source code, AST, and metadata
 * @returns Array of type assignments
 */
export function get_type_assignments(
  context: ConstructorCallContext
): TypeAssignment[] {
  switch (context.language) {
    case 'javascript':
      return get_type_assignments_javascript(context);
    
    case 'typescript':
      return get_type_assignments_typescript(context);
    
    case 'python':
      return get_type_assignments_python(context);
    
    case 'rust':
      return get_type_assignments_rust(context);
    
    default:
      return [];
  }
}

/**
 * Find constructor calls from a string source
 * 
 * Convenience function that creates a context from basic inputs.
 * 
 * @param source The source code string
 * @param file_path The file path for context
 * @param language The programming language
 * @param ast_root The parsed AST root node
 * @returns Array of constructor call information
 */
export function find_constructor_calls_from_source(
  source: string,
  file_path: string,
  language: Language,
  ast_root: SyntaxNode
): ConstructorCallInfo[] {
  const context: ConstructorCallContext = {
    source_code: source,
    file_path,
    language,
    ast_root
  };
  
  return find_constructor_calls(context);
}

/**
 * Filter constructor calls that have variable assignments
 */
export function filter_with_assignments(
  calls: ConstructorCallInfo[]
): ConstructorCallInfo[] {
  return calls.filter(call => call.assigned_to !== undefined);
}

/**
 * Filter constructor calls that use 'new' keyword
 */
export function filter_new_expressions(
  calls: ConstructorCallInfo[]
): ConstructorCallInfo[] {
  return calls.filter(call => call.is_new_expression);
}

/**
 * Filter factory method calls
 */
export function filter_factory_methods(
  calls: ConstructorCallInfo[]
): ConstructorCallInfo[] {
  return calls.filter(call => call.is_factory_method);
}

/**
 * Group constructor calls by constructor name
 */
export function group_by_constructor(
  calls: ConstructorCallInfo[]
): Map<string, ConstructorCallInfo[]> {
  const groups = new Map<string, ConstructorCallInfo[]>();
  
  for (const call of calls) {
    const name = call.constructor_name;
    if (!groups.has(name)) {
      groups.set(name, []);
    }
    groups.get(name)!.push(call);
  }
  
  return groups;
}

/**
 * Create a type mapping from type assignments
 */
export function create_type_map(
  assignments: TypeAssignment[]
): Map<string, string> {
  const map = new Map<string, string>();
  
  for (const assignment of assignments) {
    map.set(assignment.variable_name, assignment.type_name);
  }
  
  return map;
}

/**
 * Get type assignments for local scope only
 */
export function get_local_type_assignments(
  assignments: TypeAssignment[]
): TypeAssignment[] {
  return assignments.filter(a => a.scope === 'local');
}

/**
 * Get type assignments for member variables
 */
export function get_member_type_assignments(
  assignments: TypeAssignment[]
): TypeAssignment[] {
  return assignments.filter(a => a.scope === 'member');
}