/**
 * Import and export types for module dependencies and APIs
 */

import { Location, Language } from "./common";
import { ModulePath, NamespaceName } from "./aliases";
import { SymbolName } from "./symbol_utils";
import { SymbolId } from "./symbol_utils";
import { SemanticNode, Resolution } from "./query";

// ============================================================================
// Import Types
// ============================================================================

/**
 * Base import information
 */
interface BaseImport extends SemanticNode {
  readonly source: ModulePath; // Module being imported from
  readonly is_type_only?: boolean; // TypeScript type-only import
  readonly is_dynamic?: boolean; // Dynamic import()
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
  readonly alias?: SymbolName; // Local alias if renamed
  readonly is_type_only?: boolean; // Individual type-only marker
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
  readonly exports: readonly NamedExportItem[];
}

export interface NamedExportItem {
  readonly local_name: SymbolName; // Internal name
  readonly export_name?: SymbolName; // Exported as (if different)
  readonly is_type_only?: boolean; // Individual type-only marker
}

/**
 * Default export: export default foo
 */
export interface DefaultExport extends BaseExport {
  readonly kind: "default";
  readonly symbol?: SymbolName; // Symbol being exported (if not anonymous)
  readonly is_declaration?: boolean; // export default class {} vs export default foo
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
  readonly export_name?: SymbolName; // Exported as (if different)
  readonly is_type_only?: boolean;
}

// ============================================================================
// Module Resolution Types
// ============================================================================

/**
 * Resolved module information
 */
export interface ResolvedModule {
  readonly module_path: ModulePath;
  readonly file_path?: string; // Resolved file path
  readonly is_external?: boolean; // Node module vs local
  readonly is_builtin?: boolean; // Node builtin module
  readonly package_name?: string; // NPM package name
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

// ============================================================================
// Type Guards
// ============================================================================

export function is_named_import(imp: Import): imp is NamedImport {
  return imp.kind === "named";
}

export function is_default_import(imp: Import): imp is DefaultImport {
  return imp.kind === "default";
}

export function is_namespace_import(imp: Import): imp is NamespaceImport {
  return imp.kind === "namespace";
}

export function is_side_effect_import(imp: Import): imp is SideEffectImport {
  return imp.kind === "side_effect";
}

export function is_named_export(exp: Export): exp is NamedExport {
  return exp.kind === "named";
}

export function is_default_export(exp: Export): exp is DefaultExport {
  return exp.kind === "default";
}

export function is_namespace_export(exp: Export): exp is NamespaceExport {
  return exp.kind === "namespace";
}

export function is_re_export(exp: Export): exp is ReExport {
  return exp.kind === "reexport";
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all imported symbols from an import
 */
export function get_imported_symbols(imp: Import): SymbolName[] {
  switch (imp.kind) {
    case "named":
      return imp.imports.map((i) => i.alias || i.name);
    case "default":
      return [imp.name];
    case "namespace":
      return []; // Namespace imports don't import specific symbols
    case "side_effect":
      return [];
  }
}

/**
 * Get all exported symbols from an export
 */
export function get_exported_symbols(exp: Export): SymbolName[] {
  switch (exp.kind) {
    case "named":
      return exp.exports.map((e) => e.export_name || e.local_name);
    case "default":
      return [exp.symbol || ("default" as SymbolName)];
    case "namespace":
      return []; // Namespace exports don't have specific symbols
    case "reexport":
      return exp.exports.map((e) => e.export_name || e.source_name);
  }
}

/**
 * Check if an import imports a specific symbol
 */
export function imports_symbol(imp: Import, symbol: SymbolName): boolean {
  switch (imp.kind) {
    case "named":
      return imp.imports.some((i) => i.name === symbol || i.alias === symbol);
    case "default":
      return imp.name === symbol;
    case "namespace":
      return false; // Namespace imports all symbols
    case "side_effect":
      return false;
  }
}

/**
 * Check if an export exports a specific symbol
 */
export function exports_symbol(exp: Export, symbol: SymbolName): boolean {
  switch (exp.kind) {
    case "named":
      return exp.exports.some(
        (e) => e.local_name === symbol || e.export_name === symbol
      );
    case "default":
      return exp.symbol === symbol || symbol === ("default" as SymbolName);
    case "namespace":
      return true; // Namespace exports all symbols
    case "reexport":
      return exp.exports.some(
        (e) => e.source_name === symbol || e.export_name === symbol
      );
  }
}

/**
 * Create a simple named import
 */
export function create_named_import(
  source: ModulePath,
  imports: Array<{ name: SymbolName; alias?: SymbolName }>,
  location: Location,
  language: Language
): NamedImport {
  return {
    kind: "named",
    source,
    imports: imports.map((i) => ({
      name: i.name,
      alias: i.alias,
    })),
    location,
    language,
    node_type: "import_statement",
  };
}

/**
 * Create a simple named export
 */
export function create_named_export(
  exports: Array<{ local_name: SymbolName; export_name?: SymbolName }>,
  location: Location,
  language: Language
): NamedExport {
  return {
    kind: "named",
    exports: exports.map((e) => ({
      local_name: e.local_name,
      export_name: e.export_name,
    })),
    location,
    language,
    node_type: "export_statement",
  };
}
