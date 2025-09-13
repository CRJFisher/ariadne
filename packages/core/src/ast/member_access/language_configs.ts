/**
 * Language configuration for member access detection
 * 
 * Captures the configurable differences between languages
 * for detecting member access expressions
 */

import { Language, ASTNodeType, FieldName } from '@ariadnejs/types';

/**
 * Configuration for member access patterns in a language
 */
export interface MemberAccessConfig {
  /**
   * AST node types that represent member access
   * e.g., 'member_expression', 'attribute', 'scoped_identifier'
   */
  node_types: ASTNodeType[];
  
  /**
   * Field mapping for extracting object and member names
   * Maps a node type to its field names
   */
  field_mappings: {
    [node_type: string]: {
      object_field: FieldName;  // Field containing the object/namespace
      member_field: FieldName;  // Field containing the member/property
    };
  };
  
  /**
   * Node types that should not be traversed when looking for member access
   */
  skip_node_types: ASTNodeType[];
  
  /**
   * Additional patterns for special member access (e.g., optional chaining)
   */
  special_patterns?: {
    optional_chaining?: {
      operator: string;  // e.g., '?.'
      supported: boolean;
    };
    computed_access?: {
      node_type: ASTNodeType;  // e.g., 'subscript_expression'
      supported: boolean;
    };
  };
}

// JavaScript/TypeScript configuration
const javascript_config: MemberAccessConfig = {
  node_types: ['member_expression' as ASTNodeType, 'nested_type_identifier' as ASTNodeType],
  field_mappings: {
    'member_expression': {
      object_field: 'object' as FieldName,
      member_field: 'property' as FieldName
    },
    'nested_type_identifier': {
      object_field: 'module' as FieldName,
      member_field: 'name' as FieldName
    }
  },
  skip_node_types: ['comment' as ASTNodeType, 'string' as ASTNodeType, 'template_string' as ASTNodeType],
  special_patterns: {
    optional_chaining: {
      operator: '?.',
      supported: true
    },
    computed_access: {
      node_type: 'subscript_expression' as ASTNodeType,
      supported: true
    }
  }
};

// Python configuration
const python_config: MemberAccessConfig = {
  node_types: ['attribute' as ASTNodeType],
  field_mappings: {
    'attribute': {
      object_field: 'object' as FieldName,
      member_field: 'attribute' as FieldName
    }
  },
  skip_node_types: ['comment' as ASTNodeType, 'string' as ASTNodeType],
  special_patterns: {
    // Python uses getattr() for dynamic access, not bracket notation
    computed_access: {
      node_type: 'call' as ASTNodeType,  // getattr(obj, 'prop')
      supported: true
    }
  }
};

// Rust configuration
const rust_config: MemberAccessConfig = {
  node_types: ['scoped_identifier' as ASTNodeType, 'field_expression' as ASTNodeType],
  field_mappings: {
    'scoped_identifier': {
      object_field: 'path' as FieldName,
      member_field: 'name' as FieldName
    },
    'field_expression': {
      object_field: 'value' as FieldName,
      member_field: 'field' as FieldName
    }
  },
  skip_node_types: ['comment' as ASTNodeType, 'string_literal' as ASTNodeType],
  special_patterns: {
    // Rust doesn't have optional chaining or computed access
    optional_chaining: {
      operator: '',
      supported: false
    }
  }
};

// Language configuration map
const LANGUAGE_CONFIGS: Record<string, MemberAccessConfig> = {
  javascript: javascript_config,
  typescript: javascript_config,
  jsx: javascript_config,
  tsx: javascript_config,
  python: python_config,
  rust: rust_config
};

/**
 * Get member access configuration for a language
 */
export function get_member_access_config(language: Language): MemberAccessConfig | null {
  return LANGUAGE_CONFIGS[language] || null;
}

/**
 * Check if a node type represents member access in a language
 */
export function is_member_access_node(
  nodeType: ASTNodeType,
  language: Language
): boolean {
  const config = get_member_access_config(language);
  return config ? config.node_types.includes(nodeType) : false;
}

/**
 * Get field names for a member access node type
 */
export function get_member_access_fields(
  nodeType: ASTNodeType,
  language: Language
): { object_field: FieldName; member_field: FieldName } | null {
  const config = get_member_access_config(language);
  if (!config) return null;
  
  return config.field_mappings[nodeType] || null;
}

/**
 * Check if a node type should be skipped during traversal
 */
export function should_skip_node(
  nodeType: ASTNodeType,
  language: Language
): boolean {
  const config = get_member_access_config(language);
  return config ? config.skip_node_types.includes(nodeType) : false;
}