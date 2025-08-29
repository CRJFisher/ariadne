/**
 * Constructor call detection
 * 
 * Dispatcher for language-specific constructor call detection
 */

import { ConstructorCallInfo } from '@ariadnejs/types';
import { ConstructorCallContext } from './constructor_calls';

// Re-export types
export { ConstructorCallInfo } from '@ariadnejs/types';
export { ConstructorCallContext } from './constructor_calls';
import { find_constructor_calls_javascript } from './constructor_calls.javascript';
import { find_constructor_calls_typescript } from './constructor_calls.typescript';
import { find_constructor_calls_python } from './constructor_calls.python';
import { find_constructor_calls_rust } from './constructor_calls.rust';

/**
 * Find all constructor calls in code
 * 
 * Dispatches to language-specific implementations based on the language parameter.
 * Each implementation handles the unique syntax and patterns of its language.
 * 
 * @param context The context containing source code, AST, and metadata
 * @param type_registry Optional type registry for validating constructor types (from Layer 6)
 * @returns Array of constructor call information
 */
export function find_constructor_calls(
  context: ConstructorCallContext,
  type_registry?: any // From type_registry - Layer 6
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


