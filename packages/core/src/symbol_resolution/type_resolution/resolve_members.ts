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
  // TODO: Implement in later task - returning minimal structure for now
  return {
    type_id,
    name: local_definition.name,
    kind: local_definition.kind,
    location: local_definition.location,
    direct_members: local_definition.direct_members || new Map(),
    all_members: local_definition.direct_members || new Map(),
    inherited_members: new Map(),
    parent_types: [],
    child_types: [],
  };
}