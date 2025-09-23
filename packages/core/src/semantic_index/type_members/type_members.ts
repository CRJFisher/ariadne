/**
 * Type Members - Extract locally-defined type members
 *
 * Extracts methods, properties, and fields directly defined in classes/interfaces
 * within a single file. Does not perform cross-file resolution or inheritance processing.
 */

import type {
  SymbolId,
  SymbolName,
  Location,
  SymbolDefinition,
  ScopeId,
  LexicalScope,
  FilePath,
  LocalMemberInfo,
  LocalParameterInfo,
} from "@ariadnejs/types";

/**
 * Local type information extracted from single file
 */
export interface LocalTypeInfo {
  readonly type_name: SymbolName;
  readonly kind: "class" | "interface" | "type" | "enum";
  readonly location: Location;
  readonly direct_members: Map<SymbolName, LocalMemberInfo>;
  readonly extends_clause?: SymbolName[];  // Just names, not resolved
  readonly implements_clause?: SymbolName[];  // Just names, not resolved
}


/**
 * Extract type members from symbols (single-file analysis only)
 */
export function extract_type_members(
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>,
  scopes: ReadonlyMap<ScopeId, LexicalScope>,
  file_path: FilePath
): LocalTypeInfo[] {
  const types: LocalTypeInfo[] = [];
  const type_symbols = new Map<SymbolId, LocalTypeInfo>();

  // First pass: identify all types and create their info objects
  for (const [symbol_id, symbol] of symbols) {
    if (symbol.kind === "class" || symbol.kind === "interface") {
      const type_info: LocalTypeInfo = {
        type_name: symbol.name,
        kind: symbol.kind,
        location: symbol.location,
        direct_members: new Map(),
        extends_clause: symbol.extends_class ? [symbol.extends_class] : undefined,
        implements_clause: symbol.implements_interfaces ? [...symbol.implements_interfaces] : undefined,
      };
      types.push(type_info);
      type_symbols.set(symbol_id, type_info);
    }
  }

  // Second pass: collect members based on members/static_members arrays
  for (const [symbol_id, symbol] of symbols) {
    if (symbol.kind === "class" || symbol.kind === "interface") {
      const type_info = type_symbols.get(symbol_id);
      if (!type_info) continue;

      // Process regular members
      if (symbol.members) {
        for (const member_id of symbol.members) {
          const member_symbol = symbols.get(member_id);
          if (member_symbol) {
            const member_info = create_local_member_info(member_symbol, symbols);
            type_info.direct_members.set(member_symbol.name, member_info);
          }
        }
      }

      // Process static members
      if (symbol.static_members) {
        for (const member_id of symbol.static_members) {
          const member_symbol = symbols.get(member_id);
          if (member_symbol) {
            const member_info = create_local_member_info(member_symbol, symbols);
            type_info.direct_members.set(member_symbol.name, member_info);
          }
        }
      }
    }
  }

  // Third pass: collect members from lexical scope relationships
  collect_direct_members_from_scopes(symbols, scopes, types, type_symbols);

  return types;
}

/**
 * Create local member info from a symbol
 */
function create_local_member_info(
  symbol: SymbolDefinition,
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>
): LocalMemberInfo {
  let kind: LocalMemberInfo["kind"];

  switch (symbol.kind) {
    case "method":
      kind = "method";
      break;
    case "constructor":
      kind = "constructor";
      break;
    case "variable":
    case "constant":
      kind = symbol.is_static ? "property" : "field";
      break;
    default:
      kind = "property";
      break;
  }

  // Extract parameters for methods/constructors
  const parameters = extract_local_parameters(symbol, symbols);

  return {
    name: symbol.name,
    kind,
    location: symbol.location,
    symbol_id: symbol.id,
    is_static: symbol.is_static,
    is_optional: false,  // Would need modifiers analysis
    type_annotation: symbol.return_type_hint,  // Use the return_type_hint field if available
    parameters,
  };
}

/**
 * Extract local parameter information from a function/method symbol
 */
function extract_local_parameters(
  symbol: SymbolDefinition,
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>
): LocalParameterInfo[] | undefined {
  if (symbol.kind !== "method" &&
      symbol.kind !== "function" &&
      symbol.kind !== "constructor") {
    return undefined;
  }

  const parameters: LocalParameterInfo[] = [];

  // Look for parameter symbols in the same scope
  for (const [param_id, param] of symbols) {
    if (param.kind === "parameter" && param.scope_id === symbol.scope_id) {
      parameters.push({
        name: param.name,
        type_annotation: undefined,  // Type annotations not available in SymbolDefinition
        is_optional: false,  // Would need to check for optional modifier
        is_rest: false,  // Would need to check for rest parameter
        default_value: undefined,  // Would need to parse default values
      });
    }
  }

  return parameters.length > 0 ? parameters : undefined;
}


/**
 * Collect direct members from scope relationships
 */
