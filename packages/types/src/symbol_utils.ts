/**
 * Symbol Utilities for Universal Identifier System
 *
 * Provides a unified way to handle all identifiers in the codebase
 * using SymbolId as the single source of truth.
 */

import { Location } from "./common";
import { FilePath } from "./aliases";

// ============================================================================
// Core Symbol Types
// ============================================================================

export type SymbolId = string & { __brand: "SymbolId" }; // This is the encoded version of the Symbol object
export type SymbolName = string & { __brand: "SymbolName" }; // This is the local identifier of the symbol

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
  | "module";

/**
 * Structured representation of a symbol
 */
export interface Symbol {
  readonly kind: SymbolKind;
  readonly name: SymbolName; // Local identifier
  readonly qualifier?: SymbolName; // For nested symbols (e.g., Class.method)
  readonly location: Location; // Source location
}

// ============================================================================
// Symbol ID Format
// ============================================================================

/**
 * SymbolId format: "kind:scope:name[:qualifier]"
 * Examples:
 * - "variable:src/file.ts:myVar"
 * - "method:src/class.ts:MyClass:getValue"
 * - "function:src/utils.ts:processData"
 */

// ============================================================================
// Core Conversion Functions
// ============================================================================

/**
 * Convert a Symbol to its string representation
 */
export function symbol_string(symbol: Symbol): SymbolId {
  const parts = [
    symbol.kind,
    symbol.location.file_path,
    symbol.location.line,
    symbol.location.column,
    symbol.location.end_line,
    symbol.location.end_column,
    symbol.name,
  ];
  if (symbol.qualifier) {
    parts.push(symbol.qualifier);
  }
  return parts.join(":") as SymbolId;
}

/**
 * Parse a SymbolId back into a Symbol structure
 */
export function symbol_from_string(symbol_id: SymbolId): Symbol {
  const parts = symbol_id.split(":");

  if (parts.length < 3) {
    throw new Error(`Invalid SymbolId format: ${symbol_id}`);
  }

  const kind = parts[0];
  const file_path = parts[1];
  const line = parts[2];
  const column = parts[3];
  const end_line = parts[4];
  const end_column = parts[5];
  const qualifier = parts.length > 7 ? parts[6] as SymbolName : undefined;
  const name = parts.length > 7 ? parts[7] : parts[6];

  return {
    kind: kind as SymbolKind,
    name: name as SymbolName,
    qualifier,
    location: {
      file_path: file_path as FilePath,
      line: parseInt(line, 10),
      column: parseInt(column, 10),
      end_line: parseInt(end_line, 10),
      end_column: parseInt(end_column, 10),
    },
  };
}

// ============================================================================
// Factory Functions for Common Symbol Types
// ============================================================================

/**
 * Create a variable symbol
 */
export function variable_symbol(
  name: string,
  location: Location
): SymbolId {
  return symbol_string({
    kind: "variable",
    name: name as SymbolName,
    location,
  });
}

/**
 * Create a function symbol
 */
export function function_symbol(
  name: string,
  location: Location
): SymbolId {
  return symbol_string({
    kind: "function",
    name: name as SymbolName,
    location,
  });
}

/**
 * Create a class symbol
 */
export function class_symbol(
  name: string,
  location: Location
): SymbolId {
  return symbol_string({
    kind: "class",
    name: name as SymbolName,
    location,
  });
}

/**
 * Create a method symbol
 */
export function method_symbol(
  method_name: string,
  class_name: string,
  location: Location
): SymbolId {
  return symbol_string({
    kind: "method",
    name: method_name as SymbolName,
    qualifier: class_name as SymbolName,
    location: location as Location,
  });
}

/**
 * Create a property symbol
 */
export function property_symbol(
  property_name: string,
  class_name: string,
  location: Location
): SymbolId {
  return symbol_string({
    kind: "property",
    name: property_name as SymbolName,
    qualifier: class_name as SymbolName,
    location,
  });
}

/**
 * Create a parameter symbol
 */
export function parameter_symbol(
  param_name: string,
  function_name: string,
  location: Location
): SymbolId {
  return symbol_string({
    kind: "parameter",
    name: param_name as SymbolName,
    qualifier: function_name as SymbolName,
    location,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the display name for a symbol (for UI/debugging)
 */
export function get_symbol_display_name(symbol_id: SymbolId): SymbolName {
  const symbol = symbol_from_string(symbol_id);

  if (symbol.qualifier) {
    return `${symbol.qualifier}.${symbol.name}` as SymbolName;
  }

  return symbol.name;
}

/**
 * Check if a symbol is of a specific kind
 */
export function is_symbol_kind(symbol_id: SymbolId, kind: SymbolKind): boolean {
  const symbol = symbol_from_string(symbol_id);
  return symbol.kind === kind;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a valid SymbolId
 */
export function is_symbol_id(value: unknown): value is SymbolId {
  if (typeof value !== "string") return false;

  try {
    const parts = value.split(":");
    return parts.length >= 3 && parts.length <= 4;
  } catch {
    return false;
  }
}

/**
 * Check if a value is a valid Symbol
 */
export function is_symbol(value: unknown): value is Symbol {
  if (typeof value !== "object" || value === null) return false;

  const s = value as any;
  return (
    typeof s.kind === "string" &&
    typeof s.location.file_path === "string" &&
    typeof s.location.line === "number" &&
    typeof s.location.column === "number" &&
    typeof s.location.end_line === "number" &&
    typeof s.location.end_column === "number" &&
    typeof s.name === "string" &&
    (s.qualifier === undefined || typeof s.qualifier === "string")
  );
}
