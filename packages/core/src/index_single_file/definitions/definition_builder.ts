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
  type TypeParameter,
  type VariableDefinition,
  type ModulePath,
  decorator_symbol,
  ConstructorDefinition,
  CallbackContext,
  CollectionMember,
  MemberSource,
} from "@ariadnejs/types";

import type { CaptureNode } from "../capture_types";
import type { ProcessingContext } from "../scopes/processing_context";
import { find_body_scope_for_definition } from "../scopes/scope_lookup";
import { attach_collection_members } from "./attach_collection_members";
import type {
  ClassBuilderState,
  ConstructorBuilderState,
  EnumBuilderState,
  FunctionBuilderState,
  InterfaceBuilderState,
  MethodBuilderState,
  NamespaceBuilderState,
  PropertyBuilderState,
} from "./builder_state";
import type { ImplMethodInput, MethodInput } from "./method_input";

function find_state_by_name(
  states: ReadonlyMap<SymbolId, { base: { name?: SymbolName } }>,
  name: SymbolName
): SymbolId | undefined {
  for (const [id, state] of states) {
    if (state.base.name === name) {
      return id;
    }
  }
  return undefined;
}

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
  unattached_impl_methods: ReadonlyMap<SymbolId, MethodDefinition>;
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

  // @language rust
  // Methods of impl blocks whose self type this file declares no definition for.
  private readonly unattached_impl_methods = new Map<SymbolId, MethodBuilderState>();

  // Member functions assigned to a holder across separate statements
  // (`app.method = function () {}`), keyed by the holder identifier name.
  // Attached to the holder's definition as a FunctionCollection in build().
  private readonly pending_collection_members = new Map<
    SymbolName,
    CollectionMember[]
  >();

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
    attach_collection_members(
      this.pending_collection_members,
      this.variables,
      this.functions
    );

    // Build complex types into maps
    const functions = new Map<SymbolId, FunctionDefinition>();
    const classes = new Map<SymbolId, ClassDefinition>();
    const interfaces = new Map<SymbolId, InterfaceDefinition>();
    const enums = new Map<SymbolId, EnumDefinition>();
    const namespaces = new Map<SymbolId, NamespaceDefinition>();

    for (const [id, state] of this.functions) {
      functions.set(id, this.build_function(state));
    }
    for (const [id, state] of this.classes) {
      classes.set(id, this.build_class(state));
    }
    for (const [id, state] of this.interfaces) {
      interfaces.set(id, this.build_interface(state));
    }
    for (const [id, state] of this.enums) {
      enums.set(id, this.build_enum(state));
    }
    for (const [id, state] of this.namespaces) {
      namespaces.set(id, this.build_namespace(state));
    }
    const unattached_impl_methods = new Map<SymbolId, MethodDefinition>();
    for (const [id, state] of this.unattached_impl_methods) {
      unattached_impl_methods.set(id, this.build_method(state));
    }

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
      unattached_impl_methods,
    };
  }

  /**
   * Record a function assigned to a holder's property (`app.method = fn`).
   * Members accumulate by holder name and attach to the holder in build().
   */
  add_collection_member(
    holder_name: SymbolName,
    member: CollectionMember
  ): DefinitionBuilder {
    const members = this.pending_collection_members.get(holder_name);
    if (members) {
      members.push(member);
    } else {
      this.pending_collection_members.set(holder_name, [member]);
    }
    return this;
  }

  // ============================================================================
  // Public API for Language Configs
  // ============================================================================

  add_class(definition: {
    symbol_id: SymbolId;
    name: SymbolName;
    location: Location;
    scope_id: ScopeId;
    is_exported?: boolean;
    export?: ExportMetadata;
    extends?: SymbolName[];
    generics?: readonly TypeParameter[];
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
      property_ids_by_name: new Map(),
      constructors: new Map(),
      decorators: [],
    });
    return this;
  }

  add_method_to_class(class_id: SymbolId, definition: MethodInput): DefinitionBuilder {
    this.classes.get(class_id)?.methods.set(definition.symbol_id, this.method_state(definition));
    return this;
  }

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

  // ==========================================================================
  // Rust-only: impl-block name lookups and enum methods
  // ==========================================================================

  /** The class named `name` — Rust impl blocks name their struct. */
  find_class_by_name(name: SymbolName): SymbolId | undefined {
    return find_state_by_name(this.classes, name);
  }

  /** The interface named `name` — Rust impl blocks name their trait. */
  find_interface_by_name(name: SymbolName): SymbolId | undefined {
    return find_state_by_name(this.interfaces, name);
  }

  /** The enum named `name` — Rust impl blocks can name an enum. */
  find_enum_by_name(name: SymbolName): SymbolId | undefined {
    return find_state_by_name(this.enums, name);
  }

  /** Rust enums carry methods through impl blocks. */
  add_method_to_enum(enum_id: SymbolId, definition: MethodInput): DefinitionBuilder {
    const enum_state = this.enums.get(enum_id);
    if (enum_state) {
      enum_state.methods ??= new Map();
      enum_state.methods.set(definition.symbol_id, this.method_state(definition));
    }
    return this;
  }

  /** A method of an impl block whose self type has no definition in this file. */
  add_unattached_impl_method(definition: ImplMethodInput): DefinitionBuilder {
    this.unattached_impl_methods.set(definition.symbol_id, this.method_state(definition));
    return this;
  }

  private method_state(definition: MethodInput): MethodBuilderState {
    // Abstract methods have no body, so they have no body scope.
    let body_scope_id: ScopeId | undefined;
    if (!definition.abstract) {
      try {
        body_scope_id = find_body_scope_for_definition(
          this.context.scopes,
          definition.name,
          definition.location
        );
      } catch (error) {
        // A bodyless method (an interface signature) has no body scope to find.
        console.warn(
          `Could not find body scope for method ${definition.name}: ${error}`
        );
      }
    }

    const { scope_id, ...rest } = definition;
    return {
      base: {
        kind: "method",
        defining_scope_id: scope_id,
        ...rest,
      },
      parameters: new Map(),
      decorators: [],
      body_scope_id,
    };
  }

  // ==========================================================================
  // All languages
  // ==========================================================================

  add_function(
    definition: {
      symbol_id: SymbolId;
      name: SymbolName;
      location: Location;
      scope_id: ScopeId;
      generics?: readonly TypeParameter[];
      is_exported?: boolean;
      export?: ExportMetadata;
      docstring?: string;
      return_type?: SymbolName;
      returned_name_chain?: readonly SymbolName[];
    },
    capture?: CaptureNode
  ): DefinitionBuilder {
    // Compute body_scope_id if capture is provided
    let body_scope_id: ScopeId | undefined;
    if (capture) {
      try {
        body_scope_id = find_body_scope_for_definition(
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
        returned_name_chain: definition.returned_name_chain,
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
   * Anonymous functions don't have a name in the source code, so we generate a synthetic
   * SymbolId based on their location and use "<anonymous>" as the display name.
   *
   * @param definition - Function properties (symbol_id should be pre-generated location-based ID)
   * @param capture - Optional capture node for finding body scope
   * @returns this for chaining
   */
  add_anonymous_function(
    definition: {
      symbol_id: SymbolId;
      location: Location;
      scope_id: ScopeId;
      return_type?: SymbolName;
      callback_context?: CallbackContext;
    },
    capture?: CaptureNode
  ): DefinitionBuilder {
    // Compute body_scope_id if capture is provided
    let body_scope_id: ScopeId | undefined;
    if (capture) {
      try {
        body_scope_id = find_body_scope_for_definition(
          this.context.scopes,
          "<anonymous>" as SymbolName,
          definition.location
        );
      } catch (error) {
        console.warn(`Could not find body scope for anonymous function ${definition.symbol_id}: ${error}`);
        // Anonymous functions might not have traditional body scopes
        // (e.g., single-expression arrow functions), so this is expected
      }
    }

    this.functions.set(definition.symbol_id, {
      base: {
        kind: "function",
        symbol_id: definition.symbol_id,
        name: "<anonymous>" as SymbolName,  // Synthetic display name
        location: definition.location,
        defining_scope_id: definition.scope_id,
        is_exported: false,  // Anonymous functions are never exported
      },
      signature: {
        parameters: new Map(),
        return_type: definition.return_type,
      },
      decorators: [],
      body_scope_id,
      callback_context: definition.callback_context,
    });
    return this;
  }

  add_parameter_to_callable(
    callable_id: SymbolId,
    definition: {
      symbol_id: SymbolId;
      name: SymbolName;
      location: Location;
      scope_id: ScopeId;
      type?: SymbolName;
      default_value?: string;
      name_source?: SymbolName;
      member_source?: MemberSource;
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

    // Check methods in enums (Rust impl blocks targeting enums)
    for (const enum_state of this.enums.values()) {
      const method_state = enum_state.methods?.get(callable_id);
      if (method_state) {
        method_state.parameters.set(definition.symbol_id, param_def);
        return this;
      }
    }

    const unattached_state = this.unattached_impl_methods.get(callable_id);
    if (unattached_state) {
      unattached_state.parameters.set(definition.symbol_id, param_def);
      return this;
    }

    // The indexed callable surface is deliberately partial — a parameter whose
    // owner no handler indexes is an expected gap, not an inconsistency, so it
    // is dropped rather than raised. Raising here would abort the file's index
    // and drop it from the corpus entirely, which manufactures exactly the
    // uncalled-looking functions entry-point detection exists to avoid.
    return this;
  }

  add_variable(
    definition: Omit<VariableDefinition, "defining_scope_id" | "is_exported"> & {
      scope_id: ScopeId;
      is_exported?: boolean;
    }
  ): DefinitionBuilder {
    const { scope_id, is_exported, ...variable } = definition;
    this.variables.set(definition.symbol_id, {
      ...variable,
      defining_scope_id: scope_id,
      is_exported: is_exported || false,
    });
    return this;
  }

  add_import(definition: {
    symbol_id: SymbolId;
    name: SymbolName;
    location: Location;
    scope_id: ScopeId;
    import_path: ModulePath;
    original_name?: SymbolName;
    import_kind: "named" | "default" | "namespace" | "wildcard";
    is_type_only?: boolean;
    is_commonjs_require?: boolean;
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
      is_commonjs_require: definition.is_commonjs_require,
    });
    return this;
  }

  add_property_to_class(
    class_id: SymbolId,
    definition: {
      symbol_id: SymbolId;
      name: SymbolName;
      location: Location;
      scope_id: ScopeId;
      type?: SymbolName;
      initial_value?: string;
      name_source?: SymbolName;
      member_source?: MemberSource;
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
    if (!class_state.property_ids_by_name.has(definition.name)) {
      class_state.property_ids_by_name.set(definition.name, definition.symbol_id);
    }
    return this;
  }

  // ==========================================================================
  // Python and JavaScript: property inference from an instance assignment
  // ==========================================================================

  /**
   * Add a class property inferred from an instance assignment (Python's
   * `self.<attr> = …`, a JavaScript constructor's `this.<attr> = …`), deduped
   * by name within the class.
   *
   * Property symbol_ids are location-based, so the same attribute assigned at
   * two sites would otherwise emit two PropertyDefinitions. First-inserted
   * wins; because definitions are processed in capture order and tree-sitter
   * yields captures in document order, that is the textually-first assignment.
   * A later typed assignment upgrades an earlier untyped one (`self.df = None`
   * in `__init__`, then `self.df = pd.DataFrame()` in a sibling method, types
   * `df` as `DataFrame`), but a typed property is never overwritten.
   */
  add_inferred_property_to_class(
    class_id: SymbolId,
    definition: {
      symbol_id: SymbolId;
      name: SymbolName;
      location: Location;
      scope_id: ScopeId;
      type?: SymbolName;
    }
  ): DefinitionBuilder {
    const class_state = this.classes.get(class_id);
    if (!class_state) return this;

    const existing_id = class_state.property_ids_by_name.get(definition.name);
    const existing_state = existing_id ? class_state.properties.get(existing_id) : undefined;
    if (!existing_id || !existing_state) return this.add_property_to_class(class_id, definition);

    if (existing_state.base.type === undefined && definition.type !== undefined) {
      class_state.properties.set(existing_id, {
        ...existing_state,
        base: { ...existing_state.base, type: definition.type },
      });
    }
    return this;
  }

  // ==========================================================================
  // All languages
  // ==========================================================================

  add_interface(definition: {
    symbol_id: SymbolId;
    name: SymbolName;
    location: Location;
    scope_id: ScopeId;
    is_exported?: boolean;
    export?: ExportMetadata;
    extends?: SymbolName[];
    generics?: readonly TypeParameter[];
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

  add_method_signature_to_interface(
    interface_id: SymbolId,
    definition: {
      symbol_id: SymbolId;
      name: SymbolName;
      location: Location;
      scope_id: ScopeId;
      generics?: readonly TypeParameter[];
      return_type?: SymbolName;
      docstring?: string;
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
        docstring: definition.docstring,
      },
      parameters: new Map(),
      decorators: [],
    });
    return this;
  }

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

  add_type_alias(definition: {
    kind: "type" | "type_alias";
    symbol_id: SymbolId;
    name: SymbolName;
    location: Location;
    scope_id: ScopeId;
    is_exported?: boolean;
    export?: ExportMetadata;
    type_expression?: SymbolName;
    generics?: readonly TypeParameter[];
  }): DefinitionBuilder {
    this.types.set(definition.symbol_id, {
      ...definition,
      is_exported: definition.is_exported || false,
      defining_scope_id: definition.scope_id,
    });
    return this;
  }

  add_enum(definition: {
    symbol_id: SymbolId;
    name: SymbolName;
    location: Location;
    scope_id: ScopeId;
    is_exported?: boolean;
    export?: ExportMetadata;
    is_const?: boolean;
    generics?: readonly TypeParameter[];
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
      symbol_id: definition.symbol_id,
      name: definition.name,
      value: definition.value,
      location: definition.location,
    });
    return this;
  }

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

    // Check if target is a standalone function
    const func_state = this.functions.get(target_id);
    if (func_state) {
      func_state.decorators.push(decorator_definition);
      return this;
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
      constructors: constructors,
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
      body_scope_id: state.body_scope_id,
    } as MethodDefinition;
  }

  private build_constructor(
    state: ConstructorBuilderState
  ): ConstructorDefinition {
    const parameters = Array.from(state.parameters.values());

    return {
      kind: "constructor" as const,
      ...state.base,
      parameters: parameters,
      decorators: state.decorators.length > 0 ? state.decorators : undefined,
      body_scope_id: state.body_scope_id,
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
      body_scope_id: state.body_scope_id,
      callback_context: state.callback_context,
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
