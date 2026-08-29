/**
 * Semantic Index - Main orchestration using direct builder pattern
 */

import type { QueryCapture, Tree } from "tree-sitter";
import type {
  Language,
  SymbolName,
  SemanticIndex,
} from "@ariadnejs/types";

import { query_tree } from "./query_code_tree";
import {
  process_scopes,
  create_processing_context,
} from "./scopes/scopes";
import { process_references } from "./references/references";
import { location_from_points } from "./node_to_location";
import {
  DefinitionBuilder,
  type BuilderResult,
} from "./definitions/definition_builder";
import {
  get_handler_registry,
  type HandlerRegistry,
} from "./query_code_tree/capture_handlers";
import { get_metadata_extractors } from "./query_code_tree/metadata_extractors/metadata_extractors";
import { ParsedFile } from "./parsed_file";
import { reset_documentation_state } from "./query_code_tree/symbol_factories/documentation_state";
import {
  SemanticCategory,
  SemanticEntity,
  type CaptureNode,
} from "./capture_types";
import type { ProcessingContext } from "./scopes/processing_context";

// The corpus mean is roughly 1,272 captures per file and every one of them is
// checked against both enums, so the member lists are built once for the
// process rather than once per capture.
const SEMANTIC_CATEGORY_VALUES: ReadonlySet<string> = new Set(
  Object.values(SemanticCategory)
);
const SEMANTIC_ENTITY_VALUES: ReadonlySet<string> = new Set(
  Object.values(SemanticEntity)
);

const NEWLINE = 10;

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
  const captures: QueryCapture[] = query_tree(language, tree, file.file_path);

  // Filter out captures starting with underscore (anonymous captures for predicates)
  const filtered_captures = captures.filter((c) => !c.name.startsWith("_"));

  const line_offsets = offsets_of_lines(file.source);

  const capture_nodes: CaptureNode[] = filtered_captures.map((c) => {
    const parts = c.name.split(".");
    const category = parts[0] as SemanticCategory;
    if (!SEMANTIC_CATEGORY_VALUES.has(category)) {
      throw new Error(`Invalid category: ${category}`);
    }
    const entity = parts[1] as SemanticEntity;
    if (!SEMANTIC_ENTITY_VALUES.has(entity)) {
      throw new Error(`Invalid entity: ${entity}`);
    }

    // A capture wants both its span's text and its location, and each of the
    // two Points costs a crossing. Reading them once and slicing the parsed
    // source between them costs two crossings where asking the node for its
    // text as well costs four.
    const start = c.node.startPosition;
    const end = c.node.endPosition;

    return {
      category,
      entity,
      name: c.name,
      node: c.node,
      text: file.source.slice(
        line_offsets[start.row] + start.column,
        line_offsets[end.row] + end.column
      ) as SymbolName,
      location: location_from_points(start, end, file.file_path),
    };
  });

  // PASS 2: Build scope tree
  const { scopes, root_scope_id } = process_scopes(capture_nodes, file);
  const context = create_processing_context(scopes, root_scope_id, capture_nodes);

  // PASS 3: Process definitions with language-specific handler registry.
  // Reset documentation state to prevent cross-file contamination from prior indexing passes
  reset_documentation_state(language);
  const handler_registry = get_handler_registry(language);
  const builder_result = process_definitions(context, handler_registry);

  // PASS 4: Process references with language-specific metadata extractors
  const metadata_extractors = get_metadata_extractors(language);
  const all_references = process_references(
    context,
    metadata_extractors,
    file.file_path,
    language
  );

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

/** Where each line of the parsed source starts, indexed by row. */
function offsets_of_lines(source: string): number[] {
  const offsets = [0];
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === NEWLINE) {
      offsets.push(i + 1);
    }
  }
  return offsets;
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

  // PRE-PASS: Store all documentation captures before processing definitions.
  // Necessary because in some languages (e.g. Python) the docstring capture
  // appears AFTER its enclosing definition in document order.
  for (const capture of context.captures) {
    if (capture.name !== "definition.documentation") {
      continue;
    }
    const handler = registry[capture.name];
    if (handler) {
      handler(capture, builder, context);
    }
  }

  // PASS 1: Process all definitions (classes, methods, functions, etc.)
  // Exclude decorators which need to be processed after their targets exist.
  // Skip documentation captures already handled in the pre-pass.
  for (const capture of context.captures) {
    if (capture.name.startsWith("decorator.") || capture.name === "definition.documentation") {
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
