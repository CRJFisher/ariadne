/**
 * Language-specific export detection configurations
 * 
 * Captures the differences between languages in a data-driven format
 * to enable generic processing of ~85% of export detection logic
 */

import { Language } from '@ariadnejs/types';

/**
 * Configuration for language-specific export detection
 */
export interface ExportLanguageConfig {
  // AST node types that represent exports
  export_node_types: string[];
  
  // AST node types for definitions that can be exported
  exportable_definition_types: string[];
  
  // Patterns for detecting different export types
  patterns: {
    // Regex patterns for default exports
    default_export: RegExp[];
    
    // Regex patterns for named exports
    named_export: RegExp[];
    
    // Regex patterns for re-exports
    reexport: RegExp[];
    
    // Regex patterns for namespace exports
    namespace_export: RegExp[];
    
    // Additional language-specific patterns
    custom?: { [key: string]: RegExp[] };
  };
  
  // AST field names used in export nodes
  field_names: {
    declaration?: string;
    specifiers?: string;
    source?: string;
    name?: string;
    value?: string;
    left?: string;
    right?: string;
  };
  
  // Language-specific features
  features: {
    // Whether the language has implicit exports (e.g., Python)
    implicit_exports: boolean;
    
    // Whether to check for CommonJS patterns
    commonjs_support: boolean;
    
    // Whether the language has type-only exports
    type_exports: boolean;
    
    // Whether the language uses visibility modifiers
    visibility_modifiers: boolean;
    
    // Whether to look for special export lists (e.g., __all__ in Python)
    export_list_identifier?: string;
    
    // Convention for private symbols (e.g., _ prefix in Python)
    private_prefix?: string;
  };
  
  // Keywords that indicate exports
  export_keywords: string[];
  
  // Keywords that indicate visibility (Rust specific)
  visibility_keywords?: string[];
}

/**
 * JavaScript export configuration
 */
