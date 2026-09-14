import type { Location, ScopeId, SymbolId, SymbolName } from "@ariadnejs/types";

/** What a handler captures about one method. */
export interface MethodInput {
  symbol_id: SymbolId;
  name: SymbolName;
  location: Location;
  scope_id: ScopeId;
  return_type?: SymbolName;
  access_modifier?: "public" | "private" | "protected";
  abstract?: boolean;
  static?: boolean;
  async?: boolean;
  generics?: SymbolName[];
  docstring?: string;
  accessor_kind?: "getter" | "setter" | "deleter";
  // @language rust
  impl_self_type?: SymbolName;
  // @language rust
  impl_trait_name?: SymbolName;
}

/**
 * @language rust
 * What an impl-block method handler captures about one method.
 */
export interface ImplMethodInput extends MethodInput {
  impl_self_type: SymbolName;
}
