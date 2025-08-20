/**
 * Common return type inference logic
 * 
 * Provides functionality for inferring return types from function bodies
 * by analyzing return statements and patterns.
 * 
 * Migrated from: src_old/call_graph/return_type_analyzer.ts
 */

// TODO: Integration with Function Calls
// - Analyze function body for returns
// TODO: Integration with Type Tracking
// - Register inferred return types
// TODO: Integration with Method Calls
// - Consider class context for methods

import { Def, Language } from '@ariadnejs/types';
import { SyntaxNode } from 'tree-sitter';

/**
 * Return type information
 */
export interface ReturnTypeInfo {
  type_name: string;
  confidence: 'explicit' | 'inferred' | 'heuristic';
  source: 'annotation' | 'return_statement' | 'docstring' | 'pattern';
  position?: {
    row: number;
    column: number;
  };
}

/**
 * Analysis of return statements in a function
 */
export interface ReturnAnalysis {
  explicit_returns: ReturnTypeInfo[];
  inferred_type?: ReturnTypeInfo;
  has_implicit_return: boolean;
  is_generator?: boolean;
  is_async?: boolean;
}

/**
 * Context for return type inference
 */
export interface ReturnTypeContext {
  language: Language;
  source_code: string;
  debug?: boolean;
  class_name?: string;  // For method context
  type_tracker?: any;   // Integration point for type tracking
}

/**
 * Analyze a function definition to infer its return type
 */
export function analyze_return_type(
  def: Def,
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // Only analyze functions and methods
  if (def.type !== 'function' && def.type !== 'method') {
    return undefined;
  }

  if (context.debug) {
    console.log(`\nAnalyzing return type for ${def.name} at ${def.range.start.row}:${def.range.start.column}`);
  }

  // Check for explicit return type annotation first
  const explicit_type = extract_explicit_return_type(func_node, context);
  if (explicit_type) {
    return explicit_type;
  }

  // Analyze return statements in the function body
  const return_analysis = analyze_return_statements(func_node, context);
  
  // Check for special patterns (constructors, getters, etc.)
  const pattern_type = check_special_patterns(def, func_node, context);
  if (pattern_type) {
    return pattern_type;
  }

  // Infer from return statements
  if (return_analysis.inferred_type) {
    return return_analysis.inferred_type;
  }

  // Default return types based on language and function type
  return get_default_return_type(def, func_node, context);
}

/**
 * Extract explicit return type annotation if present
 */
export function extract_explicit_return_type(
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const return_type_node = func_node.childForFieldName('return_type');
  
  if (!return_type_node) {
    return undefined;
  }

  // Language-specific extraction handled by dispatcher
  return undefined;
}

/**
 * Analyze all return statements in a function
 */
export function analyze_return_statements(
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnAnalysis {
  const return_statements = find_return_statements(func_node);
  const explicit_returns: ReturnTypeInfo[] = [];
  
  for (const return_stmt of return_statements) {
    const return_type = analyze_single_return(return_stmt, context);
    if (return_type) {
      explicit_returns.push(return_type);
    }
  }

  // Check for implicit return (last expression in some languages)
  const has_implicit_return = check_implicit_return(func_node, context);

  // Determine the overall inferred type
  const inferred_type = infer_common_type(explicit_returns, context);

  return {
    explicit_returns,
    inferred_type,
    has_implicit_return,
    is_generator: is_generator_function(func_node, context),
    is_async: is_async_function(func_node, context)
  };
}

/**
 * Find all return statements in a function body
 */
export function find_return_statements(
  func_node: SyntaxNode,
  nested_functions_allowed: boolean = false
): SyntaxNode[] {
  const returns: SyntaxNode[] = [];
  
  function traverse(node: SyntaxNode, depth: number = 0) {
    if (node.type === 'return_statement') {
      returns.push(node);
      return;
    }
    
    // Don't traverse into nested functions unless allowed
    if (!nested_functions_allowed && depth > 0 && is_function_node(node)) {
      return;
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        traverse(child, is_function_node(node) ? depth + 1 : depth);
      }
    }
  }
  
  // Start from function body
  const body = func_node.childForFieldName('body');
  if (body) {
    traverse(body);
  }
  
  return returns;
}

/**
 * Analyze a single return statement
 */
export function analyze_single_return(
  return_stmt: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const value_node = return_stmt.childForFieldName('value') || 
                     return_stmt.childForFieldName('expression');
  
  if (!value_node) {
    // Empty return
    return {
      type_name: 'void',
      confidence: 'explicit',
      source: 'return_statement',
      position: {
        row: return_stmt.startPosition.row,
        column: return_stmt.startPosition.column
      }
    };
  }

  // This will be delegated to language-specific inference
  return undefined;
}

/**
 * Check for special patterns like constructors, getters, etc.
 */
export function check_special_patterns(
  def: Def,
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // Constructor patterns
  if (is_constructor_name(def.name, context.language)) {
    const class_name = context.class_name || get_enclosing_class_name(func_node);
    if (class_name) {
      return {
        type_name: class_name,
        confidence: 'inferred',
        source: 'pattern'
      };
    }
  }

  // Getter patterns
  if (def.type === 'method' && def.name.startsWith('get')) {
    // Simple heuristic: getXxx() often returns the type of xxx
    const property_name = def.name.substring(3);
    if (property_name) {
      return {
        type_name: property_name,
        confidence: 'heuristic',
        source: 'pattern'
      };
    }
  }

  // Setter patterns (usually void/None)
  if (def.type === 'method' && def.name.startsWith('set')) {
    return {
      type_name: get_void_type(context.language),
      confidence: 'heuristic',
      source: 'pattern'
    };
  }

  return undefined;
}

