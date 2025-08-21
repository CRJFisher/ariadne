/**
 * JavaScript-specific type propagation
 * 
 * Handles JavaScript type flow patterns including:
 * - Dynamic typing
 * - Type coercion
 * - Prototype chain propagation
 * - Closure type capture
 */

// TODO: Module Graph - Propagate types across module boundaries

import { SyntaxNode } from 'tree-sitter';
import {
  TypeFlow,
  PropagationPath,
  TypePropagationContext,
  propagate_assignment_types,
  propagate_return_types,
  propagate_parameter_types,
  propagate_property_types,
  infer_expression_type,
  merge_type_flows
} from './type_propagation';

/**
 * Propagate types through JavaScript-specific constructs
 */
export function propagate_javascript_types(
  node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  let flows: TypeFlow[] = [];
  
  // Handle different node types
  switch (node.type) {
    case 'variable_declarator':
    case 'assignment_expression':
      flows = propagate_assignment_types(node, context);
      break;
    
    case 'call_expression':
      flows = handle_javascript_call(node, context);
      break;
    
    case 'member_expression':
      flows = handle_javascript_member_access(node, context);
      break;
    
    case 'conditional_expression':
    case 'ternary_expression':
      flows = handle_ternary_expression(node, context);
      break;
    
    case 'logical_expression':
      flows = handle_logical_expression(node, context);
      break;
    
    case 'array_expression':
      flows = handle_array_expression(node, context);
      break;
    
    case 'object_expression':
      flows = handle_object_expression(node, context);
      break;
  }
  
  // Handle type narrowing in control flow
  const narrowing_flows = handle_type_narrowing(node, context);
  flows = merge_type_flows(flows, narrowing_flows);
  
  return flows;
}

/**
 * Handle JavaScript function calls
 */
function handle_javascript_call(
  call_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  const func = call_node.childForFieldName('function');
  if (func) {
    const func_name = source_code.substring(func.startIndex, func.endIndex);
    
    // Handle known type conversion functions
    if (is_type_conversion_function(func_name)) {
      const conversion_type = get_conversion_type(func_name);
      if (conversion_type) {
        // Check if result is assigned
        const parent = call_node.parent;
        if (parent && is_assignment_context(parent)) {
          const target = extract_assignment_target(parent, context);
          if (target) {
            flows.push({
              source_type: conversion_type,
              target_identifier: target,
              flow_kind: 'return',
              confidence: 'explicit',
              position: {
                row: call_node.startPosition.row,
                column: call_node.startPosition.column
              }
            });
          }
        }
      }
    }
    
    // Handle array methods that preserve types
    if (func.type === 'member_expression') {
      const property = func.childForFieldName('property');
      if (property) {
        const method_name = source_code.substring(property.startIndex, property.endIndex);
        if (is_array_method(method_name)) {
          flows.push(...handle_array_method(call_node, method_name, context));
        }
      }
    }
  }
  
  return flows;
}

/**
 * Handle member access propagation
 */
function handle_javascript_member_access(
  member_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  const object = member_node.childForFieldName('object');
  const property = member_node.childForFieldName('property');
  
  if (object && property) {
    const prop_name = source_code.substring(property.startIndex, property.endIndex);
    
    // Handle known property patterns
    if (prop_name === 'length') {
      // length property returns number
      const parent = member_node.parent;
      if (parent && is_assignment_context(parent)) {
        const target = extract_assignment_target(parent, context);
        if (target) {
          flows.push({
            source_type: 'number',
            target_identifier: target,
            flow_kind: 'property',
            confidence: 'explicit',
            position: {
              row: member_node.startPosition.row,
              column: member_node.startPosition.column
            }
          });
        }
      }
    }
    
    // Handle prototype properties
    if (prop_name === 'constructor' || prop_name === 'prototype') {
      // These return Function or Object types
      const type = prop_name === 'constructor' ? 'Function' : 'Object';
      const parent = member_node.parent;
      if (parent && is_assignment_context(parent)) {
        const target = extract_assignment_target(parent, context);
        if (target) {
          flows.push({
            source_type: type,
            target_identifier: target,
            flow_kind: 'property',
            confidence: 'inferred',
            position: {
              row: member_node.startPosition.row,
              column: member_node.startPosition.column
            }
          });
        }
      }
    }
  }
  
  return flows;
}

