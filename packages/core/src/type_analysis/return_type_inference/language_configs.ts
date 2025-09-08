/**
 * Language configuration for return type inference
 * 
 * Defines configuration-driven patterns for extracting and inferring
 * return types across different languages.
 */

import { Language } from '@ariadnejs/types';

/**
 * Configuration for return type inference
 */
export interface ReturnTypeLanguageConfig {
  // Field names in AST for return type annotations
  return_type_field: string;
  
  // Node types that represent type expressions
  type_node_types: {
    primitive: string[];      // Built-in/primitive types
    identifier: string[];      // User-defined type names
    generic: string[];         // Generic/parameterized types
    array: string[];          // Array/list types
    tuple: string[];          // Tuple types
    union: string[];          // Union types (TypeScript, Python)
    optional: string[];       // Optional/nullable types
    function: string[];       // Function types
    object: string[];         // Object/record types
  };
  
  // Expression types that can be analyzed for return type inference
  expression_types: {
    literals: {
      string: string[];
      number: string[];
      boolean: string[];
      null: string[];
      undefined: string[];
    };
    collections: {
      array: string[];
      object: string[];
      map: string[];
      set: string[];
    };
    special: {
      new_expression: string[];    // Constructor calls
      call_expression: string[];   // Function calls
      await_expression: string[];  // Async/await
      yield_expression: string[];  // Generators
    };
  };
  
  // Default return types for different contexts
  defaults: {
    void_type: string;           // No return value
    constructor_type: string;     // Constructor return type
    async_wrapper: string;        // Wrapper for async functions (Promise, etc.)
    generator_wrapper: string;    // Wrapper for generators
  };
  
  // Special patterns
  patterns: {
    has_explicit_annotations: boolean;  // Language has type annotations
    has_docstring_types: boolean;       // Types in docstrings
    has_jsdoc_types: boolean;          // JSDoc comments
    requires_return_type: boolean;      // Return type required (Rust)
    implicit_returns: boolean;          // Last expression is return
  };
  
  // Node types for special function types
  function_modifiers: {
    async_keywords: string[];      // async, async def
    generator_indicators: string[]; // function*, yield
    constructor_names: string[];   // __init__, constructor, new
  };
}

// TypeScript configuration
const TYPESCRIPT_CONFIG: ReturnTypeLanguageConfig = {
  return_type_field: 'return_type',
  
  type_node_types: {
    primitive: ['predefined_type'],
    identifier: ['type_identifier'],
    generic: ['generic_type'],
    array: ['array_type'],
    tuple: ['tuple_type'],
    union: ['union_type'],
    optional: ['optional_type'],
    function: ['function_type'],
    object: ['object_type', 'interface', 'type_literal']
  },
  
  expression_types: {
    literals: {
      string: ['string', 'template_string'],
      number: ['number'],
      boolean: ['true', 'false'],
      null: ['null'],
      undefined: ['undefined']
    },
    collections: {
      array: ['array'],
      object: ['object'],
      map: [],  // Map literal not applicable in TS/JS
      set: []   // Set literal not applicable in TS/JS
    },
    special: {
      new_expression: ['new_expression'],  // Handles all constructor calls
      call_expression: ['call_expression'],
      await_expression: ['await_expression'],
      yield_expression: ['yield_expression']
    }
  },
  
  defaults: {
    void_type: 'void',
    constructor_type: 'this',
    async_wrapper: 'Promise',
    generator_wrapper: 'Generator'
  },
  
  patterns: {
    has_explicit_annotations: true,
    has_docstring_types: false,
    has_jsdoc_types: false,
    requires_return_type: false,
    implicit_returns: false
  },
  
  function_modifiers: {
    async_keywords: ['async'],
    generator_indicators: ['function*', 'yield'],
    constructor_names: ['constructor']
  }
};

// JavaScript configuration
const JAVASCRIPT_CONFIG: ReturnTypeLanguageConfig = {
  return_type_field: '',  // No explicit return types
  
  type_node_types: {
    primitive: [],
    identifier: [],
    generic: [],
    array: [],
    tuple: [],
    union: [],
    optional: [],
    function: [],
    object: []
  },
  
  expression_types: {
    literals: {
      string: ['string', 'template_string'],
      number: ['number'],
      boolean: ['true', 'false'],
      null: ['null'],
      undefined: ['undefined']
    },
    collections: {
      array: ['array'],
      object: ['object'],
      map: [],
      set: []
    },
    special: {
      new_expression: ['new_expression'],
      call_expression: ['call_expression'],
      await_expression: ['await_expression'],
      yield_expression: ['yield_expression']
    }
  },
  
  defaults: {
    void_type: 'undefined',
    constructor_type: 'Object',
    async_wrapper: 'Promise',
    generator_wrapper: 'Generator'
  },
  
  patterns: {
    has_explicit_annotations: false,
    has_docstring_types: false,
    has_jsdoc_types: true,  // JSDoc comments
    requires_return_type: false,
    implicit_returns: false
  },
  
  function_modifiers: {
    async_keywords: ['async'],
    generator_indicators: ['function*', 'yield'],
    constructor_names: ['constructor']
  }
};

