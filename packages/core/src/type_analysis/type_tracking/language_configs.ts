/**
 * Language configuration for type tracking
 *
 * Captures language-specific differences in type systems through configuration
 * rather than code duplication. Approximately 85% of type tracking logic
 * can be driven by these configurations.
 */

import { Language } from "@ariadnejs/types";

/**
 * Configuration for type tracking in a specific language
 */
export interface TypeTrackingLanguageConfig {
  // Node types for assignments
  assignment_nodes: {
    variable_declaration: string; // e.g., 'variable_declarator', 'assignment'
    assignment_expression: string; // e.g., 'assignment_expression', 'assignment'
    annotated_assignment?: string; // e.g., 'annotated_assignment' (Python)
    augmented_assignment?: string; // e.g., 'augmented_assignment'
  };

  // Field names in AST nodes
  field_names: {
    name: string; // e.g., 'name', 'left', 'target'
    value: string; // e.g., 'value', 'right', 'init'
    type?: string; // e.g., 'type', 'annotation'
    parameters?: string; // e.g., 'parameters', 'params'
  };

  // Literal type mappings
  literal_types: {
    string: { node_types: string[]; type_name: string };
    number: { node_types: string[]; type_name: string };
    boolean: { node_types: string[]; type_name: string };
    null: { node_types: string[]; type_name: string };
    undefined?: { node_types: string[]; type_name: string };
  };

  // Collection type mappings
  collection_types: {
    array: { node_type: string; type_name: string };
    object: { node_type: string; type_name: string };
    set?: { node_type: string; type_name: string };
    map?: { node_type: string; type_name: string };
  };

  // Import/export patterns
  import_patterns: {
    import_statement: string;
    import_specifier: string;
    default_import?: string;
    namespace_import?: string;
  };

  export_patterns: {
    export_statement: string;
    default_export?: string;
    named_export?: string;
  };

  // Type annotation nodes (if supported)
  type_annotations?: {
    type_annotation: string;
    type_identifier: string;
    predefined_type?: string;
    generic_type?: string;
    array_type?: string;
    union_type?: string;
  };

  // Class and function patterns
  class_patterns: {
    class_declaration: string;
    constructor?: string;
    method_definition: string;
    property_definition?: string;
  };

  function_patterns: {
    function_declaration: string;
    arrow_function?: string;
    anonymous_function?: string;
    generator_function?: string;
  };

  // Language-specific features
  features: {
    has_type_annotations: boolean;
    has_generics: boolean;
    has_interfaces: boolean;
    has_type_aliases: boolean;
    has_duck_typing: boolean;
    has_ownership: boolean;
    has_traits: boolean;
  };
}

/**
 * JavaScript configuration
 */
const JAVASCRIPT_CONFIG: TypeTrackingLanguageConfig = {
  assignment_nodes: {
    variable_declaration: "variable_declarator",
    assignment_expression: "assignment_expression",
  },

  field_names: {
    name: "name",
    value: "value",
    parameters: "parameters",
  },

  literal_types: {
    string: { node_types: ["string", "template_string"], type_name: "string" },
    number: { node_types: ["number"], type_name: "number" },
    boolean: { node_types: ["true", "false"], type_name: "boolean" },
    null: { node_types: ["null"], type_name: "null" },
    undefined: { node_types: ["undefined"], type_name: "undefined" },
  },

  collection_types: {
    array: { node_type: "array", type_name: "Array" },
    object: { node_type: "object", type_name: "Object" },
  },

  import_patterns: {
    import_statement: "import_statement",
    import_specifier: "import_specifier",
    default_import: "import_clause",
    namespace_import: "namespace_import",
  },

  export_patterns: {
    export_statement: "export_statement",
    default_export: "export_default",
    named_export: "export_specifier",
  },

  class_patterns: {
    class_declaration: "class_declaration",
    constructor: "constructor",
    method_definition: "method_definition",
    property_definition: "field_definition",
  },

  function_patterns: {
    function_declaration: "function_declaration",
    arrow_function: "arrow_function",
    anonymous_function: "function_expression",
    generator_function: "generator_function",
  },

  features: {
    has_type_annotations: false,
    has_generics: false,
    has_interfaces: false,
    has_type_aliases: false,
    has_duck_typing: true,
    has_ownership: false,
    has_traits: false,
  },
};

/**
 * TypeScript configuration (extends JavaScript)
 */
const TYPESCRIPT_CONFIG: TypeTrackingLanguageConfig = {
  ...JAVASCRIPT_CONFIG,

  field_names: {
    ...JAVASCRIPT_CONFIG.field_names,
    type: "type",
  },

  type_annotations: {
    type_annotation: "type_annotation",
    type_identifier: "type_identifier",
    predefined_type: "predefined_type",
    generic_type: "generic_type",
    array_type: "array_type",
    union_type: "union_type",
  },

  features: {
    has_type_annotations: true,
    has_generics: true,
    has_interfaces: true,
    has_type_aliases: true,
    has_duck_typing: true,
    has_ownership: false,
    has_traits: false,
  },
};

