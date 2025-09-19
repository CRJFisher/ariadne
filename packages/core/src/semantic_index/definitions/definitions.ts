/**
 * Definitions - Process symbol definitions
 */

import type { SyntaxNode } from "tree-sitter";
import type {
  FilePath,
  SymbolId,
  SymbolName,
  ScopeId,
  LexicalScope,
  Location,
  TypeId,
  Language,
} from "@ariadnejs/types";
import type {
  SymbolDefinition,
  SymbolKind,
} from "@ariadnejs/types/src/semantic_index";
import {
  function_symbol,
  class_symbol,
  method_symbol,
  variable_symbol,
  defined_type_id,
  TypeCategory,
} from "@ariadnejs/types";
import { find_containing_scope } from "../scope_tree";
import type { NormalizedCapture } from "../capture_types";
import { SemanticEntity } from "../capture_types";

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
  symbols: Map<SymbolId, SymbolDefinition>;
  file_symbols_by_name: Map<FilePath, Map<SymbolName, SymbolId>>;
  class_types: Map<SymbolId, TypeId>;
  type_symbols: Map<TypeId, SymbolId>;
} {
  // Input validation
  if (!def_captures || !root_scope || !scopes || !file_path) {
    throw new Error("Invalid input parameters to process_definitions");
  }
  const symbols = new Map<SymbolId, SymbolDefinition>();
  const symbols_by_name = new Map<FilePath, Map<SymbolName, SymbolId>>();
  const class_types = new Map<SymbolId, TypeId>();
  const type_symbols = new Map<TypeId, SymbolId>();
  const class_members = new Map<TypeId, SymbolId[]>();

  // First pass: create all symbols
  for (const capture of def_captures) {
    const location = capture.node_location;
    if (!location || !capture.text) {
      continue; // Skip invalid captures
    }

    const scope = find_containing_scope(location, root_scope, scopes) || root_scope;
    const name = (capture.text || "").trim() as SymbolName;
    if (!name) {
      continue; // Skip empty names
    }
    const kind = map_entity_to_symbol_kind(capture.entity);
    const is_hoisted = check_is_hoisted_entity(
      capture.entity,
      capture.modifiers,
      language
    );
    const def_scope = is_hoisted
      ? get_hoist_target(scope, kind, scopes)
      : scope;

    // Create symbol ID
    const symbol_id = create_symbol_id(name, kind, location);

    // Create TypeId for type symbols
    let type_id: TypeId | undefined;
    if (is_type_symbol(kind)) {
      type_id = create_type_id_for_symbol(kind, name, location);
      class_types.set(symbol_id, type_id);
      type_symbols.set(type_id, symbol_id);
    }

    // For methods, fields and properties, find their containing class
    // This will be handled in the second pass after all symbols are created
    let member_of: TypeId | undefined;

    // Create symbol definition
    const symbol: SymbolDefinition = {
      id: symbol_id,
      name,
      kind,
      location,
      scope_id: def_scope.id,
      is_hoisted,
      is_exported: false,
      is_imported: false,
      references: [],
      // Type information
      type_id,
      is_static: capture.modifiers?.is_static,
      member_of,
    };

    // Store symbol
    symbols.set(symbol_id, symbol);
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

  // Second pass: establish member relationships
  const updated_symbols = new Map<SymbolId, SymbolDefinition>();

  for (const [symbol_id, symbol] of symbols) {
    if ((symbol.kind === "method" || symbol.kind === "variable" || symbol.kind === "constructor")) {
      const scope = scopes.get(symbol.scope_id);
      if (scope) {
        const class_symbol = find_containing_class(scope, scopes, symbols);
        if (class_symbol) {
          const class_type_id = class_types.get(class_symbol.id);
          if (class_type_id) {
            // Create updated symbol with member_of property
            const updated_symbol: SymbolDefinition = {
              ...symbol,
              member_of: class_type_id
            };
            updated_symbols.set(symbol_id, updated_symbol);

            // Add to class members list
            if (!class_members.has(class_type_id)) {
              class_members.set(class_type_id, []);
            }
            const members_list = class_members.get(class_type_id);
            if (members_list) {
              members_list.push(symbol_id);
            }
          }
        }
      }
    }
  }

  // Update symbols map with member relationships
  for (const [symbol_id, updated_symbol] of updated_symbols) {
    symbols.set(symbol_id, updated_symbol);
  }

  // Third pass: add member lists to class symbols
  for (const [type_id, members] of class_members) {
    const symbol_id = type_symbols.get(type_id);
    if (symbol_id) {
      const symbol = symbols.get(symbol_id);
      if (symbol) {
        // Separate static and instance members
        const instance_members: SymbolId[] = [];
        const static_members: SymbolId[] = [];

        for (const member_id of members) {
          const member = symbols.get(member_id);
          if (member) {
            if (member.is_static) {
              static_members.push(member_id);
            } else {
              instance_members.push(member_id);
            }
          }
        }

        // Create updated symbol with member lists
        const updated_symbol: SymbolDefinition = {
          ...symbol,
          members: instance_members,
          static_members: static_members
        };
        symbols.set(symbol_id, updated_symbol);
      }
    }
  }

  return {
    symbols,
    file_symbols_by_name: symbols_by_name,
    class_types,
    type_symbols,
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
    default:
      // Log unknown entities for debugging
      console.warn(`Unknown semantic entity: ${entity}, defaulting to 'variable'`);
      return "variable";
  }
}

/**
 * Check if entity is hoisted (language-specific rules)
 */
function check_is_hoisted_entity(
  entity: SemanticEntity,
  modifiers: any,
  language?: Language
): boolean {
  // Python hoisting rules
  if (language === "python") {
    return (
      entity === SemanticEntity.FUNCTION ||
      entity === SemanticEntity.CLASS
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
      entity === SemanticEntity.MODULE
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
  name: string,
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
      return method_symbol(name, `${location.file_path}:${location.line}`, location);
    default:
      return variable_symbol(name, location);
  }
}

/**
 * Check if a symbol kind represents a type
 */
function is_type_symbol(kind: SymbolKind): boolean {
  return (
    kind === "class" ||
    kind === "interface" ||
    kind === "type_alias" ||
    kind === "enum"
  );
}

/**
 * Create TypeId for a type symbol
 */
function create_type_id_for_symbol(
  kind: SymbolKind,
  name: SymbolName,
  location: Location
): TypeId {
  let category: TypeCategory.CLASS | TypeCategory.INTERFACE | TypeCategory.TYPE_ALIAS | TypeCategory.ENUM;

  switch (kind) {
    case "class":
      category = TypeCategory.CLASS;
      break;
    case "interface":
      category = TypeCategory.INTERFACE;
      break;
    case "type_alias":
      category = TypeCategory.TYPE_ALIAS;
      break;
    case "enum":
      category = TypeCategory.ENUM;
      break;
    default:
      throw new Error(`Invalid type symbol kind: ${kind}`);
  }

  return defined_type_id(category, name, location);
}

/**
 * Find the containing class symbol
 */
function find_containing_class(
  scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>,
  symbols: Map<SymbolId, SymbolDefinition>
): SymbolDefinition | undefined {
  let current: LexicalScope | null = scope;
  const visited = new Set<ScopeId>(); // Prevent infinite loops

  while (current && !visited.has(current.id)) {
    visited.add(current.id);

    if (current.type === "class") {
      // Find the class symbol in this scope's parent
      const parent = current.parent_id ? scopes.get(current.parent_id) : undefined;
      if (parent) {
        // Look for class symbol by location proximity and kind
        for (const [, symbol] of parent.symbols) {
          if (symbol.kind === "class" &&
              symbol.location.file_path === current.location.file_path &&
              Math.abs(symbol.location.line - current.location.line) <= 2) {
            return symbol;
          }
        }

        // Also check all symbols for exact location match
        for (const [, symbol] of symbols) {
          if (symbol.kind === "class" &&
              symbol.location.file_path === current.location.file_path &&
              symbol.location.line === current.location.line &&
              symbol.location.column === current.location.column) {
            return symbol;
          }
        }
      }
    }

    current = current.parent_id ? scopes.get(current.parent_id) || null : null;
  }

  return undefined;
}
