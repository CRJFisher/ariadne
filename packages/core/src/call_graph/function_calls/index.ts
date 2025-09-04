/**
 * Function call detection and analysis
 * 
 * Uses configuration-driven generic processing with language-specific fallbacks
 */

import { FunctionCallInfo } from '@ariadnejs/types';
import { FunctionCallContext } from './function_calls';
import { find_function_calls_generic } from './generic_processor';

// Re-export types
export { FunctionCallInfo } from '@ariadnejs/types';
export { FunctionCallContext } from './function_calls';

// Import language-specific implementations for bespoke features
import { handle_typescript_decorators } from './function_calls.typescript';
import { handle_rust_macros } from './function_calls.rust';
import { handle_python_comprehensions } from './function_calls.python';

/**
 * Find all function calls in code
 * 
 * Uses generic processor with configuration-driven approach for 80% of functionality.
 * Language-specific handlers are called for truly unique features that can't be
 * expressed through configuration.
 * 
 * @param context The context containing source code, AST, and metadata
 * @returns Array of function call information
 */
export function find_function_calls(
  context: FunctionCallContext
): FunctionCallInfo[] {
  // Use generic processor for all languages
  const calls = find_function_calls_generic(context);
  
  // Apply language-specific enhancements for bespoke features
  switch (context.language) {
    case 'typescript':
      // TypeScript decorators require special handling
      return enhance_with_typescript_features(calls, context);
    
    case 'rust':
      // Rust macros have already been handled in generic processor
      // but may need additional enhancement
      return enhance_with_rust_features(calls, context);
    
    case 'python':
      // Python comprehensions may contain function calls
      return enhance_with_python_features(calls, context);
    
    case 'javascript':
      // JavaScript is fully handled by generic processor
      return calls;
    
    default:
      // For any unsupported language, return what we found
      return calls;
  }
}

/**
 * Enhance with TypeScript-specific features
 */
function enhance_with_typescript_features(
  calls: FunctionCallInfo[],
  context: FunctionCallContext
): FunctionCallInfo[] {
  // Check if we have the bespoke handler available
  if (typeof handle_typescript_decorators === 'function') {
    const decorator_calls = handle_typescript_decorators(context);
    return [...calls, ...decorator_calls];
  }
  return calls;
}

/**
 * Enhance with Rust-specific features
 */
function enhance_with_rust_features(
  calls: FunctionCallInfo[],
  context: FunctionCallContext
): FunctionCallInfo[] {
  // Macros are already handled in generic processor
  // Add any additional Rust-specific enhancements here if needed
  return calls;
}

/**
 * Enhance with Python-specific features
 */
function enhance_with_python_features(
  calls: FunctionCallInfo[],
  context: FunctionCallContext
): FunctionCallInfo[] {
  // Check if we have the bespoke handler available
  if (typeof handle_python_comprehensions === 'function') {
    const comprehension_calls = handle_python_comprehensions(context);
    return [...calls, ...comprehension_calls];
  }
  return calls;
}
