/**
 * Symbol Resolution - Four-phase pipeline
 *
 * Resolves all symbol references through incremental phases:
 * 1. Import/Export Resolution - Cross-file symbol mapping
 * 2. Function Call Resolution - Direct function calls via lexical scope
 * 3. Type Resolution - Type tracking and flow analysis
 * 4. Method/Constructor Resolution - Object-oriented call resolution
 */

import type {
  Location,
  SymbolId,
  SymbolReference,
  FilePath,
  SymbolName,
  TypeId,
} from "@ariadnejs/types";
import type {
  ResolutionInput,
  ResolvedSymbols,
  ImportResolutionMap,
  FunctionResolutionMap,
  TypeResolutionMap,
  MethodResolutionMap,
} from "./types";
import { SemanticIndex } from "../semantic_index/semantic_index";

/**
 * Main entry point for symbol resolution
 */
export function resolve_symbols(input: ResolutionInput): ResolvedSymbols {
  const { indices } = input;

  // Phase 1: Resolve imports/exports
  // Creates: file_path -> imported_name -> symbol_id
  const imports = phase1_resolve_imports(indices);

  // Phase 2: Resolve function calls
  // Creates: call_location -> function_symbol_id
  const functions = phase2_resolve_functions(indices, imports);

  // Phase 3: Resolve types
  // Creates: symbol_id -> type_id, location -> type_id
  const types = phase3_resolve_types(indices, imports, functions);

  // Phase 4: Resolve methods and constructors
  // Creates: method_call_location -> method_symbol_id
  const methods = phase4_resolve_methods(indices, imports, functions, types);

  // Combine all resolutions
  return combine_results(indices, imports, functions, types, methods);
}

/**
 * Phase 1: Import/Export Resolution
 *
 * - Match imports to exports across files
 * - Handle named, default, and namespace imports
 * - Resolve module paths to actual files
 */
function phase1_resolve_imports(
  _indices: ReadonlyMap<FilePath, SemanticIndex>
): ImportResolutionMap {
  const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();

  // TODO: Implementation
  // 1. For each file's imports
  // 2. Resolve import path to source file
  // 3. Match import names to export names
  // 4. Map imported names to exported symbol IDs

  return { imports };
}

/**
 * Phase 2: Function Call Resolution
 *
 * - Resolve function calls using lexical scoping
 * - Use resolved imports from Phase 1
 * - Handle hoisting (var, function declarations)
 * - Track global/builtin functions
 */
function phase2_resolve_functions(
  _indices: ReadonlyMap<FilePath, SemanticIndex>,
  _imports: ImportResolutionMap
): FunctionResolutionMap {
  const function_calls = new Map<Location, SymbolId>();
  const calls_to_function = new Map<SymbolId, Location[]>();

  // TODO: Implementation
  // 1. For each call reference
  // 2. Try lexical scope resolution (walk up scope chain)
  // 3. Try imported symbol resolution
  // 4. Try global/builtin resolution
  // 5. Build bidirectional mappings

  return { function_calls, calls_to_function };
}

/**
 * Phase 3: Type Resolution
 *
 * - Extract type definitions from classes/interfaces
 * - Track type flow through assignments
 * - Use function call resolution for return types
 * - Build type -> members mapping for Phase 4
 */
function phase3_resolve_types(
  _indices: ReadonlyMap<FilePath, SemanticIndex>,
  _imports: ImportResolutionMap,
  _functions: FunctionResolutionMap
): TypeResolutionMap {
  const symbol_types = new Map<SymbolId, TypeId>();
  const reference_types = new Map<Location, TypeId>();
  const type_members = new Map<TypeId, Map<SymbolName, SymbolId>>();
  const constructors = new Map<TypeId, SymbolId>();

  // TODO: Implementation
  // 1. Extract class/interface definitions -> TypeIds
  // 2. Map symbols to their types (declarations, inference)
  // 3. Track type flow through function returns
  // 4. Track type flow through assignments
  // 5. Build type member mappings

  return { symbol_types, reference_types, type_members, constructors };
}

/**
 * Phase 4: Method and Constructor Resolution
 *
 * - Resolve obj.method() using receiver types from Phase 3
 * - Resolve new Class() using constructor mappings
 * - Handle static vs instance methods
 * - Support inheritance chains
 */
function phase4_resolve_methods(
  _indices: ReadonlyMap<FilePath, SemanticIndex>,
  _imports: ImportResolutionMap,
  _functions: FunctionResolutionMap,
  _types: TypeResolutionMap
): MethodResolutionMap {
  const method_calls = new Map<Location, SymbolId>();
  const constructor_calls = new Map<Location, SymbolId>();
  const calls_to_method = new Map<SymbolId, Location[]>();

  // TODO: Implementation
  // 1. For each member_access + call reference
  // 2. Get receiver type from Phase 3
  // 3. Look up method in type members
  // 4. For constructor calls, use type constructors map
  // 5. Build bidirectional mappings

  return { method_calls, constructor_calls, calls_to_method };
}

/**
 * Combine results from all phases
 */
function combine_results(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ImportResolutionMap,
  functions: FunctionResolutionMap,
  types: TypeResolutionMap,
  methods: MethodResolutionMap
): ResolvedSymbols {
  // Merge all resolution maps
  const resolved_references = new Map<Location, SymbolId>();

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
    locs.push(loc);
    references_to_symbol.set(id, locs);
  }

  // Collect unresolved
  // const unresolved_references = new Map<Location, SymbolReference>();
  // for (const index of indices.values()) {
  //   for (const ref of index.references) {
  //     if (!resolved_references.has(ref.location)) {
  //       unresolved_references.set(ref.location, ref);
  //     }
  //   }
  // }

  return {
    resolved_references,
    references_to_symbol,
    unresolved_references: new Map(), // TODO: fix
    phases: {
      imports,
      functions,
      types,
      methods,
    },
  };
}
