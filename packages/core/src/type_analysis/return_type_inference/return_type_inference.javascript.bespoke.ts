/**
 * JavaScript bespoke return type handlers
 * 
 * Handles JavaScript-specific features that cannot be expressed through configuration:
 * - JSDoc type annotations
 * - Constructor functions (pre-ES6)
 * - Prototype-based patterns
 * - CommonJS module patterns
 */

import { SyntaxNode } from 'tree-sitter';
import { ReturnTypeInfo, ReturnTypeContext } from './return_type_inference';

/**
 * Extract return type from JSDoc comments
 */
export function handle_javascript_jsdoc(
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // Look for JSDoc comment before the function
  const jsdoc = find_jsdoc_comment(func_node, context.source_code);
  
  if (!jsdoc) {
    return undefined;
  }
  
  // Parse @returns or @return tag
  const returns_match = jsdoc.match(/@returns?\s*\{([^}]+)\}/);
  if (returns_match) {
    const type_name = returns_match[1].trim();
    return {
      type_name: normalize_jsdoc_type(type_name),
      confidence: 'explicit',
      source: 'annotation',
      position: {
        row: func_node.startPosition.row - 1, // JSDoc is usually above
        column: 0
      }
    };
  }
  
  // Parse @type tag for function type
  const type_match = jsdoc.match(/@type\s*\{function\([^)]*\):([^}]+)\}/);
  if (type_match) {
    const return_type = type_match[1].trim();
    return {
      type_name: normalize_jsdoc_type(return_type),
      confidence: 'explicit',
      source: 'annotation'
    };
  }
  
  return undefined;
}

/**
 * Handle pre-ES6 constructor functions
 */
export function handle_javascript_constructor_function(
  func_node: SyntaxNode,
  func_name: string,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // Check if it's a constructor function (capitalized name)
  if (!func_name || !/^[A-Z]/.test(func_name)) {
    return undefined;
  }
  
  // Look for prototype assignments after the function
  const has_prototype = check_prototype_assignments(func_node, func_name, context);
  
  if (has_prototype) {
    return {
      type_name: func_name,
      confidence: 'inferred',
      source: 'pattern'
    };
  }
  
  // Check for 'this' assignments in the function body
  const has_this_assignments = check_this_assignments(func_node);
  
  if (has_this_assignments) {
    return {
      type_name: func_name,
      confidence: 'inferred',
      source: 'pattern'
    };
  }
  
  return undefined;
}

/**
 * Handle CommonJS module patterns
 */
export function handle_javascript_commonjs_patterns(
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // Check if function is assigned to module.exports or exports
  const parent = func_node.parent;
  
  if (parent && parent.type === 'assignment_expression') {
    const left = parent.childForFieldName('left');
    
    if (left) {
      const left_text = context.source_code.substring(left.startIndex, left.endIndex);
      
      // Factory function pattern
      if (left_text === 'module.exports' || left_text === 'exports') {
        // Look for return statements that return objects
        const returns = find_object_returns(func_node, context);
        if (returns.length > 0) {
          return {
            type_name: 'Module',
            confidence: 'inferred',
            source: 'pattern'
          };
        }
      }
    }
  }
  
  return undefined;
}

/**
 * Handle JavaScript class expressions and factories
 */
export function handle_javascript_class_factories(
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // Check if function returns a class
  const body = func_node.childForFieldName('body');
  if (!body) {
    return undefined;
  }
  
  // Look for return statements that return classes
  const returns = find_return_statements_in_body(body);
  
  for (const ret of returns) {
    const value = ret.childForFieldName('argument');
    if (value && value.type === 'class') {
      return {
        type_name: 'Class',
        confidence: 'explicit',
        source: 'return_statement'
      };
    }
  }
  
  return undefined;
}

/**
 * Handle JavaScript Promise patterns (before async/await)
 */
export function handle_javascript_promise_patterns(
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  const body = func_node.childForFieldName('body');
  if (!body) {
    return undefined;
  }
  
  // Check for Promise constructor pattern
  const returns = find_return_statements_in_body(body);
  
  for (const ret of returns) {
    const value = ret.childForFieldName('argument');
    if (value && value.type === 'new_expression') {
      const constructor = value.childForFieldName('constructor');
      if (constructor) {
        const ctor_text = context.source_code.substring(
          constructor.startIndex,
          constructor.endIndex
        );
        if (ctor_text === 'Promise') {
          return {
            type_name: 'Promise',
            confidence: 'explicit',
            source: 'return_statement'
          };
        }
      }
    }
  }
  
  // Check for .then() chains
  if (check_for_then_chains(body, context)) {
    return {
      type_name: 'Promise',
      confidence: 'inferred',
      source: 'pattern'
    };
  }
  
  return undefined;
}

