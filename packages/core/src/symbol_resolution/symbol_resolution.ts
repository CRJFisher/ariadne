/**
 * Symbol Resolution - Four-phase pipeline
 *
 * Resolves all symbol references through incremental phases:
 * 1. Import/Export Resolution - Cross-file symbol mapping
 * 2. Function Call Resolution - Direct function calls via lexical scope
 * 3. Type Resolution - Type tracking and flow analysis
 * 4. Method/Constructor Resolution - Object-oriented call resolution
 */

import {
  type Location,
  type SymbolId,
  type FilePath,
  type SymbolName,
  type TypeId,
  type Language,
  type LocationKey,
  location_key,
  parse_location_key,
} from "@ariadnejs/types";
import type {
  ResolutionInput,
  ResolvedSymbols,
  ImportResolutionMap,
  FunctionResolutionMap,
  TypeResolutionMap,
  MethodResolutionMap,
} from "./types";
import { defined_type_id, TypeCategory } from "@ariadnejs/types";
import { SemanticIndex } from "../semantic_index/semantic_index";
import {
  build_global_type_registry,
  resolve_type_annotations,
  resolve_inheritance,
  resolve_type_tracking,
  resolve_type_members,
} from "./type_resolution";
import type {
  LocalTypeDefinition,
  LocalTypeExtraction,
  LocalTypeAnnotation as TypeResolutionAnnotation,
  LocalTypeFlow as TypeResolutionFlow,
  ResolvedMemberInfo,
} from "./type_resolution/types";
import type { LocalTypeTracking } from "../semantic_index/references/type_tracking";
import type { LocalTypeAnnotation as SemanticAnnotation } from "../semantic_index/references/type_annotation_references";
import {
  resolve_imports,
  create_import_resolution_context,
} from "./import_resolution";
import type { LanguageImportHandler } from "./import_resolution";
import { create_standard_language_handlers } from "./import_resolution/language_handlers";
import { phase2_resolve_functions } from "./function_resolution";

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
  const imports = phase1_resolve_imports(indices);

  // Phase 2: Resolve function calls
  // Creates: call_location -> function_symbol_id
  // Using the implementation from function_resolution module
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
  indices: ReadonlyMap<FilePath, SemanticIndex>
): ImportResolutionMap {
  // Create standard language handlers for all supported languages
  const language_handlers = create_standard_language_handlers();

  const context = create_import_resolution_context(indices, language_handlers);
  return resolve_imports(context);
}

/**
 * Phase 2: Function Call Resolution
 *
 * - Resolve function calls using lexical scoping
 * - Use resolved imports from Phase 1
 * - Handle hoisting (var, function declarations)
 * - Track global/builtin functions
 */

/**
 * Phase 3: Type Resolution
 *
 * Resolves all type-related information using imports and functions.
 * This phase integrates all refactored type modules.
 */
