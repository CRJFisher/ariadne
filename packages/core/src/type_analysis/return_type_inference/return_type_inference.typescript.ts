/**
 * TypeScript-specific return type inference
 * 
 * Handles TypeScript return type patterns including:
 * - Explicit type annotations
 * - Generic return types
 * - Union and intersection types
 * - Async/Promise types
 */

// TODO: Type Propagation - Flow return types through calls

import { SyntaxNode } from 'tree-sitter';
import { Def } from '@ariadnejs/types';
import {
  ReturnTypeInfo,
  ReturnTypeContext
} from './return_type_inference';
import {
  analyze_javascript_return,
  infer_javascript_expression_type,
  check_javascript_patterns
} from './return_type_inference.javascript';

/**
 * Extract TypeScript return type annotation
 */
export function extract_typescript_return_type(
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const return_type_node = func_node.childForFieldName('return_type');
  
  if (return_type_node && return_type_node.type === 'type_annotation') {
    // The type_annotation node contains the actual type as its child
    // Skip the ':' if present
    for (let i = 0; i < return_type_node.childCount; i++) {
      const child = return_type_node.child(i);
      if (child && child.type !== ':') {
        const type_name = extract_type_name(child, context.source_code);
        if (type_name) {
          return {
            type_name,
            confidence: 'explicit',
            source: 'annotation',
            position: {
              row: return_type_node.startPosition.row,
              column: return_type_node.startPosition.column
            }
          };
        }
      }
    }
  }
  
  return undefined;
}

/**
 * Extract type name from TypeScript type node
 */
function extract_type_name(type_node: SyntaxNode, source_code: string): string {
  const type_text = source_code.substring(type_node.startIndex, type_node.endIndex);
  
  switch (type_node.type) {
    // Predefined types
    case 'predefined_type':
      return type_text;
    
    // Type identifiers
    case 'type_identifier':
      return type_text;
    
    // Array types
    case 'array_type':
      const element = type_node.child(0);
      if (element) {
        const element_type = extract_type_name(element, source_code);
        return `${element_type}[]`;
      }
      return 'Array';
    
    // Generic types
    case 'generic_type':
      return type_text;
    
    // Union types
    case 'union_type':
      return type_text;
    
    // Intersection types
    case 'intersection_type':
      return type_text;
    
    // Tuple types
    case 'tuple_type':
      return type_text;
    
    // Object types
    case 'object_type':
      return 'object';
    
    // Function types
    case 'function_type':
      return 'Function';
    
    // Literal types
    case 'literal_type':
      return type_text;
    
    // Conditional types
    case 'conditional_type':
      return type_text;
    
    // Type query
    case 'type_query':
      return type_text;
    
    // Parenthesized type
    case 'parenthesized_type':
      const inner = type_node.child(1); // Skip opening paren
      if (inner) {
        return extract_type_name(inner, source_code);
      }
      return type_text;
    
    default:
      return type_text;
  }
}

/**
 * Analyze TypeScript return statement
 */
export function analyze_typescript_return(
  return_stmt: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // First try JavaScript analysis
  const js_result = analyze_javascript_return(return_stmt, context);
  if (js_result) {
    return js_result;
  }
  
  // Additional TypeScript-specific analysis
  const value_node = return_stmt.childForFieldName('argument') || 
                     return_stmt.child(1);
  
  if (value_node) {
    return infer_typescript_expression_type(value_node, context);
  }
  
  return undefined;
}

/**
 * Infer type from a TypeScript expression
 */
