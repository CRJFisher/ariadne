/**
 * Core type propagation functionality
 * 
 * Propagates type information through:
 * - Variable assignments
 * - Function calls and returns
 * - Property access chains
 * - Control flow narrowing
 */

// TODO: Integration with Type Tracking
// - Update type map on assignment
// TODO: Integration with Call Chain Analysis
// - Flow types along call paths
// TODO: Integration with Scope Analysis
// - Type flow within scope rules

import { SyntaxNode } from 'tree-sitter';
import { 
  Language,
  TypeFlow,
  PropagationPath
} from '@ariadnejs/types';

/**
 * Context for type propagation (internal use only)
 */
export interface TypePropagationContext {
  language: Language;
  source_code: string;
  file_path?: string;
  scope_tree?: any;
  known_types?: Map<string, string>;
  debug?: boolean;
}

/**
 * Result of type propagation analysis (internal use only)
 */
export interface PropagationAnalysis {
  flows: TypeFlow[];
  paths: PropagationPath[];
  type_map: Map<string, string>;
}

/**
 * Propagate types through variable assignments
 */
export function propagate_assignment_types(
  assignment_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  // Extract left-hand side (target) and right-hand side (source)
  const lhs = get_assignment_target(assignment_node, context);
  const rhs = get_assignment_source(assignment_node, context);
  
  if (lhs && rhs) {
    const source_type = infer_expression_type(rhs.node, context);
    
    if (source_type) {
      flows.push({
        source_type,
        target_identifier: lhs.identifier,
        flow_kind: 'assignment',
        confidence: rhs.is_literal ? 'explicit' : 'inferred',
        position: {
          row: assignment_node.startPosition.row,
          column: assignment_node.startPosition.column
        }
      });
    }
  }
  
  return flows;
}

/**
 * Extract assignment target (LHS)
 */
function get_assignment_target(
  node: SyntaxNode,
  context: TypePropagationContext
): { identifier: string; is_property: boolean } | undefined {
  const { language, source_code } = context;
  
  switch (language) {
    case 'javascript':
    case 'typescript':
      if (node.type === 'assignment_expression') {
        const left = node.childForFieldName('left');
        if (left) {
          if (left.type === 'identifier') {
            return {
              identifier: source_code.substring(left.startIndex, left.endIndex),
              is_property: false
            };
          } else if (left.type === 'member_expression') {
            // Handle property assignment
            return extract_member_path(left, source_code);
          }
        }
      } else if (node.type === 'variable_declarator') {
        const name = node.childForFieldName('name');
        if (name && name.type === 'identifier') {
          return {
            identifier: source_code.substring(name.startIndex, name.endIndex),
            is_property: false
          };
        }
      }
      break;
    
    case 'python':
      if (node.type === 'assignment') {
        const left = node.childForFieldName('left');
        if (left && left.type === 'identifier') {
          return {
            identifier: source_code.substring(left.startIndex, left.endIndex),
            is_property: false
          };
        }
      }
      break;
    
    case 'rust':
      if (node.type === 'let_declaration') {
        const pattern = node.childForFieldName('pattern');
        if (pattern && pattern.type === 'identifier') {
          return {
            identifier: source_code.substring(pattern.startIndex, pattern.endIndex),
            is_property: false
          };
        }
      }
      break;
  }
  
  return undefined;
}

/**
 * Extract assignment source (RHS)
 */
function get_assignment_source(
  node: SyntaxNode,
  context: TypePropagationContext
): { node: SyntaxNode; is_literal: boolean } | undefined {
  const { language } = context;
  
  switch (language) {
    case 'javascript':
    case 'typescript':
      if (node.type === 'assignment_expression') {
        const right = node.childForFieldName('right');
        if (right) {
          return {
            node: right,
            is_literal: is_literal_node(right, language)
          };
        }
      } else if (node.type === 'variable_declarator') {
        const value = node.childForFieldName('value');
        if (value) {
          return {
            node: value,
            is_literal: is_literal_node(value, language)
          };
        }
      }
      break;
    
    case 'python':
      if (node.type === 'assignment') {
        const right = node.childForFieldName('right');
        if (right) {
          return {
            node: right,
            is_literal: is_literal_node(right, language)
          };
        }
      }
      break;
    
    case 'rust':
      if (node.type === 'let_declaration') {
        const value = node.childForFieldName('value');
        if (value) {
          return {
            node: value,
            is_literal: is_literal_node(value, language)
          };
        }
      }
      break;
  }
  
  return undefined;
}

