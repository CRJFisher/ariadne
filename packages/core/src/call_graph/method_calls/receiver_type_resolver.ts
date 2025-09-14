/**
 * Receiver Type Resolver stub
 *
 * TODO: Implement using tree-sitter queries for type resolution
 */

import { SyntaxNode } from 'tree-sitter';
import { TypeInfo } from '../../type_analysis/type_tracking';
import { Language } from '@ariadnejs/types';

/**
 * Extended method call info with resolved type information
 */
export interface MethodCallWithType {
  caller_name: string;
  method_name: string;
  receiver_name: string;
  receiver_type?: string;  // The resolved type of the receiver
  defining_class?: string; // The class that defines this method
  location: {
    line: number;
    column: number;
    end_line?: number;
    end_column?: number;
  };
  is_static_method: boolean;
  is_chained_call: boolean;
  arguments_count: number;
}

/**
 * Resolve the type of a method receiver
 */
export function resolve_receiver_type(
  receiver: SyntaxNode | undefined,
  type_map: Map<string, TypeInfo[]> | undefined,
  source_code: string,
  language: Language
): string | undefined {
  // TODO: Implement using tree-sitter queries for type resolution
  return undefined;
}

/**
 * Check if a method call is chained
 */
export function is_chained_call(node: SyntaxNode, language: Language): boolean {
  // TODO: Implement using tree-sitter queries
  return false;
}

/**
 * Determine if a method is static based on receiver type
 */
export function is_static_method(
  receiver_text: string,
  receiver_type: string | undefined,
  language: Language
): boolean {
  // TODO: Implement using tree-sitter queries
  return false;
}

/**
 * Try to determine the defining class for a method
 */
export function infer_defining_class(
  _method_name: string,
  receiver_type: string | undefined
): string | undefined {
  // TODO: Implement using tree-sitter queries
  return undefined;
}