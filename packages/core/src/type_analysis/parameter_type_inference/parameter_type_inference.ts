/**
 * Core parameter type inference functionality
 * 
 * Infers types for function parameters from:
 * - Type annotations (explicit)
 * - Default values
 * - Call site arguments
 * - Usage within function body
 */

// TODO: Integration with Function Calls
// - Analyze argument types at call sites
// TODO: Integration with Type Tracking
// - Update type context with parameters
// TODO: Integration with Method Calls
// - Consider receiver type for context

import { SyntaxNode } from 'tree-sitter';
import { Def, Language } from '@ariadnejs/types';

/**
 * Information about a function parameter
 */
export interface ParameterInfo {
  name: string;
  position: number;
  type_annotation?: string;
  default_value?: string;
  is_rest?: boolean;
  is_keyword_only?: boolean;
  is_optional?: boolean;
}

/**
 * Inferred type information for a parameter
 */
export interface ParameterTypeInfo {
  param_name: string;
  inferred_type: string;
  confidence: 'explicit' | 'inferred' | 'assumed';
  source: 'annotation' | 'default' | 'call_site' | 'usage' | 'pattern';
}

/**
 * Analysis result for all parameters of a function
 */
export interface ParameterAnalysis {
  function_name: string;
  parameters: ParameterInfo[];
  inferred_types: Map<string, ParameterTypeInfo>;
}

/**
 * Context for parameter type inference
 */
export interface ParameterInferenceContext {
  language: Language;
  source_code: string;
  file_path?: string;
  class_name?: string;
  debug?: boolean;
}

/**
 * Extract parameter information from function node
 */
export function extract_parameters(
  func_node: SyntaxNode,
  context: ParameterInferenceContext
): ParameterInfo[] {
  const params_node = func_node.childForFieldName('parameters');
  if (!params_node) {
    return [];
  }
  
  const parameters: ParameterInfo[] = [];
  let position = 0;
  
  for (let i = 0; i < params_node.childCount; i++) {
    const param = params_node.child(i);
    if (param && is_parameter_node(param, context.language)) {
      const param_info = extract_parameter_info(param, position, context);
      if (param_info) {
        parameters.push(param_info);
        position++;
      }
    }
  }
  
  return parameters;
}

/**
 * Check if a node represents a parameter
 */
function is_parameter_node(node: SyntaxNode, language: Language): boolean {
  switch (language) {
    case 'javascript':
    case 'typescript':
      return node.type === 'identifier' || 
             node.type === 'required_parameter' ||
             node.type === 'optional_parameter' ||
             node.type === 'rest_pattern' ||
             node.type === 'assignment_pattern';  // Parameters with defaults
    case 'python':
      return node.type === 'identifier' ||
             node.type === 'typed_parameter' ||
             node.type === 'default_parameter' ||
             node.type === 'dictionary_splat_pattern' ||
             node.type === 'list_splat_pattern';
    case 'rust':
      return node.type === 'parameter' ||
             node.type === 'self_parameter';
    default:
      return false;
  }
}

/**
 * Extract information from a parameter node
 */
function extract_parameter_info(
  param_node: SyntaxNode,
  position: number,
  context: ParameterInferenceContext
): ParameterInfo | undefined {
  const { language, source_code } = context;
  
  switch (language) {
    case 'javascript':
    case 'typescript':
      return extract_js_ts_parameter(param_node, position, source_code);
    case 'python':
      return extract_python_parameter(param_node, position, source_code);
    case 'rust':
      return extract_rust_parameter(param_node, position, source_code);
    default:
      return undefined;
  }
}

/**
 * Extract JavaScript/TypeScript parameter info
 */
function extract_js_ts_parameter(
  param_node: SyntaxNode,
  position: number,
  source_code: string
): ParameterInfo {
  const info: ParameterInfo = {
    name: '',
    position
  };
  
  // Handle different parameter types
  if (param_node.type === 'identifier') {
    info.name = source_code.substring(param_node.startIndex, param_node.endIndex);
  } else if (param_node.type === 'assignment_pattern') {
    // JavaScript parameter with default value
    const left = param_node.childForFieldName('left');
    const right = param_node.childForFieldName('right');
    
    if (left) {
      info.name = source_code.substring(left.startIndex, left.endIndex);
    }
    if (right) {
      info.default_value = source_code.substring(right.startIndex, right.endIndex);
    }
  } else if (param_node.type === 'required_parameter' || param_node.type === 'optional_parameter') {
    // TypeScript parameters
    const pattern = param_node.childForFieldName('pattern');
    const type = param_node.childForFieldName('type');
    const value = param_node.childForFieldName('value');
    
    if (pattern) {
      info.name = source_code.substring(pattern.startIndex, pattern.endIndex);
    }
    if (type) {
      // Remove leading colon and whitespace
      const type_text = source_code.substring(type.startIndex, type.endIndex);
      info.type_annotation = type_text.replace(/^:\s*/, '');
    }
    if (value) {
      info.default_value = source_code.substring(value.startIndex, value.endIndex);
    }
    if (param_node.type === 'optional_parameter') {
      info.is_optional = true;
    }
  } else if (param_node.type === 'rest_pattern') {
    const pattern = param_node.child(1); // Skip '...'
    if (pattern) {
      info.name = source_code.substring(pattern.startIndex, pattern.endIndex);
    }
    info.is_rest = true;
  }
  
  return info;
}

