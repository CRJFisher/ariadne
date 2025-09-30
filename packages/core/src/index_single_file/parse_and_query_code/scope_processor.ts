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
  FilePath,
  Language
} from "@ariadnejs/types";
import {
  module_scope,
  function_scope,
  class_scope,
  block_scope,
  scope_string,
  ScopeType
} from "@ariadnejs/types";
import type { QueryCapture } from "tree-sitter";

/**
 * Core semantic categories
 */
export enum SemanticCategory {
  SCOPE = "scope",
  DEFINITION = "definition",
  REFERENCE = "reference",
  IMPORT = "import",
  EXPORT = "export",
  TYPE = "type",
  ASSIGNMENT = "assignment",
  RETURN = "return",
  DECORATOR = "decorator",
  MODIFIER = "modifier",
}

/**
 * Semantic entity types (normalized across languages)
 */
export enum SemanticEntity {
  // Scopes
  MODULE = "module",
  CLASS = "class",
  FUNCTION = "function",
  METHOD = "method",
  CONSTRUCTOR = "constructor",
  BLOCK = "block",
  CLOSURE = "closure",
  INTERFACE = "interface",
  ENUM = "enum",
  NAMESPACE = "namespace",

  // Definitions
  VARIABLE = "variable",
  CONSTANT = "constant",
  PARAMETER = "parameter",
  FIELD = "field",
  PROPERTY = "property",
  TYPE_PARAMETER = "type_parameter",
  ENUM_MEMBER = "enum_member",

  // Types
  TYPE = "type",
  TYPE_ALIAS = "type_alias",
  TYPE_ANNOTATION = "type_annotation",
  TYPE_PARAMETERS = "type_parameters",
  TYPE_ASSERTION = "type_assertion",
  TYPE_CONSTRAINT = "type_constraint",
  TYPE_ARGUMENT = "type_argument",

  // References
  CALL = "call",
  MEMBER_ACCESS = "member_access",
  TYPE_REFERENCE = "type_reference",
  TYPEOF = "typeof",

  // Special
  THIS = "this",
  SUPER = "super",
  IMPORT = "import",

  // Modifiers
  ACCESS_MODIFIER = "access_modifier",
  READONLY_MODIFIER = "readonly_modifier",
  VISIBILITY = "visibility",
  MUTABILITY = "mutability",
  REFERENCE = "reference",

  // Expressions and constructs
  OPERATOR = "operator",
  ARGUMENT_LIST = "argument_list",
  LABEL = "label",
  MACRO = "macro",
}

/**
 * Raw capture from tree-sitter query
 */
export interface RawCapture {
  name: string;
  node: any; // tree-sitter Node
  text?: string;
}

/**
 * Processing context with precomputed depths for efficient scope lookups
 */
export interface ProcessingContext {
  /** All scopes in the file */
  scopes: Map<ScopeId, LexicalScope>;
  /** Precomputed depth for each scope */
  scope_depths: Map<ScopeId, number>;
  /** Root scope ID (module/global scope) */
  root_scope_id: ScopeId;
  /** Find the deepest scope containing a location */
  get_scope_id(location: Location): ScopeId;
}

/**
 * Process captures directly into LexicalScope objects (single pass)
 * This MUST run before definition and reference processing
 */
