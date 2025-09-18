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
import type { SemanticCapture } from "../types";

/**
 * Process symbol definitions
 */
export function process_definitions(
  def_captures: SemanticCapture[],
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
    const kind = get_symbol_kind(capture.subcategory || "");
    const is_hoisted = check_is_hoisted(kind, capture);
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
 * Get symbol kind from capture subcategory
 */
export function get_symbol_kind(subcategory: string): SymbolKind {
  switch (subcategory) {
    case "function":
      return "function";
    case "class":
      return "class";
    case "method":
    case "constructor":
    case "accessor":
      return "method";
    case "field":
    case "param":
    case "catch_param":
      return "parameter";
    case "const":
      return "constant";
    case "let":
    case "var":
    case "loop_var":
      return "variable";
    case "interface":
      return "interface";
    case "enum":
      return "enum";
    case "type_alias":
      return "type_alias";
    default:
      return "variable";
  }
}

/**
 * Check if symbol is hoisted
 */
function check_is_hoisted(kind: SymbolKind, capture: SemanticCapture): boolean {
  return (
    kind === "function" ||
    kind === "class" ||
    (kind === "variable" && capture.subcategory === "var")
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