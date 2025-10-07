/**
 * Direct Scope Processing
 *
 * Processes tree-sitter captures directly into LexicalScope objects
 * in a single pass. This runs BEFORE definition and reference processing
 * since all captures need scope context.
 */

import type {
  LexicalScope,
  ScopeId,
  SymbolName,
  Location,
} from "@ariadnejs/types";
import { module_scope, scope_string, ScopeType } from "@ariadnejs/types";
import { ParsedFile } from "../file_utils";
import { CaptureNode, ProcessingContext, SemanticCategory } from "../semantic_index";

/**
 * Process captures directly into LexicalScope objects (single pass)
 * This MUST run before definition and reference processing
 */
export function process_scopes(
  captures: CaptureNode[],
  file: ParsedFile
): Map<ScopeId, LexicalScope> {
  const scopes = new Map<ScopeId, LexicalScope>();

  // Create root module scope for the file
  const file_location: Location = {
    file_path: file.file_path,
    start_line: 1,
    start_column: 1,
    end_line: file.file_lines,
    end_column: file.file_end_column,
  };

  const root_scope_id = module_scope(file_location);
  const root_scope: LexicalScope = {
    id: root_scope_id,
    parent_id: null,
    name: null,
    type: "module",
    location: file_location,
    child_ids: [],
  };
  scopes.set(root_scope_id, root_scope);

  // Sort captures by location for proper nesting
  const sorted_captures = [...captures].sort((a, b) =>
    compare_locations(a.location, b.location)
  );

  // Process each capture that creates a scope
  for (const capture of sorted_captures) {
    if (capture.category !== SemanticCategory.SCOPE) continue;

    const location = capture.location;
    const scope_type = map_capture_to_scope_type(capture);

    if (!scope_type) continue;

    // Create scope ID based on type and location
    const scope_id = create_scope_id(scope_type, location);

    // Skip if scope already exists (e.g., manually created root scope)
    if (scopes.has(scope_id)) {
      continue;
    }

    // Find parent scope using position containment
    const parent = find_containing_scope(location, root_scope_id, scopes);

    // Block scopes don't have a meaningful name
    const symbol_name = capture.text || (scope_type === "block" ? "" : undefined);
    if (!symbol_name && scope_type !== "block") {
      throw new Error(`Symbol name not found at location: ${location.start_line}:${location.start_column}`);
    }
    // Create the scope with parent reference
    const scope: LexicalScope = {
      id: scope_id,
      parent_id: parent.id,
      name: (symbol_name || "") as SymbolName,
      type: scope_type,
      location,
      child_ids: [],
    };

    // Update parent's child IDs
    const updated_parent = {
      ...parent,
      child_ids: [...parent.child_ids, scope_id],
    };
    scopes.set(parent.id, updated_parent);

    scopes.set(scope_id, scope);
  }

  return scopes;
}

/**
 * Create processing context with precomputed depths
 */
export function create_processing_context(
  scopes: Map<ScopeId, LexicalScope>,
  captures: CaptureNode[]
): ProcessingContext {
  const scope_depths = new Map<ScopeId, number>();
  const root_scope_id = find_root_scope(scopes);

  // Precompute all depths once
  for (const scope of scopes.values()) {
    scope_depths.set(scope.id, compute_scope_depth(scope, scopes));
  }

  return {
    captures,
    scopes,
    scope_depths,
    root_scope_id,
    get_scope_id(location: Location): ScopeId {
      // Find the deepest scope that contains this location
      // If multiple scopes have the same depth, prefer the smallest one
      let best_scope_id = root_scope_id;
      let best_depth = -1;
      let best_area = Infinity;

      for (const scope of scopes.values()) {
        if (!location_contains(scope.location, location)) {
          continue;
        }

        const depth = scope_depths.get(scope.id)!;
        const area = calculate_area(scope.location);

        if (depth > best_depth || (depth === best_depth && area < best_area)) {
          best_scope_id = scope.id;
          best_depth = depth;
          best_area = area;
        }
      }

      return best_scope_id;
    },
  };
}

