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
  DefaultExport,
  NamespaceExport,
  ReExport,
  NamespaceName,
} from "@ariadnejs/types";
import { variable_symbol } from "@ariadnejs/types";
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
  _file_path: FilePath,
  language: Language
): Export[] {
  const exports: Export[] = [];

  // Group captures by export statement to consolidate related captures
  const export_groups = new Map<number, NormalizedCapture[]>();
  for (const capture of export_captures) {
    // Skip captures marked to skip
    if (capture.context?.skip) {
      continue;
    }

    // Group by location line (captures from same statement should be on same line)
    const key = capture.node_location.line;
    if (!export_groups.has(key)) {
      export_groups.set(key, []);
    }
    export_groups.get(key)!.push(capture);
  }

  // Process each export statement group
  for (const captures of export_groups.values()) {
    const primary = captures[0];
    if (!primary) continue;

    const location =  primary.node_location;

    // Handle re-exports first (they are more specific than namespace exports)
    const is_reexport = captures.some(
      (c) => c.context?.is_reexport || c.modifiers?.is_reexport
    );
    if (is_reexport) {
      // Look for export_source in any capture of the group, but exclude non-reexport captures
      const source_capture = captures.find(
        (c) => c.context?.export_source && c.context?.is_reexport
      );
      const source = source_capture?.context?.export_source || "";
      const reexports =
        captures.find((c) => c.context?.reexports)?.context?.reexports || [];

      // Build re-export items from captures
      const reexport_items = reexports.map((item) => ({
        source_name: item.original as SymbolName,
        export_name: item.alias ? (item.alias as SymbolName) : undefined,
        is_type_only: false,
      }));

      // Also handle simple re-exports without aliases
      const reexport_names = captures.find((c) => c.context?.reexport_names)
        ?.context?.reexport_names;
      if (reexport_items.length === 0 && reexport_names) {
        for (const name of reexport_names) {
          reexport_items.push({
            source_name: name as SymbolName,
            export_name: undefined,
            is_type_only: false,
          });
        }
      }

      // Single re-export capture
      const single_reexport = captures.find((c) => c.context?.reexport_name);
      if (reexport_items.length === 0 && single_reexport) {
        reexport_items.push({
          source_name: single_reexport.context!.reexport_name as SymbolName,
          export_name: single_reexport.context!.reexport_alias as SymbolName,
          is_type_only: false,
        });
      }

      const reexport: ReExport = {
        kind: "reexport",
        symbol: variable_symbol("reexport", location),
        symbol_name: "reexport" as SymbolName,
        source: source as FilePath,
        exports: reexport_items,
        location,
        modifiers: [],
        language,
        node_type: "export_statement",
      };
      exports.push(reexport);
      continue;
    }

    // Handle namespace exports
    const is_namespace = captures.some(
      (c) => c.context?.is_namespace_export || c.modifiers?.is_namespace
    );
    if (is_namespace) {
      const namespace_alias = captures.find((c) => c.context?.namespace_alias)
        ?.context?.namespace_alias;
      // Look for export_source in any capture of the group
      const source =
        captures.find((c) => c.context?.export_source)?.context
          ?.export_source || "";

      const namespace_export: NamespaceExport = {
        kind: "namespace",
        symbol: variable_symbol(namespace_alias || "*", location),
        symbol_name: (namespace_alias || "*") as SymbolName,
        source: source as FilePath,
        as_name: namespace_alias as NamespaceName,
        location,
        modifiers: [],
        language,
        node_type: "export_statement",
      };
      exports.push(namespace_export);
      continue;
    }

    // Process regular exports
    for (const capture of captures) {
      const symbol_name = capture.text as SymbolName;

      // Find or create symbol ID
      const existing_symbol = root_scope.symbols.get(symbol_name);
      const symbol_id =
        existing_symbol?.id || variable_symbol(capture.text, location);

      // Check if this is a default export
      const is_default = capture.modifiers?.is_default || false;

      // Handle aliased exports
      const export_alias = capture.context?.export_alias;

      // Create export based on type
      let export_item: Export;

      if (is_default) {
        const default_export: DefaultExport = {
          kind: "default",
          symbol: symbol_id,
          symbol_name,
          location,
          modifiers: [],
          is_declaration: capture.modifiers?.is_exported || false,
          language,
          node_type: "export_statement",
        };
        export_item = default_export;
      } else {
        const named_export: NamedExport = {
          kind: "named",
          symbol: symbol_id,
          symbol_name,
          exports: [
            {
              local_name: symbol_name,
              export_name: export_alias as SymbolName,
              is_type_only: capture.modifiers?.is_type_only || false,
            },
          ],
          location,
          modifiers: [],
          language,
          node_type: "export_statement",
        };
        export_item = named_export;
      }

      exports.push(export_item);

      // Mark exported symbol if it exists
      const symbol = symbols.get(symbol_id);
      if (symbol) {
        (symbol as any).is_exported = true;
        (symbol as any).exported_as = export_alias || symbol_name;
      }
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
