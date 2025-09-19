import type { LocalTypeFlow } from "./types";
import type { Location, TypeId } from "@ariadnejs/types";

/**
 * Track type flow through assignments and function calls
 */
export function track_type_flow(
  type_flows: LocalTypeFlow[],
  resolved_types: Map<Location, TypeId>
): Map<Location, TypeId> {
  // TODO: Implement in later task
  throw new Error("Not implemented");
}