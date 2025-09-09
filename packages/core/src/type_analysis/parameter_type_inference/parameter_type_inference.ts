/**
 * Core parameter type inference functionality
 * 
 * Configuration-driven generic parameter extraction and type inference
 */

import { SyntaxNode } from 'tree-sitter';
import { FunctionDefinition, Language } from '@ariadnejs/types';
import {
  getLanguageConfig,
  isParameterNode,
  isTypedParameterNode,
  isRestParameterNode,
  getSpecialParameterType,
  getDefaultTypes
} from './language_configs';

// Bespoke JavaScript handlers
import {
  extract_jsdoc_parameter_types,
  analyze_javascript_parameter_usage,
} from './parameter_type_inference.javascript';

// Bespoke TypeScript handlers
import {
  resolve_overload_parameters,
} from './parameter_type_inference.typescript';

// Bespoke Python handlers
import {
  extract_docstring_type,
  normalize_python_type,
} from './parameter_type_inference.python';

// Bespoke Rust handlers
import {
  handle_pattern_parameters,
} from './parameter_type_inference.rust';

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
  return isParameterNode(node.type, language);
}

/**
 * Extract information from a parameter node using configuration
 */
function extract_parameter_info(
  param_node: SyntaxNode,
  position: number,
  context: ParameterInferenceContext
): ParameterInfo | undefined {
  const { language, source_code } = context;
  const config = getLanguageConfig(language);
  
  const info: ParameterInfo = {
    name: '',
    position
  };
  
  // Extract name based on node type and field mappings
  const extractName = (node: SyntaxNode): string => {
    return source_code.substring(node.startIndex, node.endIndex);
  };
  
  // Handle different parameter types using configuration
  if (param_node.type === 'identifier') {
    info.name = extractName(param_node);
  } else if (isRestParameterNode(param_node.type, language)) {
    // Rest parameters
    info.is_rest = true;
    
    // Skip prefix characters to get the identifier
    const child = param_node.child(1);  // Usually the identifier after prefix
    if (child) {
      info.name = extractName(child);
    }
    
    // Check for keyword-only rest (Python **kwargs)
    if (param_node.type === 'dictionary_splat_pattern') {
      info.is_keyword_only = true;
    }
  } else if (isTypedParameterNode(param_node.type, language)) {
    // Typed parameters
    const fields = config.field_mappings;
    
    // Handle Python typed_parameter specially
    if (language === 'python' && param_node.type === 'typed_parameter') {
      // In Python, typed_parameter has children: identifier, ':', type
      const identifier = param_node.child(0);  // First child is the identifier
      const typeNode = param_node.childForFieldName('type');
      
      if (identifier && identifier.type === 'identifier') {
        info.name = extractName(identifier);
      }
      if (typeNode) {
        info.type_annotation = extractName(typeNode);
      }
    } else {
      // Try different field names for the identifier
      const nameNode = fields.pattern ? param_node.childForFieldName(fields.pattern) :
                       fields.identifier ? param_node.childForFieldName(fields.identifier) :
                       fields.name ? param_node.childForFieldName(fields.name) :
                       param_node.child(0);  // Fallback to first child
      
      if (nameNode) {
        info.name = extractName(nameNode);
      }
      
      // Extract type annotation
      if (fields.type) {
        const typeNode = param_node.childForFieldName(fields.type);
        if (typeNode) {
          // Remove leading colon and whitespace for TypeScript
          let type_text = extractName(typeNode);
          if (language === 'typescript' && type_text.startsWith(':')) {
            type_text = type_text.substring(1).trim();
          }
          info.type_annotation = type_text;
        }
      }
    }
    
    // Extract default value
    if (fields.value) {
      const valueNode = param_node.childForFieldName(fields.value);
      if (valueNode) {
        info.default_value = extractName(valueNode);
      }
    }
    
    // Check if optional (TypeScript)
    if (param_node.type === 'optional_parameter') {
      info.is_optional = true;
    }
  } else if (config.default_parameter_node_types.includes(param_node.type)) {
    // Parameters with default values
    const fields = config.field_mappings;
    
    // Extract name and value based on field mappings
    if (fields.left && fields.right) {
      // JavaScript/TypeScript assignment pattern
      const leftNode = param_node.childForFieldName(fields.left);
      const rightNode = param_node.childForFieldName(fields.right);
      
      if (leftNode) {
        info.name = extractName(leftNode);
      }
      if (rightNode) {
        info.default_value = extractName(rightNode);
      }
    } else if (fields.name && fields.value) {
      // Python default parameter
      const nameNode = param_node.childForFieldName(fields.name);
      const valueNode = param_node.childForFieldName(fields.value);
      
      if (nameNode) {
        // Handle typed default parameters
        if (isTypedParameterNode(nameNode.type, language)) {
          const identNode = nameNode.childForFieldName(fields.identifier || 'identifier');
          const typeNode = nameNode.childForFieldName(fields.type || 'type');
          
          if (identNode) {
            info.name = extractName(identNode);
          }
          if (typeNode) {
            info.type_annotation = extractName(typeNode);
          }
        } else {
          info.name = extractName(nameNode);
        }
      }
      if (valueNode) {
        info.default_value = extractName(valueNode);
      }
    }
  } else if (param_node.type === 'self_parameter') {
    // Rust self parameter
    info.name = 'self';
    const text = extractName(param_node);
    if (text.includes('&')) {
      info.type_annotation = text.includes('mut') ? '&mut Self' : '&Self';
    } else {
      info.type_annotation = 'Self';
    }
  } else if (param_node.type === 'parameter') {
    // Rust regular parameter
    const fields = config.field_mappings;
    
    if (fields.pattern) {
      const patternNode = param_node.childForFieldName(fields.pattern);
      if (patternNode) {
        info.name = extractName(patternNode);
      }
    }
    if (fields.type) {
      const typeNode = param_node.childForFieldName(fields.type);
      if (typeNode) {
        info.type_annotation = extractName(typeNode);
      }
    }
  }
  
  return info.name ? info : undefined;
}


