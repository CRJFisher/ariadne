/**
 * Language-specific configurations for type propagation
 * 
 * These configurations capture the differences in AST node types,
 * field names, and propagation patterns between languages.
 */

import { Language } from '@ariadnejs/types';

/**
 * Configuration for language-specific type propagation patterns
 */
export interface TypePropagationConfig {
  // Node types that represent assignments
  assignment_nodes: string[];
  
  // Node types that represent variable declarations
  declaration_nodes: string[];
  
  // Node types that represent function/method calls
  call_nodes: string[];
  
  // Node types that represent property/member access
  member_access_nodes: string[];
  
  // Node types that represent type annotations or assertions
  type_annotation_nodes: string[];
  
  // Node types that represent control flow narrowing
  narrowing_nodes: string[];
  
  // Node types that represent literals
  literal_nodes: string[];
  
  // Node types for conditional expressions
  conditional_nodes: string[];
  
  // Node types for logical expressions
  logical_nodes: string[];
  
  // Node types for array/list expressions
  array_nodes: string[];
  
  // Node types for object/dict expressions
  object_nodes: string[];
  
  // Field names in AST nodes
  fields: {
    left: string;         // Left side of assignment
    right: string;        // Right side of assignment
    name: string;         // Variable/identifier name
    value: string;        // Value in declarations
    init: string;         // Initializer
    function: string;     // Function in call expressions
    callee: string;       // Alternative to function
    object: string;       // Object in member access
    property: string;     // Property in member access
    type: string;         // Type annotation
    expression: string;   // Expression being typed
    condition: string;    // Condition in control flow
    consequent: string;   // Then branch
    alternate: string;    // Else branch
    argument: string;     // Argument in calls
    arguments: string;    // Arguments list
    operator: string;     // Operator in expressions
  };
  
  // Type conversion functions/methods
  type_converters: {
    [functionName: string]: string; // Maps function name to result type
  };
  
  // Built-in type constructors
  type_constructors: {
    [constructorName: string]: string; // Maps constructor to type
  };
  
  // Type narrowing operators
  narrowing_operators: {
    typeof?: string[];    // typeof operators
    instanceof?: string[];// instanceof operators
    in?: string[];       // in operators
    is?: string[];       // type predicate operators
  };
  
  // Control flow patterns
  control_flow: {
    if_statement: string;
    while_statement: string;
    for_statement: string;
    switch_statement: string;
    try_statement: string;
    match_expression?: string; // Rust
    if_expression?: string;    // Rust/Python
  };
}

// JavaScript configuration
const javascript_config: TypePropagationConfig = {
  assignment_nodes: ['assignment_expression', 'augmented_assignment_expression'],
  declaration_nodes: ['variable_declarator', 'lexical_declaration', 'variable_declaration'],
  call_nodes: ['call_expression', 'new_expression'],
  member_access_nodes: ['member_expression', 'subscript_expression', 'optional_chain'],
  type_annotation_nodes: [], // JavaScript has no type annotations
  narrowing_nodes: ['if_statement', 'conditional_expression', 'ternary_expression'],
  literal_nodes: ['number', 'string', 'template_string', 'true', 'false', 'null', 'undefined'],
  conditional_nodes: ['conditional_expression', 'ternary_expression'],
  logical_nodes: ['logical_expression', 'binary_expression'],
  array_nodes: ['array_expression', 'array'],
  object_nodes: ['object_expression', 'object'],
  
  fields: {
    left: 'left',
    right: 'right',
    name: 'name',
    value: 'value',
    init: 'init',
    function: 'function',
    callee: 'callee',
    object: 'object',
    property: 'property',
    type: 'type',
    expression: 'expression',
    condition: 'condition',
    consequent: 'consequent',
    alternate: 'alternate',
    argument: 'argument',
    arguments: 'arguments',
    operator: 'operator'
  },
  
  type_converters: {
    'String': 'string',
    'Number': 'number',
    'Boolean': 'boolean',
    'Array': 'Array',
    'Object': 'Object',
    'parseInt': 'number',
    'parseFloat': 'number',
    'toString': 'string',
    'BigInt': 'bigint'
  },
  
  type_constructors: {
    'String': 'string',
    'Number': 'number',
    'Boolean': 'boolean',
    'Array': 'Array',
    'Object': 'Object',
    'Map': 'Map',
    'Set': 'Set',
    'Promise': 'Promise',
    'Date': 'Date',
    'RegExp': 'RegExp',
    'WeakMap': 'WeakMap',
    'WeakSet': 'WeakSet'
  },
  
  narrowing_operators: {
    typeof: ['typeof'],
    instanceof: ['instanceof'],
    in: ['in']
  },
  
  control_flow: {
    if_statement: 'if_statement',
    while_statement: 'while_statement',
    for_statement: 'for_statement',
    switch_statement: 'switch_statement',
    try_statement: 'try_statement'
  }
};

