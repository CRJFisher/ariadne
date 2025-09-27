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
  type TypeId,
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
} from "@ariadnejs/types";
import type {
  ResolutionInput,
  FunctionResolutionMap,
  TypeResolutionMap,
  MethodAndConstructorResolutionMap,
} from "./types";
import type { ResolvedSymbols } from "@ariadnejs/types/src/call_chains";
import { defined_type_id, TypeCategory } from "@ariadnejs/types";
import type { SemanticIndex } from "../semantic_index/semantic_index";
import {
  build_global_type_registry,
  resolve_type_annotations,
  resolve_inheritance,
  resolve_type_tracking,
  resolve_type_members,
  resolve_rust_reference_types,
  resolve_rust_function_types,
  resolve_closure_types,
  resolve_higher_order_function_calls,
  resolve_ownership_operations,
  integrate_pattern_matching_into_type_resolution,
  resolve_rust_async_types,
  resolve_const_generics,
  resolve_associated_types,
  resolve_unsafe_contexts,
  resolve_loop_constructs,
} from "./type_resolution";
import { analyze_integrated_type_flow } from "./type_flow_integration";
import type {
  LocalTypeDefinition,
  LocalTypeExtraction,
  LocalTypeAnnotation as TypeResolutionAnnotation,
  LocalTypeFlowPattern as TypeResolutionFlow,
  ResolvedMemberInfo,
} from "./type_resolution/types";
import type { LocalTypeTracking } from "../semantic_index/references/type_tracking";
import type { LocalTypeAnnotation as SemanticAnnotation } from "../semantic_index/references/type_annotation_references";
import { resolve_imports } from "./import_resolution";
import { resolve_function_calls } from "./function_resolution";
import { build_local_type_context } from "./local_type_context";
import { CallReference } from "../semantic_index/references/call_references";
import { resolve_methods } from "./method_resolution_simple/method_resolution";
/**
 * Create a TypeId from a local type definition
 */
function create_type_id(type_def: LocalTypeDefinition): TypeId {
  const category = kind_to_category(type_def.kind);
  return defined_type_id(category, type_def.name, type_def.location);
}

/**
 * Convert type kind to TypeCategory
 */
function kind_to_category(
  kind: "class" | "interface" | "type" | "enum"
):
  | TypeCategory.CLASS
  | TypeCategory.INTERFACE
  | TypeCategory.TYPE_ALIAS
  | TypeCategory.ENUM {
  switch (kind) {
    case "class":
      return TypeCategory.CLASS;
    case "interface":
      return TypeCategory.INTERFACE;
    case "type":
      return TypeCategory.TYPE_ALIAS;
    case "enum":
      return TypeCategory.ENUM;
  }
}

/**
 * Main entry point for symbol resolution
 */
export function resolve_symbols(input: ResolutionInput): ResolvedSymbols {
  const { indices } = input;

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
