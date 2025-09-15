/**
 * Language-specific configurations for symbol resolution
 * 
 * This module defines the configuration-driven patterns that handle
 * 80%+ of symbol resolution logic across all languages.
 */

import { Language } from '@ariadnejs/types';

/**
 * Configuration for language-specific symbol resolution patterns
 */
export interface SymbolResolutionConfig {
  // Scope traversal configuration
  scope_traversal: {
    // Order in which to search scopes (e.g., "local_first", "global_first", "custom")
    search_order: 'local_first' | 'global_first' | 'custom';
    // Custom scope search order for languages like Python (LEGB)
    custom_order?: string[];
    // Whether to stop at module boundaries
    stop_at_module_boundary?: boolean;
    // Whether to search parent scopes
    search_parent_scopes?: boolean;
  };
  
  // Symbol visibility rules
  visibility_rules: {
    // Whether symbols are public by default
    default_public?: boolean;
    // Visibility keywords (e.g., "pub", "private", "protected")
    visibility_keywords?: string[];
    // Whether to respect file-level privacy
    file_level_privacy?: boolean;
  };
  
  // Import/export patterns
  import_export: {
    // Import statement node types
    import_node_types?: string[];
    // Export statement node types
    export_node_types?: string[];
    // Default export field name
    default_export_field?: string;
    // Named imports field name
    named_imports_field?: string;
    // Whether imports create new bindings
    imports_create_bindings?: boolean;
  };
  
  // Special symbols and keywords
  special_symbols: {
    // Global symbols available everywhere
    global_symbols?: string[];
    // Built-in symbols
    builtin_symbols?: string[];
    // Keywords that affect resolution (e.g., "global", "nonlocal")
    resolution_keywords?: string[];
    // Self/this keyword
    self_keyword?: string;
    // Super keyword
    super_keyword?: string;
  };
  
  // Hoisting and declaration rules
  declaration_rules: {
    // Whether functions are hoisted
    hoist_functions?: boolean;
    // Whether variables are hoisted
    hoist_variables?: boolean;
    // Whether classes are hoisted
    hoist_classes?: boolean;
    // Whether imports are hoisted
    hoist_imports?: boolean;
    // Declaration before use required
    require_declaration_before_use?: boolean;
  };
  
  // Name resolution patterns
  name_patterns: {
    // Module path separator (e.g., "::", ".")
    module_separator?: string;
    // Whether to support nested namespaces
    nested_namespaces?: boolean;
    // Pattern for qualified names
    qualified_name_pattern?: string;
    // Whether to support type namespaces
    type_namespaces?: boolean;
  };
  
  // Language-specific features that need bespoke handling
  bespoke_features?: {
    // Features that require custom logic
    features?: string[];
    // Handler names for each feature
    handlers?: Record<string, string>;
  };
}

/**
 * JavaScript configuration
 */
const JAVASCRIPT_CONFIG: SymbolResolutionConfig = {
  scope_traversal: {
    search_order: 'local_first',
    search_parent_scopes: true,
    stop_at_module_boundary: false,
  },
  
  visibility_rules: {
    default_public: true,
    file_level_privacy: false,
  },
  
  import_export: {
    import_node_types: ['import_statement'],
    export_node_types: ['export_statement'],
    default_export_field: 'default',
    named_imports_field: 'specifiers',
    imports_create_bindings: true,
  },
  
  special_symbols: {
    global_symbols: ['window', 'global', 'console', 'document', 'process'],
    builtin_symbols: ['Array', 'Object', 'String', 'Number', 'Boolean', 'Function', 'Promise'],
    self_keyword: 'this',
    super_keyword: 'super',
  },
  
  declaration_rules: {
    hoist_functions: true,
    hoist_variables: false, // var is hoisted but not let/const
    hoist_classes: false,
    hoist_imports: true,
    require_declaration_before_use: false, // Due to hoisting
  },
  
  name_patterns: {
    module_separator: '.',
    nested_namespaces: true,
    qualified_name_pattern: '\\w+(\\.\\w+)*',
  },
  
  bespoke_features: {
    features: ['hoisting', 'prototype_chain', 'this_binding'],
    handlers: {
      hoisting: 'handle_javascript_hoisting',
      prototype_chain: 'handle_prototype_chain',
      this_binding: 'handle_this_binding',
    },
  },
};

/**
 * TypeScript configuration (extends JavaScript)
 */
const TYPESCRIPT_CONFIG: SymbolResolutionConfig = {
  ...JAVASCRIPT_CONFIG,
  
  import_export: {
    ...JAVASCRIPT_CONFIG.import_export,
    import_node_types: ['import_statement', 'import_type'],
    export_node_types: ['export_statement', 'export_type'],
  },
  
  name_patterns: {
    ...JAVASCRIPT_CONFIG.name_patterns,
    type_namespaces: true,
  },
  
  bespoke_features: {
    features: [
      ...JAVASCRIPT_CONFIG.bespoke_features!.features!,
      'type_only_imports',
      'interface_merging',
      'namespaces',
      'decorators',
    ],
    handlers: {
      ...JAVASCRIPT_CONFIG.bespoke_features!.handlers!,
      type_only_imports: 'handle_type_only_imports',
      interface_merging: 'handle_interface_merging',
      namespaces: 'handle_namespaces',
      decorators: 'handle_decorators',
    },
  },
};

/**
 * Python configuration
 */