/**
 * Check if a node is a literal value
 */
function is_literal_node(node: SyntaxNode, language: Language): boolean {
  switch (language) {
    case 'javascript':
    case 'typescript':
      return ['string', 'number', 'true', 'false', 'null', 'undefined'].includes(node.type);
    case 'python':
      return ['string', 'integer', 'float', 'true', 'false', 'none'].includes(node.type);
    case 'rust':
      return ['string_literal', 'integer_literal', 'float_literal', 
              'boolean_literal', 'char_literal'].includes(node.type);
    default:
      return false;
  }
}

/**
 * Infer type from an expression node
 */
export function infer_expression_type(
  expr_node: SyntaxNode,
  context: TypePropagationContext
): string | undefined {
  const { language, source_code } = context;
  
  // Check for literals
  if (is_literal_node(expr_node, language)) {
    return get_literal_type(expr_node, language);
  }
  
  // Check for constructor calls
  if (is_constructor_call(expr_node, language)) {
    return extract_constructor_type(expr_node, source_code, language);
  }
  
  // Check for function calls
  if (is_function_call(expr_node, language)) {
    // Would need integration with return type inference
    return undefined;
  }
  
  // Check for identifiers (look up from known types)
  if (expr_node.type === 'identifier') {
    const identifier_name = source_code.substring(expr_node.startIndex, expr_node.endIndex);
    if (context.known_types?.has(identifier_name)) {
      return context.known_types.get(identifier_name);
    }
    return undefined;
  }
  
  return undefined;
}

/**
 * Get type of a literal node
 */
function get_literal_type(node: SyntaxNode, language: Language): string {
  switch (language) {
    case 'javascript':
    case 'typescript':
      switch (node.type) {
        case 'string': return 'string';
        case 'number': return 'number';
        case 'true':
        case 'false': return 'boolean';
        case 'null': return 'null';
        case 'undefined': return 'undefined';
        default: return 'unknown';
      }
    
    case 'python':
      switch (node.type) {
        case 'string': return 'str';
        case 'integer': return 'int';
        case 'float': return 'float';
        case 'true':
        case 'false': return 'bool';
        case 'none': return 'None';
        default: return 'Any';
      }
    
    case 'rust':
      switch (node.type) {
        case 'string_literal': return '&str';
        case 'integer_literal': return 'i32';
        case 'float_literal': return 'f64';
        case 'boolean_literal': return 'bool';
        case 'char_literal': return 'char';
        default: return '_';
      }
    
    default:
      return 'unknown';
  }
}

/**
 * Check if node is a constructor call
 */
function is_constructor_call(node: SyntaxNode, language: Language): boolean {
  switch (language) {
    case 'javascript':
    case 'typescript':
      return node.type === 'new_expression';
    case 'python':
      // In Python, constructor calls look like regular calls
      return node.type === 'call' && is_capitalized_identifier(node, language);
    case 'rust':
      // Rust constructors are struct literals or associated functions
      return node.type === 'struct_expression' || 
             (node.type === 'call_expression' && has_double_colon(node));
    default:
      return false;
  }
}

/**
 * Check if node is a function call
 */
function is_function_call(node: SyntaxNode, language: Language): boolean {
  switch (language) {
    case 'javascript':
    case 'typescript':
      return node.type === 'call_expression';
    case 'python':
      return node.type === 'call';
    case 'rust':
      return node.type === 'call_expression';
    default:
      return false;
  }
}

/**
 * Extract constructor type from call
 */
