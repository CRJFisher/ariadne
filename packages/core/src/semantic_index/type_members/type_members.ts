/**
 * Type Members - Collect and organize type members
 *
 * Extracts methods, properties, and fields from class definitions
 * and builds member maps for type resolution.
 */

import type {
  SymbolId,
  SymbolName,
  TypeId,
  Location,
  SymbolDefinition,
  ScopeId,
  LexicalScope,
} from "@ariadnejs/types";
import type {
  TypeMemberMap,
  MemberInfo,
  InheritanceInfo,
  ParameterInfo,
} from "../type_registry/type_registry";

/**
 * Collect all type members from symbols
 */
export function collect_type_members(
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>,
  scopes: ReadonlyMap<ScopeId, LexicalScope>
): TypeMemberMap {
  const instance_members = new Map<TypeId, Map<SymbolName, MemberInfo>>();
  const static_members = new Map<TypeId, Map<SymbolName, MemberInfo>>();
  const constructors = new Map<TypeId, MemberInfo>();
  const inheritance = new Map<TypeId, InheritanceInfo>();

  // First pass: identify all types and create their member maps
  for (const [symbol_id, symbol] of symbols) {
    if (symbol.kind === "class" || symbol.kind === "interface") {
      const type_id = symbol.type_id || create_type_id_from_symbol(symbol);
      if (!type_id) {
        continue;
      }
      instance_members.set(type_id, new Map());
      static_members.set(type_id, new Map());

      // Set up inheritance info
      const inheritance_info = create_inheritance_info(symbol, symbols);
      inheritance.set(type_id, inheritance_info);
    }
  }

  // Second pass: collect members
  for (const [symbol_id, symbol] of symbols) {
    if (symbol.member_of) {
      const member_info = create_member_info(symbol, symbols);

      if (symbol.is_static) {
        const static_map = static_members.get(symbol.member_of);
        if (static_map) {
          static_map.set(symbol.name, member_info);
        }
      } else {
        const instance_map = instance_members.get(symbol.member_of);
        if (instance_map) {
          instance_map.set(symbol.name, member_info);
        }
      }

      // Special handling for constructors
      if (symbol.kind === "constructor") {
        constructors.set(symbol.member_of, member_info);
      }
    }
  }

  // Third pass: collect members from lexical scope relationships
  collect_members_from_scopes(
    symbols,
    scopes,
    instance_members,
    static_members,
    constructors
  );

  // Fourth pass: resolve inheritance chains and collect inherited members
  resolve_inheritance_members(inheritance, instance_members, static_members);

  return {
    instance_members,
    static_members,
    constructors,
    inheritance,
  };
}

/**
 * Create member info from a symbol
 */
function create_member_info(
  symbol: SymbolDefinition,
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>
): MemberInfo {
  let member_type: MemberInfo["member_type"];

  switch (symbol.kind) {
    case "method":
      member_type = "method";
      break;
    case "constructor":
      member_type = "constructor";
      break;
    case "variable":
    case "constant":
      member_type = symbol.is_static ? "property" : "field";
      break;
    default:
      member_type = "property";
  }

  // Extract parameters for methods/constructors
  const parameters = extract_parameters(symbol, symbols);

  return {
    symbol_id: symbol.id,
    name: symbol.name,
    member_type,
    return_type: symbol.return_type,
    value_type: symbol.value_type,
    is_static: symbol.is_static || false,
    is_private: false, // Would need modifiers analysis
    is_readonly: false, // Would need modifiers analysis
    location: symbol.location,
    parameters,
  };
}

/**
 * Extract parameter information from a function/method symbol
 */
function extract_parameters(
  symbol: SymbolDefinition,
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>
): ParameterInfo[] | undefined {
  if (symbol.kind !== "method" &&
      symbol.kind !== "function" &&
      symbol.kind !== "constructor") {
    return undefined;
  }

  const parameters: ParameterInfo[] = [];

  // Look for parameter symbols in the same scope
  for (const [param_id, param] of symbols) {
    if (param.kind === "parameter" && param.scope_id === symbol.scope_id) {
      parameters.push({
        name: param.name,
        type: param.value_type,
        is_optional: false, // Would need to check for optional modifier
        is_rest: false, // Would need to check for rest parameter
        default_value: undefined, // Would need to parse default values
      });
    }
  }

  return parameters.length > 0 ? parameters : undefined;
}

