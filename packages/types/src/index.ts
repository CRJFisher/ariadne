// Export new CodeGraph architecture types
export * from './immutable';
export * from './aliases';
export * from './branded-types';  // Export all branded types and utilities
export * from './common';
export * from './codegraph';

// New unified types from task 11.100.0.5
export * from './base-query-types';  // Core base types for query system
export * from './unified-call-types';  // Unified call graph types
export * from './unified-symbol-scope-types';  // Unified symbol and scope types
export * from './unified-import-export-types';  // Unified import/export types
export * from './unified-type-analysis-types';  // Unified type analysis types
export * from './unified-inheritance-types';  // Unified inheritance types
export * from './query-integration-types';  // Query integration types
export * from './type-validation';  // Type validation layer

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
  ResolvedNamespaceType
} from './modules';

export * from './calls';
export * from './classes';

// Export types but exclude the deprecated ImportedClassInfo
export {
  // ImportedClassInfo,  // Use ImportedTypeInfo from './import_export' instead
  TypeKind,
  TypeInfo,
  VariableType,
  TypeDefinition,
  TypeGraph,
  TypeEdge,
  TypeIndex
} from './types';

export * from './symbols';
export * from './scopes';
export * from './definitions';
export * from './errors';

// Export all the new consolidated import/export types
export * from './import_export';