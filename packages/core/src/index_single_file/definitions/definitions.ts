/**
 * Definitions - Process symbol definitions
 */

import type {
  FilePath,
  SymbolId,
  SymbolName,
  ScopeId,
  LexicalScope,
  Location,
  Language,
  SymbolAvailability,
  FunctionDefinition,
  ClassDefinition,
  VariableDefinition,
  InterfaceDefinition,
  EnumDefinition,
  NamespaceDefinition,
  MethodDefinition,
  TypeDefinition,
  AnyDefinition,
  ConstructorDefinition,
  Definition,
  ParameterDefinition,
} from "@ariadnejs/types";
import {
  function_symbol,
  class_symbol,
  method_symbol,
  variable_symbol,
  parameter_symbol,
} from "@ariadnejs/types";
import { find_containing_scope } from "../scope_tree";
import {
  CaptureContext,
  type NormalizedCapture,
  SemanticEntity,
  SemanticModifiers,
} from "../parse_and_query_code/capture_types";

/**
 * Process symbol definitions
 */
export function process_definitions(
  def_captures: NormalizedCapture[],
  root_scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>,
  file_path: FilePath,
  language?: Language
): {
  functions: Map<SymbolId, FunctionDefinition>;
  classes: Map<SymbolId, ClassDefinition>;
  variables: Map<SymbolId, VariableDefinition>;
  interfaces: Map<SymbolId, InterfaceDefinition>;
  enums: Map<SymbolId, EnumDefinition>;
  namespaces: Map<SymbolId, NamespaceDefinition>;
  types: Map<SymbolId, TypeDefinition>;
  file_symbols_by_name: Map<FilePath, Map<SymbolName, SymbolId>>;
} {
  // Input validation
  if (!def_captures || !root_scope || !scopes || !file_path) {
    throw new Error("Invalid input parameters to process_definitions");
  }
  // Initialize separate maps for each symbol type
  const functions = new Map<SymbolId, FunctionDefinition>();
  const classes = new Map<SymbolId, ClassDefinition>();
  const variables = new Map<SymbolId, VariableDefinition>(); // TODO: create scope-variables map for type-tracking
  const interfaces = new Map<SymbolId, InterfaceDefinition>();
  const enums = new Map<SymbolId, EnumDefinition>();
  const namespaces = new Map<SymbolId, NamespaceDefinition>();
  const symbols_by_name = new Map<FilePath, Map<SymbolName, SymbolId>>();
  const types = new Map<SymbolId, TypeDefinition>();

  // Temporary storage before nesting in classes, interfaces and functions
  const methods = new Map<SymbolId, MethodDefinition>();
  const parameters = new Map<SymbolId, ParameterDefinition>();
  const constructors = new Map<SymbolId, ConstructorDefinition>();

  const class_scope_id_to_definitions = new Map<ScopeId, ClassDefinition>();

  // First pass: create all symbols
  for (const capture of def_captures) {
    const location = capture.node_location;
    if (!location || !capture.symbol_name) {
      continue; // Skip invalid captures
    }

    const scope =
      find_containing_scope(location, root_scope, scopes) || root_scope;
    const name = (capture.symbol_name || "").trim() as SymbolName;
    if (!name) {
      continue; // Skip empty names
    }
    const kind = map_entity_to_symbol_kind(capture.entity);
    const availability = determine_symbol_availability(
      capture.entity,
      capture.modifiers,
      language
    );
    const is_hoisted = is_symbol_hoisted(capture.entity, language);
    const def_scope = is_hoisted
      ? get_hoist_target(scope, kind, scopes)
      : scope;

    // Create symbol ID
    const symbol_id = create_symbol_id(name, kind, location);

    // Base fields common to all definitions
    const base: Definition = {
      symbol_id,
      name,
      location,
      scope_id: def_scope.id,
      availability,
    };

    // Create specific definition type based on kind and store in appropriate map
    let symbol: AnyDefinition;
    switch (kind) {
      case "function":
        const function_def = createFunctionDef(base, capture.modifiers);
        functions.set(symbol_id, function_def);
        symbol = function_def;
        break;
      case "constructor":
        const constructor_def = createConstructorDef(base, capture.modifiers);
        constructors.set(symbol_id, constructor_def);
        symbol = constructor_def;
        break;
      case "class":
        const class_def = createClassDef(base, capture.modifiers);
        classes.set(symbol_id, class_def);
        class_scope_id_to_definitions.set(def_scope.id, class_def);
        symbol = class_def;
        break;
      case "method":
        const method_def = createMethodDef(base, capture.modifiers);
        methods.set(symbol_id, method_def);
        symbol = method_def;
        break;
      case "variable":
        const variable_def = createVariableDef(
          base,
          "variable",
          capture.modifiers
        );
        variables.set(symbol_id, variable_def);
        symbol = variable_def;
        break;
      case "constant":
        const constant_def = createVariableDef(
          base,
          "constant",
          capture.modifiers
        );
        variables.set(symbol_id, constant_def);
        symbol = constant_def;
        break;
      case "parameter":
        const parameter_def = createParameterDef(
          base,
          "parameter",
          capture.modifiers
        );
        parameters.set(symbol_id, parameter_def);
        symbol = parameter_def;
        break;
      case "interface":
        const interface_def = createInterfaceDef(base, capture.modifiers);
        interfaces.set(symbol_id, interface_def);
        symbol = interface_def;
        break;
      case "enum":
        const enum_def = createEnumDef(base, capture.modifiers);
        enums.set(symbol_id, enum_def);
        symbol = enum_def;
        break;
      case "type":
        const type_def = createTypeDef(base, "type", capture.modifiers);
        types.set(symbol_id, type_def);
        symbol = type_def;
        break;
      case "type_alias":
        const type_alias_def = createTypeDef(
          base,
          "type_alias",
          capture.modifiers
        );
        types.set(symbol_id, type_alias_def);
        symbol = type_alias_def;
        break;
      case "namespace":
        const namespace_def = createNamespaceDef(
          base,
          "namespace",
          capture.modifiers
        );
        namespaces.set(symbol_id, namespace_def);
        symbol = namespace_def;
        break;
      case "module":
        const module_def = createNamespaceDef(
          base,
          "module",
          capture.modifiers
        );
        namespaces.set(symbol_id, module_def);
        symbol = module_def;
        break;
      case "import":
        // Imports are handled separately, create as variable for now
        const import_def = createVariableDef(
          base,
          "variable",
          capture.modifiers
        );
        variables.set(symbol_id, import_def);
        symbol = import_def;
        break;
      default:
        // Default to variable for unknown kinds
        console.warn(`Unknown symbol kind: ${kind}, defaulting to variable`);
        const var_def = createVariableDef(base, "variable", capture.modifiers);
        variables.set(symbol_id, var_def);
        symbol = var_def;
    }

    // Store symbol in scope
    def_scope.symbols.set(name, symbol);

    // Update name index
    if (!symbols_by_name.has(file_path)) {
      symbols_by_name.set(file_path, new Map<SymbolName, SymbolId>());
    }
    const file_symbols = symbols_by_name.get(file_path);
    if (file_symbols && !file_symbols.has(name)) {
      file_symbols.set(name, symbol_id);
    }
  }

  // Second pass: Associate methods with their parent classes/interfaces/enums
  for (const [method_id, method] of methods) {
    // Find the parent class/interface/enum by checking scopes
    const method_scope = scopes.get(method.scope_id);
    if (!method_scope) continue;

    // Look for parent type in the parent scope
    let parent_found = false;

    // Check if the method belongs to a class
    for (const [class_id, class_def] of classes) {
      if (
        class_def.scope_id === method_scope.parent_id ||
        (method_scope.parent_id &&
          scopes.get(method_scope.parent_id)?.symbols.has(class_def.name))
      ) {
        // Add method to class
        const existing_methods = class_def.methods || [];
        classes.set(class_id, {
          ...class_def,
          methods: [...existing_methods, method],
        });
        parent_found = true;
        break;
      }
    }

    // Check interfaces if not found in classes
    if (!parent_found) {
      for (const [interface_id, interface_def] of interfaces) {
        if (
          interface_def.scope_id === method_scope.parent_id ||
          (method_scope.parent_id &&
            scopes.get(method_scope.parent_id)?.symbols.has(interface_def.name))
        ) {
          // Add method to interface
          const existing_methods = interface_def.methods || [];
          interfaces.set(interface_id, {
            ...interface_def,
            methods: [...existing_methods, method],
          });
          parent_found = true;
          break;
        }
      }
    }

    // Check enums if not found in classes or interfaces
    if (!parent_found) {
      for (const [enum_id, enum_def] of enums) {
        if (
          enum_def.scope_id === method_scope.parent_id ||
          (method_scope.parent_id &&
            scopes.get(method_scope.parent_id)?.symbols.has(enum_def.name))
        ) {
          // Add method to enum
          const existing_methods = enum_def.methods || [];
          enums.set(enum_id, {
            ...enum_def,
            methods: [...existing_methods, method],
          });
          parent_found = true;
          break;
        }
      }
    }
  }

  // Associate constructors with their parent classes
  for (const [constructor_id, constructor] of constructors) {
    const constructor_scope = scopes.get(constructor.scope_id);
    if (!constructor_scope) continue;
    classes.set(constructor_id, {
      ...constructor,
      constructor: constructor,
    });
  }
  // TODO: parameters, decorators

  // Also associate fields/variables with their parent classes
  for (const [var_id, var_def] of variables) {
    if (var_def.kind === "variable" || var_def.kind === "constant") {
      const var_scope = scopes.get(var_def.scope_id);
      if (!var_scope) continue;

      // Check if this variable is a field in a class
      for (const [class_id, class_def] of classes) {
        if (
          class_def.scope_id === var_def.scope_id ||
          class_def.scope_id === var_scope.parent_id
        ) {
          // Add field to class
          const existing_fields = class_def.fields || [];
          classes.set(class_id, {
            ...class_def,
            fields: [...existing_fields, var_def],
          });
          break;
        }
      }
    }
  }

  return {
    functions,
    classes,
    variables,
    interfaces,
    enums,
    types,
    namespaces,
    file_symbols_by_name: symbols_by_name,
  };
}