// TypeScript configuration (extends JavaScript)
const typescript_config: TypePropagationConfig = {
  ...javascript_config,
  type_annotation_nodes: [
    'type_annotation',
    'type_assertion',
    'as_expression',
    'satisfies_expression',
    'type_predicate',
    'type_arguments'
  ],
  narrowing_nodes: [
    ...javascript_config.narrowing_nodes,
    'type_predicate',
    'type_assertion'
  ],
  
  narrowing_operators: {
    ...javascript_config.narrowing_operators,
    is: ['is']
  }
};

// Python configuration
const python_config: TypePropagationConfig = {
  assignment_nodes: ['assignment', 'augmented_assignment'],
  declaration_nodes: ['assignment', 'annotated_assignment', 'typed_parameter', 'typed_default_parameter'],
  call_nodes: ['call', 'decorator'],
  member_access_nodes: ['attribute', 'subscript'],
  type_annotation_nodes: ['type', 'type_alias_statement', 'generic_type'],
  narrowing_nodes: ['if_statement', 'conditional_expression', 'match_statement'],
  literal_nodes: ['integer', 'float', 'string', 'true', 'false', 'none'],
  conditional_nodes: ['conditional_expression', 'if_expression'],
  logical_nodes: ['boolean_operator', 'comparison_operator', 'not_operator'],
  array_nodes: ['list', 'list_comprehension'],
  object_nodes: ['dictionary', 'dictionary_comprehension', 'set', 'set_comprehension'],
  
  fields: {
    left: 'left',
    right: 'right',
    name: 'name',
    value: 'value',
    init: 'value',
    function: 'function',
    callee: 'function',
    object: 'object',
    property: 'attribute',
    type: 'type',
    expression: 'value',
    condition: 'condition',
    consequent: 'consequence',
    alternate: 'alternative',
    argument: 'argument',
    arguments: 'arguments',
    operator: 'operator'
  },
  
  type_converters: {
    'str': 'str',
    'int': 'int',
    'float': 'float',
    'bool': 'bool',
    'list': 'list',
    'dict': 'dict',
    'set': 'set',
    'tuple': 'tuple',
    'bytes': 'bytes'
  },
  
  type_constructors: {
    'str': 'str',
    'int': 'int',
    'float': 'float',
    'bool': 'bool',
    'list': 'list',
    'dict': 'dict',
    'set': 'set',
    'tuple': 'tuple',
    'bytes': 'bytes',
    'bytearray': 'bytearray',
    'frozenset': 'frozenset'
  },
  
  narrowing_operators: {
    instanceof: ['isinstance'],
    in: ['in', 'not in']
  },
  
  control_flow: {
    if_statement: 'if_statement',
    while_statement: 'while_statement',
    for_statement: 'for_statement',
    switch_statement: 'match_statement',
    try_statement: 'try_statement',
    if_expression: 'conditional_expression'
  }
};

// Rust configuration
const rust_config: TypePropagationConfig = {
  assignment_nodes: ['assignment_expression', 'compound_assignment_expr'],
  declaration_nodes: ['let_declaration', 'const_item', 'static_item'],
  call_nodes: ['call_expression', 'macro_invocation'],
  member_access_nodes: ['field_expression', 'index_expression'],
  type_annotation_nodes: ['type_identifier', 'generic_type', 'reference_type', 'pointer_type'],
  narrowing_nodes: ['if_expression', 'match_expression', 'if_let_expression'],
  literal_nodes: ['integer_literal', 'float_literal', 'string_literal', 'char_literal', 'boolean_literal'],
  conditional_nodes: ['if_expression', 'match_expression'],
  logical_nodes: ['binary_expression', 'unary_expression'],
  array_nodes: ['array_expression'],
  object_nodes: ['struct_expression', 'tuple_expression'],
  
  fields: {
    left: 'left',
    right: 'right',
    name: 'pattern',
    value: 'value',
    init: 'value',
    function: 'function',
    callee: 'function',
    object: 'value',
    property: 'field',
    type: 'type',
    expression: 'value',
    condition: 'condition',
    consequent: 'consequence',
    alternate: 'alternative',
    argument: 'argument',
    arguments: 'arguments',
    operator: 'operator'
  },
  
  type_converters: {
    'as_str': '&str',
    'to_string': 'String',
    'to_owned': 'String',
    'parse': 'Result',
    'into': 'T',
    'from': 'T',
    'clone': 'T',
    'unwrap': 'T',
    'expect': 'T'
  },
  
  type_constructors: {
    'Vec': 'Vec',
    'HashMap': 'HashMap',
    'HashSet': 'HashSet',
    'Option': 'Option',
    'Result': 'Result',
    'Box': 'Box',
    'Rc': 'Rc',
    'Arc': 'Arc',
    'String::new': 'String',
    'String::from': 'String',
    'Vec::new': 'Vec<T>',
    'Vec::from': 'Vec<T>',
    'HashMap::new': 'HashMap<K, V>',
    'HashSet::new': 'HashSet<T>',
    'Box::new': 'Box<T>',
    'Rc::new': 'Rc<T>',
    'Arc::new': 'Arc<T>',
    'Some': 'Option<T>',
    'None': 'Option<T>',
    'Ok': 'Result<T, E>',
    'Err': 'Result<T, E>'
  },
  
  narrowing_operators: {},
  
  control_flow: {
    if_statement: 'if_expression',
    while_statement: 'while_expression',
    for_statement: 'for_expression',
    switch_statement: 'match_expression',
    try_statement: 'try_expression',
    match_expression: 'match_expression',
    if_expression: 'if_expression'
  }
};

