/**
 * Definition Builder System
 *
 * Directly creates Definition objects from tree-sitter captures
 * without intermediate representations. Uses builder states for
 * complex types and functional composition pattern.
 */

import type {
  AnyDefinition,
  ClassDefinition,
  ConstructorDefinition,
  DecoratorDefinition,
  EnumDefinition,
  EnumMember,
  FilePath,
  FunctionDefinition,
  FunctionSignature,
  ImportDefinition,
  InterfaceDefinition,
  Location,
  MethodDefinition,
  NamespaceDefinition,
  ParameterDefinition,
  PropertyDefinition,
  PropertySignature,
  ScopeId,
  SymbolAvailability,
  SymbolId,
  SymbolName,
  TypeDefinition,
  VariableDefinition,
  ModulePath,
} from "@ariadnejs/types";

import {
  class_symbol,
  function_symbol,
  interface_symbol,
  method_symbol,
  parameter_symbol,
  property_symbol,
  type_symbol,
  variable_symbol,
} from "@ariadnejs/types";

import type { ProcessingContext, RawCapture } from "../parse_and_query_code/scope_processor";
import { SemanticCategory, SemanticEntity } from "../parse_and_query_code/scope_processor";

// ============================================================================
// Builder State Types
// ============================================================================

/**
 * Builder state for accumulating class data
 */
interface ClassBuilderState {
  base: Partial<Omit<ClassDefinition, 'constructor' | 'methods' | 'properties' | 'decorators'>>;
  methods: Map<SymbolId, MethodBuilderState>;
  properties: Map<SymbolId, PropertyBuilderState>;
  constructor?: ConstructorBuilderState;
  decorators: SymbolId[];
}

/**
 * Builder state for accumulating method data
 */
interface MethodBuilderState {
  base: Partial<Omit<MethodDefinition, 'parameters' | 'decorators'>>;
  parameters: Map<SymbolId, ParameterDefinition>;
  decorators: SymbolName[];
}

/**
 * Builder state for accumulating constructor data
 */
interface ConstructorBuilderState {
  base: Partial<Omit<ConstructorDefinition, 'parameters' | 'decorators'>>;
  parameters: Map<SymbolId, ParameterDefinition>;
  decorators: SymbolName[];
}

/**
 * Builder state for accumulating property data
 */
interface PropertyBuilderState {
  base: Partial<Omit<PropertyDefinition, 'decorators'>>;
  decorators: SymbolId[];
}

/**
 * Builder state for accumulating function data
 */
interface FunctionBuilderState {
  base: Partial<Omit<FunctionDefinition, 'signature' | 'decorators'>>;
  signature: FunctionSignatureState;
  decorators: SymbolName[];
}

/**
 * Builder state for function signatures
 */
interface FunctionSignatureState {
  parameters: Map<SymbolId, ParameterDefinition>;
  return_type?: SymbolName;
}

/**
 * Builder state for accumulating interface data
 */
interface InterfaceBuilderState {
  base: Partial<Omit<InterfaceDefinition, 'methods' | 'properties'>>;
  methods: Map<SymbolId, MethodBuilderState>;
  properties: Map<SymbolId, PropertySignature>;
}

/**
 * Builder state for accumulating enum data
 */
interface EnumBuilderState {
  base: Partial<Omit<EnumDefinition, 'members' | 'methods'>>;
  members: Map<SymbolId, EnumMember>;
  methods?: Map<SymbolId, MethodBuilderState>;
}

/**
 * Builder state for accumulating namespace data
 */
