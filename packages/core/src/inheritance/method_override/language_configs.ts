/**
 * Language configurations for method override detection
 * 
 * Configuration-driven approach for ~85% of override detection logic
 */

import { Parser } from 'tree-sitter';

/**
 * Configuration for method override detection
 */
export interface MethodOverrideConfig {
  // Class/type declaration patterns
  class_types: string[];
  class_name_field: string;
  class_body_field: string;
  
  // Inheritance patterns
  inheritance_clause_types: string[];
  base_class_field: string;
  
  // Method declaration patterns
  method_types: string[];
  method_name_field: string;
  
  // Override markers
  override_markers: {
    keywords?: string[];
    decorators?: string[];
  };
  
  // Abstract markers
  abstract_markers: {
    keywords?: string[];
    decorators?: string[];
  };
  
  // Static/class method markers
  static_markers: {
    keywords?: string[];
    decorators?: string[];
  };
  
  // Skip patterns (e.g., magic methods in Python)
  skip_patterns?: {
    prefix?: string;
    suffix?: string;
    exact?: string[];
  };
  
  // Language-specific features
  features: {
    has_explicit_override: boolean;
    has_interfaces: boolean;
    has_abstract_methods: boolean;
    has_multiple_inheritance: boolean;
    has_traits: boolean;
  };
  
  // Query patterns for complex extractions
  queries: {
    class_hierarchy?: string;
    method_extraction?: string;
    override_detection?: string;
  };
}

// TypeScript configuration
const typescript_config: MethodOverrideConfig = {
  class_types: ['class_declaration'],
  class_name_field: 'name',
  class_body_field: 'body',
  
  inheritance_clause_types: ['class_heritage', 'extends_clause'],
  base_class_field: 'name',
  
  method_types: ['method_definition', 'public_field_definition'],
  method_name_field: 'name',
  
  override_markers: {
    keywords: ['override']
  },
  
  abstract_markers: {
    keywords: ['abstract']
  },
  
  static_markers: {
    keywords: ['static']
  },
  
  features: {
    has_explicit_override: true,
    has_interfaces: true,
    has_abstract_methods: true,
    has_multiple_inheritance: false,
    has_traits: false
  },
  
  queries: {
    class_hierarchy: `
      (class_declaration
        name: (_) @class_name
        (class_heritage 
          (extends_clause 
            (_) @parent_name))?) @class
    `,
    method_extraction: `
      (method_definition
        name: (property_identifier) @method_name) @method
    `
  }
};

// JavaScript configuration (different query structure)
const javascript_config: MethodOverrideConfig = {
  class_types: ['class_declaration'],
  class_name_field: 'name',
  class_body_field: 'body',
  
  inheritance_clause_types: ['class_heritage'],
  base_class_field: 'name',
  
  method_types: ['method_definition', 'public_field_definition'],
  method_name_field: 'name',
  
  override_markers: {},
  abstract_markers: {},
  static_markers: {
    keywords: ['static']
  },
  
  features: {
    has_explicit_override: false,
    has_interfaces: false,
    has_abstract_methods: false,
    has_multiple_inheritance: false,
    has_traits: false
  },
  
  queries: {
    class_hierarchy: `
      (class_declaration
        name: (identifier) @class_name) @class
      (class_declaration
        name: (identifier) @class_name
        (class_heritage (identifier) @parent_name)) @class
    `,
    method_extraction: `
      (method_definition
        name: (property_identifier) @method_name) @method
    `
  }
};

// Python configuration
const python_config: MethodOverrideConfig = {
  class_types: ['class_definition'],
  class_name_field: 'name',
  class_body_field: 'body',
  
  inheritance_clause_types: ['argument_list'],
  base_class_field: 'name',
  
  method_types: ['function_definition'],
  method_name_field: 'name',
  
  override_markers: {
    decorators: ['override']
  },
  
  abstract_markers: {
    decorators: ['abstractmethod', 'abc.abstractmethod']
  },
  
  static_markers: {
    decorators: ['staticmethod', 'classmethod']
  },
  
  skip_patterns: {
    prefix: '__',
    suffix: '__',
    exact: ['__init__']
  },
  
  features: {
    has_explicit_override: true,
    has_interfaces: false,
    has_abstract_methods: true,
    has_multiple_inheritance: true,
    has_traits: false
  },
  
  queries: {
    class_hierarchy: `
      (class_definition
        name: (identifier) @class_name
        (argument_list
          (identifier) @parent_name)?) @class
    `,
    method_extraction: `
      (function_definition
        name: (identifier) @method_name) @method
    `
  }
};

