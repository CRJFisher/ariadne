import {
  type FilePath,
  type SymbolId,
  type SymbolName,
  type ImportDefinition,
  type ExportableDefinition,
  type Language,
} from "@ariadnejs/types";
import type { DefinitionRegistry } from "./definition";
import { resolve_module_path } from "../import_resolution";
import type { FileSystemFolder } from "../file_folders";
import {
  is_python_file,
  should_replace_python_variable,
  is_variable_or_constant_symbol,
} from "./export.python";
import { resolve_arrow_function_export } from "./export.typescript";

/**
 * Everything needed to follow a re-export chain to its ultimate source symbol.
 */
interface EnhancedExportMetadata {
  symbol_id: SymbolId;

  /** Name used in the export, which differs from the symbol name when aliased. */
  export_name: SymbolName;

  is_default: boolean;

  /** True for re-exports (`export { x } from './other'`). */
  is_reexport: boolean;

  /** Source info carried on re-exports so the chain can be followed. */
  import_def?: ImportDefinition;
}

/**
 * Registry tracking what symbols each file exports, keyed for the two lookups
 * import resolution needs: the set of exported symbols per file, and per-name
 * metadata rich enough to follow `export { x } from './other'` re-export chains
 * without a SemanticIndex.
 */
export class ExportRegistry {
  private exports: Map<FilePath, Set<SymbolId>> = new Map();

  private export_metadata: Map<
    FilePath,
    Map<SymbolName, EnhancedExportMetadata>
  > = new Map();

  private default_exports: Map<FilePath, EnhancedExportMetadata> = new Map();

  /**
   * Replace all export information for a file from its current definitions.
   */
  update_file(file_id: FilePath, definitions: DefinitionRegistry): void {
    this.remove_file(file_id);

    const symbol_ids = new Set<SymbolId>();
    const metadata_map = new Map<SymbolName, EnhancedExportMetadata>();

    const add_to_registry = (def: ExportableDefinition) => {
      // ImportDefinitions carry no is_exported flag; their re-export status
      // lives entirely on the export field.
      if (def.kind === "import") {
        if (!def.export) {
          return;
        }
      } else {
        if (!def.is_exported) {
          return;
        }
      }

      const export_name = def.export?.export_name || def.name;
      const is_default = def.export?.is_default === true;
      const is_reexport = def.export?.is_reexport === true;

      const import_def =
        is_reexport && def.kind === "import"
          ? (def as ImportDefinition)
          : undefined;

      const existing = metadata_map.get(export_name);
      if (existing && !is_default) {
        const arrow_decision = resolve_arrow_function_export(
          existing.symbol_id,
          def.kind
        );
        if (arrow_decision === "replace_existing") {
          metadata_map.set(export_name, {
            symbol_id: def.symbol_id,
            export_name,
            is_default,
            is_reexport,
            import_def,
          });
          symbol_ids.add(def.symbol_id);
          return;
        }
        if (arrow_decision === "keep_existing") {
          return;
        }

        // Python module-level reassignment (`x = 1; x = 2`) yields one
        // definition per assignment; only the last in source order is exported.
        if (
          is_python_file(file_id) &&
          is_variable_or_constant_symbol(existing.symbol_id) &&
          (def.kind === "variable" || def.kind === "constant")
        ) {
          if (
            should_replace_python_variable(
              existing.symbol_id,
              def.location.start_line
            )
          ) {
            metadata_map.set(export_name, {
              symbol_id: def.symbol_id,
              export_name,
              is_default,
              is_reexport,
              import_def,
            });
            symbol_ids.add(def.symbol_id);
            symbol_ids.delete(existing.symbol_id);
          }
          return;
        }

        // A local definition (`def foo():`) shadows a re-exported import of the
        // same name; the local binding is the one that gets exported.
        if (existing.is_reexport && !is_reexport) {
          metadata_map.set(export_name, {
            symbol_id: def.symbol_id,
            export_name,
            is_default,
            is_reexport,
            import_def,
          });
          symbol_ids.add(def.symbol_id);
          symbol_ids.delete(existing.symbol_id);
          return;
        }

        if (is_reexport && !existing.is_reexport) {
          return;
        }

        throw new Error(
          `Duplicate export name "${export_name}" in file ${file_id}.\n` +
            `  First:  ${existing.symbol_id}\n` +
            `  Second: ${def.symbol_id}\n` +
            "This indicates a bug in is_exported logic or malformed source code."
        );
      }

      const metadata: EnhancedExportMetadata = {
        symbol_id: def.symbol_id,
        export_name,
        is_default,
        is_reexport,
        import_def,
      };

      symbol_ids.add(def.symbol_id);

      if (is_default) {
        const existing_default = this.default_exports.get(file_id);
        if (existing_default) {
          throw new Error(
            `Multiple default exports found in file ${file_id}.\n` +
              `  First:  ${existing_default.symbol_id}\n` +
              `  Second: ${def.symbol_id}\n` +
              "This indicates a bug in indexing or malformed source code."
          );
        }
        this.default_exports.set(file_id, metadata);
      } else {
        metadata_map.set(export_name, metadata);
      }
    };

    const file_definitions =
      definitions.get_exportable_definitions_in_file(file_id);

    for (const def of file_definitions) {
      add_to_registry(def);
    }

    if (symbol_ids.size > 0) {
      this.exports.set(file_id, symbol_ids);
    }
    if (metadata_map.size > 0) {
      this.export_metadata.set(file_id, metadata_map);
    }
  }

