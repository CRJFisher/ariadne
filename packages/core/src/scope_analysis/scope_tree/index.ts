/**
 * Scope tree dispatcher
 *
 * Routes scope tree operations to language-specific implementations
 */

import { SyntaxNode } from "tree-sitter";
import { Language } from "@ariadnejs/types";
import {
  ScopeTree,
  ScopeNode,
  ScopeSymbol,
  build_scope_tree,
  find_scope_at_position,
  get_scope_chain,
  find_symbol_in_scope_chain,
  get_visible_symbols,
} from "./scope_tree";
import {
  build_javascript_scope_tree,
  resolve_javascript_symbol,
} from "./scope_tree.javascript";
import { build_typescript_scope_tree } from "./scope_tree.typescript";
import {
  build_python_scope_tree,
  resolve_python_symbol,
} from "./scope_tree.python";
import { build_rust_scope_tree, resolve_rust_symbol } from "./scope_tree.rust";

// Re-export core types and functions
export {
  ScopeTree,
  ScopeNode,
  ScopeSymbol,
  ScopeType,
  create_scope_tree,
  build_scope_tree,
  find_scope_at_position,
  get_scope_chain,
  find_symbol_in_scope_chain,
  get_visible_symbols,
} from "./scope_tree";

/**
 * Build language-specific scope tree
 */
export function build_language_scope_tree(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path?: string
): ScopeTree {
  switch (language) {
    case "javascript":
      return build_javascript_scope_tree(root_node, source_code, file_path);
    case "typescript":
      return build_typescript_scope_tree(root_node, source_code, file_path);
    case "python":
      return build_python_scope_tree(root_node, source_code, file_path);
    case "rust":
      return build_rust_scope_tree(root_node, source_code, file_path);
    default:
      return build_scope_tree(root_node, source_code, language, file_path);
  }
}
