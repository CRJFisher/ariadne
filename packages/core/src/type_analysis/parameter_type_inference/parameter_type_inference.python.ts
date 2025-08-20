/**
 * Python-specific parameter type inference
 * 
 * Handles Python parameter patterns including:
 * - Type hints
 * - Default values
 * - *args and **kwargs
 * - Docstring type annotations
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
 * Infer Python parameter types from function definition
 */
export function infer_python_parameter_types(
  func_def: Def,
  func_node: SyntaxNode,
  parameters: ParameterInfo[],
  context: ParameterInferenceContext
): Map<string, ParameterTypeInfo> {
  const inferred_types = new Map<string, ParameterTypeInfo>();
  
  for (const param of parameters) {
    // Type hints take precedence
    if (param.type_annotation) {
      inferred_types.set(param.name, {
        param_name: param.name,
        inferred_type: normalize_python_type(param.type_annotation),
        confidence: 'explicit',
        source: 'annotation'
      });
      continue;
    }
    
    // Check default values
    if (param.default_value) {
      const type_from_default = infer_type_from_default(param.default_value, 'python');
      if (type_from_default) {
        type_from_default.param_name = param.name;
        inferred_types.set(param.name, type_from_default);
        continue;
      }
    }
    
    // Special parameters
    if (param.name === 'self') {
      const class_name = context.class_name || 'Self';
      inferred_types.set(param.name, {
        param_name: param.name,
        inferred_type: class_name,
        confidence: 'explicit',
        source: 'pattern'
      });
      continue;
    }
    
    if (param.name === 'cls') {
      const class_name = context.class_name ? `Type[${context.class_name}]` : 'Type';
      inferred_types.set(param.name, {
        param_name: param.name,
        inferred_type: class_name,
        confidence: 'explicit',
        source: 'pattern'
      });
      continue;
    }
    
    // *args and **kwargs
    if (param.is_rest) {
      const type_name = param.is_keyword_only ? 'dict' : 'tuple';
      inferred_types.set(param.name, {
        param_name: param.name,
        inferred_type: type_name,
        confidence: 'inferred',
        source: 'pattern'
      });
      continue;
    }
    
    // Check common patterns
    const pattern_type = check_parameter_patterns(param, context);
    if (pattern_type) {
      inferred_types.set(param.name, pattern_type);
      continue;
    }
    
    // Check docstring for type hints
    const docstring_type = extract_docstring_type(param.name, func_node, context);
    if (docstring_type) {
      inferred_types.set(param.name, docstring_type);
      continue;
    }
    
    // Analyze usage in function body
    const usage_type = analyze_python_parameter_usage(param.name, func_node, context);
    if (usage_type) {
      inferred_types.set(param.name, usage_type);
      continue;
    }
    
    // Default to Any
    inferred_types.set(param.name, {
      param_name: param.name,
      inferred_type: 'Any',
      confidence: 'assumed',
      source: 'pattern'
    });
  }
  
  return inferred_types;
}

/**
 * Normalize Python type annotations
 */
