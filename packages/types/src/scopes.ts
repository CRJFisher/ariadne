import { ScopeId } from "./aliases";
import { SymbolName, SymbolId, SymbolKind } from "./symbol_utils";
import { Location } from "./common";
import { Visibility } from "./symbol_scope";

/**
 * Type of scope (determines resolution rules)
 */
export type ScopeType =
  | "global" // Top-level file scope
  | "module" // Module/namespace scope
  | "class" // Class/struct scope
  | "function" // Function/method scope
  | "block" // Block scope (if/for/while/etc)
  | "parameter" // Function parameter scope
  | "local"; // Local/let/const scope

// SymbolKind type moved to symbol_utils.ts

/**
 * Symbol information within a scope
 */
export interface ScopeSymbol {
  readonly name: SymbolId;
  readonly kind: SymbolKind; // variable, function, class, etc.
  readonly location: Location;
  readonly is_hoisted: boolean; // var in JS, function declarations
  readonly is_imported: boolean; // Imported from another module
  readonly is_exported: boolean; // Exported from this module
  readonly type_info: string; // Defaults to "unknown" when type unavailable
}

/**
 * Base scope node structure
 */
interface BaseScopeNode {
  readonly id: ScopeId;
  readonly type: ScopeType;
  readonly location: Location;
  readonly child_ids: readonly ScopeId[];
  readonly symbols: ReadonlyMap<SymbolId, ScopeSymbol>;
  readonly metadata: {
    readonly name: SymbolId; // Always required - generated for anonymous scopes
    readonly is_async: boolean; // Defaults to false for non-async scopes
    readonly is_generator: boolean; // Defaults to false for non-generator scopes
    readonly visibility: Visibility; // Always present, defaults to "public"
  };
}

/**
 * Root scope node (no parent)
 */
export interface RootScopeNode extends BaseScopeNode {
  readonly parent_id: null; // Explicitly null for root scopes
  readonly type: "global" | "module"; // Only root-level scope types
}

/**
 * Child scope node (has parent)
 */
export interface ChildScopeNode extends BaseScopeNode {
  readonly parent_id: ScopeId; // Always present for non-root scopes
  readonly type: "class" | "function" | "block" | "parameter" | "local"; // Non-root scope types
}

/**
 * A node in the scope tree - discriminated union for type safety
 */
export type ScopeNode = RootScopeNode | ChildScopeNode;

/**
 * Scope tree structure
 */
export interface ScopeTree {
  readonly root_id: ScopeId;
  readonly nodes: ReadonlyMap<ScopeId, ScopeNode>;
  readonly file_path: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to validate ScopeTree objects
 * Ensures all required fields are present and non-null
 */
export function is_scope_tree(value: unknown): value is ScopeTree {
  if (typeof value !== "object" || value === null) return false;

  const tree = value as any;
  return (
    typeof tree.root_id === "string" &&
    tree.nodes instanceof Map &&
    typeof tree.file_path === "string" &&
    tree.file_path.length > 0 // Ensure file_path is not empty
  );
}

/**
 * Type guard to validate ScopeNode objects
 * Ensures all required fields are present and properly typed
 */
export function is_scope_node(value: unknown): value is ScopeNode {
  if (typeof value !== "object" || value === null) return false;

  const node = value as any;
  const base_valid = (
    typeof node.id === "string" &&
    typeof node.type === "string" &&
    typeof node.location === "object" &&
    node.location !== null &&
    Array.isArray(node.child_ids) &&
    node.symbols instanceof Map &&
    typeof node.metadata === "object" &&
    node.metadata !== null &&
    typeof node.metadata.name === "string" &&
    typeof node.metadata.is_async === "boolean" &&
    typeof node.metadata.is_generator === "boolean"
  );

  if (!base_valid) return false;

  // Check discriminated union structure
  return is_root_scope_node(node) || is_child_scope_node(node);
}

/**
 * Type guard for root scope nodes
 */
export function is_root_scope_node(value: unknown): value is RootScopeNode {
  if (typeof value !== "object" || value === null) return false;

  const node = value as any;
  return (
    (node.type === "global" || node.type === "module") &&
    node.parent_id === null
  );
}

/**
 * Type guard for child scope nodes
 */
export function is_child_scope_node(value: unknown): value is ChildScopeNode {
  if (typeof value !== "object" || value === null) return false;

  const node = value as any;
  const valid_child_types = ["class", "function", "block", "parameter", "local"];
  return (
    valid_child_types.includes(node.type) &&
    typeof node.parent_id === "string" &&
    node.parent_id.length > 0
  );
}
