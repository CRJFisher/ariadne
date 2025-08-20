/**
 * JavaScript-specific return type inference
 * 
 * Handles JavaScript return type patterns including:
 * - Literal return values
 * - Constructor patterns
 * - Promise/async functions
 * - Generator functions
 */

// TODO: Type Propagation - Flow return types through calls

import { SyntaxNode } from 'tree-sitter';
import { Def } from '@ariadnejs/types';
import {
  ReturnTypeInfo,
  ReturnTypeContext,
  is_constructor_name,
  get_void_type,
  get_enclosing_class_name,
  is_async_function,
  find_return_statements
} from './return_type_inference';

/**
 * Extract JavaScript return type from function node
 */
export function extract_javascript_return_type(
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // JavaScript doesn't have explicit return type annotations
  // (TypeScript does, but that's handled separately)
  return undefined;
}

/**
 * Analyze JavaScript return statement
 */
export function analyze_javascript_return(
  return_stmt: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const value_node = return_stmt.childForFieldName('argument') || 
                     return_stmt.child(1); // Skip 'return' keyword
  
  if (!value_node || value_node.type === ';') {
    // Empty return or return;
    return {
      type_name: 'undefined',
      confidence: 'explicit',
      source: 'return_statement',
      position: {
        row: return_stmt.startPosition.row,
        column: return_stmt.startPosition.column
      }
    };
  }

  // Infer type from the returned expression
  const inferred_type = infer_javascript_expression_type(value_node, context);
  if (inferred_type) {
    return {
      ...inferred_type,
      confidence: 'explicit', // Return statements have explicit values
      source: 'return_statement',
      position: {
        row: return_stmt.startPosition.row,
        column: return_stmt.startPosition.column
      }
    };
  }

  return undefined;
}

/**
 * Infer type from a JavaScript expression
 */