// Configuration map
const configs: Record<Language | 'jsx' | 'tsx', TypePropagationConfig> = {
  javascript: javascript_config,
  jsx: javascript_config,
  typescript: typescript_config,
  tsx: typescript_config,
  python: python_config,
  rust: rust_config
};

/**
 * Get type propagation configuration for a language
 */
export function get_type_propagation_config(language: Language | 'jsx' | 'tsx'): TypePropagationConfig {
  const config = configs[language];
  if (!config) {
    throw new Error(`No type propagation configuration for language: ${language}`);
  }
  return config;
}

/**
 * Check if a node type represents an assignment
 */
export function is_assignment_node(nodeType: string, language: Language | 'jsx' | 'tsx'): boolean {
  const config = get_type_propagation_config(language);
  return config.assignment_nodes.includes(nodeType);
}

/**
 * Check if a node type represents a declaration
 */
export function is_declaration_node(nodeType: string, language: Language | 'jsx' | 'tsx'): boolean {
  const config = get_type_propagation_config(language);
  return config.declaration_nodes.includes(nodeType);
}

/**
 * Check if a node type represents a call
 */
export function is_call_node(nodeType: string, language: Language | 'jsx' | 'tsx'): boolean {
  const config = get_type_propagation_config(language);
  return config.call_nodes.includes(nodeType);
}

/**
 * Check if a node type represents member access
 */
export function is_member_access_node(nodeType: string, language: Language | 'jsx' | 'tsx'): boolean {
  const config = get_type_propagation_config(language);
  return config.member_access_nodes.includes(nodeType);
}

/**
 * Check if a node type represents a type annotation
 */
export function is_type_annotation_node(nodeType: string, language: Language | 'jsx' | 'tsx'): boolean {
  const config = get_type_propagation_config(language);
  return config.type_annotation_nodes.includes(nodeType);
}

/**
 * Check if a node type represents type narrowing
 */
export function is_narrowing_node(nodeType: string, language: Language | 'jsx' | 'tsx'): boolean {
  const config = get_type_propagation_config(language);
  return config.narrowing_nodes.includes(nodeType);
}

/**
 * Get the field name for a specific purpose
 */
export function get_field_name(purpose: keyof TypePropagationConfig['fields'] | string, language: Language | 'jsx' | 'tsx'): string | undefined {
  const config = get_type_propagation_config(language);
  
  // Handle direct field lookup
  if (purpose in config.fields) {
    return config.fields[purpose as keyof TypePropagationConfig['fields']];
  }
  
  // Handle special cases
  if (language === 'python' && purpose === 'target') {
    return 'left'; // Python uses 'left' for assignment targets
  }
  
  if (language === 'rust' && purpose === 'pattern') {
    return 'pattern'; // Rust uses 'pattern' for let declarations
  }
  
  // Return the purpose itself if it's a standard field name
  if (['left', 'right', 'name', 'value', 'init', 'pattern'].includes(purpose)) {
    return purpose;
  }
  
  return undefined;
}

/**
 * Get the result type of a type converter function
 */
export function get_converter_result_type(functionName: string, language: Language | 'jsx' | 'tsx'): string | undefined {
  const config = get_type_propagation_config(language);
  return config.type_converters[functionName];
}

/**
 * Get the type for a constructor
 */
export function get_constructor_type(constructorName: string, language: Language | 'jsx' | 'tsx'): string | undefined {
  const config = get_type_propagation_config(language);
  return config.type_constructors[constructorName];
}

/**
 * Get the result type of a type conversion function (alias for get_converter_result_type)
 */
export function get_type_conversion_function(functionName: string, language: Language | 'jsx' | 'tsx'): string | undefined {
  return get_converter_result_type(functionName, language);
}