interface NamespaceBuilderState {
  base: Partial<Omit<NamespaceDefinition, 'exported_symbols'>>;
  exported_symbols: Set<SymbolId>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a SymbolId for an enum
 */
function enum_symbol(name: string, location: Location): SymbolId {
  return `enum:${location.file_path}:${location.line}:${location.column}:${location.end_line}:${location.end_column}:${name}` as SymbolId;
}

/**
 * Create a SymbolId for a namespace
 */
function namespace_symbol(name: string, location: Location): SymbolId {
  return `namespace:${location.file_path}:${location.line}:${location.column}:${location.end_line}:${location.end_column}:${name}` as SymbolId;
}

/**
 * Create a SymbolId for a decorator
 */
function decorator_symbol(name: string, location: Location): SymbolId {
  return `decorator:${location.file_path}:${location.line}:${location.column}:${location.end_line}:${location.end_column}:${name}` as SymbolId;
}

/**
 * Create a SymbolId for an import
 */
function import_symbol(name: string, location: Location): SymbolId {
  return `import:${location.file_path}:${location.line}:${location.column}:${location.end_line}:${location.end_column}:${name}` as SymbolId;
}

/**
 * Create a SymbolId for a constructor
 */
function constructor_symbol(class_name: string, location: Location): SymbolId {
  return `constructor:${location.file_path}:${location.line}:${location.column}:${location.end_line}:${location.end_column}:${class_name}` as SymbolId;
}

/**
 * Determine symbol availability based on capture name
 */
function determine_availability(capture: RawCapture): SymbolAvailability {
  // Parse capture name for modifiers
  const parts = capture.name.split('.');

  // Check for export modifiers in capture name
  if (parts.includes('exported') || parts.includes('export')) {
    return {
      scope: "file-export",
      export: {
        name: extract_symbol_name(capture),
        is_default: parts.includes('default'),
        is_reexport: parts.includes('reexport'),
      }
    };
  }

  // Check for visibility modifiers (Rust)
  if (parts.includes('pub') || parts.includes('public')) {
    return { scope: "public" };
  }

  // Default to file-private
  return { scope: "file-private" };
}

/**
 * Extract location from tree-sitter node
 */
function extract_location(node: any, file_path?: string): Location {
  return {
    file_path: (file_path || "") as FilePath,
    line: node.startPosition.row + 1,
    column: node.startPosition.column,
    end_line: node.endPosition.row + 1,
    end_column: node.endPosition.column,
  };
}

/**
 * Extract symbol name from capture
 */
function extract_symbol_name(capture: RawCapture): SymbolName {
  // Use capture text as symbol name
  return (capture.text || "") as SymbolName;
}

/**
 * Extract type annotation from capture
 * Simplified for now - would need to parse node structure
 */
function extract_type(capture: RawCapture): SymbolName | undefined {
  // Type information would need to be extracted from the node structure
  // For now, return undefined to maintain compatibility
  return undefined;
}

/**
 * Extract extends/implements for classes and interfaces
 */
function extract_extends(capture: RawCapture): SymbolName[] {
  // This would need to parse the node structure to find extends/implements
  // For now, return empty array to maintain compatibility
  return [];
}

// ============================================================================
// Definition Builder
// ============================================================================

export class DefinitionBuilder {
  // Complex definition builders
  private readonly classes = new Map<SymbolId, ClassBuilderState>();
  private readonly functions = new Map<SymbolId, FunctionBuilderState>();
  private readonly interfaces = new Map<SymbolId, InterfaceBuilderState>();
  private readonly enums = new Map<SymbolId, EnumBuilderState>();
  private readonly namespaces = new Map<SymbolId, NamespaceBuilderState>();

  // Simple definitions
  private readonly variables = new Map<SymbolId, VariableDefinition>();
  private readonly imports = new Map<SymbolId, ImportDefinition>();
  private readonly types = new Map<SymbolId, TypeDefinition>();
  private readonly decorators = new Map<SymbolId, DecoratorDefinition>();

  constructor(private readonly context: ProcessingContext) {}

  /**
   * Process a capture and update builder state
   * Returns this for functional chaining
   */
  process(capture: RawCapture): DefinitionBuilder {
    // Parse capture name (e.g., "definition.class", "decorator.function")
    const parts = capture.name.split('.');
    const category = parts[0];
    const entity = parts[1];

    // Handle decorators by category
    if (category === 'decorator') {
      return this.add_decorator(capture);
    }

    // Only process definition captures
    if (category !== 'definition') {
      return this;
    }

    // Route to appropriate handler based on entity type
    switch (entity) {
      case 'class':
        return this.add_class_from_capture(capture);
      case 'function':
        return this.add_function_from_capture(capture);
      case 'method':
        return this.add_method(capture);
      case 'constructor':
        return this.add_constructor(capture);
      case 'property':
      case 'field':
        return this.add_property(capture);
      case 'parameter':
        return this.add_parameter(capture);
      case 'interface':
        return this.add_interface(capture);
      case 'enum':
        return this.add_enum(capture);
      case 'enum_member':
        return this.add_enum_member(capture);
      case 'namespace':
        return this.add_namespace(capture);
      case 'variable':
      case 'constant':
        return this.add_variable_from_capture(capture);
      case 'import':
        return this.add_import_from_capture(capture);
      case 'type':
      case 'type_alias':
        return this.add_type(capture);
      default:
        return this;
    }
  }

