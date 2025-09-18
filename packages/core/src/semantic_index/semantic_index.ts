/**
 * Semantic Index - Main orchestration
 */

import type { Tree, QueryCapture } from "tree-sitter";
import type {
  FilePath,
  Language,
  SemanticIndex,
  SymbolId,
  SymbolDefinition,
  SymbolName,
} from "@ariadnejs/types";

import { Query } from "tree-sitter";
import { build_scope_tree } from "./scope_tree";
import { process_definitions } from "./definitions";
import { process_imports } from "./imports";
import { process_exports } from "./exports";
import { process_references } from "./references";
import { normalize_captures, group_captures_by_category } from "./capture_normalizer";
import { LANGUAGE_TO_TREESITTER_LANG, load_query } from "./query_loader";

/**
 * Build semantic index for a file
 */
export function build_semantic_index(
  file_path: FilePath,
  tree: Tree,
  lang: Language
): SemanticIndex {
  // Get raw captures from tree-sitter
  const grouped = query_tree_and_parse_captures(lang, tree);

  // Phase 1: Build scope tree
  const { root_scope, scopes } = build_scope_tree(
    grouped.scopes,
    tree,
    file_path,
    lang
  );

  // Phase 2: Process definitions
  const { symbols, symbols_by_name } = process_definitions(
    grouped.definitions,
    root_scope,
    scopes,
    file_path
  );

  // Phase 3: Process imports
  const imports = process_imports(
    grouped.imports,
    root_scope,
    symbols,
    file_path
  );

  // Phase 4: Process exports
  const exports = process_exports(
    grouped.exports,
    root_scope,
    symbols,
    file_path,
    lang
  );

  // Phase 5: Process references with enhanced context
  const unresolved_references = process_references(
    grouped.references,
    root_scope,
    scopes,
    file_path,
    grouped.assignments,
    grouped.types,
    grouped.returns
  );

  // Process class inheritance and static modifiers
  process_class_metadata(
    grouped.types,
    symbols,
    file_path
  );

  return {
    file_path,
    language: lang,
    root_scope_id: root_scope.id,
    scopes,
    symbols,
    unresolved_references,
    imports,
    exports,
    symbols_by_name,
  };
}

/**
 * Process class metadata (inheritance, static members)
 */
function process_class_metadata(
  type_captures: import("./capture_types").NormalizedCapture[],
  symbols: Map<SymbolId, SymbolDefinition>,
  _file_path: FilePath
): void {
  // Find class inheritance relationships
  for (const capture of type_captures) {
    if (capture.context?.extends_class) {
      // Find the associated class definition
      const class_node = capture.node.parent?.parent; // class_heritage -> class_declaration
      if (class_node) {
        const class_name_node = class_node.childForFieldName?.("name");
        if (class_name_node) {
          const class_name = class_name_node.text;
          // Find the class symbol and add extends information
          for (const [, symbol] of symbols) {
            if (symbol.name === class_name && symbol.kind === "class") {
              (symbol as any).extends_class = capture.context.extends_class as SymbolName;
              break;
            }
          }
        }
      }
    }
  }
}

/**
 * Query tree and parse captures into normalized semantic categories
 * Returns grouped normalized captures for testing and use
 */
export function query_tree_and_parse_captures(lang: Language, tree: Tree) {
  const query_string = load_query(lang);
  const query = new Query(LANGUAGE_TO_TREESITTER_LANG.get(lang), query_string);
  const captures = query.captures(tree.rootNode);

  // Normalize captures to common semantic format
  const normalized = normalize_captures(captures, lang);

  // Group by category and return
  return group_captures_by_category(normalized);
}

