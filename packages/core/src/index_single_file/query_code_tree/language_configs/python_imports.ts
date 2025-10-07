/**
 * Python import handling for builder configuration
 */

import type { SymbolName, ModulePath } from "@ariadnejs/types";
import type { DefinitionBuilder } from "../../definitions";
import type { CaptureNode, ProcessingContext } from "../../semantic_index";
import type { CaptureHandler } from "./python_builder";
import {
  create_variable_id,
  extract_import_path,
  extract_export_info,
} from "./python_builder";

/**
 * Import handlers for Python builder configuration
 */
export const PYTHON_IMPORT_HANDLERS: Map<string, CaptureHandler> = new Map([
  [
    "import.named",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_variable_id(capture);
        const import_statement = capture.node.parent?.parent || capture.node;
        const import_path = extract_import_path(import_statement);
        const defining_scope_id = context.get_scope_id(capture.location);
        const export_info = extract_export_info(
          capture.text,
          defining_scope_id,
          context.root_scope_id
        );

        builder.add_import({
          symbol_id: import_id,
          name: capture.text,
          location: capture.location,
          scope_id: defining_scope_id,
          export: export_info.export,
          import_path: import_path,
          import_kind: "named",
          original_name: undefined,
        });
      },
    },
  ],

  [
    "import.named.source",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // This is the source name in an aliased import
        const import_id = create_variable_id(capture);
        const import_statement =
          capture.node.parent?.parent?.parent || capture.node;
        const import_path = extract_import_path(import_statement);

        // Look for alias
        const alias_import = capture.node.parent;
        let alias_name: SymbolName | undefined;
        if (alias_import && alias_import.type === "aliased_import") {
          const alias_node = alias_import.childForFieldName?.("alias");
          if (alias_node) {
            alias_name = alias_node.text as SymbolName;
          }
        }

        const imported_name = alias_name || capture.text;
        const defining_scope_id = context.get_scope_id(capture.location);
        const export_info = extract_export_info(
          imported_name,
          defining_scope_id,
          context.root_scope_id
        );

        builder.add_import({
          symbol_id: import_id,
          name: imported_name,
          location: capture.location,
          scope_id: defining_scope_id,
          export: export_info.export,
          import_path: import_path,
          import_kind: "named",
          original_name: capture.text,
        });
      },
    },
  ],

  [
    "import.named.alias",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // This is the alias in an aliased import - skip as it's handled by import.named.source
        return;
      },
    },
  ],

  [
    "import.module",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_variable_id(capture);
        const defining_scope_id = context.get_scope_id(capture.location);
        const export_info = extract_export_info(
          capture.text,
          defining_scope_id,
          context.root_scope_id
        );

        builder.add_import({
          symbol_id: import_id,
          name: capture.text,
          location: capture.location,
          scope_id: defining_scope_id,
          export: export_info.export,
          import_path: capture.text as unknown as ModulePath,
          import_kind: "namespace",
          original_name: undefined,
        });
      },
    },
  ],

  [
    "import.module.source",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // This is the source module in "import X as Y"
        const import_id = create_variable_id(capture);
        const import_statement = capture.node.parent || capture.node;

        // Look for alias
        let alias_name: SymbolName | undefined;
        if (import_statement.type === "aliased_import") {
          const alias_node = import_statement.childForFieldName?.("alias");
          if (alias_node) {
            alias_name = alias_node.text as SymbolName;
          }
        }

        const imported_name = alias_name || capture.text;
        const defining_scope_id = context.get_scope_id(capture.location);
        const export_info = extract_export_info(
          imported_name,
          defining_scope_id,
          context.root_scope_id
        );

        builder.add_import({
          symbol_id: import_id,
          name: imported_name,
          location: capture.location,
          scope_id: defining_scope_id,
          export: export_info.export,
          import_path: capture.text as unknown as ModulePath,
          import_kind: "namespace",
          original_name: alias_name ? capture.text : undefined,
        });
      },
    },
  ],

  [
    "import.module.alias",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // This is the alias in "import X as Y" - skip as it's handled by import.module.source
        return;
      },
    },
  ],

  [
    "import.star",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_variable_id(capture);
        const import_statement = capture.node.parent || capture.node;
        const import_path = extract_import_path(import_statement);

        builder.add_import({
          symbol_id: import_id,
          name: "*" as SymbolName,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path: import_path,
          import_kind: "namespace",
          original_name: undefined,
        });
      },
    },
  ],
]);
