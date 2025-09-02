/**
 * Constructor call detection
 * 
 * Dispatcher for language-specific constructor call detection
 */

import { ConstructorCallContext } from './constructor_calls';

// Re-export types
export { ConstructorCallContext } from './constructor_calls';
export { ConstructorCallInfo } from '@ariadnejs/types';
import { find_constructor_calls_javascript } from './constructor_calls.javascript';
import { find_constructor_calls_typescript } from './constructor_calls.typescript';
import { find_constructor_calls_python } from './constructor_calls.python';
import { find_constructor_calls_rust } from './constructor_calls.rust';
import { ConstructorCallInfo } from '@ariadnejs/types';
import { ConstructorCallResult } from './constructor_type_extraction';

// Export type validation functions for Global Assembly phase
export {
  enrich_constructor_calls_with_types,
  validate_constructor,
  batch_validate_constructors,
  get_constructable_types,
  ConstructorCallWithType,
  ParameterInfo
} from './constructor_type_resolver';

// Export bidirectional flow functions
export {
  extract_constructor_calls_and_types,
  merge_constructor_types,
  ConstructorCallResult,
  ConstructorTypeAssignment
} from './constructor_type_extraction';

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

/**
 * Find constructor calls and extract type assignments (Bidirectional Flow)
 * 
 * This enhanced version returns both constructor calls and type assignments
 * discovered from those calls. This enables bidirectional flow between
 * constructor_calls and type_tracking.
 * 
 * When we see `const foo = new Bar()`, we return:
 * - Constructor call: Bar was constructed
 * - Type assignment: foo is of type Bar
 * 
 * @param context The context containing source code, AST, and metadata
 * @returns Constructor calls and type assignments
 */
export function find_constructor_calls_with_types(
  context: ConstructorCallContext
): ConstructorCallResult {
  // Use the extraction function that handles both calls and types
  const { extract_constructor_calls_and_types } = require('./constructor_type_extraction');
  
  return extract_constructor_calls_and_types(
    context.ast_root,
    context.source_code,
    context.file_path,
    context.language
  );
}