/**
 * Extract Python parameter info
 */
function extract_python_parameter(
  param_node: SyntaxNode,
  position: number,
  source_code: string
): ParameterInfo {
  const info: ParameterInfo = {
    name: '',
    position
  };
  
  if (param_node.type === 'identifier') {
    info.name = source_code.substring(param_node.startIndex, param_node.endIndex);
  } else if (param_node.type === 'typed_parameter') {
    // In Python, typed_parameter has children: identifier, ':', type
    const identifier = param_node.child(0);  // First child is the identifier
    const type = param_node.childForFieldName('type');
    
    if (identifier && identifier.type === 'identifier') {
      info.name = source_code.substring(identifier.startIndex, identifier.endIndex);
    }
    if (type) {
      info.type_annotation = source_code.substring(type.startIndex, type.endIndex);
    }
  } else if (param_node.type === 'default_parameter') {
    const name = param_node.childForFieldName('name');
    const value = param_node.childForFieldName('value');
    
    if (name) {
      // Handle typed default parameters
      if (name.type === 'typed_parameter') {
        const identifier = name.childForFieldName('identifier');
        const type = name.childForFieldName('type');
        if (identifier) {
          info.name = source_code.substring(identifier.startIndex, identifier.endIndex);
        }
        if (type) {
          info.type_annotation = source_code.substring(type.startIndex, type.endIndex);
        }
      } else {
        info.name = source_code.substring(name.startIndex, name.endIndex);
      }
    }
    if (value) {
      info.default_value = source_code.substring(value.startIndex, value.endIndex);
    }
  } else if (param_node.type === 'dictionary_splat_pattern') {
    const identifier = param_node.child(1); // Skip '**'
    if (identifier) {
      info.name = source_code.substring(identifier.startIndex, identifier.endIndex);
    }
    info.is_rest = true;
    info.is_keyword_only = true;
  } else if (param_node.type === 'list_splat_pattern') {
    const identifier = param_node.child(1); // Skip '*'
    if (identifier) {
      info.name = source_code.substring(identifier.startIndex, identifier.endIndex);
    }
    info.is_rest = true;
  }
  
  return info;
}

/**
 * Extract Rust parameter info
 */
function extract_rust_parameter(
  param_node: SyntaxNode,
  position: number,
  source_code: string
): ParameterInfo {
  const info: ParameterInfo = {
    name: '',
    position
  };
  
  if (param_node.type === 'self_parameter') {
    info.name = 'self';
    // Check for &self, &mut self, etc.
    const text = source_code.substring(param_node.startIndex, param_node.endIndex);
    if (text.includes('&')) {
      info.type_annotation = text.includes('mut') ? '&mut Self' : '&Self';
    } else {
      info.type_annotation = 'Self';
    }
  } else if (param_node.type === 'parameter') {
    const pattern = param_node.childForFieldName('pattern');
    const type = param_node.childForFieldName('type');
    
    if (pattern) {
      info.name = source_code.substring(pattern.startIndex, pattern.endIndex);
    }
    if (type) {
      info.type_annotation = source_code.substring(type.startIndex, type.endIndex);
    }
  }
  
  return info;
}

/**
 * Infer type from default value
 */