function collect_direct_members_from_scopes(
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>,
  scopes: ReadonlyMap<ScopeId, LexicalScope>,
  types: LocalTypeInfo[],
  type_symbols: Map<SymbolId, LocalTypeInfo>
): void {
  // For each class/interface symbol
  for (const [symbol_id, symbol] of symbols) {
    if (symbol.kind === "class" || symbol.kind === "interface") {
      const type_info = type_symbols.get(symbol_id);
      if (!type_info) continue;

      // Find the class scope
      const class_scope = find_scope_for_symbol(symbol, scopes);
      if (!class_scope) continue;

      // Look for members defined directly in the class scope
      for (const [member_name, member_symbol] of class_scope.symbols) {
        // Skip the class itself
        if (member_symbol.id === symbol_id) continue;

        const member_info = create_local_member_info(member_symbol, symbols);
        type_info.direct_members.set(member_name, member_info);
      }

      // ENHANCEMENT: Collect parameter properties from constructor scope
      if (symbol.kind === "class") {
        collect_parameter_property_fields(symbol_id, symbols, scopes, type_info);
      }
    }
  }
}

/**
 * Collect parameter property fields from constructor scope and add them to class members
 */
function collect_parameter_property_fields(
  class_symbol_id: SymbolId,
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>,
  scopes: ReadonlyMap<ScopeId, LexicalScope>,
  type_info: LocalTypeInfo
): void {
  // Find the constructor in this class
  let constructor_symbol: SymbolDefinition | undefined;

  for (const [symbol_id, symbol] of symbols) {
    if (symbol.kind === "constructor" &&
        symbol.name === "constructor" &&
        symbol.location.file_path === type_info.location.file_path) {
      // Check if this constructor is in the same class by examining scope relationships
      const constructor_scope = scopes.get(symbol.scope_id);
      if (constructor_scope) {
        // Look for the class symbol in parent scopes
        let current_scope = constructor_scope.parent_id ? scopes.get(constructor_scope.parent_id) : undefined;
        while (current_scope) {
          if (current_scope.symbols.has(type_info.type_name) &&
              current_scope.symbols.get(type_info.type_name)?.id === class_symbol_id) {
            constructor_symbol = symbol;
            break;
          }
          current_scope = current_scope.parent_id ? scopes.get(current_scope.parent_id) : undefined;
        }
        if (constructor_symbol) break;
      }
    }
  }

  if (!constructor_symbol) return;

  // Find the constructor scope
  const constructor_scope = scopes.get(constructor_symbol.scope_id);
  if (!constructor_scope) return;

  // Look for variable symbols in constructor scope that are parameter properties
  for (const [member_name, member_symbol] of constructor_scope.symbols) {
    if (member_symbol.kind === "variable") {
      // Check if this variable symbol represents a parameter property
      // We can identify parameter properties by their location being in constructor parameters
      // and their symbol ID containing evidence of being a parameter property
      const is_parameter_property = is_likely_parameter_property(member_symbol, constructor_symbol);

      if (is_parameter_property) {
        const member_info = create_local_member_info(member_symbol, symbols);
        // Only add if not already present (direct class members take precedence)
        if (!type_info.direct_members.has(member_name)) {
          type_info.direct_members.set(member_name, member_info);
        }
      }
    }
  }
}

/**
 * Determine if a variable symbol is likely a parameter property field
 */
function is_likely_parameter_property(
  variable_symbol: SymbolDefinition,
  constructor_symbol: SymbolDefinition
): boolean {
  // Parameter properties are variable symbols that:
  // 1. Are in the constructor scope
  // 2. Have locations that are typically in the parameter list
  // 3. May have special naming patterns from our semantic index

  // Check if the variable is located within the constructor's parameter range
  const var_line = variable_symbol.location.line;
  const constructor_line = constructor_symbol.location.line;
  const constructor_end_line = constructor_symbol.location.end_line || constructor_line;

  // Parameter properties should be defined within constructor parameter range
  return var_line >= constructor_line && var_line <= constructor_end_line;
}

/**
 * Find the scope that contains a symbol definition
 */
function find_scope_for_symbol(
  symbol: SymbolDefinition,
  scopes: ReadonlyMap<ScopeId, LexicalScope>
): LexicalScope | undefined {
  // First try the symbol's scope_id
  const direct_scope = scopes.get(symbol.scope_id);
  if (direct_scope) {
    return direct_scope;
  }

  // Look for a scope at the same location
  for (const [scope_id, scope] of scopes) {
    if (
      scope.location.line === symbol.location.line &&
      scope.location.column === symbol.location.column &&
      scope.location.file_path === symbol.location.file_path &&
      scope.type === "class"
    ) {
      return scope;
    }
  }

  return undefined;
}

/**
 * Find methods in a type (direct members only)
 */
export function find_direct_type_methods(
  type_info: LocalTypeInfo,
  include_static: boolean = false
): Map<SymbolName, LocalMemberInfo> {
  const methods = new Map<SymbolName, LocalMemberInfo>();

  type_info.direct_members.forEach((member, name) => {
    if (member.kind === "method") {
      // If include_static is false, only include non-static methods
      // If include_static is true, include all methods
      if (include_static || !member.is_static) {
        methods.set(name, member);
      }
    }
  });

  return methods;
}

/**
 * Find a specific member in a type (direct members only)
 */
export function find_direct_member(
  type_info: LocalTypeInfo,
  member_name: SymbolName
): LocalMemberInfo | undefined {
  return type_info.direct_members.get(member_name);
}