/**
 * Handle ternary expression type propagation
 */
function handle_ternary_expression(
  ternary_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  const consequent = ternary_node.childForFieldName('consequent');
  const alternate = ternary_node.childForFieldName('alternate');
  
  if (consequent && alternate) {
    const consequent_type = infer_expression_type(consequent, context);
    const alternate_type = infer_expression_type(alternate, context);
    
    // If both branches have the same type, propagate it
    if (consequent_type && consequent_type === alternate_type) {
      const parent = ternary_node.parent;
      if (parent && is_assignment_context(parent)) {
        const target = extract_assignment_target(parent, context);
        if (target) {
          flows.push({
            source_type: consequent_type,
            target_identifier: target,
            flow_kind: 'assignment',
            confidence: 'inferred',
            position: {
              row: ternary_node.startPosition.row,
              column: ternary_node.startPosition.column
            }
          });
        }
      }
    }
  }
  
  return flows;
}

/**
 * Handle logical expression type propagation
 */
function handle_logical_expression(
  logical_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  const operator = logical_node.childForFieldName('operator');
  if (operator) {
    const op = operator.text;
    
    // Comparison operators always return boolean
    if (['<', '>', '<=', '>=', '==', '!=', '===', '!=='].includes(op)) {
      const parent = logical_node.parent;
      if (parent && is_assignment_context(parent)) {
        const target = extract_assignment_target(parent, context);
        if (target) {
          flows.push({
            source_type: 'boolean',
            target_identifier: target,
            flow_kind: 'assignment',
            confidence: 'explicit',
            position: {
              row: logical_node.startPosition.row,
              column: logical_node.startPosition.column
            }
          });
        }
      }
    }
  }
  
  return flows;
}

/**
 * Handle array expression type propagation
 */
function handle_array_expression(
  array_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  const parent = array_node.parent;
  if (parent && is_assignment_context(parent)) {
    const target = extract_assignment_target(parent, context);
    if (target) {
      flows.push({
        source_type: 'Array',
        target_identifier: target,
        flow_kind: 'assignment',
        confidence: 'explicit',
        position: {
          row: array_node.startPosition.row,
          column: array_node.startPosition.column
        }
      });
    }
  }
  
  return flows;
}

/**
 * Handle object expression type propagation
 */
function handle_object_expression(
  object_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  const parent = object_node.parent;
  if (parent && is_assignment_context(parent)) {
    const target = extract_assignment_target(parent, context);
    if (target) {
      flows.push({
        source_type: 'Object',
        target_identifier: target,
        flow_kind: 'assignment',
        confidence: 'explicit',
        position: {
          row: object_node.startPosition.row,
          column: object_node.startPosition.column
        }
      });
    }
  }
  
  return flows;
}

/**
 * Handle type narrowing in control flow
 */
function handle_type_narrowing(
  node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  if (node.type === 'if_statement') {
    const condition = node.childForFieldName('condition');
    if (condition) {
      // Check for typeof checks
      const typeof_check = extract_typeof_check(condition, context);
      if (typeof_check) {
        flows.push({
          source_type: typeof_check.type,
          target_identifier: typeof_check.variable,
          flow_kind: 'narrowing',
          confidence: 'explicit',
          position: {
            row: condition.startPosition.row,
            column: condition.startPosition.column
          }
        });
      }
      
      // Check for instanceof checks
      const instanceof_check = extract_instanceof_check(condition, context);
      if (instanceof_check) {
        flows.push({
          source_type: instanceof_check.type,
          target_identifier: instanceof_check.variable,
          flow_kind: 'narrowing',
          confidence: 'explicit',
          position: {
            row: condition.startPosition.row,
            column: condition.startPosition.column
          }
        });
      }
      
      // Check for null/undefined checks
      const null_check = extract_null_check(condition, context);
      if (null_check) {
        flows.push({
          source_type: null_check.negated ? 'defined' : 'null | undefined',
          target_identifier: null_check.variable,
          flow_kind: 'narrowing',
          confidence: 'inferred',
          position: {
            row: condition.startPosition.row,
            column: condition.startPosition.column
          }
        });
      }
    }
  }
  
  return flows;
}

