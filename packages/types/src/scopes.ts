import { Language } from './index';

/**
 * Position in source code
 */
export interface Position {
  readonly row: number;
  readonly column: number;
}

/**
 * Type of scope (determines resolution rules)
 */
export type ScopeType = 
  | 'global'      // Top-level file scope
  | 'module'      // Module/namespace scope
  | 'class'       // Class/struct scope
  | 'function'    // Function/method scope
  | 'block'       // Block scope (if/for/while/etc)
  | 'parameter'   // Function parameter scope
  | 'local';      // Local/let/const scope

/**
 * Symbol information within a scope
 */
export interface ScopeSymbol {
  readonly name: string;
  readonly kind: string;  // variable, function, class, etc.
  readonly range: {
    readonly start: Position;
    readonly end: Position;
  };
  readonly is_hoisted?: boolean;     // var in JS, function declarations
  readonly is_imported?: boolean;    // Imported from another module
  readonly is_exported?: boolean;    // Exported from this module
  readonly type_info?: string;       // Type annotation if available
}

/**
 * A node in the scope tree
 */
export interface ScopeNode {
  readonly id: string;
  readonly type: ScopeType;
  readonly range: {
    readonly start: Position;
    readonly end: Position;
  };
  readonly parent_id?: string;
  readonly child_ids: readonly string[];
  readonly symbols: ReadonlyMap<string, ScopeSymbol>;
  readonly metadata?: {
    readonly name?: string;          // Function/class/module name
    readonly is_async?: boolean;     // For function scopes
    readonly is_generator?: boolean; // For function scopes
    readonly visibility?: string;    // public/private/protected
  };
}

/**
 * Scope tree structure
 */
export interface ScopeTree {
  readonly root_id: string;
  readonly nodes: ReadonlyMap<string, ScopeNode>;
  readonly language: Language;
  readonly file_path?: string;
}