  /**
   * Build final definitions with non-null guarantees
   */
  build(): AnyDefinition[] {
    const definitions: AnyDefinition[] = [];

    // Build complex types
    this.classes.forEach(state => definitions.push(this.build_class(state)));
    this.functions.forEach(state => definitions.push(this.build_function(state)));
    this.interfaces.forEach(state => definitions.push(this.build_interface(state)));
    this.enums.forEach(state => definitions.push(this.build_enum(state)));
    this.namespaces.forEach(state => definitions.push(this.build_namespace(state)));

    // Add simple definitions
    this.variables.forEach(def => definitions.push(def));
    this.imports.forEach(def => definitions.push(def));
    this.types.forEach(def => definitions.push(def));
    this.decorators.forEach(def => definitions.push(def));

    return definitions;
  }

  // ============================================================================
  // Public API for Language Configs
  // ============================================================================

  /**
   * Add a class definition
   */
  add_class(definition: {
    symbol_id: SymbolId;
    name: SymbolName;
    location: Location;
    scope_id: ScopeId;
    availability: SymbolAvailability;
    extends?: SymbolName[];
  }): DefinitionBuilder {
    this.classes.set(definition.symbol_id, {
      base: {
        kind: "class",
        ...definition,
        extends: definition.extends || [],
      },
      methods: new Map(),
      properties: new Map(),
      constructor: undefined,
      decorators: [],
    });
    return this;
  }

  /**
   * Add a method to a class
   */
  add_method_to_class(class_id: SymbolId, definition: {
    symbol_id: SymbolId;
    name: SymbolName;
    location: Location;
    scope_id: ScopeId;
    availability: SymbolAvailability;
    return_type?: SymbolName;
  }): DefinitionBuilder {
    const class_state = this.classes.get(class_id);
    if (!class_state) return this;

    class_state.methods.set(definition.symbol_id, {
      base: {
        kind: "method",
        ...definition,
      },
      parameters: new Map(),
      decorators: [],
    });
    return this;
  }

  /**
   * Add a function definition
   */
  add_function(definition: {
    symbol_id: SymbolId;
    name: SymbolName;
    location: Location;
    scope_id: ScopeId;
    availability: SymbolAvailability;
  }): DefinitionBuilder {
    this.functions.set(definition.symbol_id, {
      base: {
        kind: "function",
        ...definition,
      },
      signature: {
        parameters: new Map(),
        return_type: undefined,
      },
      decorators: [],
    });
    return this;
  }

  /**
   * Add a parameter to a callable (function/method)
   */
  add_parameter_to_callable(callable_id: SymbolId, definition: {
    symbol_id: SymbolId;
    name: SymbolName;
    location: Location;
    scope_id: ScopeId;
    type?: SymbolName;
    default_value?: string;
  }): DefinitionBuilder {
    const param_def: ParameterDefinition = {
      kind: "parameter",
      ...definition,
      availability: { scope: "file-private" },
    };

    // Check functions
    const func_state = this.functions.get(callable_id);
    if (func_state) {
      func_state.signature.parameters.set(definition.symbol_id, param_def);
      return this;
    }

    // Check methods in classes
    for (const class_state of this.classes.values()) {
      const method_state = class_state.methods.get(callable_id);
      if (method_state) {
        method_state.parameters.set(definition.symbol_id, param_def);
        return this;
      }
    }

    return this;
  }

