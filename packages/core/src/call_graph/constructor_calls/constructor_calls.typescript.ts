/**
 * TypeScript-specific bespoke constructor call features
 * 
 * This module handles TypeScript-specific constructor patterns that
 * cannot be expressed through configuration alone.
 */

import { SyntaxNode } from 'tree-sitter';
import { ConstructorCallInfo } from '@ariadnejs/types';
import { ConstructorCallContext } from './constructor_calls';

/**
 * Handle TypeScript generic type parameters in constructor calls
 * 
 * TypeScript allows generic type parameters in constructor calls like:
 * new Container<string>('hello')
 */
export function handle_generic_constructor(
  node: SyntaxNode,
  context: ConstructorCallContext
): ConstructorCallInfo | null {
  if (node.type !== 'new_expression') return null;
  
  const constructor = node.childForFieldName('constructor');
  if (!constructor) return null;
  
  // Check if constructor is a generic type (has type arguments)
  if (constructor.type === 'generic_type' || constructor.type === 'instantiation_expression') {
    const name = constructor.childForFieldName('name') || constructor.childForFieldName('function');
    const type_args = constructor.childForFieldName('type_arguments');
    
    if (!name) return null;
    
    // Extract the base constructor name
    let constructor_name: string;
    if (name.type === 'identifier') {
      constructor_name = context.source_code.substring(name.startIndex, name.endIndex);
    } else if (name.type === 'member_expression') {
      const property = name.childForFieldName('property');
      if (property) {
        constructor_name = context.source_code.substring(property.startIndex, property.endIndex);
      } else {
        return null;
      }
    } else {
      return null;
    }
    
    // Find assignment target
    let assigned_to: string | undefined;
    let current = node.parent;
    while (current) {
      if (current.type === 'variable_declarator') {
        const var_name = current.childForFieldName('name');
        if (var_name && var_name.type === 'identifier') {
          assigned_to = context.source_code.substring(var_name.startIndex, var_name.endIndex);
          break;
        }
      }
      if (current.type === 'expression_statement') break;
      current = current.parent;
    }
    
    // Count arguments
    const args = node.childForFieldName('arguments');
    let arg_count = 0;
    if (args) {
      for (let i = 0; i < args.childCount; i++) {
        const child = args.child(i);
        if (child && child.type !== '(' && child.type !== ')' && child.type !== ',') {
          arg_count++;
        }
      }
    }
    
    return {
      constructor_name,
      location: {
        line: node.startPosition.row,
        column: node.startPosition.column
      },
      arguments_count: arg_count,
      assigned_to,
      is_new_expression: true,
      is_factory_method: false
    };
  }
  
  return null;
}

/**
 * Handle TypeScript interface constructor signatures
 * 
 * TypeScript interfaces can define constructor signatures that
 * describe how objects should be constructed.
 */
export function extract_interface_constructor_signature(
  node: SyntaxNode,
  context: ConstructorCallContext
): { interface_name: string; constructor_params: number } | null {
  if (node.type !== 'interface_declaration') return null;
  
  const name = node.childForFieldName('name');
  if (!name) return null;
  
  const interface_name = context.source_code.substring(name.startIndex, name.endIndex);
  
  // Look for constructor signatures in the interface body
  const body = node.childForFieldName('body');
  if (!body) return null;
  
  for (let i = 0; i < body.childCount; i++) {
    const member = body.child(i);
    if (member && member.type === 'construct_signature') {
      // Count parameters
      const params = member.childForFieldName('parameters');
      let param_count = 0;
      if (params) {
        for (let j = 0; j < params.childCount; j++) {
          const param = params.child(j);
          if (param && param.type === 'required_parameter' || param?.type === 'optional_parameter') {
            param_count++;
          }
        }
      }
      
      return { interface_name, constructor_params: param_count };
    }
  }
  
  return null;
}

/**
 * Handle TypeScript abstract class instantiation detection
 * 
 * TypeScript prevents instantiation of abstract classes.
 * This function helps identify attempts to instantiate abstract classes.
 */
export function detect_abstract_class_instantiation(
  node: SyntaxNode,
  context: ConstructorCallContext
): { class_name: string; is_error: boolean } | null {
  if (node.type !== 'new_expression') return null;
  
  const constructor = node.childForFieldName('constructor');
  if (!constructor) return null;
  
  let class_name: string;
  if (constructor.type === 'identifier') {
    class_name = context.source_code.substring(constructor.startIndex, constructor.endIndex);
  } else {
    return null;
  }
  
  // To properly detect if a class is abstract, we'd need to look up
  // its declaration. This is a placeholder that could be enhanced
  // with type information from the broader context.
  
  // For now, return the class name for potential validation
  return { class_name, is_error: false };
}

/**
 * Handle TypeScript type assertions in constructor calls
 * 
 * TypeScript allows type assertions with constructor calls:
 * const obj = new MyClass() as MyInterface
 */
export function handle_constructor_with_type_assertion(
  node: SyntaxNode,
  context: ConstructorCallContext
): { constructor_info: ConstructorCallInfo; asserted_type: string } | null {
  if (node.type !== 'as_expression' && node.type !== 'type_assertion') return null;
  
  const expression = node.childForFieldName('expression') || node.childForFieldName('value');
  const type = node.childForFieldName('type');
  
  if (!expression || !type || expression.type !== 'new_expression') return null;
  
  // Extract constructor information from the new expression
  const constructor = expression.childForFieldName('constructor');
  if (!constructor) return null;
  
  let constructor_name: string;
  if (constructor.type === 'identifier') {
    constructor_name = context.source_code.substring(constructor.startIndex, constructor.endIndex);
  } else {
    return null;
  }
  
  // Extract the asserted type
  const asserted_type = context.source_code.substring(type.startIndex, type.endIndex);
  
  // Count arguments
  const args = expression.childForFieldName('arguments');
  let arg_count = 0;
  if (args) {
    for (let i = 0; i < args.childCount; i++) {
      const child = args.child(i);
      if (child && child.type !== '(' && child.type !== ')' && child.type !== ',') {
        arg_count++;
      }
    }
  }
  
  const constructor_info: ConstructorCallInfo = {
    constructor_name,
    location: {
      line: expression.startPosition.row,
      column: expression.startPosition.column
    },
    arguments_count: arg_count,
    is_new_expression: true,
    is_factory_method: false
  };
  
  return { constructor_info, asserted_type };
}