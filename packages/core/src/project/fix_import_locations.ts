import type { ImportDefinition, AnyDefinition } from "@ariadnejs/types";
import type { ImportGraph } from "./import_graph";
import type { ExportRegistry } from "../resolve_references/registries/export";
import type { DefinitionRegistry } from "../resolve_references/registries/definition";

/**
 * Rewrite each ImportDefinition's location to point at the original definition
 * in its source file rather than the import statement, so "go to definition" on
 * an imported symbol jumps to where it is declared.
 *
 * Imports that cannot be resolved — unknown module path, or a source file that
 * does not export the name — keep their original importing-file location.
 */
export function fix_import_definition_locations(
  import_definitions: readonly ImportDefinition[],
  imports: ImportGraph,
  exports: ExportRegistry,
  definitions: DefinitionRegistry
): ImportDefinition[] {
  const fixed_definitions: ImportDefinition[] = [];

  for (const import_def of import_definitions) {
    const source_file_path = imports.get_resolved_import_path(import_def.symbol_id);

    if (!source_file_path) {
      fixed_definitions.push(import_def);
      continue;
    }

    // A namespace import (import * as name) binds the whole module, not one
    // export, so it points at the module file rather than a definition inside it.
    if (import_def.import_kind === "namespace") {
      const fixed_import_def: ImportDefinition = {
        ...import_def,
        location: {
          ...import_def.location,
          file_path: source_file_path
        }
      };
      fixed_definitions.push(fixed_import_def);
      continue;
    }

    const exported_symbol_ids = exports.get_exports(source_file_path);

    // An aliased import (import { x as y }) matches the source export by its
    // original name, not the local alias.
    const import_name = import_def.original_name || import_def.name;

    let original_def: AnyDefinition | undefined;

    for (const exported_symbol_id of exported_symbol_ids) {
      const def = definitions.get(exported_symbol_id);
      if (def && def.name === import_name) {
        original_def = def;
        break;
      }
    }

    if (!original_def) {
      fixed_definitions.push(import_def);
      continue;
    }

    const fixed_import_def: ImportDefinition = {
      ...import_def,
      location: original_def.location
    };

    fixed_definitions.push(fixed_import_def);
  }

  return fixed_definitions;
}
