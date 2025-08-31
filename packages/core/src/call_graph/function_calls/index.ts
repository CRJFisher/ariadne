/**
 * Function call detection and analysis
 * 
 * Dispatcher for language-specific function call detection
 */

import { FunctionCallInfo } from '@ariadnejs/types';
import { FunctionCallContext } from './function_calls';

// Re-export types
import { find_function_calls_javascript } from './function_calls.javascript';
import { find_function_calls_typescript } from './function_calls.typescript';
import { find_function_calls_python } from './function_calls.python';
import { find_function_calls_rust } from './function_calls.rust';

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
  // TODO: verify there isn't any common function extraction logic that can be applied
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
