/**
 * Return type inference dispatcher
 * 
 * Routes return type inference operations to language-specific implementations
 */

import { SyntaxNode } from 'tree-sitter';
import { Def, Language } from '@ariadnejs/types';
import {
  ReturnTypeInfo,
  ReturnAnalysis,
  ReturnTypeContext,
  // Core functions
  analyze_return_type,
  extract_explicit_return_type,
  analyze_return_statements,
  find_return_statements,
  analyze_single_return,
  check_special_patterns,
  check_implicit_return,
  infer_common_type,
  get_default_return_type,
  is_function_node,
  is_async_function,
  is_generator_function,
  get_enclosing_class_name,
  is_constructor_name,
  get_void_type,
  get_any_type,
  create_union_type
} from './return_type_inference';

// Language-specific imports
import {
  extract_javascript_return_type,
  analyze_javascript_return,
  infer_javascript_expression_type,
  check_javascript_patterns
} from './return_type_inference.javascript';

import {
  extract_typescript_return_type,
  analyze_typescript_return,
  infer_typescript_expression_type,
  check_typescript_patterns,
  infer_generic_return_type
} from './return_type_inference.typescript';

import {
  extract_python_return_type,
  analyze_python_return,
  infer_python_expression_type,
  check_python_patterns
} from './return_type_inference.python';

import {
  extract_rust_return_type,
  analyze_rust_return,
  infer_rust_expression_type,
  check_rust_patterns
} from './return_type_inference.rust';

// Re-export core types and functions
export {
  // Types
  ReturnTypeInfo,
  ReturnAnalysis,
  ReturnTypeContext,
  // Core functions
  analyze_return_type,
  find_return_statements,
  check_implicit_return,
  infer_common_type,
  get_default_return_type,
  is_function_node,
  is_async_function,
  is_generator_function,
  get_enclosing_class_name,
  is_constructor_name,
  get_void_type,
  get_any_type,
  create_union_type
};

/**
 * Infer return type for a function definition
 */
export function infer_function_return_type(
  def: Def,
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // Extract explicit return type annotation if present
  const explicit_type = extract_return_type_annotation(func_node, context);
  if (explicit_type) {
    return explicit_type;
  }

  // Check for language-specific patterns
  const pattern_type = check_return_patterns(def, func_node, context);
  if (pattern_type) {
    return pattern_type;
  }

  // Analyze return statements in function body
  const return_analysis = analyze_function_returns(func_node, context);
  if (return_analysis.inferred_type) {
    return return_analysis.inferred_type;
  }

  // Default return type
  return get_default_return_type(def, func_node, context);
}

/**
 * Extract explicit return type annotation
 */
export function extract_return_type_annotation(
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  switch (context.language) {
    case 'javascript':
      return extract_javascript_return_type(func_node, context);
    case 'typescript':
      return extract_typescript_return_type(func_node, context);
    case 'python':
      return extract_python_return_type(func_node, context);
    case 'rust':
      return extract_rust_return_type(func_node, context);
    default:
      if (context.debug) {
        console.warn(`Return type extraction not implemented for language: ${context.language}`);
      }
      return undefined;
  }
}

/**
 * Analyze return statements in function
 */
