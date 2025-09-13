/**
 * Python-specific bespoke type propagation features
 * 
 * This file contains only features unique to Python that cannot be
 * expressed through configuration:
 * - With statement context managers
 * - Comprehension type inference
 * - Decorator type transformations
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
  get_type_propagation_config,
  is_assignment_node,
  is_declaration_node,
  is_member_access_node
} from './language_configs';

/**
 * Main entry point for Python type propagation
 */
export function propagate_python_types(
  node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  let flows: TypeFlow[] = [];
  
  // Use generic propagation for common patterns
  if (is_assignment_node(node.type, context.language) || 
      is_declaration_node(node.type, context.language)) {
    flows = propagate_assignment_types(node, context);
  } else if (is_member_access_node(node.type, context.language)) {
    flows = propagate_property_types(node, context);
  }
  
  // Handle Python-specific patterns
  if (node.type === 'with_statement') {
    const with_flows = handle_with_statement(node, context);
    flows = merge_type_flows(flows, with_flows);
  }
  
  // Handle comprehensions
  if (node.type.includes('comprehension')) {
    const comp_flows = handle_comprehension(node, context);
    flows = merge_type_flows(flows, comp_flows);
  }
  
  // Handle lambda expressions
  if (node.type === 'lambda') {
    const lambda_flows = handle_lambda(node, context);
    flows = merge_type_flows(flows, lambda_flows);
  }
  
  return flows;
}

/**
 * Handle with statement context managers (Python-specific)
 * 
 * With statements introduce variables with types from __enter__ methods
 */
export function handle_with_statement(
  with_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  // Find with_item node which contains the context manager and alias
  let with_item: SyntaxNode | null = null;
  for (let i = 0; i < with_node.childCount; i++) {
    const child = with_node.child(i);
    if (child && child.type === 'with_item') {
      with_item = child;
      break;
    }
  }
  
  if (!with_item) return flows;
  
  // Extract value (context manager) and alias from with_item
  let value: SyntaxNode | null = null;
  let alias: SyntaxNode | null = null;
  
  for (let i = 0; i < with_item.childCount; i++) {
    const child = with_item.child(i);
    if (child) {
      if (child.type === 'call' || child.type === 'identifier') {
        if (!value) {
          value = child;
        }
      } else if (child.type === 'as_pattern_target' || child.type === 'as_pattern') {
        // The alias is usually the last identifier after 'as'
        for (let j = 0; j < child.childCount; j++) {
          const grandchild = child.child(j);
          if (grandchild && grandchild.type === 'identifier') {
            alias = grandchild;
          }
        }
      } else if (child.type === 'identifier' && i > 0) {
        // Sometimes the alias is a direct identifier after 'as'
        alias = child;
      }
    }
  }
  
  if (value && alias && alias.type === 'identifier') {
    const alias_name = source_code.substring(alias.startIndex, alias.endIndex);
    
    // Infer type from context manager
    let context_type = 'Any';
    if (value.type === 'call') {
      const func = value.childForFieldName('function');
      if (func) {
        const func_name = source_code.substring(func.startIndex, func.endIndex);
        // Map common context managers to their types
        const context_managers: Record<string, string> = {
          'open': 'TextIOWrapper',
          'closing': 'Closeable',
          'suppress': 'ContextManager',
          'redirect_stdout': 'ContextManager',
          'redirect_stderr': 'ContextManager'
        };
        context_type = context_managers[func_name] || 'Any';
      }
    }
    
    flows.push({
      source_type: context_type,
      target_identifier: alias_name,
      flow_kind: 'assignment',
      confidence: 'inferred',
      position: {
        row: alias.startPosition.row,
        column: alias.startPosition.column
      }
    });
  }
  
  return flows;
}

/**
 * Handle comprehension type inference
 */
function handle_comprehension(
  comp_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  // Determine the result type based on comprehension type
  let result_type = 'Any';
  switch (comp_node.type) {
    case 'list_comprehension':
      result_type = 'list';
      break;
    case 'set_comprehension':
      result_type = 'set';
      break;
    case 'dictionary_comprehension':
      result_type = 'dict';
      break;
    case 'generator_expression':
      result_type = 'generator';
      break;
  }
  
  // Find the parent assignment if any
  const parent = comp_node.parent;
  if (parent && is_assignment_node(parent.type, context.language)) {
    const left = parent.childForFieldName('left');
    if (left && left.type === 'identifier') {
      const identifier = source_code.substring(left.startIndex, left.endIndex);
      
      flows.push({
        source_type: result_type,
        target_identifier: identifier,
        flow_kind: 'assignment',
        confidence: 'inferred',
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
 * Handle lambda expression type inference
 */
function handle_lambda(
  lambda_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  // Lambda expressions create callable types
  const parent = lambda_node.parent;
  if (parent && is_assignment_node(parent.type, context.language)) {
    const left = parent.childForFieldName('left');
    if (left && left.type === 'identifier') {
      const identifier = context.source_code.substring(left.startIndex, left.endIndex);
      
      flows.push({
        source_type: 'Callable',
        target_identifier: identifier,
        flow_kind: 'assignment',
        confidence: 'inferred',
        position: {
          row: lambda_node.startPosition.row,
          column: lambda_node.startPosition.column
        }
      });
    }
  }
  
  return flows;
}