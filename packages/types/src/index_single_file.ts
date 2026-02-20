/**
 * Semantic Index - Unified symbol extraction with lexical scoping
 *
 * Essential types for call chain resolution and cross-file symbol tracking.
 * Language-agnostic with minimal fields needed for call graph construction.
 */

import type { Location } from "./common";
import type { SymbolId, SymbolName } from "./symbol";
import type { ScopeId, ScopeType } from "./scopes";

/**
 * Reference type - essential for call chain tracking
 */
export type ReferenceType =
  | "call" // Function/method call
  | "construct" // Constructor call
  | "read" // Variable read
  | "write" // Variable write
  | "member_access" // Property/method access - needed for method resolution
  | "type" // Type reference
  | "assignment" // Assignment target/source connection
  | "return"; // Return value - tracks function return types

/**
 * Lexical scope with symbols
 * Self-contained scope with symbol table for resolution
 */
export interface LexicalScope {
  /** Unique scope identifier */
  readonly id: ScopeId;

  /** Parent scope ID (null for root) */
  readonly parent_id: ScopeId | null;

  /** Scope name (for named scopes like functions/classes) */
  readonly name: SymbolName | null;

  /** Type of scope */
  readonly type: ScopeType;

  /** Scope location */
  readonly location: Location;

  /** Child scope IDs */
  readonly child_ids: readonly ScopeId[];
}

/**
 * Type member information
 *
 * Contains indexed members of a type (class, interface, or enum).
 * Used for efficient member lookup during method resolution.
 */
export interface TypeMemberInfo {
  /** Methods by name */
  readonly methods: ReadonlyMap<SymbolName, SymbolId>;

  /** Properties by name */
  readonly properties: ReadonlyMap<SymbolName, SymbolId>;

  /** Constructor (if any) - classes only */
  readonly constructor?: SymbolId;

  /** Types this extends (for inheritance lookup in 11.109.3) */
  readonly extends: readonly SymbolName[];
}

/**
 * Type information for references
 */
export interface TypeInfo {
  /** Type identifier */
  readonly type_id: SymbolId;

  /** Human-readable type name */
  readonly type_name: SymbolName;

  /** How certain we are about this type */
  readonly certainty: "declared" | "inferred" | "ambiguous";

  /** Whether nullable */
  readonly is_nullable?: boolean;
}
