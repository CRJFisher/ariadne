/**
 * Core types for scope resolution in function call analysis
 */

import type {
  Language,
  Location,
  ScopeId,
  LexicalScope,
  SymbolId,
  SymbolName,
  SymbolDefinition,
} from "@ariadnejs/types";

/**
 * Context for scope resolution operations
 */
export interface ScopeResolutionContext {
  readonly scopes: ReadonlyMap<ScopeId, LexicalScope>;
  readonly symbols: ReadonlyMap<SymbolId, SymbolDefinition>;
  readonly language: Language;
}

/**
 * Result of looking up a symbol in the scope chain
 */
export interface SymbolLookupResult {
  readonly symbol_id: SymbolId;
  readonly scope_id: ScopeId;
  readonly resolution_method: "lexical" | "hoisted" | "global";
  readonly visibility: "local" | "closure" | "global";
}

/**
 * Options for walking the scope chain
 */
export interface ScopeWalkOptions {
  /** Include hoisted symbols in search */
  readonly include_hoisted: boolean;
  /** Maximum depth to traverse (undefined = no limit) */
  readonly max_depth?: number;
  /** Tracker for visited scopes to prevent cycles */
  readonly visited_tracker?: Set<ScopeId>;
}

/**
 * Language-specific hoisting rules
 */
export interface HoistingRules {
  /** Function declarations hoisted to function/module scope */
  readonly function_declarations: boolean;
  /** var declarations hoisted (but not initialization) */
  readonly var_declarations: boolean;
  /** let/const declarations in temporal dead zone */
  readonly let_const_declarations: boolean;
  /** Class declarations hoisting behavior */
  readonly class_declarations: boolean;
}

/**
 * Scope analysis result
 */
export interface ScopeAnalysis {
  /** All scopes that contain a location */
  readonly containing_scopes: readonly ScopeId[];
  /** The immediate scope containing a location */
  readonly immediate_scope: ScopeId | null;
  /** Function scope containing the location (if any) */
  readonly function_scope: ScopeId | null;
  /** Module/global scope for the file */
  readonly module_scope: ScopeId;
}

/**
 * Built-in symbol information
 */
export interface BuiltinSymbol {
  readonly id: SymbolId;
  readonly name: SymbolName;
  readonly language: Language;
  readonly is_global: boolean;
  readonly documentation?: string;
}

/**
 * Configuration for scope resolution behavior
 */
export interface ScopeResolutionConfig {
  /** Enable hoisting resolution */
  readonly enable_hoisting: boolean;
  /** Enable global/builtin symbol resolution */
  readonly enable_globals: boolean;
  /** Maximum scope traversal depth */
  readonly max_scope_depth: number;
  /** Language-specific configuration */
  readonly language_config?: LanguageSpecificConfig;
}

/**
 * Language-specific configuration
 */
export interface LanguageSpecificConfig {
  /** JavaScript/TypeScript specific */
  readonly javascript?: {
    readonly treat_undefined_as_global: boolean;
    readonly include_node_globals: boolean;
    readonly include_browser_globals: boolean;
  };
  /** Python specific */
  readonly python?: {
    readonly include_builtins: boolean;
    readonly respect_nonlocal: boolean;
    readonly respect_global: boolean;
  };
  /** Rust specific */
  readonly rust?: {
    readonly include_std: boolean;
    readonly include_core: boolean;
  };
}