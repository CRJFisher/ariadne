/**
 * Definition Builder System
 *
 * Directly creates Definition objects from tree-sitter captures
 * without intermediate representations. Uses builder states for
 * complex types and functional composition pattern.
 */

import {
  type ClassDefinition,
  type DecoratorDefinition,
  type EnumDefinition,
  type EnumMember,
  type ExportMetadata,
  type FunctionDefinition,
  type ImportDefinition,
  type InterfaceDefinition,
  type Location,
  type MethodDefinition,
  type NamespaceDefinition,
  type ParameterDefinition,
  type PropertyDefinition,
  type ScopeId,
  type SymbolId,
  type SymbolName,
  type TypeAliasDefinition,
  type VariableDefinition,
  type ModulePath,
  decorator_symbol,
  ConstructorDefinition,
} from "@ariadnejs/types";

import type { ProcessingContext, CaptureNode } from "../semantic_index";
import { find_body_scope_for_definition } from "../scopes/scope_utils";

// ============================================================================
// Builder Result Type
// ============================================================================

/**
 * Result from DefinitionBuilder.build()
 * Returns categorized definitions (single-file only)
 * Import/Export union types are created during cross-file resolution
 */
export interface BuilderResult {
  functions: ReadonlyMap<SymbolId, FunctionDefinition>;
  classes: ReadonlyMap<SymbolId, ClassDefinition>;
  variables: ReadonlyMap<SymbolId, VariableDefinition>;
  interfaces: ReadonlyMap<SymbolId, InterfaceDefinition>;
  enums: ReadonlyMap<SymbolId, EnumDefinition>;
  namespaces: ReadonlyMap<SymbolId, NamespaceDefinition>;
  types: ReadonlyMap<SymbolId, TypeAliasDefinition>;
  decorators: ReadonlyMap<SymbolId, DecoratorDefinition>;
  imports: ReadonlyMap<SymbolId, ImportDefinition>;
}

// ============================================================================
// Builder State Types
// ============================================================================

/**
 * Builder state for accumulating class data
 */
interface ClassBuilderState {
  base: Partial<
    Omit<
      ClassDefinition,
      "constructor" | "methods" | "properties" | "decorators"
    >
  >;
  methods: Map<SymbolId, MethodBuilderState>;
  properties: Map<SymbolId, PropertyBuilderState>;
  constructors: Map<SymbolId, ConstructorBuilderState>;
  decorators: DecoratorDefinition[];
}

/**
 * Builder state for accumulating method data
 */
interface MethodBuilderState {
  base: Partial<
    Omit<MethodDefinition, "parameters" | "decorators" | "body_scope_id">
  >;
  parameters: Map<SymbolId, ParameterDefinition>;
  decorators: DecoratorDefinition[];
  body_scope_id?: ScopeId;
}

/**
 * Builder state for accumulating constructor data
 */
interface ConstructorBuilderState {
  base: Partial<
    Omit<ConstructorDefinition, "parameters" | "decorators" | "body_scope_id">
  >;
  parameters: Map<SymbolId, ParameterDefinition>;
  decorators: DecoratorDefinition[];
  body_scope_id?: ScopeId;
}

/**
 * Builder state for accumulating property data
 */
interface PropertyBuilderState {
  base: Partial<Omit<PropertyDefinition, "decorators">>;
  decorators: DecoratorDefinition[];
}

/**
 * Builder state for accumulating function data
 */
interface FunctionBuilderState {
  base: Partial<
    Omit<FunctionDefinition, "signature" | "decorators" | "body_scope_id">
  >;
  signature: FunctionSignatureState;
  decorators: DecoratorDefinition[];
  body_scope_id?: ScopeId;
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
  base: Partial<Omit<InterfaceDefinition, "methods" | "properties">>;
  methods: Map<SymbolId, MethodBuilderState>;
  properties: Map<SymbolId, PropertyDefinition>;
}

/**
 * Builder state for accumulating enum data
 */
interface EnumBuilderState {
  base: Partial<Omit<EnumDefinition, "members" | "methods">>;
  members: Map<SymbolId, EnumMember>;
  methods?: Map<SymbolId, MethodBuilderState>;
}

/**
 * Builder state for accumulating namespace data
 */
interface NamespaceBuilderState {
  base: Partial<Omit<NamespaceDefinition, "exported_symbols">>;
  exported_symbols: Set<SymbolId>;
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
  private readonly types = new Map<SymbolId, TypeAliasDefinition>();
  private readonly decorators = new Map<SymbolId, DecoratorDefinition>();

