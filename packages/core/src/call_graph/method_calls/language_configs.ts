/**
 * Language-specific configuration for method call detection
 * 
 * This configuration captures all the generic patterns that differ between languages
 * but don't require custom logic - just different identifiers and node types.
 */

import { Language } from '@ariadnejs/types';

/**
 * Configuration schema for method call detection
 */
export interface MethodCallConfig {
  // Node types that represent call expressions
  call_node_types: string[];
  
  // Field name for the function/method being called
  function_field: string;
  
  // Node types that represent member access (object.method)
  member_access_types: string[];
  
  // Field names for extracting parts of member access
  member_fields: {
    receiver: string;  // Field for the object/receiver (left side)
    method: string;    // Field for the method name (right side)
  };
  
  // Additional receiver field for special cases (e.g., Rust scoped identifiers)
  alternate_member_fields?: {
    node_type: string;
    receiver: string;
    method: string;
  }[];
  
  // Node types that represent class/struct definitions
  class_definition_types: string[];
  
  // Field name for class/struct name
  class_name_field: string;
  
  // Node types for function/method definitions
  function_definition_types: string[];
  
  // Field name for function/method name
  function_name_field: string;
  
  // Method definition node type (if different from function)
  method_definition_type?: string;
  
  // Field name for method key/name in method definitions
  method_key_field?: string;
  
  // Arguments node field name
  arguments_field: string;
  
  // Tokens to skip when counting arguments
  argument_skip_tokens: string[];
  
  // Special receiver names that indicate static/class methods
  static_receiver_indicators: string[];
  
  // Whether uppercase receiver names indicate static methods
  uppercase_indicates_static: boolean;
}

/**
 * JavaScript configuration
 */
const JAVASCRIPT_CONFIG: MethodCallConfig = {
  call_node_types: ['call_expression'],
  function_field: 'function',
  member_access_types: ['member_expression'],
  member_fields: {
    receiver: 'object',
    method: 'property'
  },
  class_definition_types: ['class_declaration', 'class'],
  class_name_field: 'name',
  function_definition_types: ['function_declaration', 'function_expression', 'arrow_function'],
  function_name_field: 'name',
  method_definition_type: 'method_definition',
  method_key_field: 'name',
  arguments_field: 'arguments',
  argument_skip_tokens: ['(', ')', ',', 'comment'],
  static_receiver_indicators: [],
  uppercase_indicates_static: true
};

/**
 * TypeScript configuration (extends JavaScript)
 */
const TYPESCRIPT_CONFIG: MethodCallConfig = {
  ...JAVASCRIPT_CONFIG,
  // TypeScript uses the same configuration as JavaScript for basic method calls
  // The differences (type arguments, etc.) are handled by bespoke logic
};

/**
 * Python configuration
 */
const PYTHON_CONFIG: MethodCallConfig = {
  call_node_types: ['call'],
  function_field: 'function',  // Python uses 'function' field
  member_access_types: ['attribute'],
  member_fields: {
    receiver: 'object',
    method: 'attribute'  // Python uses 'attribute' not 'attr'
  },
  class_definition_types: ['class_definition'],
  class_name_field: 'name',
  function_definition_types: ['function_definition'],
  function_name_field: 'name',
  arguments_field: 'arguments',
  argument_skip_tokens: ['(', ')', ',', 'comment'],
  static_receiver_indicators: ['cls'],  // 'cls' indicates class method
  uppercase_indicates_static: true
};

/**
 * Rust configuration
 */
const RUST_CONFIG: MethodCallConfig = {
  call_node_types: ['call_expression'],
  function_field: 'function',
  member_access_types: ['field_expression', 'scoped_identifier', 'generic_function'],
  member_fields: {
    receiver: 'value',  // For field_expression
    method: 'field'     // For field_expression
  },
  alternate_member_fields: [
    {
      node_type: 'scoped_identifier',
      receiver: 'path',
      method: 'name'
    },
    {
      node_type: 'generic_function',
      receiver: 'value',  // The receiver part of iter.collect::<Vec<_>>
      method: 'field'     // The method name part
    }
  ],
  class_definition_types: ['struct_item', 'impl_item'],
  class_name_field: 'name',  // For struct_item
  function_definition_types: ['function_item'],
  function_name_field: 'name',
  arguments_field: 'arguments',
  argument_skip_tokens: ['(', ')', ',', 'comment'],
  static_receiver_indicators: [],
  uppercase_indicates_static: false  // Rust uses :: for associated functions
};

/**
 * Configuration map for all supported languages
 */
const LANGUAGE_CONFIGS: Record<Language, MethodCallConfig> = {
  javascript: JAVASCRIPT_CONFIG,
  typescript: TYPESCRIPT_CONFIG,
  python: PYTHON_CONFIG,
  rust: RUST_CONFIG
};

/**
 * Get configuration for a specific language
 */
export function get_method_call_config(language: Language): MethodCallConfig {
  const config = LANGUAGE_CONFIGS[language];
  if (!config) {
    throw new Error(`No method call configuration for language: ${language}`);
  }
  return config;
}

/**
 * Check if a node type represents a call expression for the given language
 */
export function is_call_node_type(node_type: string, language: Language): boolean {
  const config = get_method_call_config(language);
  return config.call_node_types.includes(node_type);
}

/**
 * Check if a node type represents member access for the given language
 */
export function is_member_access_type(node_type: string, language: Language): boolean {
  const config = get_method_call_config(language);
  return config.member_access_types.includes(node_type);
}

/**
 * Get the appropriate field name for the function in a call expression
 */
export function get_function_field_name(language: Language): string {
  const config = get_method_call_config(language);
  return config.function_field;
}

/**
 * Get member field names for a specific node type and language
 */
export function get_member_field_names(
  node_type: string,
  language: Language
): { receiver: string; method: string } | null {
  const config = get_method_call_config(language);
  
  // Check alternate fields first (for Rust scoped_identifier)
  if (config.alternate_member_fields) {
    for (const alt of config.alternate_member_fields) {
      if (alt.node_type === node_type) {
        return { receiver: alt.receiver, method: alt.method };
      }
    }
  }
  
  // Return default fields if this is a member access type
  if (config.member_access_types.includes(node_type)) {
    return config.member_fields;
  }
  
  return null;
}

/**
 * Check if a receiver name indicates a static/class method
 */
export function is_static_receiver(receiver_name: string, language: Language): boolean {
  const config = get_method_call_config(language);
  
  // Check explicit static indicators
  if (config.static_receiver_indicators.includes(receiver_name)) {
    return true;
  }
  
  // Check uppercase convention
  if (config.uppercase_indicates_static && /^[A-Z]/.test(receiver_name)) {
    return true;
  }
  
  return false;
}