import { ScopeId, SymbolName } from "./aliases";
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

export type SymbolKind =
  | "variable"
  | "function"
  | "class"
  | "module"
  | "interface"
  | "enum"
  | "type"
  | "alias"
  | "namespace"
  | "import"
  | "export"
  | "local";

/**
 * Symbol information within a scope
 */
export interface ScopeSymbol {
  readonly name: SymbolName;
  readonly kind: SymbolKind; // variable, function, class, etc.
  readonly location: Location;
  readonly is_hoisted?: boolean; // var in JS, function declarations
  readonly is_imported?: boolean; // Imported from another module
  readonly is_exported?: boolean; // Exported from this module
  readonly type_info?: string; // Type annotation if available
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
  readonly symbols: ReadonlyMap<SymbolName, ScopeSymbol>;
  readonly metadata?: {
    readonly name?: string; // Function/class/module name
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
  readonly file_path?: string;
}