export function analyze_function_returns(
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnAnalysis {
  const return_statements = find_return_statements(func_node);
  const explicit_returns: ReturnTypeInfo[] = [];

  for (const return_stmt of return_statements) {
    const return_type = analyze_return_statement(return_stmt, context);
    if (return_type) {
      explicit_returns.push(return_type);
    }
  }

  // Check for implicit return
  const has_implicit_return = check_implicit_return(func_node, context);

  // Infer common type from all returns
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
 * Analyze a single return statement
 */
export function analyze_return_statement(
  return_stmt: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  switch (context.language) {
    case 'javascript':
      return analyze_javascript_return(return_stmt, context);
    case 'typescript':
      return analyze_typescript_return(return_stmt, context);
    case 'python':
      return analyze_python_return(return_stmt, context);
    case 'rust':
      return analyze_rust_return(return_stmt, context);
    default:
      if (context.debug) {
        console.warn(`Return analysis not implemented for language: ${context.language}`);
      }
      return undefined;
  }
}

/**
 * Infer type from expression
 */
export function infer_expression_type(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  switch (context.language) {
    case 'javascript':
      return infer_javascript_expression_type(expr_node, context);
    case 'typescript':
      return infer_typescript_expression_type(expr_node, context);
    case 'python':
      return infer_python_expression_type(expr_node, context);
    case 'rust':
      return infer_rust_expression_type(expr_node, context);
    default:
      if (context.debug) {
        console.warn(`Expression type inference not implemented for language: ${context.language}`);
      }
      return undefined;
  }
}

/**
 * Check for language-specific patterns
 */
export function check_return_patterns(
  def: Def,
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  switch (context.language) {
    case 'javascript':
      return check_javascript_patterns(def, func_node, context);
    case 'typescript':
      return check_typescript_patterns(def, func_node, context);
    case 'python':
      return check_python_patterns(def, func_node, context);
    case 'rust':
      return check_rust_patterns(def, func_node, context);
    default:
      return check_special_patterns(def, func_node, context);
  }
}

/**
 * Check if a function has generics
 */
export function has_generic_parameters(
  func_node: SyntaxNode,
  language: Language
): boolean {
  switch (language) {
    case 'typescript':
      const type_params = func_node.childForFieldName('type_parameters');
      return type_params !== null;
    case 'rust':
      const generic_params = func_node.childForFieldName('type_parameters');
      return generic_params !== null;
    default:
      return false;
  }
}

/**
 * Extract generic parameter names
 */
export function extract_generic_parameters(
  func_node: SyntaxNode,
  language: Language
): string[] {
  const params: string[] = [];
  
  const type_params_node = func_node.childForFieldName('type_parameters');
  if (!type_params_node) {
    return params;
  }

  for (let i = 0; i < type_params_node.childCount; i++) {
    const child = type_params_node.child(i);
    if (child) {
      if (child.type === 'type_parameter') {
        const name_node = child.childForFieldName('name');
        if (name_node) {
          params.push(name_node.text);
        }
      }
    }
  }

  return params;
}

/**
 * Process an entire file for return type inference
 */
export function process_file_for_return_types(
  defs: Def[],
  tree: SyntaxNode,
  source_code: string,
  language: Language,
  debug: boolean = false
): Map<string, ReturnTypeInfo> {
  const return_types = new Map<string, ReturnTypeInfo>();
  const context: ReturnTypeContext = {
    language,
    source_code,
    debug
  };

  for (const def of defs) {
    if (def.symbol_kind === 'function' || def.symbol_kind === 'method') {
      // Find the AST node for this definition
      const func_node = find_function_node(def, tree);
      if (func_node) {
        // Add class context for methods
        if (def.symbol_kind === 'method') {
          context.class_name = get_enclosing_class_name(func_node);
        }

        const return_type = infer_function_return_type(def, func_node, context);
        if (return_type) {
          // Create a unique key for the function
          const key = `${def.name}:${def.range.start.row}:${def.range.start.column}`;
          return_types.set(key, return_type);
        }
      }
    }
  }

  return return_types;
}

/**
 * Find the AST node for a function definition
 */
function find_function_node(def: Def, tree: SyntaxNode): SyntaxNode | undefined {
  // Navigate to the position in the tree
  let current = tree;
  
  while (current) {
    // Check if this node matches the definition position
    if (current.startPosition.row === def.range.start.row &&
        current.startPosition.column <= def.range.start.column &&
        current.endPosition.row >= def.range.end.row &&
        is_function_node(current)) {
      return current;
    }

    // Find child that contains the position
    let found_child = false;
    for (let i = 0; i < current.childCount; i++) {
      const child = current.child(i);
      if (child &&
          child.startPosition.row <= def.range.start.row &&
          child.endPosition.row >= def.range.start.row) {
        current = child;
        found_child = true;
        break;
      }
    }

    if (!found_child) {
      break;
    }
  }

  return undefined;
}

/**
 * Get a descriptive name for a return type
 */
export function get_return_type_description(
  return_type: ReturnTypeInfo,
  language: Language
): string {
  const { type_name, confidence, source } = return_type;
  
  // Add confidence indicator if not explicit
  if (confidence !== 'explicit') {
    return `${type_name} (${confidence})`;
  }
  
  return type_name;
}

/**
 * Check if a return type is a promise/future type
 */
export function is_async_return_type(
  return_type: ReturnTypeInfo,
  language: Language
): boolean {
  const type_name = return_type.type_name;
  
  switch (language) {
    case 'javascript':
    case 'typescript':
      return type_name.startsWith('Promise<') || type_name === 'Promise';
    case 'python':
      return type_name.startsWith('Awaitable') || 
             type_name.startsWith('Coroutine') ||
             type_name.startsWith('Future');
    case 'rust':
      return type_name.includes('Future') || type_name.includes('async');
    default:
      return false;
  }
}

/**
 * Check if a return type is a generator/iterator type
 */
export function is_generator_return_type(
  return_type: ReturnTypeInfo,
  language: Language
): boolean {
  const type_name = return_type.type_name;
  
  switch (language) {
    case 'javascript':
    case 'typescript':
      return type_name === 'Generator' || type_name.startsWith('Generator<');
    case 'python':
      return type_name === 'Generator' || 
             type_name === 'Iterator' ||
             type_name.startsWith('Generator[') ||
             type_name.startsWith('Iterator[');
    case 'rust':
      return type_name.includes('Iterator') || 
             type_name.includes('impl Iterator');
    default:
      return false;
  }
}