/**
 * TypeScript-specific type propagation
 * 
 * Handles TypeScript type flow patterns including:
 * - Static type annotations
 * - Type guards and narrowing
 * - Generic type propagation
 * - Interface and type alias resolution
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
 * Propagate types through TypeScript-specific constructs
 */
export function propagate_typescript_types(
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
    
    case 'lexical_declaration':
      flows = handle_lexical_declaration(node, context);
      break;
    
    case 'type_assertion':
    case 'as_expression':
      flows = handle_type_assertion(node, context);
      break;
    
    case 'satisfies_expression':
      flows = handle_satisfies_expression(node, context);
      break;
    
    case 'call_expression':
      flows = handle_typescript_call(node, context);
      break;
    
    case 'generic_type':
      flows = handle_generic_type(node, context);
      break;
    
    case 'conditional_type':
      flows = handle_conditional_type(node, context);
      break;
    
    case 'union_type':
    case 'intersection_type':
      flows = handle_composite_type(node, context);
      break;
  }
  
  // Handle type guards
  const guard_flows = handle_type_guards(node, context);
  flows = merge_type_flows(flows, guard_flows);
  
  return flows;
}

/**
 * Handle lexical declaration with type annotations
 */
function handle_lexical_declaration(
  decl_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  // Iterate through variable declarators
  for (let i = 0; i < decl_node.childCount; i++) {
    const child = decl_node.child(i);
    if (child && child.type === 'variable_declarator') {
      const name = child.childForFieldName('name');
      const type = child.childForFieldName('type');
      const value = child.childForFieldName('value');
      
      if (name && name.type === 'identifier') {
        const var_name = source_code.substring(name.startIndex, name.endIndex);
        
        // Explicit type annotation takes precedence
        if (type) {
          const type_text = extract_type_text(type, source_code);
          flows.push({
            source_type: type_text,
            target_identifier: var_name,
            flow_kind: 'assignment',
            confidence: 'explicit',
            position: {
              row: decl_node.startPosition.row,
              column: decl_node.startPosition.column
            }
          });
        } else if (value) {
          // Infer type from initializer
          const inferred_type = infer_expression_type(value, context);
          if (inferred_type) {
            flows.push({
              source_type: inferred_type,
              target_identifier: var_name,
              flow_kind: 'assignment',
              confidence: 'inferred',
              position: {
                row: decl_node.startPosition.row,
                column: decl_node.startPosition.column
              }
            });
          }
        }
      }
    }
  }
  
  return flows;
}

/**
 * Handle type assertion (as Type or <Type>)
 */
function handle_type_assertion(
  assertion_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  const type = assertion_node.childForFieldName('type');
  if (type) {
    const type_text = extract_type_text(type, source_code);
    
    // Check if assertion is assigned
    const parent = assertion_node.parent;
    if (parent && is_assignment_context(parent)) {
      const target = extract_assignment_target(parent, context);
      if (target) {
        flows.push({
          source_type: type_text,
          target_identifier: target,
          flow_kind: 'assignment',
          confidence: 'explicit',
          position: {
            row: assertion_node.startPosition.row,
            column: assertion_node.startPosition.column
          }
        });
      }
    }
  }
  
  return flows;
}

/**
 * Handle satisfies expression
 */
function handle_satisfies_expression(
  satisfies_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  const type = satisfies_node.childForFieldName('type');
  const expression = satisfies_node.childForFieldName('expression');
  
  if (type && expression) {
    const type_text = extract_type_text(type, source_code);
    
    // satisfies doesn't change the type but validates it
    // We can use it as a hint for type propagation
    const parent = satisfies_node.parent;
    if (parent && is_assignment_context(parent)) {
      const target = extract_assignment_target(parent, context);
      if (target) {
        flows.push({
          source_type: type_text,
          target_identifier: target,
          flow_kind: 'assignment',
          confidence: 'inferred',
          position: {
            row: satisfies_node.startPosition.row,
            column: satisfies_node.startPosition.column
          }
        });
      }
    }
  }
  
  return flows;
}

