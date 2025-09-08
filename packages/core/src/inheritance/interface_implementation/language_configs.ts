/**
 * Language Configuration for Interface Implementation Detection
 * 
 * This module defines the configuration-driven patterns for detecting
 * interface/trait/protocol definitions and their implementations across languages.
 */

import { Language } from '@ariadnejs/types';

/**
 * Configuration for interface implementation patterns
 */
export interface InterfaceImplementationConfig {
  /** Node types that define interfaces/traits/protocols */
  interface_node_types: string[];
  
  /** How to extract interface name */
  interface_name_field: string;
  
  /** Node type for interface body */
  interface_body_field: string;
  
  /** Member extraction patterns */
  member_patterns: {
    method_node_types: string[];
    property_node_types: string[];
    name_field: string;
  };
  
  /** Implementation detection patterns */
  implementation_patterns: {
    /** Node types that can implement interfaces */
    implementor_node_types: string[];
    
    /** How implementations are declared */
    implementation_indicators: ImplementationIndicator[];
    
    /** Field for getting implementor name */
    implementor_name_field: string;
    
    /** Field for getting implementor body */
    implementor_body_field: string;
  };
  
  /** Whether to check base classes for interface indicators */
  check_base_classes?: boolean;
  
  /** Special patterns for this language */
  special_patterns?: {
    /** Python: Check for Protocol/ABC in bases */
    protocol_base_names?: string[];
    
    /** Python: Decorator that marks abstract methods */
    abstract_method_decorator?: string;
    
    /** Rust: Trait implementation syntax */
    trait_impl_syntax?: boolean;
  };
}

/**
 * How interface implementation is indicated
 */
export interface ImplementationIndicator {
  /** Type of indicator */
  type: 'keyword' | 'base_class' | 'impl_block';
  
  /** Node type or field to check */
  node_type?: string;
  field_name?: string;
  
  /** Keyword to look for (e.g., "implements") */
  keyword?: string;
  
  /** For impl blocks, how to extract trait name */
  trait_field?: string;
  
  /** For impl blocks, how to extract implementing type */
  type_field?: string;
}

/**
 * JavaScript/TypeScript configuration
 */
const JAVASCRIPT_CONFIG: InterfaceImplementationConfig = {
  interface_node_types: ['interface_declaration'],
  interface_name_field: 'name',
  interface_body_field: 'body',
  
  member_patterns: {
    method_node_types: ['method_signature', 'abstract_method_signature', 'method_definition'], // method_definition for class methods
    property_node_types: ['property_signature', 'property_definition'], // property_definition for class properties
    name_field: 'name'
  },
  
  implementation_patterns: {
    implementor_node_types: ['class_declaration', 'class'],
    implementation_indicators: [
      {
        type: 'keyword',
        field_name: 'implements',
        keyword: 'implements'
      }
    ],
    implementor_name_field: 'name',
    implementor_body_field: 'body'
  }
};

/**
 * TypeScript configuration (extends JavaScript)
 */
const TYPESCRIPT_CONFIG: InterfaceImplementationConfig = {
  ...JAVASCRIPT_CONFIG,
  // TypeScript has additional abstract class support
  interface_node_types: ['interface_declaration', 'abstract_class_declaration']
};

/**
 * Python configuration
 */
const PYTHON_CONFIG: InterfaceImplementationConfig = {
  // In Python, protocols and ABCs are special classes
  interface_node_types: ['class_definition'],
  interface_name_field: 'name',
  interface_body_field: 'body',
  
  member_patterns: {
    method_node_types: ['function_definition'],
    property_node_types: ['expression_statement'], // For property declarations
    name_field: 'name'
  },
  
  implementation_patterns: {
    implementor_node_types: ['class_definition'],
    implementation_indicators: [
      {
        type: 'base_class',
        field_name: 'superclasses'
      }
    ],
    implementor_name_field: 'name',
    implementor_body_field: 'body'
  },
  
  check_base_classes: true,
  
  special_patterns: {
    // These indicate a class is a protocol/interface
    protocol_base_names: ['Protocol', 'ABC', 'ABCMeta', 'typing.Protocol'],
    abstract_method_decorator: 'abstractmethod'
  }
};

/**
 * Rust configuration
 */
const RUST_CONFIG: InterfaceImplementationConfig = {
  interface_node_types: ['trait_item'],
  interface_name_field: 'name',
  interface_body_field: 'body', // The 'body' field points to the declaration_list node
  
  member_patterns: {
    method_node_types: ['function_signature_item', 'function_item'], // Rust uses function_signature_item in traits
    property_node_types: ['associated_type'], // Rust has associated types instead of properties
    name_field: 'name'
  },
  
  implementation_patterns: {
    implementor_node_types: ['impl_item'],
    implementation_indicators: [
      {
        type: 'impl_block',
        trait_field: 'trait',
        type_field: 'type'
      }
    ],
    implementor_name_field: 'type', // The type being implemented for
    implementor_body_field: 'body'
  },
  
  special_patterns: {
    trait_impl_syntax: true // Rust uses "impl Trait for Type" syntax
  }
};

/**
 * Get configuration for a specific language
 */
export function get_interface_config(language: Language): InterfaceImplementationConfig | null {
  switch (language) {
    case 'javascript':
    case 'jsx':
      return JAVASCRIPT_CONFIG;
    
    case 'typescript':
    case 'tsx':
      return TYPESCRIPT_CONFIG;
    
    case 'python':
      return PYTHON_CONFIG;
    
    case 'rust':
      return RUST_CONFIG;
    
    default:
      return null;
  }
}

/**
 * Check if a node type is an interface definition for a language
 */
export function is_interface_node(node_type: string, language: Language): boolean {
  const config = get_interface_config(language);
  if (!config) return false;
  
  return config.interface_node_types.includes(node_type);
}

/**
 * Check if a node type is a member node (method or property)
 */
export function is_member_node(node_type: string, language: Language): 'method' | 'property' | null {
  const config = get_interface_config(language);
  if (!config) return null;
  
  if (config.member_patterns.method_node_types.includes(node_type)) {
    return 'method';
  }
  
  if (config.member_patterns.property_node_types.includes(node_type)) {
    return 'property';
  }
  
  return null;
}

/**
 * Context for interface implementation detection
 */
export const INTERFACE_IMPLEMENTATION_CONTEXT = {
  module: 'interface_implementation',
  version: '2.0.0',
  supports: ['javascript', 'typescript', 'python', 'rust'] as const
};