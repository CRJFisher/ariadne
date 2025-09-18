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
import type { NormalizedCapture } from "../capture_types";

/**
 * Process imports
 */
export function process_imports(
  import_captures: NormalizedCapture[],
  root_scope: LexicalScope,
  symbols: Map<SymbolId, SymbolDefinition>,
  file_path: FilePath
): Import[] {
  const imports: Import[] = [];

  // Group captures by import statement
  for (const capture of import_captures) {
    // Get source from normalized capture context
    const source = capture.context?.source_module || "";
    const location = node_to_location(capture.node, file_path);

    // Determine import kind based on modifiers
    const kind = capture.modifiers.is_default ? "default" :
                 capture.modifiers.is_namespace ? "namespace" : "named";

    // Create import based on kind
    const import_item: NamedImport = {
      kind: "named" as const,
      source: source as FilePath,
      imports: [
        {
          name: capture.text as SymbolName,
          is_type_only: capture.modifiers.is_type_only || false,
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