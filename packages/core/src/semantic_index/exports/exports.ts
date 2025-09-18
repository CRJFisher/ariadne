/**
 * Exports - Process export statements
 */

import type {
  FilePath,
  SymbolId,
  SymbolName,
  LexicalScope,
  SymbolDefinition,
  Export,
  Language,
  NamedExport,
} from "@ariadnejs/types";
import { variable_symbol } from "@ariadnejs/types";
import { node_to_location } from "../../ast/node_utils";
import type { NormalizedCapture } from "../capture_types";

/**
 * Process exports (explicit and implicit)
 *
 * For languages like Python, all top-level definitions are implicitly exportable.
 * For JavaScript/TypeScript, only explicit exports are processed.
 *
 * Export visibility rules:
 * - Python:
 *   - All top-level symbols are implicitly exportable
 *   - `_name` (single underscore): private by convention, but still accessible
 *   - `__name` (double underscore): name mangled in classes
 *   - `__name__` (dunder): special/magic names
 *   - `__all__` list: controls what's exported with `from module import *`
 *
 * - JavaScript/TypeScript:
 *   - Only explicitly exported symbols are accessible
 *   - No implicit exports
 *
 * Import resolution implications:
 * - `import module`: Gets reference to module, can access all exports (implicit & explicit)
 * - `from module import *`: Gets non-private exports (respects __all__ in Python)
 * - `from module import name`: Can import any exportable symbol (explicit or implicit)
 */
export function process_exports(
  export_captures: NormalizedCapture[],
  root_scope: LexicalScope,
  symbols: Map<SymbolId, SymbolDefinition>,
  file_path: FilePath,
  language: Language
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
          symbol_name,
          location,
          modifiers: [],
          is_declaration: false,
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

  // Generate implicit exports for languages that support them
  if (language === "python") {
    // Track explicitly exported symbols to avoid duplicates
    const explicitly_exported = new Set<SymbolName>(
      exports.map((e) => e.symbol_name)
    );

    // Process all top-level symbols as implicit exports
    for (const [symbol_name, symbol_ref] of root_scope.symbols) {
      // Skip if already explicitly exported
      if (explicitly_exported.has(symbol_name)) {
        continue;
      }

      // Get the full symbol definition
      const symbol = symbols.get(symbol_ref.id);
      if (!symbol) {
        continue;
      }

      // Determine modifiers based on Python conventions
      const modifiers: string[] = ["implicit"];

      // Check if it's a private symbol (starts with underscore)
      if (symbol_name.startsWith("_")) {
        modifiers.push("private");
      }

      // Check if it's a special/magic method (starts and ends with double underscore)
      if (symbol_name.startsWith("__") && symbol_name.endsWith("__")) {
        modifiers.push("magic");
      }

      // Create implicit export
      const implicit_export: NamedExport = {
        kind: "named",
        symbol: symbol_ref.id,
        symbol_name,
        exports: [
          {
            local_name: symbol_name,
            is_type_only: false,
          },
        ],
        location: symbol.location,
        modifiers,
        language: "python",
        node_type: "implicit_export",
      };

      exports.push(implicit_export);

      // Mark symbol as implicitly exported
      (symbol as any).is_exported = true;
      (symbol as any).is_implicit_export = true;
      (symbol as any).exported_as = symbol_name;
    }
  }

  return exports;
}