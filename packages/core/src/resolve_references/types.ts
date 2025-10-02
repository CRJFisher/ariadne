/**
 * Shared types for scope-aware symbol resolution
 */

import type { SymbolId, SymbolName, ScopeId, FilePath } from "@ariadnejs/types";

/**
 * Resolver function type - returns symbol_id or null
 *
 * These are lightweight closures that perform resolution on-demand.
 * They capture just enough context to resolve a symbol when called.
 */
export type SymbolResolver = () => SymbolId | null;

/**
 * Import specification extracted from ImportDefinition
 * Used to create lazy import resolver functions
 */
export interface ImportSpec {
  local_name: SymbolName;      // Name used in importing file
  source_file: FilePath;       // Resolved target file path
  import_name: SymbolName;     // Name to look up in source file
  import_kind: "named" | "default" | "namespace";
}

/**
 * Export information found in a file
 * Used during import resolution
 *
 * NOTE: Re-export chain following is not yet supported because the semantic index
 * doesn't currently track source_file and source_name for re-exports.
 * This is future work tracked in the task documentation.
 */
export interface ExportInfo {
  symbol_id: SymbolId;
  is_reexport: boolean;
}
