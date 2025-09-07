/**
 * Language-specific configuration for class hierarchy extraction
 * 
 * This configuration captures the patterns for inheritance relationships
 * across different languages, allowing generic processing of class hierarchies.
 */

import { Language } from '@ariadnejs/types';

/**
 * Configuration for class hierarchy extraction
 */
export interface ClassHierarchyConfig {
  /**
   * Node types that represent class/type definitions
   */
  class_node_types: string[];
  
  /**
   * Node types for interface/trait definitions
   */
  interface_node_types: string[];
  
  /**
   * How inheritance is expressed
   */
  inheritance_patterns: {
    /**
     * Node type or field name for extends/inheritance
     */
    extends_patterns: Array<{
      node_type?: string;
      field_name?: string;
      keyword?: string;
    }>;
    
    /**
     * Node type or field name for implements/traits
     */
    implements_patterns: Array<{
      node_type?: string;
      field_name?: string;
      keyword?: string;
    }>;
    
    /**
     * For languages with multiple inheritance
     */
    multiple_inheritance?: {
      container_type: string;
      container_field?: string;
      first_is_primary: boolean;
    };
  };
  
  /**
   * Attribute patterns (for decorators/annotations)
   */
  attribute_patterns?: {
    /**
     * Pattern for derive/decorator attributes
     */
    derive_pattern?: {
      attribute_type: string;
      attribute_name: string;
      traits_container: string;
    };
  };
  
  /**
   * How to extract type names from references
   */
  type_reference_patterns: {
    /**
     * Node types that represent type references
     */
    type_reference_nodes: string[];
    
    /**
     * Field to extract name from
     */
    name_field?: string;
    
    /**
     * For generic types
     */
    generic_type_pattern?: {
      node_type: string;
      name_field: string;
    };
  };
}

/**
 * JavaScript/TypeScript configuration
 */
const JAVASCRIPT_CONFIG: ClassHierarchyConfig = {
  class_node_types: ['class_declaration', 'abstract_class_declaration'],
  interface_node_types: ['interface_declaration'],
  
  inheritance_patterns: {
    extends_patterns: [
      { node_type: 'extends_clause' },
      { node_type: 'class_heritage', keyword: 'extends' }
    ],
    implements_patterns: [
      { node_type: 'implements_clause' }
    ]
  },
  
  type_reference_patterns: {
    type_reference_nodes: [
      'identifier',
      'type_identifier', 
      'member_expression',
      'generic_type',
      'qualified_name'
    ],
    generic_type_pattern: {
      node_type: 'generic_type',
      name_field: 'name'
    }
  }
};

/**
 * TypeScript configuration (extends JavaScript)
 */
const TYPESCRIPT_CONFIG: ClassHierarchyConfig = {
  ...JAVASCRIPT_CONFIG,
  inheritance_patterns: {
    ...JAVASCRIPT_CONFIG.inheritance_patterns,
    extends_patterns: [
      ...JAVASCRIPT_CONFIG.inheritance_patterns.extends_patterns,
      { node_type: 'extends_type_clause' }  // For interface extends
    ]
  }
};

/**
 * Python configuration
 */
const PYTHON_CONFIG: ClassHierarchyConfig = {
  class_node_types: ['class_definition'],
  interface_node_types: [],  // Python doesn't have explicit interfaces
  
  inheritance_patterns: {
    extends_patterns: [],  // Python uses multiple_inheritance instead
    implements_patterns: [],
    multiple_inheritance: {
      container_type: 'argument_list',
      container_field: 'superclasses',
      first_is_primary: false  // In Python, all are base classes
    }
  },
  
  type_reference_patterns: {
    type_reference_nodes: [
      'identifier',
      'attribute',
      'subscript'
    ],
    name_field: undefined  // Use full text
  }
};

/**
 * Rust configuration
 */
const RUST_CONFIG: ClassHierarchyConfig = {
  class_node_types: ['struct_item', 'enum_item', 'union_item'],
  interface_node_types: ['trait_item'],
  
  inheritance_patterns: {
    extends_patterns: [
      { field_name: 'bounds' }  // For trait bounds
    ],
    implements_patterns: []  // Rust uses impl blocks, handled specially
  },
  
  attribute_patterns: {
    derive_pattern: {
      attribute_type: 'attribute_item',
      attribute_name: 'derive',
      traits_container: 'token_tree'
    }
  },
  
  type_reference_patterns: {
    type_reference_nodes: [
      'identifier',
      'type_identifier',
      'scoped_identifier',
      'generic_type'
    ],
    generic_type_pattern: {
      node_type: 'generic_type',
      name_field: 'type'
    }
  }
};

/**
 * Get configuration for a language
 */
export function get_class_hierarchy_config(language: Language): ClassHierarchyConfig {
  switch (language) {
    case 'javascript':
      return JAVASCRIPT_CONFIG;
    case 'typescript':
      return TYPESCRIPT_CONFIG;
    case 'python':
      return PYTHON_CONFIG;
    case 'rust':
      return RUST_CONFIG;
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}

/**
 * Check if a node type represents a class definition
 */
export function is_class_node(node_type: string, language: Language): boolean {
  const config = get_class_hierarchy_config(language);
  return config.class_node_types.includes(node_type);
}

/**
 * Check if a node type represents an interface/trait definition
 */
export function is_interface_node(node_type: string, language: Language): boolean {
  const config = get_class_hierarchy_config(language);
  return config.interface_node_types.includes(node_type);
}

/**
 * Check if a node type represents a type reference
 */
export function is_type_reference_node(node_type: string, language: Language): boolean {
  const config = get_class_hierarchy_config(language);
  return config.type_reference_patterns.type_reference_nodes.includes(node_type);
}