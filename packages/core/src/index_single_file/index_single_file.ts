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
} from "./scopes/scopes";
import { process_references } from "./references/references";
import { node_to_location } from "./index_single_file.node_utils";
import {
  DefinitionBuilder,
  type BuilderResult,
} from "./definitions/definitions";
import type { MetadataExtractors } from "./query_code_tree/metadata_extractors";
import {
  get_handler_registry,
  type HandlerRegistry,
} from "./query_code_tree/capture_handlers";
import {
  JAVASCRIPT_METADATA_EXTRACTORS,
  TYPESCRIPT_METADATA_EXTRACTORS,
  PYTHON_METADATA_EXTRACTORS,
  RUST_METADATA_EXTRACTORS,
} from "./query_code_tree/metadata_extractors";
import { ParsedFile } from "./index_single_file.file_utils";

/**
 * Semantic Index - Single-file analysis results
 * Import/Export union types are created during cross-file resolution in symbol_resolution.ts
 */
export interface SemanticIndex {
  readonly file_path: FilePath;
  readonly language: Language;
  readonly root_scope_id: ScopeId;

  /** Scope data */
  readonly scopes: ReadonlyMap<ScopeId, LexicalScope>;

  /** Definitions */
  readonly functions: ReadonlyMap<SymbolId, FunctionDefinition>;
  readonly classes: ReadonlyMap<SymbolId, ClassDefinition>;
  readonly variables: ReadonlyMap<SymbolId, VariableDefinition>;
  readonly interfaces: ReadonlyMap<SymbolId, InterfaceDefinition>;
  readonly enums: ReadonlyMap<SymbolId, EnumDefinition>;
  readonly namespaces: ReadonlyMap<SymbolId, NamespaceDefinition>;
  readonly types: ReadonlyMap<SymbolId, TypeAliasDefinition>;
  readonly imported_symbols: ReadonlyMap<SymbolId, ImportDefinition>;

  /** References */
  readonly references: readonly SymbolReference[];
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Build semantic index for a file
 */
export function build_index_single_file(
  file: ParsedFile,
  tree: Tree,
  language: Language
): SemanticIndex {
  // PASS 1: Query tree-sitter for captures
  const captures: QueryCapture[] = query_tree(language, tree);

  // Filter out captures starting with underscore (anonymous captures for predicates)
  const filtered_captures = captures.filter((c) => !c.name.startsWith("_"));

  // Convert QueryCapture to CaptureNode
  const capture_nodes: CaptureNode[] = filtered_captures.map((c) => {
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

  // PASS 3: Process definitions with language-specific handler registry
  // Returns categorized maps (single-file only)
  const handler_registry = get_handler_registry(language);
  const builder_result = process_definitions(context, handler_registry);

  // PASS 4: Process references with language-specific metadata extractors
  const metadata_extractors = get_metadata_extractors(language);
  const all_references = process_references(
    context,
    metadata_extractors,
    file.file_path
  );

  // Return complete semantic index (single-file)
  // Note: scope_to_definitions has been moved to DefinitionRegistry
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
  };
}

// ============================================================================
// Language Configuration Router
// ============================================================================

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
 * Process captures with language-specific handler registry
 * Returns categorized definitions (single-file only)
 */
function process_definitions(
  context: ProcessingContext,
  registry: HandlerRegistry
): BuilderResult {
  const builder = new DefinitionBuilder(context);

  // PASS 1: Process all definitions (classes, methods, functions, etc.)
  // Exclude decorators which need to be processed after their targets exist
  for (const capture of context.captures) {
    // Skip decorator captures in first pass
    if (capture.name.startsWith("decorator.")) {
      continue;
    }

    const handler = registry[capture.name];
    if (handler) {
      handler(capture, builder, context);
    }
  }

  // PASS 2: Process decorators after all definitions exist
  for (const capture of context.captures) {
    // Only process decorator captures in second pass
    if (!capture.name.startsWith("decorator.")) {
      continue;
    }

    const handler = registry[capture.name];
    if (handler) {
      handler(capture, builder, context);
    }
  }

  return builder.build();
}

/**
 * Processing context with precomputed depths for efficient scope lookups
 */

export interface ProcessingContext {
  /** All captures in the file */
  captures: readonly CaptureNode[];
  /** All scopes in the file */
  scopes: ReadonlyMap<ScopeId, LexicalScope>;
  /** Precomputed depth for each scope */
  scope_depths: ReadonlyMap<ScopeId, number>;
  /** Root scope ID (module/global scope) */
  root_scope_id: ScopeId;
  /** Find the deepest scope containing a location */
  get_scope_id(location: Location): ScopeId;
  get_child_scope_with_symbol_name(
    scope_id: ScopeId,
    name: SymbolName
  ): ScopeId;
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
  ANONYMOUS_FUNCTION = "anonymous_function",

  // Imports/Exports
  REEXPORT = "reexport",

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
  WRITE = "write", // Variable write/assignment

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