// Python configuration
const PYTHON_CONFIG: ReturnTypeLanguageConfig = {
  return_type_field: 'return_type',
  
  type_node_types: {
    primitive: ['type', 'identifier'],
    identifier: ['identifier', 'attribute'],
    generic: ['generic_type', 'subscript'],
    array: ['subscript'],  // List[int]
    tuple: ['tuple'],
    union: ['union_type', 'binary_operator'],  // Union[str, int] or str | int
    optional: ['optional_type', 'subscript'],  // Optional[str]
    function: ['function_type'],
    object: ['dictionary', 'attribute']
  },
  
  expression_types: {
    literals: {
      string: ['string', 'concatenated_string'],
      number: ['integer', 'float'],
      boolean: ['true', 'false'],
      null: ['none'],
      undefined: ['none']
    },
    collections: {
      array: ['list'],
      object: ['dictionary'],
      map: ['dictionary'],
      set: ['set']
    },
    special: {
      new_expression: ['call'],  // ClassName()
      call_expression: ['call'],
      await_expression: ['await'],
      yield_expression: ['yield', 'yield_from']
    }
  },
  
  defaults: {
    void_type: 'None',
    constructor_type: 'None',  // __init__ returns None
    async_wrapper: 'Awaitable',
    generator_wrapper: 'Generator'
  },
  
  patterns: {
    has_explicit_annotations: true,
    has_docstring_types: true,  // Types in docstrings
    has_jsdoc_types: false,
    requires_return_type: false,
    implicit_returns: true  // Last expression can be implicit return
  },
  
  function_modifiers: {
    async_keywords: ['async'],
    generator_indicators: ['yield', 'yield_from'],
    constructor_names: ['__init__', '__new__']
  }
};

// Rust configuration
const RUST_CONFIG: ReturnTypeLanguageConfig = {
  return_type_field: 'return_type',
  
  type_node_types: {
    primitive: ['primitive_type'],
    identifier: ['type_identifier', 'scoped_type_identifier'],
    generic: ['generic_type'],
    array: ['array_type'],
    tuple: ['tuple_type'],
    union: [],  // Rust uses enums instead
    optional: ['generic_type'],  // Option<T>
    function: ['function_type'],
    object: ['struct', 'enum']
  },
  
  expression_types: {
    literals: {
      string: ['string_literal', 'char_literal'],
      number: ['integer_literal', 'float_literal'],
      boolean: ['boolean_literal'],
      null: [],  // Rust doesn't have null
      undefined: []  // Rust doesn't have undefined
    },
    collections: {
      array: ['array_expression'],
      object: ['struct_expression'],
      map: [],  // HashMap handled as call_expression
      set: []   // HashSet handled as call_expression
    },
    special: {
      new_expression: ['struct_expression'],
      call_expression: ['call_expression'],
      await_expression: ['await_expression'],
      yield_expression: []  // Rust doesn't have yield
    }
  },
  
  defaults: {
    void_type: '()',  // Unit type
    constructor_type: 'Self',
    async_wrapper: 'impl Future',
    generator_wrapper: 'impl Iterator'
  },
  
  patterns: {
    has_explicit_annotations: true,
    has_docstring_types: false,
    has_jsdoc_types: false,
    requires_return_type: true,  // Rust requires explicit return types
    implicit_returns: true  // Last expression without semicolon
  },
  
  function_modifiers: {
    async_keywords: ['async'],
    generator_indicators: [],
    constructor_names: ['new', 'from', 'default']
  }
};

// Configuration map
const LANGUAGE_CONFIGS: Record<Language, ReturnTypeLanguageConfig> = {
  typescript: TYPESCRIPT_CONFIG,
  javascript: JAVASCRIPT_CONFIG,
  python: PYTHON_CONFIG,
  rust: RUST_CONFIG
};

/**
 * Get language configuration for return type inference
 */
export function get_return_type_config(language: Language): ReturnTypeLanguageConfig {
  const config = LANGUAGE_CONFIGS[language];
  if (!config) {
    throw new Error(`No return type configuration for language: ${language}`);
  }
  return config;
}

/**
 * Check if a node type represents a type expression
 */
export function is_type_node(node_type: string, config: ReturnTypeLanguageConfig): boolean {
  const types = config.type_node_types;
  return types.primitive.includes(node_type) ||
         types.identifier.includes(node_type) ||
         types.generic.includes(node_type) ||
         types.array.includes(node_type) ||
         types.tuple.includes(node_type) ||
         types.union.includes(node_type) ||
         types.optional.includes(node_type) ||
         types.function.includes(node_type) ||
         types.object.includes(node_type);
}

/**
 * Get expression type category for inference
 */
export function get_expression_category(
  node_type: string,
  config: ReturnTypeLanguageConfig
): { category: string; type: string } | undefined {
  const expr = config.expression_types;
  
  // Check literals
  for (const [type, nodes] of Object.entries(expr.literals)) {
    if (nodes.includes(node_type)) {
      return { category: 'literal', type };
    }
  }
  
  // Check collections
  for (const [type, nodes] of Object.entries(expr.collections)) {
    if (nodes.includes(node_type)) {
      return { category: 'collection', type };
    }
  }
  
  // Check special
  for (const [type, nodes] of Object.entries(expr.special)) {
    if (nodes.includes(node_type)) {
      return { category: 'special', type };
    }
  }
  
  return undefined;
}