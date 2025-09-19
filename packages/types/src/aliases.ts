/**
 * Type aliases for common string patterns
 */

import type { SymbolName } from "./symbol";

// Basic type aliases (excluding ones that conflict with branded types)
export type TypeString = string;
export type QualifiedName = SymbolName;
export type VariableName = SymbolName;
export type PropertyName = SymbolName;
export type FieldName = SymbolName;
export type EnumMemberName = SymbolName;
export type SourceCode = string;
export type DocString = string;