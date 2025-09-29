/**
 * Type Tracking Module
 *
 * Exports public API for type tracking functionality
 */

export { resolve_type_tracking } from "./type_tracking";

export type {
  ResolvedTypeTracking,
  TypeFlowGraph,
  TypeFlowEdge,
} from "./type_tracking";

// Re-export from semantic_index
export type { LocalTypeTracking } from "../../../index_single_file/references/type_tracking";