/**
 * Create inheritance info for a type
 */
function create_inheritance_info(
  symbol: SymbolDefinition,
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>
): InheritanceInfo {
  const extends_type = resolve_extends_type(symbol, symbols);
  const implements_types = resolve_implements_types(symbol, symbols);
  const all_ancestors = collect_all_ancestors(
    symbol,
    symbols,
    new Set()
  );

  return {
    extends_type,
    implements_types,
    all_ancestors: Array.from(all_ancestors),
    all_members: new Map(), // Will be populated later
  };
}

/**
 * Resolve the parent type for a class
 */
function resolve_extends_type(
  symbol: SymbolDefinition,
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>
): TypeId | undefined {
  if (!symbol.extends_class) {
    return undefined;
  }

  // Find the parent class symbol
  for (const [parent_id, parent] of symbols) {
    if (parent.name === symbol.extends_class && parent.kind === "class") {
      return parent.type_id || create_type_id_from_symbol(parent);
    }
  }

  return undefined;
}

/**
 * Resolve implemented interfaces
 */
function resolve_implements_types(
  symbol: SymbolDefinition,
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>
): TypeId[] {
  if (!symbol.implements_interfaces) {
    return [];
  }

  const implements_types: TypeId[] = [];

  for (const interface_name of symbol.implements_interfaces) {
    for (const [iface_id, iface] of symbols) {
      if (iface.name === interface_name && iface.kind === "interface") {
        const type_id = iface.type_id || create_type_id_from_symbol(iface);
        if (!type_id) {
          continue;
        }
        implements_types.push(type_id);
        break;
      }
    }
  }

  return implements_types;
}

/**
 * Collect all ancestors (transitive)
 */
function collect_all_ancestors(
  symbol: SymbolDefinition,
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>,
  visited: Set<SymbolId>
): Set<TypeId> {
  const ancestors = new Set<TypeId>();

  if (visited.has(symbol.id)) {
    return ancestors;
  }
  visited.add(symbol.id);

  // Add parent class
  if (symbol.extends_class) {
    for (const [parent_id, parent] of symbols) {
      if (parent.name === symbol.extends_class && parent.kind === "class") {
        const parent_type = parent.type_id || create_type_id_from_symbol(parent);
        if (!parent_type) {
          continue;
        }
        ancestors.add(parent_type);

        // Recursively add parent's ancestors
        const parent_ancestors = collect_all_ancestors(parent, symbols, visited);
        parent_ancestors.forEach(a => ancestors.add(a));
        break;
      }
    }
  }

  // Add implemented interfaces
  if (symbol.implements_interfaces) {
    for (const interface_name of symbol.implements_interfaces) {
      for (const [iface_id, iface] of symbols) {
        if (iface.name === interface_name && iface.kind === "interface") {
          const iface_type = iface.type_id || create_type_id_from_symbol(iface);
          if (!iface_type) {
            continue;
          }
          ancestors.add(iface_type);
          break;
        }
      }
    }
  }

  return ancestors;
}

/**
 * Collect members from scope relationships
 */
