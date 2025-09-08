/**
 * Python bespoke return type handlers
 * 
 * Handles Python-specific features that cannot be expressed through configuration:
 * - Docstring type annotations (Google, NumPy, Sphinx styles)
 * - Special methods (__init__, __str__, __repr__, etc.)
 * - List/Dict/Set comprehensions
 * - Context managers (__enter__, __exit__)
 */

import { SyntaxNode } from 'tree-sitter';
import { ReturnTypeInfo, ReturnTypeContext } from './return_type_inference';

/**
 * Extract return type from Python docstring
 */
export function handle_python_docstring_types(
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const body = func_node.childForFieldName('body');
  if (!body || body.childCount === 0) {
    return undefined;
  }
  
  // Look for docstring as first statement
  const first_stmt = body.child(0);
  if (!first_stmt) {
    return undefined;
  }
  
  let docstring_node: SyntaxNode | null = null;
  
  // Check if it's an expression statement containing a string
  if (first_stmt.type === 'expression_statement') {
    const expr = first_stmt.child(0);
    if (expr && (expr.type === 'string' || expr.type === 'concatenated_string')) {
      docstring_node = expr;
    }
  } else if (first_stmt.type === 'string' || first_stmt.type === 'concatenated_string') {
    docstring_node = first_stmt;
  }
  
  if (!docstring_node) {
    return undefined;
  }
  
  const docstring = context.source_code.substring(
    docstring_node.startIndex,
    docstring_node.endIndex
  );
  
  // Parse different docstring formats
  const google_type = parse_google_style_return(docstring);
  if (google_type) {
    return {
      type_name: google_type,
      confidence: 'explicit',
      source: 'docstring',
      position: {
        row: docstring_node.startPosition.row,
        column: docstring_node.startPosition.column
      }
    };
  }
  
  const numpy_type = parse_numpy_style_return(docstring);
  if (numpy_type) {
    return {
      type_name: numpy_type,
      confidence: 'explicit',
      source: 'docstring',
      position: {
        row: docstring_node.startPosition.row,
        column: docstring_node.startPosition.column
      }
    };
  }
  
  const sphinx_type = parse_sphinx_style_return(docstring);
  if (sphinx_type) {
    return {
      type_name: sphinx_type,
      confidence: 'explicit',
      source: 'docstring',
      position: {
        row: docstring_node.startPosition.row,
        column: docstring_node.startPosition.column
      }
    };
  }
  
  return undefined;
}

/**
 * Handle Python special methods with known return types
 */
export function handle_python_special_methods(
  method_name: string,
  class_name: string | undefined
): ReturnTypeInfo | undefined {
  // Special methods with known return types
  const special_methods: Record<string, string> = {
    '__init__': 'None',
    '__new__': class_name || 'Self',
    '__str__': 'str',
    '__repr__': 'str',
    '__bytes__': 'bytes',
    '__bool__': 'bool',
    '__int__': 'int',
    '__float__': 'float',
    '__complex__': 'complex',
    '__hash__': 'int',
    '__len__': 'int',
    '__length_hint__': 'int',
    '__iter__': 'Iterator',
    '__next__': 'Any',
    '__reversed__': 'Iterator',
    '__contains__': 'bool',
    '__enter__': class_name || 'Self',
    '__exit__': 'bool | None',
    '__await__': 'Generator',
    '__aiter__': 'AsyncIterator',
    '__anext__': 'Any',
    '__aenter__': class_name || 'Self',
    '__aexit__': 'bool | None'
  };
  
  if (method_name in special_methods) {
    return {
      type_name: special_methods[method_name],
      confidence: 'explicit',
      source: 'pattern'
    };
  }
  
  // Comparison methods
  if (method_name.match(/^__(eq|ne|lt|le|gt|ge)__$/)) {
    return {
      type_name: 'bool',
      confidence: 'explicit',
      source: 'pattern'
    };
  }
  
  // Arithmetic operators
  if (method_name.match(/^__(add|sub|mul|truediv|floordiv|mod|pow)__$/)) {
    return {
      type_name: class_name || 'Self',
      confidence: 'inferred',
      source: 'pattern'
    };
  }
  
  return undefined;
}

/**
 * Handle Python comprehensions that return specific types
 */
export function handle_python_comprehensions(
  expr_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  switch (expr_node.type) {
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
  }
  
  return undefined;
}

/**
 * Handle Python typing module special forms
 */
export function handle_python_typing_special_forms(
  type_text: string
): string | undefined {
  // Handle typing module special forms
  const special_forms: Record<string, string> = {
    'Literal': type_text,
    'TypedDict': 'dict',
    'NamedTuple': 'tuple',
    'Protocol': type_text,
    'TypeAlias': type_text,
    'NewType': type_text
  };
  
  for (const [form, replacement] of Object.entries(special_forms)) {
    if (type_text.startsWith(form + '[')) {
      return replacement;
    }
  }
  
  // Handle type variables
  if (type_text.match(/^TypeVar\(/)) {
    return 'TypeVar';
  }
  
  return undefined;
}

// Helper functions for docstring parsing

function parse_google_style_return(docstring: string): string | undefined {
  // Google style: Returns:\n    type: description
  const returns_match = docstring.match(/Returns?:\s*\n\s+(\w+(?:\[[\w\s,\[\]]+\])?)/);
  if (returns_match) {
    return returns_match[1];
  }
  
  // Alternative: Returns: type
  const inline_match = docstring.match(/Returns?:\s*(\w+(?:\[[\w\s,\[\]]+\])?)/);
  if (inline_match) {
    return inline_match[1];
  }
  
  return undefined;
}

function parse_numpy_style_return(docstring: string): string | undefined {
  // NumPy style: Returns\n-------\ntype
  const numpy_match = docstring.match(/Returns?\s*\n\s*-+\s*\n\s*(\w+(?:\[[\w\s,\[\]]+\])?)/);
  if (numpy_match) {
    return numpy_match[1];
  }
  
  return undefined;
}

function parse_sphinx_style_return(docstring: string): string | undefined {
  // Sphinx style: :return: description\n:rtype: type
  const rtype_match = docstring.match(/:rtype:\s*(\w+(?:\[[\w\s,\[\]]+\])?)/);
  if (rtype_match) {
    return rtype_match[1];
  }
  
  // Alternative: :returns: type
  const returns_match = docstring.match(/:returns?:\s*(\w+(?:\[[\w\s,\[\]]+\])?)/);
  if (returns_match) {
    return returns_match[1];
  }
  
  return undefined;
}