/**
 * Handle TypeScript function calls with generics
 */
function handle_typescript_call(
  call_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  const func = call_node.childForFieldName('function');
  const type_arguments = call_node.childForFieldName('type_arguments');
  
  if (func && type_arguments) {
    // Extract generic type arguments
    const generic_types: string[] = [];
    for (let i = 0; i < type_arguments.childCount; i++) {
      const type_arg = type_arguments.child(i);
      if (type_arg && type_arg.type !== ',' && type_arg.type !== '<' && type_arg.type !== '>') {
        generic_types.push(extract_type_text(type_arg, source_code));
      }
    }
    
    // Special handling for Array<T>, Promise<T>, etc.
    const func_name = source_code.substring(func.startIndex, func.endIndex);
    if (generic_types.length > 0) {
      const constructed_type = `${func_name}<${generic_types.join(', ')}>`;
      
      const parent = call_node.parent;
      if (parent && is_assignment_context(parent)) {
        const target = extract_assignment_target(parent, context);
        if (target) {
          flows.push({
            source_type: constructed_type,
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
  
  return flows;
}

/**
 * Handle generic type instantiation
 */
function handle_generic_type(
  generic_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  const name = generic_node.childForFieldName('name');
  const type_arguments = generic_node.childForFieldName('type_arguments');
  
  if (name && type_arguments) {
    const base_type = source_code.substring(name.startIndex, name.endIndex);
    const args_text = source_code.substring(type_arguments.startIndex, type_arguments.endIndex);
    const full_type = `${base_type}${args_text}`;
    
    const parent = generic_node.parent;
    if (parent && is_assignment_context(parent)) {
      const target = extract_assignment_target(parent, context);
      if (target) {
        flows.push({
          source_type: full_type,
          target_identifier: target,
          flow_kind: 'assignment',
          confidence: 'explicit',
          position: {
            row: generic_node.startPosition.row,
            column: generic_node.startPosition.column
          }
        });
      }
    }
  }
  
  return flows;
}

/**
 * Handle conditional types
 */
function handle_conditional_type(
  cond_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  const condition = cond_node.childForFieldName('condition');
  const consequence = cond_node.childForFieldName('consequence');
  const alternative = cond_node.childForFieldName('alternative');
  
  if (condition && consequence && alternative) {
    // For now, we'll conservatively use the union of both branches
    const cons_type = extract_type_text(consequence, source_code);
    const alt_type = extract_type_text(alternative, source_code);
    const union_type = `${cons_type} | ${alt_type}`;
    
    const parent = cond_node.parent;
    if (parent && is_assignment_context(parent)) {
      const target = extract_assignment_target(parent, context);
      if (target) {
        flows.push({
          source_type: union_type,
          target_identifier: target,
          flow_kind: 'assignment',
          confidence: 'inferred',
          position: {
            row: cond_node.startPosition.row,
            column: cond_node.startPosition.column
          }
        });
      }
    }
  }
  
  return flows;
}

/**
 * Handle union and intersection types
 */
function handle_composite_type(
  comp_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  const full_type = source_code.substring(comp_node.startIndex, comp_node.endIndex);
  
  const parent = comp_node.parent;
  if (parent && is_assignment_context(parent)) {
    const target = extract_assignment_target(parent, context);
    if (target) {
      flows.push({
        source_type: full_type,
        target_identifier: target,
        flow_kind: 'assignment',
        confidence: 'explicit',
        position: {
          row: comp_node.startPosition.row,
          column: comp_node.startPosition.column
        }
      });
    }
  }
  
  return flows;
}

/**
 * Handle TypeScript type guards
 */
function handle_type_guards(
  node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  if (node.type === 'if_statement') {
    const condition = node.childForFieldName('condition');
    if (condition) {
      // Check for type predicates (is keyword)
      const type_predicate = extract_type_predicate(condition, context);
      if (type_predicate) {
        flows.push({
          source_type: type_predicate.type,
          target_identifier: type_predicate.variable,
          flow_kind: 'narrowing',
          confidence: 'explicit',
          position: {
            row: condition.startPosition.row,
            column: condition.startPosition.column
          }
        });
      }
      
      // Check for in operator (property existence)
      const in_check = extract_in_operator_check(condition, context);
      if (in_check) {
        flows.push({
          source_type: `{ ${in_check.property}: any }`,
          target_identifier: in_check.variable,
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
 * Extract type predicate from condition
 */
function extract_type_predicate(
  condition: SyntaxNode,
  context: TypePropagationContext
): { variable: string; type: string } | undefined {
  const { source_code } = context;
  
  // Look for function calls that might be type guards
  if (condition.type === 'call_expression') {
    const func = condition.childForFieldName('function');
    const args = condition.childForFieldName('arguments');
    
    if (func && args) {
      const func_name = source_code.substring(func.startIndex, func.endIndex);
      
      // Check for common type guard patterns
      if (func_name.startsWith('is') && args.childCount > 1) {
        const first_arg = args.child(1); // Skip opening paren
        if (first_arg && first_arg.type === 'identifier') {
          const variable = source_code.substring(first_arg.startIndex, first_arg.endIndex);
          // Infer type from function name (e.g., isString -> string)
          const type = func_name.substring(2).toLowerCase();
          return { variable, type };
        }
      }
    }
  }
  
  return undefined;
}

/**
 * Extract in operator check
 */
function extract_in_operator_check(
  condition: SyntaxNode,
  context: TypePropagationContext
): { variable: string; property: string } | undefined {
  const { source_code } = context;
  
  if (condition.type === 'binary_expression') {
    const operator = condition.childForFieldName('operator');
    
    if (operator && operator.text === 'in') {
      const left = condition.childForFieldName('left');
      const right = condition.childForFieldName('right');
      
      if (left && right && left.type === 'string' && right.type === 'identifier') {
        const property = source_code.substring(left.startIndex + 1, left.endIndex - 1);
        const variable = source_code.substring(right.startIndex, right.endIndex);
        return { variable, property };
      }
    }
  }
  
  return undefined;
}

/**
 * Extract type text from type node
 */
function extract_type_text(type_node: SyntaxNode, source_code: string): string {
  // Remove leading colon if present
  const text = source_code.substring(type_node.startIndex, type_node.endIndex);
  return text.replace(/^:\s*/, '');
}

/**
 * Check if node is in assignment context
 */
function is_assignment_context(node: SyntaxNode): boolean {
  return node.type === 'variable_declarator' ||
         node.type === 'assignment_expression' ||
         node.type === 'lexical_declaration' ||
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
 * Handle TypeScript-specific utility types
 */
export function handle_utility_types(
  type_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  if (type_node.type === 'generic_type') {
    const name = type_node.childForFieldName('name');
    if (name) {
      const type_name = source_code.substring(name.startIndex, name.endIndex);
      
      // Handle common utility types
      const utility_types = [
        'Partial', 'Required', 'Readonly', 'Record', 'Pick', 'Omit',
        'Exclude', 'Extract', 'NonNullable', 'ReturnType', 'InstanceType',
        'Parameters', 'ConstructorParameters', 'ThisParameterType',
        'OmitThisParameter', 'ThisType', 'Uppercase', 'Lowercase',
        'Capitalize', 'Uncapitalize'
      ];
      
      if (utility_types.includes(type_name)) {
        const full_type = source_code.substring(type_node.startIndex, type_node.endIndex);
        
        const parent = type_node.parent;
        if (parent && is_assignment_context(parent)) {
          const target = extract_assignment_target(parent, context);
          if (target) {
            flows.push({
              source_type: full_type,
              target_identifier: target,
              flow_kind: 'assignment',
              confidence: 'explicit',
              position: {
                row: type_node.startPosition.row,
                column: type_node.startPosition.column
              }
            });
          }
        }
      }
    }
  }
  
  return flows;
}