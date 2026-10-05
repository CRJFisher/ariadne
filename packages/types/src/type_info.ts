import type { SymbolId, SymbolName } from "./symbol";

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
