/**
 * Language-specific configuration for function call detection
 * 
 * This module defines the node types and field names that differ between languages,
 * allowing a single generic processor to handle all languages using configuration.
 */

import { Language } from '@ariadnejs/types';

/**
 * Configuration structure for language-specific identifiers
 */
export interface LanguageCallConfig {
  // Core call detection
  call_expression_types: string[];
  function_field: string;         // Field name for the function/callee
  arguments_field: string;
  
  // Method call detection
  method_expression_types: string[];
  method_object_field: string;    // Field name for the receiver object
  method_property_field: string;  // Field name for the method name
  
  // Function definition detection (for enclosing function)
  function_definition_types: string[];
  function_name_fields: string[];  // Possible fields containing function name
  
  // Constructor detection patterns
  constructor_patterns: {
    new_expression_type?: string;        // e.g., "new_expression" for JS
    capitalized_convention: boolean;     // Whether capitalized = constructor
    struct_literal_type?: string;        // For Rust struct literals
  };
  
  // Special node types for this language
  special_types?: {
    macro_invocation?: string;          // Rust macros
    decorator?: string;                 // Python/TS decorators
    comprehension_types?: string[];     // Python comprehensions
    await_expression?: string;
    generator_expression?: string;
  };
}

/**
 * Language configurations for all supported languages
 */
export const LANGUAGE_CONFIGS: Record<Language, LanguageCallConfig> = {
  javascript: {
    call_expression_types: ['call_expression', 'new_expression'],
    function_field: 'function',
    arguments_field: 'arguments',
    
    method_expression_types: ['member_expression'],
    method_object_field: 'object',
    method_property_field: 'property',
    
    function_definition_types: [
      'function_declaration',
      'function_expression',
      'arrow_function',
      'method_definition'
    ],
    function_name_fields: ['name', 'key'],
    
    constructor_patterns: {
      new_expression_type: 'new_expression',
      capitalized_convention: true
    },
    
    special_types: {
      await_expression: 'await_expression',
      generator_expression: 'generator_function'
    }
  },
  
  typescript: {
    // TypeScript extends JavaScript configuration
    call_expression_types: ['call_expression', 'new_expression'],
    function_field: 'function',
    arguments_field: 'arguments',
    
    method_expression_types: ['member_expression'],
    method_object_field: 'object',
    method_property_field: 'property',
    
    function_definition_types: [
      'function_declaration',
      'function_expression',
      'arrow_function',
      'method_definition',
      'method_signature'  // TypeScript-specific
    ],
    function_name_fields: ['name', 'key'],
    
    constructor_patterns: {
      new_expression_type: 'new_expression',
      capitalized_convention: true
    },
    
    special_types: {
      await_expression: 'await_expression',
      generator_expression: 'generator_function',
      decorator: 'decorator'  // TypeScript decorators
    }
  },
  
  python: {
    call_expression_types: ['call'],
    function_field: 'function',  // Python actually uses 'function' field
    arguments_field: 'arguments',
    
    method_expression_types: ['attribute'],
    method_object_field: 'object',
    method_property_field: 'attribute',  // Python uses 'attribute' field name
    
    function_definition_types: ['function_definition'],
    function_name_fields: ['name'],
    
    constructor_patterns: {
      // Python doesn't have 'new' keyword, uses capitalization convention
      capitalized_convention: true
    },
    
    special_types: {
      await_expression: 'await',
      decorator: 'decorator',
      comprehension_types: [
        'list_comprehension',
        'dictionary_comprehension',
        'set_comprehension',
        'generator_expression'
      ]
    }
  },
  
  rust: {
    call_expression_types: ['call_expression'],
    function_field: 'function',
    arguments_field: 'arguments',
    
    method_expression_types: ['field_expression', 'scoped_identifier'],
    method_object_field: 'value',  // Rust uses 'value' for the receiver
    method_property_field: 'field',
    
    function_definition_types: ['function_item', 'closure_expression'],
    function_name_fields: ['name'],
    
    constructor_patterns: {
      // Rust uses struct literals and enum variants
      capitalized_convention: true,
      struct_literal_type: 'struct_expression'
    },
    
    special_types: {
      macro_invocation: 'macro_invocation',
      await_expression: 'await_expression'
    }
  }
};

/**
 * Helper to get configuration for a language
 */
export function get_language_config(language: Language): LanguageCallConfig {
  const config = LANGUAGE_CONFIGS[language];
  if (!config) {
    throw new Error(`Unsupported language: ${language}`);
  }
  return config;
}

/**
 * Check if a node type represents a call expression for the given language
 */
export function is_call_expression(node_type: string, language: Language): boolean {
  const config = get_language_config(language);
  return config.call_expression_types.includes(node_type);
}

/**
 * Check if a node type represents a method expression for the given language
 */
export function is_method_expression(node_type: string, language: Language): boolean {
  const config = get_language_config(language);
  return config.method_expression_types.includes(node_type);
}

/**
 * Check if a node type represents a function definition for the given language
 */
export function is_function_definition(node_type: string, language: Language): boolean {
  const config = get_language_config(language);
  return config.function_definition_types.includes(node_type);
}