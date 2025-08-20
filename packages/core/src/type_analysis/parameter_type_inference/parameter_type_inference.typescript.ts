/**
 * TypeScript-specific parameter type inference
 * 
 * Handles TypeScript parameter patterns including:
 * - Type annotations
 * - Optional parameters
 * - Default values with types
 * - Generic parameters
 */

// TODO: Type Propagation - Flow types into function body

import { SyntaxNode } from 'tree-sitter';
import { Def } from '@ariadnejs/types';
import {
  ParameterInfo,
  ParameterTypeInfo,
  ParameterInferenceContext,
  infer_type_from_default,
  check_parameter_patterns
} from './parameter_type_inference';
import {
  infer_javascript_parameter_types,
  infer_from_javascript_call_sites
} from './parameter_type_inference.javascript';

/**
 * Infer TypeScript parameter types from function definition
 */
export function infer_typescript_parameter_types(
  func_def: Def,
  func_node: SyntaxNode,
  parameters: ParameterInfo[],
  context: ParameterInferenceContext
): Map<string, ParameterTypeInfo> {
  const inferred_types = new Map<string, ParameterTypeInfo>();
  
  for (const param of parameters) {
    // Explicit type annotations take precedence
    if (param.type_annotation) {
      inferred_types.set(param.name, {
        param_name: param.name,
        inferred_type: param.type_annotation,
        confidence: 'explicit',
        source: 'annotation'
      });
      continue;
    }
    
    // Check default values
    if (param.default_value) {
      const type_from_default = infer_type_from_default(param.default_value, 'typescript');
      if (type_from_default) {
        type_from_default.param_name = param.name;
        inferred_types.set(param.name, type_from_default);
        continue;
      }
    }
    
    // Optional parameters without type are implicitly 'any | undefined'
    if (param.is_optional) {
      inferred_types.set(param.name, {
        param_name: param.name,
        inferred_type: 'any | undefined',
        confidence: 'inferred',
        source: 'pattern'
      });
      continue;
    }
    
    // Rest parameters
    if (param.is_rest) {
      inferred_types.set(param.name, {
        param_name: param.name,
        inferred_type: 'any[]',
        confidence: 'inferred',
        source: 'pattern'
      });
      continue;
    }
  }
  
  // Fall back to JavaScript inference for untyped parameters
  const js_inferred = infer_javascript_parameter_types(func_def, func_node, parameters, context);
  
  // Merge results, keeping TypeScript annotations
  for (const [name, type_info] of js_inferred) {
    if (!inferred_types.has(name)) {
      inferred_types.set(name, type_info);
    }
  }
  
  return inferred_types;
}

/**
 * Extract TypeScript-specific parameter modifiers
 */
