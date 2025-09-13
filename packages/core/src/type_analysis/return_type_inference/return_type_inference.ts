/**
 * Generic return type inference processor
 * 
 * Configuration-driven return type inference that handles 85% of logic
 * across all languages. Language-specific complexities are handled by
 * bespoke handlers.
 */

import { Definition, Language, Location, FilePath, SymbolId, TypeDefinition, to_symbol_id } from '@ariadnejs/types';
import { SyntaxNode } from 'tree-sitter';
import {
  get_return_type_config,
  ReturnTypeLanguageConfig,
  is_type_node,
  get_expression_category
} from './language_configs';
import { node_to_location } from '../../ast/node_utils';
import { FileTypeTracker } from '../type_tracking/type_tracking';

/**
 * MODULE_CONTEXT for return type inference
 */
export const RETURN_TYPE_CONTEXT = {
  module: 'return_type_inference',
  description: 'Infers return types from function signatures and bodies'
} as const;

/**
 * Return type information
 */
export interface ReturnTypeInfo {
  type_name: string;
  confidence: 'explicit' | 'inferred' | 'heuristic';
  source: 'annotation' | 'return_statement' | 'docstring' | 'pattern';
  location?: Location;
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
  file_path?: FilePath;  // For creating locations
  debug?: boolean;
  class_name?: string;  // For method context
  type_tracker?: FileTypeTracker;   // Integration point for type tracking
}

/**
 * Analyze a function definition to infer its return type (generic processor)
 */
export function analyze_return_type_generic(
  def: Definition & { kind?: string },
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // Only analyze functions and methods
  // Note: This is temporary until full migration
  // The 'kind' property check is a workaround
  // TODO: Remove when migrating to new type system

  const config = get_return_type_config(context.language);

  if (context.debug) {
    // Note: def.name is a SymbolId - extract display name if needed
    console.log(`\n[${RETURN_TYPE_CONTEXT.module}] Analyzing function at ${def.location.line}:${def.location.column}`);
  }

  // Check for explicit return type annotation using config
  const explicit_type = extract_explicit_return_type_generic(func_node, context, config);
  if (explicit_type) {
    return explicit_type;
  }

  // Analyze return statements in the function body
  const return_analysis = analyze_return_statements_generic(func_node, context, config);
  
  // Check for special patterns (constructors, async, generators)
  const pattern_type = check_special_patterns_generic(def, func_node, context, config);
  if (pattern_type) {
    return pattern_type;
  }

  // Infer from return statements
  if (return_analysis.inferred_type) {
    return return_analysis.inferred_type;
  }

  // Default return types based on configuration
  return get_default_return_type_generic(def, func_node, context, config);
}

/**
 * Extract explicit return type annotation if present (generic)
 */
export function extract_explicit_return_type_generic(
  func_node: SyntaxNode,
  context: ReturnTypeContext,
  config: ReturnTypeLanguageConfig
): ReturnTypeInfo | undefined {
  // Check if language has explicit annotations
  if (!config.patterns.has_explicit_annotations) {
    return undefined;
  }
  
  // Get return type node using configured field name
  const return_type_node = func_node.childForFieldName(config.return_type_field);
  
  if (!return_type_node) {
    return undefined;
  }
  
  // Extract the type name from the node
  const type_name = extract_type_name_generic(return_type_node, context.source_code, config);
  
  if (type_name) {
    return {
      type_name,
      confidence: 'explicit',
      source: 'annotation'
    };
  }
  
  return undefined;
}

/**
 * Extract type name from a type node (generic)
 */
function extract_type_name_generic(
  type_node: SyntaxNode,
  source_code: string,
  config: ReturnTypeLanguageConfig
): string {
  // Skip type annotation markers like ':'
  if (type_node.type === 'type_annotation' || type_node.type === ':') {
    for (let i = 0; i < type_node.childCount; i++) {
      const child = type_node.child(i);
      if (child && child.type !== ':') {
        return extract_type_name_generic(child, source_code, config);
      }
    }
    return '';
  }
  
  // Check if it's a recognized type node
  if (is_type_node(type_node.type, config)) {
    return source_code.substring(type_node.startIndex, type_node.endIndex);
  }
  
  // Default to raw text
  return source_code.substring(type_node.startIndex, type_node.endIndex);
}