function extract_constructor_type(
  node: SyntaxNode,
  source_code: string,
  language: Language
): string | undefined {
  switch (language) {
    case 'javascript':
    case 'typescript':
      if (node.type === 'new_expression') {
        const constructor = node.childForFieldName('constructor');
        if (constructor) {
          return source_code.substring(constructor.startIndex, constructor.endIndex);
        }
      }
      break;
    
    case 'python':
      if (node.type === 'call') {
        const func = node.childForFieldName('function');
        if (func) {
          const name = source_code.substring(func.startIndex, func.endIndex);
          // Check if it's a capitalized name (likely a class)
          if (name[0] === name[0].toUpperCase()) {
            return name;
          }
        }
      }
      break;
    
    case 'rust':
      if (node.type === 'struct_expression') {
        const name = node.childForFieldName('name');
        if (name) {
          return source_code.substring(name.startIndex, name.endIndex);
        }
      }
      break;
  }
  
  return undefined;
}

/**
 * Propagate types through function returns
 */
export function propagate_return_types(
  call_node: SyntaxNode,
  return_type: string,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  // Check if the call result is assigned to a variable
  const parent = call_node.parent;
  if (parent) {
    const target = get_assignment_target(parent, context);
    if (target) {
      flows.push({
        source_type: return_type,
        target_identifier: target.identifier,
        flow_kind: 'return',
        confidence: 'inferred',
        position: {
          row: call_node.startPosition.row,
          column: call_node.startPosition.column
        }
      });
    }
  }
  
  return flows;
}

/**
 * Propagate types through function parameters
 */
export function propagate_parameter_types(
  call_node: SyntaxNode,
  param_types: Map<string, string>,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const args = extract_call_arguments(call_node, context);
  
  let i = 0;
  for (const [param_name, param_type] of param_types) {
    if (i < args.length) {
      const arg = args[i];
      if (arg.type === 'identifier') {
        const arg_name = context.source_code.substring(arg.startIndex, arg.endIndex);
        flows.push({
          source_type: param_type,
          target_identifier: arg_name,
          flow_kind: 'parameter',
          confidence: 'inferred',
          position: {
            row: arg.startPosition.row,
            column: arg.startPosition.column
          }
        });
      }
    }
    i++;
  }
  
  return flows;
}

/**
 * Extract arguments from a function call
 */
function extract_call_arguments(
  call_node: SyntaxNode,
  context: TypePropagationContext
): SyntaxNode[] {
  const args: SyntaxNode[] = [];
  const { language } = context;
  
  let args_node: SyntaxNode | null = null;
  switch (language) {
    case 'javascript':
    case 'typescript':
    case 'rust':
      args_node = call_node.childForFieldName('arguments');
      break;
    case 'python':
      args_node = call_node.childForFieldName('arguments');
      break;
  }
  
  if (args_node) {
    for (let i = 0; i < args_node.childCount; i++) {
      const child = args_node.child(i);
      if (child && child.type !== '(' && child.type !== ')' && child.type !== ',') {
        args.push(child);
      }
    }
  }
  
  return args;
}

/**
 * Propagate types through property access
 */
