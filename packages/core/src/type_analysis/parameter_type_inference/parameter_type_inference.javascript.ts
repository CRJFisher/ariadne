/**
 * JavaScript-specific bespoke parameter type inference
 * 
 * Handles unique JavaScript features that cannot be expressed through configuration:
 * - JSDoc type extraction
 * - Usage-based type inference
 */

import { SyntaxNode } from 'tree-sitter';
import {
  ParameterInfo,
  ParameterTypeInfo,
  ParameterInferenceContext
} from './parameter_type_inference';

/**
 * Extract JSDoc type annotations for parameters
 */
export function extract_jsdoc_parameter_types(
  func_node: SyntaxNode,
  parameters: ParameterInfo[],
  context: ParameterInferenceContext
): Map<string, ParameterTypeInfo> {
  const types = new Map<string, ParameterTypeInfo>();
  
  // Look for JSDoc comment above function
  const prev_sibling = func_node.previousSibling;
  if (!prev_sibling || prev_sibling.type !== 'comment') {
    return types;
  }
  
  const comment_text = context.source_code.substring(
    prev_sibling.startIndex,
    prev_sibling.endIndex
  );
  
  // Parse JSDoc @param tags
  const param_regex = /@param\s+(?:\{([^}]+)\}\s+)?(\w+)/g;
  let match;
  
  while ((match = param_regex.exec(comment_text)) !== null) {
    const [, type, name] = match;
    if (type && parameters.some(p => p.name === name)) {
      types.set(name, {
        param_name: name,
        inferred_type: type,
        confidence: 'explicit',
        source: 'annotation'
      });
    }
  }
  
  return types;
}

/**
 * Analyze parameter usage in function body for type inference
 */
export function analyze_javascript_parameter_usage(
  param_name: string,
  func_node: SyntaxNode,
  context: ParameterInferenceContext
): ParameterTypeInfo | undefined {
  const body = func_node.childForFieldName('body');
  if (!body) {
    return undefined;
  }
  
  const usage_hints: string[] = [];
  analyze_node_for_usage(body, param_name, usage_hints, context);
  
  // Infer type from usage patterns
  if (usage_hints.includes('array_access')) {
    return {
      param_name,
      inferred_type: 'Array',
      confidence: 'inferred',
      source: 'usage'
    };
  }
  
  if (usage_hints.includes('property_access')) {
    return {
      param_name,
      inferred_type: 'Object',
      confidence: 'inferred',
      source: 'usage'
    };
  }
  
  if (usage_hints.includes('function_call')) {
    return {
      param_name,
      inferred_type: 'Function',
      confidence: 'inferred',
      source: 'usage'
    };
  }
  
  if (usage_hints.includes('string_method')) {
    return {
      param_name,
      inferred_type: 'string',
      confidence: 'inferred',
      source: 'usage'
    };
  }
  
  if (usage_hints.includes('number_operation')) {
    return {
      param_name,
      inferred_type: 'number',
      confidence: 'inferred',
      source: 'usage'
    };
  }
  
  return undefined;
}

/**
 * Recursively analyze AST nodes for parameter usage
 */
function analyze_node_for_usage(
  node: SyntaxNode,
  param_name: string,
  usage_hints: string[],
  context: ParameterInferenceContext
): void {
  const { source_code } = context;
  
  // Check for array access: param[...]
  if (node.type === 'subscript_expression' || node.type === 'member_expression') {
    const object = node.childForFieldName('object');
    if (object && source_code.substring(object.startIndex, object.endIndex) === param_name) {
      if (node.type === 'subscript_expression') {
        usage_hints.push('array_access');
      } else {
        const property = node.childForFieldName('property');
        if (property) {
          const prop_name = source_code.substring(property.startIndex, property.endIndex);
          // Check for array methods
          if (['push', 'pop', 'shift', 'unshift', 'map', 'filter', 'reduce'].includes(prop_name)) {
            usage_hints.push('array_access');
          } else if (['charAt', 'substring', 'toLowerCase', 'toUpperCase'].includes(prop_name)) {
            usage_hints.push('string_method');
          } else {
            usage_hints.push('property_access');
          }
        }
      }
    }
  }
  
  // Check for function call: param()
  if (node.type === 'call_expression') {
    const function_node = node.childForFieldName('function');
    if (function_node && source_code.substring(function_node.startIndex, function_node.endIndex) === param_name) {
      usage_hints.push('function_call');
    }
  }
  
  // Check for numeric operations
  if (node.type === 'binary_expression') {
    const operator = node.childForFieldName('operator');
    if (operator) {
      const op = source_code.substring(operator.startIndex, operator.endIndex);
      if (['+', '-', '*', '/', '%', '**'].includes(op)) {
        const left = node.childForFieldName('left');
        const right = node.childForFieldName('right');
        if ((left && source_code.substring(left.startIndex, left.endIndex) === param_name) ||
            (right && source_code.substring(right.startIndex, right.endIndex) === param_name)) {
          usage_hints.push('number_operation');
        }
      }
    }
  }
  
  // Recurse into child nodes
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      analyze_node_for_usage(child, param_name, usage_hints, context);
    }
  }
}

/**
 * Infer parameter types from JavaScript call sites
 */
export function infer_from_javascript_call_sites(
  func_name: string,
  parameters: ParameterInfo[],
  call_sites: SyntaxNode[],
  context: ParameterInferenceContext
): Map<string, ParameterTypeInfo[]> {
  const call_site_types = new Map<string, ParameterTypeInfo[]>();
  
  for (const call_site of call_sites) {
    const args = call_site.childForFieldName('arguments');
    if (!args) continue;
    
    let arg_index = 0;
    for (let i = 0; i < args.childCount; i++) {
      const arg = args.child(i);
      if (arg && arg.type !== ',' && arg.type !== '(' && arg.type !== ')') {
        const param = parameters[arg_index];
        if (param) {
          const arg_type = infer_argument_type(arg, context);
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
 * Infer type of an argument expression
 */
function infer_argument_type(
  arg_node: SyntaxNode,
  context: ParameterInferenceContext
): string | undefined {
  const { source_code } = context;
  
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
      return 'Array';
    case 'object':
      return 'Object';
    case 'arrow_function':
    case 'function_expression':
      return 'Function';
    default:
      return undefined;
  }
}