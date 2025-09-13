/**
 * Language configurations for parameter type inference
 * 
 * Captures language-specific patterns and node types for generic processing
 */

import { Language } from '@ariadnejs/types';

/**
 * Configuration for parameter extraction and type inference
 */
export interface ParameterConfig {
  // AST node types that represent parameters
  parameter_node_types: string[];
  
  // AST node types for typed parameters (with annotations)
  typed_parameter_node_types: string[];
  
  // AST node types for parameters with defaults
  default_parameter_node_types: string[];
  
  // AST node types for rest/variadic parameters
  rest_parameter_node_types: string[];
  
  // Field names in AST nodes
  field_mappings: {
    pattern?: string;      // Field containing parameter name/pattern
    identifier?: string;   // Field containing identifier
    name?: string;         // Field containing name
    type?: string;         // Field containing type annotation
    value?: string;        // Field containing default value
    left?: string;         // Field for left side (e.g., assignment pattern)
    right?: string;        // Field for right side (e.g., default value)
  };
  
  // Special parameter names and their inferred types
  special_parameters: {
    [name: string]: {
      type: string;
      requires_class?: boolean;  // Type depends on class context
    };
  };
  
  // Rest parameter configuration
  rest_patterns: {
    prefix: string;           // Prefix character(s) like '...', '*', '**'
    keyword_only_prefix?: string;  // For Python's **kwargs
    default_type: string;     // Default type for rest params
    keyword_type?: string;    // Type for keyword rest params
  };
  
  // Type normalization rules
  type_mappings?: {
    [from: string]: string;
  };
  
  // Default types
  defaults: {
    any_type: string;
    void_type: string;
    array_type: string;
    object_type: string;
    function_type: string;
  };
}

/**
 * JavaScript configuration
 */
const javascript_config: ParameterConfig = {
  parameter_node_types: [
    'identifier',
    'assignment_pattern',
    'rest_pattern',
    'object_pattern',
    'array_pattern'
  ],
  
  typed_parameter_node_types: [],  // JavaScript doesn't have type annotations
  
  default_parameter_node_types: [
    'assignment_pattern'
  ],
  
  rest_parameter_node_types: [
    'rest_pattern'
  ],
  
  field_mappings: {
    left: 'left',
    right: 'right',
    pattern: 'pattern'
  },
  
  special_parameters: {},
  
  rest_patterns: {
    prefix: '...',
    default_type: 'Array'
  },
  
  defaults: {
    any_type: 'any',
    void_type: 'undefined',
    array_type: 'Array',
    object_type: 'Object',
    function_type: 'Function'
  }
};

/**
 * TypeScript configuration
 */
const typescript_config: ParameterConfig = {
  parameter_node_types: [
    'identifier',
    'required_parameter',
    'optional_parameter',
    'assignment_pattern',
    'rest_pattern',
    'object_pattern',
    'array_pattern'
  ],
  
  typed_parameter_node_types: [
    'required_parameter',
    'optional_parameter'
  ],
  
  default_parameter_node_types: [
    'assignment_pattern',
    'optional_parameter'
  ],
  
  rest_parameter_node_types: [
    'rest_pattern'
  ],
  
  field_mappings: {
    pattern: 'pattern',
    type: 'type',
    value: 'value',
    left: 'left',
    right: 'right'
  },
  
  special_parameters: {},
  
  rest_patterns: {
    prefix: '...',
    default_type: 'any[]'
  },
  
  defaults: {
    any_type: 'any',
    void_type: 'void',
    array_type: 'Array<any>',
    object_type: 'object',
    function_type: 'Function'
  }
};

/**
 * Python configuration
 */
