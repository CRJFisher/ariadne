/**
 * Language-specific configurations for class detection
 * 
 * This module defines the configuration objects that capture
 * language-specific differences in class/struct syntax and structure.
 */

import { Language } from '@ariadnejs/types';

export interface ClassDetectionConfig {
  // Node types that represent class/struct definitions
  class_node_types: string[];
  
  // Field names for extracting class components
  fields: {
    name: string;
    superclass?: string;      // Single inheritance
    superclasses?: string;     // Multiple inheritance
    body: string;
    type_parameters?: string;  // Generics
    heritage?: string;         // TypeScript heritage clause
  };
  
  // Node types for class members
  member_types: {
    method: string[];
    property: string[];
    decorator?: string;
  };
  
  // Method-specific configuration
  method_config: {
    name_field: string;
    params_field: string;
    return_type_field?: string;
    modifiers: {
      static?: string[];
      async?: string[];
      abstract?: string[];
    };
  };
  
  // Property-specific configuration
  property_config: {
    name_field?: string;
    property_field?: string;  // Alternative name field
    type_field?: string;
    value_field?: string;
    modifiers: {
      static?: string[];
      readonly?: string[];
    };
  };
  
  // Parameter extraction
  parameter_types: {
    regular: string[];
    optional?: string[];
    rest?: string[];
    typed?: string[];
  };
  
  // Access modifiers
  access_modifiers: {
    private_prefix?: string;     // Python/JS use _/#
    private_keyword?: string[];
    protected_keyword?: string[];
    public_keyword?: string[];
  };
  
  // Language-specific patterns
  patterns: {
    constructor_name?: string;
    class_expression?: boolean;
    requires_impl_blocks?: boolean;  // Rust
    supports_decorators?: boolean;
    supports_generics?: boolean;
    supports_multiple_inheritance?: boolean;
  };
}

const JAVASCRIPT_CONFIG: ClassDetectionConfig = {
  class_node_types: ['class_declaration', 'class'],
  
  fields: {
    name: 'name',
    superclass: 'superclass',
    body: 'body'
  },
  
  member_types: {
    method: ['method_definition'],
    property: ['field_definition']
  },
  
  method_config: {
    name_field: 'name',
    params_field: 'parameters',
    modifiers: {
      static: ['static'],
      async: ['async']
    }
  },
  
  property_config: {
    property_field: 'property',
    value_field: 'value',
    modifiers: {
      static: ['static']
    }
  },
  
  parameter_types: {
    regular: ['identifier'],
    optional: ['assignment_pattern'],
    rest: ['rest_pattern']
  },
  
  access_modifiers: {
    private_prefix: '#'
  },
  
  patterns: {
    constructor_name: 'constructor',
    class_expression: true,
    supports_decorators: false,
    supports_generics: false,
    supports_multiple_inheritance: false
  }
};

const TYPESCRIPT_CONFIG: ClassDetectionConfig = {
  class_node_types: ['class_declaration', 'abstract_class_declaration', 'class'],
  
  fields: {
    name: 'name',
    superclass: 'superclass',
    body: 'body',
    type_parameters: 'type_parameters',
    heritage: 'heritage'
  },
  
  member_types: {
    method: ['method_definition', 'abstract_method_signature'],
    property: ['public_field_definition', 'field_definition', 'property_signature'],
    decorator: 'decorator'
  },
  
  method_config: {
    name_field: 'name',
    params_field: 'parameters',
    return_type_field: 'return_type',
    modifiers: {
      static: ['static'],
      async: ['async'],
      abstract: ['abstract']
    }
  },
  
  property_config: {
    name_field: 'name',
    property_field: 'property',
    type_field: 'type',
    value_field: 'value',
    modifiers: {
      static: ['static'],
      readonly: ['readonly']
    }
  },
  
  parameter_types: {
    regular: ['identifier'],
    optional: ['optional_parameter'],
    rest: ['rest_parameter'],
    typed: ['required_parameter', 'optional_parameter']
  },
  
  access_modifiers: {
    private_prefix: '#',
    private_keyword: ['private'],
    protected_keyword: ['protected'],
    public_keyword: ['public']
  },
  
  patterns: {
    constructor_name: 'constructor',
    class_expression: true,
    supports_decorators: true,
    supports_generics: true,
    supports_multiple_inheritance: false
  }
};

const PYTHON_CONFIG: ClassDetectionConfig = {
  class_node_types: ['class_definition'],
  
  fields: {
    name: 'name',
    superclasses: 'superclasses',
    body: 'body'
  },
  
  member_types: {
    method: ['function_definition'],
    property: ['expression_statement'],
    decorator: 'decorator'
  },
  
  method_config: {
    name_field: 'name',
    params_field: 'parameters',
    return_type_field: 'return_type',
    modifiers: {
      async: ['async']
    }
  },
  
  property_config: {
    value_field: 'value',
    modifiers: {}
  },
  
  parameter_types: {
    regular: ['identifier'],
    optional: ['default_parameter'],
    rest: ['list_splat_pattern', 'dictionary_splat_pattern'],
    typed: ['typed_parameter', 'typed_default_parameter']
  },
  
  access_modifiers: {
    private_prefix: '_'
  },
  
  patterns: {
    constructor_name: '__init__',
    supports_decorators: true,
    supports_generics: false,
    supports_multiple_inheritance: true
  }
};

const RUST_CONFIG: ClassDetectionConfig = {
  class_node_types: ['struct_item', 'impl_item'],
  
  fields: {
    name: 'name',
    body: 'body',
    type_parameters: 'type_parameters'
  },
  
  member_types: {
    method: ['function_item'],
    property: ['field_declaration']
  },
  
  method_config: {
    name_field: 'name',
    params_field: 'parameters',
    return_type_field: 'return_type',
    modifiers: {
      async: ['async']
    }
  },
  
  property_config: {
    name_field: 'name',
    type_field: 'type',
    modifiers: {}
  },
  
  parameter_types: {
    regular: ['parameter', 'self_parameter']
  },
  
  access_modifiers: {
    public_keyword: ['pub']
  },
  
  patterns: {
    constructor_name: 'new',
    requires_impl_blocks: true,
    supports_decorators: false,
    supports_generics: true,
    supports_multiple_inheritance: false
  }
};

// Configuration map
const LANGUAGE_CONFIGS: Record<Language, ClassDetectionConfig> = {
  javascript: JAVASCRIPT_CONFIG,
  typescript: TYPESCRIPT_CONFIG,
  python: PYTHON_CONFIG,
  rust: RUST_CONFIG
};

/**
 * Get language-specific configuration
 */
export function get_language_config(language: Language): ClassDetectionConfig {
  const config = LANGUAGE_CONFIGS[language];
  if (!config) {
    throw new Error(`No class detection configuration for language: ${language}`);
  }
  return config;
}

export { LANGUAGE_CONFIGS };