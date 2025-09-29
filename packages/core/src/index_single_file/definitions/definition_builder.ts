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

import type { ProcessingContext } from "../parse_and_query_code/scope_processor";
import type { NormalizedCapture } from "../parse_and_query_code/capture_types";
import { SemanticCategory, SemanticEntity } from "../parse_and_query_code/capture_types";

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
 * Determine symbol availability based on capture modifiers
 */
function determine_availability(capture: NormalizedCapture): SymbolAvailability {
  const modifiers = capture.modifiers;

  // Check for export modifiers
  if (modifiers.is_exported || modifiers.is_default) {
    return {
      scope: "file-export",
      export: {
        name: capture.symbol_name,
        is_default: modifiers.is_default,
        is_reexport: modifiers.is_reexport,
      }
    };
  }

  // Check for visibility modifiers (Rust)
  if (modifiers.visibility_level === "pub") {
    return { scope: "public" };
  }

  // Default to file-private
  return { scope: "file-private" };
}

/**
 * Extract type annotation from capture
 */
function extract_type(capture: NormalizedCapture): SymbolName | undefined {
  // Look for type information in context
  const type_name = capture.context.type_name ||
                   capture.context.annotation_type ||
                   capture.context.return_type;

  return type_name ? type_name as SymbolName : undefined;
}

/**
 * Extract extends/implements for classes and interfaces
 */
