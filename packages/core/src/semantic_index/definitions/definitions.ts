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
} from "@ariadnejs/types";
import {
  function_symbol,
  class_symbol,
  method_symbol,
  variable_symbol,
} from "@ariadnejs/types";
import { node_to_location } from "../../ast/node_utils";
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
  symbols_by_name: Map<SymbolName, SymbolId[]>;
} {
  const symbols = new Map<SymbolId, SymbolDefinition>();
  const symbols_by_name = new Map<SymbolName, SymbolId[]>();

  for (const capture of def_captures) {
    const scope = find_containing_scope(capture.node, root_scope, scopes, file_path);
    const name = capture.text as SymbolName;
    const kind = map_entity_to_symbol_kind(capture.entity);
    const is_hoisted = check_is_hoisted_entity(capture.entity, capture.modifiers);
    const def_scope = is_hoisted ? get_hoist_target(scope, kind, scopes) : scope;
    const location = node_to_location(capture.node, file_path);

    // Create symbol ID
    const symbol_id = create_symbol_id(name, kind, location);

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
    };

    // Store symbol
    symbols.set(symbol_id, symbol);
    (def_scope.symbols as Map<SymbolName, SymbolDefinition>).set(name, symbol);

    // Update name index
    if (!symbols_by_name.has(name)) {
      symbols_by_name.set(name, []);
    }
    symbols_by_name.get(name)!.push(symbol_id);
  }

  return { symbols, symbols_by_name };
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
      return "property" as SymbolKind;
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
function check_is_hoisted_entity(entity: SemanticEntity, modifiers: any): boolean {
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
      const parent_id = current.parent_id;
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