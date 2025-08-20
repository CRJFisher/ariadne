/**
 * Rust-specific return type inference
 * 
 * Handles Rust return type patterns including:
 * - Explicit return type annotations
 * - Result and Option types
 * - Implicit returns (last expression)
 * - impl Trait returns
 */

// TODO: Type Propagation - Flow return types through calls

import { SyntaxNode } from 'tree-sitter';
import { Def } from '@ariadnejs/types';
import {
  ReturnTypeInfo,
  ReturnTypeContext,
  get_enclosing_class_name
} from './return_type_inference';

/**
 * Extract Rust return type annotation
 */
export function extract_rust_return_type(
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // Rust has explicit return types after ->
  const return_type_node = func_node.childForFieldName('return_type');
  if (return_type_node) {
    // Skip the '->' and get the actual type
    for (let i = 0; i < return_type_node.childCount; i++) {
      const child = return_type_node.child(i);
      if (child && child.type !== '->') {
        const type_name = extract_rust_type_name(child, context.source_code);
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
  
  // No explicit return type means () (unit type) in Rust
  return {
    type_name: '()',
    confidence: 'inferred',
    source: 'pattern'
  };
}

/**
 * Extract type name from Rust type node
 */
function extract_rust_type_name(type_node: SyntaxNode, source_code: string): string {
  const type_text = source_code.substring(type_node.startIndex, type_node.endIndex);
  
  switch (type_node.type) {
    // Primitive types
    case 'primitive_type':
      return type_text;
    
    // Type identifiers
    case 'type_identifier':
      return type_text;
    
    // Generic types
    case 'generic_type':
      return type_text;
    
    // Reference types
    case 'reference_type':
      return type_text;
    
    // Pointer types
    case 'pointer_type':
      return type_text;
    
    // Array types
    case 'array_type':
      return type_text;
    
    // Slice types
    case 'slice_type':
      return type_text;
    
    // Tuple types
    case 'tuple_type':
      return type_text;
    
    // Function pointer types
    case 'function_type':
      return type_text;
    
    // impl Trait
    case 'impl_trait_type':
      return type_text;
    
    // dyn Trait
    case 'dyn_trait_type':
      return type_text;
    
    // Unit type
    case 'unit_type':
      return '()';
    
    // Never type
    case 'never_type':
      return '!';
    
    // Scoped type identifier (module::Type)
    case 'scoped_type_identifier':
      return type_text;
    
    default:
      return type_text;
  }
}

/**
 * Analyze Rust return statement
 */
export function analyze_rust_return(
  return_stmt: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // Rust has explicit return statements and implicit returns
  if (return_stmt.type === 'return_expression') {
    const value_node = return_stmt.child(1); // Skip 'return' keyword
    
    if (!value_node || value_node.type === ';') {
      // Empty return (unit type)
      return {
        type_name: '()',
        confidence: 'explicit',
        source: 'return_statement',
        position: {
          row: return_stmt.startPosition.row,
          column: return_stmt.startPosition.column
        }
      };
    }
    
    return infer_rust_expression_type(value_node, context);
  }
  
  // Implicit return (last expression without semicolon)
  if (is_implicit_return(return_stmt)) {
    return infer_rust_expression_type(return_stmt, context);
  }
  
  return undefined;
}

/**
 * Check if an expression is an implicit return
 */
function is_implicit_return(expr_node: SyntaxNode): boolean {
  // Check if this is the last expression in a block
  const parent = expr_node.parent;
  if (!parent || parent.type !== 'block') {
    return false;
  }
  
  // Find the last non-punctuation child
  let last_expr = null;
  for (let i = parent.childCount - 1; i >= 0; i--) {
    const child = parent.child(i);
    if (child && child.type !== '}' && child.type !== ';') {
      last_expr = child;
      break;
    }
  }
  
  return last_expr === expr_node;
}

/**
 * Infer type from a Rust expression
 */
export function infer_rust_expression_type(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  switch (expr_node.type) {
    // Literals
    case 'string_literal':
      return {
        type_name: '&str',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    case 'char_literal':
      return {
        type_name: 'char',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    case 'integer_literal':
      return analyze_rust_integer_literal(expr_node, context);
    
    case 'float_literal':
      return analyze_rust_float_literal(expr_node, context);
    
    case 'boolean_literal':
      return {
        type_name: 'bool',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    // Collections
    case 'array_expression':
      return analyze_rust_array(expr_node, context);
    
    case 'tuple_expression':
      return analyze_rust_tuple(expr_node, context);
    
    // Struct expressions
    case 'struct_expression':
      return analyze_rust_struct(expr_node, context);
    
    // Call expressions
    case 'call_expression':
      return analyze_rust_call(expr_node, context);
    
    // Method calls
    case 'method_call_expression':
      return analyze_rust_method_call(expr_node, context);
    
    // Field access
    case 'field_expression':
      return analyze_rust_field(expr_node, context);
    
    // References
    case 'reference_expression':
      return analyze_rust_reference(expr_node, context);
    
    // Binary operations
    case 'binary_expression':
      return analyze_rust_binary(expr_node, context);
    
    // Unary operations
    case 'unary_expression':
      return analyze_rust_unary(expr_node, context);
    
    // If expressions
    case 'if_expression':
      return analyze_rust_if(expr_node, context);
    
    // Match expressions
    case 'match_expression':
      return analyze_rust_match(expr_node, context);
    
    // Block expressions
    case 'block_expression':
      return analyze_rust_block(expr_node, context);
    
    // Closure expressions
    case 'closure_expression':
      return {
        type_name: 'Fn',
        confidence: 'heuristic',
        source: 'return_statement'
      };
    
    // Macro invocations
    case 'macro_invocation':
      return analyze_rust_macro(expr_node, context);
    
    // Identifiers
    case 'identifier':
      return analyze_rust_identifier(expr_node, context);
    
    // Self
    case 'self':
      return {
        type_name: context.class_name || 'Self',
        confidence: 'inferred',
        source: 'return_statement'
      };
    
    // Unit
    case 'unit_expression':
      return {
        type_name: '()',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    default:
      return undefined;
  }
}

/**
 * Analyze Rust integer literal
 */
function analyze_rust_integer_literal(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo {
  const text = context.source_code.substring(expr_node.startIndex, expr_node.endIndex);
  
  // Check for type suffix
  const suffix_match = text.match(/[iu](8|16|32|64|128|size)$/);
  if (suffix_match) {
    return {
      type_name: suffix_match[0],
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  
  // Default to i32
  return {
    type_name: 'i32',
    confidence: 'inferred',
    source: 'return_statement'
  };
}

/**
 * Analyze Rust float literal
 */
function analyze_rust_float_literal(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo {
  const text = context.source_code.substring(expr_node.startIndex, expr_node.endIndex);
  
  // Check for type suffix
  const suffix_match = text.match(/f(32|64)$/);
  if (suffix_match) {
    return {
      type_name: suffix_match[0],
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  
  // Default to f64
  return {
    type_name: 'f64',
    confidence: 'inferred',
    source: 'return_statement'
  };
}

/**
 * Analyze Rust array expression
 */
function analyze_rust_array(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo {
  // Try to infer element type from first element
  const first_elem = expr_node.child(1); // Skip '['
  if (first_elem && first_elem.type !== ',' && first_elem.type !== ']') {
    const elem_type = infer_rust_expression_type(first_elem, context);
    if (elem_type) {
      // Count elements for fixed-size array
      let count = 0;
      for (let i = 0; i < expr_node.childCount; i++) {
        const child = expr_node.child(i);
        if (child && child.type !== '[' && child.type !== ']' && child.type !== ',') {
          count++;
        }
      }
      
      return {
        type_name: `[${elem_type.type_name}; ${count}]`,
        confidence: 'inferred',
        source: 'return_statement'
      };
    }
  }
  
  return {
    type_name: 'array',
    confidence: 'heuristic',
    source: 'return_statement'
  };
}

/**
 * Analyze Rust tuple expression
 */
function analyze_rust_tuple(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo {
  const types: string[] = [];
  
  for (let i = 0; i < expr_node.childCount; i++) {
    const child = expr_node.child(i);
    if (child && child.type !== '(' && child.type !== ')' && child.type !== ',') {
      const elem_type = infer_rust_expression_type(child, context);
      if (elem_type) {
        types.push(elem_type.type_name);
      } else {
        types.push('_');
      }
    }
  }
  
  if (types.length > 0) {
    return {
      type_name: `(${types.join(', ')})`,
      confidence: 'inferred',
      source: 'return_statement'
    };
  }
  
  return {
    type_name: '()',
    confidence: 'explicit',
    source: 'return_statement'
  };
}

/**
 * Analyze Rust struct expression
 */
function analyze_rust_struct(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const name_node = expr_node.childForFieldName('name');
  if (name_node) {
    const struct_name = context.source_code.substring(
      name_node.startIndex,
      name_node.endIndex
    );
    
    return {
      type_name: struct_name,
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  
  return undefined;
}

/**
 * Analyze Rust call expression
 */
function analyze_rust_call(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const function_node = expr_node.childForFieldName('function');
  if (!function_node) {
    return undefined;
  }
  
  const func_text = context.source_code.substring(
    function_node.startIndex,
    function_node.endIndex
  );
  
  // Common constructors
  if (func_text.endsWith('::new')) {
    const type_name = func_text.replace('::new', '');
    return {
      type_name,
      confidence: 'inferred',
      source: 'return_statement'
    };
  }
  
  // Option constructors
  if (func_text === 'Some') {
    return {
      type_name: 'Option',
      confidence: 'inferred',
      source: 'return_statement'
    };
  }
  
  // Result constructors
  if (func_text === 'Ok' || func_text === 'Err') {
    return {
      type_name: 'Result',
      confidence: 'inferred',
      source: 'return_statement'
    };
  }
  
  // Vec constructors
  if (func_text === 'Vec::new' || func_text === 'vec!') {
    return {
      type_name: 'Vec',
      confidence: 'inferred',
      source: 'return_statement'
    };
  }
  
  // String constructors
  if (func_text === 'String::new' || func_text === 'String::from') {
    return {
      type_name: 'String',
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  
  return undefined;
}

/**
 * Analyze Rust method call
 */
function analyze_rust_method_call(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const method_node = expr_node.childForFieldName('name');
  if (!method_node) {
    return undefined;
  }
  
  const method_name = context.source_code.substring(
    method_node.startIndex,
    method_node.endIndex
  );
  
  // String methods
  if (method_name === 'to_string' || method_name === 'to_owned') {
    return {
      type_name: 'String',
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  
  if (method_name === 'as_str' || method_name === 'as_ref') {
    return {
      type_name: '&str',
      confidence: 'inferred',
      source: 'return_statement'
    };
  }
  
  // Iterator methods
  if (method_name === 'collect') {
    // Could be Vec, HashSet, etc. - default to Vec
    return {
      type_name: 'Vec',
      confidence: 'heuristic',
      source: 'return_statement'
    };
  }
  
  if (method_name === 'map' || method_name === 'filter' || 
      method_name === 'filter_map' || method_name === 'flat_map') {
    return {
      type_name: 'impl Iterator',
      confidence: 'inferred',
      source: 'return_statement'
    };
  }
  
  // Option/Result methods
  if (method_name === 'unwrap' || method_name === 'expect') {
    // Returns inner type - we'd need more context
    return {
      type_name: 'T',
      confidence: 'heuristic',
      source: 'return_statement'
    };
  }
  
  if (method_name === 'is_some' || method_name === 'is_none' ||
      method_name === 'is_ok' || method_name === 'is_err') {
    return {
      type_name: 'bool',
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  
  // Clone
  if (method_name === 'clone') {
    // Returns same type as receiver
    const receiver = expr_node.childForFieldName('object');
    if (receiver) {
      return infer_rust_expression_type(receiver, context);
    }
  }
  
  // len
  if (method_name === 'len') {
    return {
      type_name: 'usize',
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  
  return undefined;
}

/**
 * Analyze Rust field access
 */
function analyze_rust_field(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const field_node = expr_node.childForFieldName('field');
  if (field_node) {
    const field_name = context.source_code.substring(
      field_node.startIndex,
      field_node.endIndex
    );
    
    // Tuple field access (e.g., .0, .1)
    if (/^\d+$/.test(field_name)) {
      return {
        type_name: 'field',
        confidence: 'heuristic',
        source: 'return_statement'
      };
    }
    
    // Named field
    return {
      type_name: field_name,
      confidence: 'heuristic',
      source: 'return_statement'
    };
  }
  
  return undefined;
}

/**
 * Analyze Rust reference expression
 */
function analyze_rust_reference(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const value = expr_node.child(1); // Skip '&'
  if (value) {
    const value_type = infer_rust_expression_type(value, context);
    if (value_type) {
      // Check for mutable reference
      const is_mut = expr_node.child(0)?.type === 'mutable_specifier';
      return {
        type_name: `&${is_mut ? 'mut ' : ''}${value_type.type_name}`,
        confidence: value_type.confidence,
        source: 'return_statement'
      };
    }
  }
  
  return undefined;
}

/**
 * Analyze Rust binary expression
 */
function analyze_rust_binary(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const operator = expr_node.childForFieldName('operator');
  if (!operator) {
    return undefined;
  }
  
  const op = operator.text;
  
  // Comparison operators
  if (['<', '>', '<=', '>=', '==', '!='].includes(op)) {
    return {
      type_name: 'bool',
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  
  // Logical operators
  if (op === '&&' || op === '||') {
    return {
      type_name: 'bool',
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  
  // Arithmetic operators - type depends on operands
  if (['+', '-', '*', '/', '%'].includes(op)) {
    const left = expr_node.childForFieldName('left');
    const right = expr_node.childForFieldName('right');
    
    if (left && right) {
      const left_type = infer_rust_expression_type(left, context);
      const right_type = infer_rust_expression_type(right, context);
      
      // Use the more specific type
      if (left_type && left_type.confidence === 'explicit') {
        return left_type;
      }
      if (right_type && right_type.confidence === 'explicit') {
        return right_type;
      }
      
      return left_type || right_type;
    }
  }
  
  return undefined;
}

/**
 * Analyze Rust unary expression
 */
function analyze_rust_unary(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const operator = expr_node.child(0);
  const operand = expr_node.child(1);
  
  if (operator && operand) {
    const op = operator.text;
    
    // Negation
    if (op === '!') {
      const operand_type = infer_rust_expression_type(operand, context);
      if (operand_type?.type_name === 'bool') {
        return {
          type_name: 'bool',
          confidence: 'explicit',
          source: 'return_statement'
        };
      }
    }
    
    // Negative
    if (op === '-') {
      return infer_rust_expression_type(operand, context);
    }
    
    // Dereference
    if (op === '*') {
      const operand_type = infer_rust_expression_type(operand, context);
      if (operand_type && operand_type.type_name.startsWith('&')) {
        // Remove reference
        return {
          type_name: operand_type.type_name.replace(/^&(mut\s+)?/, ''),
          confidence: operand_type.confidence,
          source: 'return_statement'
        };
      }
    }
  }
  
  return undefined;
}

/**
 * Analyze Rust if expression
 */
function analyze_rust_if(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const consequence = expr_node.childForFieldName('consequence');
  const alternative = expr_node.childForFieldName('alternative');
  
  if (consequence) {
    const cons_type = analyze_rust_block(consequence, context);
    
    if (alternative) {
      const alt_type = analyze_rust_block(alternative, context);
      
      if (cons_type && alt_type && cons_type.type_name === alt_type.type_name) {
        return cons_type;
      }
    }
    
    return cons_type;
  }
  
  return undefined;
}

/**
 * Analyze Rust match expression
 */
function analyze_rust_match(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const body = expr_node.childForFieldName('body');
  if (!body) {
    return undefined;
  }
  
  // Analyze first arm to get return type
  for (let i = 0; i < body.childCount; i++) {
    const child = body.child(i);
    if (child && child.type === 'match_arm') {
      const value = child.childForFieldName('value');
      if (value) {
        return infer_rust_expression_type(value, context);
      }
    }
  }
  
  return undefined;
}

/**
 * Analyze Rust block expression
 */
function analyze_rust_block(
  block_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // Find the last expression (implicit return)
  let last_expr = null;
  
  for (let i = block_node.childCount - 1; i >= 0; i--) {
    const child = block_node.child(i);
    if (child && child.type !== '{' && child.type !== '}' && child.type !== ';') {
      // Check if it's an expression (not a statement)
      if (child.type !== 'expression_statement') {
        last_expr = child;
        break;
      }
    }
  }
  
  if (last_expr) {
    return infer_rust_expression_type(last_expr, context);
  }
  
  // Empty block or all statements
  return {
    type_name: '()',
    confidence: 'explicit',
    source: 'return_statement'
  };
}

/**
 * Analyze Rust macro invocation
 */
function analyze_rust_macro(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const macro_node = expr_node.childForFieldName('macro');
  if (!macro_node) {
    return undefined;
  }
  
  const macro_name = context.source_code.substring(
    macro_node.startIndex,
    macro_node.endIndex
  );
  
  // Common macros with known return types
  const known_macros: { [key: string]: string } = {
    'vec!': 'Vec',
    'format!': 'String',
    'print!': '()',
    'println!': '()',
    'eprintln!': '()',
    'dbg!': 'T',
    'panic!': '!',
    'todo!': '!',
    'unimplemented!': '!',
    'unreachable!': '!'
  };
  
  if (macro_name in known_macros) {
    return {
      type_name: known_macros[macro_name],
      confidence: 'inferred',
      source: 'return_statement'
    };
  }
  
  return undefined;
}

/**
 * Analyze Rust identifier
 */
function analyze_rust_identifier(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const var_name = expr_node.text;
  
  // Constants
  if (var_name === 'true' || var_name === 'false') {
    return {
      type_name: 'bool',
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  
  // Self type
  if (var_name === 'Self') {
    return {
      type_name: context.class_name || 'Self',
      confidence: 'inferred',
      source: 'return_statement'
    };
  }
  
  return {
    type_name: var_name,
    confidence: 'heuristic',
    source: 'return_statement'
  };
}

/**
 * Check for Rust-specific patterns
 */
export function check_rust_patterns(
  def: Def,
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // Constructor pattern (usually returns Self or the type)
  if (def.name === 'new') {
    const impl_block = find_enclosing_impl_block(func_node);
    if (impl_block) {
      const type_node = impl_block.childForFieldName('type');
      if (type_node) {
        const type_name = context.source_code.substring(
          type_node.startIndex,
          type_node.endIndex
        );
        return {
          type_name,
          confidence: 'inferred',
          source: 'pattern'
        };
      }
    }
    
    return {
      type_name: 'Self',
      confidence: 'inferred',
      source: 'pattern'
    };
  }
  
  // Builder pattern methods
  if (def.type === 'method' && 
      (def.name.startsWith('with_') || def.name.startsWith('set_'))) {
    // Often return Self for chaining
    return {
      type_name: 'Self',
      confidence: 'heuristic',
      source: 'pattern'
    };
  }
  
  // From/Into trait implementations
  if (def.name === 'from') {
    return {
      type_name: 'Self',
      confidence: 'inferred',
      source: 'pattern'
    };
  }
  
  if (def.name === 'into') {
    // Returns the target type - would need more context
    return {
      type_name: 'T',
      confidence: 'heuristic',
      source: 'pattern'
    };
  }
  
  // Default trait
  if (def.name === 'default') {
    return {
      type_name: 'Self',
      confidence: 'inferred',
      source: 'pattern'
    };
  }
  
  // Clone trait
  if (def.name === 'clone') {
    return {
      type_name: 'Self',
      confidence: 'explicit',
      source: 'pattern'
    };
  }
  
  // Display/Debug traits
  if (def.name === 'fmt') {
    return {
      type_name: 'fmt::Result',
      confidence: 'explicit',
      source: 'pattern'
    };
  }
  
  // Async functions
  if (is_async_function(func_node)) {
    const explicit_return = extract_rust_return_type(func_node, context);
    if (explicit_return && explicit_return.type_name !== '()') {
      return {
        type_name: `impl Future<Output = ${explicit_return.type_name}>`,
        confidence: 'inferred',
        source: 'pattern'
      };
    }
    
    return {
      type_name: 'impl Future',
      confidence: 'inferred',
      source: 'pattern'
    };
  }
  
  return undefined;
}

/**
 * Find enclosing impl block
 */
function find_enclosing_impl_block(node: SyntaxNode): SyntaxNode | undefined {
  let current = node.parent;
  
  while (current) {
    if (current.type === 'impl_item') {
      return current;
    }
    current = current.parent;
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
  
  return false;
}