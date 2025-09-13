// ============================================================================
// Call Graph Types
// ============================================================================

/** Name of the calling function/method */
export type CallerName = string & { __brand: "CallerName" };

/** Name of the called function/method */
export type CalleeName = string & { __brand: "CalleeName" };

/** Name of the object receiving a method call */
export type ReceiverName = string & { __brand: "ReceiverName" };

/** Special constant for module-level context */
export const MODULE_CONTEXT = "<module>" as const;
export type ModuleContext = typeof MODULE_CONTEXT;

/** Caller can be a symbol or module context */
export type CallerContext = CallerName | ModuleContext;

// ============================================================================
// Type System Types
// ============================================================================

/** Type constraint expression (e.g., "T extends BaseClass") */
export type TypeConstraint = string & { __brand: "TypeConstraint" };

/** Default value expression */
export type DefaultValue = string & { __brand: "DefaultValue" };

/** Code expression */
export type Expression = string & { __brand: "Expression" };

/** Initial value for a variable */
export type InitialValue = string & { __brand: "InitialValue" };

/** Type expression (more specific than TypeString) */
export type TypeExpression = string & { __brand: "TypeExpression" };

// ============================================================================
// Scope and Path Types
// ============================================================================

/** Scope path (e.g., "global.module.class.method.block") */
export type ScopePath = string & { __brand: "ScopePath" };

/** Resolution path for symbols */
export type ResolutionPath = string & { __brand: "ResolutionPath" };

// ============================================================================
// Enum Types (not branded, but defined as unions)
// ============================================================================

/** Visibility modifiers */
export type Visibility = "public" | "private" | "protected" | "internal";

/** Resolution reason for call graph */
export type ResolutionReason =
  | "imported"
  | "local_definition"
  | "class_member"
  | "inherited"
  | "builtin"
  | "global"
  | "unknown";

/** Type kind for resolved types */
export type ResolvedTypeKind =
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "trait"
  | "primitive"
  | "unknown";

/** Call type */
export type CallType =
  | "direct"
  | "method"
  | "constructor"
  | "dynamic"
  | "macro"
  | "decorator";

// ============================================================================
// Type Guards
// ============================================================================

export function is_symbol_name(value: unknown): value is SymbolName {
  return typeof value === "string" && value.length > 0;
}

export function is_symbol_id(value: unknown): value is SymbolId {
  return typeof value === "string" && value.includes(":");
}

export function is_caller_name(value: unknown): value is CallerName {
  return typeof value === "string" && value.length > 0;
}

export function is_callee_name(value: unknown): value is CalleeName {
  return typeof value === "string" && value.length > 0;
}

export function is_receiver_name(value: unknown): value is ReceiverName {
  return typeof value === "string" && value.length > 0;
}

export function is_module_context(value: unknown): value is ModuleContext {
  return value === MODULE_CONTEXT;
}

export function is_caller_context(value: unknown): value is CallerContext {
  return is_caller_name(value) || is_module_context(value);
}

export function is_type_constraint(value: unknown): value is TypeConstraint {
  return typeof value === "string" && value.length > 0;
}

export function is_default_value(value: unknown): value is DefaultValue {
  return typeof value === "string";
}

export function is_expression(value: unknown): value is Expression {
  return typeof value === "string";
}

export function is_scope_path(value: unknown): value is ScopePath {
  return typeof value === "string" && value.includes(".");
}

export function is_visibility(value: unknown): value is Visibility {
  return (
    value === "public" ||
    value === "private" ||
    value === "protected" ||
    value === "internal"
  );
}

export function is_resolution_reason(
  value: unknown
): value is ResolutionReason {
  return (
    value === "imported" ||
    value === "local_definition" ||
    value === "class_member" ||
    value === "inherited" ||
    value === "builtin" ||
    value === "global" ||
    value === "unknown"
  );
}

// ============================================================================
// Branded Type Creators (cast functions with validation)
// ============================================================================

export function to_symbol_name(value: string): SymbolName {
  if (!value || value.length === 0) {
    throw new Error(`Invalid SymbolName: "${value}"`);
  }
  return value as SymbolName;
}

export function to_symbol_id(value: string): SymbolId {
  if (!value || !value.includes(":")) {
    throw new Error(
      `Invalid SymbolId format: "${value}". Expected format: "file:line:column:name"`
    );
  }
  return value as SymbolId;
}

