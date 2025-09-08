/**
 * Language-specific namespace resolution configurations
 * 
 * Captures the differences between languages in namespace handling
 * to enable generic processing of ~80% of namespace resolution logic
 */

import { Language } from '@ariadnejs/types';

/**
 * Configuration for language-specific namespace resolution
 */
export interface NamespaceLanguageConfig {
  // Import patterns that create namespaces
  namespace_import_patterns: {
    // ES6/TypeScript: import * as ns from 'module'
    wildcard_import?: string;
    // Python: import module, from module import *
    module_import?: string;
    // Rust: use crate::module
    use_statement?: string;
    // CommonJS: const ns = require('module')
    require_pattern?: string;
  };
  
  // Member access syntax
  member_access: {
    // Separator between namespace and member (usually '.')
    separator: string;
    // Alternative separators (e.g., '::' in Rust)
    alt_separators?: string[];
    // Whether to support bracket notation (ns['member'])
    bracket_notation?: boolean;
  };
  
  // Namespace identification
  namespace_indicators: {
    // Keywords that indicate namespace import
    keywords: string[];
    // AST node types for namespace imports
    node_types: string[];
    // Pattern to identify namespace variable
    identifier_pattern?: RegExp;
  };
  
  // Export visibility rules
  visibility_rules: {
    // Whether all exports are public by default
    default_public: boolean;
    // Prefix for private members (e.g., '_' in Python)
    private_prefix?: string;
    // Keywords that control visibility
    visibility_keywords?: string[];
    // Whether to check __all__ or similar
    export_list_name?: string;
  };
  
  // Re-export handling
  reexport_patterns: {
    // Whether the language supports re-exports
    supports_reexports: boolean;
    // Pattern for re-export statements
    patterns?: RegExp[];
    // Whether to follow re-export chains
    follow_chains: boolean;
  };
  
  // Special features
  features: {
    // Python: packages with __init__.py
    has_packages?: boolean;
    // Rust: crate system
    has_crates?: boolean;
    // TypeScript: namespace declarations
    has_namespace_declarations?: boolean;
    // CommonJS module.exports
    has_commonjs?: boolean;
    // Dynamic imports
    has_dynamic_imports?: boolean;
    // Relative imports (., ..)
    has_relative_imports?: boolean;
  };
}

/**
 * JavaScript namespace configuration
 */
const JAVASCRIPT_CONFIG: NamespaceLanguageConfig = {
  namespace_import_patterns: {
    wildcard_import: 'import * as',
    require_pattern: 'require\\('
  },
  
  member_access: {
    separator: '.',
    bracket_notation: true
  },
  
  namespace_indicators: {
    keywords: ['import', 'require'],
    node_types: [
      'import_statement',
      'variable_declaration',
      'call_expression'
    ]
  },
  
  visibility_rules: {
    default_public: true
  },
  
  reexport_patterns: {
    supports_reexports: true,
    patterns: [
      /export\s*\*\s*from/,
      /export\s*\{[^}]*\}\s*from/
    ],
    follow_chains: true
  },
  
  features: {
    has_commonjs: true,
    has_dynamic_imports: true,
    has_relative_imports: true
  }
};

/**
 * TypeScript namespace configuration
 */
const TYPESCRIPT_CONFIG: NamespaceLanguageConfig = {
  ...JAVASCRIPT_CONFIG,
  
  namespace_indicators: {
    ...JAVASCRIPT_CONFIG.namespace_indicators,
    keywords: [...JAVASCRIPT_CONFIG.namespace_indicators.keywords, 'namespace'],
    node_types: [
      ...JAVASCRIPT_CONFIG.namespace_indicators.node_types,
      'namespace_declaration'
    ]
  },
  
  features: {
    ...JAVASCRIPT_CONFIG.features,
    has_namespace_declarations: true
  }
};

/**
 * Python namespace configuration
 */