const PYTHON_CONFIG: SymbolResolutionConfig = {
  scope_traversal: {
    search_order: 'custom',
    custom_order: ['local', 'enclosing', 'global', 'builtin'], // LEGB rule
    search_parent_scopes: true,
    stop_at_module_boundary: true,
  },
  
  visibility_rules: {
    default_public: true,
    file_level_privacy: true, // Leading underscore convention
  },
  
  import_export: {
    import_node_types: ['import_statement', 'import_from_statement'],
    export_node_types: [], // Python uses __all__ instead
    named_imports_field: 'name',
    imports_create_bindings: true,
  },
  
  special_symbols: {
    global_symbols: ['__name__', '__file__', '__package__'],
    builtin_symbols: [
      'print', 'len', 'range', 'int', 'str', 'list', 'dict', 'set',
      'tuple', 'bool', 'float', 'type', 'object', 'None', 'True', 'False',
    ],
    resolution_keywords: ['global', 'nonlocal'],
    self_keyword: 'self',
    super_keyword: 'super',
  },
  
  declaration_rules: {
    hoist_functions: false,
    hoist_variables: false,
    hoist_classes: false,
    hoist_imports: false,
    require_declaration_before_use: true,
  },
  
  name_patterns: {
    module_separator: '.',
    nested_namespaces: true,
    qualified_name_pattern: '\\w+(\\.\\w+)*',
  },
  
  bespoke_features: {
    features: ['legb_rule', 'global_nonlocal', 'all_exports'],
    handlers: {
      legb_rule: 'handle_python_legb',
      global_nonlocal: 'handle_global_nonlocal',
      all_exports: 'handle_all_exports',
    },
  },
};

/**
 * Rust configuration
 */
const RUST_CONFIG: SymbolResolutionConfig = {
  scope_traversal: {
    search_order: 'local_first',
    search_parent_scopes: true,
    stop_at_module_boundary: true,
  },
  
  visibility_rules: {
    default_public: false, // Private by default
    visibility_keywords: ['pub', 'pub(crate)', 'pub(super)'],
    file_level_privacy: true,
  },
  
  import_export: {
    import_node_types: ['use_declaration'],
    export_node_types: ['pub', 'mod'],
    imports_create_bindings: true,
  },
  
  special_symbols: {
    global_symbols: ['crate', 'super', 'self'],
    builtin_symbols: [
      'Option', 'Result', 'Vec', 'String', 'Box', 'Rc', 'Arc',
      'i32', 'u32', 'f64', 'bool', 'char', 'str',
    ],
    self_keyword: 'self',
    super_keyword: 'super',
  },
  
  declaration_rules: {
    hoist_functions: false,
    hoist_variables: false,
    hoist_classes: false,
    hoist_imports: false,
    require_declaration_before_use: true,
  },
  
  name_patterns: {
    module_separator: '::',
    nested_namespaces: true,
    qualified_name_pattern: '\\w+(::\\w+)*',
  },
  
  bespoke_features: {
    features: ['module_paths', 'use_statements', 'impl_blocks', 'trait_impls'],
    handlers: {
      module_paths: 'handle_module_paths',
      use_statements: 'handle_use_statements',
      impl_blocks: 'handle_impl_blocks',
      trait_impls: 'handle_trait_impls',
    },
  },
};

/**
 * Get configuration for a language
 */
export function get_symbol_resolution_config(language: Language): SymbolResolutionConfig {
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
      // Return a default configuration for unsupported languages
      return {
        scope_traversal: {
          search_order: 'local_first',
          search_parent_scopes: true,
        },
        visibility_rules: {
          default_public: true,
        },
        import_export: {},
        special_symbols: {},
        declaration_rules: {
          require_declaration_before_use: true,
        },
        name_patterns: {},
      };
  }
}

/**
 * Check if a symbol is a global symbol for the language
 */
export function is_global_symbol(symbol: string, language: Language): boolean {
  const config = get_symbol_resolution_config(language);
  return config.special_symbols.global_symbols?.includes(symbol) || false;
}

/**
 * Check if a symbol is a builtin symbol for the language
 */
export function is_builtin_symbol(symbol: string, language: Language): boolean {
  const config = get_symbol_resolution_config(language);
  return config.special_symbols.builtin_symbols?.includes(symbol) || false;
}

/**
 * Check if a function is hoisted in the language
 */
export function is_function_hoisted(language: Language): boolean {
  const config = get_symbol_resolution_config(language);
  return config.declaration_rules.hoist_functions || false;
}

/**
 * Get the scope search order for a language
 */
export function get_scope_search_order(language: Language): string[] {
  const config = get_symbol_resolution_config(language);
  
  if (config.scope_traversal.search_order === 'custom' && config.scope_traversal.custom_order) {
    return config.scope_traversal.custom_order;
  }
  
  if (config.scope_traversal.search_order === 'global_first') {
    return ['global', 'parent', 'local'];
  }
  
  // Default: local_first
  return ['local', 'parent', 'global'];
}

/**
 * Check if a language requires bespoke handling for a feature
 */
export function requires_bespoke_handling(feature: string, language: Language): boolean {
  const config = get_symbol_resolution_config(language);
  return config.bespoke_features?.features?.includes(feature) || false;
}

/**
 * Get the bespoke handler name for a feature
 */
export function get_bespoke_handler(feature: string, language: Language): string | undefined {
  const config = get_symbol_resolution_config(language);
  return config.bespoke_features?.handlers?.[feature];
}