  /**
   * Add a variable definition
   */
  add_variable(definition: {
    kind: 'variable' | 'constant';
    symbol_id: SymbolId;
    name: SymbolName;
    location: Location;
    scope_id: ScopeId;
    availability: SymbolAvailability;
    type?: SymbolName;
    initial_value?: string;
  }): DefinitionBuilder {
    this.variables.set(definition.symbol_id, {
      ...definition,
    });
    return this;
  }

  /**
   * Add an import definition
   */
  add_import(definition: {
    symbol_id: SymbolId;
    name: SymbolName;
    location: Location;
    scope_id: ScopeId;
    availability: SymbolAvailability;
    import_path: ModulePath;
    original_name?: SymbolName;
    is_default?: boolean;
    is_namespace?: boolean;
  }): DefinitionBuilder {
    this.imports.set(definition.symbol_id, {
      kind: "import",
      ...definition,
      is_default: definition.is_default || false,
      is_namespace: definition.is_namespace || false,
    });
    return this;
  }

  /**
   * Add a property to a class
   */
  add_property_to_class(class_id: SymbolId, definition: {
    symbol_id: SymbolId;
    name: SymbolName;
    location: Location;
    scope_id: ScopeId;
    availability: SymbolAvailability;
    type?: SymbolName;
    initial_value?: string;
  }): DefinitionBuilder {
    const class_state = this.classes.get(class_id);
    if (!class_state) return this;

    class_state.properties.set(definition.symbol_id, {
      base: {
        kind: "property",
        ...definition,
      },
      decorators: [],
    });
    return this;
  }

  // ============================================================================
  // Complex Type Handlers (private, used by process() method)
  // ============================================================================

  private add_class_from_capture(capture: RawCapture): DefinitionBuilder {
    const symbol_name = extract_symbol_name(capture);
    const location = extract_location(capture.node);
    const class_id = class_symbol(symbol_name, location);
    const scope_id = this.context.get_scope_id(location);

    this.classes.set(class_id, {
      base: {
        kind: "class",
        symbol_id: class_id,
        name: symbol_name,
        location: location,
        scope_id: scope_id,
        availability: determine_availability(capture),
        extends: extract_extends(capture),
      },
      methods: new Map(),
      properties: new Map(),
      constructor: undefined,
      decorators: [],
    });

    return this;
  }

  private add_function_from_capture(capture: RawCapture): DefinitionBuilder {
    const symbol_name = extract_symbol_name(capture);
    const location = extract_location(capture.node);
    const func_id = function_symbol(symbol_name, location);
    const scope_id = this.context.get_scope_id(location);

    this.functions.set(func_id, {
      base: {
        kind: "function",
        symbol_id: func_id,
        name: symbol_name,
        location: location,
        scope_id: scope_id,
        availability: determine_availability(capture),
      },
      signature: {
        parameters: new Map(),
        return_type: extract_type(capture),
      },
      decorators: [],
    });

    return this;
  }

  private add_interface(capture: RawCapture): DefinitionBuilder {
    const interface_id = interface_symbol(extract_symbol_name(capture), extract_location(capture.node));
    const scope_id = this.context.get_scope_id(extract_location(capture.node));

    this.interfaces.set(interface_id, {
      base: {
        kind: "interface",
        symbol_id: interface_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: scope_id,
        availability: determine_availability(capture),
        extends: extract_extends(capture),
      },
      methods: new Map(),
      properties: new Map(),
    });

    return this;
  }

  private add_enum(capture: RawCapture): DefinitionBuilder {
    const enum_id = enum_symbol(extract_symbol_name(capture), extract_location(capture.node));
    const scope_id = this.context.get_scope_id(extract_location(capture.node));

    this.enums.set(enum_id, {
      base: {
        kind: "enum",
        symbol_id: enum_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: scope_id,
        availability: determine_availability(capture),
        is_const: false, // Would need to be extracted from capture name or node
      },
      members: new Map(),
      methods: undefined,
    });

    return this;
  }

  private add_namespace(capture: RawCapture): DefinitionBuilder {
    const namespace_id = namespace_symbol(extract_symbol_name(capture), extract_location(capture.node));
    const scope_id = this.context.get_scope_id(extract_location(capture.node));

    this.namespaces.set(namespace_id, {
      base: {
        kind: "namespace",
        symbol_id: namespace_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: scope_id,
        availability: determine_availability(capture),
      },
      exported_symbols: new Set(),
    });

    return this;
  }

