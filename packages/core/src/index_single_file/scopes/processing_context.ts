import type {
  Location,
  LexicalScope,
  ScopeId,
  SymbolName,
} from "@ariadnejs/types";
import type { CaptureNode } from "../capture_types";

/**
 * Processing context with precomputed depths for efficient scope lookups
 */
export interface ProcessingContext {
  /** All captures in the file */
  captures: readonly CaptureNode[];
  /** All scopes in the file */
  scopes: ReadonlyMap<ScopeId, LexicalScope>;
  /** Precomputed depth for each scope */
  scope_depths: ReadonlyMap<ScopeId, number>;
  /** Root scope ID (module/global scope) */
  root_scope_id: ScopeId;
  /** Find the deepest scope containing a location */
  get_scope_id(location: Location): ScopeId;
  get_child_scope_with_symbol_name(
    scope_id: ScopeId,
    name: SymbolName
  ): ScopeId;
}