/**
 * Extract typeof check from condition
 */
function extract_typeof_check(
  condition: SyntaxNode,
  context: TypePropagationContext
): { variable: string; type: string } | undefined {
  const { source_code } = context;
  
  if (condition.type === 'binary_expression') {
    const left = condition.childForFieldName('left');
    const right = condition.childForFieldName('right');
    const operator = condition.childForFieldName('operator');
    
    if (left && right && operator && operator.text === '===') {
      // Check for typeof x === 'string'
      if (left.type === 'unary_expression') {
        const op = left.childForFieldName('operator');
        const argument = left.childForFieldName('argument');
        
        if (op && op.text === 'typeof' && argument && argument.type === 'identifier') {
          const variable = source_code.substring(argument.startIndex, argument.endIndex);
          if (right.type === 'string') {
            const type_string = source_code.substring(right.startIndex + 1, right.endIndex - 1);
            return { variable, type: type_string };
          }
        }
      }
    }
  }
  
  return undefined;
}

/**
 * Extract instanceof check from condition
 */
function extract_instanceof_check(
  condition: SyntaxNode,
  context: TypePropagationContext
): { variable: string; type: string } | undefined {
  const { source_code } = context;
  
  if (condition.type === 'binary_expression') {
    const left = condition.childForFieldName('left');
    const right = condition.childForFieldName('right');
    const operator = condition.childForFieldName('operator');
    
    if (left && right && operator && operator.text === 'instanceof') {
      if (left.type === 'identifier' && right.type === 'identifier') {
        const variable = source_code.substring(left.startIndex, left.endIndex);
        const type = source_code.substring(right.startIndex, right.endIndex);
        return { variable, type };
      }
    }
  }
  
  return undefined;
}

/**
 * Extract null/undefined check from condition
 */
function extract_null_check(
  condition: SyntaxNode,
  context: TypePropagationContext
): { variable: string; negated: boolean } | undefined {
  const { source_code } = context;
  
  // Check for x != null or x !== null
  if (condition.type === 'binary_expression') {
    const left = condition.childForFieldName('left');
    const right = condition.childForFieldName('right');
    const operator = condition.childForFieldName('operator');
    
    if (left && right && operator) {
      const op = operator.text;
      if ((op === '!=' || op === '!==') && right.type === 'null') {
        if (left.type === 'identifier') {
          const variable = source_code.substring(left.startIndex, left.endIndex);
          return { variable, negated: true };
        }
      } else if ((op === '==' || op === '===') && right.type === 'null') {
        if (left.type === 'identifier') {
          const variable = source_code.substring(left.startIndex, left.endIndex);
          return { variable, negated: false };
        }
      }
    }
  }
  
  // Check for !x (falsy check)
  if (condition.type === 'unary_expression') {
    const operator = condition.childForFieldName('operator');
    const argument = condition.childForFieldName('argument');
    
    if (operator && operator.text === '!' && argument && argument.type === 'identifier') {
      const variable = source_code.substring(argument.startIndex, argument.endIndex);
      return { variable, negated: false };
    }
  }
  
  return undefined;
}

/**
 * Check if node is in assignment context
 */
function is_assignment_context(node: SyntaxNode): boolean {
  return node.type === 'variable_declarator' ||
         node.type === 'assignment_expression' ||
         (node.parent !== null && is_assignment_context(node.parent));
}

/**
 * Extract assignment target from parent context
 */