/**
 * Python configuration
 */
const PYTHON_CONFIG: TypeTrackingLanguageConfig = {
  assignment_nodes: {
    variable_declaration: "assignment",
    assignment_expression: "assignment",
    annotated_assignment: "annotated_assignment",
    augmented_assignment: "augmented_assignment",
  },

  field_names: {
    name: "left",
    value: "right",
    type: "annotation",
    parameters: "parameters",
  },

  literal_types: {
    string: { node_types: ["string"], type_name: "str" },
    number: { node_types: ["integer", "float"], type_name: "int" }, // Will be refined
    boolean: { node_types: ["true", "false"], type_name: "bool" },
    null: { node_types: ["none"], type_name: "None" },
  },

  collection_types: {
    array: { node_type: "list", type_name: "list" },
    object: { node_type: "dictionary", type_name: "dict" },
    set: { node_type: "set", type_name: "set" },
  },

  import_patterns: {
    import_statement: "import_statement",
    import_specifier: "import_from_statement",
  },

  export_patterns: {
    export_statement: "__all__", // Python uses __all__ for exports
  },

  type_annotations: {
    type_annotation: "type",
    type_identifier: "identifier",
    generic_type: "subscript",
    union_type: "binary_operator", // Union[A, B] syntax
  },

  class_patterns: {
    class_declaration: "class_definition",
    constructor: "__init__",
    method_definition: "function_definition",
  },

  function_patterns: {
    function_declaration: "function_definition",
    anonymous_function: "lambda",
    generator_function: "function_definition", // with yield
  },

  features: {
    has_type_annotations: true,
    has_generics: true,
    has_interfaces: false,
    has_type_aliases: true,
    has_duck_typing: true,
    has_ownership: false,
    has_traits: false,
  },
};

/**
 * Rust configuration
 */
const RUST_CONFIG: TypeTrackingLanguageConfig = {
  assignment_nodes: {
    variable_declaration: "let_declaration",
    assignment_expression: "assignment_expression",
  },

  field_names: {
    name: "pattern",
    value: "value",
    type: "type",
    parameters: "parameters",
  },

  literal_types: {
    string: { node_types: ["string_literal"], type_name: "&str" },
    number: {
      node_types: ["integer_literal", "float_literal"],
      type_name: "i32",
    }, // Will be refined
    boolean: { node_types: ["boolean_literal"], type_name: "bool" },
    null: { node_types: ["unit_expression"], type_name: "()" },
  },

  collection_types: {
    array: { node_type: "array_expression", type_name: "Vec" },
    object: { node_type: "struct_expression", type_name: "struct" },
  },

  import_patterns: {
    import_statement: "use_declaration",
    import_specifier: "use_as_clause",
  },

  export_patterns: {
    export_statement: "pub",
  },

  type_annotations: {
    type_annotation: "type_identifier",
    type_identifier: "type_identifier",
    generic_type: "generic_type",
    array_type: "array_type",
  },

  class_patterns: {
    class_declaration: "struct_item",
    constructor: undefined, // Rust doesn't have constructors like other languages
    method_definition: "impl_item",
  },

  function_patterns: {
    function_declaration: "function_item",
    anonymous_function: "closure_expression",
  },

  features: {
    has_type_annotations: true,
    has_generics: true,
    has_interfaces: false,
    has_type_aliases: true,
    has_duck_typing: false,
    has_ownership: true,
    has_traits: true,
  },
};

/**
 * Get configuration for a specific language
 */
export function get_type_tracking_config(
  language: Language
): TypeTrackingLanguageConfig {
  switch (language) {
    case "javascript":
      return JAVASCRIPT_CONFIG;
    case "typescript":
      return TYPESCRIPT_CONFIG;
    case "python":
      return PYTHON_CONFIG;
    case "rust":
      return RUST_CONFIG;
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}

/**
 * Check if a node type matches an assignment pattern
 */
export function is_assignment_node(
  node_type: string,
  config: TypeTrackingLanguageConfig
): boolean {
  return Object.values(config.assignment_nodes).includes(node_type);
}

/**
 * Get the literal type for a node
 */
export function get_literal_type(
  node_type: string,
  config: TypeTrackingLanguageConfig
): { type_name: string; type_kind: "primitive" } | undefined {
  for (const [_, literal_config] of Object.entries(config.literal_types)) {
    if (literal_config && literal_config.node_types.includes(node_type)) {
      return {
        type_name: literal_config.type_name,
        type_kind: "primitive",
      };
    }
  }
  return undefined;
}

/**
 * Get the collection type for a node
 */
export function get_collection_type(
  node_type: string,
  config: TypeTrackingLanguageConfig
): { type_name: string; type_kind: "array" | "object" } | undefined {
  for (const [kind, collection_config] of Object.entries(
    config.collection_types
  )) {
    if (collection_config && collection_config.node_type === node_type) {
      return {
        type_name: collection_config.type_name,
        type_kind: kind === "object" ? "object" : "array",
      };
    }
  }
  return undefined;
}
