/**
 * Language-specific configurations for generic resolution
 * 
 * Defines patterns and rules for extracting and resolving generics
 * across different languages
 */

import { Language } from '@ariadnejs/types';

/**
 * Configuration for generic resolution in a specific language
 */
export interface GenericResolutionConfig {
  // AST node types that contain type parameters
  type_parameter_nodes: string[];
  
  // AST field names for type parameters
  type_parameter_fields: string[];
  
  // Field names in parameter nodes
  parameter_name_field: string;
  parameter_constraint_field: string;
  parameter_default_field: string;
  
  // Patterns to identify generic parameters
  generic_patterns: RegExp[];
  
  // Common generic parameter names
  common_generic_names: string[];
  
  // Type aliases that should be expanded (e.g., List -> list)
  type_aliases?: Record<string, string>;
  
  // Special handling flags
  has_lifetime_parameters: boolean;
  has_variance_annotations: boolean;
  has_associated_types: boolean;
}

// =============================================================================
// PUBLIC API FUNCTIONS
// =============================================================================

/**
 * Get configuration for a specific language
 */
export function get_language_config(language: Language): GenericResolutionConfig {
  switch (language) {
    case 'typescript':
      return typescript_config;
    case 'python':
      return python_config;
    case 'rust':
      return rust_config;
    case 'javascript':
      return javascript_config;
    default:
      return javascript_config;
  }
}

/**
 * Check if a type name matches generic patterns for a language
 */
export function is_generic_parameter(
  type_name: string,
  language: Language
): boolean {
  const config = get_language_config(language);
  
  // Check common names first (faster)
  if (config.common_generic_names.includes(type_name)) {
    return true;
  }
  
  // Check patterns
  return config.generic_patterns.some(pattern => pattern.test(type_name));
}

// =============================================================================
// LANGUAGE CONFIGURATION CONSTANTS
// =============================================================================

/**
 * TypeScript configuration
 */
const typescript_config: GenericResolutionConfig = {
  type_parameter_nodes: ['type_parameter'],
  type_parameter_fields: ['type_parameters'],
  parameter_name_field: 'name',
  parameter_constraint_field: 'constraint',
  parameter_default_field: 'default',
  generic_patterns: [
    /^[A-Z]$/,           // Single uppercase letters
    /^T[A-Z]?.*/,        // T, TKey, TValue, etc.
    /^K$/,               // K for key
    /^V$/,               // V for value
    /^E$/,               // E for element
    /^R$/,               // R for return
  ],
  common_generic_names: ['T', 'K', 'V', 'E', 'R', 'TKey', 'TValue'],
  has_lifetime_parameters: false,
  has_variance_annotations: false,
  has_associated_types: false
};

/**
 * Python configuration
 */
const python_config: GenericResolutionConfig = {
  type_parameter_nodes: ['subscript', 'generic_type', 'assignment'],
  type_parameter_fields: ['slice', 'arguments'],
  parameter_name_field: 'left',
  parameter_constraint_field: 'right',
  parameter_default_field: '',
  generic_patterns: [
    /^[A-Z][A-Za-z0-9_]*$/,  // TypeVars start with uppercase
  ],
  common_generic_names: ['T', 'K', 'V', 'E'],
  type_aliases: {
    'List': 'list',
    'Dict': 'dict',
    'Set': 'set',
    'Tuple': 'tuple',
    'Callable': 'callable',
    'Sequence': 'sequence',
    'Iterable': 'iterable',
    'Iterator': 'iterator',
    'Generator': 'generator',
    'Awaitable': 'awaitable',
    'Coroutine': 'coroutine',
    'AsyncIterator': 'async_iterator',
    'AsyncGenerator': 'async_generator',
  },
  has_lifetime_parameters: false,
  has_variance_annotations: false,
  has_associated_types: false
};

/**
 * Rust configuration
 */
const rust_config: GenericResolutionConfig = {
  type_parameter_nodes: ['type_identifier', 'generic_type'],
  type_parameter_fields: ['type_parameters', 'generic_parameters'],
  parameter_name_field: '',
  parameter_constraint_field: 'trait_bound',
  parameter_default_field: '',
  generic_patterns: [
    /^[A-Z]$/,           // Single uppercase letters
    /^T[A-Z]?.*/,        // T, TKey, TValue, etc.
    /^'[a-z]+$/,         // Lifetime parameters
    /^impl\s+/,          // impl Trait syntax
  ],
  common_generic_names: ['T', 'K', 'V', 'E'],
  has_lifetime_parameters: true,
  has_variance_annotations: false,
  has_associated_types: true
};

/**
 * JavaScript configuration (no generics)
 */
const javascript_config: GenericResolutionConfig = {
  type_parameter_nodes: [],
  type_parameter_fields: [],
  parameter_name_field: '',
  parameter_constraint_field: '',
  parameter_default_field: '',
  generic_patterns: [],
  common_generic_names: [],
  has_lifetime_parameters: false,
  has_variance_annotations: false,
  has_associated_types: false
};