  // ============================================================================
  // Nested Structure Handlers
  // ============================================================================

  private add_method(capture: RawCapture): DefinitionBuilder {
    // Find containing class or interface
    const containing_class = this.find_containing_class(extract_location(capture.node));
    const containing_interface = this.find_containing_interface(extract_location(capture.node));

    const method_id = method_symbol(extract_symbol_name(capture), extract_location(capture.node));
    const scope_id = this.context.get_scope_id(extract_location(capture.node));

    const method_state: MethodBuilderState = {
      base: {
        kind: "method",
        symbol_id: method_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: scope_id,
        availability: determine_availability(capture),
        return_type: extract_type(capture),
      },
      parameters: new Map(),
      decorators: [],
    };

    if (containing_class) {
      containing_class.methods.set(method_id, method_state);
    } else if (containing_interface) {
      containing_interface.methods.set(method_id, method_state);
    }

    return this;
  }

  private add_constructor(capture: RawCapture): DefinitionBuilder {
    const containing_class = this.find_containing_class(extract_location(capture.node));
    if (!containing_class) return this;

    const constructor_id = constructor_symbol(
      containing_class.base.name || "constructor",
      extract_location(capture.node)
    );
    const scope_id = this.context.get_scope_id(extract_location(capture.node));

    containing_class.constructor = {
      base: {
        kind: "constructor",
        symbol_id: constructor_id,
        name: "constructor" as SymbolName,
        location: extract_location(capture.node),
        scope_id: scope_id,
        availability: determine_availability(capture),
      },
      parameters: new Map(),
      decorators: [],
    };

    return this;
  }

  private add_property(capture: RawCapture): DefinitionBuilder {
    const containing_class = this.find_containing_class(extract_location(capture.node));
    const containing_interface = this.find_containing_interface(extract_location(capture.node));

    const prop_id = property_symbol(extract_symbol_name(capture), extract_location(capture.node));
    const scope_id = this.context.get_scope_id(extract_location(capture.node));

    if (containing_class) {
      containing_class.properties.set(prop_id, {
        base: {
          kind: "property",
          symbol_id: prop_id,
          name: extract_symbol_name(capture),
          location: extract_location(capture.node),
          scope_id: scope_id,
          availability: determine_availability(capture),
          type: extract_type(capture),
        },
        decorators: [],
      });
    } else if (containing_interface) {
      // Interface properties are simpler (PropertySignature)
      containing_interface.properties.set(prop_id, {
        kind: "property",
        name: prop_id,
        type: extract_type(capture),
        location: extract_location(capture.node),
      });
    }

    return this;
  }

  private add_parameter(capture: RawCapture): DefinitionBuilder {
    const param_id = parameter_symbol(extract_symbol_name(capture), extract_location(capture.node));
    const scope_id = this.context.get_scope_id(extract_location(capture.node));

    const param_def: ParameterDefinition = {
      kind: "parameter",
      symbol_id: param_id,
      name: extract_symbol_name(capture),
      location: extract_location(capture.node),
      scope_id: scope_id,
      availability: { scope: "file-private" },
      type: extract_type(capture),
      default_value: undefined // Would need to be extracted from node,
    };

    // Find containing callable (function, method, or constructor)
    const location = extract_location(capture.node);

    // Check methods in classes
    for (const class_state of this.classes.values()) {
      for (const method_state of class_state.methods.values()) {
        if (this.is_location_within(location, method_state.base.location!)) {
          method_state.parameters.set(param_id, param_def);
          return this;
        }
      }

      // Check constructor
      if (class_state.constructor &&
          this.is_location_within(location, class_state.constructor.base.location!)) {
        class_state.constructor.parameters.set(param_id, param_def);
        return this;
      }
    }

    // Check functions
    for (const func_state of this.functions.values()) {
      if (this.is_location_within(location, func_state.base.location!)) {
        func_state.signature.parameters.set(param_id, param_def);
        return this;
      }
    }

    // Check methods in interfaces
    for (const interface_state of this.interfaces.values()) {
      for (const method_state of interface_state.methods.values()) {
        if (this.is_location_within(location, method_state.base.location!)) {
          method_state.parameters.set(param_id, param_def);
          return this;
        }
      }
    }

    return this;
  }