export function infer_typescript_expression_type(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // First try JavaScript inference
  const js_type = infer_javascript_expression_type(expr_node, context);
  if (js_type) {
    return js_type;
  }
  
  // TypeScript-specific expressions
  switch (expr_node.type) {
    // Type assertion
    case 'as_expression':
      return analyze_type_assertion(expr_node, context);
    
    // Type cast
    case 'type_assertion':
      return analyze_type_cast(expr_node, context);
    
    // Non-null assertion
    case 'non_null_assertion':
      return analyze_non_null_assertion(expr_node, context);
    
    // Optional chaining
    case 'optional_chain':
      return analyze_optional_chain(expr_node, context);
    
    // JSX elements
    case 'jsx_element':
    case 'jsx_self_closing_element':
    case 'jsx_fragment':
      return {
        type_name: 'JSX.Element',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    default:
      return undefined;
  }
}

/**
 * Analyze type assertion (expr as Type)
 */
function analyze_type_assertion(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const type_node = expr_node.childForFieldName('type');
  if (type_node) {
    const type_name = extract_type_name(type_node, context.source_code);
    return {
      type_name,
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  return undefined;
}

/**
 * Analyze type cast (<Type>expr)
 */
function analyze_type_cast(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const type_node = expr_node.childForFieldName('type');
  if (type_node) {
    const type_name = extract_type_name(type_node, context.source_code);
    return {
      type_name,
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  return undefined;
}

/**
 * Analyze non-null assertion (expr!)
 */
function analyze_non_null_assertion(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const expression = expr_node.child(0);
  if (expression) {
    const expr_type = infer_typescript_expression_type(expression, context);
    if (expr_type) {
      // Remove null/undefined from union types
      const type_name = expr_type.type_name
        .replace(/\s*\|\s*null/g, '')
        .replace(/\s*\|\s*undefined/g, '');
      return {
        ...expr_type,
        type_name
      };
    }
  }
  return undefined;
}

/**
 * Analyze optional chaining (expr?.prop)
 */
function analyze_optional_chain(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // The result could be undefined
  const base_expr = expr_node.child(0);
  if (base_expr) {
    const base_type = infer_typescript_expression_type(base_expr, context);
    if (base_type) {
      return {
        type_name: `${base_type.type_name} | undefined`,
        confidence: 'inferred',
        source: 'return_statement'
      };
    }
  }
  return {
    type_name: 'any | undefined',
    confidence: 'heuristic',
    source: 'return_statement'
  };
}

/**
 * Check for TypeScript-specific patterns
 */
export function check_typescript_patterns(
  def: Def,
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // First check JavaScript patterns
  const js_pattern = check_javascript_patterns(def, func_node, context);
  if (js_pattern) {
    return js_pattern;
  }
  
  // Type guard functions (returns 'x is Type')
  const return_type_node = func_node.childForFieldName('return_type');
  if (return_type_node) {
    const type_text = context.source_code.substring(
      return_type_node.startIndex,
      return_type_node.endIndex
    );
    
    if (type_text.includes(' is ')) {
      return {
        type_name: 'boolean',
        confidence: 'explicit',
        source: 'annotation'
      };
    }
  }
  
  // Async functions return Promise<T>
  if (is_async_function(func_node)) {
    const explicit_return = extract_typescript_return_type(func_node, context);
    if (explicit_return) {
      // Already wrapped in Promise
      if (explicit_return.type_name.startsWith('Promise<')) {
        return explicit_return;
      }
      // Wrap in Promise
      return {
        type_name: `Promise<${explicit_return.type_name}>`,
        confidence: 'inferred',
        source: 'pattern'
      };
    }
    
    // Analyze body for return types
    const body = func_node.childForFieldName('body');
    if (body) {
      const returns = find_return_statements(body);
      if (returns.length > 0) {
        const return_types: string[] = [];
        for (const ret of returns) {
          const ret_type = analyze_typescript_return(ret, context);
          if (ret_type) {
            return_types.push(ret_type.type_name);
          }
        }
        
        if (return_types.length > 0) {
          const unique_types = [...new Set(return_types)];
          const inner_type = unique_types.length === 1 
            ? unique_types[0] 
            : unique_types.join(' | ');
          
          return {
            type_name: `Promise<${inner_type}>`,
            confidence: 'inferred',
            source: 'pattern'
          };
        }
      }
    }
    
    return {
      type_name: 'Promise<void>',
      confidence: 'inferred',
      source: 'pattern'
    };
  }
  
  // Generator functions
  if (is_generator_function(func_node)) {
    const explicit_return = extract_typescript_return_type(func_node, context);
    if (explicit_return) {
      return explicit_return;
    }
    
    return {
      type_name: 'Generator',
      confidence: 'inferred',
      source: 'pattern'
    };
  }
  
  return undefined;
}

/**
 * Check if function is async
 */
function is_async_function(func_node: SyntaxNode): boolean {
  // Check for async modifier
  for (let i = 0; i < func_node.childCount; i++) {
    const child = func_node.child(i);
    if (child && child.type === 'async') {
      return true;
    }
  }
  
  return func_node.type === 'async_function' || 
         func_node.type === 'async_arrow_function';
}

/**
 * Check if function is a generator
 */
function is_generator_function(func_node: SyntaxNode): boolean {
  // Check for generator syntax
  for (let i = 0; i < func_node.childCount; i++) {
    const child = func_node.child(i);
    if (child && child.type === '*') {
      return true;
    }
  }
  
  return func_node.type === 'generator_function';
}

/**
 * Find return statements in function body
 */
function find_return_statements(body_node: SyntaxNode): SyntaxNode[] {
  const returns: SyntaxNode[] = [];
  
  function traverse(node: SyntaxNode, in_nested_function: boolean = false) {
    if (node.type === 'return_statement' && !in_nested_function) {
      returns.push(node);
      return;
    }
    
    // Check if entering a nested function
    const is_function = node.type.includes('function') || 
                       node.type === 'arrow_function' ||
                       node.type === 'method_definition';
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        traverse(child, in_nested_function || is_function);
      }
    }
  }
  
  traverse(body_node);
  return returns;
}

/**
 * Infer generic return types
 */
export function infer_generic_return_type(
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // Check for generic type parameters
  const type_params = func_node.childForFieldName('type_parameters');
  if (type_params) {
    // If function has generics, the return type might be generic
    const return_type = extract_typescript_return_type(func_node, context);
    if (return_type) {
      return return_type;
    }
    
    // Check if any return statement returns a generic type
    const body = func_node.childForFieldName('body');
    if (body) {
      const returns = find_return_statements(body);
      for (const ret of returns) {
        const ret_type = analyze_typescript_return(ret, context);
        if (ret_type && is_generic_type(ret_type.type_name, type_params)) {
          return ret_type;
        }
      }
    }
  }
  
  return undefined;
}

/**
 * Check if a type name is a generic parameter
 */
function is_generic_type(type_name: string, type_params_node: SyntaxNode): boolean {
  // Extract generic parameter names
  const params: string[] = [];
  for (let i = 0; i < type_params_node.childCount; i++) {
    const child = type_params_node.child(i);
    if (child && child.type === 'type_parameter') {
      const name_node = child.childForFieldName('name');
      if (name_node) {
        params.push(name_node.text);
      }
    }
  }
  
  return params.includes(type_name);
}