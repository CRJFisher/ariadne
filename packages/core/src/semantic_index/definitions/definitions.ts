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
  SymbolDefinition,
  SymbolKind,
  Location,
  TypeId,
} from "@ariadnejs/types";
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
  file_path: FilePath
): {
  symbols: Map<SymbolId, SymbolDefinition>;
  file_symbols_by_name: Map<FilePath, Map<SymbolName, SymbolId>>;
  class_types: Map<SymbolId, TypeId>;
  type_symbols: Map<TypeId, SymbolId>;
} {
  const symbols = new Map<SymbolId, SymbolDefinition>();
  const symbols_by_name = new Map<FilePath, Map<SymbolName, SymbolId>>();
  const class_types = new Map<SymbolId, TypeId>();
  const type_symbols = new Map<TypeId, SymbolId>();
  const class_members = new Map<TypeId, SymbolId[]>();

  // First pass: create all symbols
  for (const capture of def_captures) {
    const location = capture.node_location;
    const scope = find_containing_scope(location, root_scope, scopes);
    const name = capture.text as SymbolName;
    const kind = map_entity_to_symbol_kind(capture.entity);
    const is_hoisted = check_is_hoisted_entity(
      capture.entity,
      capture.modifiers
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
    let member_of: TypeId | undefined;
    if ((kind === "method" || kind === "variable" || kind === "constructor") &&
        (capture.entity === SemanticEntity.METHOD ||
         capture.entity === SemanticEntity.FIELD ||
         capture.entity === SemanticEntity.PROPERTY ||
         capture.entity === SemanticEntity.CONSTRUCTOR)) {
      const class_symbol = find_containing_class(scope, scopes, symbols);
      if (class_symbol && class_symbol.type_id) {
        member_of = class_symbol.type_id;

        // Add to class members list
        if (!class_members.has(class_symbol.type_id)) {
          class_members.set(class_symbol.type_id, []);
        }
        class_members.get(class_symbol.type_id)!.push(symbol_id);
      }
    }

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
    if (!symbols_by_name.get(file_path)!.has(name)) {
      symbols_by_name.get(file_path)!.set(name, symbol_id);
    }
  }

  // Second pass: add member lists to class symbols
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

        (symbol as any).members = instance_members;
        (symbol as any).static_members = static_members;
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
    case SemanticEntity.CONSTRUCTOR:
      return "method";
    case SemanticEntity.FIELD:
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
    default:
      return "variable";
  }
}

/**
 * Check if entity is hoisted
 */
function check_is_hoisted_entity(
  entity: SemanticEntity,
  _modifiers: any
): boolean {
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
    while (
      current &&
      !["module", "function", "method", "constructor"].includes(current.type)
    ) {
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
      return function_symbol(name as any, location);
    case "class":
      return class_symbol(name, location);
    case "method":
    case "constructor":
      return method_symbol(name, "Unknown", location);
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
  _symbols: Map<SymbolId, SymbolDefinition>
): SymbolDefinition | undefined {
  let current: LexicalScope | null = scope;

  while (current) {
    if (current.type === "class") {
      // Find the class symbol in this scope's parent
      const parent = current.parent_id ? scopes.get(current.parent_id) : undefined;
      if (parent) {
        for (const [, symbol] of parent.symbols) {
          if (symbol.kind === "class" &&
              symbol.location.line === current.location.line) {
            return symbol;
          }
        }
      }
    }

    current = current.parent_id ? scopes.get(current.parent_id) || null : null;
  }

  return undefined;
}
