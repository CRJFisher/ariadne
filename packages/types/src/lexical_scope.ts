import type { Location } from "./location";
import type { SymbolName } from "./symbol";
import type { ScopeId, ScopeType } from "./scopes";

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
