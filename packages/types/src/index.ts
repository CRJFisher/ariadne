// Export new CodeGraph architecture types
export * from "./immutable";
export * from "./aliases";

// Export everything from branded-types (takes precedence)
export * from "./branded-types";

// Export from common, excluding types that conflict with branded-types
export * from "./common";

export * from "./codegraph";

// Export symbol utilities
export * from "./symbol_utils";

// New unified types from task 11.100.0.5

// Export from query (no conflicts)
export * from "./query";

// Export from calls (no conflicts)
export * from "./calls";

// Export from symbol_scope, excluding types that conflict with symbols module
export * from "./symbol_scope";

// Export from import_export (no conflicts expected)
export * from "./import_export";

// Export from type_analysis, excluding types that conflict with definitions
export * from "./type_analysis";

// Export from inheritance (no conflicts)
export * from "./inheritance";

// Export from query_integration, excluding types that conflict with type_validation
export * from "./query_integration";

// Export from type_validation (takes precedence for validation types)
export * from "./type_validation";

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

export * from "./symbols";
export * from "./scopes";
export * from "./definitions";
export * from "./errors";
