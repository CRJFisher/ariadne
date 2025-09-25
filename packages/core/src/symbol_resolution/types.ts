/**
 * Types for multi-phase symbol resolution
 *
 * All resolution phases produce simple mappings between existing types
 * from the semantic index to resolved SymbolIds.
 */

import type {
  FilePath,
  SymbolId,
  SymbolName,
  Location,
  LocationKey,
  TypeId,
} from "@ariadnejs/types";
import { SemanticIndex } from "../semantic_index/semantic_index";

// ============================================================================
// Resolution Maps - Core output types
// ============================================================================

/**
 * Phase 2: Function Call Resolution
 * Maps function call locations to the called function's SymbolId
 */
export interface FunctionResolutionMap {
  // Reference location key -> resolved function SymbolId
  readonly function_calls: ReadonlyMap<LocationKey, SymbolId>;

  // Reverse map for finding all calls to a function
  // Function SymbolId -> call site locations
  readonly calls_to_function: ReadonlyMap<SymbolId, readonly Location[]>;

  // Rust-specific resolution maps
  readonly closure_calls: ReadonlyMap<LocationKey, SymbolId>;
  readonly higher_order_calls: ReadonlyMap<LocationKey, SymbolId>;
  readonly function_pointer_calls: ReadonlyMap<LocationKey, SymbolId>;
}

/**
 * Phase 3: Type Resolution
 * Maps symbols and references to their types
 */
export interface TypeResolutionMap {
  // Symbol definition -> its TypeId
  readonly symbol_types: ReadonlyMap<SymbolId, TypeId>;

  // Reference location key -> type at that location (for type flow)
  readonly reference_types: ReadonlyMap<LocationKey, TypeId>;

  // Type -> members available on that type
  readonly type_members: ReadonlyMap<TypeId, ReadonlyMap<SymbolName, SymbolId>>;

  // Class TypeId -> constructor SymbolId
  readonly constructors: ReadonlyMap<TypeId, SymbolId>;

  // Type inheritance hierarchy - direct parent relationships
  readonly inheritance_hierarchy: ReadonlyMap<TypeId, readonly TypeId[]>;

  // Interface implementations - types that implement interfaces
  readonly interface_implementations: ReadonlyMap<TypeId, readonly TypeId[]>;

  // Additional properties for compatibility with tests and legacy code
  readonly type_definitions?: ReadonlyMap<FilePath, readonly any[]>;
  readonly type_flow_edges?: readonly any[];
  readonly type_registry?: any;
}

/**
 * Phase 4: Method/Constructor Resolution
 * Maps method calls and constructor calls to their definitions
 */
export interface MethodResolutionMap {
  // Method call location key -> resolved method SymbolId
  readonly method_calls: ReadonlyMap<LocationKey, SymbolId>;

  // Constructor call location key -> resolved constructor SymbolId
  readonly constructor_calls: ReadonlyMap<LocationKey, SymbolId>;

  // Reverse map: method/constructor -> call sites
  readonly calls_to_method: ReadonlyMap<SymbolId, readonly Location[]>;

  // Resolution details for debugging and analysis
  readonly resolution_details: ReadonlyMap<LocationKey, any>;
}

// ============================================================================
// Resolution Input
// ============================================================================

/**
 * Input to the resolution pipeline
 */
export interface ResolutionInput {
  // All semantic indices to resolve
  readonly indices: ReadonlyMap<FilePath, SemanticIndex>;

  // Optional: specific files to focus on (for incremental resolution)
  readonly target_files?: readonly FilePath[];
}
