/**
 * Imports - Process import statements
 */

import type { SyntaxNode } from "tree-sitter";
import type {
  FilePath,
  SymbolId,
  SymbolName,
  LexicalScope,
  SymbolDefinition,
  Import,
  NamedImport,
} from "@ariadnejs/types";
import { variable_symbol } from "@ariadnejs/types";
import { node_to_location } from "../../ast/node_utils";
import type { SemanticCapture } from "../types";

/**
 * Process imports
 */
export function process_imports(
  import_captures: SemanticCapture[],
  root_scope: LexicalScope,
  symbols: Map<SymbolId, SymbolDefinition>,
  file_path: FilePath
): Import[] {
  const imports: Import[] = [];

  // Group captures by import statement
  for (const capture of import_captures) {
    // Find source from parent import statement
    const import_stmt = capture.node.parent;
    const source_node = import_stmt?.childForFieldName?.("source");
    const source = source_node ? source_node.text.slice(1, -1) : "";
    const location = node_to_location(capture.node, file_path);

    // Create simple named import for now
    // TODO: Detect and handle default, namespace, and side-effect imports
    const import_item: NamedImport = {
      kind: "named",
      source: source as FilePath,
      imports: [
        {
          name: capture.text as SymbolName,
          is_type_only: false,
        },
      ],
      resolved_exports: new Map(),
      location,
      modifiers: [],
      language: "javascript",
      node_type: "import_statement",
    };

    imports.push(import_item);

    // Create symbol for imported name
    const symbol_id = variable_symbol(capture.text, location);
    const symbol: SymbolDefinition = {
      id: symbol_id,
      name: capture.text as SymbolName,
      kind: "import",
      location,
      scope_id: root_scope.id,
      is_hoisted: false,
      is_exported: false,
      is_imported: true,
      import_source: source as FilePath,
      references: [],
    };

    (root_scope.symbols as Map<SymbolName, SymbolDefinition>).set(
      capture.text as SymbolName,
      symbol
    );
    symbols.set(symbol_id, symbol);
  }

  return imports;
}