import { Location } from "./common";
import { FilePath, FunctionName, ScopeId, DocString } from "./aliases";
// Symbol types are now imported from symbol_utils.ts for consistency
import { SymbolName, SymbolId } from "./symbol_utils";

// Re-export for backward compatibility
export { SymbolName, SymbolId };

export interface SymbolDefinition {
  readonly symbol: SymbolName;
  readonly kind:
    | "function"
    | "class"
    | "variable"
    | "constant"
    | "type"
    | "interface"
    | "enum";
  readonly location: Location;
  readonly is_exported: boolean; // Defaults to false for non-exported symbols
  readonly docstring: DocString; // Defaults to empty string when no docstring
  readonly references: readonly Usage[];
}

export interface Usage {
  readonly symbol: SymbolName;
  readonly location: Location;
  readonly kind: "call" | "reference" | "import" | "type_reference";
  readonly is_write: boolean;
  readonly in_function: FunctionName;
}

export interface ResolvedSymbol {
  readonly symbol: SymbolName;
  readonly definition: SymbolDefinition;
  readonly confidence: "high" | "medium" | "low";
  readonly resolution_path: readonly FilePath[];
}

export interface SymbolScope {
  readonly symbol: SymbolName;
  readonly scope: "global" | "module" | "class" | "function" | "block";
  readonly parent_scope: ScopeId;
  readonly child_scopes: readonly ScopeId[];
}

export interface SymbolIndex {
  readonly definitions: ReadonlyMap<SymbolId, SymbolDefinition>;
  readonly usages: ReadonlyMap<SymbolId, readonly Usage[]>;
  readonly scopes: ReadonlyMap<SymbolId, SymbolScope>;
  readonly unresolved_symbols: ReadonlySet<SymbolName>;
}