function phase3_resolve_types(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ImportResolutionMap,
  functions: FunctionResolutionMap
): TypeResolutionMap {
  // Step 1: Collect all local type information from indices
  const local_extraction = collect_local_types(indices);

  // Step 2: Build global type registry with TypeIds
  const type_registry = build_global_type_registry(
    local_extraction.type_definitions,
    imports.imports
  );

  // Step 3: Resolve type inheritance hierarchy
  const type_hierarchy = resolve_inheritance(
    local_extraction.type_definitions,
    imports.imports
  );

  // Extract inheritance hierarchy from type_hierarchy
  const inheritance_hierarchy = new Map<TypeId, readonly TypeId[]>();
  for (const [child_type, parent_types] of type_hierarchy.extends_map) {
    inheritance_hierarchy.set(child_type, parent_types);
  }

  // Extract interface implementations from type_hierarchy
  const interface_implementations = new Map<TypeId, readonly TypeId[]>();
  for (const [impl_type, interface_types] of type_hierarchy.implements_map) {
    interface_implementations.set(impl_type, interface_types);
  }

  // Step 4: Resolve all type members including inherited
  const all_type_definitions = new Map<TypeId, LocalTypeDefinition>();
  const resolved_members = new Map<
    TypeId,
    Map<SymbolName, ResolvedMemberInfo>
  >();

  // Build TypeId -> LocalTypeDefinition map
  for (const [file_path, defs] of local_extraction.type_definitions) {
    for (const def of defs) {
      const type_id = create_type_id(def);
      all_type_definitions.set(type_id, def);
    }
  }

  // Create hierarchy map from TypeHierarchyGraph
  const hierarchy_map = new Map<TypeId, TypeId[]>();
  for (const [child_type, parent_types] of type_hierarchy.extends_map) {
    hierarchy_map.set(child_type, parent_types);
  }
  for (const [impl_type, interface_types] of type_hierarchy.implements_map) {
    const existing = hierarchy_map.get(impl_type) || [];
    hierarchy_map.set(impl_type, [...existing, ...interface_types]);
  }

  // Resolve members for each type
  for (const [type_id, def] of all_type_definitions) {
    const resolved = resolve_type_members(
      type_id,
      def,
      hierarchy_map,
      all_type_definitions
    );
    resolved_members.set(type_id, resolved.all_members);
  }

  // Step 5: Resolve type annotations to TypeIds
  // Flatten all annotations from all files
  const all_annotations: TypeResolutionAnnotation[] = [];
  for (const file_annotations of local_extraction.type_annotations.values()) {
    all_annotations.push(...file_annotations);
  }
  const resolved_annotations = resolve_type_annotations(
    all_annotations,
    type_registry.type_names
  );

  // Step 6: Track variable types
  // Collect type tracking data separately
  const type_tracking_data = collect_type_tracking(indices);
  const type_tracking = resolve_type_tracking(
    type_tracking_data,
    type_registry
  );

  // Step 7: Analyze type flow
  // Convert type_flows from array format to single flow
  const type_flows_map = new Map<FilePath, TypeResolutionFlow>();
  for (const [file_path, flows] of local_extraction.type_flows) {
    if (flows && flows.length > 0) {
      type_flows_map.set(file_path, flows[0]);
    }
  }

  // Note: analyze_type_flow expects different parameters than what we have
  // This is a temporary workaround until the interfaces are aligned
  const type_flow = {
    assignment_types: new Map<Location, TypeId>(),
    flow_edges: [],
  };

  // Build result maps for compatibility
  const symbol_types = new Map<SymbolId, TypeId>();
  const reference_types = new Map<LocationKey, TypeId>();
  const type_members = new Map<TypeId, Map<SymbolName, SymbolId>>();
  const constructors = new Map<TypeId, SymbolId>();

  // Populate symbol_types from type_tracking
  if (type_tracking && type_tracking.variable_types) {
    for (const [symbol_id, type_id] of type_tracking.variable_types) {
      symbol_types.set(symbol_id, type_id);
    }
  }

  // Populate reference_types from resolved_annotations
  if (resolved_annotations) {
    for (const [loc_key, type_id] of resolved_annotations) {
      // Parse location key back to Location if needed
      // For now just skip since the types don't match
    }
  }

  if (type_flow && type_flow.assignment_types) {
    for (const [loc, type_id] of type_flow.assignment_types) {
      reference_types.set(location_key(loc), type_id);
    }
  }

  // Populate type_members from resolved_members
  if (resolved_members) {
    for (const [type_id, members] of resolved_members) {
      const member_map = new Map<SymbolName, SymbolId>();
      for (const [member_name, member_info] of members) {
        if (member_info.symbol_id) {
          member_map.set(member_name, member_info.symbol_id);
        }
      }
      type_members.set(type_id, member_map);
    }
  }

  // Find constructors for types
  for (const [file_path, index] of indices) {
    for (const [symbol_id, symbol] of index.symbols) {
      if (symbol.kind === "class") {
        const type_id = symbol_types.get(symbol_id);
        if (type_id) {
          constructors.set(type_id, symbol_id);
        }
      }
    }
  }

  return {
    symbol_types,
    reference_types,
    type_members,
    constructors,
    inheritance_hierarchy,
    interface_implementations,
  };
}

/**
 * Collect local type information from all files
 */
