/**
 * Common constructor call detection logic
 * 
 * Provides shared functionality for detecting constructor calls across languages
 */

import { SyntaxNode } from 'tree-sitter';
import { Language } from '@ariadnejs/types';

export interface ConstructorCallContext {
  source_code: string;
  file_path: string;
  language: Language;
  ast_root: SyntaxNode;
}

/**
 * Common logic for detecting if a node is a constructor call
 */
export function is_constructor_call_node(node: SyntaxNode, language: Language): boolean {
  switch (language) {
    case 'javascript':
    case 'typescript':
      // new ClassName()
      return node.type === 'new_expression';
    
    case 'python':
      // ClassName() - need to check if calling a class
      if (node.type === 'call') {
        const func = node.childForFieldName('func');
        if (func && func.type === 'identifier') {
          // Heuristic: capitalized names are likely classes
          const name = func.text;
          return /^[A-Z]/.test(name);
        }
      }
      return false;
    
    case 'rust':
      // Type::new() or Type { fields }
      if (node.type === 'call_expression') {
        const func = node.childForFieldName('function');
        if (func && func.type === 'scoped_identifier') {
          const name = func.childForFieldName('name');
          if (name && name.text === 'new') {
            return true;
          }
        }
      }
      // Struct literal: StructName { field: value }
      if (node.type === 'struct_expression') {
        return true;
      }
      return false;
    
    default:
      return false;
  }
}

/**
 * Extract the constructor/class name from a constructor call
 */
export function extract_constructor_name(
  node: SyntaxNode,
  source: string,
  language: Language
): string | null {
  switch (language) {
    case 'javascript':
    case 'typescript':
      if (node.type === 'new_expression') {
        const constructor = node.childForFieldName('constructor');
        if (constructor) {
          // Handle simple identifier: new ClassName()
          if (constructor.type === 'identifier') {
            return source.substring(constructor.startIndex, constructor.endIndex);
          }
          // Handle member expression: new namespace.ClassName()
          if (constructor.type === 'member_expression') {
            const property = constructor.childForFieldName('property');
            if (property) {
              return source.substring(property.startIndex, property.endIndex);
            }
          }
        }
      }
      break;
    
    case 'python':
      if (node.type === 'call') {
        const func = node.childForFieldName('func');
        if (func) {
          // Simple class name
          if (func.type === 'identifier') {
            return source.substring(func.startIndex, func.endIndex);
          }
          // Module.ClassName
          if (func.type === 'attribute') {
            const attr = func.childForFieldName('attr');
            if (attr) {
              return source.substring(attr.startIndex, attr.endIndex);
            }
          }
        }
      }
      break;
    
    case 'rust':
      if (node.type === 'call_expression') {
        const func = node.childForFieldName('function');
        if (func && func.type === 'scoped_identifier') {
          const path = func.childForFieldName('path');
          if (path) {
            return source.substring(path.startIndex, path.endIndex);
          }
        }
      }
      if (node.type === 'struct_expression') {
        const name = node.childForFieldName('name');
        if (name) {
          return source.substring(name.startIndex, name.endIndex);
        }
      }
      break;
  }
  
  return null;
}

/**
 * Find the variable that a constructor result is assigned to
 */
export function find_assignment_target(
  node: SyntaxNode,
  source: string,
  language: Language
): string | null {
  let current = node.parent;
  
  while (current) {
    // JavaScript/TypeScript variable declaration
    if (current.type === 'variable_declarator') {
      const name = current.childForFieldName('name');
      if (name && name.type === 'identifier') {
        return source.substring(name.startIndex, name.endIndex);
      }
    }
    
    // Assignment expression (all languages)
    if (current.type === 'assignment_expression' || current.type === 'assignment') {
      const left = current.childForFieldName('left') || current.child(0);
      if (left && left.type === 'identifier') {
        return source.substring(left.startIndex, left.endIndex);
      }
    }
    
    // Rust let binding
    if (current.type === 'let_declaration') {
      const pattern = current.childForFieldName('pattern');
      if (pattern) {
        if (pattern.type === 'identifier') {
          return source.substring(pattern.startIndex, pattern.endIndex);
        }
        // Handle mutable bindings: let mut x
        if (pattern.type === 'mutable_specifier') {
          const ident = pattern.nextSibling;
          if (ident && ident.type === 'identifier') {
            return source.substring(ident.startIndex, ident.endIndex);
          }
        }
      }
    }
    
    // Stop at statement boundaries
    if (is_statement_node(current)) {
      break;
    }
    
    current = current.parent;
  }
  
  return null;
}

/**
 * Check if a node is a statement (boundary for assignment search)
 */
function is_statement_node(node: SyntaxNode): boolean {
  const statement_types = [
    'expression_statement',
    'return_statement',
    'if_statement',
    'while_statement',
    'for_statement',
    'block',
    'function_declaration',
    'class_declaration',
    'function_definition',
    'class_definition'
  ];
  
  return statement_types.includes(node.type);
}

/**
 * Count arguments in a constructor call
 */
export function count_constructor_arguments(
  node: SyntaxNode,
  language: Language
): number {
  let args_node: SyntaxNode | null = null;
  
  switch (language) {
    case 'javascript':
    case 'typescript':
      if (node.type === 'new_expression') {
        args_node = node.childForFieldName('arguments');
      }
      break;
    
    case 'python':
    case 'rust':
      if (node.type === 'call' || node.type === 'call_expression') {
        args_node = node.childForFieldName('arguments');
      }
      break;
  }
  
  if (!args_node) return 0;
  
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
 * Check if constructor call uses 'new' keyword
 */
export function uses_new_keyword(
  node: SyntaxNode,
  language: Language
): boolean {
  return (language === 'javascript' || language === 'typescript') && 
         node.type === 'new_expression';
}

/**
 * Check if it's a factory method pattern (e.g., Type::new())
 */
export function is_factory_method_pattern(
  node: SyntaxNode,
  source: string,
  language: Language
): boolean {
  if (language === 'rust' && node.type === 'call_expression') {
    const func = node.childForFieldName('function');
    if (func && func.type === 'scoped_identifier') {
      const name = func.childForFieldName('name');
      if (name) {
        const method_name = source.substring(name.startIndex, name.endIndex);
        // Common factory method names
        return ['new', 'create', 'from', 'build', 'default'].includes(method_name);
      }
    }
  }
  
  // Python class methods that act as factories
  if (language === 'python' && node.type === 'call') {
    const func = node.childForFieldName('func');
    if (func && func.type === 'attribute') {
      const attr = func.childForFieldName('attr');
      if (attr) {
        const method_name = source.substring(attr.startIndex, attr.endIndex);
        // Common factory method names in Python
        return ['create', 'from_dict', 'from_json', 'build'].includes(method_name);
      }
    }
  }
  
  return false;
}