  // Orphan captures (waiting for their parent to be added)
  private readonly orphan_methods = new Map<Location, MethodBuilderState>();
  private readonly orphan_properties = new Map<
    Location,
    PropertyBuilderState
  >();
  private readonly orphan_parameters = new Map<Location, ParameterDefinition>();
  private readonly orphan_constructors = new Map<
    Location,
    ConstructorBuilderState
  >();

  constructor(private readonly context: ProcessingContext) {}

  /**
   * Build final categorized definitions (single-file only)
   */
  build(): BuilderResult {
    // Build complex types into maps
    const functions = new Map<SymbolId, FunctionDefinition>();
    const classes = new Map<SymbolId, ClassDefinition>();
    const interfaces = new Map<SymbolId, InterfaceDefinition>();
    const enums = new Map<SymbolId, EnumDefinition>();
    const namespaces = new Map<SymbolId, NamespaceDefinition>();

    this.functions.forEach((state, id) => {
      functions.set(id, this.build_function(state));
    });
    this.classes.forEach((state, id) => {
      classes.set(id, this.build_class(state));
    });
    this.interfaces.forEach((state, id) => {
      interfaces.set(id, this.build_interface(state));
    });
    this.enums.forEach((state, id) => {
      enums.set(id, this.build_enum(state));
    });
    this.namespaces.forEach((state, id) => {
      namespaces.set(id, this.build_namespace(state));
    });

    return {
      functions,
      classes,
      variables: this.variables,
      interfaces,
      enums,
      namespaces,
      types: this.types,
      decorators: this.decorators,
      imports: this.imports,
    };
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
    is_exported?: boolean;
    export?: ExportMetadata;
    extends?: SymbolName[];
    generics?: SymbolName[];
    docstring?: readonly string[];
  }): DefinitionBuilder {
    this.classes.set(definition.symbol_id, {
      base: {
        kind: "class",
        symbol_id: definition.symbol_id,
        name: definition.name,
        location: definition.location,
        defining_scope_id: definition.scope_id,
        generics: definition.generics,
        extends: definition.extends || [],
        is_exported: definition.is_exported || false,
        export: definition.export,
        docstring: definition.docstring,
      },
      methods: new Map(),
      properties: new Map(),
      constructors: new Map(),
      decorators: [],
    });
    return this;
  }

  /**
   * Add a method to a class
   */
  add_method_to_class(
    class_id: SymbolId,
    definition: {
      symbol_id: SymbolId;
      name: SymbolName;
      location: Location;
      scope_id: ScopeId;
      return_type?: SymbolName;
      access_modifier?: "public" | "private" | "protected";
      abstract?: boolean;
      static?: boolean;
      async?: boolean;
      generics?: SymbolName[];
      docstring?: string;
    },
    capture: CaptureNode
  ): DefinitionBuilder {
    const class_state = this.classes.get(class_id);
    if (!class_state) return this;

    // Compute body_scope_id using the capture parameter
    const body_scope_id: ScopeId = find_body_scope_for_definition(
      capture,
      this.context.scopes,
      definition.name,
      definition.location
    );

    const { scope_id, ...rest } = definition;
    class_state.methods.set(definition.symbol_id, {
      base: {
        kind: "method",
        defining_scope_id: scope_id,
        ...rest,
      },
      parameters: new Map(),
      decorators: [],
      body_scope_id,
    });
    return this;
  }

  /**
   * Add a constructor to a class
   */
  add_constructor_to_class(
    class_id: SymbolId,
    definition: {
      symbol_id: SymbolId;
      name: SymbolName;
      location: Location;
      scope_id: ScopeId;
      access_modifier?: "public" | "private" | "protected";
    },
    capture?: CaptureNode
  ): DefinitionBuilder {
    const class_state = this.classes.get(class_id);
    if (!class_state) return this;

    // Compute body_scope_id if capture is provided
    let body_scope_id: ScopeId | undefined;
    if (capture) {
      try {
        body_scope_id = find_body_scope_for_definition(
          capture,
          this.context.scopes,
          definition.name,
          definition.location
        );
      } catch (error) {
        // If we can't find the body scope, log a warning but continue
        console.warn(
          `Could not find body scope for constructor ${definition.name}: ${error}`
        );
      }
    }

    const { scope_id, ...rest } = definition;
    class_state.constructors.set(definition.symbol_id, {
      base: {
        kind: "constructor",
        defining_scope_id: scope_id,
        ...rest,
      },
      parameters: new Map(),
      decorators: [],
      body_scope_id,
    });
    return this;
  }

  /**
   * Find a class ID by name (for languages like Rust where impl blocks reference structs by name)
   */
  find_class_by_name(name: SymbolName): SymbolId | undefined {
    for (const [id, state] of this.classes.entries()) {
      if (state.base.name === name) {
        return id;
      }
    }
    return undefined;
  }

  /**
   * Find an interface ID by name (for languages like Rust where impl blocks reference traits by name)
   */
  find_interface_by_name(name: SymbolName): SymbolId | undefined {
    for (const [id, state] of this.interfaces.entries()) {
      if (state.base.name === name) {
        return id;
      }
    }
    return undefined;
  }

  /**
   * Add a function definition
   */
  add_function(
    definition: {
      symbol_id: SymbolId;
      name: SymbolName;
      location: Location;
      scope_id: ScopeId;
      generics?: SymbolName[];
      is_exported?: boolean;
      export?: ExportMetadata;
      docstring?: string;
      return_type?: SymbolName;
    },
    capture?: CaptureNode
  ): DefinitionBuilder {
    // Compute body_scope_id if capture is provided
    let body_scope_id: ScopeId | undefined;
    if (capture) {
      try {
        body_scope_id = find_body_scope_for_definition(
          capture,
          this.context.scopes,
          definition.name,
          definition.location
        );
      } catch (error) {
        // If we can't find the body scope, log a warning but continue
        console.warn(
          `Could not find body scope for function ${definition.name}: ${error}`
        );
      }
    }

    this.functions.set(definition.symbol_id, {
      base: {
        kind: "function",
        symbol_id: definition.symbol_id,
        name: definition.name,
        location: definition.location,
        defining_scope_id: definition.scope_id,
        generics: definition.generics,
        is_exported: definition.is_exported,
        export: definition.export,
        docstring: definition.docstring,
      },
      signature: {
        parameters: new Map(),
        return_type: definition.return_type,
      },
      decorators: [],
      body_scope_id,
    });
    return this;
  }

  /**
   * Add a parameter to a callable (function/method/constructor)
   */
  add_parameter_to_callable(
    callable_id: SymbolId,
    definition: {
      symbol_id: SymbolId;
      name: SymbolName;
      location: Location;
      scope_id: ScopeId;
      type?: SymbolName;
      default_value?: string;
      optional?: boolean;
    }
  ): DefinitionBuilder {
    const { scope_id, ...rest } = definition;
    const param_def: ParameterDefinition = {
      kind: "parameter",
      defining_scope_id: scope_id,
      ...rest,
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

      // Check constructors in class
      const constructor_state = class_state.constructors.get(callable_id);
      if (constructor_state) {
        constructor_state.parameters.set(definition.symbol_id, param_def);
        return this;
      }
    }

    // Check methods in interfaces
    for (const interface_state of this.interfaces.values()) {
      const method_state = interface_state.methods.get(callable_id);
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
    kind: "variable" | "constant";
    symbol_id: SymbolId;
    name: SymbolName;
    location: Location;
    scope_id: ScopeId;
    is_exported?: boolean;
    export?: ExportMetadata;
    type?: SymbolName;
    initial_value?: string;
    docstring?: string;
  }): DefinitionBuilder {
    this.variables.set(definition.symbol_id, {
      kind: definition.kind,
      symbol_id: definition.symbol_id,
      name: definition.name,
      location: definition.location,
      defining_scope_id: definition.scope_id,
      is_exported: definition.is_exported || false,
      export: definition.export,
      type: definition.type,
      initial_value: definition.initial_value,
      docstring: definition.docstring,
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
    import_path: ModulePath;
    original_name?: SymbolName;
    import_kind: "named" | "default" | "namespace";
    is_type_only?: boolean;
    export?: ExportMetadata;
  }): DefinitionBuilder {
    this.imports.set(definition.symbol_id, {
      kind: "import",
      symbol_id: definition.symbol_id,
      name: definition.name,
      location: definition.location,
      defining_scope_id: definition.scope_id,
      export: definition.export,
      import_path: definition.import_path,
      original_name: definition.original_name,
      import_kind: definition.import_kind,
      is_type_only: definition.is_type_only,
    });
    return this;
  }

  /**
   * Add a property to a class
   */
  add_property_to_class(
    class_id: SymbolId,
    definition: {
      symbol_id: SymbolId;
      name: SymbolName;
      location: Location;
      scope_id: ScopeId;
      type?: SymbolName;
      initial_value?: string;
      access_modifier?: "public" | "private" | "protected";
      static?: boolean;
      readonly?: boolean;
      abstract?: boolean;
    }
  ): DefinitionBuilder {
    const class_state = this.classes.get(class_id);
    if (!class_state) return this;

    const { scope_id, ...rest } = definition;
    class_state.properties.set(definition.symbol_id, {
      base: {
        kind: "property",
        defining_scope_id: scope_id,
        ...rest,
      },
      decorators: [],
    });
    return this;
  }

  /**
   * Add an interface definition
   */
  add_interface(definition: {
    symbol_id: SymbolId;
    name: SymbolName;
    location: Location;
    scope_id: ScopeId;
    is_exported?: boolean;
    export?: ExportMetadata;
    extends?: SymbolName[];
    generics?: SymbolName[];
  }): DefinitionBuilder {
    this.interfaces.set(definition.symbol_id, {
      base: {
        kind: "interface",
        symbol_id: definition.symbol_id,
        name: definition.name,
        location: definition.location,
        defining_scope_id: definition.scope_id,
        is_exported: definition.is_exported || false,
        export: definition.export,
        extends: definition.extends || [],
        generics: definition.generics,
      },
      methods: new Map(),
      properties: new Map(),
    });
    return this;
  }

  /**
   * Add a method signature to an interface
   */
  add_method_signature_to_interface(
    interface_id: SymbolId,
    definition: {
      symbol_id: SymbolId;
      name: SymbolName;
      location: Location;
      scope_id: ScopeId;
      generics?: SymbolName[];
      return_type?: SymbolName;
    }
  ): DefinitionBuilder {
    const interface_state = this.interfaces.get(interface_id);
    if (!interface_state) return this;

    interface_state.methods.set(definition.symbol_id, {
      base: {
        kind: "method",
        symbol_id: definition.symbol_id,
        name: definition.name,
        location: definition.location,
        defining_scope_id: definition.scope_id,
        return_type: definition.return_type,
        generics: definition.generics,
      },
      parameters: new Map(),
      decorators: [],
    });
    return this;
  }

  /**
   * Add a property signature to an interface
   */
  add_property_signature_to_interface(
    interface_id: SymbolId,
    definition: {
      symbol_id: SymbolId;
      name: SymbolName;
      location: Location;
      type?: SymbolName;
      scope_id: ScopeId;
    }
  ): DefinitionBuilder {
    const interface_state = this.interfaces.get(interface_id);
    if (!interface_state) return this;

    interface_state.properties.set(definition.symbol_id, {
      kind: "property",
      symbol_id: definition.symbol_id,
      name: definition.name,
      type: definition.type,
      defining_scope_id: definition.scope_id,
      location: definition.location,
      decorators: [],
    });
    return this;
  }

  /**
   * Add a type alias definition
   */
  add_type_alias(definition: {
    kind: "type" | "type_alias";
    symbol_id: SymbolId;
    name: SymbolName;
    location: Location;
    scope_id: ScopeId;
    is_exported?: boolean;
    export?: ExportMetadata;
    type_expression?: SymbolName;
    generics?: SymbolName[];
  }): DefinitionBuilder {
    this.types.set(definition.symbol_id, {
      ...definition,
      is_exported: definition.is_exported || false,
      defining_scope_id: definition.scope_id,
    });
    return this;
  }

  /**
   * Add an enum definition
   */
  add_enum(definition: {
    symbol_id: SymbolId;
    name: SymbolName;
    location: Location;
    scope_id: ScopeId;
    is_exported?: boolean;
    export?: ExportMetadata;
    is_const?: boolean;
    generics?: SymbolName[];
  }): DefinitionBuilder {
    this.enums.set(definition.symbol_id, {
      base: {
        kind: "enum",
        symbol_id: definition.symbol_id,
        name: definition.name,
        location: definition.location,
        defining_scope_id: definition.scope_id,
        is_exported: definition.is_exported || false,
        export: definition.export,
        is_const: definition.is_const || false,
        generics: definition.generics,
      },
      members: new Map(),
      methods: undefined,
    });
    return this;
  }

  /**
   * Add an enum member
   */
  add_enum_member(
    enum_id: SymbolId,
    definition: {
      symbol_id: SymbolId;
      name: SymbolName;
      location: Location;
      value?: string | number;
    }
  ): DefinitionBuilder {
    const enum_state = this.enums.get(enum_id);
    if (!enum_state) return this;

    enum_state.members.set(definition.symbol_id, {
      name: definition.name,
      value: definition.value,
      location: definition.location,
    });
    return this;
  }

  /**
   * Add a namespace definition
   */
  add_namespace(definition: {
    symbol_id: SymbolId;
    name: SymbolName;
    location: Location;
    scope_id: ScopeId;
    is_exported?: boolean;
    export?: ExportMetadata;
  }): DefinitionBuilder {
    this.namespaces.set(definition.symbol_id, {
      base: {
        kind: "namespace",
        symbol_id: definition.symbol_id,
        name: definition.name,
        location: definition.location,
        defining_scope_id: definition.scope_id,
        is_exported: definition.is_exported || false,
        export: definition.export,
      },
      exported_symbols: new Set(),
    });
    return this;
  }

  /**
   * Add a decorator to a target (class, method, or property)
   */
  add_decorator_to_target(
    target_id: SymbolId,
    decorator: {
      defining_scope_id: ScopeId;
      name: SymbolName;
      arguments?: string[];
      location: Location;
    }
  ): DefinitionBuilder {
    // Create a decorator symbol ID
    const decorator_id = decorator_symbol(decorator.name, decorator.location);
    const decorator_definition: DecoratorDefinition = {
      symbol_id: decorator_id,
      defining_scope_id: decorator.defining_scope_id,
      kind: "decorator",
      name: decorator.name,
      location: decorator.location,
    };

    // Check if target is a class
    const class_state = this.classes.get(target_id);
    if (class_state) {
      // Classes use SymbolId for decorators
      class_state.decorators.push(decorator_definition);
      return this;
    }

    // Check if target is a method in a class
    for (const cls of this.classes.values()) {
      const method_state = cls.methods.get(target_id);
      if (method_state) {
        // Methods use SymbolName for decorators
        method_state.decorators.push(decorator_definition);
        return this;
      }

      // Check if target is a property in a class
      const prop_state = cls.properties.get(target_id);
      if (prop_state) {
        // Properties use SymbolId for decorators
        prop_state.decorators.push(decorator_definition);
        return this;
      }
    }

    // Check if target is a method in an interface
    for (const iface of this.interfaces.values()) {
      const method_state = iface.methods.get(target_id);
      if (method_state) {
        // Interface methods use SymbolName for decorators
        method_state.decorators.push(decorator_definition);
        return this;
      }
    }

    return this;
  }

  // ============================================================================
  // Builder Methods
  // ============================================================================

  private build_class(state: ClassBuilderState): ClassDefinition {
    const methods = Array.from(state.methods.values()).map((m) =>
      this.build_method(m)
    );
    const properties = Array.from(state.properties.values()).map((p) =>
      this.build_property(p)
    );
    const constructors =
      state.constructors.size > 0
        ? Array.from(state.constructors.values()).map((c) =>
            this.build_constructor(c)
          )
        : undefined;

    return {
      kind: "class" as const,
      ...state.base,
      methods: methods,
      properties: properties,
      constructor: constructors,
      decorators: state.decorators,
      extends: state.base.extends || [],
    } as ClassDefinition;
  }

  private build_method(state: MethodBuilderState): MethodDefinition {
    const parameters = Array.from(state.parameters.values());

    // For testing purposes, we allow undefined body_scope_id, but in production it should be set
    const body_scope_id = state.body_scope_id || ("mock:method:scope" as any);

    return {
      kind: "method" as const,
      ...state.base,
      parameters: parameters,
      decorators: state.decorators.length > 0 ? state.decorators : undefined,
      body_scope_id,
    } as MethodDefinition;
  }

  private build_constructor(
    state: ConstructorBuilderState
  ): ConstructorDefinition {
    const parameters = Array.from(state.parameters.values());

    // For testing purposes, we allow undefined body_scope_id, but in production it should be set
    const body_scope_id =
      state.body_scope_id || ("mock:constructor:scope" as any);

    return {
      kind: "constructor" as const,
      ...state.base,
      parameters: parameters,
      decorators: state.decorators.length > 0 ? state.decorators : undefined,
      body_scope_id: body_scope_id,
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

    // For testing purposes, we allow undefined body_scope_id, but in production it should be set
    const body_scope_id = state.body_scope_id || ("mock:function:scope" as any);

    return {
      kind: "function" as const,
      ...state.base,
      signature: {
        parameters: parameters,
        return_type: state.signature.return_type,
      },
      decorators: state.decorators.length > 0 ? state.decorators : undefined,
      return_type: state.signature.return_type,
      body_scope_id: body_scope_id,
    } as FunctionDefinition;
  }

  private build_interface(state: InterfaceBuilderState): InterfaceDefinition {
    const methods = Array.from(state.methods.values()).map((m) =>
      this.build_method(m)
    );
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
      ? Array.from(state.methods.values()).map((m) => this.build_method(m))
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
    const exported_symbols =
      state.exported_symbols.size > 0
        ? Array.from(state.exported_symbols)
        : undefined;

    return {
      kind: "namespace" as const,
      ...state.base,
      exported_symbols: exported_symbols,
    } as NamespaceDefinition;
  }
}