function extract_extends(capture: NormalizedCapture): SymbolName[] {
  const extends_list: SymbolName[] = [];

  if (capture.context.extends_class) {
    extends_list.push(capture.context.extends_class as SymbolName);
  }

  if (capture.context.implements_interface) {
    extends_list.push(capture.context.implements_interface as SymbolName);
  }

  if (capture.context.implements_interfaces) {
    extends_list.push(...capture.context.implements_interfaces.map(i => i as SymbolName));
  }

  return extends_list;
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
  process(capture: NormalizedCapture): DefinitionBuilder {
    // Handle decorators by category
    if (capture.category === SemanticCategory.DECORATOR) {
      return this.add_decorator(capture);
    }

    // Only process definition captures
    if (capture.category !== SemanticCategory.DEFINITION) {
      return this;
    }

    // Route to appropriate handler based on entity type
    switch (capture.entity) {
      case SemanticEntity.CLASS:
        return this.add_class(capture);
      case SemanticEntity.FUNCTION:
        return this.add_function(capture);
      case SemanticEntity.METHOD:
        return this.add_method(capture);
      case SemanticEntity.CONSTRUCTOR:
        return this.add_constructor(capture);
      case SemanticEntity.PROPERTY:
      case SemanticEntity.FIELD:
        return this.add_property(capture);
      case SemanticEntity.PARAMETER:
        return this.add_parameter(capture);
      case SemanticEntity.INTERFACE:
        return this.add_interface(capture);
      case SemanticEntity.ENUM:
        return this.add_enum(capture);
      case SemanticEntity.ENUM_MEMBER:
        return this.add_enum_member(capture);
      case SemanticEntity.NAMESPACE:
        return this.add_namespace(capture);
      case SemanticEntity.VARIABLE:
      case SemanticEntity.CONSTANT:
        return this.add_variable(capture);
      case SemanticEntity.IMPORT:
        return this.add_import(capture);
      case SemanticEntity.TYPE:
      case SemanticEntity.TYPE_ALIAS:
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
  // Complex Type Handlers
  // ============================================================================

  private add_class(capture: NormalizedCapture): DefinitionBuilder {
    const class_id = class_symbol(capture.symbol_name, capture.node_location);
    const scope_id = this.context.get_scope_id(capture.node_location);

    this.classes.set(class_id, {
      base: {
        kind: "class",
        symbol_id: class_id,
        name: capture.symbol_name,
        location: capture.node_location,
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

  private add_function(capture: NormalizedCapture): DefinitionBuilder {
    const func_id = function_symbol(capture.symbol_name, capture.node_location);
    const scope_id = this.context.get_scope_id(capture.node_location);

    this.functions.set(func_id, {
      base: {
        kind: "function",
        symbol_id: func_id,
        name: capture.symbol_name,
        location: capture.node_location,
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

  private add_interface(capture: NormalizedCapture): DefinitionBuilder {
    const interface_id = interface_symbol(capture.symbol_name, capture.node_location);
    const scope_id = this.context.get_scope_id(capture.node_location);

    this.interfaces.set(interface_id, {
      base: {
        kind: "interface",
        symbol_id: interface_id,
        name: capture.symbol_name,
        location: capture.node_location,
        scope_id: scope_id,
        availability: determine_availability(capture),
        extends: extract_extends(capture),
      },
      methods: new Map(),
      properties: new Map(),
    });

    return this;
  }

  private add_enum(capture: NormalizedCapture): DefinitionBuilder {
    const enum_id = enum_symbol(capture.symbol_name, capture.node_location);
    const scope_id = this.context.get_scope_id(capture.node_location);

    this.enums.set(enum_id, {
      base: {
        kind: "enum",
        symbol_id: enum_id,
        name: capture.symbol_name,
        location: capture.node_location,
        scope_id: scope_id,
        availability: determine_availability(capture),
        is_const: capture.modifiers.is_const || false,
      },
      members: new Map(),
      methods: undefined,
    });

    return this;
  }

  private add_namespace(capture: NormalizedCapture): DefinitionBuilder {
    const namespace_id = namespace_symbol(capture.symbol_name, capture.node_location);
    const scope_id = this.context.get_scope_id(capture.node_location);

    this.namespaces.set(namespace_id, {
      base: {
        kind: "namespace",
        symbol_id: namespace_id,
        name: capture.symbol_name,
        location: capture.node_location,
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

  private add_method(capture: NormalizedCapture): DefinitionBuilder {
    // Find containing class or interface
    const containing_class = this.find_containing_class(capture.node_location);
    const containing_interface = this.find_containing_interface(capture.node_location);

    const method_id = method_symbol(capture.symbol_name, capture.node_location);
    const scope_id = this.context.get_scope_id(capture.node_location);

    const method_state: MethodBuilderState = {
      base: {
        kind: "method",
        symbol_id: method_id,
        name: capture.symbol_name,
        location: capture.node_location,
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

  private add_constructor(capture: NormalizedCapture): DefinitionBuilder {
    const containing_class = this.find_containing_class(capture.node_location);
    if (!containing_class) return this;

    const constructor_id = constructor_symbol(
      containing_class.base.name || "constructor",
      capture.node_location
    );
    const scope_id = this.context.get_scope_id(capture.node_location);

    containing_class.constructor = {
      base: {
        kind: "constructor",
        symbol_id: constructor_id,
        name: "constructor" as SymbolName,
        location: capture.node_location,
        scope_id: scope_id,
        availability: determine_availability(capture),
      },
      parameters: new Map(),
      decorators: [],
    };

    return this;
  }

  private add_property(capture: NormalizedCapture): DefinitionBuilder {
    const containing_class = this.find_containing_class(capture.node_location);
    const containing_interface = this.find_containing_interface(capture.node_location);

    const prop_id = property_symbol(capture.symbol_name, capture.node_location);
    const scope_id = this.context.get_scope_id(capture.node_location);

    if (containing_class) {
      containing_class.properties.set(prop_id, {
        base: {
          kind: "property",
          symbol_id: prop_id,
          name: capture.symbol_name,
          location: capture.node_location,
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
        location: capture.node_location,
      });
    }

    return this;
  }

  private add_parameter(capture: NormalizedCapture): DefinitionBuilder {
    const param_id = parameter_symbol(capture.symbol_name, capture.node_location);
    const scope_id = this.context.get_scope_id(capture.node_location);

    const param_def: ParameterDefinition = {
      kind: "parameter",
      symbol_id: param_id,
      name: capture.symbol_name,
      location: capture.node_location,
      scope_id: scope_id,
      availability: { scope: "file-private" },
      type: extract_type(capture),
      default_value: capture.context.initializer_text,
    };

    // Find containing callable (function, method, or constructor)
    const location = capture.node_location;

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

  private add_enum_member(capture: NormalizedCapture): DefinitionBuilder {
    const containing_enum = this.find_containing_enum(capture.node_location);
    if (!containing_enum) return this;

    const member_id = `${containing_enum.base.symbol_id}:${capture.symbol_name}` as SymbolId;

    containing_enum.members.set(member_id, {
      name: member_id,
      value: capture.context.initializer_text,
      location: capture.node_location,
    });

    return this;
  }

  // ============================================================================
  // Simple Definition Handlers
  // ============================================================================

  private add_variable(capture: NormalizedCapture): DefinitionBuilder {
    const var_id = variable_symbol(capture.symbol_name, capture.node_location);
    const scope_id = this.context.get_scope_id(capture.node_location);

    const kind = capture.entity === SemanticEntity.CONSTANT ? "constant" : "variable";

    this.variables.set(var_id, {
      kind: kind,
      symbol_id: var_id,
      name: capture.symbol_name,
      location: capture.node_location,
      scope_id: scope_id,
      availability: determine_availability(capture),
      type: extract_type(capture),
      initial_value: capture.context.initializer_text,
    });

    return this;
  }

  private add_import(capture: NormalizedCapture): DefinitionBuilder {
    const import_id = import_symbol(capture.symbol_name, capture.node_location);
    const scope_id = this.context.get_scope_id(capture.node_location);

    this.imports.set(import_id, {
      kind: "import",
      symbol_id: import_id,
      name: capture.symbol_name,
      location: capture.node_location,
      scope_id: scope_id,
      availability: { scope: "file-private" },
      import_path: (capture.context.source_module || "") as ModulePath,
      original_name: capture.context.import_alias as SymbolName,
      is_default: capture.modifiers.is_default,
      is_namespace: capture.modifiers.is_namespace,
    });

    return this;
  }

  private add_type(capture: NormalizedCapture): DefinitionBuilder {
    const type_id = type_symbol(capture.symbol_name, capture.node_location);
    const scope_id = this.context.get_scope_id(capture.node_location);

    const kind = capture.entity === SemanticEntity.TYPE_ALIAS ? "type_alias" : "type";

    this.types.set(type_id, {
      kind: kind,
      symbol_id: type_id,
      name: capture.symbol_name,
      location: capture.node_location,
      scope_id: scope_id,
      availability: determine_availability(capture),
      type_expression: capture.context.type_name,
    });

    return this;
  }

  private add_decorator(capture: NormalizedCapture): DefinitionBuilder {
    const decorator_id = decorator_symbol(capture.symbol_name, capture.node_location);
    const scope_id = this.context.get_scope_id(capture.node_location);

    this.decorators.set(decorator_id, {
      kind: "decorator",
      symbol_id: decorator_id,
      name: capture.symbol_name,
      location: capture.node_location,
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
  captures: NormalizedCapture[],
  context: ProcessingContext
): AnyDefinition[] {
  // Filter for definition and decorator captures and process using builder
  return captures
    .filter(capture =>
      capture.category === SemanticCategory.DEFINITION ||
      capture.category === SemanticCategory.DECORATOR
    )
    .reduce(
      (builder, capture) => builder.process(capture),
      new DefinitionBuilder(context)
    )
    .build();
}