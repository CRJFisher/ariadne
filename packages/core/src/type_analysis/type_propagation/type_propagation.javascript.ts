/**
 * JavaScript-specific bespoke type propagation features
 * 
 * This file contains only features unique to JavaScript that cannot be
 * expressed through configuration:
 * - Closure type capture
 * - Dynamic type coercion
 * - Prototype chain propagation
 */

import { SyntaxNode } from 'tree-sitter';
import { TypeFlow } from '@ariadnejs/types';
import {
  TypePropagationContext,
  propagate_assignment_types,
  propagate_property_types,
  merge_type_flows
} from './type_propagation';
import {
  getTypePropagationConfig,
  isAssignmentNode,
  isDeclarationNode,
  isCallNode,
  isMemberAccessNode,
  isNarrowingNode
} from './language_configs';

/**
 * Main entry point for JavaScript type propagation
 */
export function propagate_javascript_types(
  node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  let flows: TypeFlow[] = [];
  const config = getTypePropagationConfig(context.language);
  
  // Use generic propagation for common patterns
  if (isAssignmentNode(node.type, context.language) || 
      isDeclarationNode(node.type, context.language)) {
    flows = propagate_assignment_types(node, context);
  } else if (isMemberAccessNode(node.type, context.language)) {
    flows = propagate_property_types(node, context);
  }
  
  // Handle JavaScript-specific patterns
  if (node.type === 'function_expression' || node.type === 'arrow_function') {
    const closure_flows = handle_closure_capture(node, context);
    flows = merge_type_flows(flows, closure_flows);
  }
  
  // Handle type narrowing in control flow
  if (isNarrowingNode(node.type, context.language)) {
    const narrowing_flows = handle_type_narrowing(node, context);
    flows = merge_type_flows(flows, narrowing_flows);
  }
  
  return flows;
}

/**
 * Handle closure type capture (JavaScript-specific)
 * 
 * Closures in JavaScript capture variables from outer scopes,
 * which affects type propagation.
 */
export function handle_closure_capture(
  closure_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  // Find captured variables in closure body
  const body = closure_node.childForFieldName('body');
  if (!body) return flows;
  
  function find_captured_variables(node: SyntaxNode, local_vars: Set<string>) {
    if (node.type === 'identifier') {
      const name = source_code.substring(node.startIndex, node.endIndex);
      
      // If not a local variable, it's captured from outer scope
      if (!local_vars.has(name) && context.known_types?.has(name)) {
        flows.push({
          source_type: context.known_types.get(name)!,
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
    
    // Recurse through children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        find_captured_variables(child, local_vars);
      }
    }
  }
  
  // Collect local variables first
  const local_vars = new Set<string>();
  const params = closure_node.childForFieldName('parameters');
  if (params) {
    collect_parameters(params, source_code, local_vars);
  }
  
  // Find captured variables
  find_captured_variables(body, local_vars);
  
  return flows;
}

/**
 * Handle type narrowing in JavaScript control flow
 */
export function handle_type_narrowing(
  control_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  const config = getTypePropagationConfig(context.language);
  
  const condition = control_node.childForFieldName(config.fields.condition);
  if (!condition) return flows;
  
  // Check for typeof narrowing
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
  
  // Check for instanceof narrowing
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
    
    if (left && right && operator && (operator.text === '===' || operator.text === '==')) {
      // Check for typeof x === 'string'
      if (left.type === 'unary_expression') {
        const unary_op = left.childForFieldName('operator');
        const argument = left.childForFieldName('argument');
        
        if (unary_op && unary_op.text === 'typeof' && argument && argument.type === 'identifier') {
          const variable = source_code.substring(argument.startIndex, argument.endIndex);
          if (right.type === 'string') {
            const type = source_code.substring(right.startIndex + 1, right.endIndex - 1);
            return { variable, type };
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
 * Collect parameter names from a parameter list
 */
function collect_parameters(
  params_node: SyntaxNode,
  source_code: string,
  local_vars: Set<string>
): void {
  for (let i = 0; i < params_node.childCount; i++) {
    const param = params_node.child(i);
    if (param && param.type === 'identifier') {
      const name = source_code.substring(param.startIndex, param.endIndex);
      local_vars.add(name);
    } else if (param && param.type === 'formal_parameters') {
      // Recurse into formal parameters
      collect_parameters(param, source_code, local_vars);
    }
  }
}