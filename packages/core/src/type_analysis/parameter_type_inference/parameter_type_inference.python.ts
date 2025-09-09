/**
 * Python-specific bespoke parameter type inference
 * 
 * Handles unique Python features that cannot be expressed through configuration:
 * - Docstring type extraction (Google/NumPy/Sphinx styles)
 * - Type normalization for Python-specific types
 * - Comprehension type analysis
 */

import { SyntaxNode } from 'tree-sitter';
import {
  ParameterInfo,
  ParameterTypeInfo,
  ParameterInferenceContext
} from './parameter_type_inference';

/**
 * Extract type hints from Python docstrings
 */
export function extract_docstring_type(
  param_name: string,
  func_node: SyntaxNode,
  context: ParameterInferenceContext
): string | undefined {
  const body = func_node.childForFieldName('body');
  if (!body) {
    return undefined;
  }
  
  // Look for docstring as first expression
  const first_stmt = body.child(0);
  if (!first_stmt || first_stmt.type !== 'expression_statement') {
    return undefined;
  }
  
  const expr = first_stmt.child(0);
  if (!expr || expr.type !== 'string') {
    return undefined;
  }
  
  const docstring = context.source_code.substring(expr.startIndex, expr.endIndex);
  
  // Try different docstring formats
  const google_type = extract_google_style_type(param_name, docstring);
  if (google_type) return google_type;
  
  const numpy_type = extract_numpy_style_type(param_name, docstring);
  if (numpy_type) return numpy_type;
  
  const sphinx_type = extract_sphinx_style_type(param_name, docstring);
  if (sphinx_type) return sphinx_type;
  
  return undefined;
}

/**
 * Extract type from Google-style docstring
 * Example:
 * Args:
 *     param_name (type): Description
 */
function extract_google_style_type(param_name: string, docstring: string): string | undefined {
  const regex = new RegExp(`^\\s*${param_name}\\s*\\(([^)]+)\\)`, 'm');
  const match = docstring.match(regex);
  return match ? match[1].trim() : undefined;
}

/**
 * Extract type from NumPy-style docstring
 * Example:
 * Parameters
 * ----------
 * param_name : type
 *     Description
 */
function extract_numpy_style_type(param_name: string, docstring: string): string | undefined {
  const regex = new RegExp(`^\\s*${param_name}\\s*:\\s*([^\\n]+)`, 'm');
  const match = docstring.match(regex);
  if (match) {
    // Remove trailing description if any
    const type_part = match[1].split(',')[0].trim();
    return type_part;
  }
  return undefined;
}

/**
 * Extract type from Sphinx-style docstring
 * Example:
 * :param param_name: Description
 * :type param_name: type
 */
function extract_sphinx_style_type(param_name: string, docstring: string): string | undefined {
  const regex = new RegExp(`:type\\s+${param_name}:\\s*([^\\n]+)`, 'm');
  const match = docstring.match(regex);
  return match ? match[1].trim() : undefined;
}

/**
 * Normalize Python type annotations
 */
export function normalize_python_type(type_str: string): string {
  // Handle optional types
  if (type_str.startsWith('Optional[') && type_str.endsWith(']')) {
    const inner = type_str.slice(9, -1);
    return `${normalize_python_type(inner)} | None`;
  }
  
  // Handle union types
  if (type_str.includes('Union[')) {
    return type_str.replace(/Union\[([^\]]+)\]/, (_, types) => {
      return types.split(',').map((t: string) => normalize_python_type(t.trim())).join(' | ');
    });
  }
  
  // Handle generic types
  const generic_mappings: { [key: string]: string } = {
    'List': 'list',
    'Dict': 'dict',
    'Set': 'set',
    'Tuple': 'tuple',
    'Callable': 'callable',
    'Iterable': 'iterable',
    'Iterator': 'iterator',
    'Generator': 'generator'
  };
  
  for (const [old_name, new_name] of Object.entries(generic_mappings)) {
    if (type_str.startsWith(old_name)) {
      return type_str.replace(old_name, new_name);
    }
  }
  
  return type_str;
}

/**
 * Analyze Python comprehension for type inference
 */
export function analyze_comprehension_type(
  node: SyntaxNode,
  context: ParameterInferenceContext
): string | undefined {
  const { source_code } = context;
  
  switch (node.type) {
    case 'list_comprehension':
      return 'list';
    case 'set_comprehension':
      return 'set';
    case 'dictionary_comprehension':
      return 'dict';
    case 'generator_expression':
      return 'generator';
    default:
      return undefined;
  }
}

/**
 * Infer parameter types from Python call sites
 */
export function infer_from_python_call_sites(
  func_name: string,
  parameters: ParameterInfo[],
  call_sites: SyntaxNode[],
  context: ParameterInferenceContext
): Map<string, ParameterTypeInfo[]> {
  const call_site_types = new Map<string, ParameterTypeInfo[]>();
  
  for (const call_site of call_sites) {
    const args = call_site.childForFieldName('arguments');
    if (!args) continue;
    
    let positional_index = 0;
    const keyword_args = new Map<string, string>();
    
    // Parse arguments
    for (let i = 0; i < args.childCount; i++) {
      const arg = args.child(i);
      if (!arg || arg.type === ',' || arg.type === '(' || arg.type === ')') continue;
      
      if (arg.type === 'keyword_argument') {
        // Handle keyword arguments
        const name_node = arg.childForFieldName('name');
        const value_node = arg.childForFieldName('value');
        
        if (name_node && value_node) {
          const name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
          const arg_type = infer_python_argument_type(value_node, context);
          if (arg_type) {
            keyword_args.set(name, arg_type);
          }
        }
      } else {
        // Handle positional arguments
        const param = parameters[positional_index];
        if (param) {
          const arg_type = infer_python_argument_type(arg, context);
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
        positional_index++;
      }
    }
    
    // Process keyword arguments
    for (const [name, type] of keyword_args) {
      if (!call_site_types.has(name)) {
        call_site_types.set(name, []);
      }
      call_site_types.get(name)!.push({
        param_name: name,
        inferred_type: type,
        confidence: 'inferred',
        source: 'call_site'
      });
    }
  }
  
  return call_site_types;
}

/**
 * Infer type of a Python argument expression
 */
function infer_python_argument_type(
  arg_node: SyntaxNode,
  context: ParameterInferenceContext
): string | undefined {
  const { source_code } = context;
  
  switch (arg_node.type) {
    case 'string':
    case 'concatenated_string':
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
    case 'list_comprehension':
      return 'list';
    case 'set_comprehension':
      return 'set';
    case 'dictionary_comprehension':
      return 'dict';
    case 'generator_expression':
      return 'generator';
    default:
      // Check for built-in function calls
      if (arg_node.type === 'call') {
        const func = arg_node.childForFieldName('function');
        if (func) {
          const func_name = source_code.substring(func.startIndex, func.endIndex);
          // Common type constructors
          if (['str', 'int', 'float', 'bool', 'list', 'dict', 'set', 'tuple'].includes(func_name)) {
            return func_name;
          }
        }
      }
      return undefined;
  }
}

/**
 * Check if parameter has Python-specific type hints
 */
export function has_python_type_hint(
  param: ParameterInfo,
  func_node: SyntaxNode,
  context: ParameterInferenceContext
): boolean {
  // Check for PEP 484 type annotation
  if (param.type_annotation) {
    return true;
  }
  
  // Check for docstring type hint
  const docstring_type = extract_docstring_type(param.name, func_node, context);
  return docstring_type !== undefined;
}