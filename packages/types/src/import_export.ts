import { ModulePath, SymbolName } from "./aliases";
import { Location } from "./common";

export interface ImportStatement {
  readonly source: ModulePath;
  readonly symbol_names: readonly SymbolName[];
  readonly location: Location;
  readonly is_type_import?: boolean;
  readonly is_namespace_import?: boolean;
  readonly namespace_name?: string;
}

export interface ExportStatement {
  readonly symbol_names: readonly SymbolName[];
  readonly location: Location;
  readonly is_default?: boolean;
  readonly is_type_export?: boolean;
  readonly source?: ModulePath; // for re-exports
}