// Helper functions

function find_jsdoc_comment(node: SyntaxNode, source_code: string): string | undefined {
  // Look for comment nodes before the function
  let current = node.previousSibling;
  
  while (current) {
    if (current.type === 'comment') {
      const comment_text = source_code.substring(current.startIndex, current.endIndex);
      // Check if it's a JSDoc comment (starts with /**)
      if (comment_text.startsWith('/**')) {
        return comment_text;
      }
    }
    // Stop if we hit another statement
    if (current.type !== 'comment') {
      break;
    }
    current = current.previousSibling;
  }
  
  return undefined;
}

function normalize_jsdoc_type(type_name: string): string {
  // Normalize common JSDoc type notations
  type_name = type_name.trim();
  
  // Convert JSDoc union notation to TypeScript style
  type_name = type_name.replace(/\|/g, ' | ');
  
  // Handle nullable types
  if (type_name.startsWith('?')) {
    type_name = type_name.substring(1) + ' | null';
  }
  
  // Handle non-nullable types
  if (type_name.startsWith('!')) {
    type_name = type_name.substring(1);
  }
  
  // Convert array notation
  type_name = type_name.replace(/Array\.<([^>]+)>/, '$1[]');
  
  return type_name;
}

function check_prototype_assignments(
  func_node: SyntaxNode,
  func_name: string,
  context: ReturnTypeContext
): boolean {
  // Look for patterns like: FunctionName.prototype.method = ...
  const parent = func_node.parent;
  if (!parent) {
    return false;
  }
  
  // Check siblings for prototype assignments
  for (let i = 0; i < parent.childCount; i++) {
    const sibling = parent.child(i);
    if (sibling && sibling.type === 'expression_statement') {
      const expr = sibling.child(0);
      if (expr && expr.type === 'assignment_expression') {
        const left = expr.childForFieldName('left');
        if (left) {
          const left_text = context.source_code.substring(left.startIndex, left.endIndex);
          if (left_text.startsWith(`${func_name}.prototype.`)) {
            return true;
          }
        }
      }
    }
  }
  
  return false;
}

function check_this_assignments(func_node: SyntaxNode): boolean {
  const body = func_node.childForFieldName('body');
  if (!body) {
    return false;
  }
  
  // Look for this.property = value patterns
  function has_this_assignment(node: SyntaxNode): boolean {
    if (node.type === 'assignment_expression') {
      const left = node.childForFieldName('left');
      if (left && left.type === 'member_expression') {
        const object = left.childForFieldName('object');
        if (object && object.type === 'this') {
          return true;
        }
      }
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && has_this_assignment(child)) {
        return true;
      }
    }
    
    return false;
  }
  
  return has_this_assignment(body);
}

function find_object_returns(
  func_node: SyntaxNode,
  context: ReturnTypeContext
): SyntaxNode[] {
  const returns: SyntaxNode[] = [];
  const body = func_node.childForFieldName('body');
  
  if (!body) {
    return returns;
  }
  
  function traverse(node: SyntaxNode) {
    if (node.type === 'return_statement') {
      const value = node.childForFieldName('argument');
      if (value && value.type === 'object') {
        returns.push(node);
      }
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        traverse(child);
      }
    }
  }
  
  traverse(body);
  return returns;
}

function find_return_statements_in_body(body: SyntaxNode): SyntaxNode[] {
  const returns: SyntaxNode[] = [];
  
  function traverse(node: SyntaxNode) {
    if (node.type === 'return_statement') {
      returns.push(node);
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        traverse(child);
      }
    }
  }
  
  traverse(body);
  return returns;
}

function check_for_then_chains(body: SyntaxNode, context: ReturnTypeContext): boolean {
  // Look for .then() method calls
  function has_then_call(node: SyntaxNode): boolean {
    if (node.type === 'call_expression') {
      const func = node.childForFieldName('function');
      if (func && func.type === 'member_expression') {
        const property = func.childForFieldName('property');
        if (property) {
          const prop_text = context.source_code.substring(
            property.startIndex,
            property.endIndex
          );
          if (prop_text === 'then' || prop_text === 'catch' || prop_text === 'finally') {
            return true;
          }
        }
      }
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && has_then_call(child)) {
        return true;
      }
    }
    
    return false;
  }
  
  return has_then_call(body);
}