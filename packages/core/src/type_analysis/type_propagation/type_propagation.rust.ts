/**
 * Rust-specific bespoke type propagation features
 * 
 * This file contains only features unique to Rust that cannot be
 * expressed through configuration:
 * - Ownership and borrowing propagation
 * - Match pattern type refinement
 * - Lifetime constraints
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
 * Main entry point for Rust type propagation
 */
export function propagate_rust_types(
  node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  let flows: TypeFlow[] = [];
  
  // Use generic propagation for common patterns
  if (is_assignment_node(node.type, context.language) || 
      is_declaration_node(node.type, context.language) ||
      node.type === 'let_declaration') {
    flows = propagate_assignment_types(node, context);
  } else if (is_member_access_node(node.type, context.language)) {
    flows = propagate_property_types(node, context);
  }
  
  // Handle Rust-specific patterns
  if (node.type === 'match_expression') {
    const match_flows = handle_match_expression(node, context);
    flows = merge_type_flows(flows, match_flows);
  }
  
  // Handle if-let expressions
  if (node.type === 'if_let_expression') {
    const if_let_flows = handle_if_let_expression(node, context);
    flows = merge_type_flows(flows, if_let_flows);
  }
  
  return flows;
}

/**
 * Handle match expression type refinement (Rust-specific)
 * 
 * Match expressions provide exhaustive pattern matching with type refinement
 */
function handle_match_expression(
  match_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  // Get the value being matched
  const value = match_node.childForFieldName('value');
  if (!value || value.type !== 'identifier') return flows;
  
  const matched_var = source_code.substring(value.startIndex, value.endIndex);
  
  // Process each match arm
  const body = match_node.childForFieldName('body');
  if (!body) return flows;
  
  for (let i = 0; i < body.childCount; i++) {
    const arm = body.child(i);
    if (arm && arm.type === 'match_arm') {
      const pattern = arm.childForFieldName('pattern');
      
      if (pattern) {
        // Extract refined type from pattern
        const refined_type = extract_pattern_type(pattern, context);
        if (refined_type) {
          flows.push({
            source_type: refined_type,
            target_identifier: matched_var,
            flow_kind: 'narrowing',
            confidence: 'explicit',
            position: {
              row: pattern.startPosition.row,
              column: pattern.startPosition.column
            }
          });
        }
      }
    }
  }
  
  return flows;
}

/**
 * Handle if-let expression type refinement
 */
function handle_if_let_expression(
  if_let_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  // Extract pattern and value
  const pattern = if_let_node.childForFieldName('pattern');
  const value = if_let_node.childForFieldName('value');
  
  if (pattern && value && value.type === 'identifier') {
    const var_name = source_code.substring(value.startIndex, value.endIndex);
    const refined_type = extract_pattern_type(pattern, context);
    
    if (refined_type) {
      flows.push({
        source_type: refined_type,
        target_identifier: var_name,
        flow_kind: 'narrowing',
        confidence: 'explicit',
        position: {
          row: pattern.startPosition.row,
          column: pattern.startPosition.column
        }
      });
    }
  }
  
  return flows;
}

/**
 * Extract type from pattern
 */
function extract_pattern_type(
  pattern: SyntaxNode,
  context: TypePropagationContext
): string | undefined {
  const { source_code } = context;
  
  switch (pattern.type) {
    case 'tuple_struct_pattern':
      // Extract enum variant type (e.g., Some(x) -> Option<T>)
      const name = pattern.child(0);
      if (name) {
        return source_code.substring(name.startIndex, name.endIndex);
      }
      break;
      
    case 'struct_pattern':
      // Extract struct type
      const type_node = pattern.childForFieldName('type');
      if (type_node) {
        return source_code.substring(type_node.startIndex, type_node.endIndex);
      }
      break;
      
    case 'reference_pattern':
      // Extract reference type (&T or &mut T)
      const inner = pattern.child(pattern.childCount - 1);
      if (inner) {
        const inner_type = extract_pattern_type(inner, context);
        if (inner_type) {
          const has_mut = pattern.text?.includes('mut');
          return has_mut ? `&mut ${inner_type}` : `&${inner_type}`;
        }
      }
      break;
      
    case 'identifier':
      // Simple binding - no type refinement
      return undefined;
      
    default:
      // For literals and other patterns, extract the literal type
      if (pattern.type.includes('literal')) {
        return pattern.type.replace('_literal', '');
      }
  }
  
  return undefined;
}