/**
 * Factory functions for creating specific definition types
 */

function createFunctionDef(
  base: Definition,
  modifiers: SemanticModifiers,
  context: CaptureContext | undefined
): FunctionDefinition {
  return {
    ...base,
    kind: "function",
    signature: {
      parameters: context?.parameters || [], // TODO: add parameters on second pass.
      return_type: context?.return_type as SymbolName,
    },
  };
}

function createConstructorDef(
  base: Definition,
  modifiers: SemanticModifiers
): ConstructorDefinition {
  return {
    ...base,
    kind: "constructor",
    parameters: modifiers.parameters, // TODO: add parameters on second pass.
    decorators: modifiers.decorators, // TODO: add decorators on second pass.
  };
}

function createClassDef(
  base: Definition,
  modifiers: SemanticModifiers
): ClassDefinition {
  return {
    ...base,
    kind: "class",
    extends_class: modifiers.extends_class as SymbolName,
    implements_interfaces: modifiers.implements_interfaces,
    is_generic: modifiers.is_generic,
  };
}

function createMethodDef(
  base: Definition,
  modifiers: SemanticModifiers
): MethodDefinition {
  return {
    ...base,
    kind: "method",
    is_static: modifiers.is_static,
    return_type_hint: modifiers.return_type as SymbolName,
    is_generic: modifiers.is_generic,
    is_async: modifiers.is_async,
  };
}

