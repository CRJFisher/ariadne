import type { SymbolId, SymbolName } from "./symbol";

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