const JAVASCRIPT_CONFIG: ExportLanguageConfig = {
  export_node_types: [
    'export_statement',
    'export_clause',
    'export_specifier'
  ],
  
  exportable_definition_types: [
    'function_declaration',
    'class_declaration',
    'variable_declaration',
    'lexical_declaration'
  ],
  
  patterns: {
    default_export: [
      /export\s+default\s+/,
      /module\.exports\s*=\s*(?!{)/  // CommonJS default
    ],
    named_export: [
      /export\s+(?:const|let|var|function|class)\s+/,
      /export\s*\{/,
      /exports\.(\w+)\s*=/  // CommonJS named
    ],
    reexport: [
      /export\s*\{[^}]*\}\s*from/,
      /export\s*\*\s*from/,
      /export\s*\*\s*as\s+\w+\s+from/
    ],
    namespace_export: [
      /export\s*\*\s*as\s+\w+/
    ],
    custom: {
      commonjs_object: [/module\.exports\s*=\s*\{/]
    }
  },
  
  field_names: {
    declaration: 'declaration',
    specifiers: 'specifiers',
    source: 'source',
    name: 'name',
    value: 'value'
  },
  
  features: {
    implicit_exports: false,
    commonjs_support: true,
    type_exports: false,
    visibility_modifiers: false
  },
  
  export_keywords: ['export', 'exports', 'module.exports']
};

/**
 * TypeScript export configuration
 */
const TYPESCRIPT_CONFIG: ExportLanguageConfig = {
  ...JAVASCRIPT_CONFIG,
  
  exportable_definition_types: [
    ...JAVASCRIPT_CONFIG.exportable_definition_types,
    'interface_declaration',
    'type_alias_declaration',
    'enum_declaration',
    'namespace_declaration'
  ],
  
  patterns: {
    ...JAVASCRIPT_CONFIG.patterns,
    named_export: [
      ...JAVASCRIPT_CONFIG.patterns.named_export,
      /export\s+(?:type|interface|enum|namespace)\s+/
    ],
    custom: {
      ...JAVASCRIPT_CONFIG.patterns.custom,
      type_export: [
        /export\s+type\s+\{/,
        /export\s+type\s+\w+/
      ]
    }
  },
  
  features: {
    ...JAVASCRIPT_CONFIG.features,
    type_exports: true
  },
  
  export_keywords: [
    ...JAVASCRIPT_CONFIG.export_keywords,
    'export type',
    'export interface'
  ]
};

/**
 * Python export configuration
 */
const PYTHON_CONFIG: ExportLanguageConfig = {
  export_node_types: [
    'assignment',  // For __all__ = [...]
    'function_definition',
    'class_definition'
  ],
  
  exportable_definition_types: [
    'function_definition',
    'class_definition',
    'assignment'
  ],
  
  patterns: {
    default_export: [],  // Python doesn't have default exports
    named_export: [
      /__all__\s*=\s*\[/  // Explicit export list
    ],
    reexport: [
      /from\s+\S+\s+import\s+/  // Can be re-exported via __all__
    ],
    namespace_export: []
  },
  
  field_names: {
    left: 'left',
    right: 'right',
    name: 'name',
    value: 'value'
  },
  
  features: {
    implicit_exports: true,
    commonjs_support: false,
    type_exports: false,
    visibility_modifiers: false,
    export_list_identifier: '__all__',
    private_prefix: '_'
  },
  
  export_keywords: []  // Python has no export keywords
};

/**
 * Rust export configuration
 */
const RUST_CONFIG: ExportLanguageConfig = {
  export_node_types: [
    // Rust doesn't have export statements - visibility is part of the item
    // We'll handle these as exportable_definition_types instead
  ],
  
  exportable_definition_types: [
    'function_item',
    'struct_item',
    'enum_item',
    'trait_item',
    'impl_item',
    'mod_item',
    'type_item',
    'const_item',
    'static_item'
  ],
  
  patterns: {
    default_export: [],  // Rust doesn't have default exports
    named_export: [
      /pub\s+(?:fn|struct|enum|trait|mod|type|const|static)\s+/
    ],
    reexport: [
      /pub\s+use\s+/
    ],
    namespace_export: [
      /pub\s+use\s+\S+::\*/
    ],
    custom: {
      visibility: [
        /pub\s*\(\s*crate\s*\)/,
        /pub\s*\(\s*super\s*\)/,
        /pub\s*\(\s*in\s+\S+\s*\)/
      ]
    }
  },
  
  field_names: {
    name: 'name',
    value: 'value',
    declaration: 'declaration'
  },
  
  features: {
    implicit_exports: false,
    commonjs_support: false,
    type_exports: false,
    visibility_modifiers: true
  },
  
  export_keywords: ['pub'],
  visibility_keywords: ['pub', 'pub(crate)', 'pub(super)', 'pub(in']
};

/**
 * Configuration map for all supported languages
 */
const LANGUAGE_CONFIGS: Record<Language, ExportLanguageConfig> = {
  javascript: JAVASCRIPT_CONFIG,
  typescript: TYPESCRIPT_CONFIG,
  python: PYTHON_CONFIG,
  rust: RUST_CONFIG
};

/**
 * Get export configuration for a language
 */
export function get_export_config(language: Language): ExportLanguageConfig {
  const config = LANGUAGE_CONFIGS[language];
  if (!config) {
    throw new Error(`No export configuration for language: ${language}`);
  }
  return config;
}

/**
 * Check if a node type represents an export in the given language
 */
export function is_export_node(
  node_type: string,
  language: Language
): boolean {
  const config = get_export_config(language);
  return config.export_node_types.includes(node_type);
}

/**
 * Check if a definition type can be exported in the given language
 */
export function is_exportable_definition(
  definition_type: string,
  language: Language
): boolean {
  const config = get_export_config(language);
  return config.exportable_definition_types.includes(definition_type);
}

/**
 * Check if text matches any export pattern for the given export type
 */
export function matches_export_pattern(
  text: string,
  export_type: keyof ExportLanguageConfig['patterns'],
  language: Language
): boolean {
  const config = get_export_config(language);
  const patterns = config.patterns[export_type];
  
  // Handle custom patterns object
  if (export_type === 'custom' && patterns && typeof patterns === 'object') {
    // Check all custom pattern arrays
    const customPatterns = patterns as { [key: string]: RegExp[] };
    for (const key in customPatterns) {
      const patternArray = customPatterns[key];
      if (Array.isArray(patternArray) && patternArray.some(p => p.test(text))) {
        return true;
      }
    }
    return false;
  }
  
  // Regular pattern arrays
  if (!patterns || !Array.isArray(patterns)) return false;
  
  return patterns.some(pattern => pattern.test(text));
}

/**
 * Check if a symbol name is private according to language conventions
 */
export function is_private_symbol(
  name: string,
  language: Language
): boolean {
  const config = get_export_config(language);
  if (!config.features.private_prefix) return false;
  
  return name.startsWith(config.features.private_prefix);
}

/**
 * Get the export list identifier for a language (e.g., __all__ for Python)
 */
export function get_export_list_identifier(
  language: Language
): string | undefined {
  const config = get_export_config(language);
  return config.features.export_list_identifier;
}

/**
 * Check if a language supports implicit exports
 */
export function has_implicit_exports(language: Language): boolean {
  const config = get_export_config(language);
  return config.features.implicit_exports;
}

/**
 * Check if a language supports CommonJS
 */
export function supports_commonjs(language: Language): boolean {
  const config = get_export_config(language);
  return config.features.commonjs_support;
}

/**
 * Check if a language supports type exports
 */
export function supports_type_exports(language: Language): boolean {
  const config = get_export_config(language);
  return config.features.type_exports;
}

/**
 * Check if a language uses visibility modifiers
 */
export function has_visibility_modifiers(language: Language): boolean {
  const config = get_export_config(language);
  return config.features.visibility_modifiers;
}