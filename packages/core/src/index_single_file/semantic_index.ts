/**
 * Semantic Index - Main orchestration using direct builder pattern
 */

import type { QueryCapture, Tree } from "tree-sitter";
import type {
  FilePath,
  Language,
  SymbolId,
  ImportDefinition,
  SymbolName,
  ScopeId,
  LexicalScope,
  FunctionDefinition,
  ClassDefinition,
  VariableDefinition,
  InterfaceDefinition,
  EnumDefinition,
  NamespaceDefinition,
  TypeDefinition,
  SymbolReference,
} from "@ariadnejs/types";

import { query_tree } from "./query_code_tree";
import {
  CaptureNode,
  ProcessingContext,
  SemanticEntity,
  SemanticCategory,
  process_scopes,
  create_processing_context,
} from "./query_code_tree/scope_processor";
import { process_references } from "./query_code_tree/reference_builder";
import { node_to_location } from "./node_utils";
import { DefinitionBuilder, type BuilderResult } from "./definitions/definition_builder";
import type { LanguageBuilderConfig } from "./query_code_tree/language_configs/javascript_builder";
import type { MetadataExtractors } from "./query_code_tree/language_configs/metadata_types";
import { JAVASCRIPT_BUILDER_CONFIG } from "./query_code_tree/language_configs/javascript_builder";
import { TYPESCRIPT_BUILDER_CONFIG } from "./query_code_tree/language_configs/typescript_builder";
import { PYTHON_BUILDER_CONFIG } from "./query_code_tree/language_configs/python_builder";
import { RUST_BUILDER_CONFIG } from "./query_code_tree/language_configs/rust_builder";
import { JAVASCRIPT_METADATA_EXTRACTORS } from "./query_code_tree/language_configs/javascript_metadata";
import { ParsedFile } from "./file_utils";
import { extract_type_members } from "./definitions/type_members";
import { process_type_annotations } from "./references/type_annotation_references";
import { extract_type_tracking } from "./references/type_tracking";
import { extract_type_flow } from "./references/type_flow_references";

/**
 * Semantic Index - Single-file analysis results
 * Import/Export union types are created during cross-file resolution in symbol_resolution.ts
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
  readonly types: ReadonlyMap<SymbolId, TypeDefinition>;

  /** ImportDefinitions (converted to Import unions during cross-file resolution) */
  readonly imported_symbols: ReadonlyMap<SymbolId, ImportDefinition>;

  /** All symbol references */
  readonly references: readonly SymbolReference[];

  /** Quick lookup: name -> symbols with that name in this file */
  readonly symbols_by_name: ReadonlyMap<SymbolName, readonly SymbolId[]>;
}


// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Build semantic index for a file
 */
export function build_semantic_index(
  file: ParsedFile,
  tree: Tree,
  language: Language
): SemanticIndex {
  // PASS 1: Query tree-sitter for captures
  const captures: QueryCapture[] = query_tree(language, tree);

  // Convert QueryCapture to CaptureNode
  const capture_nodes: CaptureNode[] = captures.map((c) => {
    const parts = c.name.split(".");
    const category = parts[0] as SemanticCategory;
    if (!Object.values(SemanticCategory).includes(category)) {
      throw new Error(`Invalid category: ${category}`);
    }
    const entity = parts[1] as SemanticEntity;
    if (!Object.values(SemanticEntity).includes(entity)) {
      throw new Error(`Invalid entity: ${entity}`);
    }

    return {
      category,
      entity,
      name: c.name,
      node: c.node,
      text: c.node.text as SymbolName,
      location: node_to_location(c.node, file.file_path),
    };
  });

  // PASS 2: Build scope tree
  const scopes = process_scopes(capture_nodes, file);
  const context = create_processing_context(scopes, capture_nodes);

  // PASS 3: Process definitions with language-specific config
  // Returns categorized maps (single-file only)
  const language_config = get_language_config(language);
  const builder_result = process_definitions(context, language_config);

  // PASS 4: Process references with language-specific metadata extractors
  const metadata_extractors = get_metadata_extractors(language);
  const all_references = process_references(context, metadata_extractors, file.file_path);

  // PASS 5: Build name index
  const symbols_by_name = build_name_index(builder_result);

  // Return complete semantic index (single-file)
  return {
    file_path: file.file_path,
    language,
    root_scope_id: context.root_scope_id,
    scopes: context.scopes,
    functions: builder_result.functions,
    classes: builder_result.classes,
    variables: builder_result.variables,
    interfaces: builder_result.interfaces,
    enums: builder_result.enums,
    namespaces: builder_result.namespaces,
    types: builder_result.types,
    imported_symbols: builder_result.imports,
    references: all_references,
    symbols_by_name,
  };
}

// ============================================================================
// Language Configuration Router
// ============================================================================

/**
 * Get language-specific builder configuration
 */
function get_language_config(language: Language): LanguageBuilderConfig {
  switch (language) {
    case "javascript":
      return JAVASCRIPT_BUILDER_CONFIG;
    case "typescript":
      return TYPESCRIPT_BUILDER_CONFIG;
    case "python":
      return PYTHON_BUILDER_CONFIG;
    case "rust":
      return RUST_BUILDER_CONFIG;
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}

/**
 * Get language-specific metadata extractors
 *
 * JavaScript extractors work for both JavaScript and TypeScript since
 * tree-sitter-typescript is a superset of tree-sitter-javascript
 */
function get_metadata_extractors(language: Language): MetadataExtractors | undefined {
  switch (language) {
    case "javascript":
    case "typescript":
      return JAVASCRIPT_METADATA_EXTRACTORS;
    case "python":
      // TODO: Task 104.4 - Import and return python_metadata extractors
      return undefined;
    case "rust":
      // TODO: Task 104.5 - Import and return rust_metadata extractors
      return undefined;
    default:
      return undefined;
  }
}

// ============================================================================
// Processing Pipeline
// ============================================================================

/**
 * Process captures with language-specific builder config
 * Returns categorized definitions (single-file only)
 */
function process_definitions(
  context: ProcessingContext,
  config: LanguageBuilderConfig
): BuilderResult {
  const builder = new DefinitionBuilder(context);

  for (const capture of context.captures) {
    const handler = config.get(capture.name);
    if (handler) {
      handler.process(capture, builder, context);
    }
  }

  return builder.build();
}

/**
 * Build name-based lookup index from all definitions
 */
function build_name_index(result: BuilderResult): Map<SymbolName, SymbolId[]> {
  const index = new Map<SymbolName, SymbolId[]>();

  const add_to_index = (def: { symbol_id: SymbolId; name: SymbolName }) => {
    const existing = index.get(def.name) || [];
    existing.push(def.symbol_id);
    index.set(def.name, existing);
  };

  result.functions.forEach(add_to_index);
  result.classes.forEach(add_to_index);
  result.variables.forEach(add_to_index);
  result.interfaces.forEach(add_to_index);
  result.enums.forEach(add_to_index);
  result.namespaces.forEach(add_to_index);
  result.types.forEach(add_to_index);

  return index;
}
