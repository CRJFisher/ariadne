/**
 * TypeScript-specific bespoke parameter type inference
 * 
 * Handles unique TypeScript features that cannot be expressed through configuration:
 * - Generic type parameters and constraints
 * - Function overload resolution
 * - Utility type resolution
 * - Union/intersection types
 */

import { SyntaxNode } from 'tree-sitter';
import { FunctionDefinition } from '@ariadnejs/types';
import {
  ParameterInfo,
  ParameterTypeInfo,
  ParameterInferenceContext
} from './parameter_type_inference';

/**
 * Extract TypeScript generic type parameters and their constraints
 */
export function extract_generic_constraints(
  func_node: SyntaxNode,
  context: ParameterInferenceContext
): Map<string, string> {
  const constraints = new Map<string, string>();
  
  // Look for type_parameters node
  const type_params = func_node.childForFieldName('type_parameters');
  if (!type_params) {
    return constraints;
  }
  
  const { source_code } = context;
  
  // Parse each type parameter
  for (let i = 0; i < type_params.childCount; i++) {
    const param = type_params.child(i);
    if (param && param.type === 'type_parameter') {
      const name_node = param.childForFieldName('name');
      const constraint_node = param.childForFieldName('constraint');
      
      if (name_node) {
        const name = source_code.substring(name_node.startIndex, name_node.endIndex);
        const constraint = constraint_node ? 
          source_code.substring(constraint_node.startIndex, constraint_node.endIndex) : 
          'any';
        constraints.set(name, constraint);
      }
    }
  }
  
  return constraints;
}

/**
 * Resolve TypeScript function overloads
 */
export function resolve_overload_parameters(
  func_def: FunctionDefinition,
  func_node: SyntaxNode,
  parameters: ParameterInfo[],
  context: ParameterInferenceContext
): ParameterInfo[] {
  // Check if this is an overload implementation
  const parent = func_node.parent;
  if (!parent) {
    return parameters;
  }
  
  const overloads: SyntaxNode[] = [];
  
  // Collect all overload signatures
  for (let i = 0; i < parent.childCount; i++) {
    const sibling = parent.child(i);
    if (sibling && sibling.type === 'function_signature' &&
        sibling.childForFieldName('name')?.text === func_def.name) {
      overloads.push(sibling);
    }
  }
  
  if (overloads.length === 0) {
    return parameters;
  }
  
  // Merge parameter info from overloads
  const merged_params = [...parameters];
  
  for (const overload of overloads) {
    const overload_params = extract_overload_parameters(overload, context);
    
    // Merge type information
    for (let i = 0; i < Math.min(merged_params.length, overload_params.length); i++) {
      if (overload_params[i].type_annotation && !merged_params[i].type_annotation) {
        merged_params[i].type_annotation = overload_params[i].type_annotation;
      }
    }
  }
  
  return merged_params;
}

/**
 * Extract parameters from an overload signature
 */
function extract_overload_parameters(
  signature_node: SyntaxNode,
  context: ParameterInferenceContext
): ParameterInfo[] {
  const params: ParameterInfo[] = [];
  const params_node = signature_node.childForFieldName('parameters');
  
  if (!params_node) {
    return params;
  }
  
  const { source_code } = context;
  let position = 0;
  
  for (let i = 0; i < params_node.childCount; i++) {
    const param = params_node.child(i);
    if (param && (param.type === 'required_parameter' || param.type === 'optional_parameter')) {
      const pattern = param.childForFieldName('pattern');
      const type = param.childForFieldName('type');
      
      if (pattern) {
        params.push({
          name: source_code.substring(pattern.startIndex, pattern.endIndex),
          position,
          type_annotation: type ? source_code.substring(type.startIndex, type.endIndex) : undefined,
          is_optional: param.type === 'optional_parameter'
        });
        position++;
      }
    }
  }
  
  return params;
}

/**
 * Resolve TypeScript union types
 */
export function resolve_union_type(
  type_node: SyntaxNode,
  context: ParameterInferenceContext
): string[] {
  const types: string[] = [];
  const { source_code } = context;
  
  if (type_node.type === 'union_type') {
    for (let i = 0; i < type_node.childCount; i++) {
      const child = type_node.child(i);
      if (child && child.type !== '|') {
        types.push(source_code.substring(child.startIndex, child.endIndex));
      }
    }
  } else {
    types.push(source_code.substring(type_node.startIndex, type_node.endIndex));
  }
  
  return types;
}

/**
 * Check if a type is a TypeScript utility type
 */