function normalize_python_type(type_annotation: string): string {
  // Remove quotes from forward references
  let normalized = type_annotation.replace(/^["']|["']$/g, '');
  
  // Normalize common type aliases
  const type_map: Record<string, string> = {
    'List': 'list',
    'Dict': 'dict',
    'Set': 'set',
    'Tuple': 'tuple',
    'Optional': 'Optional',
    'Union': 'Union',
    'Any': 'Any',
    'None': 'None'
  };
  
  for (const [old_type, new_type] of Object.entries(type_map)) {
    if (normalized.startsWith(old_type + '[') || normalized === old_type) {
      normalized = normalized.replace(old_type, new_type);
    }
  }
  
  return normalized;
}

/**
 * Extract type hints from docstring
 */
function extract_docstring_type(
  param_name: string,
  func_node: SyntaxNode,
  context: ParameterInferenceContext
): ParameterTypeInfo | undefined {
  const body = func_node.childForFieldName('body');
  if (!body || body.childCount === 0) {
    return undefined;
  }
  
  // First statement might be a docstring
  const first_stmt = body.child(0);
  if (first_stmt && first_stmt.type === 'expression_statement') {
    const expr = first_stmt.child(0);
    if (expr && expr.type === 'string') {
      const docstring = context.source_code.substring(
        expr.startIndex + 3,  // Skip opening quotes
        expr.endIndex - 3     // Skip closing quotes
      );
      
      // Look for Google/NumPy style parameter documentation
      // Args:
      //     param_name (type): description
      const google_pattern = new RegExp(
        `^\\s*${param_name}\\s*\\(([^)]+)\\)`,
        'mi'
      );
      const match = docstring.match(google_pattern);
      if (match) {
        return {
          param_name,
          inferred_type: match[1].trim(),
          confidence: 'inferred',
          source: 'annotation'
        };
      }
      
      // Sphinx style
      // :param param_name: description
      // :type param_name: type
      const sphinx_pattern = new RegExp(
        `:type\\s+${param_name}:\\s*([^\\n]+)`,
        'i'
      );
      const sphinx_match = docstring.match(sphinx_pattern);
      if (sphinx_match) {
        return {
          param_name,
          inferred_type: sphinx_match[1].trim(),
          confidence: 'inferred',
          source: 'annotation'
        };
      }
    }
  }
  
  return undefined;
}

/**
 * Analyze how a parameter is used in Python function body
 */
function analyze_python_parameter_usage(
  param_name: string,
  func_node: SyntaxNode,
  context: ParameterInferenceContext
): ParameterTypeInfo | undefined {
  const body = func_node.childForFieldName('body');
  if (!body) {
    return undefined;
  }
  
  const usage_hints: string[] = [];
  analyze_python_node_for_usage(body, param_name, usage_hints, context);
  
  // Determine type from usage patterns
  if (usage_hints.includes('list_operations')) {
    return {
      param_name,
      inferred_type: 'list',
      confidence: 'inferred',
      source: 'usage'
    };
  }
  
  if (usage_hints.includes('dict_operations')) {
    return {
      param_name,
      inferred_type: 'dict',
      confidence: 'inferred',
      source: 'usage'
    };
  }
  
  if (usage_hints.includes('string_operations')) {
    return {
      param_name,
      inferred_type: 'str',
      confidence: 'inferred',
      source: 'usage'
    };
  }
  
  if (usage_hints.includes('numeric_operations')) {
    // Check if float operations are present
    if (usage_hints.includes('float_operations')) {
      return {
        param_name,
        inferred_type: 'float',
        confidence: 'inferred',
        source: 'usage'
      };
    }
    return {
      param_name,
      inferred_type: 'int',
      confidence: 'inferred',
      source: 'usage'
    };
  }
  
  if (usage_hints.includes('called_as_function')) {
    return {
      param_name,
      inferred_type: 'Callable',
      confidence: 'inferred',
      source: 'usage'
    };
  }
  
  if (usage_hints.includes('file_operations')) {
    return {
      param_name,
      inferred_type: 'IO',
      confidence: 'inferred',
      source: 'usage'
    };
  }
  
  return undefined;
}

/**
 * Recursively analyze nodes for Python parameter usage
 */
function analyze_python_node_for_usage(
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
      // Subscript: param[index]
      if (parent.type === 'subscript' && 
          parent.childForFieldName('value') === node) {
        usage_hints.push('list_operations');
      }
      
      // Attribute access: param.method()
      if (parent.type === 'attribute' && 
          parent.childForFieldName('object') === node) {
        const attr = parent.childForFieldName('attribute');
        if (attr) {
          const attr_name = source_code.substring(attr.startIndex, attr.endIndex);
          
          // List methods
          if (['append', 'extend', 'insert', 'remove', 'pop', 'clear',
               'index', 'count', 'sort', 'reverse'].includes(attr_name)) {
            usage_hints.push('list_operations');
          }
          // Dict methods
          else if (['keys', 'values', 'items', 'get', 'pop', 'popitem',
                    'clear', 'update', 'setdefault'].includes(attr_name)) {
            usage_hints.push('dict_operations');
          }
          // String methods
          else if (['upper', 'lower', 'strip', 'split', 'replace', 'find',
                    'startswith', 'endswith', 'join', 'format'].includes(attr_name)) {
            usage_hints.push('string_operations');
          }
          // File methods
          else if (['read', 'write', 'readline', 'readlines', 'seek',
                    'tell', 'close', 'flush'].includes(attr_name)) {
            usage_hints.push('file_operations');
          }
        }
      }
      
      // Function call: param()
      if (parent.type === 'call' && 
          parent.childForFieldName('function') === node) {
        usage_hints.push('called_as_function');
      }
      
      // Binary operations
      if (parent.type === 'binary_operator') {
        const operator = parent.childForFieldName('operator');
        if (operator) {
          const op = source_code.substring(operator.startIndex, operator.endIndex);
          // Arithmetic
          if (['+', '-', '*', '//', '%', '**'].includes(op)) {
            usage_hints.push('numeric_operations');
          }
          if (op === '/') {
            usage_hints.push('numeric_operations');
            usage_hints.push('float_operations');
          }
          // String concatenation
          if (op === '+') {
            // Could be string or number, we'll check other hints
          }
        }
      }
      
      // for loop iteration
      if (parent.type === 'for_statement') {
        const iter_node = parent.childForFieldName('iter');
        if (iter_node === node) {
          usage_hints.push('list_operations');
        }
      }
      
      // with statement (context manager)
      if (parent.type === 'with_statement') {
        const item = parent.childForFieldName('item');
        if (item && item === node) {
          usage_hints.push('file_operations');
        }
      }
    }
  }
  
  // Recurse to children
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      analyze_python_node_for_usage(child, param_name, usage_hints, context);
    }
  }
}