export function process_scopes(
  captures: RawCapture[],
  file_path: FilePath,
  language: Language
): Map<ScopeId, LexicalScope> {
  const scopes = new Map<ScopeId, LexicalScope>();

  // Create root module scope for the file
  const file_location: Location = {
    file_path,
    line: 1,
    column: 0,
    end_line: 999999, // Will be updated if we find actual file bounds
    end_column: 999999
  };

  const root_scope_id = module_scope(file_location);
  const root_scope: LexicalScope = {
    id: root_scope_id,
    parent_id: null,
    name: null,
    type: "module",
    location: file_location,
    child_ids: []
  };
  scopes.set(root_scope_id, root_scope);

  // Helper to extract location from node
  const extract_loc = (node: any): Location => ({
    file_path: file_path,
    line: node.startPosition.row + 1,
    column: node.startPosition.column,
    end_line: node.endPosition.row + 1,
    end_column: node.endPosition.column,
  });

  // Sort captures by location for proper nesting
  const sorted_captures = [...captures].sort((a, b) =>
    compare_locations(extract_loc(a.node), extract_loc(b.node))
  );

  // Process each capture that creates a scope
  for (const capture of sorted_captures) {
    if (!creates_scope(capture)) continue;

    const location = extract_loc(capture.node);
    const scope_type = map_capture_to_scope_type(capture);

    if (!scope_type) continue;

    // Create scope ID based on type and location
    const scope_id = create_scope_id(scope_type, location);

    // Find parent scope using position containment
    const parent = find_containing_scope(location, root_scope_id, scopes);

    // Create the scope with parent reference
    const scope: LexicalScope = {
      id: scope_id,
      parent_id: parent.id,
      name: capture.text || null,
      type: scope_type,
      location,
      child_ids: []
    };

    // Update parent's child IDs
    const updated_parent = {
      ...parent,
      child_ids: [...parent.child_ids, scope_id]
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
  scopes: Map<ScopeId, LexicalScope>
): ProcessingContext {
  const scope_depths = new Map<ScopeId, number>();
  const root_scope_id = find_root_scope(scopes);

  // Precompute all depths once
  for (const scope of scopes.values()) {
    scope_depths.set(scope.id, compute_scope_depth(scope, scopes));
  }

  return {
    scopes,
    scope_depths,
    root_scope_id,
    get_scope_id(location: Location): ScopeId {
      // Find deepest scope containing this location
      // O(n) but with cached depths - no recomputation
      let best_scope_id = root_scope_id;
      let best_depth = 0;

      for (const scope of scopes.values()) {
        if (location_contains(scope.location, location)) {
          const depth = scope_depths.get(scope.id)!;
          if (depth > best_depth) {
            best_scope_id = scope.id;
            best_depth = depth;
          }
        }
      }

      return best_scope_id;
    }
  };
}

/**
 * Check if a capture creates a scope based on capture name
 */
function creates_scope(capture: RawCapture): boolean {
  // Parse capture name (e.g., "scope.function" -> creates scope)
  const parts = capture.name.split('.');
  const category = parts[0];
  const entity = parts[1];

  // Scopes are created by scope category or specific entity types
  return category === 'scope' ||
    entity === 'module' ||
    entity === 'class' ||
    entity === 'function' ||
    entity === 'method' ||
    entity === 'constructor' ||
    entity === 'block' ||
    entity === 'closure' ||
    entity === 'interface' ||
    entity === 'enum' ||
    entity === 'namespace';
}

/**
 * Map capture entity to scope type
 */
function map_capture_to_scope_type(capture: RawCapture): ScopeType | null {
  const parts = capture.name.split('.');
  const category = parts[0];
  const entity = parts[1];

  switch (entity) {
    case 'module':
    case 'namespace':
      return "module";
    case 'class':
    case 'interface':
    case 'enum':
      return "class";
    case 'function':
    case 'closure':
      return "function";
    case 'method':
      return "method";
    case 'constructor':
      return "constructor";
    case 'block':
      return "block";
    default:
      // Check if it's a scope category with block type
      if (category === 'scope') {
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
  if (a.line !== b.line) return a.line - b.line;
  if (a.column !== b.column) return a.column - b.column;
  if (a.end_line !== b.end_line) return a.end_line - b.end_line;
  return a.end_column - b.end_column;
}

/**
 * Check if a location contains another location
 */
function location_contains(container: Location, contained: Location): boolean {
  // Check if container starts before or at the same position
  const starts_before =
    container.line < contained.line ||
    (container.line === contained.line && container.column <= contained.column);

  // Check if container ends after or at the same position
  const ends_after =
    container.end_line > contained.end_line ||
    (container.end_line === contained.end_line && container.end_column >= contained.end_column);

  return starts_before && ends_after;
}

/**
 * Calculate area of a location (for finding smallest containing scope)
 */
function calculate_area(location: Location): number {
  const lines = location.end_line - location.line + 1;
  const columns = location.end_column - location.column + 1;
  return lines * columns;
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

/**
 * Process scopes from tree-sitter captures
 */
export function process_file(
  captures: QueryCapture[],
  file_path: FilePath,
  language: Language
): ProcessingContext {
  // Convert QueryCapture to RawCapture
  const raw_captures: RawCapture[] = captures.map(c => ({
    name: c.name,
    node: c.node,
    text: c.node.text
  }));

  // PASS 1: Create scopes directly (single pass)
  const scopes = process_scopes(raw_captures, file_path, language);

  // Create context with precomputed depths for efficient lookups
  const context = create_processing_context(scopes);

  return context;
}