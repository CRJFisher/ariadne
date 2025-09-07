/**
 * Language-specific scope configuration
 * 
 * Defines scope-creating constructs and their properties for each language.
 * This configuration drives the generic scope tree builder.
 */

import { Language, ScopeType } from "@ariadnejs/types";

/**
 * Configuration for scope-creating constructs
 */
export interface ScopeConfiguration {
  /** Node types that create new scopes */
  scope_creating_nodes: {
    [nodeType: string]: {
      scope_type: ScopeType;
      /** Whether this node's name should be added to parent scope */
      adds_to_parent?: boolean;
      /** Fields that contain the scope name */
      name_field?: string;
      /** Fields that contain parameters */
      parameter_fields?: string[];
      /** Fields that contain generic/type parameters */
      generic_fields?: string[];
      /** Whether this is a block scope (for let/const in JS) */
      is_block_scope?: boolean;
    };
  };
  
  /** Node types that define symbols */
  symbol_defining_nodes: {
    [nodeType: string]: {
      /** How to extract the symbol name */
      name_extraction: "field" | "text" | "pattern";
      /** Field name if name_extraction is "field" */
      name_field?: string;
      /** Symbol kind */
      kind: "variable" | "function" | "class" | "type" | "import" | "parameter";
      /** Whether this symbol is hoisted */
      is_hoisted?: boolean;
      /** Scope to hoist to (function or global) */
      hoist_scope?: "function" | "global";
    };
  };
  
  /** Parameter node types */
  parameter_nodes: string[];
  
  /** Assignment node types */
  assignment_nodes: {
    [nodeType: string]: {
      /** Field containing the target */
      target_field: string;
      /** Field containing the value */
      value_field?: string;
    };
  };
  
  /** Special language features */
  features: {
    /** Whether the language has hoisting */
    has_hoisting?: boolean;
    /** Whether the language has block scopes */
    has_block_scopes?: boolean;
    /** Whether the language has type-only scopes */
    has_type_scopes?: boolean;
    /** Whether the language has global/nonlocal declarations */
    has_scope_modifiers?: boolean;
    /** Built-in symbols that are always available */
    builtin_symbols?: string[];
  };
}

/**
 * JavaScript scope configuration
 */
const JAVASCRIPT_CONFIG: ScopeConfiguration = {
  scope_creating_nodes: {
    "function_declaration": {
      scope_type: "function",
      adds_to_parent: true,
      name_field: "name",
      parameter_fields: ["parameters"],
    },
    "function_expression": {
      scope_type: "function",
      name_field: "name",
      parameter_fields: ["parameters"],
    },
    "arrow_function": {
      scope_type: "function",
      parameter_fields: ["parameters"],
    },
    "method_definition": {
      scope_type: "function",
      name_field: "name",
      parameter_fields: ["parameters"],
    },
    "class_declaration": {
      scope_type: "class",
      adds_to_parent: true,
      name_field: "name",
    },
    "class_expression": {
      scope_type: "class",
      name_field: "name",
    },
    "for_statement": {
      scope_type: "block",
      is_block_scope: true,
    },
    "for_in_statement": {
      scope_type: "block",
      is_block_scope: true,
    },
    "for_of_statement": {
      scope_type: "block",
      is_block_scope: true,
    },
    "while_statement": {
      scope_type: "block",
      is_block_scope: true,
    },
    "do_statement": {
      scope_type: "block",
      is_block_scope: true,
    },
    "if_statement": {
      scope_type: "block",
      is_block_scope: true,
    },
    "switch_statement": {
      scope_type: "block",
      is_block_scope: true,
    },
    "statement_block": {
      scope_type: "block",
      is_block_scope: true,
    },
    "try_statement": {
      scope_type: "block",
      is_block_scope: true,
    },
    "catch_clause": {
      scope_type: "block",
      is_block_scope: true,
      parameter_fields: ["parameter"],
    },
  },
  
  symbol_defining_nodes: {
    // Note: variable_declarator is handled by bespoke handler to capture declaration type
    "function_declaration": {
      name_extraction: "field",
      name_field: "name",
      kind: "function",
      is_hoisted: true,
      hoist_scope: "function",
    },
    "class_declaration": {
      name_extraction: "field",
      name_field: "name",
      kind: "class",
    },
    "import_specifier": {
      name_extraction: "field",
      name_field: "alias",
      kind: "import",
    },
    "namespace_import": {
      name_extraction: "field",
      name_field: "name",
      kind: "import",
    },
  },
  
  parameter_nodes: [
    "formal_parameters",
    "required_parameter",
    "optional_parameter",
    "rest_parameter",
  ],
  
  assignment_nodes: {
    "assignment_expression": {
      target_field: "left",
      value_field: "right",
    },
    "augmented_assignment_expression": {
      target_field: "left",
      value_field: "right",
    },
  },
  
  features: {
    has_hoisting: true,
    has_block_scopes: true,
    has_type_scopes: false,
    has_scope_modifiers: false,
    builtin_symbols: [
      "console", "window", "document", "global", "process",
      "Array", "Object", "String", "Number", "Boolean",
      "Promise", "Map", "Set", "WeakMap", "WeakSet",
      "Symbol", "Error", "Date", "Math", "JSON",
    ],
  },
};

