import {
  type FilePath,
  type SymbolId,
  type SymbolName,
  type ImportDefinition,
  type ExportableDefinition,
  type Language,
} from "@ariadnejs/types";
import type { DefinitionRegistry } from "./definition_registry";
import { resolve_module_path } from "../import_resolution/import_resolver";
import { FileSystemFolder } from "../types";

/**
 * Extended export metadata for resolution.
 * Contains everything needed to follow re-export chains.
 */
interface EnhancedExportMetadata {
  /** Symbol ID of the exported symbol */
  symbol_id: SymbolId;

  /** Name used in export (may differ from symbol name if aliased) */
  export_name: SymbolName;

  /** True if this is a default export */
  is_default: boolean;

  /** True if this is a re-export (export { x } from './other') */
  is_reexport: boolean;

  /** For re-exports: the ImportDefinition containing source info */
  import_def?: ImportDefinition;
}

/**
 * Registry tracking what symbols each file exports.
 *
 * Used for import resolution: when resolving `import { foo } from './module'`,
 * we need to check if the target file exports `foo`.
 *
 * Now also stores full export metadata and implements resolve_export_chain
 * to follow re-export chains without needing SemanticIndex.
 */
export class ExportRegistry {
  /** File → Set of SymbolIds that file exports (legacy compatibility) */
  private exports: Map<FilePath, Set<SymbolId>> = new Map();

  /** File → (export name → export metadata) */
  private export_metadata: Map<
    FilePath,
    Map<SymbolName, EnhancedExportMetadata>
  > = new Map();

  /** File → default export metadata */
  private default_exports: Map<FilePath, EnhancedExportMetadata> = new Map();

  /** Track which file contributed which exports (for cleanup) */
  private by_file: Map<FilePath, Set<SymbolName>> = new Map();

