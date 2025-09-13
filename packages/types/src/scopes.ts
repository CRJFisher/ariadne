import { ScopeId } from "./aliases";
import { SymbolName, SymbolId, SymbolKind } from "./symbol_utils";
import { Location } from "./common";

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
 * A node in the scope tree
 */
export interface ScopeNode {
  readonly id: ScopeId;
  readonly type: ScopeType;
  readonly location: Location;
  readonly parent_id?: ScopeId;
  readonly child_ids: readonly ScopeId[];
  readonly symbols: ReadonlyMap<SymbolId, ScopeSymbol>;
  readonly metadata?: {
    readonly name?: SymbolId; // Function/class/module name
    readonly is_async?: boolean; // For function scopes
    readonly is_generator?: boolean; // For function scopes
    readonly visibility?: string; // public/private/protected
  };
}

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
  return (
    typeof node.id === "string" &&
    typeof node.type === "string" &&
    typeof node.location === "object" &&
    node.location !== null &&
    Array.isArray(node.child_ids) &&
    node.symbols instanceof Map
  );
}