function collect_members_from_scopes(
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>,
  scopes: ReadonlyMap<ScopeId, LexicalScope>,
  instance_members: Map<TypeId, Map<SymbolName, MemberInfo>>,
  static_members: Map<TypeId, Map<SymbolName, MemberInfo>>,
  constructors: Map<TypeId, MemberInfo>
): void {
  // For each class/interface symbol
  for (const [symbol_id, symbol] of symbols) {
    if (symbol.kind === "class" || symbol.kind === "interface") {
      const type_id = symbol.type_id || create_type_id_from_symbol(symbol);
      if (!type_id) {
        continue;
      }

      // Find the class scope
      const class_scope = find_scope_for_symbol(symbol, scopes);
      if (!class_scope) continue;

      // Look for members defined in the class scope
      for (const [member_name, member_symbol] of class_scope.symbols) {
        // Skip the class itself
        if (member_symbol.id === symbol_id) continue;

        const member_info = create_member_info(member_symbol, symbols);

        // Update member_of relationship
        class_scope.symbols.set(member_name, {...member_symbol, member_of: type_id});

        if (member_symbol.is_static) {
          const static_map = static_members.get(type_id);
          if (static_map) {
            static_map.set(member_name, member_info);
          }
        } else {
          const instance_map = instance_members.get(type_id);
          if (!type_id) {
            continue;
          }
          if (instance_map) {
            instance_map.set(member_name, member_info);
          }
        }

        // Special handling for constructors
        if (member_symbol.kind === "constructor" || member_name === "constructor") {
          constructors.set(type_id, member_info);
        }
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
 * Resolve inherited members for all types
 */
function resolve_inheritance_members(
  inheritance: Map<TypeId, InheritanceInfo>,
  instance_members: Map<TypeId, Map<SymbolName, MemberInfo>>,
  static_members: Map<TypeId, Map<SymbolName, MemberInfo>>
): void {
  for (const [type_id, info] of inheritance) {
    const all_members = new Map<SymbolName, MemberInfo>();

    // Start with own members
    const own_members = instance_members.get(type_id);
    if (own_members) {
      own_members.forEach((member, name) => {
        all_members.set(name, member);
      });
    }

    // Add inherited members (if not overridden)
    for (const ancestor of info.all_ancestors) {
      const ancestor_members = instance_members.get(ancestor);
      if (ancestor_members) {
        ancestor_members.forEach((member, name) => {
          if (!all_members.has(name)) {
            all_members.set(name, member);
          }
        });
      }
    }

    // Update the inheritance info with all members
    inheritance.set(type_id, {...info, all_members});
  }
}

/**
 * Find all methods on a type (including inherited)
 */
export function find_type_methods(
  type_id: TypeId,
  members: TypeMemberMap,
  include_static: boolean = false
): Map<SymbolName, MemberInfo> {
  const methods = new Map<SymbolName, MemberInfo>();

  // Get instance methods
  const instance_map = members.instance_members.get(type_id);
  if (instance_map) {
    instance_map.forEach((member, name) => {
      if (member.member_type === "method") {
        methods.set(name, member);
      }
    });
  }

  // Get static methods if requested
  if (include_static) {
    const static_map = members.static_members.get(type_id);
    if (static_map) {
      static_map.forEach((member, name) => {
        if (member.member_type === "method") {
          methods.set(name, member);
        }
      });
    }
  }

  // Include inherited methods
  const inheritance_info = members.inheritance.get(type_id);
  if (inheritance_info) {
    inheritance_info.all_members.forEach((member, name) => {
      if (member.member_type === "method" && !methods.has(name)) {
        methods.set(name, member);
      }
    });
  }

  return methods;
}

/**
 * Resolve a method on a type
 */
export function resolve_method_on_type(
  type_id: TypeId,
  method_name: SymbolName,
  members: TypeMemberMap,
  is_static: boolean = false
): MemberInfo | undefined {
  // Check appropriate member map
  const member_map = is_static
    ? members.static_members.get(type_id)
    : members.instance_members.get(type_id);

  if (member_map) {
    const member = member_map.get(method_name);
    if (member && member.member_type === "method") {
      return member;
    }
  }

  // Check inherited members if instance method
  if (!is_static) {
    const inheritance_info = members.inheritance.get(type_id);
    if (inheritance_info) {
      const inherited = inheritance_info.all_members.get(method_name);
      if (inherited && inherited.member_type === "method") {
        return inherited;
      }
    }
  }

  return undefined;
}

function create_type_id_from_symbol(symbol: SymbolDefinition): TypeId | undefined {
  throw new Error("Function not implemented.");
}
