/**
 * Type Registry Module
 *
 * Exports public API for type registry functionality
 */

export {
  build_global_type_registry,
  build_type_registry
} from "./type_registry";

export type {
  GlobalTypeRegistry,
  ResolvedTypeDefinition,
  TypeHierarchyGraph,
  ResolvedMemberInfo
} from "../types";