export function to_caller_name(value: string): CallerName {
  if (!value || value.length === 0) {
    throw new Error(`Invalid CallerName: "${value}"`);
  }
  return value as CallerName;
}

export function to_callee_name(value: string): CalleeName {
  if (!value || value.length === 0) {
    throw new Error(`Invalid CalleeName: "${value}"`);
  }
  return value as CalleeName;
}

export function to_receiver_name(value: string): ReceiverName {
  if (!value || value.length === 0) {
    throw new Error(`Invalid ReceiverName: "${value}"`);
  }
  return value as ReceiverName;
}

export function to_type_constraint(value: string): TypeConstraint {
  if (!value || value.length === 0) {
    throw new Error(`Invalid TypeConstraint: "${value}"`);
  }
  return value as TypeConstraint;
}

export function to_default_value(value: string): DefaultValue {
  return value as DefaultValue;
}

export function to_expression(value: string): Expression {
  return value as Expression;
}

export function to_initial_value(value: string): InitialValue {
  return value as InitialValue;
}

export function to_type_expression(value: string): TypeExpression {
  if (!value || value.length === 0) {
    throw new Error(`Invalid TypeExpression: "${value}"`);
  }
  return value as TypeExpression;
}

export function to_scope_path(value: string): ScopePath {
  if (!value || !value.includes(".")) {
    throw new Error(
      `Invalid ScopePath format: "${value}". Expected format: "scope1.scope2.scope3"`
    );
  }
  return value as ScopePath;
}

// ============================================================================
// Compound Type Builders
// ============================================================================

import {
  FilePath,
  ClassName,
  MethodName,
  FunctionName,
  QualifiedName,
} from "./aliases";
import { Location } from "./common";

/**
 * Build a SymbolId from components
 */
export function build_symbol_id(
  filePath: FilePath,
  line: number,
  column: number,
  name: SymbolName
): SymbolId {
  return `${filePath}:${line}:${column}:${name}` as SymbolId;
}

/**
 * Parse a SymbolId into components
 */
export function parse_symbol_id(id: SymbolId): {
  filePath: FilePath;
  line: number;
  column: number;
  name: SymbolName;
} {
  const parts = id.split(":");
  if (parts.length < 4) {
    throw new Error(`Invalid SymbolId format: "${id}"`);
  }

  // Handle file paths with colons (e.g., Windows C:\path)
  const name_index = parts.length - 1;
  const column_index = parts.length - 2;
  const line_index = parts.length - 3;
  const file_path_parts = parts.slice(0, line_index);

  return {
    filePath: file_path_parts.join(":") as FilePath,
    line: parseInt(parts[line_index], 10),
    column: parseInt(parts[column_index], 10),
    name: parts[name_index] as SymbolName,
  };
}

/**
 * Build a ScopePath from scope names
 */
export function build_scope_path(scopes: string[]): ScopePath {
  if (scopes.length === 0) {
    throw new Error("ScopePath requires at least one scope");
  }
  return scopes.join(".") as ScopePath;
}

/**
 * Parse a ScopePath into scope names
 */
export function parse_scope_path(path: ScopePath): string[] {
  return path.split(".");
}

/**
 * Build a QualifiedName from components
 */
export function build_qualified_name(
  className: ClassName,
  memberName: MethodName | FunctionName
): QualifiedName {
  return `${className}.${memberName}` as QualifiedName;
}

/**
 * Parse a QualifiedName into components
 */
export function parse_qualified_name(name: QualifiedName): {
  className: ClassName;
  memberName: string;
} {
  const last_dot = name.lastIndexOf(".");
  if (last_dot === -1) {
    throw new Error(`Invalid QualifiedName format: "${name}"`);
  }

  return {
    className: name.substring(0, last_dot) as ClassName,
    memberName: name.substring(last_dot + 1),
  };
}

// Re-export QualifiedName from aliases
export { QualifiedName } from "./aliases";

// ============================================================================
// Additional Compound Type Builders for Complex Types
// ============================================================================

import { ModulePath } from "./aliases";
import { SymbolId, SymbolName } from "./symbol_utils";

/**
 * Build a ModulePath from components
 */
