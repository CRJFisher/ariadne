import { Location } from "./common";
import {
  SymbolId,
  SymbolName,
  FilePath,
  FunctionName,
  ScopeId,
  DocString,
} from "./aliases";

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
  readonly file_path: FilePath;
  readonly location: Location;
  readonly is_exported?: boolean;
  readonly docstring?: DocString;
  readonly references: readonly Usage[];
}

export interface Usage {
  readonly symbol: SymbolName;
  readonly file_path: FilePath;
  readonly location: Location;
  readonly kind: "call" | "reference" | "import" | "type_reference";
  readonly is_write?: boolean;
  readonly in_function?: FunctionName;
}

export interface ResolvedSymbol {
  readonly symbol: SymbolName;
  readonly definition?: SymbolDefinition;
  readonly confidence: "high" | "medium" | "low";
  readonly resolution_path?: readonly FilePath[];
}

export interface SymbolScope {
  readonly symbol: SymbolName;
  readonly scope: "global" | "module" | "class" | "function" | "block";
  readonly parent_scope?: ScopeId;
  readonly child_scopes?: readonly ScopeId[];
}

export interface SymbolIndex {
  readonly definitions: ReadonlyMap<SymbolId, SymbolDefinition>;
  readonly usages: ReadonlyMap<SymbolId, readonly Usage[]>;
  readonly scopes?: ReadonlyMap<ScopeId, SymbolScope>;
  readonly unresolved_symbols?: ReadonlySet<SymbolName>;
}
