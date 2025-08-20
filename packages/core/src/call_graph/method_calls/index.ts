/**
 * Method call detection and resolution
 * 
 * Dispatcher for language-specific method call detection
 */

import { Language } from '@ariadnejs/types';
import { SyntaxNode } from 'tree-sitter';
import { MethodCallInfo, MethodCallContext, MethodResolutionContext } from './method_calls';
import { find_method_calls_javascript } from './method_calls.javascript';
import { find_method_calls_typescript } from './method_calls.typescript';
import { find_method_calls_python } from './method_calls.python';
import { find_method_calls_rust } from './method_calls.rust';

// Re-export types and common functions
export {
  MethodCallInfo,
  MethodCallContext,
  MethodResolutionContext,
  is_method_call_node,
  is_member_access,
  extract_receiver_name,
  extract_method_name,
  is_static_method_call,
  is_chained_method_call,
  count_method_arguments,
  get_enclosing_class,
  resolve_method_simple
} from './method_calls';

// Re-export language-specific utilities
export { 
  is_prototype_method_call, 
  is_indirect_method_call,
  is_optional_chaining_call 
} from './method_calls.javascript';

export { 
  has_type_arguments_method,
  is_abstract_method_call,
  is_interface_method_call,
  extract_type_arguments
} from './method_calls.typescript';

export { 
  is_super_method_call,
  is_classmethod_call,
  is_dunder_method_call,
  is_property_access
} from './method_calls.python';

export { 
  is_trait_method_call,
  is_unsafe_method_call,
  has_turbofish_syntax,
  is_ref_method_call,
  get_impl_trait
} from './method_calls.rust';

/**
 * Find all method calls in code
 * 
 * Dispatches to language-specific implementations based on the language parameter.
 * Each implementation handles the unique syntax and patterns of its language.
 * 
 * @param context The context containing source code, AST, and metadata
 * @returns Array of method call information
 */
export function find_method_calls(
  context: MethodCallContext
): MethodCallInfo[] {
  switch (context.language) {
    case 'javascript':
      return find_method_calls_javascript(context);
    
    case 'typescript':
      return find_method_calls_typescript(context);
    
    case 'python':
      return find_method_calls_python(context);
    
    case 'rust':
      return find_method_calls_rust(context);
    
    default:
      // Return empty array for unsupported languages
      return [];
  }
}

/**
 * Find method calls from a string source
 * 
 * Convenience function that creates a context from basic inputs.
 * Requires parsing the source to create an AST.
 * 
 * @param source The source code string
 * @param file_path The file path for context
 * @param language The programming language
 * @param ast_root The parsed AST root node
 * @returns Array of method call information
 */
export function find_method_calls_from_source(
  source: string,
  file_path: string,
  language: Language,
  ast_root: SyntaxNode
): MethodCallInfo[] {
  const context: MethodCallContext = {
    source_code: source,
    file_path,
    language,
    ast_root
  };
  
  return find_method_calls(context);
}

/**
 * Filter method calls to only instance methods (exclude static)
 */
export function filter_instance_methods(
  calls: MethodCallInfo[]
): MethodCallInfo[] {
  return calls.filter(call => !call.is_static_method);
}

/**
 * Filter method calls to only static methods
 */
export function filter_static_methods(
  calls: MethodCallInfo[]
): MethodCallInfo[] {
  return calls.filter(call => call.is_static_method);
}

/**
 * Filter method calls to only chained calls
 */
export function filter_chained_calls(
  calls: MethodCallInfo[]
): MethodCallInfo[] {
  return calls.filter(call => call.is_chained_call);
}

/**
 * Group method calls by receiver
 */
export function group_by_receiver(
  calls: MethodCallInfo[]
): Map<string, MethodCallInfo[]> {
  const groups = new Map<string, MethodCallInfo[]>();
  
  for (const call of calls) {
    const receiver = call.receiver_name;
    if (!groups.has(receiver)) {
      groups.set(receiver, []);
    }
    groups.get(receiver)!.push(call);
  }
  
  return groups;
}

/**
 * Group method calls by method name
 */
export function group_by_method(
  calls: MethodCallInfo[]
): Map<string, MethodCallInfo[]> {
  const groups = new Map<string, MethodCallInfo[]>();
  
  for (const call of calls) {
    const method = call.method_name;
    if (!groups.has(method)) {
      groups.set(method, []);
    }
    groups.get(method)!.push(call);
  }
  
  return groups;
}