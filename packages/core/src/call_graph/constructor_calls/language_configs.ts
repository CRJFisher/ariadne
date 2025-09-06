/**
 * Language-specific configurations for constructor call detection
 * 
 * This module defines configuration-driven patterns that handle
 * 80% of constructor detection logic across all languages.
 */

import { Language } from '@ariadnejs/types';

/**
 * Configuration for language-specific constructor patterns
 */
export interface ConstructorConfig {
  // Node types that represent constructor calls
  constructor_node_types: string[];
  
  // Node types that might be constructors (need additional checks)
  potential_constructor_node_types: string[];
  
  // Field names to extract constructor/class names
  name_extraction_fields: {
    [nodeType: string]: {
      primary_field: string;
      fallback_fields?: string[];
      nested_path?: string[]; // For complex extractions like member expressions
    };
  };
  
  // Rules for identifying constructors
  identification_rules: {
    requires_new_keyword: boolean;
    capitalization_pattern?: RegExp;
    factory_method_names?: string[];
    special_patterns?: string[]; // e.g., 'Object.create' for JS
  };
  
  // Field names for extracting arguments
  arguments_field_name: string;
  
  // Assignment detection patterns
  assignment_patterns: {
    declaration_types: string[];
    assignment_field: string;
    pattern_field?: string; // For Rust's pattern matching
  };
  
  // Whether to check for factory methods
  check_factory_methods: boolean;
  
  // Special node types for language-specific features
  special_node_types?: {
    struct_literal?: string; // Rust
    enum_variant?: string;  // Rust
  };
}

/**
 * JavaScript configuration
 */
const JAVASCRIPT_CONFIG: ConstructorConfig = {
  constructor_node_types: ['new_expression'],
  
  potential_constructor_node_types: ['call_expression'],
  
  name_extraction_fields: {
    new_expression: {
      primary_field: 'constructor',
      nested_path: ['identifier', 'member_expression.property']
    },
    call_expression: {
      primary_field: 'function',
      nested_path: ['identifier']
    }
  },
  
  identification_rules: {
    requires_new_keyword: false, // Can use factory functions
    capitalization_pattern: /^[A-Z]/,
    special_patterns: ['Object.create']
  },
  
  arguments_field_name: 'arguments',
  
  assignment_patterns: {
    declaration_types: ['variable_declarator'],
    assignment_field: 'name'
  },
  
  check_factory_methods: true
};

/**
 * TypeScript configuration (extends JavaScript)
 */
const TYPESCRIPT_CONFIG: ConstructorConfig = {
  ...JAVASCRIPT_CONFIG,
  
  // TypeScript-specific overrides
  name_extraction_fields: {
    ...JAVASCRIPT_CONFIG.name_extraction_fields,
    new_expression: {
      primary_field: 'constructor',
      nested_path: ['identifier', 'member_expression.property', 'generic_type.name']
    }
  }
};

/**
 * Python configuration
 */
const PYTHON_CONFIG: ConstructorConfig = {
  constructor_node_types: [], // No explicit constructor syntax
  
  potential_constructor_node_types: ['call'],
  
  name_extraction_fields: {
    call: {
      primary_field: 'function',
      nested_path: ['identifier', 'attribute.attr']
    }
  },
  
  identification_rules: {
    requires_new_keyword: false,
    capitalization_pattern: /^[A-Z]/, // Convention for classes
    special_patterns: ['super']
  },
  
  arguments_field_name: 'arguments',
  
  assignment_patterns: {
    declaration_types: ['assignment'],
    assignment_field: 'left'
  },
  
  check_factory_methods: false // Python uses capitalization convention
};

/**
 * Rust configuration
 */
const RUST_CONFIG: ConstructorConfig = {
  constructor_node_types: ['struct_expression'],
  
  potential_constructor_node_types: ['call_expression'],
  
  name_extraction_fields: {
    call_expression: {
      primary_field: 'function',
      nested_path: ['scoped_identifier.path']
    },
    struct_expression: {
      primary_field: 'name',
      nested_path: ['type_identifier', 'identifier', 'scoped_identifier']
    }
  },
  
  identification_rules: {
    requires_new_keyword: false,
    factory_method_names: ['new', 'create', 'from', 'build', 'default', 'with_capacity', 'from_str', 'parse']
  },
  
  arguments_field_name: 'arguments',
  
  assignment_patterns: {
    declaration_types: ['let_declaration'],
    assignment_field: 'pattern',
    pattern_field: 'pattern' // Rust uses pattern matching
  },
  
  check_factory_methods: true,
  
  special_node_types: {
    struct_literal: 'struct_expression',
    enum_variant: 'call_expression' // When calling enum variants
  }
};

/**
 * Configuration registry
 */
const LANGUAGE_CONFIGS: Record<Language, ConstructorConfig> = {
  javascript: JAVASCRIPT_CONFIG,
  typescript: TYPESCRIPT_CONFIG,
  python: PYTHON_CONFIG,
  rust: RUST_CONFIG
};

/**
 * Get configuration for a specific language
 */
export function get_language_config(language: Language): ConstructorConfig {
  const config = LANGUAGE_CONFIGS[language];
  if (!config) {
    throw new Error(`No constructor configuration for language: ${language}`);
  }
  return config;
}

/**
 * Check if a node type is a constructor in the given language
 */
export function is_constructor_node_type(
  nodeType: string,
  language: Language
): boolean {
  const config = get_language_config(language);
  return config.constructor_node_types.includes(nodeType);
}

/**
 * Check if a node type might be a constructor (needs additional checks)
 */
export function is_potential_constructor_node_type(
  nodeType: string,
  language: Language
): boolean {
  const config = get_language_config(language);
  return config.potential_constructor_node_types.includes(nodeType);
}

/**
 * Check if a name matches constructor naming conventions
 */
export function matches_constructor_naming(
  name: string,
  language: Language
): boolean {
  const config = get_language_config(language);
  const { capitalization_pattern } = config.identification_rules;
  
  if (capitalization_pattern) {
    return capitalization_pattern.test(name);
  }
  
  return true; // No specific naming convention
}

/**
 * Check if a method name is a factory method
 */
export function is_factory_method_name(
  methodName: string,
  language: Language
): boolean {
  const config = get_language_config(language);
  const { factory_method_names } = config.identification_rules;
  
  if (factory_method_names) {
    return factory_method_names.includes(methodName);
  }
  
  return false;
}

/**
 * Get the arguments field name for a language
 */
export function get_arguments_field_name(language: Language): string {
  const config = get_language_config(language);
  return config.arguments_field_name;
}