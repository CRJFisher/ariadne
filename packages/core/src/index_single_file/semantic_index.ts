/**
 * Semantic Index - Main orchestration using direct builder pattern
 */

import type { QueryCapture, SyntaxNode, Tree } from "tree-sitter";
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
  TypeAliasDefinition,
  SymbolReference,
  Location,
} from "@ariadnejs/types";

import { query_tree } from "./query_code_tree";
import {
  process_scopes,
  create_processing_context,
} from "./scopes/scope_processor";
import { process_references } from "./references/reference_builder";
import { node_to_location } from "./node_utils";
import {
  DefinitionBuilder,
  type BuilderResult,
} from "./definitions/definition_builder";
import type { LanguageBuilderConfig } from "./query_code_tree/language_configs/javascript_builder";
import type { MetadataExtractors } from "./query_code_tree/language_configs/metadata_types";
import { JAVASCRIPT_BUILDER_CONFIG } from "./query_code_tree/language_configs/javascript_builder";
import { TYPESCRIPT_BUILDER_CONFIG } from "./query_code_tree/language_configs/typescript_builder_config";
import { PYTHON_BUILDER_CONFIG } from "./query_code_tree/language_configs/python_builder_config";
import { RUST_BUILDER_CONFIG } from "./query_code_tree/language_configs/rust_builder";
import { JAVASCRIPT_METADATA_EXTRACTORS } from "./query_code_tree/language_configs/javascript_metadata";
import { TYPESCRIPT_METADATA_EXTRACTORS } from "./query_code_tree/language_configs/typescript_metadata";
import { PYTHON_METADATA_EXTRACTORS } from "./query_code_tree/language_configs/python_metadata";
import { RUST_METADATA_EXTRACTORS } from "./query_code_tree/language_configs/rust_metadata";
import { ParsedFile } from "./file_utils";

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
  readonly types: ReadonlyMap<SymbolId, TypeAliasDefinition>;

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
  const all_references = process_references(
    context,
    metadata_extractors,
    file.file_path
  );

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
function get_metadata_extractors(
  language: Language
): MetadataExtractors | undefined {
  switch (language) {
    case "javascript":
      return JAVASCRIPT_METADATA_EXTRACTORS;
    case "typescript":
      return TYPESCRIPT_METADATA_EXTRACTORS;
    case "python":
      return PYTHON_METADATA_EXTRACTORS;
    case "rust":
      return RUST_METADATA_EXTRACTORS;
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
/**
 * Processing context with precomputed depths for efficient scope lookups
 */

export interface ProcessingContext {
  /** All captures in the file */
  captures: CaptureNode[];
  /** All scopes in the file */
  scopes: Map<ScopeId, LexicalScope>;
  /** Precomputed depth for each scope */
  scope_depths: Map<ScopeId, number>;
  /** Root scope ID (module/global scope) */
  root_scope_id: ScopeId;
  /** Find the deepest scope containing a location */
  get_scope_id(location: Location): ScopeId;
}
/**
 * Capture node from tree-sitter query
 */

export interface CaptureNode {
  category: SemanticCategory;
  entity: SemanticEntity;
  name: string; // The identifier in the .scm query
  text: SymbolName; // The text of the captured node
  location: Location; // The location of the captured node
  node: SyntaxNode; // tree-sitter Node
}
/**
 * Semantic entity types (normalized across languages)
 */

export enum SemanticEntity {
  // Scopes
  MODULE = "module",
  CLASS = "class",
  FUNCTION = "function",
  METHOD = "method",
  CONSTRUCTOR = "constructor",
  BLOCK = "block",
  CLOSURE = "closure",
  INTERFACE = "interface",
  ENUM = "enum",
  NAMESPACE = "namespace",

  // Definitions
  VARIABLE = "variable",
  CONSTANT = "constant",
  PARAMETER = "parameter",
  FIELD = "field",
  PROPERTY = "property",
  TYPE_PARAMETER = "type_parameter",
  ENUM_MEMBER = "enum_member",

  // Types
  TYPE = "type",
  TYPE_ALIAS = "type_alias",
  TYPE_ANNOTATION = "type_annotation",
  TYPE_PARAMETERS = "type_parameters",
  TYPE_ASSERTION = "type_assertion",
  TYPE_CONSTRAINT = "type_constraint",
  TYPE_ARGUMENT = "type_argument",

  // References
  CALL = "call",
  MEMBER_ACCESS = "member_access",
  TYPE_REFERENCE = "type_reference",
  TYPEOF = "typeof",

  // Special
  THIS = "this",
  SUPER = "super",
  IMPORT = "import",

  // Modifiers
  ACCESS_MODIFIER = "access_modifier",
  READONLY_MODIFIER = "readonly_modifier",
  VISIBILITY = "visibility",
  MUTABILITY = "mutability",
  REFERENCE = "reference",

  // Expressions and constructs
  OPERATOR = "operator",
  ARGUMENT_LIST = "argument_list",
  LABEL = "label",
  MACRO = "macro",
}
/**
 * Core semantic categories
 */

export enum SemanticCategory {
  SCOPE = "scope",
  DEFINITION = "definition",
  REFERENCE = "reference",
  IMPORT = "import",
  EXPORT = "export",
  TYPE = "type",
  ASSIGNMENT = "assignment",
  RETURN = "return",
  DECORATOR = "decorator",
  MODIFIER = "modifier",
}
