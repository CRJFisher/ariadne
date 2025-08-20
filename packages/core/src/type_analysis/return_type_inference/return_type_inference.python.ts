/**
 * Python-specific return type inference
 * 
 * Handles Python return type patterns including:
 * - Type hints (Python 3.5+)
 * - Docstring type annotations
 * - Duck typing patterns
 * - Special methods (__init__, __str__, etc.)
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
 * Extract Python return type annotation
 */
export function extract_python_return_type(
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // Check for type annotation (Python 3.5+)
  const return_type_node = func_node.childForFieldName('return_type');
  if (return_type_node) {
    const type_name = extract_python_type_name(return_type_node, context.source_code);
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
  
  // Check docstring for type hints
  const docstring_type = extract_docstring_return_type(func_node, context);
  if (docstring_type) {
    return docstring_type;
  }
  
  return undefined;
}

/**
 * Extract type name from Python type annotation
 */
function extract_python_type_name(type_node: SyntaxNode, source_code: string): string {
  const type_text = source_code.substring(type_node.startIndex, type_node.endIndex);
  
  switch (type_node.type) {
    // Simple types
    case 'type':
    case 'identifier':
      return type_text;
    
    // Generic types (List[str], Dict[str, int])
    case 'generic_type':
    case 'subscript':
      return type_text;
    
    // Union types (Union[str, int])
    case 'union_type':
      return type_text;
    
    // Optional types (Optional[str])
    case 'optional_type':
      return type_text;
    
    // Tuple types
    case 'tuple':
      return type_text;
    
    // None type
    case 'none':
      return 'None';
    
    default:
      return type_text;
  }
}

/**
 * Extract return type from docstring
 */
function extract_docstring_return_type(
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const body = func_node.childForFieldName('body');
  if (!body || body.childCount === 0) {
    return undefined;
  }
  
  // First statement might be a docstring
  const first_stmt = body.child(0);
  if (first_stmt && first_stmt.type === 'expression_statement') {
    const expr = first_stmt.child(0);
    if (expr && expr.type === 'string') {
      const docstring = context.source_code.substring(
        expr.startIndex + 1, // Skip opening quote
        expr.endIndex - 1    // Skip closing quote
      );
      
      // Parse various docstring formats
      
      // Google style: Returns:\n    type: description
      const google_match = docstring.match(/Returns?:\s*(?:[\r\n]+\s+)?(\w+(?:\[[\w\s,\[\]]+\])?)/);
      if (google_match) {
        return {
          type_name: google_match[1],
          confidence: 'explicit',
          source: 'docstring',
          position: {
            row: expr.startPosition.row,
            column: expr.startPosition.column
          }
        };
      }
      
      // NumPy style: Returns\n-------\ntype
      const numpy_match = docstring.match(/Returns?\s*\n\s*-+\s*\n\s*(\w+(?:\[[\w\s,\[\]]+\])?)/);
      if (numpy_match) {
        return {
          type_name: numpy_match[1],
          confidence: 'explicit',
          source: 'docstring',
          position: {
            row: expr.startPosition.row,
            column: expr.startPosition.column
          }
        };
      }
      
      // Sphinx style: :returns: type
      const sphinx_match = docstring.match(/:returns?:\s*(\w+(?:\[[\w\s,\[\]]+\])?)/);
      if (sphinx_match) {
        return {
          type_name: sphinx_match[1],
          confidence: 'explicit',
          source: 'docstring',
          position: {
            row: expr.startPosition.row,
            column: expr.startPosition.column
          }
        };
      }
      
      // :rtype: type
      const rtype_match = docstring.match(/:rtype:\s*(\w+(?:\[[\w\s,\[\]]+\])?)/);
      if (rtype_match) {
        return {
          type_name: rtype_match[1],
          confidence: 'explicit',
          source: 'docstring',
          position: {
            row: expr.startPosition.row,
            column: expr.startPosition.column
          }
        };
      }
    }
  }
  
  return undefined;
}

/**
 * Analyze Python return statement
 */
export function analyze_python_return(
  return_stmt: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const value_node = return_stmt.child(1); // Skip 'return' keyword
  
  if (!value_node) {
    // Empty return
    return {
      type_name: 'None',
      confidence: 'explicit',
      source: 'return_statement',
      position: {
        row: return_stmt.startPosition.row,
        column: return_stmt.startPosition.column
      }
    };
  }
  
  // Handle return with value
  if (value_node.type === 'expression_list') {
    // Multiple return values -> tuple
    const expr_count = count_expressions(value_node);
    if (expr_count > 1) {
      return {
        type_name: 'tuple',
        confidence: 'explicit',
        source: 'return_statement',
        position: {
          row: return_stmt.startPosition.row,
          column: return_stmt.startPosition.column
        }
      };
    }
    // Single expression
    const first_expr = value_node.child(0);
    if (first_expr) {
      return infer_python_expression_type(first_expr, context);
    }
  }
  
  return infer_python_expression_type(value_node, context);
}

/**
 * Count expressions in expression list
 */
function count_expressions(expr_list: SyntaxNode): number {
  let count = 0;
  for (let i = 0; i < expr_list.childCount; i++) {
    const child = expr_list.child(i);
    if (child && child.type !== ',') {
      count++;
    }
  }
  return count;
}

/**
 * Infer type from a Python expression
 */
export function infer_python_expression_type(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  switch (expr_node.type) {
    // Literals
    case 'string':
      return {
        type_name: 'str',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    case 'integer':
      return {
        type_name: 'int',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    case 'float':
      return {
        type_name: 'float',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    case 'true':
    case 'false':
      return {
        type_name: 'bool',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    case 'none':
      return {
        type_name: 'None',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    // Collections
    case 'list':
      return {
        type_name: 'list',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    case 'dictionary':
      return {
        type_name: 'dict',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    case 'set':
      return {
        type_name: 'set',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    case 'tuple':
      return {
        type_name: 'tuple',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    // Comprehensions
    case 'list_comprehension':
      return {
        type_name: 'list',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    case 'dictionary_comprehension':
      return {
        type_name: 'dict',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    case 'set_comprehension':
      return {
        type_name: 'set',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    case 'generator_expression':
      return {
        type_name: 'Generator',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    // Call expressions
    case 'call':
      return analyze_python_call(expr_node, context);
    
    // Attribute access
    case 'attribute':
      return analyze_python_attribute(expr_node, context);
    
    // Binary operations
    case 'binary_operator':
      return analyze_python_binary_op(expr_node, context);
    
    // Conditional expressions
    case 'conditional_expression':
      return analyze_python_conditional(expr_node, context);
    
    // Await expressions
    case 'await':
      return analyze_python_await(expr_node, context);
    
    // Lambda
    case 'lambda':
      return {
        type_name: 'Callable',
        confidence: 'explicit',
        source: 'return_statement'
      };
    
    // Identifier
    case 'identifier':
      return analyze_python_identifier(expr_node, context);
    
    default:
      return undefined;
  }
}

/**
 * Analyze Python call expression
 */
function analyze_python_call(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const function_node = expr_node.childForFieldName('function');
  if (!function_node) {
    return undefined;
  }
  
  const func_name = context.source_code.substring(
    function_node.startIndex,
    function_node.endIndex
  );
  
  // Built-in type constructors
  const type_constructors: { [key: string]: string } = {
    'str': 'str',
    'int': 'int',
    'float': 'float',
    'bool': 'bool',
    'list': 'list',
    'dict': 'dict',
    'set': 'set',
    'tuple': 'tuple',
    'bytes': 'bytes',
    'bytearray': 'bytearray',
    'frozenset': 'frozenset',
    'complex': 'complex'
  };
  
  if (func_name in type_constructors) {
    return {
      type_name: type_constructors[func_name],
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  
  // Common functions with known return types
  const known_functions: { [key: string]: string } = {
    'len': 'int',
    'range': 'range',
    'enumerate': 'enumerate',
    'zip': 'zip',
    'map': 'map',
    'filter': 'filter',
    'sorted': 'list',
    'reversed': 'reversed',
    'sum': 'number',
    'min': 'any',
    'max': 'any',
    'abs': 'number',
    'round': 'number',
    'open': 'IO',
    'print': 'None',
    'input': 'str',
    'type': 'type',
    'isinstance': 'bool',
    'issubclass': 'bool',
    'hasattr': 'bool',
    'getattr': 'any',
    'setattr': 'None',
    'delattr': 'None'
  };
  
  if (func_name in known_functions) {
    return {
      type_name: known_functions[func_name],
      confidence: 'inferred',
      source: 'return_statement'
    };
  }
  
  // Class instantiation (uppercase first letter convention)
  if (func_name[0] === func_name[0].toUpperCase()) {
    return {
      type_name: func_name,
      confidence: 'heuristic',
      source: 'return_statement'
    };
  }
  
  return undefined;
}

/**
 * Analyze Python attribute access
 */
function analyze_python_attribute(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const object_node = expr_node.childForFieldName('object');
  const attr_node = expr_node.childForFieldName('attribute');
  
  if (object_node && attr_node) {
    const attr_name = context.source_code.substring(
      attr_node.startIndex,
      attr_node.endIndex
    );
    
    // self.attribute in methods
    if (object_node.type === 'identifier' && object_node.text === 'self') {
      return {
        type_name: attr_name,
        confidence: 'heuristic',
        source: 'return_statement'
      };
    }
    
    // String methods
    if (attr_name === 'upper' || attr_name === 'lower' || 
        attr_name === 'strip' || attr_name === 'replace') {
      return {
        type_name: 'str',
        confidence: 'inferred',
        source: 'return_statement'
      };
    }
    
    // List methods
    if (attr_name === 'append' || attr_name === 'extend' || 
        attr_name === 'remove' || attr_name === 'clear') {
      return {
        type_name: 'None',
        confidence: 'inferred',
        source: 'return_statement'
      };
    }
    
    if (attr_name === 'pop') {
      return {
        type_name: 'any',
        confidence: 'heuristic',
        source: 'return_statement'
      };
    }
    
    if (attr_name === 'copy') {
      return {
        type_name: 'list',
        confidence: 'heuristic',
        source: 'return_statement'
      };
    }
  }
  
  return undefined;
}

/**
 * Analyze Python binary operation
 */
function analyze_python_binary_op(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const operator_node = expr_node.childForFieldName('operator');
  if (!operator_node) {
    return undefined;
  }
  
  const operator = operator_node.text;
  
  // Comparison operators
  const comparison_ops = ['<', '>', '<=', '>=', '==', '!=', 'is', 'in'];
  if (comparison_ops.includes(operator)) {
    return {
      type_name: 'bool',
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  
  // Logical operators
  if (operator === 'and' || operator === 'or') {
    // These return one of the operands, not necessarily bool
    return {
      type_name: 'any',
      confidence: 'heuristic',
      source: 'return_statement'
    };
  }
  
  // Arithmetic operators
  if (['+', '-', '*', '/', '//', '%', '**'].includes(operator)) {
    const left = expr_node.childForFieldName('left');
    const right = expr_node.childForFieldName('right');
    
    if (left && right) {
      const left_type = infer_python_expression_type(left, context);
      const right_type = infer_python_expression_type(right, context);
      
      // String concatenation
      if (operator === '+' && 
          (left_type?.type_name === 'str' || right_type?.type_name === 'str')) {
        return {
          type_name: 'str',
          confidence: 'inferred',
          source: 'return_statement'
        };
      }
      
      // Division always returns float
      if (operator === '/') {
        return {
          type_name: 'float',
          confidence: 'explicit',
          source: 'return_statement'
        };
      }
      
      // Floor division returns int
      if (operator === '//') {
        return {
          type_name: 'int',
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
  
  return undefined;
}

/**
 * Analyze Python conditional expression
 */
function analyze_python_conditional(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const consequence = expr_node.childForFieldName('consequence');
  const alternative = expr_node.childForFieldName('alternative');
  
  if (consequence && alternative) {
    const cons_type = infer_python_expression_type(consequence, context);
    const alt_type = infer_python_expression_type(alternative, context);
    
    if (cons_type && alt_type && cons_type.type_name === alt_type.type_name) {
      return cons_type;
    }
    
    return {
      type_name: 'Any',
      confidence: 'heuristic',
      source: 'return_statement'
    };
  }
  
  return undefined;
}

/**
 * Analyze Python await expression
 */
function analyze_python_await(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const expression = expr_node.child(1); // Skip 'await' keyword
  if (expression) {
    const expr_type = infer_python_expression_type(expression, context);
    // Await unwraps coroutines/futures
    if (expr_type && expr_type.type_name.startsWith('Awaitable')) {
      // Extract inner type if possible
      const inner_match = expr_type.type_name.match(/Awaitable\[(.+)\]/);
      if (inner_match) {
        return {
          type_name: inner_match[1],
          confidence: 'inferred',
          source: 'return_statement'
        };
      }
    }
    return expr_type;
  }
  return undefined;
}

/**
 * Analyze Python identifier
 */
function analyze_python_identifier(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const var_name = expr_node.text;
  
  // Built-in constants
  if (var_name === 'True' || var_name === 'False') {
    return {
      type_name: 'bool',
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  
  if (var_name === 'None') {
    return {
      type_name: 'None',
      confidence: 'explicit',
      source: 'return_statement'
    };
  }
  
  // self in methods
  if (var_name === 'self') {
    return {
      type_name: context.class_name || 'object',
      confidence: 'inferred',
      source: 'return_statement'
    };
  }
  
  // cls in class methods
  if (var_name === 'cls') {
    return {
      type_name: 'type',
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
 * Check for Python-specific patterns
 */
export function check_python_patterns(
  def: Def,
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // Special method return types
  const special_methods: { [key: string]: string } = {
    '__init__': 'None',
    '__str__': 'str',
    '__repr__': 'str',
    '__len__': 'int',
    '__bool__': 'bool',
    '__bytes__': 'bytes',
    '__hash__': 'int',
    '__enter__': 'self',
    '__exit__': 'bool',
    '__iter__': 'Iterator',
    '__next__': 'any',
    '__call__': 'any',
    '__getitem__': 'any',
    '__setitem__': 'None',
    '__delitem__': 'None',
    '__contains__': 'bool',
    '__eq__': 'bool',
    '__ne__': 'bool',
    '__lt__': 'bool',
    '__le__': 'bool',
    '__gt__': 'bool',
    '__ge__': 'bool'
  };
  
  if (def.name in special_methods) {
    let type_name = special_methods[def.name];
    
    // Replace 'self' with actual class name
    if (type_name === 'self') {
      type_name = context.class_name || get_enclosing_class_name(func_node) || 'object';
    }
    
    return {
      type_name,
      confidence: 'explicit',
      source: 'pattern'
    };
  }
  
  // Property decorators
  const decorators = func_node.childForFieldName('decorator_list');
  if (decorators) {
    for (let i = 0; i < decorators.childCount; i++) {
      const decorator = decorators.child(i);
      if (decorator && decorator.type === 'decorator') {
        const name = decorator.child(1); // Skip '@'
        if (name && name.text === 'property') {
          // Properties typically return the type they manage
          const prop_name = def.name;
          return {
            type_name: prop_name,
            confidence: 'heuristic',
            source: 'pattern'
          };
        }
      }
    }
  }
  
  // Async functions return coroutines
  if (is_async_function(func_node)) {
    const explicit_return = extract_python_return_type(func_node, context);
    if (explicit_return) {
      return explicit_return;
    }
    
    return {
      type_name: 'Coroutine',
      confidence: 'inferred',
      source: 'pattern'
    };
  }
  
  // Generator functions
  if (is_generator_function(func_node)) {
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
  // Check for async def
  const parent = func_node.parent;
  if (parent && parent.type === 'decorated_definition') {
    for (let i = 0; i < parent.childCount; i++) {
      const child = parent.child(i);
      if (child && child.type === 'async') {
        return true;
      }
    }
  }
  
  // Direct async keyword
  for (let i = 0; i < func_node.childCount; i++) {
    const child = func_node.child(i);
    if (child && child.type === 'async') {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if function is a generator
 */
function is_generator_function(func_node: SyntaxNode): boolean {
  const body = func_node.childForFieldName('body');
  if (body) {
    return contains_yield(body);
  }
  return false;
}

/**
 * Check if node contains yield statements
 */
function contains_yield(node: SyntaxNode): boolean {
  if (node.type === 'yield' || node.type === 'yield_statement') {
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