/**
 * Analyze return statements in function body (generic)
 */
export function analyze_return_statements_generic(
  func_node: SyntaxNode,
  context: ReturnTypeContext,
  config: ReturnTypeLanguageConfig
): ReturnAnalysis {
  const return_statements = find_return_statements(func_node);
  const explicit_returns: ReturnTypeInfo[] = [];
  
  for (const return_stmt of return_statements) {
    const return_type = analyze_single_return_generic(return_stmt, context, config);
    if (return_type) {
      explicit_returns.push(return_type);
    }
  }
  
  // Check for implicit returns (Rust, Python)
  const has_implicit = config.patterns.implicit_returns && 
                      check_implicit_return(func_node, context);
  
  // Infer overall type from all returns
  const inferred_type = infer_from_returns(explicit_returns, context);
  
  return {
    explicit_returns,
    inferred_type,
    has_implicit_return: has_implicit,
    is_generator: check_is_generator(func_node, config),
    is_async: check_is_async(func_node, config)
  };
}

/**
 * Analyze a single return statement (generic)
 */
function analyze_single_return_generic(
  return_stmt: SyntaxNode,
  context: ReturnTypeContext,
  config: ReturnTypeLanguageConfig
): ReturnTypeInfo | undefined {
  // Get the returned value/expression
  const value_node = return_stmt.childForFieldName('argument') ||
                    return_stmt.childForFieldName('value') ||
                    return_stmt.child(1); // Skip 'return' keyword
  
  if (!value_node || value_node.type === ';') {
    // Empty return
    return {
      type_name: config.defaults.void_type,
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  
  // Infer type from expression
  return infer_expression_type_generic(value_node, context, config);
}

/**
 * Infer type from an expression using configuration (generic)
 */
function infer_expression_type_generic(
  expr_node: SyntaxNode,
  context: ReturnTypeContext,
  config: ReturnTypeLanguageConfig
): ReturnTypeInfo | undefined {
  const category = get_expression_category(expr_node.type, config);
  
  if (category) {
    switch (category.category) {
      case 'literal':
        return {
          type_name: category.type,
          confidence: 'inferred',  // Literals are inferred from their value
          source: 'return_statement'
        };
      
      case 'collection':
        return {
          type_name: category.type === 'array' ? 'Array' : 
                    category.type === 'object' ? 'Object' :
                    category.type,
          confidence: 'inferred',
          source: 'return_statement'
        };
      
      case 'special':
        // These need more analysis
        if (category.type === 'new_expression') {
          const class_name = extract_class_name(expr_node, context.source_code);
          if (class_name) {
            return {
              type_name: class_name,
              confidence: 'inferred',  // Inferred from constructor call
              source: 'return_statement'
            };
          }
        }
        break;
    }
  }
  
  // Unknown expression type
  return undefined;
}

/**
 * Check for special patterns using configuration (generic)
 */
function check_special_patterns_generic(
  def: Definition,
  func_node: SyntaxNode,
  context: ReturnTypeContext,
  config: ReturnTypeLanguageConfig
): ReturnTypeInfo | undefined {
  // Check if it's a constructor
  // TODO: Extract symbol name from SymbolId and check constructor names
  // For now, skip this check as def.name is a SymbolId not a string
  // if (config.function_modifiers.constructor_names.includes(def.name)) {
  //   return {
  //     type_name: config.defaults.constructor_type,
  //     confidence: 'explicit',
  //     source: 'pattern'
  //   };
  // }
  
  // Check for async functions
  if (check_is_async(func_node, config)) {
    const base_type = analyze_return_statements_generic(func_node, context, config).inferred_type;
    const inner_type = base_type?.type_name || 'unknown';
    return {
      type_name: `${config.defaults.async_wrapper}<${inner_type}>`,
      confidence: 'inferred',
      source: 'pattern'
    };
  }
  
  // Check for generator functions
  if (check_is_generator(func_node, config)) {
    return {
      type_name: config.defaults.generator_wrapper,
      confidence: 'inferred',
      source: 'pattern'
    };
  }
  
  return undefined;
}

/**
 * Get default return type using configuration (generic)
 */
function get_default_return_type_generic(
  def: Definition,
  func_node: SyntaxNode,
  context: ReturnTypeContext,
  config: ReturnTypeLanguageConfig
): ReturnTypeInfo | undefined {
  // For Rust, if no explicit type and not a special pattern, it's unit type
  if (config.patterns.requires_return_type) {
    return {
      type_name: config.defaults.void_type,
      confidence: 'inferred',
      source: 'pattern'
    };
  }
  
  // Default to void/undefined for other languages
  return {
    type_name: config.defaults.void_type,
    confidence: 'heuristic',
    source: 'pattern'
  };
}

/**
 * Helper: Find all return statements in a function body
 */
export function find_return_statements(func_node: SyntaxNode): SyntaxNode[] {
  const returns: SyntaxNode[] = [];
  
  function traverse(node: SyntaxNode, in_nested_function: boolean = false) {
    // Check for return statement
    if (node.type === 'return_statement' || node.type === 'return_expression') {
      if (!in_nested_function) {
        returns.push(node);
      }
      return;
    }
    
    // Check if entering nested function
    const is_function = is_function_node(node);
    
    // Traverse children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        traverse(child, in_nested_function || is_function);
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
 * Helper: Check if a function is async
 */
function check_is_async(func_node: SyntaxNode, config: ReturnTypeLanguageConfig): boolean {
  // Check for async keyword
  for (const keyword of config.function_modifiers.async_keywords) {
    for (let i = 0; i < func_node.childCount; i++) {
      const child = func_node.child(i);
      if (child && child.type === keyword) {
        return true;
      }
    }
  }
  
  // Check node type itself
  return func_node.type.includes('async');
}

/**
 * Helper: Check if a function is a generator
 */
function check_is_generator(func_node: SyntaxNode, config: ReturnTypeLanguageConfig): boolean {
  // Check for generator indicators
  for (const indicator of config.function_modifiers.generator_indicators) {
    // Check function declaration itself
    if (func_node.type.includes(indicator)) {
      return true;
    }
    
    // Check for yield in body
    const body = func_node.childForFieldName('body');
    if (body && has_yield_statement(body)) {
      return true;
    }
  }
  return false;
}

/**
 * Helper: Check for yield statements
 */
function has_yield_statement(node: SyntaxNode): boolean {
  if (node.type === 'yield' || node.type === 'yield_expression' || 
      node.type === 'yield_from' || node.type === 'yield_from_statement') {
    return true;
  }
  
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && has_yield_statement(child)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Helper: Check for implicit return
 */
function check_implicit_return(func_node: SyntaxNode, context: ReturnTypeContext): boolean {
  const body = func_node.childForFieldName('body');
  if (!body) {
    return false;
  }
  
  // Check last statement in body
  const last_stmt = get_last_statement(body);
  return last_stmt !== null && 
         last_stmt.type !== 'return_statement' && 
         last_stmt.type !== 'return_expression';
}

/**
 * Helper: Get last statement in a block
 */
function get_last_statement(block: SyntaxNode): SyntaxNode | null {
  for (let i = block.childCount - 1; i >= 0; i--) {
    const child = block.child(i);
    if (child && child.type !== '}' && child.type !== ';') {
      return child;
    }
  }
  return null;
}

/**
 * Helper: Infer type from multiple returns
 */
function infer_from_returns(
  returns: ReturnTypeInfo[],
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  if (returns.length === 0) {
    return undefined;
  }
  
  // If all returns have the same type, use it
  const types = new Set(returns.map(r => r.type_name));
  if (types.size === 1) {
    // Preserve confidence if all returns have the same confidence
    const confidences = new Set(returns.map(r => r.confidence));
    const confidence = confidences.size === 1 ? returns[0].confidence : 'inferred';
    
    return {
      type_name: returns[0].type_name,
      confidence,
      source: 'return_statement'
    };
  }
  
  // Multiple types - would need union type
  return undefined;
}

/**
 * Helper: Extract class name from new expression
 */
function extract_class_name(new_expr: SyntaxNode, source_code: string): string | undefined {
  const constructor = new_expr.childForFieldName('constructor') ||
                      new_expr.childForFieldName('function') ||
                      new_expr.child(1); // Skip 'new' keyword
  
  if (constructor) {
    if (constructor.type === 'identifier') {
      return source_code.substring(constructor.startIndex, constructor.endIndex);
    }
  }
  
  return undefined;
}

/**
 * Helper: Check if a node is a function node
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
 * Helper: Get the enclosing class name for a method
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

// Legacy exports for compatibility
export function is_async_function(func_node: SyntaxNode): boolean {
  return func_node.type.includes('async') || check_is_async(func_node, get_return_type_config('typescript'));
}

export function is_constructor_name(name: string): boolean {
  return name === 'constructor' || 
         name === '__init__' || 
         name === '__new__' || 
         name === 'new';
}

export function get_void_type(language: Language): string {
  const config = get_return_type_config(language);
  return config.defaults.void_type;
}

/**
 * Get a descriptive string for a return type
 */
export function get_return_type_description(returnType: ReturnTypeInfo, language: Language): string {
  let description = returnType.type_name;
  
  if (returnType.confidence !== 'explicit') {
    description += ' (inferred)';
  }
  
  return description;
}

/**
 * Check if a return type represents an async/Promise type
 */
export function is_async_return_type(returnType: ReturnTypeInfo, language: Language): boolean {
  const typeName = returnType.type_name.toLowerCase();
  
  // Common async patterns across languages
  return typeName.includes('promise') || 
         typeName.includes('future') || 
         typeName.includes('coroutine') ||
         typeName.includes('async') ||
         typeName.includes('awaitable');
}

/**
 * Check if a return type represents a generator type
 */
export function is_generator_return_type(returnType: ReturnTypeInfo, language: Language): boolean {
  const typeName = returnType.type_name.toLowerCase();
  
  // Common generator patterns across languages
  return typeName.includes('generator') || 
         typeName.includes('iterator') || 
         typeName.includes('iterable') ||
         typeName.startsWith('iter<');
}

/**
 * Infer return types for all functions in the file
 * Returns a map of function symbols to their return type definitions
 */
export function infer_return_types(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Map<SymbolId, TypeDefinition> {
  // TODO: Implement using new query-based system
  // See task 11.100.14 for implementation details
  return new Map();
}

/**
 * Legacy function - to be removed after migration
 * @deprecated Use infer_return_types instead
 */
export function infer_all_return_types(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: FilePath
): Map<string, ReturnTypeInfo> {
  const result = new Map<string, ReturnTypeInfo>();
  const context: ReturnTypeContext = {
    language,
    source_code,
    debug: false,
  };

  // Find all function nodes in the tree
  const find_functions = (node: SyntaxNode): void => {
    // Check if this is a function definition node
    if (
      node.type === "function_declaration" ||
      node.type === "function_definition" ||
      node.type === "arrow_function" ||
      node.type === "method_definition" ||
      node.type === "function_item" || // Rust
      node.type === "method_declaration"
    ) {
      // Extract function name
      const name_node = node.childForFieldName("name");
      const func_name = name_node
        ? source_code.substring(name_node.startIndex, name_node.endIndex)
        : `anonymous_${node.startIndex}`;

      // Check if function is async
      const is_async = is_async_function(node);

      // Create a minimal Def object for the inference function
      const func_def = {
        name: to_symbol_id(func_name),
        location: node_to_location(node, file_path),
        kind: "function" as const,
        file_path: file_path,
      };

      // Infer return type
      const return_info = analyze_return_type_generic(func_def, node, context);

      if (return_info) {
        // Store with enhanced metadata
        result.set(func_name, {
          ...return_info,
          // Override async/generator if we detected it
          ...(is_async && { source: "pattern" as const }),
        });
      }
    }

    // Recursively process children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        find_functions(child);
      }
    }
  };

  find_functions(root_node);
  return result;
}