/**
 * Import and export types for module dependencies and APIs
 */

import { Location, Language } from "./common";
import { SymbolName } from "./symbols";
import { SymbolId } from "./symbols";
import { SemanticNode, Resolution } from "./query";

// ============================================================================
// Branded Types for Import/Export
// ============================================================================

/** Module import path (e.g., 'lodash', './utils') */
export type ModulePath = string & { __brand: "ModulePath" };

/** Namespace name */
export type NamespaceName = string & { __brand: "NamespaceName" };

// ============================================================================
// Import Types
// ============================================================================

/**
 * Base import information
 */
interface BaseImport extends SemanticNode {
  readonly source: ModulePath; // Module being imported from
  readonly is_type_only: boolean; // TypeScript type-only import (defaults to false)
  readonly is_dynamic: boolean; // Dynamic import() (defaults to false)
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
  readonly namespace_name: NamespaceName; // Namespace alias (renamed to avoid conflict)
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
  readonly is_type_only: boolean; // TypeScript type-only export (defaults to false)
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
  readonly exports: readonly NamedExportItem[];
}

export interface NamedExportItem {
  readonly local_name: SymbolName; // Internal name
  readonly export_name?: SymbolName; // Exported as (if different) (remains optional - not all exports are renamed)
  readonly is_type_only: boolean; // Individual type-only marker (defaults to false)
}

/**
 * Default export: export default foo
 */
export interface DefaultExport extends BaseExport {
  readonly kind: "default";
  readonly symbol: SymbolName; // Generated symbol for anonymous exports
  readonly is_declaration: boolean; // export default class {} vs export default foo
}

/**
 * Namespace export: export * from 'module'
 */
export interface NamespaceExport extends BaseExport {
  readonly kind: "namespace";
  readonly source: ModulePath; // Re-export source
  readonly as_name?: NamespaceName; // export * as foo from 'module'
}

/**
 * Re-export: export { foo } from 'module'
 */
export interface ReExport extends BaseExport {
  readonly kind: "reexport";
  readonly source: ModulePath;
  readonly exports: readonly ReExportItem[];
}

export interface ReExportItem {
  readonly source_name: SymbolName; // Name in source module
  readonly export_name?: SymbolName; // Exported as (if different) (remains optional - not all re-exports are renamed)
  readonly is_type_only: boolean; // Type-only re-export (defaults to false)
}

// ============================================================================
// Module Resolution Types
// ============================================================================

/**
 * Resolved module information
 */
export interface ResolvedModule {
  readonly module_path: ModulePath;
  readonly file_path?: string; // Resolved file path (optional for external modules)
  readonly is_external: boolean; // Node module vs local (required - defaults to false)
  readonly is_builtin: boolean; // Node builtin module (required - defaults to false)
  readonly package_name?: string; // NPM package name (optional - only for external packages)
  readonly exports: readonly Export[];
  readonly imports: readonly Import[];
}

/**
 * Module dependency edge
 */
export interface ModuleDependency {
  readonly from: ModulePath;
  readonly to: ModulePath;
  readonly imports: readonly Import[];
  readonly is_circular?: boolean; // Circular dependency detected
  readonly is_dev_only?: boolean; // Dev dependency only
}

/**
 * Symbol resolution across modules
 */
export interface CrossModuleResolution {
  readonly symbol: SymbolName;
  readonly from_module: ModulePath;
  readonly to_module: ModulePath;
  readonly resolution: Resolution<{
    readonly symbol_id: SymbolId;
    readonly export_chain: readonly ExportChainStep[];
  }>;
}

/**
 * Step in export/re-export chain
 */
export interface ExportChainStep {
  readonly module: ModulePath;
  readonly export_type: "direct" | "reexport" | "namespace";
  readonly name_transformation?: {
    readonly from: SymbolName;
    readonly to: SymbolName;
  };
}
