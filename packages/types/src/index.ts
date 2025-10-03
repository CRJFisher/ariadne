// Export new CodeGraph architecture types
export * from "./immutable";

// Export all common
export * from "./common";
// Export location_key function specifically
export { location_key } from "./common";

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

export * from "./classes";

// Export from symbols
export * from "./semantic_index";

export * from "./symbol_definitions";

// Export from scopes
export * from "./scopes";

// Export definition types
export * from "./symbol_definitions";
export * from "./symbol_references";
export * from "./errors";

// Export TypeInfo from semantic_index (the new one with TypeId)
export { type TypeInfo } from "./semantic_index";

// Export type kind enum
export { TypeKind } from "./type_kind";

// Export type aliases
export * from "./aliases";
