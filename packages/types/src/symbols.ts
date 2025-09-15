import { Location } from "./common";
import { ScopeId } from "./scopes";

export type SymbolName = string & { __brand: "SymbolName" }; // This is the local identifier of the symbol
export type SymbolId = string & { __brand: "SymbolId" }; // This is the encoded version of the Symbol object

/**
 * Symbol kinds represent the semantic type of a symbol
 */
export type SymbolKind =
  | "variable"
  | "function"
  | "class"
  | "method"
  | "property"
  | "parameter"
  | "type"
  | "interface"
  | "enum"
  | "import"
  | "export"
  | "namespace"
  | "module"
  | "global";

export enum SymbolVisibility {
  PUBLIC = "public",
  PRIVATE = "private",
  PROTECTED = "protected",
  INTERNAL = "internal",
}

export interface SymbolDefinition {
  readonly name: SymbolName;
  readonly qualifier?: SymbolName;
  readonly kind: SymbolKind;
  readonly location: Location;
}

export interface SymbolUsage {
  readonly symbol: SymbolId;
  readonly location: Location;
  readonly kind: "call" | "reference" | "import" | "type_reference";
}

export interface SymbolIndex {
  readonly definitions: ReadonlyMap<SymbolId, SymbolDefinition>;
  readonly usages: ReadonlyMap<SymbolId, readonly SymbolUsage[]>;
  readonly scopes: ReadonlyMap<SymbolId, ScopeId>;
  readonly unresolved_symbols: ReadonlySet<SymbolName>;
}