function createVariableDef(
  base: Definition,
  kind: "variable" | "constant",
  modifiers: SemanticModifiers
): VariableDefinition {
  return {
    ...base,
    kind,
    type: modifiers.type as SymbolName,
    is_lifetime: modifiers.is_lifetime,
  };
}

function createInterfaceDef(
  base: Definition,
  modifiers: SemanticModifiers
): InterfaceDefinition {
  return {
    ...base,
    kind: "interface",
    extends_interfaces: modifiers.extends_interfaces,
    is_generic: modifiers.is_generic,
  };
}

function createEnumDef(
  base: Definition,
  modifiers: SemanticModifiers
): EnumDefinition {
  return {
    ...base,
    kind: "enum",
    members: modifiers.members,
  };
}

function createTypeDef(
  base: Definition,
  kind: "type" | "type_alias",
  modifiers: SemanticModifiers
): TypeDefinition {
  return {
    ...base,
    kind,
    type_expression: modifiers.type_expression,
    is_generic: modifiers.is_generic,
  };
}

function createNamespaceDef(
  base: Definition,
  kind: "namespace" | "module",
  modifiers: SemanticModifiers
): NamespaceDefinition {
  return {
    ...base,
    kind,
    exported_symbols: modifiers.exported_symbols,
  };
}

/**
 * Map semantic entity to symbol kind
 */