/**
 * TypeScript scope configuration
 */
const TYPESCRIPT_CONFIG: ScopeConfiguration = {
  ...JAVASCRIPT_CONFIG,
  scope_creating_nodes: {
    ...JAVASCRIPT_CONFIG.scope_creating_nodes,
    // Override function_declaration to add generic_fields
    "function_declaration": {
      scope_type: "function",
      adds_to_parent: true,
      name_field: "name",
      parameter_fields: ["parameters"],
      generic_fields: ["type_parameters"],
    },
    "function_expression": {
      scope_type: "function",
      name_field: "name",
      parameter_fields: ["parameters"],
      generic_fields: ["type_parameters"],
    },
    "arrow_function": {
      scope_type: "function",
      parameter_fields: ["parameters"],
      generic_fields: ["type_parameters"],
    },
    "method_definition": {
      scope_type: "function",
      name_field: "name",
      parameter_fields: ["parameters"],
      generic_fields: ["type_parameters"],
    },
    "interface_declaration": {
      scope_type: "class",
      adds_to_parent: true,
      name_field: "name",
      generic_fields: ["type_parameters"],
    },
    "type_alias_declaration": {
      scope_type: "class",
      adds_to_parent: true,
      name_field: "name",
      generic_fields: ["type_parameters"],
    },
    "enum_declaration": {
      scope_type: "class",
      adds_to_parent: true,
      name_field: "name",
    },
    "internal_module": {
      scope_type: "module",
      adds_to_parent: true,
      name_field: "name",
    },
    "module": {
      scope_type: "module",
      adds_to_parent: true,
      name_field: "name",
    },
  },
  
  symbol_defining_nodes: {
    ...JAVASCRIPT_CONFIG.symbol_defining_nodes,
    "interface_declaration": {
      name_extraction: "field",
      name_field: "name",
      kind: "type",
    },
    "type_alias_declaration": {
      name_extraction: "field",
      name_field: "name",
      kind: "type",
    },
    "enum_declaration": {
      name_extraction: "field",
      name_field: "name",
      kind: "type",
    },
    "enum_member": {
      name_extraction: "field",
      name_field: "name",
      kind: "variable",
    },
  },
  
  features: {
    ...JAVASCRIPT_CONFIG.features,
    has_type_scopes: true,
  },
};

/**
 * Python scope configuration
 */
const PYTHON_CONFIG: ScopeConfiguration = {
  scope_creating_nodes: {
    "function_definition": {
      scope_type: "function",
      adds_to_parent: true,
      name_field: "name",
      parameter_fields: ["parameters"],
    },
    "lambda": {
      scope_type: "function",
      parameter_fields: ["parameters"],
    },
    "class_definition": {
      scope_type: "class",
      adds_to_parent: true,
      name_field: "name",
    },
    "list_comprehension": {
      scope_type: "block",
    },
    "set_comprehension": {
      scope_type: "block",
    },
    "dictionary_comprehension": {
      scope_type: "block",
    },
    "generator_expression": {
      scope_type: "block",
    },
    "with_statement": {
      scope_type: "block",
    },
  },
  
  symbol_defining_nodes: {
    // Note: assignments are handled by bespoke handler to capture metadata
    "function_definition": {
      name_extraction: "field",
      name_field: "name",
      kind: "function",
    },
    "class_definition": {
      name_extraction: "field",
      name_field: "name",
      kind: "class",
    },
    "import_from_statement": {
      name_extraction: "pattern",
      kind: "import",
    },
    "import_statement": {
      name_extraction: "pattern",
      kind: "import",
    },
    "aliased_import": {
      name_extraction: "field",
      name_field: "alias",
      kind: "import",
    },
  },
  
  parameter_nodes: [
    "parameters",
    "typed_parameter",
    "default_parameter",
    "typed_default_parameter",
    "list_splat_pattern",
    "dictionary_splat_pattern",
  ],
  
  assignment_nodes: {
    "assignment": {
      target_field: "left",
      value_field: "right",
    },
    "augmented_assignment": {
      target_field: "left",
      value_field: "right",
    },
    "named_expression": {
      target_field: "left",
      value_field: "right",
    },
  },
  
  features: {
    has_hoisting: false,
    has_block_scopes: false,
    has_type_scopes: false,
    has_scope_modifiers: true, // global/nonlocal
    builtin_symbols: [
      "__name__", "__file__", "__doc__", "__package__",
      "True", "False", "None", "NotImplemented", "Ellipsis",
      "abs", "all", "any", "ascii", "bin", "bool", "bytes",
      "callable", "chr", "classmethod", "compile", "complex",
      "delattr", "dict", "dir", "divmod", "enumerate", "eval",
      "exec", "filter", "float", "format", "frozenset", "getattr",
      "globals", "hasattr", "hash", "help", "hex", "id", "input",
      "int", "isinstance", "issubclass", "iter", "len", "list",
      "locals", "map", "max", "memoryview", "min", "next", "object",
      "oct", "open", "ord", "pow", "print", "property", "range",
      "repr", "reversed", "round", "set", "setattr", "slice",
      "sorted", "staticmethod", "str", "sum", "super", "tuple",
      "type", "vars", "zip",
    ],
  },
};