export function is_utility_type(type_name: string): boolean {
  const utility_types = [
    'Partial', 'Required', 'Readonly', 'Record', 'Pick', 'Omit',
    'Exclude', 'Extract', 'NonNullable', 'Parameters', 'ConstructorParameters',
    'ReturnType', 'InstanceType', 'Required', 'ThisParameterType', 'OmitThisParameter'
  ];
  
  return utility_types.some(util => type_name.startsWith(util + '<'));
}

/**
 * Extract TypeScript-specific parameter modifiers
 */
export function extract_typescript_parameter_modifiers(
  param_node: SyntaxNode,
  context: ParameterInferenceContext
): { readonly?: boolean; public?: boolean; private?: boolean; protected?: boolean } {
  const modifiers: { readonly?: boolean; public?: boolean; private?: boolean; protected?: boolean } = {};
  const { source_code } = context;
  
  // Check for modifiers before the parameter
  let prev = param_node.previousSibling;
  while (prev && ['readonly', 'public', 'private', 'protected'].includes(prev.type)) {
    const modifier = source_code.substring(prev.startIndex, prev.endIndex);
    switch (modifier) {
      case 'readonly':
        modifiers.readonly = true;
        break;
      case 'public':
        modifiers.public = true;
        break;
      case 'private':
        modifiers.private = true;
        break;
      case 'protected':
        modifiers.protected = true;
        break;
    }
    prev = prev.previousSibling;
  }
  
  return modifiers;
}

/**
 * Infer parameter types from TypeScript call sites with generics
 */
export function infer_from_typescript_call_sites(
  func_name: string,
  parameters: ParameterInfo[],
  call_sites: SyntaxNode[],
  context: ParameterInferenceContext
): Map<string, ParameterTypeInfo[]> {
  const call_site_types = new Map<string, ParameterTypeInfo[]>();
  
  for (const call_site of call_sites) {
    // Check for generic type arguments
    const type_args = call_site.childForFieldName('type_arguments');
    const generic_types = type_args ? extract_type_arguments(type_args, context) : [];
    
    const args = call_site.childForFieldName('arguments');
    if (!args) continue;
    
    let arg_index = 0;
    for (let i = 0; i < args.childCount; i++) {
      const arg = args.child(i);
      if (arg && arg.type !== ',' && arg.type !== '(' && arg.type !== ')') {
        const param = parameters[arg_index];
        if (param) {
          const arg_type = infer_typescript_argument_type(arg, generic_types, context);
          if (arg_type) {
            if (!call_site_types.has(param.name)) {
              call_site_types.set(param.name, []);
            }
            call_site_types.get(param.name)!.push({
              param_name: param.name,
              inferred_type: arg_type,
              confidence: 'inferred',
              source: 'call_site'
            });
          }
        }
        arg_index++;
      }
    }
  }
  
  return call_site_types;
}

/**
 * Extract type arguments from a call site
 */
function extract_type_arguments(
  type_args_node: SyntaxNode,
  context: ParameterInferenceContext
): string[] {
  const types: string[] = [];
  const { source_code } = context;
  
  for (let i = 0; i < type_args_node.childCount; i++) {
    const arg = type_args_node.child(i);
    if (arg && arg.type !== '<' && arg.type !== '>' && arg.type !== ',') {
      types.push(source_code.substring(arg.startIndex, arg.endIndex));
    }
  }
  
  return types;
}

/**
 * Infer type of a TypeScript argument with generics
 */
function infer_typescript_argument_type(
  arg_node: SyntaxNode,
  generic_types: string[],
  context: ParameterInferenceContext
): string | undefined {
  const { source_code } = context;
  
  // Check for as expression
  if (arg_node.type === 'as_expression') {
    const type_node = arg_node.childForFieldName('type');
    if (type_node) {
      return source_code.substring(type_node.startIndex, type_node.endIndex);
    }
  }
  
  // Check for type assertion
  if (arg_node.type === 'type_assertion') {
    const type_node = arg_node.childForFieldName('type');
    if (type_node) {
      return source_code.substring(type_node.startIndex, type_node.endIndex);
    }
  }
  
  // Fall back to basic type inference
  switch (arg_node.type) {
    case 'string':
    case 'template_string':
      return 'string';
    case 'number':
      return 'number';
    case 'true':
    case 'false':
      return 'boolean';
    case 'null':
      return 'null';
    case 'undefined':
      return 'undefined';
    case 'array':
      return 'Array<any>';
    case 'object':
      return 'object';
    case 'arrow_function':
    case 'function_expression':
      return 'Function';
    default:
      return undefined;
  }
}