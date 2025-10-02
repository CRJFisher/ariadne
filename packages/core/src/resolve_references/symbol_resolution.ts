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
  SymbolReference,
  ConstructorDefinition,
  CallReference,
} from "@ariadnejs/types";
import { SemanticIndex } from "../index_single_file/semantic_index";

// Temporary types - to be replaced by actual implementations in future tasks
type ImportResolutionMap = Map<FilePath, Map<SymbolName, SymbolId>>;
type FunctionResolutionMap = { function_calls: Map<LocationKey, SymbolId> };
type MethodAndConstructorResolutionMap = {
  method_calls: Map<LocationKey, SymbolId>;
  constructor_calls: Map<LocationKey, SymbolId>;
};
type LocalTypeContext = Map<FilePath, Map<SymbolName, SymbolId>>;

// Temporary stub implementations - to be replaced in future tasks
function resolve_imports(params: { indices: ReadonlyMap<FilePath, SemanticIndex> }): ImportResolutionMap {
  // Stub: Will be implemented in task-epic-11.109.3
  return new Map();
}

function resolve_function_calls(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ImportResolutionMap
): FunctionResolutionMap {
  // Stub: Will be implemented in task-epic-11.109.5
  return { function_calls: new Map() };
}

function build_local_type_context(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ImportResolutionMap
): LocalTypeContext {
  // Stub: Will be implemented in task-epic-11.109.4
  return new Map();
}

function resolve_methods(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ImportResolutionMap,
  local_types: LocalTypeContext
): MethodAndConstructorResolutionMap {
  // Stub: Will be implemented in task-epic-11.109.6 and task-epic-11.109.7
  return {
    method_calls: new Map(),
    constructor_calls: new Map(),
  };
}


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

  const callable_definitions = new Map<SymbolId, AnyDefinition>();
  for (const idx of indices.values()) {
    // Collect all definition types from AnyDefinition union
    for (const [id, func] of idx.functions) {
      callable_definitions.set(id, func);
    }
    for (const [id, cls] of idx.classes) {
      callable_definitions.set(id, cls);
      // Constructor is an array
      if (cls.constructor) {
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