  private add_enum_member(capture: RawCapture): DefinitionBuilder {
    const containing_enum = this.find_containing_enum(extract_location(capture.node));
    if (!containing_enum) return this;

    const member_id = `${containing_enum.base.symbol_id}:${extract_symbol_name(capture)}` as SymbolId;

    containing_enum.members.set(member_id, {
      name: member_id,
      value: undefined, // Would need to be extracted from node
      location: extract_location(capture.node),
    });

    return this;
  }

  // ============================================================================
  // Simple Definition Handlers
  // ============================================================================

  private add_variable_from_capture(capture: RawCapture): DefinitionBuilder {
    const var_id = variable_symbol(extract_symbol_name(capture), extract_location(capture.node));
    const scope_id = this.context.get_scope_id(extract_location(capture.node));

    const parts = capture.name.split('.');
    const entity = parts[1];
    const kind = entity === 'constant' ? "constant" : "variable";

    this.variables.set(var_id, {
      kind: kind,
      symbol_id: var_id,
      name: extract_symbol_name(capture),
      location: extract_location(capture.node),
      scope_id: scope_id,
      availability: determine_availability(capture),
      type: extract_type(capture),
      initial_value: undefined, // Would need to be extracted from node
    });

    return this;
  }

  private add_import_from_capture(capture: RawCapture): DefinitionBuilder {
    const import_id = variable_symbol(extract_symbol_name(capture), extract_location(capture.node));
    const scope_id = this.context.get_scope_id(extract_location(capture.node));

    this.imports.set(import_id, {
      kind: "import",
      symbol_id: import_id,
      name: extract_symbol_name(capture),
      location: extract_location(capture.node),
      scope_id: scope_id,
      availability: { scope: "file-private" },
      import_path: "" as ModulePath, // Would need to be extracted from node
      original_name: undefined, // Would need to be extracted from node
      is_default: false, // Would need to be extracted from capture name
      is_namespace: false, // Would need to be extracted from capture name
    });

    return this;
  }

  private add_type(capture: RawCapture): DefinitionBuilder {
    const type_id = type_symbol(extract_symbol_name(capture), extract_location(capture.node));
    const scope_id = this.context.get_scope_id(extract_location(capture.node));

    const parts = capture.name.split('.');
    const entity = parts[1];
    const kind = entity === 'type_alias' ? "type_alias" : "type";

    this.types.set(type_id, {
      kind: kind,
      symbol_id: type_id,
      name: extract_symbol_name(capture),
      location: extract_location(capture.node),
      scope_id: scope_id,
      availability: determine_availability(capture),
      type_expression: undefined, // Would need to be extracted from node
    });

    return this;
  }

  private add_decorator(capture: RawCapture): DefinitionBuilder {
    const decorator_id = decorator_symbol(extract_symbol_name(capture), extract_location(capture.node));
    const scope_id = this.context.get_scope_id(extract_location(capture.node));

    this.decorators.set(decorator_id, {
      kind: "decorator",
      symbol_id: decorator_id,
      name: extract_symbol_name(capture),
      location: extract_location(capture.node),
      scope_id: scope_id,
      availability: { scope: "file-private" },
    });

    return this;
  }

  // ============================================================================
  // Builder Methods
  // ============================================================================

  private build_class(state: ClassBuilderState): ClassDefinition {
    const methods = Array.from(state.methods.values()).map(m => this.build_method(m));
    const properties = Array.from(state.properties.values()).map(p => this.build_property(p));
    const constructor = state.constructor ? this.build_constructor(state.constructor) : undefined;

    return {
      kind: "class" as const,
      ...state.base,
      methods: methods,
      properties: properties,
      constructor: constructor,
      decorators: state.decorators,
      extends: state.base.extends || [],
    } as ClassDefinition;
  }