export function extract_typescript_parameter_modifiers(
  param_node: SyntaxNode,
  context: ParameterInferenceContext
): {
  readonly?: boolean;
  public?: boolean;
  private?: boolean;
  protected?: boolean;
} {
  const modifiers: {
    readonly?: boolean;
    public?: boolean;
    private?: boolean;
    protected?: boolean;
  } = {};
  
  // Look for modifier nodes
  for (let i = 0; i < param_node.childCount; i++) {
    const child = param_node.child(i);
    if (child) {
      switch (child.type) {
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
    }
  }
  
  return modifiers;
}

/**
 * Handle TypeScript function overloads
 */
export function resolve_overload_parameters(
  overloads: SyntaxNode[],
  context: ParameterInferenceContext
): ParameterInfo[][] {
  const all_params: ParameterInfo[][] = [];
  
  for (const overload of overloads) {
    const params_node = overload.childForFieldName('parameters');
    if (params_node) {
      const params: ParameterInfo[] = [];
      let position = 0;
      
      for (let i = 0; i < params_node.childCount; i++) {
        const param = params_node.child(i);
        if (param && is_typescript_parameter(param)) {
          const param_info = extract_typescript_parameter(param, position, context);
          if (param_info) {
            params.push(param_info);
            position++;
          }
        }
      }
      
      all_params.push(params);
    }
  }
  
  return all_params;
}

/**
 * Check if node is a TypeScript parameter
 */
function is_typescript_parameter(node: SyntaxNode): boolean {
  return node.type === 'required_parameter' ||
         node.type === 'optional_parameter' ||
         node.type === 'rest_parameter' ||
         node.type === 'identifier';
}

/**
 * Extract TypeScript parameter information
 */
function extract_typescript_parameter(
  param_node: SyntaxNode,
  position: number,
  context: ParameterInferenceContext
): ParameterInfo | undefined {
  const { source_code } = context;
  const info: ParameterInfo = {
    name: '',
    position
  };
  
  if (param_node.type === 'required_parameter') {
    const pattern = param_node.childForFieldName('pattern');
    const type = param_node.childForFieldName('type');
    
    if (pattern) {
      info.name = extract_pattern_name(pattern, source_code);
    }
    if (type) {
      info.type_annotation = source_code.substring(type.startIndex, type.endIndex);
    }
  } else if (param_node.type === 'optional_parameter') {
    const pattern = param_node.childForFieldName('pattern');
    const type = param_node.childForFieldName('type');
    const value = param_node.childForFieldName('value');
    
    if (pattern) {
      info.name = extract_pattern_name(pattern, source_code);
    }
    if (type) {
      info.type_annotation = source_code.substring(type.startIndex, type.endIndex);
    }
    if (value) {
      info.default_value = source_code.substring(value.startIndex, value.endIndex);
    }
    info.is_optional = true;
  } else if (param_node.type === 'rest_parameter') {
    const pattern = param_node.child(1); // Skip '...'
    const type = param_node.childForFieldName('type');
    
    if (pattern) {
      info.name = extract_pattern_name(pattern, source_code);
    }
    if (type) {
      info.type_annotation = source_code.substring(type.startIndex, type.endIndex);
    }
    info.is_rest = true;
  } else if (param_node.type === 'identifier') {
    info.name = source_code.substring(param_node.startIndex, param_node.endIndex);
  }
  
  return info;
}

/**
 * Extract name from destructuring pattern
 */
function extract_pattern_name(pattern: SyntaxNode, source_code: string): string {
  if (pattern.type === 'identifier') {
    return source_code.substring(pattern.startIndex, pattern.endIndex);
  } else if (pattern.type === 'object_pattern' || pattern.type === 'array_pattern') {
    // For destructuring, return a placeholder
    // In real implementation, we'd parse the pattern fully
    return `_destructured_${pattern.startIndex}`;
  }
  return '';
}

/**
 * Handle generic type parameters
 */
export function extract_generic_constraints(
  func_node: SyntaxNode,
  context: ParameterInferenceContext
): Map<string, string> {
  const constraints = new Map<string, string>();
  const type_params = func_node.childForFieldName('type_parameters');
  
  if (type_params) {
    for (let i = 0; i < type_params.childCount; i++) {
      const param = type_params.child(i);
      if (param && param.type === 'type_parameter') {
        const name_node = param.childForFieldName('name');
        const constraint_node = param.childForFieldName('constraint');
        
        if (name_node) {
          const name = context.source_code.substring(
            name_node.startIndex,
            name_node.endIndex
          );
          
          if (constraint_node) {
            const constraint = context.source_code.substring(
              constraint_node.startIndex,
              constraint_node.endIndex
            );
            constraints.set(name, constraint);
          } else {
            constraints.set(name, 'any');
          }
        }
      }
    }
  }
  
  return constraints;
}

/**
 * Resolve union types to most specific
 */
export function resolve_union_type(union: string): string {
  const types = union.split('|').map(t => t.trim());
  
  // Remove undefined/null if there are other types
  const non_nullable = types.filter(t => t !== 'undefined' && t !== 'null');
  if (non_nullable.length > 0 && non_nullable.length < types.length) {
    // Was optional, keep the main type
    if (non_nullable.length === 1) {
      return non_nullable[0];
    }
  }
  
  // Keep full union
  return union;
}

/**
 * Check if type is a TypeScript utility type
 */
export function is_utility_type(type_name: string): boolean {
  const utility_types = [
    'Partial', 'Required', 'Readonly', 'Record', 'Pick', 'Omit',
    'Exclude', 'Extract', 'NonNullable', 'Parameters', 'ConstructorParameters',
    'ReturnType', 'InstanceType', 'ThisParameterType', 'OmitThisParameter',
    'ThisType', 'Uppercase', 'Lowercase', 'Capitalize', 'Uncapitalize'
  ];
  
  return utility_types.some(util => type_name.startsWith(util + '<'));
}

/**
 * Infer parameter types from TypeScript call sites with type arguments
 */
export function infer_from_typescript_call_sites(
  func_name: string,
  parameters: ParameterInfo[],
  call_sites: SyntaxNode[],
  context: ParameterInferenceContext
): Map<string, ParameterTypeInfo[]> {
  // Start with JavaScript inference
  const call_site_types = infer_from_javascript_call_sites(
    func_name,
    parameters,
    call_sites,
    context
  );
  
  // Enhance with TypeScript-specific features
  for (const call of call_sites) {
    const type_args = call.childForFieldName('type_arguments');
    if (type_args) {
      // Handle generic type arguments
      // This would map generic parameters to concrete types
      // For now, we'll skip this complex case
    }
  }
  
  return call_site_types;
}