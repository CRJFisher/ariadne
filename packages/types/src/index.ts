// Export new CodeGraph architecture types
export * from './immutable';
export * from './aliases';
export * from './branded-types';  // Export all branded types and utilities
export * from './common';
export * from './codegraph';

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