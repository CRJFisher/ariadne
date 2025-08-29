/**
 * Function call detection and analysis
 * 
 * Dispatcher for language-specific function call detection
 */

import { Language } from '@ariadnejs/types';
import { SyntaxNode } from 'tree-sitter';
import { FunctionCallInfo, FunctionCallContext } from './function_calls';
import { find_function_calls_javascript } from './function_calls.javascript';
import { find_function_calls_typescript } from './function_calls.typescript';
import { find_function_calls_python } from './function_calls.python';
import { find_function_calls_rust } from './function_calls.rust';

// Re-export types and common functions
export {
  FunctionCallInfo,
  FunctionCallContext,
  MODULE_CONTEXT,
  is_function_call_node,
  get_call_expression_types,
  extract_callee_name,
  is_method_call,
  get_method_receiver,
  count_arguments,
  get_enclosing_function_name
} from './function_calls';

// Re-export language-specific utilities
export { is_async_call, is_generator_call } from './function_calls.javascript';
export { has_type_arguments } from './function_calls.typescript';
export { is_decorator_call, is_comprehension_call, is_async_call_python, is_super_call } from './function_calls.python';
export { is_unsafe_call, is_async_call_rust } from './function_calls.rust';

/**
 * Find all function calls in code
 * 
 * Dispatches to language-specific implementations based on the language parameter.
 * Each implementation handles the unique syntax and patterns of its language.
 * 
 * @param context The context containing source code, AST, and metadata
 * @returns Array of function call information
 */
export function find_function_calls(
  context: FunctionCallContext
): FunctionCallInfo[] {
  switch (context.language) {
    case 'javascript':
      return find_function_calls_javascript(context);
    
    case 'typescript':
      return find_function_calls_typescript(context);
    
    case 'python':
      return find_function_calls_python(context);
    
    case 'rust':
      return find_function_calls_rust(context);
    
    default:
      // Return empty array for unsupported languages
      return [];
  }
}

/**
 * Find function calls from a string source
 * 
 * Convenience function that creates a context from basic inputs.
 * Requires parsing the source to create an AST.
 * 
 * @param source The source code string
 * @param file_path The file path for context
 * @param language The programming language
 * @param ast_root The parsed AST root node
 * @returns Array of function call information
 */
export function find_function_calls_from_source(
  source: string,
  file_path: string,
  language: Language,
  ast_root: SyntaxNode
): FunctionCallInfo[] {
  const context: FunctionCallContext = {
    source_code: source,
    file_path,
    language,
    ast_root
  };
  
  return find_function_calls(context);
}

/**
 * Check if a language is supported for function call detection
 */
export function is_language_supported(language: Language): boolean {
  return ['javascript', 'typescript', 'python', 'rust'].includes(language);
}