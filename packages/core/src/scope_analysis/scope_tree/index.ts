/**
 * Scope tree module - Main API
 * 
 * Combines generic configuration-driven processing with
 * language-specific bespoke handlers for complete scope analysis.
 */

import { SyntaxNode } from "tree-sitter";
import { Language, ScopeTree, FilePath, ScopeNode, ScopeId, SymbolId } from "@ariadnejs/types";

// Import generic processor
import {
  build_generic_scope_tree,
  create_scope_tree,
  find_scope_at_position,
  get_scope_chain,
  find_symbol_in_scope_chain,
  get_visible_symbols,
  SCOPE_TREE_CONTEXT,
} from "./scope_tree";

// TODO: Bespoke handlers will be replaced with tree-sitter queries

// Re-export core types and functions
export {
  create_scope_tree,
  find_scope_at_position,
  get_scope_chain,
  find_symbol_in_scope_chain,
  get_visible_symbols,
  extract_variables_from_scopes,
  SCOPE_TREE_CONTEXT,
} from "./scope_tree";

// Re-export enhanced symbols functionality
export {
  EnhancedScopeSymbol,
  extract_variables_from_symbols,
} from "./enhanced_symbols";

// TODO: Configuration utilities will be replaced with tree-sitter queries

// Type alias for the new scope definition type
// TODO: This will be replaced with the proper Scope type from symbol_scope.ts
// once the exports are fixed
export type ScopeDefinition = ScopeNode;

/**
 * Create a global scope definition
 */
export function createGlobalScope(file_path: FilePath): ScopeDefinition {
  return {
    id: "scope_0" as ScopeId,
    type: "global",
    location: {
      file_path,
      line: 1,
      column: 1,
      end_line: 1,
      end_column: 1,
    },
    child_ids: [],
    symbols: new Map<SymbolId, any>(),
    metadata: {
      is_async: false,
      is_generator: false,
      visibility: "public",
    },
  };
}

/**
 * Build language-specific scope tree
 *
 * Main entry point that combines generic and bespoke processing
 */
export function build_scope_tree(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: FilePath
): ScopeDefinition {
  // TODO: Implement using new query-based system
  // See task 11.100.9 for implementation details
  return createGlobalScope(file_path);
}

/**
 * Build language-specific scope tree (legacy compatibility)
 */
export function build_language_scope_tree(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: FilePath
): ScopeDefinition {
  return build_scope_tree(root_node, source_code, language, file_path);
}

/**
 * Get bespoke handlers for a language
 * TODO: Replace with tree-sitter query-based handlers
 */
function get_bespoke_handlers(language: Language) {
  // TODO: Implement using tree-sitter queries
  return undefined;
}

/**
 * Resolve symbol in language-specific way
 * TODO: Implement language-specific resolution using tree-sitter queries
 */
export function resolve_language_symbol(
  tree: ScopeTree,
  scope_id: string,
  symbol_name: string,
  language: Language
) {
  // TODO: Implement using tree-sitter queries for language-specific resolution
  return find_symbol_in_scope_chain(tree, scope_id as ScopeId, symbol_name);
}

// TODO: Language-specific exports will be replaced with tree-sitter query-based implementations