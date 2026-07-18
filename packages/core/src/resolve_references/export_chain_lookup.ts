import type { SymbolId, SymbolName, FilePath, Language } from "@ariadnejs/types";
import type { DefinitionRegistry } from "./registries/definition";
import type { ExportRegistry } from "./registries/export";
import type { FileSystemFolder } from "./file_folders";

/**
 * Look up a named export in a source file, following re-export chains.
 *
 * Used for namespace imports (`import * as ns from './mod'`) and constructor
 * resolution (`new ns.Foo()` → find `Foo` in `mod`). Following the chain lets
 * a barrel re-export (`mod.ts: export { Foo } from './impl'`) resolve through
 * to the terminal definition in `impl`, not just same-file exports.
 */
export function resolve_namespace_export(
  source_file: FilePath,
  export_name: SymbolName,
  exports: ExportRegistry,
  languages: ReadonlyMap<FilePath, Language>,
  root_folder: FileSystemFolder
): SymbolId | null {
  return exports.resolve_export_chain(
    source_file,
    export_name,
    "namespace",
    languages,
    root_folder
  );
}

/**
 * Resolve a named or default import to the exported definition it names.
 *
 * For `import { ImportGraph } from "./import_graph"`, finds the `ImportGraph`
 * class exported from import_graph.ts.
 *
 * Matches by name, which also covers default imports via the common
 * `export default class ClassName` pattern where the local and exported names
 * coincide; the definition carries no separate default-export marker.
 */
export function resolve_named_import(
  source_file: FilePath,
  export_name: SymbolName,
  definitions: DefinitionRegistry
): SymbolId | null {
  const source_defs = definitions.get_exportable_definitions_in_file(source_file);

  for (const def of source_defs) {
    // Re-exports are followed by resolve_namespace_export, not here.
    if (def.kind === "import") continue;
    if (!def.is_exported) continue;

    if (def.name === export_name) {
      return def.symbol_id;
    }
  }

  return null;
}