export function infer_javascript_expression_type(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  switch (expr_node.type) {
    // Literals
    case 'string':
    case 'template_string':
      return {
        type_name: 'string',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    case 'number':
      return {
        type_name: 'number',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    case 'true':
    case 'false':
      return {
        type_name: 'boolean',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    case 'null':
      return {
        type_name: 'null',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    case 'undefined':
      return {
        type_name: 'undefined',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    // Complex types
    case 'array':
      return {
        type_name: 'Array',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    case 'object':
      return {
        type_name: 'Object',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    case 'function':
    case 'arrow_function':
    case 'function_expression':
      return {
        type_name: 'Function',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    // Constructor calls
    case 'new_expression':
      return analyze_constructor_call(expr_node, context);
    
    // Member access (e.g., this.property)
    case 'member_expression':
      return analyze_member_expression(expr_node, context);
    
    // Call expressions
    case 'call_expression':
      return analyze_call_expression(expr_node, context);
    
    // Binary expressions
    case 'binary_expression':
      return analyze_binary_expression(expr_node, context);
    
    // Conditional expressions
    case 'conditional_expression':
    case 'ternary_expression':
      return analyze_conditional_expression(expr_node, context);
    
    // Await expressions
    case 'await_expression':
      return analyze_await_expression(expr_node, context);
    
    // Identifier - could be a variable
    case 'identifier':
      return analyze_identifier(expr_node, context);
    
    // This keyword
    case 'this':
      return {
        type_name: context.class_name || 'Object',
        confidence: 'inferred',
        source: 'return_statement'
      };
    
    default:
      return undefined;
  }
}

/**
 * Analyze constructor call return type
 */
function analyze_constructor_call(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const constructor = expr_node.childForFieldName('constructor');
  if (constructor) {
    const class_name = context.source_code.substring(
      constructor.startIndex,
      constructor.endIndex
    );
    return {
      type_name: class_name,
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  return undefined;
}

/**
 * Analyze member expression return type
 */
function analyze_member_expression(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const object = expr_node.childForFieldName('object');
  const property = expr_node.childForFieldName('property');
  
  if (object && property) {
    // Special case: this.xxx
    if (object.type === 'this') {
      const prop_name = property.text;
      // Could integrate with type tracker here to get property type
      return {
        type_name: prop_name,
        confidence: 'heuristic',
        source: 'return_statement'
      };
    }
    
    // Array methods
    if (property.text === 'length') {
      return {
        type_name: 'number',
        confidence: 'inferred',
        source: 'return_statement'
      };
    }
  }
  
  return undefined;
}

/**
 * Analyze call expression return type
 */
function analyze_call_expression(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const function_node = expr_node.childForFieldName('function');
  if (!function_node) {
    return undefined;
  }
  
  const func_text = function_node.text;
  
  // Known type conversion functions
  if (func_text === 'String') {
    return {
      type_name: 'string',
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  if (func_text === 'Number') {
    return {
      type_name: 'number',
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  if (func_text === 'Boolean') {
    return {
      type_name: 'boolean',
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  if (func_text === 'Array.from' || func_text === 'Array.of') {
    return {
      type_name: 'Array',
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  
  // Promise methods
  if (func_text === 'Promise.resolve' || func_text === 'Promise.reject') {
    return {
      type_name: 'Promise',
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  
  // Object methods
  if (func_text.startsWith('Object.')) {
    const method = func_text.substring(7);
    if (method === 'keys' || method === 'values') {
      return {
        type_name: 'Array',
        confidence: 'explicit',
        source: 'return_statement'
      };
    }
    if (method === 'entries') {
      return {
        type_name: 'Array',
        confidence: 'explicit',
        source: 'return_statement'
      };
    }
  }
  
  // Array methods that return arrays
  if (function_node.type === 'member_expression') {
    const property = function_node.childForFieldName('property');
    if (property) {
      const method_name = property.text;
      const array_returning_methods = [
        'map', 'filter', 'slice', 'concat', 'flat', 'flatMap',
        'sort', 'reverse', 'splice'
      ];
      if (array_returning_methods.includes(method_name)) {
        return {
          type_name: 'Array',
          confidence: 'inferred',
          source: 'return_statement'
        };
      }
      
      // Methods that return specific types
      if (method_name === 'join') {
        return {
          type_name: 'string',
          confidence: 'inferred',
          source: 'return_statement'
        };
      }
      if (method_name === 'indexOf' || method_name === 'lastIndexOf' || method_name === 'findIndex') {
        return {
          type_name: 'number',
          confidence: 'inferred',
          source: 'return_statement'
        };
      }
      if (method_name === 'includes' || method_name === 'some' || method_name === 'every') {
        return {
          type_name: 'boolean',
          confidence: 'inferred',
          source: 'return_statement'
        };
      }
    }
  }
  
  return undefined;
}

/**
 * Analyze binary expression return type
 */
function analyze_binary_expression(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const operator_node = expr_node.childForFieldName('operator');
  if (!operator_node) {
    return undefined;
  }
  
  const operator = operator_node.text;
  
  // Comparison operators return boolean
  const comparison_ops = ['<', '>', '<=', '>=', '==', '!=', '===', '!==', 'in', 'instanceof'];
  if (comparison_ops.includes(operator)) {
    return {
      type_name: 'boolean',
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  
  // Logical operators return boolean (mostly)
  if (operator === '&&' || operator === '||') {
    // These can return truthy/falsy values, but commonly boolean
    return {
      type_name: 'boolean',
      confidence: 'heuristic',
      source: 'return_statement'
    };
  }
  
  // Arithmetic operators
  if (operator === '+') {
    // Could be string concatenation or addition
    const left = expr_node.childForFieldName('left');
    const right = expr_node.childForFieldName('right');
    
    if (left && right) {
      const left_type = infer_javascript_expression_type(left, context);
      const right_type = infer_javascript_expression_type(right, context);
      
      if (left_type?.type_name === 'string' || right_type?.type_name === 'string') {
        return {
          type_name: 'string',
          confidence: 'inferred',
          source: 'return_statement'
        };
      }
    }
    
    return {
      type_name: 'number',
      confidence: 'heuristic',
      source: 'return_statement'
    };
  }
  
  if (['-', '*', '/', '%', '**', '<<', '>>', '>>>', '&', '|', '^'].includes(operator)) {
    return {
      type_name: 'number',
      confidence: 'inferred',
      source: 'return_statement'
    };
  }
  
  return undefined;
}

/**
 * Analyze conditional expression return type
 */
function analyze_conditional_expression(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const consequent = expr_node.childForFieldName('consequent');
  const alternate = expr_node.childForFieldName('alternate');
  
  if (consequent && alternate) {
    const consequent_type = infer_javascript_expression_type(consequent, context);
    const alternate_type = infer_javascript_expression_type(alternate, context);
    
    // If both branches return the same type
    if (consequent_type && alternate_type && 
        consequent_type.type_name === alternate_type.type_name) {
      return consequent_type;
    }
    
    // Mixed types - could return union type for TypeScript
    if (consequent_type || alternate_type) {
      return {
        type_name: 'any',
        confidence: 'heuristic',
        source: 'return_statement'
      };
    }
  }
  
  return undefined;
}

/**
 * Analyze await expression return type
 */
function analyze_await_expression(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const argument = expr_node.child(1); // Skip 'await' keyword
  if (argument) {
    const arg_type = infer_javascript_expression_type(argument, context);
    // Await unwraps Promise<T> to T
    if (arg_type && arg_type.type_name.startsWith('Promise')) {
      // Extract inner type if possible
      const inner_match = arg_type.type_name.match(/Promise<(.+)>/);
      if (inner_match) {
        return {
          type_name: inner_match[1],
          confidence: 'inferred',
          source: 'return_statement'
        };
      }
    }
    return arg_type;
  }
  return undefined;
}

/**
 * Analyze identifier return type
 */
function analyze_identifier(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const var_name = expr_node.text;
  
  // Known global constructors
  const global_constructors = [
    'Array', 'Object', 'String', 'Number', 'Boolean',
    'Date', 'RegExp', 'Error', 'Map', 'Set', 'WeakMap', 'WeakSet',
    'Promise', 'Proxy', 'Reflect', 'Symbol'
  ];
  
  if (global_constructors.includes(var_name)) {
    return {
      type_name: var_name,
      confidence: 'inferred',
      source: 'return_statement'
    };
  }
  
  // Could integrate with type tracker to get variable type
  return {
    type_name: var_name,
    confidence: 'heuristic',
    source: 'return_statement'
  };
}

/**
 * Check for JavaScript-specific patterns
 */
export function check_javascript_patterns(
  def: Def,
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // Check for async functions first
  if (is_async_function(func_node)) {
    // Analyze the body to determine the inner type
    const body = func_node.childForFieldName('body');
    if (body) {
      const returns = find_return_statements(body);
      if (returns.length > 0) {
        const return_types: string[] = [];
        for (const ret of returns) {
          const ret_type = analyze_javascript_return(ret, context);
          if (ret_type) {
            return_types.push(ret_type.type_name);
          }
        }
        
        if (return_types.length > 0) {
          const unique_types = [...new Set(return_types)];
          const inner_type = unique_types.length === 1 
            ? unique_types[0] 
            : 'any';
          
          return {
            type_name: `Promise<${inner_type}>`,
            confidence: 'inferred',
            source: 'pattern'
          };
        }
      }
    }
    
    // Async function with no explicit returns
    return {
      type_name: 'Promise<undefined>',
      confidence: 'inferred',
      source: 'pattern'
    };
  }
  
  // Constructor function pattern
  if (def.name === 'constructor') {
    const class_name = get_enclosing_class_name(func_node);
    if (class_name) {
      return {
        type_name: class_name,
        confidence: 'explicit',
        source: 'pattern'
      };
    }
  }
  
  // Builder pattern (returns this)
  if (def.symbol_kind === 'method' && 
      (def.name.startsWith('with') || def.name.startsWith('set'))) {
    const body = func_node.childForFieldName('body');
    if (body && contains_return_this(body)) {
      return {
        type_name: context.class_name || 'this',
        confidence: 'inferred',
        source: 'pattern'
      };
    }
  }
  
  return undefined;
}

/**
 * Check if function body contains 'return this'
 */
function contains_return_this(body_node: SyntaxNode): boolean {
  for (let i = 0; i < body_node.childCount; i++) {
    const child = body_node.child(i);
    if (child) {
      if (child.type === 'return_statement') {
        const value = child.childForFieldName('argument');
        if (value && value.type === 'this') {
          return true;
        }
      }
      if (contains_return_this(child)) {
        return true;
      }
    }
  }
  return false;
}