function collect_local_types(
  indices: ReadonlyMap<FilePath, SemanticIndex>
): LocalTypeExtraction {
  const type_definitions = new Map<FilePath, LocalTypeDefinition[]>();
  const type_annotations = new Map<FilePath, TypeResolutionAnnotation[]>();
  const type_flows = new Map<FilePath, TypeResolutionFlow[]>();

  for (const [file_path, index] of indices) {
    // Convert LocalTypeInfo to LocalTypeDefinition
    const defs: LocalTypeDefinition[] = index.local_types.map((local_type) => ({
      name: local_type.type_name,
      kind: local_type.kind,
      location: local_type.location,
      file_path,
      direct_members: local_type.direct_members,
      extends_names: local_type.extends_clause,
      implements_names: local_type.implements_clause,
    }));

    if (defs.length > 0) {
      type_definitions.set(file_path, defs);
    }

    // Convert semantic annotations to type resolution annotations
    if (
      index.local_type_annotations &&
      index.local_type_annotations.length > 0
    ) {
      const converted_annotations: TypeResolutionAnnotation[] =
        index.local_type_annotations.map((ann) => ({
          location: ann.location,
          annotation_text: ann.annotation_text,
          annotation_kind: map_annotation_kind(ann.annotation_kind),
          scope_id: ann.scope_id,
        }));
      type_annotations.set(file_path, converted_annotations);
    }

    // Convert semantic flow to type resolution flow - simplified
    if (index.local_type_flow) {
      const flow: TypeResolutionFlow = {
        location: index.local_type_flow.constructor_calls[0]?.location || {
          file_path,
          line: 0,
          column: 0,
          end_line: 0,
          end_column: 0,
        },
        flow_kind: "constructor" as const,
      };
      type_flows.set(file_path, [flow]);
    }
  }

  return {
    type_definitions,
    type_annotations,
    type_flows,
  };
}

/**
 * Map semantic annotation kinds to type resolution kinds
 */
function map_annotation_kind(
  kind: SemanticAnnotation["annotation_kind"]
): TypeResolutionAnnotation["annotation_kind"] {
  switch (kind) {
    case "variable":
      return "variable";
    case "parameter":
      return "parameter";
    case "return":
      return "return";
    case "property":
      return "property";
    case "generic":
    case "cast":
    default:
      return "variable"; // Default to variable for unsupported kinds
  }
}

/**
 * Collect type tracking data from indices
 */
function collect_type_tracking(
  indices: ReadonlyMap<FilePath, SemanticIndex>
): Map<FilePath, LocalTypeTracking> {
  const type_tracking = new Map<FilePath, LocalTypeTracking>();

  for (const [file_path, index] of indices) {
    if (index.local_type_tracking) {
      type_tracking.set(file_path, index.local_type_tracking);
    }
  }

  return type_tracking;
}

/**
 * Phase 4: Method and Constructor Resolution
 *
 * Can now use fully resolved types from Phase 3
 */
function phase4_resolve_methods(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ImportResolutionMap,
  functions: FunctionResolutionMap,
  types: TypeResolutionMap
): MethodResolutionMap {
  const method_calls = new Map<LocationKey, SymbolId>();
  const constructor_calls = new Map<LocationKey, SymbolId>();
  const calls_to_method = new Map<SymbolId, Location[]>();

  // Process method calls using resolved type information
  for (const [file_path, index] of indices) {
    // Process method calls from references
    if (index.references && index.references.member_accesses) {
      for (const member_access of index.references.member_accesses) {
        const receiver_object = member_access.object?.location;
        if (!receiver_object) {
          continue;
        }
        // Check if this is a method call (member access followed by call)
        const object_type = types.reference_types.get(
          location_key(receiver_object)
        );

        if (object_type) {
          // Look up method in resolved type members
          const type_members = types.type_members.get(object_type);
          if (type_members) {
            const method_id = type_members.get(member_access.member_name);
            if (method_id) {
              method_calls.set(location_key(member_access.location), method_id);

              // Update reverse mapping
              const calls = calls_to_method.get(method_id) || [];
              calls.push(member_access.location);
              calls_to_method.set(method_id, calls);
            }
          }
        }
      }
    }

    // Process constructor calls
    if (index.local_type_flow && index.local_type_flow.constructor_calls) {
      for (const ctor_call of index.local_type_flow.constructor_calls) {
        // Find the type for this constructor
        const type_name = ctor_call.class_name;
        const file_types = types.symbol_types;

        // Find the class symbol and its TypeId
        for (const [symbol_id, symbol] of index.symbols) {
          if (symbol.kind === "class" && symbol.name === type_name) {
            const type_id = types.symbol_types.get(symbol_id);
            if (type_id) {
              const ctor_id = types.constructors.get(type_id);
              if (ctor_id) {
                constructor_calls.set(
                  location_key(ctor_call.location),
                  ctor_id
                );

                // Update reverse mapping
                const calls = calls_to_method.get(ctor_id) || [];
                calls.push(ctor_call.location);
                calls_to_method.set(ctor_id, calls);
              }
            }
            break;
          }
        }
      }
    }
  }

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

  return {
    resolved_references,
    references_to_symbol,
    unresolved_references: new Map<LocationKey, SymbolId>(),
    phases: {
      imports,
      functions,
      types,
      methods,
    },
  };
}
