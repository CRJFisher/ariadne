import type {
  ResolvedTypeDefinition,
  LocalTypeDefinition,
  LocalMemberInfo,
  ResolvedMemberInfo,
} from "./types";
import type { TypeId, SymbolId, SymbolName } from "@ariadnejs/types";

/**
 * Create a symbol ID for a type member
 */
function create_member_symbol(
  member_name: SymbolName,
  type_id: TypeId
): SymbolId {
  return `${type_id}.${member_name}` as SymbolId;
}

/**
 * Convert LocalMemberInfo to ResolvedMemberInfo
 */
function convert_local_member(
  member_name: SymbolName,
  local_member: LocalMemberInfo,
  source_type: TypeId,
  is_inherited: boolean = false,
  inherited_from?: TypeId
): ResolvedMemberInfo {
  return {
    symbol_id: create_member_symbol(member_name, source_type),
    name: member_name,
    kind: local_member.kind,
    location: local_member.location,
    is_static: local_member.is_static,
    is_optional: local_member.is_optional,
    type_id: undefined, // Will be resolved in later phase
    inherited_from: inherited_from,
  };
}

/**
 * Resolve type members including inherited members
 *
 * @param type_id - The TypeId being resolved
 * @param local_definition - The local type definition with direct members
 * @param type_hierarchy - Map of TypeId to direct parent TypeIds
 * @param all_definitions - Map of all TypeId to LocalTypeDefinition for inheritance lookup
 */
export function resolve_type_members(
  type_id: TypeId,
  local_definition: LocalTypeDefinition,
  type_hierarchy: Map<TypeId, TypeId[]>,
  all_definitions?: Map<TypeId, LocalTypeDefinition>
): ResolvedTypeDefinition {
  const direct_members = local_definition.direct_members || new Map();
  const all_members = new Map<SymbolName, ResolvedMemberInfo>();
  const inherited_members = new Map<SymbolName, ResolvedMemberInfo>();

  // Step 1: Add direct members (highest priority)
  for (const [member_name, member_info] of Array.from(direct_members.entries())) {
    const resolved_member = convert_local_member(
      member_name,
      member_info,
      type_id,
      false
    );
    all_members.set(member_name, resolved_member);
  }

  // Step 2: Add inherited members (lower priority)
  if (all_definitions) {
    const ancestors = compute_inheritance_chain(type_id, type_hierarchy);

    // Process ancestors in reverse order (most distant first)
    // This ensures closer ancestors override more distant ones
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const ancestor_id = ancestors[i];
      const ancestor_def = all_definitions.get(ancestor_id);

      if (ancestor_def && ancestor_def.direct_members) {
        for (const [member_name, member_info] of Array.from(ancestor_def.direct_members.entries())) {
          // Only add if not already defined (direct members take precedence)
          if (!all_members.has(member_name)) {
            const inherited_member = convert_local_member(
              member_name,
              member_info,
              ancestor_id,
              true,
              ancestor_id
            );
            all_members.set(member_name, inherited_member);
            inherited_members.set(member_name, inherited_member);
          }
        }
      }
    }
  }

  // Get parent types from hierarchy
  const parent_types = type_hierarchy.get(type_id) || [];

  // Compute child types (reverse lookup)
  const child_types: TypeId[] = [];
  for (const [child_id, parents] of Array.from(type_hierarchy.entries())) {
    if (parents.includes(type_id)) {
      child_types.push(child_id);
    }
  }

  return {
    type_id,
    name: local_definition.name,
    kind: local_definition.kind,
    definition_location: local_definition.location,
    file_path: local_definition.file_path,
    all_members,
    base_types: parent_types,
    derived_types: child_types,
    // Additional fields for compatibility with tests
    direct_members,
    inherited_members,
    parent_types,
    child_types,
  } as ResolvedTypeDefinition;
}

/**
 * Compute the inheritance chain for a type (all ancestors in order)
 */
function compute_inheritance_chain(
  type_id: TypeId,
  type_hierarchy: Map<TypeId, TypeId[]>
): TypeId[] {
  const visited = new Set<TypeId>();
  const chain: TypeId[] = [];

  function visit(current_type: TypeId) {
    if (visited.has(current_type)) {
      // Circular inheritance - skip
      return;
    }

    visited.add(current_type);
    const parents = type_hierarchy.get(current_type) || [];

    for (const parent of parents) {
      visit(parent);
      if (!chain.includes(parent)) {
        chain.push(parent);
      }
    }
  }

  visit(type_id);
  return chain;
}