// Rust configuration
const rust_config: MethodOverrideConfig = {
  class_types: ['impl_item', 'trait_item'],
  class_name_field: 'type',
  class_body_field: 'body',
  
  inheritance_clause_types: [],
  base_class_field: '',
  
  method_types: ['function_item', 'function_signature_item'],
  method_name_field: 'name',
  
  override_markers: {},
  abstract_markers: {},
  static_markers: {},
  
  features: {
    has_explicit_override: false,
    has_interfaces: false,
    has_abstract_methods: false,
    has_multiple_inheritance: false,
    has_traits: true
  },
  
  queries: {
    override_detection: `
      (impl_item
        trait: [(type_identifier) (scoped_type_identifier)] @trait_name
        type: [(type_identifier) (generic_type)] @type_name
        body: (declaration_list
          (function_item
            name: (identifier) @method_name))) @impl
    `
  }
};

/**
 * Get language configuration
 */
export function get_language_config(language: string): MethodOverrideConfig | undefined {
  const configs: Record<string, MethodOverrideConfig> = {
    typescript: typescript_config,
    javascript: javascript_config,
    python: python_config,
    rust: rust_config
  };
  
  return configs[language];
}

/**
 * Check if a node matches override markers
 */
export function has_override_marker(
  node: any,
  config: MethodOverrideConfig
): boolean {
  // Check keywords
  if (config.override_markers.keywords) {
    for (const keyword of config.override_markers.keywords) {
      if (node.children?.some((c: any) => c.type === keyword)) {
        return true;
      }
    }
  }
  
  // Check decorators
  if (config.override_markers.decorators) {
    for (const child of node.children || []) {
      if (child.type === 'decorator') {
        const name = child.childForFieldName('name');
        if (name && config.override_markers.decorators.includes(name.text)) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Check if a node has abstract marker
 */
export function has_abstract_marker(
  node: any,
  config: MethodOverrideConfig
): boolean {
  // Check keywords
  if (config.abstract_markers.keywords) {
    for (const keyword of config.abstract_markers.keywords) {
      if (node.children?.some((c: any) => c.type === keyword)) {
        return true;
      }
    }
  }
  
  // Check decorators
  if (config.abstract_markers.decorators) {
    for (const child of node.children || []) {
      if (child.type === 'decorator') {
        const name = child.childForFieldName('name');
        if (name && config.abstract_markers.decorators.includes(name.text)) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Check if a node is static/class method
 */
export function is_static_method(
  node: any,
  config: MethodOverrideConfig
): boolean {
  // Check keywords
  if (config.static_markers.keywords) {
    for (const keyword of config.static_markers.keywords) {
      if (node.children?.some((c: any) => c.type === keyword)) {
        return true;
      }
    }
  }
  
  // Check decorators
  if (config.static_markers.decorators) {
    for (const child of node.children || []) {
      if (child.type === 'decorator') {
        const name = child.childForFieldName('name');
        if (name && config.static_markers.decorators.includes(name.text)) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Check if method name should be skipped
 */
export function should_skip_method(
  method_name: string,
  config: MethodOverrideConfig
): boolean {
  if (!config.skip_patterns) return false;
  
  const { prefix, suffix, exact } = config.skip_patterns;
  
  // Check exact matches
  if (exact?.includes(method_name)) {
    return false; // Special case: __init__ is not skipped
  }
  
  // Check prefix and suffix
  if (prefix && suffix && 
      method_name.startsWith(prefix) && 
      method_name.endsWith(suffix)) {
    return true;
  }
  
  return false;
}