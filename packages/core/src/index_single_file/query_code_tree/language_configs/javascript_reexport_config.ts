import type { SymbolName } from "@ariadnejs/types";
import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { CaptureNode } from "../../semantic_index";
import type { ProcessingContext } from "../../semantic_index";
import {
  type LanguageBuilderConfig,
  create_import_id,
  extract_export_info,
  extract_import_path,
} from "./javascript_builder";

// ============================================================================
// RE-EXPORTS - Import definitions that forward exports
// ============================================================================

export const JAVASCRIPT_REEXPORT_CONFIG: LanguageBuilderConfig = new Map([
  [
    "import.reexport",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // This handler processes the complete export_statement node
        // Extract all export_specifiers and create import definitions
        const export_stmt = capture.node;

        // export_clause is the first named child, not in a "declaration" field
        // For re-exports like: export { helper } from "./original"
        // AST: (export_statement (export_clause) source: (string))
        const export_clause = export_stmt.namedChild(0);

        if (!export_clause || export_clause.type !== "export_clause") {
          return;
        }

        // Process each export_specifier
        for (let i = 0; i < export_clause.namedChildCount; i++) {
          const specifier = export_clause.namedChild(i);
          if (!specifier || specifier.type !== "export_specifier") {
            continue;
          }

          const name_node = specifier.childForFieldName("name");
          const alias_node = specifier.childForFieldName("alias");

          if (!name_node) {
            continue;
          }

          const local_name = (alias_node?.text || name_node.text) as SymbolName;
          const original_name = alias_node ? (name_node.text as SymbolName) : undefined;

          const location = {
            file_path: capture.location.file_path,
            start_line: specifier.startPosition.row + 1,
            start_column: specifier.startPosition.column + 1,
            end_line: specifier.endPosition.row + 1,
            end_column: specifier.endPosition.column + 1,
          };

          const import_id = create_import_id({
            ...capture,
            text: local_name,
            location,
          });

          const export_info = extract_export_info(export_stmt, local_name);

          builder.add_import({
            symbol_id: import_id,
            name: local_name,
            location,
            scope_id: context.get_scope_id(location),
            import_path: extract_import_path(export_stmt),
            import_kind: "named",
            original_name,
            export: export_info.export,
          });
        }
      },
    },
  ],

  [
    "import.reexport.named.simple",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_import_id(capture);
        // Navigate up to export_statement
        let export_stmt = capture.node.parent;
        while (export_stmt && export_stmt.type !== "export_statement") {
          export_stmt = export_stmt.parent;
        }

        if (!export_stmt) {
          throw new Error("Export statement not found for re-export capture");
        }

        // Check if this export_specifier has an alias - if so, skip it
        // (it will be handled by import.reexport.named.alias handler)
        const export_specifier = capture.node.parent;
        if (export_specifier?.childForFieldName?.("alias")) {
          return; // Skip - has alias
        }

        const export_info = extract_export_info(export_stmt, capture.text);

        builder.add_import({
          symbol_id: import_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path: extract_import_path(export_stmt),
          import_kind: "named",
          original_name: undefined,
          export: export_info.export,
        });
      },
    },
  ],

  [
    "import.reexport.named",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_import_id(capture);
        // Navigate up to export_statement
        let export_stmt = capture.node.parent;
        while (export_stmt && export_stmt.type !== "export_statement") {
          export_stmt = export_stmt.parent;
        }

        if (!export_stmt) {
          throw new Error("Export statement not found for re-export capture");
        }

        const export_info = extract_export_info(export_stmt, capture.text);

        builder.add_import({
          symbol_id: import_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path: extract_import_path(export_stmt),
          import_kind: "named",
          original_name: undefined,
          export: export_info.export,
        });
      },
    },
  ],

  [
    "import.reexport.named.alias",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_import_id(capture);
        // Navigate up to export_statement
        let export_stmt = capture.node.parent;
        while (export_stmt && export_stmt.type !== "export_statement") {
          export_stmt = export_stmt.parent;
        }
        if (!export_stmt) {
          return;
        }

        // Get the original name from the export_specifier
        const export_specifier = capture.node.parent;
        const original_node = export_specifier?.childForFieldName?.("name");
        const original_name = original_node?.text as SymbolName | undefined;

        const export_info = extract_export_info(export_stmt, capture.text);

        builder.add_import({
          symbol_id: import_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path: extract_import_path(export_stmt),
          import_kind: "named",
          original_name,
          export: export_info.export,
        });
      },
    },
  ],

  [
    "import.reexport.default.original",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_import_id(capture);
        // Navigate up to export_statement
        let export_stmt = capture.node.parent;
        while (export_stmt && export_stmt.type !== "export_statement") {
          export_stmt = export_stmt.parent;
        }
        if (!export_stmt) {
          return;
        }

        // Check if there's an alias
        const export_specifier = capture.node.parent;
        const alias_node = export_specifier?.childForFieldName?.("alias");
        const local_name = alias_node?.text || "default";

        const export_info = extract_export_info(export_stmt, local_name as SymbolName);

        builder.add_import({
          symbol_id: import_id,
          name: local_name as SymbolName,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path: extract_import_path(export_stmt),
          import_kind: "default",
          original_name: undefined,
          export: export_info.export,
        });
      },
    },
  ],

  [
    "import.reexport.default.alias",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_import_id(capture);
        // Navigate up to export_statement
        let export_stmt = capture.node.parent;
        while (export_stmt && export_stmt.type !== "export_statement") {
          export_stmt = export_stmt.parent;
        }
        if (!export_stmt) {
          return;
        }

        const export_info = extract_export_info(export_stmt, capture.text);

        builder.add_import({
          symbol_id: import_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path: extract_import_path(export_stmt),
          import_kind: "default",
          original_name: "default" as SymbolName,
          export: export_info.export,
        });
      },
    },
  ],

  [
    "import.reexport.as_default.alias",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_import_id(capture);
        // Navigate up to export_statement
        let export_stmt = capture.node.parent;
        while (export_stmt && export_stmt.type !== "export_statement") {
          export_stmt = export_stmt.parent;
        }
        if (!export_stmt) {
          return;
        }

        // Get the original name from the export_specifier
        const export_specifier = capture.node.parent;
        const original_node = export_specifier?.childForFieldName?.("name");
        const original_name = original_node?.text as SymbolName | undefined;

        const export_info = extract_export_info(export_stmt, capture.text);

        builder.add_import({
          symbol_id: import_id,
          name: original_name || capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path: extract_import_path(export_stmt),
          import_kind: "named",
          original_name: undefined,
          export: export_info.export,
        });
      },
    },
  ],

  [
    "import.reexport.namespace.source",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // This handles: export * from './module'
        // Note: This is a special case - no specific name to import
        // We create a synthetic import entry for the namespace re-export
        const import_id = create_import_id(capture);
        const export_stmt = capture.node;

        const export_info = extract_export_info(export_stmt, "*" as SymbolName);

        // For bare namespace re-exports, we use "*" as the name
        builder.add_import({
          symbol_id: import_id,
          name: "*" as SymbolName,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path: extract_import_path(export_stmt),
          import_kind: "namespace",
          original_name: undefined,
          export: export_info.export,
        });
      },
    },
  ],

  [
    "import.reexport.namespace.alias",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_import_id(capture);
        // Navigate up to export_statement
        let export_stmt = capture.node.parent;
        while (export_stmt && export_stmt.type !== "export_statement") {
          export_stmt = export_stmt.parent;
        }
        if (!export_stmt) {
          return;
        }

        const export_info = extract_export_info(export_stmt, capture.text);

        builder.add_import({
          symbol_id: import_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path: extract_import_path(export_stmt),
          import_kind: "namespace",
          original_name: undefined,
          export: export_info.export,
        });
      },
    },
  ],
]);
