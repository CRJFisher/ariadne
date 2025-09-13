/**
 * TypeScript-specific bespoke features that cannot be expressed through configuration
 */

import { SyntaxNode } from 'tree-sitter';
import { FunctionCallContext } from './function_calls';
import { CallInfo } from '@ariadnejs/types';
import { node_to_location } from '../../ast/node_utils';

/**
 * Handle TypeScript decorators
 * 
 * Decorators in TypeScript require special handling as they have unique
 * syntax and semantics that can't be expressed through configuration.
 */
export function handle_typescript_decorators(
  context: FunctionCallContext
): CallInfo[] {
  // TODO: Implement using new query-based system and CallInfo types
  // See task 11.100.4 for implementation details
  return [];
}

/**
 * Extract decorator call information
 */
function extract_decorator_call(
  node: SyntaxNode,
  context: FunctionCallContext
): CallInfo | null {
  // TODO: Implement using new query-based system and CallInfo types
  // See task 11.100.4 for implementation details
  return null;
}

// Helper functions will be implemented as part of task 11.100.4