/**
 * Map capture entity to scope type
 */
function map_capture_to_scope_type(capture: CaptureNode): ScopeType | null {
  switch (capture.entity) {
    case "module":
    case "namespace":
      return "module";
    case "class":
    case "interface":
    case "enum":
      return "class";
    case "function":
    case "closure":
      return "function";
    case "method":
      return "method";
    case "constructor":
      return "constructor";
    case "block":
      return "block";
    default:
      // Check if it's a scope category with block type
      if (capture.category === SemanticCategory.SCOPE) {
        return "block";
      }
      return null;
  }
}

/**
 * Create a scope ID based on type and location
 */
function create_scope_id(type: ScopeType, location: Location): ScopeId {
  return scope_string({ type, location });
}

/**
 * Find the containing scope for a location
 */
function find_containing_scope(
  location: Location,
  root_scope_id: ScopeId,
  scopes: Map<ScopeId, LexicalScope>
): LexicalScope {
  let best_scope = scopes.get(root_scope_id)!;
  let smallest_area = Infinity;

  for (const scope of scopes.values()) {
    if (location_contains(scope.location, location)) {
      const area = calculate_area(scope.location);
      if (area < smallest_area) {
        smallest_area = area;
        best_scope = scope;
      }
    }
  }

  return best_scope;
}

/**
 * Compare two locations for sorting
 */
function compare_locations(a: Location, b: Location): number {
  if (a.start_line !== b.start_line) return a.start_line - b.start_line;
  if (a.start_column !== b.start_column) return a.start_column - b.start_column;
  if (a.end_line !== b.end_line) return a.end_line - b.end_line;
  return a.end_column - b.end_column;
}

/**
 * Check if a location contains another location
 * For well-formed nested scopes, checking the start position is usually sufficient,
 * but we verify both start and end for correctness.
 */
function location_contains(container: Location, contained: Location): boolean {
  // Check if contained START is within container bounds
  if (
    contained.start_line < container.start_line ||
    contained.start_line > container.end_line
  ) {
    return false;
  }

  // If on the start line, check column is at or after container start
  if (
    contained.start_line === container.start_line &&
    contained.start_column < container.start_column
  ) {
    return false;
  }

  // Check if contained END is within container bounds
  if (
    contained.end_line < container.start_line ||
    contained.end_line > container.end_line
  ) {
    return false;
  }

  // If on the end line, check column is at or before container end
  if (
    contained.end_line === container.end_line &&
    contained.end_column > container.end_column
  ) {
    return false;
  }

  return true;
}

/**
 * Calculate area of a location (for finding smallest containing scope)
 * Uses a position-based calculation for accurate ordering across multi-line spans
 */
function calculate_area(location: Location): number {
  // Convert start and end to single position numbers
  // Each line is worth 10000 units to ensure column positions don't overflow
  const start_pos = location.start_line * 10000 + location.start_column;
  const end_pos = location.end_line * 10000 + location.end_column;
  return end_pos - start_pos;
}

/**
 * Find the root scope in a collection
 */
function find_root_scope(scopes: Map<ScopeId, LexicalScope>): ScopeId {
  for (const scope of scopes.values()) {
    if (scope.parent_id === null) {
      return scope.id;
    }
  }
  throw new Error("No root scope found");
}

/**
 * Compute the depth of a scope in the tree
 */
function compute_scope_depth(
  scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>
): number {
  let depth = 0;
  let current_id = scope.parent_id;
  const visited = new Set<ScopeId>(); // Prevent infinite loops

  while (current_id && !visited.has(current_id)) {
    visited.add(current_id);
    const parent = scopes.get(current_id);
    if (parent) {
      depth++;
      current_id = parent.parent_id;
    } else {
      break;
    }
  }
  return depth;
}
