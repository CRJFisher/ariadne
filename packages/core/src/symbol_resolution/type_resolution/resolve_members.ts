import type { ResolvedTypeDefinition, LocalTypeDefinition } from "./types";
import type { TypeId } from "@ariadnejs/types";

/**
 * Resolve type members including inherited members
 */
export function resolve_type_members(
  type_id: TypeId,
  local_definition: LocalTypeDefinition,
  type_hierarchy: Map<TypeId, TypeId[]>
): ResolvedTypeDefinition {
  // TODO: Implement in later task
  throw new Error("Not implemented");
}