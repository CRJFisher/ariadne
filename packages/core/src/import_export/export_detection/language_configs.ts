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
    
    // Whether visibility is checked on the item itself (e.g., Rust)
    visibility_on_item?: boolean;
    
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
      /^export\s+default\s+/m,
      /^module\.exports\s*=\s*(?!\{)/m  // CommonJS default
    ],
    named_export: [
      /^export\s+(?:const|let|var|function|class|async\s+function)\s+/m,
      /^export\s*\{/m,
      /^exports\.(\w+)\s*=/m,  // CommonJS named
      /^Object\.defineProperty\(exports,\s*['"]\w+['"]\s*,/m  // CommonJS defineProperty
    ],
    reexport: [
      /^export\s*\{[^}]*\}\s*from\s*['"`]/m,
      /^export\s*\*\s*from\s*['"`]/m,
      /^export\s*\*\s*as\s+\w+\s*from\s*['"`]/m
    ],
    namespace_export: [
      /^export\s*\*\s*as\s+\w+(?:\s+from)?/m
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
    'namespace_declaration',
    'ambient_declaration'
  ],
  
  patterns: {
    ...JAVASCRIPT_CONFIG.patterns,
    named_export: [
      ...JAVASCRIPT_CONFIG.patterns.named_export,
      /^export\s+(?:type|interface|enum|namespace|declare\s+(?:const|let|var|function|class))\s+/m,
      /^export\s+abstract\s+class\s+/m,
      /^export\s+declare\s+(?:const|let|var|function|class|interface|type|enum|namespace)\s+/m
    ],
    custom: {
      ...JAVASCRIPT_CONFIG.patterns.custom,
      type_export: [
        /^export\s+type\s+\{[^}]*\}/m,
        /^export\s+type\s+\w+/m,
        /^export\s+(?:type|interface)\s+\w+\s*(?:<[^>]+>)?\s*=/m
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
      /^__all__\s*=\s*\[/m,  // Explicit export list
      /^__all__\s*\+?=/m  // __all__ assignment or augmentation
    ],
    reexport: [
      /^from\s+[\w.]+\s+import\s+/m,  // Can be re-exported via __all__
      /^import\s+\w+\s+as\s+\w+$/m  // Import with alias at module level
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
    'use_declaration'  // pub use statements are exports
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
    'static_item',
    'macro_definition'
  ],
  
  patterns: {
    default_export: [],  // Rust doesn't have default exports
    named_export: [
      /^\s*pub(?:\([^)]+\))?\s+(?:fn|struct|enum|trait|mod|type|const|static|unsafe\s+fn|async\s+fn)\s+/m
    ],
    reexport: [
      /^\s*pub(?:\([^)]+\))?\s+use\s+/m
    ],
    namespace_export: [
      /^\s*pub(?:\([^)]+\))?\s+use\s+[^;]+::\*(?:\s+as\s+\w+)?/m
    ],
    custom: {
      visibility: [
        /^\s*pub\s*\(\s*crate\s*\)/m,
        /^\s*pub\s*\(\s*super\s*\)/m,
        /^\s*pub\s*\(\s*in\s+[^)]+\s*\)/m,
        /^\s*pub\s*\(\s*self\s*\)/m
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
    visibility_modifiers: true,
    // Rust checks visibility on the item itself, not through separate export statements
    visibility_on_item: true
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
    const custom_patterns = patterns as { [key: string]: RegExp[] };
    for (const key in custom_patterns) {
      const pattern_array = custom_patterns[key];
      if (Array.isArray(pattern_array) && pattern_array.some(p => p.test(text))) {
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

/**
 * Check if a pattern is a barrel export pattern
 */
export function is_barrel_export(source_path: string): boolean {
  // Barrel exports typically export from sibling modules
  return source_path.startsWith('./') && 
         !source_path.includes('..') && 
         !source_path.includes('.json') &&
         !source_path.includes('.css');
}

/**
 * Get all export keywords for a language
 */
export function get_export_keywords(language: Language): string[] {
  const config = get_export_config(language);
  return config.export_keywords;
}

/**
 * Check if text contains any export keyword
 */
export function contains_export_keyword(
  text: string,
  language: Language
): boolean {
  const keywords = get_export_keywords(language);
  return keywords.some(keyword => text.includes(keyword));
}

/**
 * Normalize export kind based on language conventions
 */
export function normalize_export_kind(
  kind: string,
  language: Language
): string {
  // Normalize kind based on language
  if (language === 'rust') {
    // Rust uses more specific kinds
    const rust_kinds: Record<string, string> = {
      'function': 'fn',
      'class': 'struct',
      'interface': 'trait',
      'module': 'mod'
    };
    return rust_kinds[kind] || kind;
  }
  
  if (language === 'python') {
    // Python doesn't distinguish as much
    if (kind === 'interface' || kind === 'trait') {
      return 'class';
    }
  }
  
  return kind;
}