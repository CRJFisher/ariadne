/**
 * JavaScript-specific parameter type inference
 * 
 * Handles JavaScript parameter patterns including:
 * - Default values
 * - Rest parameters
 * - Destructuring
 * - Function usage analysis
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

/**
 * Infer JavaScript parameter types from function definition
 */
export function infer_javascript_parameter_types(
  func_def: Def,
  func_node: SyntaxNode,
  parameters: ParameterInfo[],
  context: ParameterInferenceContext
): Map<string, ParameterTypeInfo> {
  const inferred_types = new Map<string, ParameterTypeInfo>();
  
  for (const param of parameters) {
    // Check default values
    if (param.default_value) {
      const type_from_default = infer_type_from_default(param.default_value, 'javascript');
      if (type_from_default) {
        type_from_default.param_name = param.name;
        inferred_types.set(param.name, type_from_default);
        continue;
      }
    }
    
    // Check common patterns
    const pattern_type = check_parameter_patterns(param, context);
    if (pattern_type) {
      inferred_types.set(param.name, pattern_type);
      continue;
    }
    
    // Analyze usage in function body
    const usage_type = analyze_parameter_usage(param.name, func_node, context);
    if (usage_type) {
      inferred_types.set(param.name, usage_type);
      continue;
    }
    
    // Default to any for untyped parameters
    inferred_types.set(param.name, {
      param_name: param.name,
      inferred_type: 'any',
      confidence: 'assumed',
      source: 'pattern'
    });
  }
  
  return inferred_types;
}

/**
 * Analyze how a parameter is used in the function body
 */
function analyze_parameter_usage(
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
  
  // Determine type from usage patterns
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
  
  if (usage_hints.includes('called_as_function')) {
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
  
  if (usage_hints.includes('boolean_context')) {
    return {
      param_name,
      inferred_type: 'boolean',
      confidence: 'inferred',
      source: 'usage'
    };
  }
  
  return undefined;
}

/**
 * Recursively analyze nodes for parameter usage
 */
function analyze_node_for_usage(
  node: SyntaxNode,
  param_name: string,
  usage_hints: string[],
  context: ParameterInferenceContext
): void {
  const { source_code } = context;
  
  // Check if this node references the parameter
  if (node.type === 'identifier' && 
      source_code.substring(node.startIndex, node.endIndex) === param_name) {
    const parent = node.parent;
    if (parent) {
      // Array access: param[index]
      if (parent.type === 'subscript_expression' && 
          parent.childForFieldName('object') === node) {
        usage_hints.push('array_access');
      }
      
      // Property access: param.property
      if (parent.type === 'member_expression' && 
          parent.childForFieldName('object') === node) {
        const property = parent.childForFieldName('property');
        if (property) {
          const prop_name = source_code.substring(property.startIndex, property.endIndex);
          
          // String methods
          if (['charAt', 'substring', 'indexOf', 'slice', 'toLowerCase', 'toUpperCase',
               'trim', 'split', 'replace', 'match'].includes(prop_name)) {
            usage_hints.push('string_method');
          }
          // Array methods
          else if (['push', 'pop', 'shift', 'unshift', 'map', 'filter', 'reduce',
                    'forEach', 'length', 'join', 'sort'].includes(prop_name)) {
            usage_hints.push('array_access');
          }
          // Object indication
          else {
            usage_hints.push('property_access');
          }
        }
      }
      
      // Function call: param()
      if (parent.type === 'call_expression' && 
          parent.childForFieldName('function') === node) {
        usage_hints.push('called_as_function');
      }
      
      // Binary operations
      if (parent.type === 'binary_expression') {
        const operator = parent.childForFieldName('operator');
        if (operator) {
          const op = source_code.substring(operator.startIndex, operator.endIndex);
          // Arithmetic operations
          if (['+', '-', '*', '/', '%', '**'].includes(op)) {
            // + could be string concatenation, but we'll assume number
            usage_hints.push('number_operation');
          }
          // Comparison operations
          else if (['<', '>', '<=', '>='].includes(op)) {
            usage_hints.push('number_operation');
          }
          // Logical operations
          else if (['&&', '||'].includes(op)) {
            usage_hints.push('boolean_context');
          }
        }
      }
      
      // Unary operations
      if (parent.type === 'unary_expression') {
        const operator = parent.childForFieldName('operator');
        if (operator) {
          const op = source_code.substring(operator.startIndex, operator.endIndex);
          if (op === '!') {
            usage_hints.push('boolean_context');
          } else if (op === '+' || op === '-' || op === '~') {
            usage_hints.push('number_operation');
          }
        }
      }
      
      // Conditional test
      if (parent.type === 'if_statement' && 
          parent.childForFieldName('condition') === node) {
        usage_hints.push('boolean_context');
      }
      
      // Ternary condition
      if (parent.type === 'ternary_expression' && 
          parent.childForFieldName('condition') === node) {
        usage_hints.push('boolean_context');
      }
      
      // for...of loop
      if (parent.type === 'for_of_statement' && 
          parent.childForFieldName('right') === node) {
        usage_hints.push('array_access');
      }
    }
  }
  
  // Recurse to children
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      analyze_node_for_usage(child, param_name, usage_hints, context);
    }
  }
}

/**
 * Infer parameter types from call sites
 */
export function infer_from_javascript_call_sites(
  func_name: string,
  parameters: ParameterInfo[],
  call_sites: SyntaxNode[],
  context: ParameterInferenceContext
): Map<string, ParameterTypeInfo[]> {
  const call_site_types = new Map<string, ParameterTypeInfo[]>();
  
  for (const param of parameters) {
    call_site_types.set(param.name, []);
  }
  
  for (const call of call_sites) {
    const args = extract_call_arguments(call, context);
    
    // Match arguments to parameters
    for (let i = 0; i < Math.min(args.length, parameters.length); i++) {
      const param = parameters[i];
      const arg_type = infer_argument_type(args[i], context);
      
      if (arg_type) {
        const types = call_site_types.get(param.name) || [];
        types.push({
          param_name: param.name,
          inferred_type: arg_type,
          confidence: 'inferred',
          source: 'call_site'
        });
        call_site_types.set(param.name, types);
      }
    }
  }
  
  return call_site_types;
}

/**
 * Extract arguments from a call expression
 */
function extract_call_arguments(
  call_node: SyntaxNode,
  context: ParameterInferenceContext
): SyntaxNode[] {
  const args: SyntaxNode[] = [];
  const args_node = call_node.childForFieldName('arguments');
  
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
 * Infer type from an argument expression
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
    
    case 'function':
    case 'arrow_function':
      return 'Function';
    
    case 'new_expression':
      const constructor = arg_node.childForFieldName('constructor');
      if (constructor) {
        return source_code.substring(constructor.startIndex, constructor.endIndex);
      }
      return 'Object';
    
    case 'identifier':
      // Could check variable tracking here
      const name = source_code.substring(arg_node.startIndex, arg_node.endIndex);
      // Common global constructors
      if (['Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'RegExp',
           'Map', 'Set', 'Promise', 'Error'].includes(name)) {
        return name;
      }
      return undefined;
    
    default:
      return undefined;
  }
}