export function propagate_property_types(
  member_node: SyntaxNode,
  object_type: string,
  property_types: Map<string, string>,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  
  const property = extract_property_name(member_node, context);
  if (property) {
    const prop_type = property_types.get(property);
    if (prop_type) {
      // Check if this property access is assigned to something
      const parent = member_node.parent;
      if (parent) {
        const target = get_assignment_target(parent, context);
        if (target) {
          flows.push({
            source_type: prop_type,
            target_identifier: target.identifier,
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
 * Extract property name from member expression
 */
function extract_property_name(
  member_node: SyntaxNode,
  context: TypePropagationContext
): string | undefined {
  const { language, source_code } = context;
  
  switch (language) {
    case 'javascript':
    case 'typescript':
      if (member_node.type === 'member_expression') {
        const property = member_node.childForFieldName('property');
        if (property) {
          return source_code.substring(property.startIndex, property.endIndex);
        }
      }
      break;
    
    case 'python':
      if (member_node.type === 'attribute') {
        const attr = member_node.childForFieldName('attribute');
        if (attr) {
          return source_code.substring(attr.startIndex, attr.endIndex);
        }
      }
      break;
    
    case 'rust':
      if (member_node.type === 'field_expression') {
        const field = member_node.childForFieldName('field');
        if (field) {
          return source_code.substring(field.startIndex, field.endIndex);
        }
      }
      break;
  }
  
  return undefined;
}

/**
 * Extract member access path
 */
function extract_member_path(
  node: SyntaxNode,
  source_code: string
): { identifier: string; is_property: boolean } | undefined {
  const parts: string[] = [];
  let current = node;
  
  while (current.type === 'member_expression') {
    const property = current.childForFieldName('property');
    if (property) {
      parts.unshift(source_code.substring(property.startIndex, property.endIndex));
    }
    
    const object = current.childForFieldName('object');
    if (object) {
      if (object.type === 'identifier') {
        parts.unshift(source_code.substring(object.startIndex, object.endIndex));
        break;
      }
      current = object;
    } else {
      break;
    }
  }
  
  if (parts.length > 0) {
    return {
      identifier: parts.join('.'),
      is_property: true
    };
  }
  
  return undefined;
}

/**
 * Check if identifier is capitalized
 */
function is_capitalized_identifier(node: SyntaxNode, language: Language): boolean {
  if (node.type === 'call') {
    const func = node.childForFieldName('function');
    if (func && func.type === 'identifier') {
      const name = func.text;
      return name[0] === name[0].toUpperCase();
    }
  }
  return false;
}

/**
 * Check if node has double colon (Rust)
 */
function has_double_colon(node: SyntaxNode): boolean {
  if (node.type === 'call_expression') {
    const func = node.childForFieldName('function');
    if (func && func.type === 'scoped_identifier') {
      return true;
    }
  }
  return false;
}

/**
 * Build propagation paths showing how types flow
 */
export function build_propagation_paths(
  flows: TypeFlow[]
): PropagationPath[] {
  const paths: PropagationPath[] = [];
  const type_map = new Map<string, string>();
  
  // Build initial type map
  for (const flow of flows) {
    type_map.set(flow.target_identifier, flow.source_type);
  }
  
  // Build paths
  for (const flow of flows) {
    const path: string[] = [flow.target_identifier];
    let current = flow.target_identifier;
    
    // Follow the chain backwards
    for (const other_flow of flows) {
      if (other_flow.target_identifier === current && 
          other_flow.target_identifier !== flow.target_identifier) {
        path.unshift(other_flow.target_identifier);
        current = other_flow.target_identifier;
      }
    }
    
    if (path.length > 1) {
      paths.push({
        source: path[0],
        target: path[path.length - 1],
        path,
        flow_type: flow.flow_kind
      });
    }
  }
  
  return paths;
}

/**
 * Merge type flows from multiple sources
 */
export function merge_type_flows(
  ...flow_sets: TypeFlow[][]
): TypeFlow[] {
  const merged: TypeFlow[] = [];
  const seen = new Set<string>();
  
  for (const flows of flow_sets) {
    for (const flow of flows) {
      const key = `${flow.target_identifier}:${flow.source_type}:${flow.flow_kind}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(flow);
      }
    }
  }
  
  return merged;
}

/**
 * Create a type propagation analysis
 */
export function create_propagation_analysis(): PropagationAnalysis {
  return {
    flows: [],
    paths: [],
    type_map: new Map()
  };
}

/**
 * Add flows to analysis
 */
export function add_flows_to_analysis(
  analysis: PropagationAnalysis,
  flows: TypeFlow[]
): PropagationAnalysis {
  // Update flows
  const updated_flows = [...analysis.flows, ...flows];
  
  // Update type map
  const updated_map = new Map(analysis.type_map);
  for (const flow of flows) {
    updated_map.set(flow.target_identifier, flow.source_type);
  }
  
  // Rebuild paths
  const updated_paths = build_propagation_paths(updated_flows);
  
  return {
    flows: updated_flows,
    paths: updated_paths,
    type_map: updated_map
  };
}