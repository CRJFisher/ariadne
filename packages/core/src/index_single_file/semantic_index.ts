/**
 * Semantic Index - Main orchestration
 */

import type { Tree } from "tree-sitter";
import type {
  FilePath,
  Language,
  SymbolId,
  AnyDefinition,
  ImportDefinition,
  SymbolName,
  ScopeId,
  LexicalScope,
  Import,
  Export,
  FunctionDefinition,
  ClassDefinition,
  VariableDefinition,
  InterfaceDefinition,
  EnumDefinition,
  NamespaceDefinition,
} from "@ariadnejs/types";

import { build_scope_tree } from "./scope_tree";
import { process_definitions } from "./definitions";
import { process_imports } from "./definitions/imports";
import { process_exports } from "./definitions/exports";
import { process_references, ProcessedReferences } from "./references";
import { NormalizedCapture } from "./parse_and_query_code/capture_types";
import {
  extract_type_members,
  type LocalTypeInfo,
} from "./definitions/type_members";
import {
  extract_type_tracking,
  type LocalTypeTracking,
} from "./references/type_tracking";
import {
  process_type_annotations,
  type LocalTypeAnnotation,
} from "./references/type_annotation_references";
import {
  extract_type_flow,
  type LocalTypeFlowData,
} from "./references/type_flow_references";
import { query_tree_and_parse_captures } from "./parse_and_query_code";

/**
 * Semantic Index - Single-file analysis results
 *
 * Contains only local, single-file information extracted
 * without any cross-file resolution.
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

  /** Symbol definitions by type */
  readonly functions: ReadonlyMap<SymbolId, FunctionDefinition>;
  readonly classes: ReadonlyMap<SymbolId, ClassDefinition>;
  readonly variables: ReadonlyMap<SymbolId, VariableDefinition>;
  readonly interfaces: ReadonlyMap<SymbolId, InterfaceDefinition>;
  readonly enums: ReadonlyMap<SymbolId, EnumDefinition>;
  readonly namespaces: ReadonlyMap<SymbolId, NamespaceDefinition>;
  readonly imported_symbols: ReadonlyMap<SymbolId, ImportDefinition>;

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

  // Local type extractions (single-file only, unresolved)
  /** Local type definitions with direct members only */
  readonly local_types: LocalTypeInfo[];

  /** Local type annotations as syntax strings */
  readonly local_type_annotations: LocalTypeAnnotation[];

  /** Local type tracking (variable declarations and assignments) */
  readonly local_type_tracking: LocalTypeTracking;

  /** Local type flow (constructor calls and assignment patterns) */
  readonly local_type_flow: LocalTypeFlowData;
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
  const {
    functions,
    classes,
    variables,
    interfaces,
    enums,
    types,
    namespaces,
    file_symbols_by_name,
  } = process_definitions(
    grouped.definitions,
    root_scope,
    scopes,
    file_path,
    lang
  );

  // Build scope-to-symbol mapping for function/class scopes
  const scope_to_symbol = build_scope_to_symbol_map(scopes, functions, classes);

  // Phase 3: Process imports
  const { imports, imported_symbols } = process_imports(
    grouped.imports,
    root_scope,
    file_path,
    lang
  );

  // Phase 4: Process exports
  // Needs to look up any symbol type, so create a combined read-only view
  const allSymbols = new Map<SymbolId, AnyDefinition>([
    ...functions,
    ...classes,
    ...variables,
    ...interfaces,
    ...enums,
    // ...types,
    ...namespaces,
  ]);

  const exports = process_exports(
    grouped.exports,
    root_scope,
    allSymbols,
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
  process_class_metadata(grouped.types, classes);

  // Phase 6: Extract local type members (single-file only)
  const local_types = extract_type_members(
    classes,
    interfaces,
    types,
    enums,
    scopes,
    file_path,
    grouped.definitions,
    grouped.types
  );

  // Phase 7: Extract type annotations (unresolved)
  const local_type_annotations = process_type_annotations(
    grouped.types,
    root_scope,
    scopes,
    file_path
  );

  // Phase 8: Extract type tracking (unresolved)
  const local_type_tracking = extract_type_tracking(
    grouped.assignments,
    scopes,
    file_path
  );

  // Phase 9: Extract type flow patterns (unresolved)
  // Combine relevant captures for type flow analysis
  const type_flow_captures = [
    ...grouped.types,
    ...grouped.assignments,
    ...grouped.returns,
  ];
  const local_type_flow = extract_type_flow(type_flow_captures, scopes);

  return {
    file_path,
    language: lang,
    root_scope_id: root_scope.id,
    scopes,
    functions,
    classes,
    variables,
    interfaces,
    enums,
    namespaces,
    imported_symbols,
    references,
    imports,
    exports,
    file_symbols_by_name,
    // Local type extractions
    local_types,
    local_type_annotations,
    local_type_tracking,
    local_type_flow,
  };
}

/**
 * Process class metadata (inheritance, static members)
 */
function process_class_metadata(
  type_captures: NormalizedCapture[],
  classes: Map<SymbolId, ClassDefinition>
): void {
  // Find class inheritance relationships
  for (const capture of type_captures) {
    if (capture.context?.extends_class) {
      // Find the class symbol at this location
      for (const [symbol_id, symbol] of classes) {
        if (
          symbol.location.line === capture.node_location.line &&
          symbol.location.file_path === capture.node_location.file_path
        ) {
          // Update the class definition with inheritance info
          const updatedClass: ClassDefinition = {
            ...symbol,
            extends_class: capture.context.extends_class as SymbolName,
          };
          classes.set(symbol_id, updatedClass);
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
  functions: Map<SymbolId, FunctionDefinition>,
  classes: Map<SymbolId, ClassDef>
): Map<ScopeId, SymbolId> {
  const scope_to_symbol = new Map<ScopeId, SymbolId>();

  // Check functions
  for (const [symbol_id, symbol] of functions) {
    for (const [scope_id, scope] of scopes) {
      if (
        scope.location.line === symbol.location.line &&
        scope.location.column === symbol.location.column &&
        scope.location.file_path === symbol.location.file_path &&
        scope.type === "function"
      ) {
        scope_to_symbol.set(scope_id, symbol_id);
        break;
      }
    }
  }

  // Check classes
  for (const [symbol_id, symbol] of classes) {
    for (const [scope_id, scope] of scopes) {
      if (
        scope.location.line === symbol.location.line &&
        scope.location.column === symbol.location.column &&
        scope.location.file_path === symbol.location.file_path &&
        scope.type === "class"
      ) {
        scope_to_symbol.set(scope_id, symbol_id);
        break;
      }
    }

    // Also check methods within the class
    const allMethods = [
      ...(symbol.methods || []),
      ...(symbol.static_methods || []),
    ];
    for (const method of allMethods) {
      for (const [scope_id, scope] of scopes) {
        if (
          scope.location.line === method.location.line &&
          scope.location.column === method.location.column &&
          scope.location.file_path === method.location.file_path &&
          (scope.type === "method" || scope.type === "constructor")
        ) {
          scope_to_symbol.set(scope_id, method.id);
          break;
        }
      }
    }
  }

  return scope_to_symbol;
}
