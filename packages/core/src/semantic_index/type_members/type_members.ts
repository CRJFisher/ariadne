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
 * Local member information
 */
export interface LocalMemberInfo {
  readonly name: SymbolName;
  readonly kind: "property" | "method" | "constructor" | "field";
  readonly location: Location;
  readonly is_static?: boolean;
  readonly is_optional?: boolean;
  readonly type_annotation?: string;  // Raw annotation text
  readonly parameters?: LocalParameterInfo[];
}

/**
 * Local parameter information
 */
export interface LocalParameterInfo {
  readonly name: SymbolName;
  readonly type_annotation?: string;  // Raw annotation text
  readonly is_optional?: boolean;
  readonly is_rest?: boolean;
  readonly default_value?: string;
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
    }
  }
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
