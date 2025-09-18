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

import { build_scope_tree } from "./scope_tree";
import { process_definitions } from "./definitions";
import { process_imports } from "./imports";
import { process_exports } from "./exports";
import { process_references } from "./references";
import type { SemanticCapture } from "./types";

/**
 * Build semantic index for a file
 */
export function build_semantic_index(
  parser_language: any, // Parser.Language type
  query_text: string,
  file_path: FilePath,
  tree: Tree,
  lang: Language
): SemanticIndex {
  // Import Query constructor from tree-sitter
  const Query = require("tree-sitter").Query;
  const query = new Query(parser_language, query_text);
  const captures = query.captures(tree.rootNode);

  // Parse captures into semantic categories
  const semantic_captures = parse_captures(captures);

  // Phase 1: Build scope tree
  const { root_scope, scopes } = build_scope_tree(
    semantic_captures.scopes,
    tree,
    file_path,
    lang
  );

  // Phase 2: Process definitions
  const { symbols, symbols_by_name } = process_definitions(
    semantic_captures.definitions,
    root_scope,
    scopes,
    file_path
  );

  // Phase 3: Process imports
  const imports = process_imports(
    semantic_captures.imports,
    root_scope,
    symbols,
    file_path
  );

  // Phase 4: Process exports
  const exports = process_exports(
    semantic_captures.exports,
    root_scope,
    symbols,
    file_path
  );

  // Phase 5: Process references with enhanced context
  const unresolved_references = process_references(
    semantic_captures.references,
    root_scope,
    scopes,
    file_path,
    semantic_captures.assignments,
    semantic_captures.methods,
    semantic_captures.returns
  );

  // Process class inheritance and static modifiers
  process_class_metadata(
    semantic_captures.classes,
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
  class_captures: SemanticCapture[],
  symbols: Map<SymbolId, SymbolDefinition>,
  _file_path: FilePath
): void {
  // Find class definitions and their extends relationships
  for (const capture of class_captures) {
    if (capture.subcategory === "extends") {
      // Find the associated class definition
      const class_node = capture.node.parent?.parent; // class_heritage -> class_declaration
      if (class_node) {
        const class_name_node = class_node.childForFieldName?.("name");
        if (class_name_node) {
          const class_name = class_name_node.text;
          // Find the class symbol and add extends information
          for (const [, symbol] of symbols) {
            if (symbol.name === class_name && symbol.kind === "class") {
              (symbol as any).extends_class = capture.text as SymbolName;
              break;
            }
          }
        }
      }
    }
  }
}

/**
 * Parse captures into semantic categories
 */
function parse_captures(captures: QueryCapture[]): {
  scopes: SemanticCapture[];
  definitions: SemanticCapture[];
  references: SemanticCapture[];
  imports: SemanticCapture[];
  exports: SemanticCapture[];
  types: SemanticCapture[];
  assignments: SemanticCapture[];
  classes: SemanticCapture[];
  methods: SemanticCapture[];
  returns: SemanticCapture[];
} {
  const result = {
    scopes: [] as SemanticCapture[],
    definitions: [] as SemanticCapture[],
    references: [] as SemanticCapture[],
    imports: [] as SemanticCapture[],
    exports: [] as SemanticCapture[],
    types: [] as SemanticCapture[],
    assignments: [] as SemanticCapture[],
    classes: [] as SemanticCapture[],
    methods: [] as SemanticCapture[],
    returns: [] as SemanticCapture[],
  };

  for (const capture of captures) {
    const parts = capture.name.split(".");
    const category = parts[0];
    const subcategory = parts[1];
    const detail = parts[2];

    const semantic: SemanticCapture = {
      name: capture.name,
      node: capture.node,
      text: capture.node.text,
      category: category as any,
      subcategory,
      detail,
    };

    switch (category) {
      case "scope":
        result.scopes.push(semantic);
        break;
      case "def":
        result.definitions.push(semantic);
        break;
      case "ref":
        result.references.push(semantic);
        break;
      case "import":
        result.imports.push(semantic);
        break;
      case "export":
        result.exports.push(semantic);
        break;
      case "type":
        result.types.push(semantic);
        break;
      case "assign":
      case "assignment":
        result.assignments.push(semantic);
        break;
      case "class":
        result.classes.push(semantic);
        break;
      case "method":
      case "method_call":
      case "constructor":
      case "constructor_call":
        result.methods.push(semantic);
        break;
      case "return":
        result.returns.push(semantic);
        break;
    }
  }

  return result;
}