  /**
   * All symbols exported by a file, as a copy safe for the caller to mutate.
   */
  get_exports(file_id: FilePath): Set<SymbolId> {
    const exports = this.exports.get(file_id);
    return exports ? new Set(exports) : new Set();
  }

  private get_export(
    file_path: FilePath,
    export_name: SymbolName
  ): EnhancedExportMetadata | undefined {
    return this.export_metadata.get(file_path)?.get(export_name);
  }

  private get_default_export(
    file_path: FilePath
  ): EnhancedExportMetadata | undefined {
    return this.default_exports.get(file_path);
  }

  /**
   * Resolve a module's default export when it is the file's ONLY export surface
   * — the CommonJS `module.exports = Class` whole-module shape. Returns null
   * when the file has any named exports (a genuine namespace/object module such
   * as `module.exports = { a, b }`) or no default at all, so a
   * `const X = require()` binding stays a namespace import in those cases.
   */
  resolve_sole_default_export(
    source_file: FilePath,
    languages: ReadonlyMap<FilePath, Language>,
    root_folder: FileSystemFolder
  ): SymbolId | null {
    if (this.export_metadata.has(source_file)) {
      return null;
    }
    return this.resolve_export_chain(
      source_file,
      "" as SymbolName,
      "default",
      languages,
      root_folder
    );
  }

  remove_file(file_id: FilePath): void {
    this.exports.delete(file_id);
    this.export_metadata.delete(file_id);
    this.default_exports.delete(file_id);
  }

  clear(): void {
    this.exports.clear();
    this.export_metadata.clear();
    this.default_exports.clear();
  }

  /**
   * Follow a re-export chain (`base.js → middle.js → main.js`) to the symbol
   * that ultimately backs an export, using only this registry's data.
   *
   * @param export_name - Ignored for default imports.
   * @param visited - Cycle-detection accumulator; callers leave it unset.
   * @returns The resolved symbol_id, or null when the export is missing, the
   *   source language is unknown, or the chain is circular.
   */
  resolve_export_chain(
    source_file: FilePath,
    export_name: SymbolName,
    import_kind: "named" | "default" | "namespace",
    languages: ReadonlyMap<FilePath, Language>,
    root_folder: FileSystemFolder,
    visited: Set<string> = new Set()
  ): SymbolId | null {
    const key =
      import_kind === "default"
        ? `${source_file}:default`
        : `${source_file}:${export_name}:${import_kind}`;

    if (visited.has(key)) {
      return null;
    }
    visited.add(key);

    const export_meta =
      import_kind === "default"
        ? this.get_default_export(source_file)
        : this.get_export(source_file, export_name);

    if (!export_meta) {
      return null;
    }

    if (export_meta.is_reexport && export_meta.import_def) {
      const imp_def = export_meta.import_def;

      const language = languages.get(source_file);
      if (!language) {
        return null;
      }

      const resolved_file = resolve_module_path(
        imp_def.import_path,
        source_file,
        language,
        root_folder
      );

      const original_name = (imp_def.original_name ||
        imp_def.name) as SymbolName;

      return this.resolve_export_chain(
        resolved_file,
        original_name,
        imp_def.import_kind,
        languages,
        root_folder,
        visited
      );
    }

    return export_meta.symbol_id;
  }
}
