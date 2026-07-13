import type {
  ModulePath,
  SymbolId,
  SymbolName,
} from "@ariadnejs/types";
import { variable_symbol, create_module_path } from "@ariadnejs/types";
import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { CaptureNode, ProcessingContext } from "../../index_single_file";
import { node_to_location } from "../../node_to_location";
import {
  create_variable_id,
  extract_export_info,
  extract_import_path,
} from "../symbol_factories/symbol_factories.python";

export function handle_definition_import(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // Aliased imports (`import X as Y`, `from X import Y as Z`) capture both the
  // source name and the alias. The source-name capture emits the full symbol, so
  // the alias capture is a duplicate and is dropped here.
  const aliased_parent = capture.node.parent;
  if (aliased_parent?.type === "aliased_import") {
    const alias_node = aliased_parent.childForFieldName?.("alias");
    if (alias_node === capture.node) {
      return;
    }
  }

  // The symbol_id is keyed on the alias location when present, matching what
  // scope resolution returns for the bound name.
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

  let import_stmt = capture.node.parent;
  while (
    import_stmt &&
    import_stmt.type !== "import_statement" &&
    import_stmt.type !== "import_from_statement"
  ) {
    import_stmt = import_stmt.parent;
  }

  if (!import_stmt) {
    return;
  }

  let import_kind: "named" | "namespace" = "named";
  let import_path: ModulePath;
  let original_name: SymbolName | undefined;
  let imported_name: SymbolName = capture.text;

  if (import_stmt.type === "import_statement") {
    import_kind = "namespace";
    import_path = create_module_path(capture.text);

    const aliased_import = capture.node.parent;
    if (aliased_import?.type === "aliased_import") {
      const alias_node = aliased_import.childForFieldName?.("alias");
      if (alias_node && alias_node.text !== capture.text) {
        original_name = capture.text;
        imported_name = alias_node.text as SymbolName;
      }
    }
  } else {
    import_path = extract_import_path(import_stmt);

    if (capture.node.type === "wildcard_import") {
      import_kind = "namespace";
      imported_name = "*" as SymbolName;
    } else {
      import_kind = "named";

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

  // A module-level import is re-exportable: another module can import it from here.
  const export_metadata = export_info.is_exported ? { is_reexport: true } : undefined;

  builder.add_import({
    symbol_id: import_id,
    name: imported_name,
    location: definition_location,
    scope_id: defining_scope_id,
    export: export_metadata,
    import_path,
    import_kind,
    original_name,
  });
}
