/**
 * TypeScript bespoke return type handlers
 * 
 * Handles TypeScript-specific features that cannot be expressed through configuration:
 * - Complex generic types with multiple parameters
 * - Conditional types
 * - Mapped types
 * - Template literal types
 * - Decorator return type modifications
 */

import { SyntaxNode } from 'tree-sitter';
import { ReturnTypeInfo, ReturnTypeContext } from './return_type_inference';

/**
 * Handle TypeScript decorators that might affect return types
 */
export function handle_typescript_decorators(
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // Check for decorators
  const decorators = find_decorators(func_node);
  
  for (const decorator of decorators) {
    const decorator_name = extract_decorator_name(decorator, context.source_code);
    
    // Common decorators that affect return types
    switch (decorator_name) {
      case 'Memoize':
      case 'Cache':
        // These don't change the return type
        continue;
        
      case 'AsyncMethod':
        // Wraps return in Promise
        return {
          type_name: 'Promise<unknown>',
          confidence: 'inferred',
          source: 'pattern'
        };
        
      case 'Returns':
        // Custom return type decorator
        const type_arg = extract_decorator_type_argument(decorator, context.source_code);
        if (type_arg) {
          return {
            type_name: type_arg,
            confidence: 'explicit',
            source: 'annotation'
          };
        }
        break;
    }
  }
  
  return undefined;
}

/**
 * Handle complex TypeScript generic types
 */
export function handle_typescript_complex_generics(
  type_node: SyntaxNode,
  context: ReturnTypeContext
): string | undefined {
  if (type_node.type !== 'generic_type') {
    return undefined;
  }
  
  const source_code = context.source_code;
  const type_text = source_code.substring(type_node.startIndex, type_node.endIndex);
  
  // Handle conditional types: T extends U ? X : Y
  if (type_text.includes(' extends ') && type_text.includes('?')) {
    return handle_conditional_type(type_text);
  }
  
  // Handle mapped types: { [K in keyof T]: ... }
  if (type_text.includes(' in ') && type_text.includes('keyof')) {
    return handle_mapped_type(type_text);
  }
  
  // Handle template literal types: `${string}`
  if (type_text.startsWith('`') && type_text.endsWith('`')) {
    return handle_template_literal_type(type_text);
  }
  
  // Return the raw generic type for other cases
  return type_text;
}

/**
 * Handle TypeScript utility types
 */
export function handle_typescript_utility_types(
  type_name: string,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // Common utility types that need special handling
  const utility_types = [
    'Partial', 'Required', 'Readonly', 'Record',
    'Pick', 'Omit', 'Exclude', 'Extract',
    'NonNullable', 'ReturnType', 'InstanceType',
    'Parameters', 'ConstructorParameters'
  ];
  
  // Check if it's a utility type
  for (const utility of utility_types) {
    if (type_name.startsWith(utility + '<')) {
      return {
        type_name,
        confidence: 'explicit',
        source: 'annotation'
      };
    }
  }
  
  return undefined;
}

/**
 * Handle TypeScript intersection and union types with proper precedence
 */
export function handle_typescript_composite_types(
  type_node: SyntaxNode,
  context: ReturnTypeContext
): string | undefined {
  const source_code = context.source_code;
  const type_text = source_code.substring(type_node.startIndex, type_node.endIndex);
  
  // Handle intersection types (A & B & C)
  if (type_node.type === 'intersection_type') {
    return format_intersection_type(type_text);
  }
  
  // Handle union types (A | B | C)
  if (type_node.type === 'union_type') {
    return format_union_type(type_text);
  }
  
  return undefined;
}

// Helper functions

function find_decorators(func_node: SyntaxNode): SyntaxNode[] {
  const decorators: SyntaxNode[] = [];
  
  // Look for decorator nodes before the function
  let current = func_node.previousSibling;
  while (current && current.type === 'decorator') {
    decorators.push(current);
    current = current.previousSibling;
  }
  
  return decorators;
}

function extract_decorator_name(decorator: SyntaxNode, source_code: string): string {
  const identifier = decorator.childForFieldName('name') ||
                    decorator.child(1); // Skip '@' symbol
  
  if (identifier) {
    return source_code.substring(identifier.startIndex, identifier.endIndex);
  }
  
  return '';
}

function extract_decorator_type_argument(decorator: SyntaxNode, source_code: string): string | undefined {
  const args = decorator.childForFieldName('arguments');
  if (args && args.childCount > 0) {
    const first_arg = args.child(1); // Skip '('
    if (first_arg) {
      return source_code.substring(first_arg.startIndex, first_arg.endIndex);
    }
  }
  return undefined;
}

function handle_conditional_type(type_text: string): string {
  // Simplify conditional types for display
  // T extends U ? X : Y -> "X | Y" (conservative approximation)
  const match = type_text.match(/\?(.+):(.+)$/);
  if (match) {
    const true_branch = match[1].trim();
    const false_branch = match[2].trim();
    return `${true_branch} | ${false_branch}`;
  }
  return type_text;
}

function handle_mapped_type(type_text: string): string {
  // Preserve mapped types as-is, they're already informative
  return type_text;
}

function handle_template_literal_type(type_text: string): string {
  // Template literal types are descriptive as-is
  return type_text;
}

function format_intersection_type(type_text: string): string {
  // Clean up intersection type formatting
  return type_text.replace(/\s*&\s*/g, ' & ');
}

function format_union_type(type_text: string): string {
  // Clean up union type formatting
  return type_text.replace(/\s*\|\s*/g, ' | ');
}