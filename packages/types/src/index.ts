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

// Export from query (excluding Resolution/ResolutionConfidence which conflict with symbol_references)
export {
  ASTNode,
  SemanticNode,
  QueryCapture,
  QueryMetadata,
  QueryResult,
  QueryError,
  QueryErrorKind,
  QueryResolutionReason,
  is_ast_node,
  is_semantic_node,
  is_query_capture,
  is_query_result,
  is_query_error,
  resolve_high,
  resolve_medium,
  resolve_low,
  resolve_failed,
  create_query_error,
} from "./query";

// Export from calls (no conflicts)
export * from "./calls";

// Export call chain and graph types
export * from "./call_chains";

// Export import/export types
export * from "./import_export";

export * from "./classes";

// Export from symbols
export * from "./index_single_file";

export * from "./symbol_definitions";

// Export from scopes
export * from "./scopes";

// Export definition types
export * from "./symbol_definitions";
export * from "./symbol_references";
export * from "./errors";

// Export TypeInfo from index_single_file (the new one with TypeId)
export { type TypeInfo } from "./index_single_file";

// Export type kind enum
export { TypeKind } from "./type_kind";

// Export type aliases
export * from "./aliases";
