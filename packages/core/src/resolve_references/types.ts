/**
 * Shared types for scope-aware symbol resolution
 *
 * This module defines the core types used throughout the resolution system.
 */

import type { SymbolId, SymbolName, FilePath, ImportDefinition } from "@ariadnejs/types";

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
 *   symbol_id: "import:src/app.ts:bar:5:0",
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
 *   symbol_id: "import:src/app.ts:utils:5:0",
 *   local_name: "utils",
 *   source_file: "src/utils.ts",
 *   import_name: "default",
 *   import_kind: "default"
 * };
 * ```
 */
export interface ImportSpec {
  /** Symbol ID of the import definition itself */
  symbol_id: SymbolId;

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
 */
export interface ExportInfo {
  /** Symbol ID of the exported symbol */
  symbol_id: SymbolId;

  /** Whether this is a re-export (export { x } from './other') */
  is_reexport: boolean;

  /** Import definition for re-exports (to follow the chain) */
  import_def?: ImportDefinition;
}

/**
 * Namespace source tracking for namespace imports
 *
 * Maps namespace import symbol IDs to their source file paths.
 * Enables member resolution for expressions like `utils.helper()` where
 * `utils` is a namespace import (`import * as utils from './utils'`).
 *
 * @example
 * ```typescript
 * // For: import * as utils from './utils';
 * const namespace_sources: NamespaceSources = new Map([
 *   ["import:src/app.ts:utils:5:0", "src/utils.ts"]
 * ]);
 * ```
 */
export type NamespaceSources = ReadonlyMap<SymbolId, FilePath>;

/**
 * File system folder tree structure
 *
 * Represents a directory in a virtual file system tree. Used by import resolution
 * to check file existence without filesystem I/O, enabling resolution to work
 * with in-memory test data and improving performance.
 *
 * @example
 * ```typescript
 * // Representing: /src/utils.ts, /src/app.ts, /src/nested/helper.ts
 * const root: FileSystemFolder = {
 *   path: "/" as FilePath,
 *   folders: new Map([
 *     ["src", {
 *       path: "/src" as FilePath,
 *       folders: new Map([
 *         ["nested", {
 *           path: "/src/nested" as FilePath,
 *           folders: new Map(),
 *           files: new Set(["helper.ts"])
 *         }]
 *       ]),
 *       files: new Set(["utils.ts", "app.ts"])
 *     }]
 *   ]),
 *   files: new Set()
 * };
 * ```
 */
export interface FileSystemFolder {
  /** Absolute path to this folder */
  readonly path: FilePath;

  /** Child folders keyed by folder name (not full path) */
  readonly folders: ReadonlyMap<string, FileSystemFolder>;

  /** Files in this folder (just filenames, not full paths) */
  readonly files: ReadonlySet<string>;
}