/**
 * Rust scope configuration
 */
const RUST_CONFIG: ScopeConfiguration = {
  scope_creating_nodes: {
    "function_item": {
      scope_type: "function",
      adds_to_parent: true,
      name_field: "name",
      parameter_fields: ["parameters"],
      generic_fields: ["type_parameters"],
    },
    "closure_expression": {
      scope_type: "function",
      parameter_fields: ["parameters"],
    },
    "impl_item": {
      scope_type: "class",
      generic_fields: ["type_parameters"],
    },
    "trait_item": {
      scope_type: "class",
      adds_to_parent: true,
      name_field: "name",
      generic_fields: ["type_parameters"],
    },
    // Note: struct_item and enum_item don't create scopes in Rust
    // They define types but their methods are in impl blocks
    "mod_item": {
      scope_type: "module",
      adds_to_parent: true,
      name_field: "name",
    },
    "block": {
      scope_type: "block",
    },
    "if_expression": {
      scope_type: "block",
    },
    "match_expression": {
      scope_type: "block",
    },
    "match_arm": {
      scope_type: "block",
    },
    "while_expression": {
      scope_type: "block",
    },
    "for_expression": {
      scope_type: "block",
    },
    "loop_expression": {
      scope_type: "block",
    },
    "unsafe_block": {
      scope_type: "block",
    },
  },
  
  symbol_defining_nodes: {
    "let_declaration": {
      name_extraction: "pattern",
      kind: "variable",
    },
    "const_item": {
      name_extraction: "field",
      name_field: "name",
      kind: "variable",
    },
    "static_item": {
      name_extraction: "field",
      name_field: "name",
      kind: "variable",
    },
    "function_item": {
      name_extraction: "field",
      name_field: "name",
      kind: "function",
    },
    "struct_item": {
      name_extraction: "field",
      name_field: "name",
      kind: "type",
    },
    "enum_item": {
      name_extraction: "field",
      name_field: "name",
      kind: "type",
    },
    "type_item": {
      name_extraction: "field",
      name_field: "name",
      kind: "type",
    },
    "use_declaration": {
      name_extraction: "pattern",
      kind: "import",
    },
  },
  
  parameter_nodes: [
    "parameters",
    "parameter",
    "self_parameter",
  ],
  
  assignment_nodes: {
    "assignment_expression": {
      target_field: "left",
      value_field: "right",
    },
    "compound_assignment_expr": {
      target_field: "left",
      value_field: "right",
    },
  },
  
  features: {
    has_hoisting: false,
    has_block_scopes: true,
    has_type_scopes: false,
    has_scope_modifiers: false,
    builtin_symbols: [
      // Rust prelude items
      "Option", "Some", "None", "Result", "Ok", "Err",
      "String", "Vec", "Box", "Rc", "Arc",
      "Copy", "Clone", "Default", "Debug", "Display",
      "PartialEq", "Eq", "PartialOrd", "Ord", "Hash",
      "Iterator", "IntoIterator", "From", "Into",
      "AsRef", "AsMut", "Drop", "Fn", "FnMut", "FnOnce",
      "std", "core", "alloc", "self", "super", "crate",
    ],
  },
};

/**
 * Configuration map for all supported languages
 */
const LANGUAGE_CONFIGS: Record<Language, ScopeConfiguration> = {
  javascript: JAVASCRIPT_CONFIG,
  typescript: TYPESCRIPT_CONFIG,
  python: PYTHON_CONFIG,
  rust: RUST_CONFIG,
};

/**
 * Get scope configuration for a language
 */
export function get_language_config(language: Language): ScopeConfiguration {
  const config = LANGUAGE_CONFIGS[language];
  if (!config) {
    throw new Error(`No scope configuration for language: ${language}`);
  }
  return config;
}

/**
 * Check if a node creates a scope
 */
export function creates_scope(
  node_type: string,
  language: Language
): boolean {
  const config = get_language_config(language);
  return node_type in config.scope_creating_nodes;
}

/**
 * Get scope type for a node
 */
export function get_scope_type(
  node_type: string,
  language: Language
): ScopeType {
  const config = get_language_config(language);
  const scope_config = config.scope_creating_nodes[node_type];
  return scope_config?.scope_type || "block";
}

/**
 * Check if a symbol should be hoisted
 */
export function should_hoist_symbol(
  node_type: string,
  language: Language
): boolean {
  const config = get_language_config(language);
  const symbol_config = config.symbol_defining_nodes[node_type];
  return symbol_config?.is_hoisted || false;
}

/**
 * Check if a name is a builtin symbol
 */
export function is_builtin_symbol(
  name: string,
  language: Language
): boolean {
  const config = get_language_config(language);
  return config.features.builtin_symbols?.includes(name) || false;
}