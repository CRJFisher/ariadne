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
  parameter_symbol,
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
} {
  // Input validation
  if (!def_captures || !root_scope || !scopes || !file_path) {
    throw new Error("Invalid input parameters to process_definitions");
  }
  const symbols = new Map<SymbolId, SymbolDefinition>();
  const symbols_by_name = new Map<FilePath, Map<SymbolName, SymbolId>>();

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
      // Type information
      is_static: capture.modifiers?.is_static,
      is_generic: capture.modifiers?.is_generic,
      is_lifetime: capture.modifiers?.is_lifetime,
      // Function-specific modifiers
      is_const: capture.modifiers?.is_const,
      is_move: capture.modifiers?.is_move,
      returns_impl_trait: capture.modifiers?.returns_impl_trait,
      accepts_impl_trait: capture.modifiers?.accepts_impl_trait,
      is_function_pointer: capture.modifiers?.is_function_pointer,
      is_function_trait: capture.modifiers?.is_function_trait,
      is_higher_order: capture.modifiers?.is_higher_order,
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

  return {
    symbols,
    file_symbols_by_name: symbols_by_name,
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
      console.warn(`Unknown semantic entity: ${entity}, defaulting to 'variable'`);
      return "variable";
  }
}

/**
 * Check if entity is hoisted (language-specific rules)
 */
function check_is_hoisted_entity(
  entity: SemanticEntity,
  _modifiers: any,
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
