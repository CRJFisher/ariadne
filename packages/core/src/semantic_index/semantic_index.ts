/**
 * Semantic Index - Main orchestration
 */

import type { Tree } from "tree-sitter";
import type {
  FilePath,
  Language,
  SymbolId,
  SymbolDefinition,
  SymbolName,
  ScopeId,
  LexicalScope,
  Import,
  Export,
} from "@ariadnejs/types";

import { Query } from "tree-sitter";
import { build_scope_tree } from "./scope_tree";
import { process_definitions } from "./definitions";
import { process_imports } from "./imports";
import { process_exports } from "./exports";
import { process_references } from "./references";
import {
  normalize_captures,
  group_captures_by_category,
} from "./capture_normalizer";
import { LANGUAGE_TO_TREESITTER_LANG, load_query } from "./query_loader";
import { NormalizedCapture } from "./capture_types";


/**
 * Complete semantic index for a file
 * Core data structure for symbol resolution and call chain analysis
 */
export interface SemanticIndex {
  /** File being indexed */
  readonly file_path: FilePath;

  /** Language for language-specific resolution */
  readonly language: Language;

  /** Root scope ID (module/global scope) */
  readonly root_scope_id: ScopeId;

  /** All scopes in the file */
  readonly scopes: ReadonlyMap<ScopeId, LexicalScope>;

  /** All symbols in the file */
  readonly symbols: ReadonlyMap<SymbolId, SymbolDefinition>;

  /** All processed references with specialized type information */
  readonly references: any; // ProcessedReferences from the core package

  /** Module imports */
  readonly imports: readonly Import[];

  /** Module exports */
  readonly exports: readonly Export[];

  /** Quick lookup: name -> symbols with that name */
  readonly file_symbols_by_name: ReadonlyMap<
    FilePath,
    ReadonlyMap<SymbolName, SymbolId>
  >;
}

/**
 * Cross-file semantic index
 * Aggregates multiple file indices for project-wide resolution
 */
export interface ProjectSemanticIndex {
  /** All indexed files */
  readonly files: ReadonlyMap<FilePath, SemanticIndex>;

  /** Global symbol table (exported symbols only) */
  readonly global_symbols: ReadonlyMap<SymbolId, SymbolDefinition>;

  /** Module dependency graph */
  readonly import_graph: ReadonlyMap<FilePath, readonly FilePath[]>;

  /** Export graph (who exports what) */
  readonly export_graph: ReadonlyMap<
    FilePath,
    ReadonlyMap<SymbolName, SymbolId>
  >;
}


/**
 * Build semantic index for a file
 */
export function build_semantic_index(
  file_path: FilePath,
  tree: Tree,
  lang: Language
): SemanticIndex {
  // Get raw captures from tree-sitter
  const grouped = query_tree_and_parse_captures(lang, tree, file_path);

  // Phase 1: Build scope tree
  const { root_scope, scopes } = build_scope_tree(
    grouped.scopes,
    tree,
    file_path,
    lang
  );

  // Phase 2: Process definitions
  const { symbols, file_symbols_by_name } = process_definitions(
    grouped.definitions,
    root_scope,
    scopes,
    file_path
  );

  // Build scope-to-symbol mapping for function/method/class scopes
  const scope_to_symbol = build_scope_to_symbol_map(scopes, symbols);

  // Phase 3: Process imports
  const imports = process_imports(
    grouped.imports,
    root_scope,
    symbols,
    file_path,
    lang
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
  const references = process_references(
    grouped.references,
    root_scope,
    scopes,
    file_path,
    grouped.assignments,
    grouped.types,
    grouped.returns,
    scope_to_symbol
  );

  // Process class inheritance and static modifiers
  process_class_metadata(grouped.types, symbols);

  return {
    file_path,
    language: lang,
    root_scope_id: root_scope.id,
    scopes,
    symbols,
    references,
    imports,
    exports,
    file_symbols_by_name,
  };
}

/**
 * Process class metadata (inheritance, static members)
 */
function process_class_metadata(
  type_captures: NormalizedCapture[],
  symbols: Map<SymbolId, SymbolDefinition>
): void {
  // Find class inheritance relationships
  for (const capture of type_captures) {
    if (capture.context?.extends_class) {
      // Find the class symbol at this location
      for (const [, symbol] of symbols) {
        if (
          symbol.kind === "class" &&
          symbol.location.line === capture.node_location.line &&
          symbol.location.file_path === capture.node_location.file_path
        ) {
          symbols.set(symbol.id, {
            ...symbol,
            extends_class: capture.context.extends_class as SymbolName,
          });
          break;
        }
      }
    }
  }
}

/**
 * Build mapping from scope IDs to their defining symbol IDs
 * This allows us to find which symbol created a given scope
 */
function build_scope_to_symbol_map(
  scopes: Map<ScopeId, LexicalScope>,
  symbols: Map<SymbolId, SymbolDefinition>
): Map<ScopeId, SymbolId> {
  const scope_to_symbol = new Map<ScopeId, SymbolId>();

  // For each symbol that creates a scope, find its scope
  for (const [symbol_id, symbol] of symbols) {
    if (
      symbol.kind === "function" ||
      symbol.kind === "method" ||
      symbol.kind === "class"
    ) {
      // Find scope with matching location
      for (const [scope_id, scope] of scopes) {
        if (
          scope.location.line === symbol.location.line &&
          scope.location.column === symbol.location.column &&
          scope.location.file_path === symbol.location.file_path &&
          (scope.type === "function" ||
            scope.type === "method" ||
            scope.type === "constructor" ||
            scope.type === "class")
        ) {
          scope_to_symbol.set(scope_id, symbol_id);
          break;
        }
      }
    }
  }

  return scope_to_symbol;
}

/**
 * Query tree and parse captures into normalized semantic categories
 * Returns grouped normalized captures for testing and use
 */
export function query_tree_and_parse_captures(
  lang: Language,
  tree: Tree,
  file_path: FilePath
) {
  const query_string = load_query(lang);
  const query = new Query(LANGUAGE_TO_TREESITTER_LANG.get(lang), query_string);
  const captures = query.captures(tree.rootNode);

  // Normalize captures to common semantic format
  const normalized = normalize_captures(captures, lang, file_path);

  // Group by category and return
  return group_captures_by_category(normalized);
}
