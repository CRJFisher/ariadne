/**
 * Symbol Resolution - Four-phase consolidated pipeline
 *
 * Resolves all symbol references through incremental phases:
 * 1. Import/Export Resolution - Cross-file symbol mapping
 * 2. Function Call Resolution - Direct function calls via lexical scope
 * 3. Type Resolution - **CONSOLIDATED (2024)**: Unified pipeline handling all 8 type features:
 *    - Data Collection, Type Registry, Inheritance Resolution
 *    - Type Members, Annotations, Tracking, Flow Analysis, Constructor Discovery
 * 4. Method/Constructor Resolution - Object-oriented call resolution
 *
 * **Architectural Note**: Phase 3 consolidates previously scattered type resolution
 * functionality into a single, tested, coordinated pipeline for improved consistency
 * and maintainability.
 */

import {
  type Location,
  type SymbolId,
  type FilePath,
  type SymbolName,
  type LocationKey,
  type ScopeId,
  location_key,
  parse_location_key,
  AnyDefinition,
  FunctionDefinition,
  InterfaceDefinition,
  ImportDefinition,
  NamespaceDefinition,
  VariableDefinition,
  EnumDefinition,
  ClassDefinition,
  ResolvedSymbols,
} from "@ariadnejs/types";
import { SemanticIndex } from "../index_single_file/semantic_index";


/**
 * Main entry point for symbol resolution
 */
export function resolve_symbols(indices: ReadonlyMap<FilePath, SemanticIndex>): ResolvedSymbols {

  // Phase 1: Resolve imports/exports
  // Creates: file_path -> imported_name -> symbol_id
  // TODO: check that symbol-names are only resolved to imports based on there being scope info i.e. local scope can shadow and override import
  const imports = resolve_imports({ indices });

  // Phase 2: Resolve function calls
  // Creates: call_location -> function_symbol_id
  // Using the implementation from function_resolution module
  const functions = resolve_function_calls(indices, imports);

  // Phase 3: Build local type context
  // Creates: local type context for method resolution
  // This just tries to match local type information to global symbols (definitions).
  // A more complete type tracking, required to resolve method calls would require significant work.
  const local_types = build_local_type_context(indices, imports);

  // Phase 4: Resolve methods and constructors
  // Creates: method_call_location -> method_symbol_id
  const methods = resolve_methods(indices, imports, local_types);

  // Combine all resolutions
  return combine_results(indices, functions, methods);
}

/**
 * Combine results from all phases
 */
function combine_results(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  functions: FunctionResolutionMap,
  methods: MethodAndConstructorResolutionMap
): ResolvedSymbols {
  // Merge all resolution maps
  const resolved_references = new Map<LocationKey, SymbolId>();

  // Add function calls
  for (const [loc, id] of functions.function_calls) {
    resolved_references.set(loc, id);
  }

  // Add method calls
  for (const [loc, id] of methods.method_calls) {
    resolved_references.set(loc, id);
  }

  // Add constructor calls
  for (const [loc, id] of methods.constructor_calls) {
    resolved_references.set(loc, id);
  }

  // Build reverse map
  const references_to_symbol = new Map<SymbolId, Location[]>();
  for (const [loc, id] of resolved_references) {
    const locs = references_to_symbol.get(id) || [];
    locs.push(parse_location_key(loc));
    references_to_symbol.set(id, locs);
  }

  const all_call_references: CallReference[] = [];

  for (const index of indices.values()) {
    all_call_references.push(...index.references.calls);
  }

  const callable_definitions = new Map<SymbolId, AnyDefinition>();
  for (const idx of indices.values()) {
    // Collect all definition types from AnyDefinition union
    for (const [id, func] of idx.functions) {
      callable_definitions.set(id, func);
    }
    for (const [id, cls] of idx.classes) {
      callable_definitions.set(id, cls);
      if (cls.constructor) {
        callable_definitions.set(cls.constructor.symbol_id, cls.constructor);
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
