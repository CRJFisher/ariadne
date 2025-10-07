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
  LocationKey,
  TypeMemberInfo,
  AnyDefinition,
  SymbolKind,
  Definition,
  ExportableDefinition,
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
import {
  extract_type_bindings,
  extract_constructor_bindings,
  extract_type_members,
  extract_type_alias_metadata,
} from "./type_preprocessing";

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
  readonly scope_to_definitions: ReadonlyMap<ScopeId, ReadonlyMap<SymbolKind, AnyDefinition[]>>;

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

  /** Quick lookup: export name -> exported definition */
  readonly exported_symbols: ReadonlyMap<SymbolName, AnyDefinition>;

  /**
   * Type data
   */
  readonly type_bindings: ReadonlyMap<LocationKey, SymbolName>; // location → type name (Extracted from annotations, constructors, return types)
  readonly type_members: ReadonlyMap<SymbolId, TypeMemberInfo>; // type → methods/properties (Extracted from classes, interfaces, enums)
  // TODO: this isn't used anywhere - why not?
  readonly type_alias_metadata: ReadonlyMap<SymbolId, string>; // alias → type_expression string (Extracted from TypeAliasDefinition)

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
  const scope_to_definitions = build_scope_to_definitions(builder_result);

  // PASS 5.5: Build exported symbols map
  const exported_symbols = build_exported_symbols_map(builder_result);

  // PASS 6: Extract type preprocessing data
  const type_bindings_from_defs = extract_type_bindings({
    variables: builder_result.variables,
    functions: builder_result.functions,
    classes: builder_result.classes,
    interfaces: builder_result.interfaces,
  });

  const type_bindings_from_ctors = extract_constructor_bindings(all_references);

  // Merge type bindings from definitions and constructors
  const type_bindings = new Map([
    ...type_bindings_from_defs,
    ...type_bindings_from_ctors,
  ]);

  const type_members = extract_type_members({
    classes: builder_result.classes,
    interfaces: builder_result.interfaces,
    enums: builder_result.enums,
  });

  const type_alias_metadata = extract_type_alias_metadata(builder_result.types);

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
    scope_to_definitions,
    exported_symbols,
    type_bindings,
    type_members,
    type_alias_metadata,
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
function build_scope_to_definitions(result: BuilderResult): Map<ScopeId, Map<SymbolKind, AnyDefinition[]>> {
  const index = new Map<ScopeId, Map<SymbolKind, AnyDefinition[]>>();

  const add_to_index = (def: AnyDefinition) => {
    const existing = index.get(def.defining_scope_id)?.get(def.kind) || [];
    existing.push(def);
    index.get(def.defining_scope_id)?.set(def.kind, existing);
  };

  result.functions.forEach((def) => add_to_index(def));
  result.classes.forEach((def) => add_to_index(def));
  result.variables.forEach((def) => add_to_index(def));
  result.interfaces.forEach((def) => add_to_index(def));
  result.enums.forEach((def) => add_to_index(def));
  result.namespaces.forEach((def) => add_to_index(def));
  result.types.forEach((def) => add_to_index(def));
  result.imports.forEach((def) => add_to_index(def));

  return index;
}

/**
 * Build export lookup map from all definitions
 *
 * IMPORTANT: Asserts that export names are unique within a file.
 * If two different symbols are exported with the same name, this indicates
 * a bug in the is_exported logic or a malformed source file.
 *
 * @param result - Builder result containing all definitions
 * @returns Map from export name to definition
 * @throws Error if duplicate export names are found
 */
function build_exported_symbols_map(result: BuilderResult): Map<SymbolName, AnyDefinition> {
  const map = new Map<SymbolName, AnyDefinition>();

  const add_to_map = (def: ExportableDefinition) => {
    // Only add exported symbols
    if (!def.is_exported) {
      return;
    }

    // Get the effective export name (alias or original name)
    const export_name = def.export?.export_name || def.name;

    // Check for duplicates - this should never happen
    const existing = map.get(export_name);
    if (existing) {
      throw new Error(
        `Duplicate export name "${export_name}" in file.\n` +
        `  First:  ${existing.kind} ${existing.symbol_id}\n` +
        `  Second: ${def.kind} ${def.symbol_id}\n` +
        `This indicates a bug in is_exported logic or malformed source code.`
      );
    }

    map.set(export_name, def);
  };

  // Add all exportable definition types
  result.functions.forEach(add_to_map);
  result.classes.forEach(add_to_map);
  result.variables.forEach(add_to_map);
  result.interfaces.forEach(add_to_map);
  result.enums.forEach(add_to_map);
  result.namespaces.forEach(add_to_map);
  result.types.forEach(add_to_map);

  return map;
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
  WRITE = "write",  // Variable write/assignment

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
