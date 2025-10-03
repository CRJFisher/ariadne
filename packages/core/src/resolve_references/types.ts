/**
 * Shared types for scope-aware symbol resolution
 *
 * This module defines the core types used throughout the resolution system.
 */

import type { SymbolId, SymbolName, ScopeId, FilePath } from "@ariadnejs/types";

/**
 * Resolver function type - returns symbol_id or null
 *
 * A resolver is a lightweight closure (~100 bytes) that captures just enough
 * context to resolve one symbol when called. Resolvers enable on-demand resolution
 * by deferring the actual resolution work until the symbol is referenced.
 *
 * ## Types of Resolvers
 *
 * **Local Definition Resolver:**
 * ```typescript
 * // For: const foo = 5;
 * const resolver: SymbolResolver = () => "var:src/app.ts:foo:10:0";
 * ```
 *
 * **Import Resolver:**
 * ```typescript
 * // For: import { bar } from './utils';
 * const resolver: SymbolResolver = () =>
 *   resolve_export_chain("src/utils.ts", "bar", indices);
 * ```
 *
 * **Parent Scope Resolver:**
 * ```typescript
 * // Inherited from parent scope (just a reference copy)
 * const resolver: SymbolResolver = parent_resolvers.get("baz")!;
 * ```
 *
 * @returns Resolved symbol_id if found, null if symbol cannot be resolved
 */
export type SymbolResolver = () => SymbolId | null;

/**
 * Import specification extracted from ImportDefinition
 *
 * Represents a single imported symbol and contains all information needed
 * to create a lazy import resolver function.
 *
 * @example
 * ```typescript
 * // For: import { foo as bar } from './utils';
 * const spec: ImportSpec = {
 *   local_name: "bar",           // How it's used in this file
 *   source_file: "src/utils.ts", // Where it comes from
 *   import_name: "foo",          // Original name in source file
 *   import_kind: "named"
 * };
 * ```
 *
 * @example
 * ```typescript
 * // For: import utils from './utils';
 * const spec: ImportSpec = {
 *   local_name: "utils",
 *   source_file: "src/utils.ts",
 *   import_name: "default",
 *   import_kind: "default"
 * };
 * ```
 */
export interface ImportSpec {
  /** Name used in the importing file (after any 'as' renaming) */
  local_name: SymbolName;

  /** Resolved target file path (absolute or relative to project root) */
  source_file: FilePath;

  /** Name to look up in the source file (before any 'as' renaming) */
  import_name: SymbolName;

  /** Type of import: named, default, or namespace */
  import_kind: "named" | "default" | "namespace";
}

/**
 * Export information found in a file
 *
 * Used during import resolution to look up what symbols a file exports.
 * When following import chains, we query the source file for ExportInfo
 * matching the import_name.
 *
 * @example
 * ```typescript
 * // In utils.ts: export function foo() { ... }
 * const export_info: ExportInfo = {
 *   symbol_id: "fn:src/utils.ts:foo:10:0",
 *   is_reexport: false
 * };
 * ```
 *
 * @remarks
 * **Known Limitation: Re-export chains not fully supported**
 *
 * Re-export chain following is partially supported but limited because the
 * semantic index doesn't currently track source_file and source_name for re-exports.
 * This means we can detect re-exports but can't always follow them to their origin.
 *
 * Example of unsupported case:
 * ```typescript
 * // barrel.ts
 * export { foo } from './utils';  // Re-export - origin not tracked
 * ```
 *
 * This is future work tracked in the task documentation.
 */
export interface ExportInfo {
  /** Symbol ID of the exported symbol */
  symbol_id: SymbolId;

  /** Whether this is a re-export (export { x } from './other') */
  is_reexport: boolean;
}
