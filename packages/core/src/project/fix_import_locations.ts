/**
 * Fix ImportDefinition locations to point to original source files.
 *
 * This module contains logic to correct ImportDefinition locations.
 * ImportDefinitions are initially created with the importing file's location,
 * but when resolving symbols, we want them to point to the original definition's
 * location in the source file.
 */

import type { ImportDefinition, AnyDefinition } from "@ariadnejs/types";
import type { ImportGraph } from "./import_graph";
import type { ExportRegistry } from "../resolve_references/registries/export_registry";
import type { DefinitionRegistry } from "../resolve_references/registries/definition_registry";

/**
 * Fix ImportDefinition locations to point to original source files.
 *
 * For each import, this function:
 * 1. Resolves the import to its source file
 * 2. Looks up the exported definition in that file
 * 3. Updates the ImportDefinition with the original definition's location
 *
 * This ensures that "go to definition" on an imported symbol jumps to the
 * source file, not the import statement.
 *
 * @param import_definitions - The import definitions to fix
 * @param imports - ImportGraph for resolving import paths
 * @param exports - ExportRegistry for finding exported definitions
 * @param definitions - DefinitionRegistry for looking up definitions
 * @returns Array of fixed ImportDefinitions
 */
export function fix_import_definition_locations(
  import_definitions: readonly ImportDefinition[],
  imports: ImportGraph,
  exports: ExportRegistry,
  definitions: DefinitionRegistry
): ImportDefinition[] {
  const fixed_definitions: ImportDefinition[] = [];

  for (const import_def of import_definitions) {
    // Get the resolved file path for this import
    const source_file_path = imports.get_resolved_import_path(import_def.symbol_id);

    if (!source_file_path) {
      // Can't resolve import path - keep original
      fixed_definitions.push(import_def);
      continue;
    }

    // Namespace imports (import * as name) represent the entire module,
    // not a specific export. Point to the module file itself.
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

    // Get exported symbols from the source file
    const exported_symbol_ids = exports.get_exports(source_file_path);

    // Find the matching exported definition
    // For named imports, use original_name if present, otherwise use name
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
      // Can't find original definition - keep original
      // This can happen if the export doesn't exist yet or was removed
      fixed_definitions.push(import_def);
      continue;
    }

    // Create updated ImportDefinition with correct location
    const fixed_import_def: ImportDefinition = {
      ...import_def,
      location: original_def.location
    };

    fixed_definitions.push(fixed_import_def);
  }

  return fixed_definitions;
}
