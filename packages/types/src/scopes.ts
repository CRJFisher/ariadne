import { FilePath } from "./aliases";
import { Location } from "./common";

export type ScopeId = string & { __brand: "ScopeId" }; // Unique scope identifier
export type ScopeName = string & { __brand: "ScopeName"; }; // Scope name (if named)

/**
 * Type of scope (determines resolution rules)
 */
export type ScopeType =
  | "global" // Top-level file scope
  | "module" // Module/namespace scope
  | "class" // Class/struct scope
  | "function" // Function scope
  | "method" // Method scope
  | "constructor" // Constructor scope
  | "block" // Block scope (if/for/while/etc)
  | "parameter" // Function parameter scope
  | "local"; // Local/let/const scope

/**
 * Base scope node structure
 */
interface BaseScopeNode {
  readonly id: ScopeId;
  readonly parent_id: ScopeId | null;
  readonly name: ScopeName | null;
  readonly type: ScopeType;
  readonly location: Location;
  readonly child_ids: readonly ScopeId[];
}

/**
 * Root scope node (no parent)
 */
export interface RootScopeNode extends BaseScopeNode {
  readonly type: "global" | "module"; // Only root-level scope types
}

/**
 * Child scope node (has parent)
 */
export interface ChildScopeNode extends BaseScopeNode {
  readonly type: "class" | "function" | "method" | "constructor" | "block" | "parameter" | "local"; // Non-root scope types
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
  readonly file_path: FilePath;
}

// ============================================================================
// Structured ScopeId System
// ============================================================================

/**
 * ScopeId format: "type:file_path:line:column:end_line:end_column"
 * Examples:
 * - "function:src/utils.ts:10:0:20:1"
 * - "block:src/utils.ts:12:2:18:3"
 * - "class:src/models.ts:5:0:50:1"
 */

/**
 * Structured representation of a scope for ID generation
 */
export interface ScopeLocation {
  readonly type: ScopeType;
  readonly location: Location;
}

/**
 * Convert a ScopeLocation to its string representation (ScopeId)
 * 
 * @param scope - The scope location to convert
 * @returns A ScopeId string that uniquely identifies the scope
 * 
 * @example
 * ```typescript
 * const scope: ScopeLocation = {
 *   type: 'function',
 *   file_path: 'src/utils.ts',
 *   location: { file_path: 'src/utils.ts', line: 10, column: 0, end_line: 20, end_column: 1 }
 * };
 * const scopeId = scope_string(scope);
 * // Returns: "function:src/utils.ts:10:0:20:1"
 * ```
 */
export function scope_string(scope: ScopeLocation): ScopeId {
  return [
    scope.type,
    scope.location.file_path,
    scope.location.line,
    scope.location.column,
    scope.location.end_line,
    scope.location.end_column
  ].join(':') as ScopeId;
}

/**
 * Parse a ScopeId back into a ScopeLocation structure
 * 
 * @param scope_id - The ScopeId string to parse
 * @returns A ScopeLocation object with all its components
 * @throws Error if the ScopeId format is invalid
 * 
 * @example
 * ```typescript
 * const scopeId = "function:src/utils.ts:10:0:20:1" as ScopeId;
 * const scope = scope_from_string(scopeId);
 * // Returns: { type: 'function', file_path: 'src/utils.ts', location: {...} }
 * ```
 */
export function scope_from_string(scope_id: ScopeId): ScopeLocation {
  const parts = scope_id.split(':');
  
  if (parts.length < 6) {
    throw new Error(`Invalid ScopeId format: ${scope_id}`);
  }
  
  const type = parts[0] as ScopeType;
  const file_path = parts[1] as FilePath;
  const line = parseInt(parts[2], 10);
  const column = parseInt(parts[3], 10);
  const end_line = parseInt(parts[4], 10);
  const end_column = parseInt(parts[5], 10);
  
  return {
    type,
    location: {
      file_path,
      line,
      column,
      end_line,
      end_column
    }
  };
}

// ============================================================================
// Factory Functions for Common Scope Types
// ============================================================================

/**
 * Create a global scope ID
 */
export function global_scope(location: Location): ScopeId {
  return scope_string({ type: 'global', location });
}

/**
 * Create a module scope ID
 */
export function module_scope(location: Location): ScopeId {
  return scope_string({ type: 'module', location });
}

/**
 * Create a function scope ID
 */
export function function_scope(location: Location): ScopeId {
  return scope_string({ 
    type: 'function', 
    location 
  });
}

/**
 * Create a class scope ID
 */
export function class_scope(location: Location): ScopeId {
  return scope_string({ 
    type: 'class', 
    location 
  });
}

/**
 * Create a block scope ID
 */
export function block_scope(location: Location): ScopeId {
  return scope_string({ 
    type: 'block', 
    location 
  });
}

/**
 * Create a parameter scope ID
 */
export function parameter_scope(location: Location): ScopeId {
  return scope_string({ 
    type: 'parameter', 
    location 
  });
}

/**
 * Create a local scope ID
 */
export function local_scope(location: Location): ScopeId {
  return scope_string({ 
    type: 'local', 
    location 
  });
}