/**
 * Infer type from default value using configuration
 */
function infer_type_from_default(
  default_value: string,
  language: Language
): ParameterTypeInfo | undefined {
  const defaults = getDefaultTypes(language);
  
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
  
  if (default_value === 'null' || default_value === 'None' || default_value === 'undefined') {
    return {
      param_name: '',
      inferred_type: default_value === 'None' ? 'None' : 
                      default_value === 'undefined' ? defaults.void_type : 'null',
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
      inferred_type: language === 'python' ? 'list' : defaults.array_type,
      confidence: 'inferred',
      source: 'default'
    };
  }
  
  // Object/dict literals
  if ((default_value.startsWith('{') && default_value.endsWith('}')) ||
      (language === 'python' && default_value === '{}')) {
    return {
      param_name: '',
      inferred_type: language === 'python' ? 'dict' : defaults.object_type,
      confidence: 'inferred',
      source: 'default'
    };
  }
  
  return undefined;
}

/**
 * Check for common parameter patterns using configuration
 */
function check_parameter_patterns(
  param: ParameterInfo,
  context: ParameterInferenceContext
): ParameterTypeInfo | undefined {
  const { name } = param;
  const { language, class_name } = context;
  const defaults = getDefaultTypes(language);
  
  // Check for special parameters first (self, cls)
  const special_type = getSpecialParameterType(name, language, class_name);
  if (special_type) {
    return {
      param_name: name,
      inferred_type: special_type,
      confidence: 'explicit',
      source: 'pattern'
    };
  }
  
  // Callback pattern
  if (name === 'callback' || name === 'cb' || name.endsWith('Callback')) {
    return {
      param_name: name,
      inferred_type: defaults.function_type,
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
      inferred_type: defaults.object_type,
      confidence: 'assumed',
      source: 'pattern'
    };
  }
  
  // Array/list pattern
  if (name === 'items' || name === 'elements' || name.endsWith('List') || name.endsWith('Array')) {
    return {
      param_name: name,
      inferred_type: defaults.array_type,
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
 * Infer parameter types for a function definition
 */
function infer_parameter_types(
  func_def: FunctionDefinition,
  func_node: SyntaxNode,
  context: ParameterInferenceContext
): ParameterAnalysis {
  // Extract parameters using configuration
  const parameters = extract_parameters(func_node, context);
  
  // Infer types using configuration + bespoke handlers
  const inferred_types = infer_parameter_types_by_language(
    func_def,
    func_node,
    parameters,
    context
  );
  
  return {
    function_name: func_def.name,
    parameters,
    inferred_types
  };
}

/**
 * Infer parameter types using configuration and bespoke handlers
 */
function infer_parameter_types_by_language(
  func_def: FunctionDefinition,
  func_node: SyntaxNode,
  parameters: ParameterInfo[],
  context: ParameterInferenceContext
): Map<string, ParameterTypeInfo> {
  const inferred_types = new Map<string, ParameterTypeInfo>();
  const defaults = getDefaultTypes(context.language);
  
  // Generic configuration-driven inference (85% of logic)
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
      const type_from_default = infer_type_from_default(param.default_value, context.language);
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
    
    // Rest parameters
    if (param.is_rest) {
      const config = getLanguageConfig(context.language);
      const rest_type = param.is_keyword_only ? 
        config.rest_patterns.keyword_type || config.rest_patterns.default_type :
        config.rest_patterns.default_type;
      
      inferred_types.set(param.name, {
        param_name: param.name,
        inferred_type: rest_type,
        confidence: 'inferred',
        source: 'pattern'
      });
      continue;
    }
    
    // Optional parameters (TypeScript)
    if (param.is_optional && context.language === 'typescript') {
      inferred_types.set(param.name, {
        param_name: param.name,
        inferred_type: `${defaults.any_type} | undefined`,
        confidence: 'inferred',
        source: 'pattern'
      });
      continue;
    }
  }
  
  // Apply language-specific bespoke handlers
  const bespoke_types = apply_bespoke_handlers(
    func_def,
    func_node,
    parameters,
    context
  );
  
  // Merge bespoke results, preferring them over generic inference
  for (const [name, type_info] of bespoke_types) {
    if (!inferred_types.has(name) || inferred_types.get(name)!.confidence === 'assumed') {
      inferred_types.set(name, type_info);
    }
  }
  
  // Set default type for any remaining untyped parameters
  for (const param of parameters) {
    if (!inferred_types.has(param.name)) {
      inferred_types.set(param.name, {
        param_name: param.name,
        inferred_type: defaults.any_type,
        confidence: 'assumed',
        source: 'pattern'
      });
    }
  }
  
  return inferred_types;
}

/**
 * Apply language-specific bespoke handlers
 */
function apply_bespoke_handlers(
  func_def: FunctionDefinition,
  func_node: SyntaxNode,
  parameters: ParameterInfo[],
  context: ParameterInferenceContext
): Map<string, ParameterTypeInfo> {
  const bespoke_types = new Map<string, ParameterTypeInfo>();
  
  switch (context.language) {
    case 'javascript':
      // Extract JSDoc types
      const jsdoc_types = extract_jsdoc_parameter_types(func_node, parameters, context);
      for (const [name, type_info] of jsdoc_types) {
        bespoke_types.set(name, type_info);
      }
      
      // Analyze usage for untyped parameters
      for (const param of parameters) {
        if (!bespoke_types.has(param.name) && !param.type_annotation) {
          const usage_type = analyze_javascript_parameter_usage(param.name, func_node, context);
          if (usage_type) {
            bespoke_types.set(param.name, usage_type);
          }
        }
      }
      break;
      
    case 'typescript':
      // Handle overloads
      const resolved_params = resolve_overload_parameters(func_def, func_node, parameters, context);
      for (const param of resolved_params) {
        if (param.type_annotation && param.type_annotation !== parameters.find(p => p.name === param.name)?.type_annotation) {
          bespoke_types.set(param.name, {
            param_name: param.name,
            inferred_type: param.type_annotation,
            confidence: 'explicit',
            source: 'annotation'
          });
        }
      }
      break;
      
    case 'python':
      // Extract docstring types
      for (const param of parameters) {
        if (!param.type_annotation) {
          const docstring_type = extract_docstring_type(param.name, func_node, context);
          if (docstring_type) {
            bespoke_types.set(param.name, {
              param_name: param.name,
              inferred_type: normalize_python_type(docstring_type),
              confidence: 'explicit',
              source: 'annotation'
            });
          }
        }
      }
      break;
      
    case 'rust':
      // Handle pattern parameters
      for (const param of parameters) {
        // Pattern parameters require special handling
        const param_node = func_node.childForFieldName('parameters')?.child(param.position);
        if (param_node) {
          const pattern_params = handle_pattern_parameters(param_node, context);
          for (const pp of pattern_params) {
            if (pp.type_annotation) {
              bespoke_types.set(pp.name, {
                param_name: pp.name,
                inferred_type: pp.type_annotation,
                confidence: 'explicit',
                source: 'annotation'
              });
            }
          }
        }
      }
      break;
  }
  
  return bespoke_types;
}

// Export the main API function that file_analyzer should actually use
export { infer_parameter_types };

// Export internal functions for testing only
// These should not be imported by external modules
export {
  infer_type_from_default,
  check_parameter_patterns,
};