/**
 * Check if there's an implicit return
 */
export function check_implicit_return(
  func_node: SyntaxNode,
  context: ReturnTypeContext
): boolean {
  // Language-specific - Ruby and Rust have implicit returns
  if (context.language === 'rust') {
    const body = func_node.childForFieldName('body');
    if (body && body.type === 'block') {
      const last_child = body.child(body.childCount - 2); // Skip closing brace
      if (last_child && last_child.type !== 'return_expression') {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Infer a common type from multiple return types
 */
export function infer_common_type(
  return_types: ReturnTypeInfo[],
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  if (return_types.length === 0) {
    return undefined;
  }

  // If all returns have the same type, use it
  const first_type = return_types[0].type_name;
  if (return_types.every(t => t.type_name === first_type)) {
    return {
      type_name: first_type,
      confidence: 'inferred',
      source: 'return_statement'
    };
  }

  // Mixed types - return union or any
  const unique_types = [...new Set(return_types.map(t => t.type_name))];
  
  // Filter out void/None if there are other types
  const non_void_types = unique_types.filter(t => 
    t !== 'void' && t !== 'None' && t !== 'undefined'
  );
  
  if (non_void_types.length === 1) {
    return {
      type_name: non_void_types[0],
      confidence: 'inferred',
      source: 'return_statement'
    };
  }

  // Return union type or generic any
  if (context.language === 'typescript') {
    return {
      type_name: unique_types.join(' | '),
      confidence: 'inferred',
      source: 'return_statement'
    };
  }

  return {
    type_name: get_any_type(context.language),
    confidence: 'inferred',
    source: 'return_statement'
  };
}

/**
 * Get default return type for a function
 */
export function get_default_return_type(
  def: Def,
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo {
  // Async functions
  if (is_async_function(func_node, context)) {
    const base_type = get_void_type(context.language);
    return {
      type_name: `Promise<${base_type}>`,
      confidence: 'inferred',
      source: 'pattern'
    };
  }

  // Generator functions
  if (is_generator_function(func_node, context)) {
    return {
      type_name: 'Generator',
      confidence: 'inferred',
      source: 'pattern'
    };
  }

  // Default to void/None
  return {
    type_name: get_void_type(context.language),
    confidence: 'inferred',
    source: 'pattern'
  };
}

/**
 * Check if a node is a function node
 */
export function is_function_node(node: SyntaxNode): boolean {
  const function_types = [
    'function_declaration',
    'function_expression',
    'arrow_function',
    'method_definition',
    'function_definition', // Python
    'function_item', // Rust
    'lambda_expression',
    'generator_function',
    'async_function'
  ];
  return function_types.includes(node.type);
}

/**
 * Check if a function is async
 */
export function is_async_function(
  func_node: SyntaxNode,
  context: ReturnTypeContext
): boolean {
  // Check for async modifier
  for (let i = 0; i < func_node.childCount; i++) {
    const child = func_node.child(i);
    if (child && child.type === 'async') {
      return true;
    }
  }
  
  // Check node type
  return func_node.type === 'async_function' || 
         func_node.type === 'async_arrow_function';
}

/**
 * Check if a function is a generator
 */
export function is_generator_function(
  func_node: SyntaxNode,
  context: ReturnTypeContext
): boolean {
  // Check for generator syntax
  if (func_node.type === 'generator_function') {
    return true;
  }
  
  // Check for yield statements
  const body = func_node.childForFieldName('body');
  if (body) {
    return contains_yield(body);
  }
  
  return false;
}

/**
 * Check if a node contains yield statements
 */
function contains_yield(node: SyntaxNode): boolean {
  if (node.type === 'yield_expression' || node.type === 'yield_statement') {
    return true;
  }
  
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && contains_yield(child)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get the enclosing class name for a method
 */
export function get_enclosing_class_name(node: SyntaxNode): string | undefined {
  let current = node.parent;
  
  while (current) {
    if (current.type === 'class_declaration' || 
        current.type === 'class_definition' ||
        current.type === 'class') {
      const name_node = current.childForFieldName('name');
      if (name_node) {
        return name_node.text;
      }
    }
    current = current.parent;
  }
  
  return undefined;
}

/**
 * Check if a name is a constructor
 */
export function is_constructor_name(name: string, language: Language): boolean {
  switch (language) {
    case 'javascript':
    case 'typescript':
      return name === 'constructor';
    case 'python':
      return name === '__init__';
    case 'rust':
      return name === 'new';
    default:
      return false;
  }
}

/**
 * Get the void type for a language
 */
export function get_void_type(language: Language): string {
  switch (language) {
    case 'javascript':
      return 'undefined';
    case 'typescript':
      return 'void';
    case 'python':
      return 'None';
    case 'rust':
      return '()';
    default:
      return 'void';
  }
}

/**
 * Get the any/unknown type for a language
 */
export function get_any_type(language: Language): string {
  switch (language) {
    case 'javascript':
      return 'any';
    case 'typescript':
      return 'unknown';
    case 'python':
      return 'Any';
    case 'rust':
      return 'dyn Any';
    default:
      return 'any';
  }
}

/**
 * Create a union type string
 */
export function create_union_type(types: string[], language: Language): string {
  const unique = [...new Set(types)];
  
  switch (language) {
    case 'typescript':
      return unique.join(' | ');
    case 'python':
      return `Union[${unique.join(', ')}]`;
    case 'rust':
      // Rust doesn't have union types in the same way
      return unique[0] || 'unknown';
    default:
      return unique[0] || 'any';
  }
}