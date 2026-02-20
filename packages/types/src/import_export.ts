/**
 * Import and export types for module dependencies and APIs
 */

import { FilePath } from "./common";
import { SymbolName } from "./symbol";
import { SymbolId } from "./symbol";
import { SemanticNode } from "./query";

// ============================================================================
// Branded Types for Import/Export
// ============================================================================

/** Module import path (e.g., 'lodash', './utils') */
// eslint-disable-next-line @typescript-eslint/naming-convention
export type ModulePath = string & { __brand: "ModulePath" };

/** Create a ModulePath from a string */
export function create_module_path(path: string): ModulePath {
  return path as ModulePath;
}

/** Namespace name */
// eslint-disable-next-line @typescript-eslint/naming-convention
export type NamespaceName = string & { __brand: "NamespaceName" };

/** Create a NamespaceName from a string */
export function create_namespace_name(name: string): NamespaceName {
  return name as NamespaceName;
}

// ============================================================================
// Import Types
// ============================================================================

/**
 * Base import information
 */
interface BaseImport extends SemanticNode {
  readonly source: FilePath; // Module being imported from
  readonly is_type_only?: boolean;
  readonly is_dynamic?: boolean;
}

/**
 * Import representation using discriminated union
 */
export type Import =
  | NamedImport
  | DefaultImport
  | NamespaceImport
  | SideEffectImport;

/**
 * Named import: import { foo, bar as baz } from 'module'
 */
export interface NamedImport extends BaseImport {
  readonly kind: "named";
  readonly imports: readonly NamedImportItem[];
}

export interface NamedImportItem {
  readonly name: SymbolName; // Original name in module
  readonly alias?: SymbolName; // Local alias if renamed (remains optional - not all imports have aliases)
  readonly is_type_only: boolean; // Individual type-only marker (defaults to false)
}

/**
 * Default import: import foo from 'module'
 */
export interface DefaultImport extends BaseImport {
  readonly kind: "default";
  readonly name: SymbolName; // Local name for default export
}

/**
 * Namespace import: import * as foo from 'module'
 */
export interface NamespaceImport extends BaseImport {
  readonly kind: "namespace";
  readonly namespace_name: NamespaceName;
}

/**
 * Side-effect import: import 'module'
 */
export interface SideEffectImport extends BaseImport {
  readonly kind: "side_effect";
  // No symbols imported
}

// ============================================================================
// Unified Export Types
// ============================================================================

/**
 * Base export information
 */
interface BaseExport extends SemanticNode {
  readonly symbol: SymbolId; // We build these in the original file so we always know the symbol-id
  readonly symbol_name: SymbolName;
  readonly is_type_only?: boolean; // TypeScript type-only export
}

/**
 * Export representation using discriminated union
 */
export type Export = NamedExport | DefaultExport | NamespaceExport | ReExport;

/**
 * Named export: export { foo, bar as baz }
 */
export interface NamedExport extends BaseExport {
  readonly kind: "named";
  readonly exports: readonly {
    readonly local_name: SymbolName; // Internal name
    readonly export_name?: SymbolName; // Exported as (if different) (remains optional - not all exports are renamed)
    readonly is_type_only: boolean; // Individual type-only marker (defaults to false)
  }[];
}

/**
 * Default export: export default foo
 */
export interface DefaultExport extends BaseExport {
  readonly kind: "default";
  readonly is_declaration: boolean; // export default class {} vs export default foo
}

/**
 * Namespace export: export * from 'module'
 */
export interface NamespaceExport extends BaseExport {
  readonly kind: "namespace";
  readonly source: FilePath; // Re-export source
  readonly as_name?: NamespaceName; // export * as foo from 'module'
}

/**
 * Re-export: export { foo } from 'module'
 */
export interface ReExport extends BaseExport {
  readonly kind: "reexport";
  readonly source: FilePath; // This is the file path of the module being re-exported
  readonly exports: readonly ReExportItem[];
}

export interface ReExportItem {
  readonly source_name: SymbolName; // Name in source module
  readonly export_name?: SymbolName; // Exported as (if different) (remains optional - not all re-exports are renamed)
  readonly is_type_only: boolean; // Type-only re-export (defaults to false)
}