  /**
   * Update exports for a file.
   * Replaces any existing export information for the file.
   * Gets definitions from DefinitionRegistry.
   *
   * @param file_id - The file being updated
   * @param definitions - Definition registry containing all definitions
   */
  update_file(file_id: FilePath, definitions: DefinitionRegistry): void {
    // Remove old data
    this.remove_file(file_id);

    // Build export metadata from all exportable definitions in semantic index
    const symbol_ids = new Set<SymbolId>();
    const metadata_map = new Map<SymbolName, EnhancedExportMetadata>();
    const export_names = new Set<SymbolName>();

    // Helper to add exportable definitions to the registry
    const add_to_registry = (def: ExportableDefinition) => {
      // ImportDefinitions don't have is_exported - check export field directly
      if (def.kind === "import") {
        if (!def.export) {
          return;
        }
      } else {
        // Only add exported symbols
        if (!def.is_exported) {
          return;
        }
      }

      // Get the effective export name (alias or original name)
      const export_name = def.export?.export_name || def.name;
      const is_default = def.export?.is_default === true;
      const is_reexport = def.export?.is_reexport === true;

      // For re-exports, the definition itself is an ImportDefinition
      const import_def =
        is_reexport && def.kind === "import"
          ? (def as ImportDefinition)
          : undefined;

      // Check for duplicates - temporarily allow function/variable duplicates for arrow functions
      const existing = metadata_map.get(export_name);
      if (existing && !is_default) {
        // Special case: if we have both a function and a variable/constant with the same name,
        // prefer the variable (this handles arrow functions assigned to const variables)
        if (
          (existing.symbol_id.includes("function:") &&
            (def.kind === "variable" || def.kind === "constant")) ||
          (def.kind === "function" &&
            (existing.symbol_id.includes("variable:") ||
              existing.symbol_id.includes("constant:")))
        ) {
          // Prefer variable/constant over function for arrow function assignments
          if (def.kind === "variable" || def.kind === "constant") {
            // Replace the function with the variable
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
          // If current def is function and existing is variable/constant, keep the existing (do nothing)
          return;
        }

        // For all other duplicates, this is an error
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
        // Check for duplicate default export
        const existing_default = this.default_exports.get(file_id);
        if (existing_default) {
          throw new Error(
            `Multiple default exports found in file ${file_id}.\n` +
              `  First:  ${existing_default.symbol_id}\n` +
              `  Second: ${def.symbol_id}\n` +
              "This indicates a bug in indexing or malformed source code."
          );
        }
        // Store as default export
        this.default_exports.set(file_id, metadata);
      } else {
        // Store as named export
        metadata_map.set(export_name, metadata);
        export_names.add(export_name);
      }
    };

    // Get all definitions for this file from DefinitionRegistry
    const file_definitions = definitions.get_exportable_definitions_in_file(file_id);

    // Process all exportable definitions
    for (const def of file_definitions) {
      add_to_registry(def);
    }

    // Store in all indexes
    if (symbol_ids.size > 0) {
      this.exports.set(file_id, symbol_ids);
    }
    if (metadata_map.size > 0) {
      this.export_metadata.set(file_id, metadata_map);
    }
    if (export_names.size > 0) {
      this.by_file.set(file_id, export_names);
    }
  }

  /**
   * Get all symbols exported by a file.
   *
   * @param file_id - The file to query
   * @returns Set of exported SymbolIds (empty set if file has no exports)
   */
  get_exports(file_id: FilePath): Set<SymbolId> {
    const exports = this.exports.get(file_id);
    return exports ? new Set(exports) : new Set();
  }

  /**
   * Check if a file exports a specific symbol.
   *
   * @param file_id - The file to check
   * @param symbol_id - The symbol to check
   * @returns True if the file exports the symbol
   */
  exports_symbol(file_id: FilePath, symbol_id: SymbolId): boolean {
    const file_exports = this.exports.get(file_id);
    return file_exports ? file_exports.has(symbol_id) : false;
  }

  /**
   * Get all files that export at least one symbol.
   *
   * @returns Array of file IDs
   */
  get_all_files(): FilePath[] {
    return Array.from(this.exports.keys());
  }

  /**
   * Get the total number of files with exports.
   *
   * @returns Count of files
   */
  get_file_count(): number {
    return this.exports.size;
  }

  /**
   * Get the total number of exported symbols across all files.
   *
   * @returns Count of symbols
   */
  get_total_export_count(): number {
    let count = 0;
    for (const exported_set of this.exports.values()) {
      count += exported_set.size;
    }
    return count;
  }

  /**
   * Find all files that export a specific symbol.
   * Useful for finding symbol conflicts or multiple providers.
   *
   * @param symbol_id - The symbol to search for
   * @returns Array of file IDs that export this symbol
   */
  find_exporters(symbol_id: SymbolId): FilePath[] {
    const exporters: FilePath[] = [];

    for (const [file_id, exported_symbols] of this.exports) {
      if (exported_symbols.has(symbol_id)) {
        exporters.push(file_id);
      }
    }

    return exporters;
  }

  /**
   * Get named export metadata for a file.
   *
   * @param file_path - The file to query
   * @param export_name - The export name to look up
   * @returns Export metadata or undefined if not found
   */
  get_export(
    file_path: FilePath,
    export_name: SymbolName
  ): EnhancedExportMetadata | undefined {
    return this.export_metadata.get(file_path)?.get(export_name);
  }

  /**
   * Get default export metadata for a file.
   *
   * @param file_path - The file to query
   * @returns Default export metadata or undefined if no default export
   */
  get_default_export(file_path: FilePath): EnhancedExportMetadata | undefined {
    return this.default_exports.get(file_path);
  }

  /**
   * Remove all export information from a file.
   *
   * @param file_id - The file to remove
   */
  remove_file(file_id: FilePath): void {
    this.exports.delete(file_id);
    this.export_metadata.delete(file_id);
    this.default_exports.delete(file_id);
    this.by_file.delete(file_id);
  }

  /**
   * Clear all export information from the registry.
   */
  clear(): void {
    this.exports.clear();
    this.export_metadata.clear();
    this.default_exports.clear();
    this.by_file.clear();
  }

  /**
   * Follow export chain to find ultimate source symbol.
   * Handles re-export chains: base.js → middle.js → main.js
   *
   * This is a self-contained resolution method that only uses ExportRegistry data.
   * It replaces the resolve_export_chain function from import_resolver.ts.
   *
   * @param source_file - File containing the export
   * @param export_name - Name of the exported symbol (ignored for default imports)
   * @param import_kind - Type of import (named, default, or namespace)
   * @param languages - Map of file paths to their languages
   * @param root_folder - Root folder for module path resolution
   * @param visited - Set of visited exports for cycle detection (internal)
   * @returns Resolved symbol_id or null if not found
   */
  resolve_export_chain(
    source_file: FilePath,
    export_name: SymbolName,
    import_kind: "named" | "default" | "namespace",
    languages: ReadonlyMap<FilePath, Language>,
    root_folder: FileSystemFolder,
    visited: Set<string> = new Set()
  ): SymbolId | null {
    // Detect cycles
    const key =
      import_kind === "default"
        ? `${source_file}:default`
        : `${source_file}:${export_name}:${import_kind}`;

    if (visited.has(key)) {
      return null; // Circular re-export
    }
    visited.add(key);

    // Get export metadata from THIS registry
    const export_meta =
      import_kind === "default"
        ? this.get_default_export(source_file)
        : this.get_export(source_file, export_name);

    if (!export_meta) {
      // Export not found
      return null;
    }

    // If it's a re-export, follow the chain
    if (export_meta.is_reexport && export_meta.import_def) {
      const imp_def = export_meta.import_def;

      // Get language from languages map (the file doing the re-export)
      const language = languages.get(source_file);
      if (!language) {
        // Source file language not available - cannot resolve re-export
        return null;
      }

      // Resolve the module path to get the target file
      const resolved_file = resolve_module_path(
        imp_def.import_path,
        source_file,
        language,
        root_folder
      );

      // Get the original name and import kind for the next hop
      const original_name = (imp_def.original_name ||
        imp_def.name) as SymbolName;
      const next_import_kind = imp_def.import_kind;

      // RECURSIVE: Follow the chain
      return this.resolve_export_chain(
        resolved_file,
        original_name,
        next_import_kind,
        languages,
        root_folder,
        visited
      );
    }

    // Not a re-export, return the symbol
    return export_meta.symbol_id;
  }
}