export function map_entity_to_symbol_kind(entity: SemanticEntity): SymbolKind {
  switch (entity) {
    case SemanticEntity.FUNCTION:
      return "function";
    case SemanticEntity.CLASS:
      return "class";
    case SemanticEntity.METHOD:
      return "method";
    case SemanticEntity.CONSTRUCTOR:
      return "constructor"; // Keep constructor separate from method
    case SemanticEntity.FIELD:
      return "variable";
    case SemanticEntity.PROPERTY:
      return "variable";
    case SemanticEntity.PARAMETER:
      return "parameter";
    case SemanticEntity.CONSTANT:
      return "constant";
    case SemanticEntity.VARIABLE:
      return "variable";
    case SemanticEntity.INTERFACE:
      return "interface";
    case SemanticEntity.ENUM:
      return "enum";
    case SemanticEntity.TYPE:
      return "type";
    case SemanticEntity.TYPE_ALIAS:
      return "type_alias";
    // TypeScript-specific entities
    case SemanticEntity.ENUM_MEMBER:
      return "variable"; // Enum members are treated as variables
    case SemanticEntity.NAMESPACE:
      return "namespace";
    case SemanticEntity.TYPE_PARAMETER:
      return "variable"; // Type parameters are treated as variables
    case SemanticEntity.MODULE:
      return "namespace"; // Modules are similar to namespaces
    case SemanticEntity.MACRO:
      return "function"; // Macros are compile-time functions
    default:
      // Log unknown entities for debugging
      console.warn(
        `Unknown semantic entity: ${entity}, defaulting to 'variable'`
      );
      return "variable";
  }
}

/**
 * Check if entity is hoisted (language-specific rules)
 */
function determine_symbol_availability(
  entity: SemanticEntity,
  modifiers: SemanticModifiers,
  _language?: Language
): SymbolAvailability {
  // TODO: improve this with the use of scope information. TODO: also, downstream clients of this ('export' processing) should calculate the visibility based on the scope
  // Check if symbol is exported (from modifiers or entity type)
  const is_exported =
    modifiers.is_exported ||
    entity === SemanticEntity.EXPORTED_FUNCTION ||
    entity === SemanticEntity.EXPORTED_CLASS;

  // Default to file-private, upgrade to file-export if exported
  return {
    scope: is_exported ? "file-export" : "file-private",
    // Export metadata will be filled by export extraction phase
  };
}

/**
 * Check if entity is hoisted (language-specific rules)
 */
function is_symbol_hoisted(
  entity: SemanticEntity,
  language?: Language
): boolean {
  // Python hoisting rules
  if (language === "python") {
    return (
      entity === SemanticEntity.FUNCTION || entity === SemanticEntity.CLASS
      // Python variables are NOT hoisted - must be defined before use
    );
  }

  // Rust hoisting rules
  if (language === "rust") {
    return (
      entity === SemanticEntity.FUNCTION ||
      entity === SemanticEntity.CLASS || // structs, enums
      entity === SemanticEntity.INTERFACE || // traits
      entity === SemanticEntity.TYPE_ALIAS ||
      entity === SemanticEntity.CONSTANT ||
      entity === SemanticEntity.MODULE ||
      entity === SemanticEntity.MACRO // Macros are hoisted and available throughout their scope
      // Rust variables (let bindings) are NOT hoisted - must be defined before use
      // Static items are hoisted but handled separately
    );
  }

  // JavaScript/TypeScript hoisting rules (default)
  return (
    entity === SemanticEntity.FUNCTION ||
    entity === SemanticEntity.CLASS ||
    entity === SemanticEntity.VARIABLE // var declarations are hoisted in JS
  );
}

/**
 * Get hoist target scope
 */
function get_hoist_target(
  scope: LexicalScope,
  kind: SymbolKind,
  scopes: Map<ScopeId, LexicalScope>
): LexicalScope {
  if (kind === "function" || kind === "class" || kind === "variable") {
    // Hoist to nearest function or module scope
    let current: LexicalScope | null = scope;
    const visited = new Set<ScopeId>(); // Prevent infinite loops

    while (
      current &&
      !visited.has(current.id) &&
      !["module", "function", "method", "constructor"].includes(current.type)
    ) {
      visited.add(current.id);
      const parent_id: ScopeId | null = current.parent_id;
      current = parent_id ? scopes.get(parent_id) || null : null;
    }
    return current || scope;
  }
  return scope;
}

/**
 * Create symbol ID based on kind
 */
function create_symbol_id(
  name: SymbolName,
  kind: SymbolKind,
  location: Location
): SymbolId {
  switch (kind) {
    case "function":
      return function_symbol(name, location);
    case "class":
      return class_symbol(name, location);
    case "method":
    case "constructor":
      // Use location info to create a unique method identifier
      // The class name will be determined later in the member relationship pass
      return method_symbol(name, location);
    case "parameter":
      // Parameters need unique IDs to distinguish from parameter properties (which are variables)
      return parameter_symbol(name, location);
    default:
      return variable_symbol(name, location);
  }
}
