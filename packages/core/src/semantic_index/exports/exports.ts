/**
 * Exports - Process export statements
 */

import type { SyntaxNode } from "tree-sitter";
import type {
  FilePath,
  SymbolId,
  SymbolName,
  LexicalScope,
  SymbolDefinition,
  Export,
  NamedExport,
} from "@ariadnejs/types";
import { variable_symbol } from "@ariadnejs/types";
import { node_to_location } from "../../ast/node_utils";
import type { NormalizedCapture } from "../capture_types";

/**
 * Process exports
 */
export function process_exports(
  export_captures: NormalizedCapture[],
  root_scope: LexicalScope,
  symbols: Map<SymbolId, SymbolDefinition>,
  file_path: FilePath
): Export[] {
  const exports: Export[] = [];

  for (const capture of export_captures) {
    const location = node_to_location(capture.node, file_path);
    const symbol_name = capture.text as SymbolName;

    // Find or create symbol ID
    const existing_symbol = root_scope.symbols.get(symbol_name);
    const symbol_id =
      existing_symbol?.id || variable_symbol(capture.text, location);

    // Check if this is a default export from normalized capture
    const is_default = capture.modifiers?.is_default || false;

    // Create export based on type
    const export_item: Export = is_default
      ? {
          kind: "default",
          symbol: symbol_id,
          location,
          language: "javascript",
          node_type: "export_statement",
        }
      : {
          kind: "named",
          symbol: symbol_id,
          symbol_name,
          exports: [
            {
              local_name: symbol_name,
              is_type_only: false,
            },
          ],
          location,
          modifiers: [],
          language: "javascript",
          node_type: "export_statement",
        };

    exports.push(export_item);

    // Mark exported symbol if it exists
    const symbol = symbols.get(symbol_id);
    if (symbol) {
      (symbol as any).is_exported = true;
      (symbol as any).exported_as = symbol_name;
    }
  }

  return exports;
}