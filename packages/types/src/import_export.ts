import { ExportName, ModulePath, SymbolName } from "./aliases";
import { Location } from "./common";

/**
 * Import/Export Types - Consolidated Single Source of Truth
 * 
 * This module defines all import and export types for the Ariadne codebase.
 * Types are organized by their use case:
 * - Info types: For extraction and detection during analysis
 * - Statement types: For the public FileAnalysis API
 * - Type-specific: For type tracking and module graph
 */

// =============================================================================
// Core Import/Export Info - Used by extraction and detection
// =============================================================================

/**
 * Information about an import extracted from source code
 * Used during Layer 2 (Local Structure Detection)
 */
export interface ImportInfo {
  /** The imported symbol name */
  readonly name: string;
  /** Module being imported from */
  readonly source: string;
  /** Type of import */
  readonly kind: 'named' | 'default' | 'namespace' | 'dynamic';
  /** Location in source code */
  readonly location: Location;
  /** Local name if renamed (e.g., import { foo as bar }) */
  readonly alias?: string;
  /** TypeScript type-only import */
  readonly is_type_only?: boolean;
  /** For namespace imports (import * as X) */
  readonly namespace_name?: string;
  /** For side-effect only imports (import 'module') */
  readonly is_side_effect_only?: boolean;
}

/**
 * Information about an export extracted from source code
 * Used during Layer 2 (Local Structure Detection)
 */
export interface ExportInfo {
  /** The exported symbol name */
  readonly name: string;
  /** Type of export */
  readonly kind: 'named' | 'default' | 'namespace';
  /** Location in source code */
  readonly location: Location;
  /** Internal name if different from exported name */
  readonly local_name?: string;
  /** TypeScript type-only export */
  readonly is_type_only?: boolean;
  /** Whether this is re-exported from another module */
  readonly is_reexport?: boolean;
  /** Source module for re-exports */
  readonly source?: string;
  /** Export name if different from local name */
  readonly export_name?: string;
}

// =============================================================================
// Public API Types - Used in FileAnalysis
// =============================================================================

/**
 * Import statement in the public FileAnalysis API
 * Simplified view with single symbol per statement
 */
export interface ImportStatement {
  /** Module being imported from */
  readonly source: ModulePath;
  /** Single imported symbol (was symbol_names array) */
  readonly symbol_name?: SymbolName;
  /** Location in source code */
  readonly location: Location;
  /** TypeScript type-only import */
  readonly is_type_import?: boolean;
  /** Whether this is a namespace import (import * as X) */
  readonly is_namespace_import?: boolean;
  /** Namespace name for namespace imports */
  readonly namespace_name?: string;
  /** Side-effect only import (import 'module') */
  readonly is_side_effect_only?: boolean;
}

/**
 * Export statement in the public FileAnalysis API
 * Simplified view with single symbol per statement
 */
export interface ExportStatement {
  /** Single exported symbol (was symbol_names array) */
  readonly symbol_name?: SymbolName;
  /** Location in source code */
  readonly location: Location;
  /** Whether this is a default export */
  readonly is_default?: boolean;
  /** TypeScript type-only export */
  readonly is_type_export?: boolean;
  /** Source module for re-exports */
  readonly source?: ModulePath;
  /** Export name if different from symbol_name */
  readonly export_name?: ExportName;
}

// =============================================================================
// Type Tracking Specific
// =============================================================================

/**
 * Information about an imported type/class/interface
 * Used by the type tracking layer
 */
export interface ImportedTypeInfo {
  /** Name of the imported type */
  readonly type_name: string;
  /** Module the type is imported from */
  readonly source_module: ModulePath;
  /** Local name if renamed */
  readonly local_name?: string;
  /** Whether this is a default import */
  readonly is_default?: boolean;
  /** Whether this is a type-only import */
  readonly is_type_only?: boolean;
  /** Kind of type being imported */
  readonly kind: 'class' | 'interface' | 'type' | 'enum' | 'unknown';
}

/**
 * Information about an exported type/class/interface
 * Used by the type tracking layer
 */
export interface ExportedTypeInfo {
  /** Name of the exported type */
  readonly type_name: string;
  /** Kind of type being exported */
  readonly kind: 'class' | 'interface' | 'type' | 'enum' | 'unknown';
  /** Location in source code */
  readonly location: Location;
  /** Whether this is a default export */
  readonly is_default?: boolean;
  /** Whether this is a type-only export */
  readonly is_type_only?: boolean;
  /** Source module for re-exports */
  readonly source?: ModulePath;
}

// =============================================================================
// Module Graph Specific
// =============================================================================

/**
 * Import information for module dependency graph
 * Aggregates all imports from one module to another
 */
export interface ModuleImport {
  /** Module being imported from */
  readonly source: ModulePath;
  /** All imported symbols */
  readonly symbols: readonly string[];
  /** Static or dynamic import */
  readonly kind: 'static' | 'dynamic';
  /** Location of import statement */
  readonly location?: Location;
  /** Whether all imports are type-only */
  readonly is_type_only?: boolean;
  /** Whether this is a namespace import */
  readonly is_namespace?: boolean;
  /** Namespace name if applicable */
  readonly namespace_name?: string;
}

/**
 * Export information for module dependency graph
 * Aggregates all exports from a module
 */
export interface ModuleExport {
  /** All exported symbols */
  readonly symbols: readonly string[];
  /** Type of exports */
  readonly kind: 'named' | 'default' | 'namespace';
  /** Location of export statement */
  readonly location?: Location;
  /** Whether all exports are type-only */
  readonly is_type_only?: boolean;
  /** Whether these are re-exports */
  readonly is_reexport?: boolean;
  /** Source module for re-exports */
  readonly source?: ModulePath;
}

// =============================================================================
// Deprecated Types - For Backward Compatibility
// =============================================================================

/**
 * @deprecated Use ImportStatement with symbol_name instead
 * Old import statement with array of symbols
 */
export interface LegacyImportStatement {
  readonly source: ModulePath;
  readonly symbol_names: readonly SymbolName[];
  readonly location: Location;
  readonly is_type_import?: boolean;
  readonly is_namespace_import?: boolean;
  readonly namespace_name?: string;
}

/**
 * @deprecated Use ExportStatement with symbol_name instead
 * Old export statement with array of symbols
 */
export interface LegacyExportStatement {
  readonly symbol_names: readonly SymbolName[];
  readonly location: Location;
  readonly is_default?: boolean;
  readonly is_type_export?: boolean;
  readonly source?: ModulePath;
}
