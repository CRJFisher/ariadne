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
  TypeId,
  Location,
} from "@ariadnejs/types";

import { Query } from "tree-sitter";
import { build_scope_tree } from "./scope_tree";
import { process_definitions } from "./definitions";
import { process_imports } from "./imports";
import { process_exports } from "./exports";
import { process_references, ProcessedReferences } from "./references";
import {
  normalize_captures,
  group_captures_by_category,
} from "./capture_normalizer";
import { LANGUAGE_TO_TREESITTER_LANG, load_query } from "./query_loader";
import { NormalizedCapture } from "./capture_types";
import type {
  FileTypeRegistry,
  VariableTypeMap,
} from "./type_registry";
import { build_file_type_registry } from "../symbol_resolution/type_resolution";
import { extract_type_members, type LocalTypeInfo } from "./type_members";
import {
  build_variable_type_map,
  track_constructor_types,
} from "./references/type_flow_references/type_flow_references";
import type { TypeInfo } from "./references/type_tracking/type_info";


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
  readonly references: ProcessedReferences;

  /** Module imports */
  readonly imports: readonly Import[];

  /** Module exports */
  readonly exports: readonly Export[];

  /** Quick lookup: name -> symbols with that name */
  readonly file_symbols_by_name: ReadonlyMap<
    FilePath,
    ReadonlyMap<SymbolName, SymbolId>
  >;

  // Type information
  /** Type registry for the file */
  readonly type_registry: FileTypeRegistry;

  /** Local type members (single-file only) */
  readonly local_types: LocalTypeInfo[];

  /** Variable type tracking */
  readonly variable_types: VariableTypeMap;

  /** Function return types */
  readonly function_returns: ReadonlyMap<SymbolId, TypeId>;

  /** Constructor type mapping */
  readonly constructor_types: ReadonlyMap<Location, TypeId>;
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
    file_path,
    lang
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

  // Phase 6: Build type registry
  const type_registry = build_file_type_registry(symbols, file_path);

  // Phase 7: Extract local type members
  const local_types = extract_type_members(symbols, scopes, file_path);

  // Return type resolution happens in symbol_resolution module
  const function_returns = new Map<SymbolId, TypeId>();

  // Build variable type maps
  const variable_type_info = build_variable_type_map(references.type_flows);

  // Track constructor types
  // TODO: track_constructor_types expects TypeInfo, but we have TypeId
  // This needs to work with TypeId instead of TypeInfo
  const constructor_type_info = new Map<Location, TypeInfo>();
  // Commented out due to TypeInfo vs TypeId mismatch:
  // const constructor_type_info = track_constructor_types(
  //   references.type_flows,
  //   {
  //     name_to_type: type_registry.name_to_type as Map<SymbolName, TypeInfo>
  //   }
  // );

  // Convert constructor TypeInfo to TypeId
  const constructor_types = new Map<Location, TypeId>();
  // TODO: TypeInfo doesn't have type_id field - this needs redesign
  // for (const [loc, info] of constructor_type_info) {
  //   if (info.type_id) {
  //     constructor_types.set(loc, info.type_id);
  //   }
  // }

  // Create variable type map structure
  // Extract just TypeIds from the detailed info
  const variable_type_ids = new Map<Location, TypeId>();
  // TODO: VariableTypeInfo doesn't have type_id field - this needs redesign
  // for (const [loc, info] of variable_type_info) {
  //   if (info.type_id) {
  //     variable_type_ids.set(loc, info.type_id);
  //   }
  // }

  const variable_types: VariableTypeMap = {
    variable_type_info,
    variable_types: variable_type_ids,
    reassignments: new Map(),
    scope_variables: new Map(),
  };

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
    // Type information
    type_registry,
    local_types,
    variable_types,
    function_returns,
    constructor_types,
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
  const parser = LANGUAGE_TO_TREESITTER_LANG.get(lang);
  if (!parser) {
    throw new Error(`No tree-sitter parser found for language: ${lang}`);
  }
  const query = new Query(parser, query_string);
  const captures = query.captures(tree.rootNode);

  // Normalize captures to common semantic format
  const normalized = normalize_captures(captures, lang, file_path);

  // Group by category and return
  return group_captures_by_category(normalized);
}
