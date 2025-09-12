/**
 * Unified symbol and scope types that simplify and standardize
 * symbol representation and scope hierarchy across all modules
 */

import { Location, Language } from "./common";
import { FilePath, DocString } from "./aliases";
import { ScopePath, Visibility, TypeExpression } from "./branded-types";
import { SymbolName } from "./symbol_utils";
import { SymbolId } from "./symbol_utils";
import { SemanticNode, Resolution } from "./query";

// ============================================================================
// Symbol Types
// ============================================================================

/**
 * Core symbol kinds - simplified from multiple overlapping enums
 */
export type SymbolKind =
  | "variable" // let, const, var
  | "function" // Function declarations/expressions
  | "class" // Classes
  | "interface" // Interfaces/protocols
  | "type" // Type aliases
  | "enum" // Enumerations
  | "namespace" // Namespaces/modules
  | "parameter" // Function parameters
  | "property" // Class/object properties
  | "method" // Class methods
  | "import" // Import statements
  | "export"; // Export statements

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
  readonly visibility?: Visibility;
  readonly is_exported: boolean;
  readonly is_imported: boolean;
  readonly is_hoisted: boolean; // JS hoisting
  readonly is_static: boolean; // Static members
  readonly is_abstract: boolean; // Abstract classes/methods
  readonly is_readonly: boolean; // Readonly properties
  readonly is_optional: boolean; // Optional parameters/properties

  // Type information
  readonly type?: TypeExpression; // Type annotation/inference
  readonly type_parameters?: readonly TypeParameter[]; // Generic parameters

  // Documentation
  readonly docstring?: DocString;

  // Relations
  readonly parent_symbol?: SymbolId; // Containing class/namespace
  readonly child_symbols?: readonly SymbolId[]; // Nested symbols
}

/**
 * Simplified type parameter
 */
export interface TypeParameter {
  readonly name: string;
  readonly constraint?: TypeExpression;
  readonly default?: TypeExpression;
}

// ============================================================================
// Unified Scope Types
// ============================================================================

/**
 * Simplified scope types
 */
export type ScopeType =
  | "global" // File/module level
  | "class" // Class/interface/trait body
  | "function" // Function/method body
  | "block" // Block scope (if/for/while)
  | "namespace"; // Namespace/module scope

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
  readonly is_closure?: boolean; // Captures outer variables
  readonly captured_symbols?: readonly SymbolId[]; // Symbols from outer scopes
}

// ============================================================================
// Symbol Resolution Types
// ============================================================================

/**
 * Result of symbol resolution
 */
export interface ResolvedSymbol {
  readonly symbol: Symbol;
  readonly resolution: Resolution<{
    readonly definition_location: Location;
    readonly definition_file: FilePath;
    readonly import_chain?: readonly ImportStep[];
  }>;
}

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

/**
 * Symbol index for a file or project
 */
export interface SymbolIndex {
  readonly symbols: ReadonlyMap<SymbolId, Symbol>;
  readonly scopes: ReadonlyMap<ScopePath, Scope>;
  readonly file_symbols: ReadonlyMap<FilePath, readonly SymbolId[]>;
  readonly unresolved: ReadonlySet<SymbolName>;
}

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
    // Provide defaults for required boolean properties
    is_exported: false,
    is_imported: false,
    is_hoisted: false,
    is_static: false,
    is_abstract: false,
    is_readonly: false,
    is_optional: false,
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
 * Build a scope path from components
 */
export function build_scope_path(components: string[]): ScopePath {
  return components.join(".") as ScopePath;
}

/**
 * Get parent scope path
 */
export function get_parent_scope(scope_path: ScopePath): ScopePath | undefined {
  const components = scope_path.split(".");
  if (components.length <= 1) return undefined;
  return components.slice(0, -1).join(".") as ScopePath;
}
