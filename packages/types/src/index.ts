// Export new CodeGraph architecture types
export * from "./immutable";

// Export all common
export * from "./common";

// Export branded types from their new locations
export {
  ReceiverName,
  MODULE_CONTEXT,
  ModuleContext,
  CallerContext,
  ResolvedTypeKind,
  CallType,
} from "./calls";

export { ModulePath, NamespaceName } from "./import_export";

export { TypeExpression, TrackedType } from "./type_analysis";

// Export from common, excluding types that conflict with branded_types
export { Location, Language } from "./common";

export * from "./codegraph";

// Export symbol utilities
export * from "./symbol";

// Export type identification system
export * from "./type_id";

// Export from query (no conflicts)
export * from "./query";

// Export from calls (no conflicts)
export * from "./calls";

// Export call chain and graph types
export * from "./call_chains";

// Export import/export types
export * from "./import_export";

// Export modules types but exclude the deprecated ImportInfo/ExportInfo
export * from "./modules";

export * from "./classes";

// Export types but exclude the deprecated ImportedClassInfo
export * from "./types";

// Export from symbols
export * from "./semantic_index";

// Export from scopes
export * from "./scopes";
export * from "./definitions";
export * from "./errors";

// Export TypeInfo from semantic_index (the new one with TypeId)
export { type TypeInfo } from "./semantic_index";
