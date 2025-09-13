/**
 * Unified symbol and scope types that simplify and standardize
 * symbol representation and scope hierarchy across all modules
 */

import { Location, Language, TypeParameter } from "./common";
import { FilePath, DocString } from "./aliases";
import { TypeExpression } from "./type_analysis";
import { SymbolName, SymbolId, SymbolKind } from "./symbol_utils";
import { SemanticNode, Resolution } from "./query";
import { ScopeType } from "./scopes";

// ============================================================================
// Branded Types for Symbol & Scope
// ============================================================================

/** Scope path (e.g., "global.module.class.method.block") */
export type ScopePath = string & { __brand: "ScopePath" };

/** Resolution path for symbols */
export type ResolutionPath = string & { __brand: "ResolutionPath" };

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

// ============================================================================
// Type Guards for Symbol & Scope
// ============================================================================

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
// Branded Type Creators for Symbol & Scope
// ============================================================================

export function to_scope_path(value: string): ScopePath {
  if (!value || !value.includes(".")) {
    throw new Error(
      `Invalid ScopePath format: "${value}". Expected format: "scope1.scope2.scope3"`
    );
  }
  return value as ScopePath;
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

// ============================================================================
// Symbol Types
// ============================================================================

// SymbolKind type moved to symbol_utils.ts

/**
 * Symbol definition that extends SemanticNode
 * Replaces SymbolDefinition, ScopeSymbol, and various Definition types
 */
export interface Symbol extends SemanticNode {
  readonly id: SymbolId;
  readonly name: SymbolName;
  readonly kind: SymbolKind;
  readonly scope_path: ScopePath; // Full scope path to this symbol

  // Common metadata
  readonly visibility: Visibility; // Defaults to "public"
  readonly is_exported: boolean;
  readonly is_imported: boolean;
  readonly is_hoisted: boolean; // JS hoisting
  readonly is_static: boolean; // Static members
  readonly is_abstract: boolean; // Abstract classes/methods
  readonly is_readonly: boolean; // Readonly properties
  readonly is_optional: boolean; // Optional parameters/properties

  // Type information
  readonly type?: TypeExpression; // Type annotation/inference
  readonly type_parameters: readonly TypeParameter[]; // Generic parameters - always present, defaults to empty array

  // Documentation
  readonly docstring?: DocString;

  // Relations
  readonly parent_symbol?: SymbolId; // Containing class/namespace
  readonly child_symbols: readonly SymbolId[]; // Nested symbols - always present, defaults to empty array
}

// TypeParameter interface moved to common.ts

// ============================================================================
// Unified Scope Types
// ============================================================================

// ScopeType moved to scopes.ts

/**
 * Unified scope node
 */
export interface Scope extends SemanticNode {
  readonly path: ScopePath; // Full scope path
  readonly type: ScopeType;
  readonly parent_path?: ScopePath; // Parent scope path
  readonly child_paths: readonly ScopePath[]; // Child scope paths

  // Symbols defined in this scope
  readonly symbols: ReadonlyMap<SymbolId, SymbolId>;

  // Scope metadata
  readonly owner_symbol?: SymbolId; // Symbol that owns this scope (function/class)
  readonly is_closure: boolean; // Captures outer variables - defaults to false
  readonly captured_symbols: readonly SymbolId[]; // Symbols from outer scopes - always present, defaults to empty array
}

// ============================================================================
// Symbol Resolution Types
// ============================================================================

// ResolvedSymbol interface moved to symbols.ts

/**
 * Step in an import resolution chain
 */
export interface ImportStep {
  readonly from_file: FilePath;
  readonly to_file: FilePath;
  readonly import_name: SymbolName;
  readonly original_name?: SymbolName; // If aliased
}

// ============================================================================
// Symbol Index Types
// ============================================================================

// SymbolIndex interface moved to symbols.ts

// ============================================================================
// Usage and Reference Types
// ============================================================================

/**
 * Symbol usage/reference
 */
export interface SymbolUsage extends SemanticNode {
  readonly symbol_id: SymbolId;
  readonly usage_type: UsageType;
  readonly in_scope: ScopePath;
  readonly is_write: boolean; // Assignment/mutation
  readonly is_type_reference: boolean; // Used as type annotation
}

export type UsageType =
  | "call" // Function/method call
  | "reference" // Variable reference
  | "import" // Import statement
  | "export" // Export statement
  | "instantiation" // Class instantiation
  | "inheritance" // Extends/implements
  | "type"; // Type annotation

// ============================================================================
// Type Guards
// ============================================================================

export function is_symbol(value: unknown): value is Symbol {
  if (typeof value !== "object" || value === null) return false;
  const sym = value as any;
  return (
    "id" in sym &&
    "name" in sym &&
    "kind" in sym &&
    "scope_path" in sym &&
    "location" in sym &&
    "language" in sym
  );
}

export function is_unified_scope(value: unknown): value is Scope {
  if (typeof value !== "object" || value === null) return false;
  const scope = value as any;
  return (
    "path" in scope &&
    "type" in scope &&
    "symbols" in scope &&
    scope.symbols instanceof Map
  );
}

export function is_symbol_usage(value: unknown): value is SymbolUsage {
  if (typeof value !== "object" || value === null) return false;
  const usage = value as any;
  return (
    "symbol_id" in usage &&
    "usage_type" in usage &&
    "in_scope" in usage &&
    "location" in usage
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a unified symbol
 */
export function create_symbol_definition(
  id: SymbolId,
  name: SymbolName,
  kind: SymbolKind,
  location: Location,
  language: Language,
  scope_path: ScopePath,
  options?: Partial<Symbol>
): Symbol {
  return {
    id,
    name,
    kind,
    location,
    language,
    scope_path,
    node_type: get_node_type_for_kind(kind),
    // Provide defaults for required properties
    visibility: "public",
    is_exported: false,
    is_imported: false,
    is_hoisted: false,
    is_static: false,
    is_abstract: false,
    is_readonly: false,
    is_optional: false,
    type_parameters: [],
    child_symbols: [],
    modifiers: [], // Always provide default empty array for non-nullable field
    ...options,
  };
}

/**
 * Get tree-sitter node type for symbol kind
 */
function get_node_type_for_kind(kind: SymbolKind): string {
  switch (kind) {
    case "function":
      return "function_declaration";
    case "class":
      return "class_declaration";
    case "interface":
      return "interface_declaration";
    case "variable":
      return "variable_declaration";
    case "type":
      return "type_alias_declaration";
    case "enum":
      return "enum_declaration";
    case "namespace":
      return "namespace_declaration";
    case "parameter":
      return "parameter";
    case "property":
      return "property_definition";
    case "method":
      return "method_definition";
    case "import":
      return "import_statement";
    case "export":
      return "export_statement";
    default:
      return "unknown";
  }
}

/**
 * Check if a symbol is public
 */
export function is_public_symbol(symbol: Symbol): boolean {
  return (
    symbol.visibility === "public" ||
    (!symbol.visibility && symbol.is_exported)
  );
}

/**
 * Check if a symbol is accessible from a given scope
 */
export function is_symbol_accessible(
  symbol: Symbol,
  from_scope: ScopePath
): boolean {
  // Same scope or parent scope
  if (from_scope.startsWith(symbol.scope_path)) {
    return true;
  }

  // Public symbols are accessible
  if (is_public_symbol(symbol)) {
    return true;
  }

  // Check visibility rules
  if (symbol.visibility === "private") {
    // Private is only accessible in same class
    return from_scope === symbol.scope_path;
  }

  if (symbol.visibility === "protected") {
    // Protected is accessible in same class or subclasses
    // This would need inheritance information to fully implement
    return from_scope.startsWith(
      symbol.scope_path.split(".").slice(0, -1).join(".")
    );
  }

  return false;
}

/**
 * Get parent scope path
 */
export function get_parent_scope(scope_path: ScopePath): ScopePath | undefined {
  const components = scope_path.split(".");
  if (components.length <= 1) return undefined;
  return components.slice(0, -1).join(".") as ScopePath;
}