const python_config: ParameterConfig = {
  parameter_node_types: [
    'identifier',
    'typed_parameter',
    'default_parameter',
    'list_splat_pattern',
    'dictionary_splat_pattern'
  ],
  
  typed_parameter_node_types: [
    'typed_parameter'
  ],
  
  default_parameter_node_types: [
    'default_parameter'
  ],
  
  rest_parameter_node_types: [
    'list_splat_pattern',
    'dictionary_splat_pattern'
  ],
  
  field_mappings: {
    identifier: 'identifier',
    name: 'name',
    type: 'type',
    value: 'value'
  },
  
  special_parameters: {
    'self': {
      type: 'Self',
      requires_class: true
    },
    'cls': {
      type: 'Type[Self]',
      requires_class: true
    }
  },
  
  rest_patterns: {
    prefix: '*',
    keyword_only_prefix: '**',
    default_type: 'tuple',
    keyword_type: 'dict'
  },
  
  type_mappings: {
    'str': 'str',
    'int': 'int',
    'float': 'float',
    'bool': 'bool',
    'list': 'List',
    'dict': 'Dict',
    'tuple': 'Tuple',
    'set': 'Set'
  },
  
  defaults: {
    any_type: 'Any',
    void_type: 'None',
    array_type: 'List',
    object_type: 'Dict',
    function_type: 'Callable'
  }
};

/**
 * Rust configuration
 */
const rust_config: ParameterConfig = {
  parameter_node_types: [
    'parameter',
    'self_parameter'
  ],
  
  typed_parameter_node_types: [
    'parameter'  // Rust parameters always have types
  ],
  
  default_parameter_node_types: [],  // Rust doesn't have default parameters
  
  rest_parameter_node_types: [],  // Rust doesn't have rest parameters
  
  field_mappings: {
    pattern: 'pattern',
    type: 'type'
  },
  
  special_parameters: {
    'self': {
      type: 'Self',
      requires_class: false  // Self is always valid in impl blocks
    }
  },
  
  rest_patterns: {
    prefix: '',  // No rest parameters in Rust
    default_type: ''
  },
  
  type_mappings: {
    '&self': '&Self',
    '&mut self': '&mut Self',
    'self': 'Self'
  },
  
  defaults: {
    any_type: 'dyn Any',
    void_type: '()',
    array_type: 'Vec<T>',
    object_type: 'HashMap<String, T>',
    function_type: 'Fn'
  }
};

/**
 * Language configuration map
 */
const language_configs: Record<Language, ParameterConfig> = {
  javascript: javascript_config,
  typescript: typescript_config,
  python: python_config,
  rust: rust_config
};

/**
 * Get configuration for a language
 */
export function get_language_config(language: Language): ParameterConfig {
  const config = language_configs[language];
  if (!config) {
    throw new Error(`No parameter configuration for language: ${language}`);
  }
  return config;
}

/**
 * Check if a node type represents a parameter
 */
export function is_parameter_node(node_type: string, language: Language): boolean {
  const config = get_language_config(language);
  return config.parameter_node_types.includes(node_type);
}

/**
 * Check if a node type represents a typed parameter
 */
export function is_typed_parameter_node(node_type: string, language: Language): boolean {
  const config = get_language_config(language);
  return config.typed_parameter_node_types.includes(node_type);
}

/**
 * Check if a node type represents a rest parameter
 */
export function is_rest_parameter_node(node_type: string, language: Language): boolean {
  const config = get_language_config(language);
  return config.rest_parameter_node_types.includes(node_type);
}

/**
 * Get the inferred type for a special parameter
 */
export function get_special_parameter_type(
  param_name: string,
  language: Language,
  class_name?: string
): string | undefined {
  const config = get_language_config(language);
  const special = config.special_parameters[param_name];
  
  if (!special) {
    return undefined;
  }
  
  // Handle class-dependent types
  if (special.requires_class && class_name) {
    return special.type.replace('Self', class_name);
  }
  
  return special.type;
}

/**
 * Normalize a type annotation for a language
 */
export function normalize_type(type_str: string, language: Language): string {
  const config = get_language_config(language);
  
  if (config.type_mappings) {
    return config.type_mappings[type_str] || type_str;
  }
  
  return type_str;
}

/**
 * Get default type names for a language
 */
export function get_default_types(language: Language) {
  const config = get_language_config(language);
  return config.defaults;
}