export function build_module_path(
  source: string,
  isRelative: boolean = false
): ModulePath {
  let path = source;

  // Normalize path separators
  path = path.replace(/\\/g, "/");

  // Add relative prefix if needed
  if (isRelative && !path.startsWith(".")) {
    path = "./" + path;
  }

  // Remove .js/.ts extensions for cleaner paths
  path = path.replace(/\.(js|jsx|ts|tsx|mjs|cjs|mts|cts)$/, "");

  return path as ModulePath;
}

/**
 * Parse a ModulePath into components
 */
export function parse_module_path(path: ModulePath): {
  segments: string[];
  isRelative: boolean;
  isScoped: boolean;
  packageName?: string;
  subpath?: string;
} {
  const is_relative = path.startsWith("./") || path.startsWith("../");
  const is_scoped = path.startsWith("@");
  const segments = path.split("/").filter((s) => s.length > 0);

  let package_name: string | undefined;
  let subpath: string | undefined;

  if (!is_relative) {
    if (is_scoped && segments.length >= 2) {
      // Scoped package like @types/node
      package_name = segments.slice(0, 2).join("/");
      subpath = segments.slice(2).join("/");
    } else if (segments.length > 0) {
      // Regular package like lodash
      package_name = segments[0];
      subpath = segments.slice(1).join("/");
    }
  }

  return {
    segments,
    isRelative: is_relative,
    isScoped: is_scoped,
    packageName: package_name,
    subpath: subpath || undefined,
  };
}

/**
 * Build a TypeExpression from components
 */
export function build_type_expression(
  base: string,
  generics?: string[],
  modifiers?: TypeModifier[]
): TypeExpression {
  let expr = base;

  // Add generic parameters
  if (generics && generics.length > 0) {
    expr += `<${generics.join(", ")}>`;
  }

  // Apply modifiers
  if (modifiers) {
    for (const modifier of modifiers) {
      switch (modifier) {
        case "array":
          expr += "[]";
          break;
        case "nullable":
          expr += " | null";
          break;
        case "optional":
          expr += " | undefined";
          break;
        case "promise":
          expr = `Promise<${expr}>`;
          break;
        case "readonly":
          expr = `readonly ${expr}`;
          break;
      }
    }
  }

  return to_type_expression(expr);
}

export type TypeModifier =
  | "array"
  | "nullable"
  | "optional"
  | "promise"
  | "readonly";

/**
 * Parse a TypeExpression into components
 */
export function parse_type_expression(expr: TypeExpression): {
  base: string;
  generics?: string[];
  isArray: boolean;
  isNullable: boolean;
  isOptional: boolean;
  isPromise: boolean;
  isUnion: boolean;
  unionTypes?: string[];
} {
  const str = expr as string;

  // Check for union types
  const is_union = str.includes(" | ");
  const union_types = is_union
    ? str.split(" | ").map((s) => s.trim())
    : undefined;

  // Check for Promise
  const is_promise = str.startsWith("Promise<");

  // Check for array
  const is_array = str.endsWith("[]");

  // Check for nullable/optional
  const is_nullable = str.includes(" | null");
  const is_optional = str.includes(" | undefined");

  // Extract base type and generics
  let base = str;
  let generics: string[] | undefined;

  // Simple generic extraction (doesn't handle nested generics perfectly)
  const generic_match = /^([^<]+)<([^>]+)>/.exec(str);
  if (generic_match) {
    base = generic_match[1];
    generics = generic_match[2].split(",").map((s) => s.trim());
  } else if (is_array) {
    base = str.replace(/\[\]$/, "");
  }

  return {
    base,
    generics,
    isArray: is_array,
    isNullable: is_nullable,
    isOptional: is_optional,
    isPromise: is_promise,
    isUnion: is_union,
    unionTypes: union_types,
  };
}

/**
 * Build a ResolutionPath from file paths
 */
export function build_resolution_path(paths: FilePath[]): ResolutionPath {
  return paths.join(" -> ") as ResolutionPath;
}

/**
 * Parse a ResolutionPath into file paths
 */
export function parse_resolution_path(path: ResolutionPath): FilePath[] {
  return path.split(" -> ").map((p) => p.trim() as FilePath);
}

/**
 * Build a compound identifier (e.g., "module:class:method")
 */
export function build_compound_identifier(...parts: string[]): string {
  return parts.filter((p) => p.length > 0).join(":");
}

/**
 * Parse a compound identifier
 */
export function parse_compound_identifier(id: string): string[] {
  return id.split(":").filter((p) => p.length > 0);
}
