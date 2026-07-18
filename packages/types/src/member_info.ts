import type { SymbolId, SymbolName } from "./symbol";
import type { Location } from "./location";

/**
 * Unified local member information interface
 * Used by both semantic_index and symbol_resolution modules
 */
export interface LocalMemberInfo {
  readonly name: SymbolName;
  readonly kind:
    | "method"
    | "constructor"
    | "property"
    | "field"
    | "getter"
    | "setter";
  readonly location: Location;
  readonly symbol_id?: SymbolId;
  readonly is_static?: boolean;
  readonly is_optional?: boolean;
  readonly type_annotation?: string;
  readonly parameters?: LocalParameterInfo[];
}

/**
 * Parameter information for methods/constructors
 */
export interface LocalParameterInfo {
  readonly name: SymbolName;
  readonly type_annotation?: string;
  readonly is_optional?: boolean;
  readonly is_rest?: boolean;
  readonly default_value?: string;
}