export function infer_type_from_default(
  default_value: string,
  language: Language
): ParameterTypeInfo | undefined {
  // Simple literal detection
  if (default_value === 'true' || default_value === 'false' || 
      default_value === 'True' || default_value === 'False') {
    return {
      param_name: '',
      inferred_type: language === 'python' ? 'bool' : 'boolean',
      confidence: 'inferred',
      source: 'default'
    };
  }
  
  if (default_value === 'null' || default_value === 'None') {
    return {
      param_name: '',
      inferred_type: language === 'python' ? 'None' : 'null',
      confidence: 'inferred',
      source: 'default'
    };
  }
  
  // String literals
  if ((default_value.startsWith('"') && default_value.endsWith('"')) ||
      (default_value.startsWith("'") && default_value.endsWith("'"))) {
    return {
      param_name: '',
      inferred_type: language === 'python' ? 'str' : 'string',
      confidence: 'inferred',
      source: 'default'
    };
  }
  
  // Number literals
  if (/^-?\d+(\.\d+)?$/.test(default_value)) {
    if (default_value.includes('.')) {
      return {
        param_name: '',
        inferred_type: language === 'python' ? 'float' : 'number',
        confidence: 'inferred',
        source: 'default'
      };
    } else {
      return {
        param_name: '',
        inferred_type: language === 'python' ? 'int' : 'number',
        confidence: 'inferred',
        source: 'default'
      };
    }
  }
  
  // Array literals
  if (default_value.startsWith('[') && default_value.endsWith(']')) {
    return {
      param_name: '',
      inferred_type: language === 'python' ? 'list' : 'Array',
      confidence: 'inferred',
      source: 'default'
    };
  }
  
  // Object/dict literals
  if ((default_value.startsWith('{') && default_value.endsWith('}')) ||
      (language === 'python' && default_value === '{}')) {
    return {
      param_name: '',
      inferred_type: language === 'python' ? 'dict' : 'Object',
      confidence: 'inferred',
      source: 'default'
    };
  }
  
  return undefined;
}

/**
 * Check for common parameter patterns
 */
export function check_parameter_patterns(
  param: ParameterInfo,
  context: ParameterInferenceContext
): ParameterTypeInfo | undefined {
  const { name } = param;
  const { language } = context;
  
  // Callback pattern
  if (name === 'callback' || name === 'cb' || name.endsWith('Callback')) {
    return {
      param_name: name,
      inferred_type: 'Function',
      confidence: 'assumed',
      source: 'pattern'
    };
  }
  
  // Error pattern
  if (name === 'error' || name === 'err' || name === 'e') {
    return {
      param_name: name,
      inferred_type: language === 'python' ? 'Exception' : 'Error',
      confidence: 'assumed',
      source: 'pattern'
    };
  }
  
  // Options/config pattern
  if (name === 'options' || name === 'opts' || name === 'config') {
    return {
      param_name: name,
      inferred_type: language === 'python' ? 'dict' : 'Object',
      confidence: 'assumed',
      source: 'pattern'
    };
  }
  
  // Array/list pattern
  if (name === 'items' || name === 'elements' || name.endsWith('List') || name.endsWith('Array')) {
    return {
      param_name: name,
      inferred_type: language === 'python' ? 'list' : 'Array',
      confidence: 'assumed',
      source: 'pattern'
    };
  }
  
  // Boolean pattern
  if (name.startsWith('is') || name.startsWith('has') || name.startsWith('should') || 
      name === 'enabled' || name === 'disabled' || name === 'flag') {
    return {
      param_name: name,
      inferred_type: language === 'python' ? 'bool' : 'boolean',
      confidence: 'assumed',
      source: 'pattern'
    };
  }
  
  // Number pattern
  if (name === 'count' || name === 'index' || name === 'size' || name === 'length' ||
      name === 'width' || name === 'height' || name === 'offset' || name === 'limit') {
    return {
      param_name: name,
      inferred_type: language === 'python' ? 'int' : 'number',
      confidence: 'assumed',
      source: 'pattern'
    };
  }
  
  // String pattern
  if (name === 'name' || name === 'id' || name === 'key' || name === 'value' ||
      name === 'message' || name === 'text' || name === 'path' || name === 'url') {
    return {
      param_name: name,
      inferred_type: language === 'python' ? 'str' : 'string',
      confidence: 'assumed',
      source: 'pattern'
    };
  }
  
  return undefined;
}

/**
 * Get void/None type for language
 */
export function get_void_type(language: Language): string {
  switch (language) {
    case 'python':
      return 'None';
    case 'rust':
      return '()';
    default:
      return 'void';
  }
}

/**
 * Get any/unknown type for language
 */
export function get_any_type(language: Language): string {
  switch (language) {
    case 'python':
      return 'Any';
    case 'typescript':
      return 'any';
    case 'rust':
      return 'dyn Any';
    default:
      return 'any';
  }
}

/**
 * Check if a parameter has explicit type annotation
 */
export function has_explicit_type(param: ParameterInfo): boolean {
  return param.type_annotation !== undefined;
}

/**
 * Get the most specific type from multiple inferred types
 */
export function resolve_parameter_type(
  inferred_types: ParameterTypeInfo[]
): ParameterTypeInfo | undefined {
  if (inferred_types.length === 0) {
    return undefined;
  }
  
  // Prefer explicit > inferred > assumed
  const sorted = inferred_types.sort((a, b) => {
    const confidence_order = { 'explicit': 0, 'inferred': 1, 'assumed': 2 };
    return confidence_order[a.confidence] - confidence_order[b.confidence];
  });
  
  return sorted[0];
}