/**
 * Extract parameter types from Python function annotations at call sites
 */
export function infer_from_python_call_sites(
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
    const args = extract_python_call_arguments(call, context);
    
    // Match positional arguments
    for (let i = 0; i < Math.min(args.positional.length, parameters.length); i++) {
      const param = parameters[i];
      const arg_type = infer_python_argument_type(args.positional[i], context);
      
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
    
    // Match keyword arguments
    for (const [key, value] of args.keyword) {
      const param = parameters.find(p => p.name === key);
      if (param) {
        const arg_type = infer_python_argument_type(value, context);
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
  }
  
  return call_site_types;
}

/**
 * Extract arguments from Python call expression
 */
function extract_python_call_arguments(
  call_node: SyntaxNode,
  context: ParameterInferenceContext
): {
  positional: SyntaxNode[];
  keyword: Map<string, SyntaxNode>;
} {
  const result = {
    positional: [] as SyntaxNode[],
    keyword: new Map<string, SyntaxNode>()
  };
  
  const args_node = call_node.childForFieldName('arguments');
  if (args_node) {
    for (let i = 0; i < args_node.childCount; i++) {
      const child = args_node.child(i);
      if (child) {
        if (child.type === 'keyword_argument') {
          const name = child.childForFieldName('name');
          const value = child.childForFieldName('value');
          if (name && value) {
            const key = context.source_code.substring(
              name.startIndex,
              name.endIndex
            );
            result.keyword.set(key, value);
          }
        } else if (child.type !== '(' && child.type !== ')' && child.type !== ',') {
          result.positional.push(child);
        }
      }
    }
  }
  
  return result;
}

/**
 * Infer type from Python argument expression
 */
function infer_python_argument_type(
  arg_node: SyntaxNode,
  context: ParameterInferenceContext
): string | undefined {
  const { source_code } = context;
  
  switch (arg_node.type) {
    case 'string':
      return 'str';
    
    case 'integer':
      return 'int';
    
    case 'float':
      return 'float';
    
    case 'true':
    case 'false':
      return 'bool';
    
    case 'none':
      return 'None';
    
    case 'list':
      return 'list';
    
    case 'dictionary':
      return 'dict';
    
    case 'set':
      return 'set';
    
    case 'tuple':
      return 'tuple';
    
    case 'lambda':
      return 'Callable';
    
    case 'call':
      const func = arg_node.childForFieldName('function');
      if (func) {
        const func_name = source_code.substring(func.startIndex, func.endIndex);
        // Common constructors
        if (['list', 'dict', 'set', 'tuple', 'str', 'int', 'float', 'bool'].includes(func_name)) {
          return func_name;
        }
      }
      return undefined;
    
    default:
      return undefined;
  }
}