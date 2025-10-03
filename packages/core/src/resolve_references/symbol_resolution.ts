/**
 * Symbol Resolution - On-demand scope-aware unified pipeline
 *
 * Architecture:
 * 1. Build scope resolver index (creates lazy resolver functions)
 * 2. Create resolution cache (stores resolved symbol_ids)
 * 3. Build type context (uses resolver index for type names)
 * 4. Resolve all call types (on-demand with caching)
 * 5. Combine results
 *
 * Resolution Flow:
 * - Resolver index is lightweight (just closures)
 * - Only referenced symbols are resolved
 * - Cache is populated as resolutions occur
 * - Type context uses resolver index for type name resolution
 * - All resolvers share the same cache for consistency
 */

import {
  type Location,
  type SymbolId,
  type FilePath,
  type LocationKey,
  parse_location_key,
  AnyDefinition,
  ResolvedSymbols,
  CallReference,
  SymbolReference,
} from "@ariadnejs/types";
import { SemanticIndex } from "../index_single_file/semantic_index";

import { build_scope_resolver_index } from "./scope_resolver_index/scope_resolver_index";
import { create_resolution_cache } from "./resolution_cache/resolution_cache";
import { build_type_context } from "./type_resolution/type_context";
import {
  resolve_function_calls,
  resolve_method_calls,
  resolve_constructor_calls,
} from "./call_resolution";

/**
 * Main entry point for symbol resolution
 *
 * Implements a five-phase pipeline:
 * 1. Build scope resolver index (lightweight - just closures)
 * 2. Create resolution cache (shared by all resolvers)
 * 3. Build type context (uses resolver index + cache)
 * 4. Resolve all call types (on-demand with caching)
 * 5. Combine results into final output
 *
 * @param indices - Map of file_path → SemanticIndex for all files
 * @returns ResolvedSymbols containing all resolved references and definitions
 */
export function resolve_symbols(
  indices: ReadonlyMap<FilePath, SemanticIndex>
): ResolvedSymbols {
  // Phase 1: Build scope resolver index (lightweight)
  // Creates resolver functions: scope_id -> name -> resolver()
  // Includes lazy import resolvers that follow export chains on-demand
  const resolver_index = build_scope_resolver_index(indices);

  // Phase 2: Create resolution cache
  // Stores on-demand resolutions: (scope_id, name) -> symbol_id
  // Shared across all resolvers for consistency and performance
  const cache = create_resolution_cache();

  // Phase 3: Build type context
  // Tracks variable types and type members
  // Uses resolver_index + cache to resolve type names
  const type_context = build_type_context(indices, resolver_index, cache);

  // Phase 4: Resolve all call types (on-demand with caching)
  const function_calls = resolve_function_calls(indices, resolver_index, cache);
  const method_calls = resolve_method_calls(
    indices,
    resolver_index,
    cache,
    type_context
  );
  const constructor_calls = resolve_constructor_calls(
    indices,
    resolver_index,
    cache,
    type_context
  );

  // Phase 5: Combine results
  return combine_results(
    indices,
    function_calls,
    method_calls,
    constructor_calls
  );
}

/**
 * Combine all resolution maps into final output
 *
 * Merges function, method, and constructor call resolutions into:
 * - resolved_references: Map of location -> resolved symbol_id
 * - references_to_symbol: Reverse map of symbol_id -> all reference locations
 * - references: All call references from semantic indices
 * - definitions: All callable definitions (functions, classes, methods, constructors)
 *
 * @param indices - All semantic indices
 * @param function_calls - Resolved function call locations
 * @param method_calls - Resolved method call locations
 * @param constructor_calls - Resolved constructor call locations
 * @returns Combined ResolvedSymbols output
 */
function combine_results(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  function_calls: Map<LocationKey, SymbolId>,
  method_calls: Map<LocationKey, SymbolId>,
  constructor_calls: Map<LocationKey, SymbolId>
): ResolvedSymbols {
  // Master map: any reference location -> resolved SymbolId
  const resolved_references = new Map<LocationKey, SymbolId>();

  // Add function calls
  for (const [loc, id] of function_calls) {
    resolved_references.set(loc, id);
  }

  // Add method calls
  for (const [loc, id] of method_calls) {
    resolved_references.set(loc, id);
  }

  // Add constructor calls
  for (const [loc, id] of constructor_calls) {
    resolved_references.set(loc, id);
  }

  // Build reverse map: SymbolId -> all locations that reference it
  const references_to_symbol = new Map<SymbolId, Location[]>();
  for (const [loc_key, symbol_id] of resolved_references) {
    const locs = references_to_symbol.get(symbol_id) || [];
    locs.push(parse_location_key(loc_key));
    references_to_symbol.set(symbol_id, locs);
  }

  // Collect all call references
  const all_call_references: CallReference[] = [];
  for (const index of indices.values()) {
    // Filter for call-type references and convert to CallReference
    const call_refs = index.references
      .filter((ref): ref is SymbolReference & { call_type: NonNullable<SymbolReference['call_type']> } =>
        ref.call_type !== undefined
      )
      .map((ref): CallReference => ({
        location: ref.location,
        name: ref.name,
        scope_id: ref.scope_id,
        call_type: ref.call_type as "function" | "method" | "constructor" | "super" | "macro",
        receiver: ref.context?.receiver_location ? {
          location: ref.context.receiver_location,
          name: undefined,
        } : undefined,
        construct_target: ref.context?.construct_target,
      }));
    all_call_references.push(...call_refs);
  }

  // Collect all callable definitions
  const callable_definitions = new Map<SymbolId, AnyDefinition>();
  for (const idx of indices.values()) {
    for (const [id, func] of idx.functions) {
      callable_definitions.set(id, func);
    }
    for (const [id, cls] of idx.classes) {
      callable_definitions.set(id, cls);
      // Use Array.isArray to avoid JavaScript's object.constructor property
      if (Array.isArray(cls.constructor)) {
        for (const ctor of cls.constructor) {
          callable_definitions.set(ctor.symbol_id, ctor);
        }
      }
      for (const method of cls.methods) {
        callable_definitions.set(method.symbol_id, method);
      }
    }
  }

  return {
    resolved_references,
    references_to_symbol,
    references: all_call_references,
    definitions: callable_definitions,
  };
}