function extract_assignment_target(
  node: SyntaxNode,
  context: TypePropagationContext
): string | undefined {
  const { source_code } = context;
  
  if (node.type === 'variable_declarator') {
    const name = node.childForFieldName('name');
    if (name && name.type === 'identifier') {
      return source_code.substring(name.startIndex, name.endIndex);
    }
  } else if (node.type === 'assignment_expression') {
    const left = node.childForFieldName('left');
    if (left && left.type === 'identifier') {
      return source_code.substring(left.startIndex, left.endIndex);
    }
  } else if (node.parent) {
    return extract_assignment_target(node.parent, context);
  }
  
  return undefined;
}

/**
 * Check if function is a type conversion
 */
function is_type_conversion_function(name: string): boolean {
  return ['String', 'Number', 'Boolean', 'Array', 'Object'].includes(name);
}

/**
 * Get type from conversion function
 */
function get_conversion_type(func_name: string): string | undefined {
  const type_map: Record<string, string> = {
    'String': 'string',
    'Number': 'number',
    'Boolean': 'boolean',
    'Array': 'Array',
    'Object': 'Object'
  };
  return type_map[func_name];
}

/**
 * Check if method is an array method
 */
function is_array_method(method: string): boolean {
  return ['map', 'filter', 'reduce', 'forEach', 'find', 'findIndex',
          'some', 'every', 'includes', 'indexOf', 'slice', 'concat',
          'push', 'pop', 'shift', 'unshift', 'sort', 'reverse'].includes(method);
}

/**
 * Handle array method type propagation
 */
function handle_array_method(
  call_node: SyntaxNode,
  method_name: string,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  // Methods that return arrays
  const array_returning = ['map', 'filter', 'slice', 'concat', 'sort', 'reverse'];
  if (array_returning.includes(method_name)) {
    const parent = call_node.parent;
    if (parent && is_assignment_context(parent)) {
      const target = extract_assignment_target(parent, context);
      if (target) {
        flows.push({
          source_type: 'Array',
          target_identifier: target,
          flow_kind: 'return',
          confidence: 'explicit',
          position: {
            row: call_node.startPosition.row,
            column: call_node.startPosition.column
          }
        });
      }
    }
  }
  
  // Methods that return booleans
  const boolean_returning = ['some', 'every', 'includes'];
  if (boolean_returning.includes(method_name)) {
    const parent = call_node.parent;
    if (parent && is_assignment_context(parent)) {
      const target = extract_assignment_target(parent, context);
      if (target) {
        flows.push({
          source_type: 'boolean',
          target_identifier: target,
          flow_kind: 'return',
          confidence: 'explicit',
          position: {
            row: call_node.startPosition.row,
            column: call_node.startPosition.column
          }
        });
      }
    }
  }
  
  // Methods that return numbers
  const number_returning = ['indexOf', 'findIndex', 'push', 'unshift'];
  if (number_returning.includes(method_name)) {
    const parent = call_node.parent;
    if (parent && is_assignment_context(parent)) {
      const target = extract_assignment_target(parent, context);
      if (target) {
        flows.push({
          source_type: 'number',
          target_identifier: target,
          flow_kind: 'return',
          confidence: 'explicit',
          position: {
            row: call_node.startPosition.row,
            column: call_node.startPosition.column
          }
        });
      }
    }
  }
  
  return flows;
}

/**
 * Handle closure type capture
 */
export function handle_closure_capture(
  closure_node: SyntaxNode,
  captured_types: Map<string, string>,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  // Find all identifiers in the closure that reference captured variables
  function find_captured_references(node: SyntaxNode) {
    if (node.type === 'identifier') {
      const name = source_code.substring(node.startIndex, node.endIndex);
      const captured_type = captured_types.get(name);
      if (captured_type) {
        flows.push({
          source_type: captured_type,
          target_identifier: name,
          flow_kind: 'assignment',
          confidence: 'inferred',
          position: {
            row: node.startPosition.row,
            column: node.startPosition.column
          }
        });
      }
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        find_captured_references(child);
      }
    }
  }
  
  find_captured_references(closure_node);
  return flows;
}