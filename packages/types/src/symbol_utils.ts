/**
 * Symbol Utilities for Universal Identifier System
 *
 * Provides a unified way to handle all identifiers in the codebase
 * using SymbolId as the single source of truth.
 *
 * @module symbol_utils
 * @description This module provides factory functions and utilities for creating
 * and manipulating symbols throughout the codebase. All identifiers (variables,
 * functions, classes, methods, etc.) are represented using the SymbolId type.
 *
 * @example
 * ```typescript
 * import { function_symbol, class_symbol, method_symbol } from '@ariadnejs/types';
 *
 * // Create a function symbol
 * const funcId = function_symbol('processData', {
 *   file_path: 'src/utils.ts',
 *   line: 10,
 *   column: 0,
 *   end_line: 20,
 *   end_column: 1
 * });
 *
 * // Create a class symbol
 * const classId = class_symbol('MyClass', 'src/classes.ts', {
 *   file_path: 'src/classes.ts',
 *   line: 5,
 *   column: 0,
 *   end_line: 50,
 *   end_column: 1
 * });
 *
 * // Create a method symbol
 * const methodId = method_symbol('getValue', 'MyClass', {
 *   file_path: 'src/classes.ts',
 *   line: 15,
 *   column: 2,
 *   end_line: 18,
 *   end_column: 3
 * });
 * ```
 */

import { Location } from "./common";
import { FilePath } from "./aliases";
import { SymbolDefinition, SymbolId, SymbolKind, SymbolName } from "./symbols";

// ============================================================================
// Core Conversion Functions
// ============================================================================

/**
 * Convert a Symbol to its string representation (SymbolId)
 *
 * @param symbol - The Symbol object to convert
 * @returns A SymbolId string that uniquely identifies the symbol
 *
 * @example
 * ```typescript
 * const symbol: Symbol = {
 *   kind: 'function',
 *   name: 'processData' as SymbolName,
 *   location: { file_path: 'src/utils.ts', line: 10, column: 0, end_line: 20, end_column: 1 }
 * };
 * const symbolId = symbol_string(symbol);
 * // Returns: "function:src/utils.ts:10:0:20:1:processData"
 * ```
 */
export function symbol_string(symbol: SymbolDefinition): SymbolId {
  const parts = [
    symbol.kind,
    symbol.location.file_path,
    symbol.location.line,
    symbol.location.column,
    symbol.location.end_line,
    symbol.location.end_column,
    symbol.name,
  ];
  return parts.join(":") as SymbolId;
}

/**
 * Parse a SymbolId back into a Symbol structure
 *
 * @param symbol_id - The SymbolId string to parse
 * @returns A Symbol object with all its components
 * @throws Error if the SymbolId format is invalid
 *
 * @example
 * ```typescript
 * const symbolId = "function:src/utils.ts:10:0:20:1:processData" as SymbolId;
 * const symbol = symbol_from_string(symbolId);
 * // Returns: { kind: 'function', name: 'processData', location: {...} }
 * ```
 */
export function symbol_from_string(symbol_id: SymbolId): SymbolDefinition {
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
  const name = parts[6] as SymbolName;
  const qualifier = parts.length > 7 ? (parts[7] as SymbolName) : undefined;

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
 *
 * @param name - The variable name
 * @param location - The source location where the variable is defined
 * @returns A SymbolId for the variable
 *
 * @example
 * ```typescript
 * const varId = variable_symbol('myVar', {
 *   file_path: 'src/app.ts',
 *   line: 5,
 *   column: 6,
 *   end_line: 5,
 *   end_column: 11
 * });
 * ```
 */
export function variable_symbol(name: string, location: Location): SymbolId {
  return symbol_string({
    kind: "variable",
    name: name as SymbolName,
    location,
  });
}

/**
 * Create a function symbol
 *
 * @param name - The function name
 * @param location - The source location where the function is defined
 * @returns A SymbolId for the function
 *
 * @example
 * ```typescript
 * const funcId = function_symbol('calculateTotal', {
 *   file_path: 'src/calc.ts',
 *   line: 10,
 *   column: 0,
 *   end_line: 25,
 *   end_column: 1
 * });
 * ```
 */
export function function_symbol(
  name: SymbolName,
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
 *
 * @param name - The class name
 * @param scope - The file path scope (usually same as location.file_path)
 * @param location - The source location where the class is defined
 * @returns A SymbolId for the class
 *
 * @example
 * ```typescript
 * const classId = class_symbol('UserService', 'src/services/user.ts', {
 *   file_path: 'src/services/user.ts',
 *   line: 8,
 *   column: 0,
 *   end_line: 100,
 *   end_column: 1
 * });
 * ```
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
 *
 * @param method_name - The method name
 * @param class_name - The name of the class that contains this method
 * @param location - The source location where the method is defined
 * @returns A SymbolId for the method
 *
 * @example
 * ```typescript
 * const methodId = method_symbol('getUserById', 'UserService', {
 *   file_path: 'src/services/user.ts',
 *   line: 25,
 *   column: 2,
 *   end_line: 30,
 *   end_column: 3
 * });
 * ```
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
 *
 * @param property_name - The property name
 * @param class_name - The name of the class that contains this property
 * @param location - The source location where the property is defined
 * @returns A SymbolId for the property
 *
 * @example
 * ```typescript
 * const propId = property_symbol('isActive', 'User', {
 *   file_path: 'src/models/user.ts',
 *   line: 12,
 *   column: 2,
 *   end_line: 12,
 *   end_column: 10
 * });
 * ```
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
 * Create a module symbol
 *
 * @param name - The module name (often '<module>' for top-level)
 * @param file_path - The file path of the module
 * @param location - The source location of the module
 * @returns A SymbolId for the module
 *
 * @example
 * ```typescript
 * const moduleId = module_symbol('<module>', 'src/index.ts', {
 *   file_path: 'src/index.ts',
 *   line: 0,
 *   column: 0,
 *   end_line: 100,
 *   end_column: 0
 * });
 * ```
 */
export function module_symbol(
  name: SymbolName,
  file_path: FilePath,
  location: Location
): SymbolId {
  // Ensure location has the correct file_path
  const loc = { ...location, file_path: file_path as FilePath };
  return symbol_string({
    name: name as SymbolName,
    kind: "module",
    location: loc,
  });
}

/**
 * Create a parameter symbol
 *
 * @param param_name - The parameter name
 * @param function_name - The name of the function that contains this parameter
 * @param location - The source location where the parameter is defined
 * @returns A SymbolId for the parameter
 *
 * @example
 * ```typescript
 * const paramId = parameter_symbol('userId', 'getUserById', {
 *   file_path: 'src/services/user.ts',
 *   line: 25,
 *   column: 20,
 *   end_line: 25,
 *   end_column: 26
 * });
 * ```
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

/**
 * Create an interface symbol
 */
export function interface_symbol(
  name: string,
  location: Location
): SymbolId {
  return symbol_string({
    kind: "interface",
    name: name as SymbolName,
    location,
  });
}

/**
 * Create a type symbol
 */
export function type_symbol(
  name: string,
  location: Location
): SymbolId {
  return symbol_string({
    kind: "type",
    name: name as SymbolName,
    location,
  });
}
