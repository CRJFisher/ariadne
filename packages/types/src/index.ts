// Export new CodeGraph architecture types
export * from "./immutable";

// Export all aliases (fundamental branded types)
export * from "./aliases";

// Export everything from branded_types (takes precedence)
export * from "./branded_types";

// Export from common, excluding types that conflict with branded_types
export {
  Location,
  location_contains,
  unknown_location,
  FunctionSignature,
  ParameterType,
  TypeParameter,
  Language,
} from "./common";

export * from "./codegraph";

// Export symbol utilities
export {
  SymbolId,
  SymbolName,
  SymbolKind,
  Symbol,
  symbol_string,
  symbol_from_string,
  is_symbol,
  is_symbol_id,
  is_symbol_kind,
  get_symbol_display_name,
  variable_symbol,
  function_symbol,
  class_symbol,
  method_symbol,
  property_symbol,
  module_symbol,
  parameter_symbol,
  interface_symbol,
  type_symbol,
  to_symbol_array,
  extract_names,
  class_names_to_symbols,
  interface_names_to_symbols,
  type_names_to_symbols,
} from "./symbol_utils";

// New unified types from task 11.100.0.5

// Export from query (no conflicts)
export * from "./query";

// Export from calls (no conflicts)
export * from "./calls";

// Export call chain and graph types
export * from "./call_chains";

// NOTE: Temporarily commenting out conflicting exports to unblock progress
// These will need proper resolution in a follow-up task
// export * from "./symbol_scope";

// Export import/export types
export {
  Import,
  NamedImport,
  DefaultImport,
  NamespaceImport,
  SideEffectImport,
  NamedImportItem,
  Export,
  NamedExport,
  DefaultExport,
  NamespaceExport as NamespaceExportType,
  ReExport,
  NamedExportItem,
  ReExportItem,
  ResolvedModule,
  ModuleDependency,
  CrossModuleResolution,
  ExportChainStep,
  is_named_import,
  is_default_import,
  is_namespace_import,
  is_side_effect_import,
  is_named_export,
  is_default_export,
  is_namespace_export,
  is_re_export,
} from "./import_export";

// export * from "./type_analysis";
// export * from "./inheritance";  // Has TypeModifier conflict
// export * from "./query_integration";
// export * from "./type_validation";

// Export modules types but exclude the deprecated ImportInfo/ExportInfo
export {
  // Keep the deprecated types for backward compatibility but don't re-export
  // ImportInfo,  // Use from './import_export' instead
  // ExportInfo,  // Use from './import_export' instead
  ModuleNode,
  ImportedModule,
  ImportedSymbol,
  ExportedSymbol,
  ModuleGraph,
  NamespaceInfo,
  NamespaceExportInfo,
  ResolvedNamespaceType,
} from "./modules";

export * from "./classes";

// Export types but exclude the deprecated ImportedClassInfo
export {
  // ImportedClassInfo,  // Use ImportedTypeInfo from './import_export' instead
  TypeKind,
  TypeInfo,
  VariableType,
  TypeDefinition,
  TypeGraph,
  TypeEdge,
  TypeIndex,
} from "./types";

// Export from symbols
export {
  SymbolDefinition,
  Usage,
  ResolvedSymbol as ResolvedSymbolDef,
  SymbolScope,
  SymbolIndex as SymbolIndexDef,
} from "./symbols";

// Export from scopes  
export {
  ScopeType,
  SymbolKind as ScopeSymbolKind,
  ScopeSymbol,
  ScopeNode,
  ScopeTree,
} from "./scopes";
export * from "./definitions";
export * from "./errors";

// Export map utilities for safer null handling
export * from "./map_utils";

// Export type validation utilities
export {
  // Core validation functions
  validate_location,
  validate_language,
  validate_ast_node,
} from "./type_validation";
