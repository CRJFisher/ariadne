import { Location } from "./common";

// eslint-disable-next-line @typescript-eslint/naming-convention
export type SymbolId = string & { __brand: "SymbolId" }; // This is the encoded version of the Symbol object
// eslint-disable-next-line @typescript-eslint/naming-convention
export type SymbolName = string & { __brand: "SymbolName" }; // This is the local identifier of the symbol
// eslint-disable-next-line @typescript-eslint/naming-convention
export type ReferenceId = string & { __brand: "ReferenceId" }; // Unique identifier for a reference (reference to a symbol)

/** Create a SymbolName from a string */
export function create_symbol_name(name: string): SymbolName {
  return name as SymbolName;
}

/**
 * Symbol kind - essential for resolution rules
 */
export type SymbolKind =
  | "function"
  | "class"
  | "method"
  | "constructor"
  | "property"
  | "parameter"
  | "decorator"
  | "variable"
  | "constant"
  | "import"
  | "interface"
  | "enum"
  | "enum_member"
  | "type"
  | "type_alias"
  | "namespace"
  | "module";

// Basic symbol info needed for SymbolId generation
interface BasicSymbolInfo {
  readonly kind: SymbolKind;
  readonly name: SymbolName;
  readonly location: Location;
}

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
 * const symbol: BasicSymbolInfo = {
 *   kind: 'function',
 *   name: 'processData' as SymbolName,
 *   location: { file_path: 'src/utils.ts', line: 10, column: 0, end_line: 20, end_column: 1 }
 * };
 * const symbolId = symbol_string(symbol);
 * // Returns: "function:src/utils.ts:10:0:20:1:processData"
 * ```
 */
function symbol_string(symbol: BasicSymbolInfo): SymbolId {
  const parts = [
    symbol.kind,
    symbol.location.file_path,
    symbol.location.start_line,
    symbol.location.start_column,
    symbol.location.end_line,
    symbol.location.end_column,
    symbol.name,
  ];

  return parts.join(":") as SymbolId;
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
 * Create an anonymous function symbol
 *
 * Anonymous functions (arrow functions, lambdas, closures) don't have a source name,
 * so we use their location to generate a unique, stable identifier.
 *
 * @param location - The source location where the anonymous function is defined
 * @returns A SymbolId for the anonymous function
 *
 * @example
 * ```typescript
 * const anonId = anonymous_function_symbol({
 *   file_path: 'src/app.ts',
 *   start_line: 10,
 *   start_column: 20,
 *   end_line: 12,
 *   end_column: 5
 * });
 * // Returns: "function:src/app.ts:10:20:12:5:<anonymous>"
 * ```
 */
export function anonymous_function_symbol(location: Location): SymbolId {
  return symbol_string({
    kind: "function",
    name: "<anonymous>" as SymbolName,
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
export function class_symbol(name: string, location: Location): SymbolId {
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
  location: Location
): SymbolId {
  return symbol_string({
    kind: "method",
    name: method_name as SymbolName,
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
  location: Location
): SymbolId {
  return symbol_string({
    kind: "property",
    name: property_name as SymbolName,
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
export function module_symbol(location: Location): SymbolId {
  return symbol_string({
    name: "<module>" as SymbolName,
    kind: "module",
    location: location,
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
  location: Location
): SymbolId {
  return symbol_string({
    kind: "parameter",
    name: param_name as SymbolName,
    location,
  });
}

/**
 * Create an interface symbol
 */
export function interface_symbol(name: string, location: Location): SymbolId {
  return symbol_string({
    kind: "interface",
    name: name as SymbolName,
    location,
  });
}

/**
 * Create a type symbol
 */
export function type_symbol(name: string, location: Location): SymbolId {
  return symbol_string({
    kind: "type",
    name: name as SymbolName,
    location,
  });
}

export function enum_symbol(name: string, location: Location): SymbolId {
  return symbol_string({
    kind: "enum",
    name: name as SymbolName,
    location,
  });
}

export function enum_member_symbol(name: string, location: Location): SymbolId {
  return symbol_string({
    kind: "enum_member",
    name: name as SymbolName,
    location,
  });
}

export function decorator_symbol(name: string, location: Location): SymbolId {
  return symbol_string({
    kind: "decorator",
    name: name as SymbolName,
    location,
  });
}

export function namespace_symbol(name: string, location: Location): SymbolId {
  return symbol_string({
    kind: "namespace",
    name: name as SymbolName,
    location,
  });
}

/**
 * Create a constant symbol
 *
 * @param name - The constant name
 * @param location - The source location where the constant is defined
 * @returns A SymbolId for the constant
 *
 * @example
 * ```typescript
 * const constId = constant_symbol('MAX_SIZE', {
 *   file_path: 'src/config.rs',
 *   line: 5,
 *   column: 0,
 *   end_line: 5,
 *   end_column: 19
 * });
 * ```
 */
export function constant_symbol(name: string, location: Location): SymbolId {
  return symbol_string({
    kind: "constant",
    name: name as SymbolName,
    location,
  });
}

/**
 * Create a type alias symbol
 *
 * @param name - The type alias name
 * @param location - The source location where the type alias is defined
 * @returns A SymbolId for the type alias
 *
 * @example
 * ```typescript
 * const typeAliasId = type_alias_symbol('UserId', {
 *   file_path: 'src/types.ts',
 *   line: 10,
 *   column: 0,
 *   end_line: 10,
 *   end_column: 20
 * });
 * ```
 */
export function type_alias_symbol(name: string, location: Location): SymbolId {
  return symbol_string({
    kind: "type_alias",
    name: name as SymbolName,
    location,
  });
}

/**
 * Create a named module symbol (for languages like Rust with explicit module declarations)
 *
 * @param name - The module name
 * @param location - The source location where the module is defined
 * @returns A SymbolId for the module
 *
 * @example
 * ```typescript
 * const moduleId = named_module_symbol('utils', {
 *   file_path: 'src/lib.rs',
 *   line: 5,
 *   column: 0,
 *   end_line: 20,
 *   end_column: 1
 * });
 * ```
 */
export function named_module_symbol(
  name: string,
  location: Location
): SymbolId {
  return symbol_string({
    kind: "module",
    name: name as SymbolName,
    location,
  });
}

/**
 * Create a reference identifier
 *
 * @param name - The name being referenced
 * @param file_path - The file containing the reference
 * @param location - The source location of the reference
 * @returns A ReferenceId for the reference
 *
 * @example
 * ```typescript
 * const refId = reference_id('foo', 'src/app.ts' as FilePath, {
 *   file_path: 'src/app.ts',
 *   start_line: 5,
 *   start_column: 10,
 *   end_line: 5,
 *   end_column: 13
 * });
 * ```
 */
export function reference_id(name: string, location: Location): ReferenceId {
  return `ref:${location.file_path}:${location.start_line}:${location.start_column}:${name}` as ReferenceId;
}