const PYTHON_CONFIG: NamespaceLanguageConfig = {
  namespace_import_patterns: {
    module_import: 'import',
    wildcard_import: 'from * import'
  },
  
  member_access: {
    separator: '.'
  },
  
  namespace_indicators: {
    keywords: ['import', 'from'],
    node_types: [
      'import_statement',
      'import_from_statement'
    ]
  },
  
  visibility_rules: {
    default_public: false,
    private_prefix: '_',
    export_list_name: '__all__'
  },
  
  reexport_patterns: {
    supports_reexports: true,
    patterns: [
      /from\s+\S+\s+import\s+/
    ],
    follow_chains: true
  },
  
  features: {
    has_packages: true,
    has_relative_imports: true
  }
};

/**
 * Rust namespace configuration
 */
const RUST_CONFIG: NamespaceLanguageConfig = {
  namespace_import_patterns: {
    use_statement: 'use'
  },
  
  member_access: {
    separator: '::',
    alt_separators: ['.']
  },
  
  namespace_indicators: {
    keywords: ['use', 'mod', 'crate'],
    node_types: [
      'use_declaration',
      'mod_item'
    ]
  },
  
  visibility_rules: {
    default_public: false,
    visibility_keywords: ['pub', 'pub(crate)', 'pub(super)']
  },
  
  reexport_patterns: {
    supports_reexports: true,
    patterns: [
      /pub\s+use\s+/
    ],
    follow_chains: true
  },
  
  features: {
    has_crates: true,
    has_relative_imports: true
  }
};

/**
 * Configuration map for all supported languages
 */
const LANGUAGE_CONFIGS: Record<Language, NamespaceLanguageConfig> = {
  javascript: JAVASCRIPT_CONFIG,
  typescript: TYPESCRIPT_CONFIG,
  python: PYTHON_CONFIG,
  rust: RUST_CONFIG
};

/**
 * Get namespace configuration for a language
 */
export function get_namespace_config(language: Language): NamespaceLanguageConfig {
  const config = LANGUAGE_CONFIGS[language];
  if (!config) {
    throw new Error(`No namespace configuration for language: ${language}`);
  }
  return config;
}

/**
 * Check if an import creates a namespace
 */
export function is_namespace_import_pattern(
  import_text: string,
  language: Language
): boolean {
  const config = get_namespace_config(language);
  const patterns = config.namespace_import_patterns;
  
  if (patterns.wildcard_import && import_text.includes(patterns.wildcard_import)) {
    return true;
  }
  
  if (patterns.module_import && import_text.includes(patterns.module_import)) {
    return true;
  }
  
  if (patterns.use_statement && import_text.includes(patterns.use_statement)) {
    return true;
  }
  
  if (patterns.require_pattern && import_text.includes(patterns.require_pattern)) {
    return true;
  }
  
  return false;
}

/**
 * Get member access separator for a language
 */
export function get_member_separator(language: Language): string {
  const config = get_namespace_config(language);
  return config.member_access.separator;
}

/**
 * Check if a member is private based on language conventions
 */
export function is_private_member(
  member_name: string,
  language: Language
): boolean {
  const config = get_namespace_config(language);
  const visibility = config.visibility_rules;
  
  if (visibility.private_prefix && member_name.startsWith(visibility.private_prefix)) {
    return true;
  }
  
  return false;
}

/**
 * Check if a language supports a specific namespace feature
 */
export function supports_namespace_feature(
  feature: keyof NamespaceLanguageConfig['features'],
  language: Language
): boolean {
  const config = get_namespace_config(language);
  return !!config.features[feature];
}

/**
 * Get namespace-related AST node types for a language
 */
export function get_namespace_node_types(language: Language): string[] {
  const config = get_namespace_config(language);
  return config.namespace_indicators.node_types;
}

/**
 * Check if a language has re-export support
 */
export function supports_reexports(language: Language): boolean {
  const config = get_namespace_config(language);
  return config.reexport_patterns.supports_reexports;
}

/**
 * Get visibility keywords for a language
 */
export function get_visibility_keywords(language: Language): string[] {
  const config = get_namespace_config(language);
  return config.visibility_rules.visibility_keywords || [];
}

/**
 * Check if exports are public by default in a language
 */
export function has_default_public_exports(language: Language): boolean {
  const config = get_namespace_config(language);
  return config.visibility_rules.default_public;
}

/**
 * Get export list identifier (like __all__ in Python)
 */
export function get_export_list_name(language: Language): string | undefined {
  const config = get_namespace_config(language);
  return config.visibility_rules.export_list_name;
}