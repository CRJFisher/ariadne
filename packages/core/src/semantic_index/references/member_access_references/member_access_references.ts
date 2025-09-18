/**
 * Member Access References - Track property and method access
 */

import type {
  Location,
  FilePath,
  SymbolName,
  ScopeId,
  LexicalScope,
} from "@ariadnejs/types";
import { node_to_location } from "../../../ast/node_utils";
import { find_containing_scope } from "../../scope_tree";
import type { NormalizedCapture } from "../../capture_types";
import { SemanticEntity } from "../../capture_types";
import type { TypeInfo } from "../type_tracking";

/**
 * Member access reference - Property or method access on an object
 */
export interface MemberAccessReference {
  /** Access location */
  readonly location: Location;

  /** Member name */
  readonly member_name: SymbolName;

  /** Containing scope */
  readonly scope_id: ScopeId;

  /** Access type */
  readonly access_type: "property" | "method" | "index";

  /** Object being accessed */
  readonly object: {
    location?: Location;
    type?: TypeInfo;
  };

  /** For chained access */
  readonly property_chain?: SymbolName[];

  /** Whether using optional chaining (?.) */
  readonly is_optional_chain: boolean;

  /** For computed property access */
  readonly computed_key?: Location;
}

/**
 * Process member access references
 */
export function process_member_access_references(
  captures: NormalizedCapture[],
  root_scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>,
  file_path: FilePath
): MemberAccessReference[] {
  const accesses: MemberAccessReference[] = [];

  // Filter for member access entities
  const access_captures = captures.filter(c =>
    c.entity === SemanticEntity.MEMBER_ACCESS ||
    c.entity === SemanticEntity.PROPERTY ||
    c.entity === SemanticEntity.METHOD
  );

  for (const capture of access_captures) {
    const scope = find_containing_scope(
      capture.node_location,
      root_scope,
      scopes
    );

    const access = create_member_access_reference(
      capture,
      scope,
      file_path
    );

    accesses.push(access);
  }

  return accesses;
}

/**
 * Create a member access reference
 */
function create_member_access_reference(
  capture: NormalizedCapture,
  scope: LexicalScope,
  file_path: FilePath
): MemberAccessReference {
  const context = capture.context;
  const location = capture.node_location;
  const member_name = capture.text as SymbolName;

  // Determine access type
  let access_type: MemberAccessReference["access_type"] = "property";
  if (capture.entity === SemanticEntity.METHOD) {
    access_type = "method";
  }
  // Would need to check for bracket notation for "index"

  // Build object info
  const object: MemberAccessReference["object"] = {};
  if (context?.receiver_node) {
    object.location = node_to_location(context.receiver_node, file_path);
    // Type would come from type inference
  }

  return {
    location,
    member_name,
    scope_id: scope.id,
    access_type,
    object,
    property_chain: context?.property_chain?.map(p => p as SymbolName),
    is_optional_chain: false, // Would need syntax analysis
    computed_key: undefined, // Would need bracket notation analysis
  };
}

/**
 * Group member accesses by object
 */
export interface ObjectMemberAccesses {
  object_location: Location;
  object_type?: TypeInfo;
  accesses: MemberAccessReference[];
  accessed_members: Set<SymbolName>;
}

export function group_by_object(
  accesses: MemberAccessReference[]
): ObjectMemberAccesses[] {
  const groups = new Map<string, ObjectMemberAccesses>();

  for (const access of accesses) {
    if (!access.object.location) continue;

    const key = `${access.object.location.line}:${access.object.location.column}`;

    if (!groups.has(key)) {
      groups.set(key, {
        object_location: access.object.location,
        object_type: access.object.type,
        accesses: [],
        accessed_members: new Set(),
      });
    }

    const group = groups.get(key)!;
    group.accesses.push(access);
    group.accessed_members.add(access.member_name);
  }

  return Array.from(groups.values());
}

/**
 * Find all method calls on a specific type
 */
export function find_method_calls_on_type(
  accesses: MemberAccessReference[],
  type_name: SymbolName
): MemberAccessReference[] {
  return accesses.filter(a =>
    a.access_type === "method" &&
    a.object.type?.type_name === type_name
  );
}

/**
 * Find property chains (e.g., obj.prop1.prop2.method())
 */
export interface PropertyChain {
  start_location: Location;
  chain: SymbolName[];
  final_access_type: "property" | "method" | "index";
}

export function find_property_chains(
  accesses: MemberAccessReference[]
): PropertyChain[] {
  const chains: PropertyChain[] = [];

  for (const access of accesses) {
    if (access.property_chain && access.property_chain.length > 1) {
      chains.push({
        start_location: access.location,
        chain: access.property_chain,
        final_access_type: access.access_type,
      });
    }
  }

  return chains;
}

/**
 * Find potential null pointer dereferences
 */
export interface PotentialNullDereference {
  location: Location;
  member_access: MemberAccessReference;
  reason: "nullable_type" | "no_null_check" | "after_null_assignment";
}

export function find_potential_null_dereferences(
  accesses: MemberAccessReference[]
): PotentialNullDereference[] {
  const potential_issues: PotentialNullDereference[] = [];

  for (const access of accesses) {
    // Skip if using optional chaining
    if (access.is_optional_chain) continue;

    // Check if object type is nullable
    if (access.object.type?.is_nullable) {
      potential_issues.push({
        location: access.location,
        member_access: access,
        reason: "nullable_type",
      });
    }

    // Additional checks would require control flow analysis
  }

  return potential_issues;
}