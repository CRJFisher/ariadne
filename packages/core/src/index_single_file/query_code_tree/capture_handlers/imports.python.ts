/**
 * Python import capture handlers
 *
 * Named, exported handler functions for processing Python import tree-sitter captures.
 * Split from python.ts to keep file sizes manageable.
 */

import type { ModulePath, SymbolId, SymbolName } from "@ariadnejs/types";
import { variable_symbol } from "@ariadnejs/types";
import type { DefinitionBuilder } from "../../definitions/definitions";
import type { CaptureNode, ProcessingContext } from "../../index_single_file";
import { node_to_location } from "../../node_utils";
import {
  create_variable_id,
  extract_export_info,
  extract_import_path,
} from "../symbol_factories/symbol_factories.python";

// ============================================================================
// IMPORT HANDLERS
// ============================================================================

export function handle_definition_import(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // For aliased imports (import X as Y / from X import Y as Z), both the module/name
  // and the alias get captured. Skip processing the alias capture since the
  // module/name capture already handles everything correctly.
  const aliased_parent = capture.node.parent;
  if (aliased_parent?.type === "aliased_import") {
    const alias_node = aliased_parent.childForFieldName?.("alias");
    // If capture IS the alias node, skip it (module name capture handles it)
    if (alias_node === capture.node) {
      return;
    }
  }

  // Check for aliased import - use alias location for symbol_id
  // This ensures the symbol_id matches what scope resolution returns
  let import_id: SymbolId;
  let definition_location = capture.location;
  if (aliased_parent?.type === "aliased_import") {
    const alias_node = aliased_parent.childForFieldName?.("alias");
    if (alias_node) {
      const alias_location = node_to_location(alias_node, capture.location.file_path);
      import_id = variable_symbol(alias_node.text, alias_location);
      definition_location = alias_location;
    } else {
      import_id = create_variable_id(capture);
    }
  } else {
    import_id = create_variable_id(capture);
  }

  // Navigate up to find import_statement or import_from_statement
  let import_stmt = capture.node.parent;
  while (
    import_stmt &&
    import_stmt.type !== "import_statement" &&
    import_stmt.type !== "import_from_statement"
  ) {
    import_stmt = import_stmt.parent;
  }

  if (!import_stmt) {
    // Skip if we can't find the import statement
    return;
  }

  // Determine import kind
  let import_kind: "named" | "namespace" = "named";
  let import_path: ModulePath;
  let original_name: SymbolName | undefined;
  let imported_name: SymbolName = capture.text;

  if (import_stmt.type === "import_statement") {
    // import X or import X as Y
    import_kind = "namespace";
    import_path = capture.text as unknown as ModulePath;

    // Check for alias
    const aliased_import = capture.node.parent;
    if (aliased_import?.type === "aliased_import") {
      const alias_node = aliased_import.childForFieldName?.("alias");
      if (alias_node && alias_node.text !== capture.text) {
        original_name = capture.text;
        imported_name = alias_node.text as SymbolName;
      }
    }
  } else {
    // import_from_statement (from X import Y)
    import_path = extract_import_path(import_stmt);

    // Check if it's a wildcard import
    if (capture.node.type === "wildcard_import") {
      import_kind = "namespace";
      imported_name = "*" as SymbolName;
    } else {
      import_kind = "named";

      // Check for alias in from imports
      const aliased_import = capture.node.parent;
      if (aliased_import?.type === "aliased_import") {
        const name_node = aliased_import.childForFieldName?.("name");
        const alias_node = aliased_import.childForFieldName?.("alias");
        if (name_node && alias_node) {
          original_name = name_node.text as SymbolName;
          imported_name = alias_node.text as SymbolName;
        }
      }
    }
  }

  const defining_scope_id = context.get_scope_id(capture.location);
  const export_info = extract_export_info(
    imported_name,
    defining_scope_id,
    context.root_scope_id
  );

  builder.add_import({
    symbol_id: import_id,
    name: imported_name,
    location: definition_location,
    scope_id: defining_scope_id,
    export: export_info.export,
    import_path,
    import_kind,
    original_name,
  });
}

export function handle_import_named(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
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
}

export function handle_import_named_source(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // This is the source name in an aliased import
  const import_id = create_variable_id(capture);
  const import_statement = capture.node.parent?.parent?.parent || capture.node;
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
}

export function handle_import_named_alias(
  _capture: CaptureNode,
  _builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  // This is the alias in an aliased import - skip as it's handled by import.named.source
  return;
}

export function handle_import_module(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
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
}

export function handle_import_module_source(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // This is the source module in "import X as Y"
  const import_statement = capture.node.parent || capture.node;

  // Look for alias - use alias location for symbol_id if present
  // This ensures the symbol_id matches what scope resolution returns
  let alias_name: SymbolName | undefined;
  let import_id: SymbolId;
  let location = capture.location;
  if (import_statement.type === "aliased_import") {
    const alias_node = import_statement.childForFieldName?.("alias");
    if (alias_node) {
      alias_name = alias_node.text as SymbolName;
      // Use alias location for symbol_id (matches what resolutions.resolve() returns)
      const alias_location = node_to_location(alias_node, capture.location.file_path);
      import_id = variable_symbol(alias_name, alias_location);
      location = alias_location;
    } else {
      import_id = create_variable_id(capture);
    }
  } else {
    import_id = create_variable_id(capture);
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
    location,
    scope_id: defining_scope_id,
    export: export_info.export,
    import_path: capture.text as unknown as ModulePath,
    import_kind: "namespace",
    original_name: alias_name ? capture.text : undefined,
  });
}

export function handle_import_module_alias(
  _capture: CaptureNode,
  _builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  // This is the alias in "import X as Y" - skip as it's handled by import.module.source
  return;
}

export function handle_import_star(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
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
}
