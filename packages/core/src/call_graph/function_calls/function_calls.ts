/**
 * Common function call detection logic
 * 
 * Provides shared functionality for detecting function calls across languages
 */

import { SyntaxNode } from 'tree-sitter';
import { Point, SimpleRange, Language } from '@ariadnejs/types';

export interface FunctionCallInfo {
  caller_name: string;
  callee_name: string;
  location: Point;
  file_path: string;
  is_method_call: boolean;
  is_constructor_call: boolean;
  arguments_count: number;
}

export interface FunctionCallContext {
  source_code: string;
  file_path: string;
  language: Language;
  ast_root: SyntaxNode;
}

/**
 * Common logic for detecting if a node is a function call
 */
export function is_function_call_node(node: SyntaxNode, language: Language): boolean {
  const call_types = get_call_expression_types(language);
  return call_types.includes(node.type);
}

/**
 * Get the call expression types for each language
 */
export function get_call_expression_types(language: Language): string[] {
  const types: Record<Language, string[]> = {
    javascript: ['call_expression'],
    typescript: ['call_expression'],
    python: ['call'],
    rust: ['call_expression', 'macro_invocation']
  };
  
  return types[language] || [];
}

/**
 * Extract callee name from a call node (common logic)
 */
export function extract_callee_name(
  node: SyntaxNode,
  source: string,
  language: Language
): string | null {
  // Get the function/callee part of the call
  const function_node = node.childForFieldName('function') || 
                       node.childForFieldName('func'); // Python uses 'func'
  
  if (!function_node) return null;
  
  // Handle different patterns
  if (function_node.type === 'identifier') {
    return source.substring(function_node.startIndex, function_node.endIndex);
  }
  
  // Handle member expressions (method calls)
  if (function_node.type === 'member_expression' || 
      function_node.type === 'attribute') { // Python uses 'attribute'
    const property = function_node.childForFieldName('property') || 
                    function_node.childForFieldName('attr'); // Python
    if (property) {
      return source.substring(property.startIndex, property.endIndex);
    }
  }
  
  // Handle scoped identifiers (Rust)
  if (function_node.type === 'scoped_identifier') {
    const name = function_node.childForFieldName('name');
    if (name) {
      return source.substring(name.startIndex, name.endIndex);
    }
  }
  
  return null;
}

/**
 * Check if a call is a method call (has a receiver)
 */
export function is_method_call(
  node: SyntaxNode,
  language: Language
): boolean {
  const function_node = node.childForFieldName('function') || 
                       node.childForFieldName('func');
  
  if (!function_node) return false;
  
  return function_node.type === 'member_expression' || 
         function_node.type === 'attribute' || // Python
         (function_node.type === 'scoped_identifier' && language === 'rust');
}

/**
 * Get the receiver of a method call
 */
export function get_method_receiver(
  node: SyntaxNode,
  source: string,
  language: Language
): string | null {
  const function_node = node.childForFieldName('function') || 
                       node.childForFieldName('func');
  
  if (!function_node) return null;
  
  if (function_node.type === 'member_expression') {
    const object = function_node.childForFieldName('object');
    if (object) {
      return source.substring(object.startIndex, object.endIndex);
    }
  }
  
  if (function_node.type === 'attribute') { // Python
    const object = function_node.childForFieldName('object');
    if (object) {
      return source.substring(object.startIndex, object.endIndex);
    }
  }
  
  return null;
}

/**
 * Count arguments in a call expression
 */
export function count_arguments(
  node: SyntaxNode,
  language: Language
): number {
  const args_node = node.childForFieldName('arguments');
  if (!args_node) return 0;
  
  // Count children that are actual arguments (not commas, parens, etc.)
  let count = 0;
  for (let i = 0; i < args_node.childCount; i++) {
    const child = args_node.child(i);
    if (child && 
        child.type !== '(' && 
        child.type !== ')' && 
        child.type !== ',' &&
        child.type !== 'comment') {
      count++;
    }
  }
  
  return count;
}

/**
 * Get the enclosing function/method definition for a call
 */
export function get_enclosing_function_name(
  node: SyntaxNode,
  source: string,
  language: Language
): string | null {
  let current = node.parent;
  
  while (current) {
    if (is_function_definition(current, language)) {
      return extract_function_name(current, source, language);
    }
    current = current.parent;
  }
  
  return null;
}

/**
 * Check if a node is a function definition
 */
function is_function_definition(node: SyntaxNode, language: Language): boolean {
  const def_types: Record<Language, string[]> = {
    javascript: ['function_declaration', 'function_expression', 'arrow_function', 'method_definition'],
    typescript: ['function_declaration', 'function_expression', 'arrow_function', 'method_definition'],
    python: ['function_definition'],
    rust: ['function_item']
  };
  
  const types = def_types[language] || [];
  return types.includes(node.type);
}

/**
 * Extract function name from a definition node
 */
function extract_function_name(
  node: SyntaxNode,
  source: string,
  language: Language
): string | null {
  // Try different field names used by different node types
  const name_node = node.childForFieldName('name') || 
                   node.childForFieldName('key'); // method_definition uses 'key'
  
  if (name_node) {
    return source.substring(name_node.startIndex, name_node.endIndex);
  }
  
  // Arrow functions might not have names
  if (node.type === 'arrow_function') {
    return '<anonymous>';
  }
  
  return null;
}