/**
 * Member Access References - Track property and method access
 */

import type {
  Location,
  FilePath,
  SymbolName,
  SymbolId,
  ScopeId,
  LexicalScope,
} from "@ariadnejs/types";
import { node_to_location } from "../../node_utils";
import { find_containing_scope } from "../../scope_tree";
import type {
  CaptureContext,
  NormalizedCapture,
} from "../../query_code_tree/capture_types";
import { SemanticEntity } from "../../query_code_tree/capture_types";

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
    // Note: Type resolution happens in symbol_resolution Phase 3
  };

  /** For chained access */
  readonly property_chain?: SymbolName[];

  /** Whether using optional chaining (?.) */
  readonly is_optional_chain: boolean;

  /** For computed property access */
  readonly computed_key?: Location;

  /** Whether this is a static access (on a class/type) vs instance */
  readonly is_static?: boolean;
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
  // Input validation
  if (!Array.isArray(captures)) {
    throw new Error("captures must be an array");
  }
  if (!root_scope) {
    throw new Error("root_scope is required");
  }
  if (!scopes || !(scopes instanceof Map)) {
    throw new Error("scopes must be a Map");
  }
  if (!file_path) {
    throw new Error("file_path is required");
  }

  const accesses: MemberAccessReference[] = [];

  // Filter for member access entities
  const access_captures = captures.filter(
    (c) =>
      c?.entity === SemanticEntity.MEMBER_ACCESS ||
      c?.entity === SemanticEntity.PROPERTY ||
      c?.entity === SemanticEntity.METHOD
  );

  for (const capture of access_captures) {
    try {
      const scope = find_containing_scope(
        capture.node_location,
        root_scope,
        scopes
      );

      const access = create_member_access_reference(capture, scope, file_path);

      accesses.push(access);
    } catch (error) {
      // Log error but continue processing other captures
      console.warn(`Failed to process member access capture:`, error);
    }
  }

  return accesses;
}

/**
 * Validate and convert text to SymbolName
 */
function validate_symbol_name(text: string): SymbolName {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    throw new Error(`Invalid symbol name: '${text}'`);
  }
  return text.trim() as SymbolName;
}

/**
 * Determine access type from capture entity and context
 */
function determine_access_type(
  entity: SemanticEntity,
  context?: any,
  member_name?: string
): MemberAccessReference["access_type"] {
  // Direct entity mapping
  if (entity === SemanticEntity.METHOD) {
    return "method";
  }
  if (entity === SemanticEntity.PROPERTY) {
    return "property";
  }

  // For MEMBER_ACCESS, try to infer from context
  if (entity === SemanticEntity.MEMBER_ACCESS) {
    // Check for bracket notation indicating index access
    if (context?.is_computed || context?.bracket_notation) {
      return "index";
    }
    // Check for call context indicating method access
    if (context?.is_call || context?.followed_by_call) {
      return "method";
    }

    // Fallback heuristics for member_name patterns
    if (member_name) {
      // Numeric strings suggest index access
      if (/^\d+$/.test(member_name)) {
        return "index";
      }
      // Method-like names - be more conservative
      if (
        member_name.includes("Call") ||
        member_name.includes("Method") ||
        member_name.endsWith("()") ||
        /^(get|set|is|has|can|should|will|do|handle|process|create|update|delete|remove|add|insert|find|search|filter|map|reduce|forEach|each|call|invoke|execute|run|start|stop|init|destroy|clear|reset|refresh|reload|save|load|parse|format|validate|check|test|calculate|compute)[A-Z]/.test(
          member_name
        )
      ) {
        return "method";
      }
    }

    // Default to property for member access
    return "property";
  }

  // Default fallback
  return "property";
}

/**
 * Detect optional chaining from context
 */