  private build_method(state: MethodBuilderState): MethodDefinition {
    const parameters = Array.from(state.parameters.values());

    return {
      kind: "method" as const,
      ...state.base,
      parameters: parameters,
      decorators: state.decorators.length > 0 ? state.decorators : undefined,
    } as MethodDefinition;
  }

  private build_constructor(state: ConstructorBuilderState): ConstructorDefinition {
    const parameters = Array.from(state.parameters.values());

    return {
      kind: "constructor" as const,
      ...state.base,
      parameters: parameters,
      decorators: state.decorators.length > 0 ? state.decorators : undefined,
    } as ConstructorDefinition;
  }

  private build_property(state: PropertyBuilderState): PropertyDefinition {
    return {
      kind: "property" as const,
      ...state.base,
      decorators: state.decorators,
    } as PropertyDefinition;
  }

  private build_function(state: FunctionBuilderState): FunctionDefinition {
    const parameters = Array.from(state.signature.parameters.values());

    return {
      kind: "function" as const,
      ...state.base,
      signature: {
        parameters: parameters,
        return_type: state.signature.return_type,
      },
      decorators: state.decorators.length > 0 ? state.decorators : undefined,
      return_type: state.signature.return_type,
    } as FunctionDefinition;
  }

  private build_interface(state: InterfaceBuilderState): InterfaceDefinition {
    const methods = Array.from(state.methods.values()).map(m => this.build_method(m));
    const properties = Array.from(state.properties.values());

    return {
      kind: "interface" as const,
      ...state.base,
      methods: methods,
      properties: properties,
      extends: state.base.extends || [],
    } as InterfaceDefinition;
  }

  private build_enum(state: EnumBuilderState): EnumDefinition {
    const members = Array.from(state.members.values());
    const methods = state.methods
      ? Array.from(state.methods.values()).map(m => this.build_method(m))
      : undefined;

    return {
      kind: "enum" as const,
      ...state.base,
      members: members,
      methods: methods,
      is_const: state.base.is_const || false,
    } as EnumDefinition;
  }

  private build_namespace(state: NamespaceBuilderState): NamespaceDefinition {
    const exported_symbols = state.exported_symbols.size > 0
      ? Array.from(state.exported_symbols)
      : undefined;

    return {
      kind: "namespace" as const,
      ...state.base,
      exported_symbols: exported_symbols,
    } as NamespaceDefinition;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private find_containing_class(location: Location): ClassBuilderState | undefined {
    for (const class_state of this.classes.values()) {
      if (this.is_location_within(location, class_state.base.location!)) {
        return class_state;
      }
    }
    return undefined;
  }

  private find_containing_interface(location: Location): InterfaceBuilderState | undefined {
    for (const interface_state of this.interfaces.values()) {
      if (this.is_location_within(location, interface_state.base.location!)) {
        return interface_state;
      }
    }
    return undefined;
  }

  private find_containing_enum(location: Location): EnumBuilderState | undefined {
    for (const enum_state of this.enums.values()) {
      if (this.is_location_within(location, enum_state.base.location!)) {
        return enum_state;
      }
    }
    return undefined;
  }

  private is_location_within(inner: Location, outer: Location): boolean {
    if (inner.file_path !== outer.file_path) return false;

    // Check if inner is within outer bounds
    if (inner.line < outer.line || inner.line > outer.end_line) return false;

    if (inner.line === outer.line && inner.column < outer.column) return false;
    if (inner.line === outer.end_line && inner.column > outer.end_column) return false;

    return true;
  }
}

// ============================================================================
// Pipeline Function
// ============================================================================

/**
 * Process captures into definitions using functional pipeline
 *
 * @param captures - Normalized captures from tree-sitter queries
 * @param context - Processing context with scope information
 * @returns Array of definition objects
 */
export function process_captures(
  captures: RawCapture[],
  context: ProcessingContext
): AnyDefinition[] {
  // Filter for definition and decorator captures and process using builder
  return captures
    .filter(capture => {
      const parts = capture.name.split('.');
      const category = parts[0];
      return category === 'definition' || category === 'decorator';
    })
    .reduce(
      (builder, capture) => builder.process(capture),
      new DefinitionBuilder(context)
    )
    .build();
}