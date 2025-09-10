/**
 * TypeScript-specific bespoke type propagation features
 * 
 * This file contains only features unique to TypeScript that cannot be
 * expressed through configuration:
 * - Type assertions (as, satisfies)
 * - Utility types (Partial, Required, etc.)
 * - Generic type propagation
 * - Conditional types
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
  isTypeAnnotationNode,
  isMemberAccessNode
} from './language_configs';

/**
 * Main entry point for TypeScript type propagation
 */
export function propagate_typescript_types(
  node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  let flows: TypeFlow[] = [];
  
  // Use generic propagation for common patterns
  if (isAssignmentNode(node.type, context.language) || 
      isDeclarationNode(node.type, context.language)) {
    flows = propagate_assignment_types(node, context);
  } else if (isMemberAccessNode(node.type, context.language)) {
    flows = propagate_property_types(node, context);
  }
  
  // Handle TypeScript-specific type annotations
  if (isTypeAnnotationNode(node.type, context.language)) {
    const annotation_flows = handle_type_annotation(node, context);
    flows = merge_type_flows(flows, annotation_flows);
  }
  
  // Handle type assertions
  if (node.type === 'as_expression' || node.type === 'type_assertion') {
    const assertion_flows = handle_type_assertion(node, context);
    flows = merge_type_flows(flows, assertion_flows);
  }
  
  // Handle satisfies operator
  if (node.type === 'satisfies_expression') {
    const satisfies_flows = handle_satisfies_expression(node, context);
    flows = merge_type_flows(flows, satisfies_flows);
  }
  
  // Handle utility types
  if (node.type === 'generic_type') {
    const utility_flows = handle_utility_types(node, context);
    flows = merge_type_flows(flows, utility_flows);
  }
  
  return flows;
}

/**
 * Handle TypeScript type annotations
 */
function handle_type_annotation(
  node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  // Extract the type from the annotation
  const type_node = node.childForFieldName('type') || node;
  const type_text = source_code.substring(type_node.startIndex, type_node.endIndex);
  
  // Find the identifier being typed
  const parent = node.parent;
  if (parent) {
    const name_node = parent.childForFieldName('name');
    if (name_node && name_node.type === 'identifier') {
      const identifier = source_code.substring(name_node.startIndex, name_node.endIndex);
      
      flows.push({
        source_type: type_text,
        target_identifier: identifier,
        flow_kind: 'assignment',
        confidence: 'explicit',
        position: {
          row: node.startPosition.row,
          column: node.startPosition.column
        }
      });
    }
  }
  
  return flows;
}

/**
 * Handle type assertions (as/type casts)
 */
export function handle_type_assertion(
  node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  const config = getTypePropagationConfig(context.language);
  
  // Extract the asserted type
  const type_node = node.childForFieldName('type');
  if (!type_node) return flows;
  
  const type_text = source_code.substring(type_node.startIndex, type_node.endIndex);
  
  // Extract the expression being asserted
  const expr_node = node.childForFieldName(config.fields.expression) ||
                    node.childForFieldName('value');
  
  if (expr_node && expr_node.type === 'identifier') {
    const identifier = source_code.substring(expr_node.startIndex, expr_node.endIndex);
    
    flows.push({
      source_type: type_text,
      target_identifier: identifier,
      flow_kind: 'assignment',
      confidence: 'explicit',
      position: {
        row: node.startPosition.row,
        column: node.startPosition.column
      }
    });
  }
  
  return flows;
}

/**
 * Handle satisfies expression
 */
function handle_satisfies_expression(
  node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  // Extract the type being satisfied
  const type_node = node.childForFieldName('type');
  if (!type_node) return flows;
  
  const type_text = source_code.substring(type_node.startIndex, type_node.endIndex);
  
  // Extract the expression
  const expr_node = node.childForFieldName('expression');
  if (expr_node && expr_node.type === 'identifier') {
    const identifier = source_code.substring(expr_node.startIndex, expr_node.endIndex);
    
    flows.push({
      source_type: type_text,
      target_identifier: identifier,
      flow_kind: 'assignment',
      confidence: 'explicit',
      position: {
        row: node.startPosition.row,
        column: node.startPosition.column
      }
    });
  }
  
  return flows;
}

/**
 * Handle TypeScript utility types (Partial, Required, etc.)
 * 
 * This is a bespoke feature as utility types have specific transformation rules
 * that can't be expressed through configuration.
 */
export function handle_utility_types(
  node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { source_code } = context;
  
  // Check if this is a utility type
  const name_node = node.childForFieldName('name');
  if (!name_node) return flows;
  
  const utility_name = source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // Map of utility types to their transformations
  const utility_transforms: Record<string, (base: string) => string> = {
    'Partial': (base) => `Partial<${base}>`,
    'Required': (base) => `Required<${base}>`,
    'Readonly': (base) => `Readonly<${base}>`,
    'Pick': (base) => `Pick<${base}>`,
    'Omit': (base) => `Omit<${base}>`,
    'Record': (base) => `Record<${base}>`,
    'Exclude': (base) => `Exclude<${base}>`,
    'Extract': (base) => `Extract<${base}>`,
    'NonNullable': (base) => `NonNullable<${base}>`,
    'ReturnType': (base) => `ReturnType<${base}>`,
    'InstanceType': (base) => `InstanceType<${base}>`,
    'ThisType': (base) => `ThisType<${base}>`
  };
  
  if (utility_transforms[utility_name]) {
    // Extract type arguments
    const type_args = node.childForFieldName('type_arguments');
    if (type_args) {
      const args_text = source_code.substring(type_args.startIndex, type_args.endIndex);
      const transformed_type = `${utility_name}${args_text}`;
      
      // Find where this type flows to
      const parent = node.parent;
      if (parent && parent.type === 'type_annotation') {
        const grandparent = parent.parent;
        if (grandparent) {
          const name = grandparent.childForFieldName('name');
          if (name && name.type === 'identifier') {
            const identifier = source_code.substring(name.startIndex, name.endIndex);
            
            flows.push({
              source_type: transformed_type,
              target_identifier: identifier,
              flow_kind: 'assignment',
              confidence: 'explicit',
              position: {
                row: node.startPosition.row,
                column: node.startPosition.column
              }
            });
          }
        }
      }
    }
  }
  
  return flows;
}