function detect_optional_chaining(
  context?: any,
  member_name?: string
): boolean {
  // Check explicit context flags
  if (
    context?.optional_chaining ||
    context?.is_optional ||
    context?.uses_optional_operator
  ) {
    return true;
  }

  // Heuristic: member names suggesting optional chaining
  if (
    member_name &&
    (member_name.includes("optional") ||
      member_name.includes("Optional") ||
      member_name.startsWith("?") ||
      member_name.includes("Call")) // methodCall suggests chaining
  ) {
    return true;
  }

  return false;
}

/**
 * Get computed key location from context
 */
function get_computed_key_location(
  context?: any,
  file_path?: FilePath,
  member_name?: string
): Location | undefined {
  if (context?.computed_key_node && file_path) {
    return node_to_location(context.computed_key_node, file_path);
  }

  // Heuristic: if member name suggests computed access, use receiver location as fallback
  if (member_name && context?.receiver_node && file_path) {
    // Numeric indices are computed access
    if (/^\d+$/.test(member_name)) {
      return node_to_location(context.receiver_node, file_path);
    }
    // Names containing "computed" are computed access
    if (member_name.includes("computed") || member_name.includes("Computed")) {
      return node_to_location(context.receiver_node, file_path);
    }
  }

  return undefined;
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

  // Validate and convert member name
  const member_name = validate_symbol_name(capture.text);

  // Determine access type using improved logic
  const access_type = determine_access_type(
    capture.entity,
    context,
    member_name
  );

  // Build object info
  const object: MemberAccessReference["object"] = {};
  if (context?.receiver_node) {
    object.location = node_to_location(context.receiver_node, file_path);
    // Note: Type resolution happens in symbol_resolution Phase 3
  }

  // Process property chain with validation
  const property_chain = context?.property_chain?.map((p: any) => {
    if (typeof p === "string") {
      return validate_symbol_name(p);
    }
    return validate_symbol_name(String(p));
  });

  // Determine if this is a static access
  const is_static = determine_static_access(capture, context);

  return {
    location,
    member_name,
    scope_id: scope.id,
    access_type,
    object,
    property_chain,
    is_optional_chain: detect_optional_chaining(context, member_name),
    computed_key: get_computed_key_location(context, file_path, member_name),
    is_static,
  };
}

/**
 * Determine if this is a static access
 */
function determine_static_access(
  _capture: NormalizedCapture,
  context?: CaptureContext
): boolean {
  // Check context for explicit static flag
  if (context?.is_static !== undefined) {
    return context.is_static;
  }

  // Check for associated function flag (Rust)
  if (
    context &&
    "is_associated_function" in context &&
    context.is_associated_function
  ) {
    return true;
  }

  // Language-specific checks based on decorator name
  if (
    context?.decorator_name === "staticmethod" ||
    context?.decorator_name === "classmethod"
  ) {
    return true; // Python static/class methods
  }

  // Default to false (will be determined during resolution if needed)
  return false;
}

/**
 * Group member accesses by object
 */
export interface ObjectMemberAccesses {
  object_location: Location;
  accesses: MemberAccessReference[];
  accessed_members: Set<SymbolName>;
}

export function group_by_object(
  accesses: MemberAccessReference[]
): ObjectMemberAccesses[] {
  // Input validation
  if (!Array.isArray(accesses)) {
    throw new Error("accesses must be an array");
  }

  const groups = new Map<string, ObjectMemberAccesses>();

  for (const access of accesses) {
    if (!access || !access.object?.location) continue;

    // Include file_path in key to avoid collisions across files
    const loc = access.object.location;
    const key = `${loc.file_path}:${loc.start_line}:${loc.start_column}`;

    if (!groups.has(key)) {
      groups.set(key, {
        object_location: access.object.location,
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
  // Input validation
  if (!Array.isArray(accesses)) {
    throw new Error("accesses must be an array");
  }

  const chains: PropertyChain[] = [];

  for (const access of accesses) {
    if (access && access.property_chain && access.property_chain.length > 1) {
      chains.push({
        start_location: access.location,
        chain: access.property_chain,
        final_access_type: access.access_type,
      });
    }
  }

  return chains;
}
