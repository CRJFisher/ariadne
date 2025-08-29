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
 * Find all constructor calls in code (Per-File Phase - Layer 4)
 * 
 * Dispatches to language-specific implementations based on the language parameter.
 * Each implementation handles the unique syntax and patterns of its language.
 * 
 * NOTE: This is a per-file analysis function. It identifies constructor call syntax
 * but cannot validate if the constructor actually exists in the codebase.
 * Full validation happens in the global phase with the type registry.
 * 
 * @param context The context containing source code, AST, and metadata
 * @returns Array of constructor call information (unvalidated)
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


