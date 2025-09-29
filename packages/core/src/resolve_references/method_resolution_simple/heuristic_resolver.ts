/**
 * Heuristic-based method resolution
 *
 * Uses pragmatic strategies to resolve 95% of method calls without full type tracking:
 * 1. Look for local type information (constructors, type annotations, type guards)
 * 2. Use global method name -> definition index
 * 3. Narrow using sibling method calls on same receiver
 * 4. Apply proximity and naming convention heuristics
 *
 * TODO: rename this to method_resolution.ts when all the other files are deleted
 */

import type {
  Location,
  LocationKey,
  SymbolId,
  FilePath,
  SymbolName,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type { MemberAccessReference } from "../../index_single_file/references/member_access_references/member_access_references";
import type {
  ClassDefinition,
  MethodDefinition,
} from "@ariadnejs/types/src/symbol_definitions";
import type {
  HeuristicLookupContext,
  HeuristicResolution,
} from "./heuristic_types";

/**
 * Resolution strategies in priority order
 */
export enum ResolutionStrategy {
  EXPLICIT_TYPE = "explicit_type", // Type annotation or cast
  CONSTRUCTOR = "constructor", // new ClassName()
  TYPE_GUARD = "type_guard", // instanceof, type narrowing
  UNIQUE_METHOD = "unique_method", // Only one definition exists
  SIBLING_METHODS = "sibling_methods", // Other methods narrow type
  VARIABLE_NAME = "variable_name", // userService -> UserService
  FILE_PROXIMITY = "file_proximity", // Prefer same file/module
  IMPORT_SCOPE = "import_scope", // Type is imported
}

/**
 * Method candidate with confidence score
 */
interface MethodCandidate {
  method_id: SymbolId;
  class_id: SymbolId;
  confidence: number;
  strategy: ResolutionStrategy;
  is_static: boolean;
}

/**
 * Global index of method names to their definitions
 */
interface MethodIndex {
  // Method name -> Array of method definitions with their containing class
  methods: Map<
    SymbolName,
    Array<{
      class_id: SymbolId;
      method_id: SymbolId;
      location: Location;
    }>
  >;
  // Class id -> Set of method names (for sibling analysis)
  class_methods: Map<SymbolId, Set<SymbolName>>;
}

/**
 * Build global method index from all semantic indices
 */
export function build_method_index(
  indices: ReadonlyMap<FilePath, SemanticIndex>
): MethodIndex {
  const methods = new Map<
    SymbolName,
    Array<{
      class_id: SymbolId;
      method_id: SymbolId;
      location: Location;
    }>
  >();
  const class_methods = new Map<SymbolId, Set<SymbolName>>();

  // Iterate through all files and their definitions
  for (const [file_path, index] of indices) {
    // Process class definitions
    if (index.classes) {
      for (const class_def of index.classes.values()) {
        const method_names = new Set<SymbolName>();

        // Process methods in this class
        if (class_def.methods) {
          for (const method of class_def.methods) {
            // Add to method index
            let method_list = methods.get(method.name);
            if (!method_list) {
              method_list = [];
              methods.set(method.name, method_list);
            }

            method_list.push({
              class_id: class_def.symbol_id,
              method_id: method.symbol_id,
              location: method.location,
            });

            method_names.add(method.name);
          }
        }

        // Store method names for this class
        if (method_names.size > 0) {
          class_methods.set(class_def.symbol_id, method_names);
        }
      }
    }

    // Process interface definitions (they can have method signatures)
    // TODO: check interfaces for 'default' method implementations
  }

  return { methods, class_methods };
}

/**
 * Main heuristic resolver for method calls
 */
export function resolve_method_heuristic(
  member_access: MemberAccessReference,
  context: HeuristicLookupContext,
  method_index: MethodIndex
): HeuristicResolution | null {
  const candidates: MethodCandidate[] = [];

  // Strategy 1: Check for local type hints (if available)
  const class_hint = find_class_hint(member_access, context);
  if (class_hint) {
    // Find method in the hinted class
    const all_methods_with_name = method_index.methods.get(
      member_access.member_name
    );
    const matching_methods = all_methods_with_name?.filter(
      (def) => def.class_id === class_hint
    );
    if (matching_methods && matching_methods.length > 1) {
      // TODO: support method overloading
      console.warn(
        "Multiple methods found for the same class: " +
          member_access.member_name +
          " in class: " +
          class_hint +
          ". Using the first one."
      );
    }
    const matching_method = matching_methods?.[0];
    if (matching_method) {
      return {
        method_id: matching_method.method_id,
        class_id: matching_method.class_id,
        confidence: 0.95,
        strategy: ResolutionStrategy.EXPLICIT_TYPE,
      };
    }
  }

  // Strategy 2: Check for recent constructor in same scope
  const constructor_class = find_constructor_class(member_access, context);
  if (constructor_class) {
    const matching_method = method_index.methods
      .get(member_access.member_name)
      ?.find((def) => def.class_id === constructor_class);
    if (matching_method) {
      return {
        method_id: matching_method.method_id,
        class_id: matching_method.class_id,
        is_static: matching_method.is_static,
        confidence: 0.9,
        strategy: ResolutionStrategy.CONSTRUCTOR,
      };
    }
  }

  // Strategy 3: Check global method index
  const method_defs = method_index.methods.get(member_access.member_name);
  if (!method_defs || method_defs.length === 0) {
    return null; // Method name not found anywhere
  }

  // Strategy 4: If unique method name, use it
  if (method_defs.length === 1) {
    const def = method_defs[0];
    return {
      method_id: def.method_id,
      class_id: def.class_id,
      is_static: def.is_static,
      confidence: 1.0,
      strategy: ResolutionStrategy.UNIQUE_METHOD,
    };
  }

  // Strategy 5: Use sibling methods to narrow type
  const sibling_methods = find_sibling_method_calls(member_access, context);
  if (sibling_methods.size > 0) {
    // Find classes that have all sibling methods
    for (const def of method_defs) {
      const class_method_set = method_index.class_methods.get(def.class_id);
      if (class_method_set && is_superset(class_method_set, sibling_methods)) {
        candidates.push({
          method_id: def.method_id,
          class_id: def.class_id,
          confidence: 0.9,
          strategy: ResolutionStrategy.SIBLING_METHODS,
          is_static: def.is_static,
        });
      }
    }
  }

  // Strategy 6: Variable naming convention
  const inferred_type = infer_type_from_receiver_name(member_access, context);
  if (inferred_type) {
    for (const def of method_defs) {
      if (types_match_fuzzy(def.class_id, inferred_type)) {
        candidates.push({
          method_id: def.method_id,
          class_id: def.class_id,
          confidence: 0.7,
          strategy: ResolutionStrategy.VARIABLE_NAME,
          is_static: def.is_static,
        });
      }
    }
  }

  // Strategy 7: File proximity
  const current_file = context.current_file;
  for (const def of method_defs) {
    const def_location = get_symbol_location(def.method_id, context);
    if (def_location && def_location.file_path === current_file) {
      candidates.push({
        method_id: def.method_id,
        class_id: def.class_id,
        confidence: 0.6,
        strategy: ResolutionStrategy.FILE_PROXIMITY,
        is_static: def.is_static,
      });
    }
  }

  // Strategy 8: Check imported classes
  const imported_classes = get_imported_classes(context);
  for (const def of method_defs) {
    if (imported_classes.has(def.class_id)) {
      candidates.push({
        method_id: def.method_id,
        class_id: def.class_id,
        confidence: 0.8,
        strategy: ResolutionStrategy.IMPORT_SCOPE,
        is_static: def.is_static,
      });
    }
  }

  // Select best candidate
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.confidence - a.confidence);
    const best = candidates[0];
    return {
      method_id: best.method_id,
      class_id: best.class_id,
      is_static: best.is_static,
      confidence: best.confidence,
      strategy: best.strategy,
    };
  }

  return null;
}

/**
 * Find class hint from local context
 */
function find_class_hint(
  member_access: MemberAccessReference,
  context: HeuristicLookupContext
): SymbolId | null {
  if (!member_access.object?.location) return null;

  // Strategy 1: Check if receiver location has a known type
  const loc_key = location_key(member_access.object.location);
  const expr_type = context.local_type_context.expression_types.get(loc_key);
  if (expr_type) {
    return expr_type;
  }

  // Strategy 2: Try to extract variable name and look it up
  const variable_name = extract_variable_name(member_access.object);
  if (variable_name) {
    const var_type =
      context.local_type_context.variable_types.get(variable_name);
    if (var_type) {
      return var_type;
    }
  }

  // Strategy 3: Check if there's a recent constructor call
  // Look for pattern: const x = new Foo(); x.method()
  for (const ctor of context.local_type_context.constructor_calls) {
    if (ctor.assigned_to === variable_name) {
      return ctor.class_id;
    }
  }

  return null;
}

/**
 * Extract variable name from a member access object
 */
function extract_variable_name(object: any): string | null {
  // This would need to look at the AST node to extract the variable name
  // For simplicity, we'll check if object has a name property
  if (object.name) {
    return object.name;
  }
  // Could also check for identifier patterns
  if (object.type === "identifier" && object.text) {
    return object.text;
  }
  return null;
}

/**
 * Find class from recent constructor call
 */
function find_constructor_class(
  member_access: MemberAccessReference,
  context: HeuristicLookupContext
): SymbolId | null {
  if (!member_access.object?.location) return null;
  if (!context.local_type_context) return null;

  // This is now handled by find_class_hint, but we can keep this
  // as a separate strategy if needed for more specific constructor patterns

  // Extract variable name
  const variable_name = extract_variable_name(member_access.object);
  if (!variable_name) return null;

  // Look for a constructor call assigned to this variable
  for (const ctor of context.local_type_context.constructor_calls) {
    if (ctor.assigned_to === variable_name) {
      return ctor.class_id;
    }
  }

  return null;
}

/**
 * Find other method calls on the same receiver
 */
function find_sibling_method_calls(
  member_access: MemberAccessReference,
  context: HeuristicLookupContext
): Set<SymbolName> {
  const siblings = new Set<SymbolName>();

  if (!member_access.object?.location) return siblings;

  // Find all member accesses with the same receiver
  for (const other_access of context.current_index.references.member_accesses) {
    if (other_access === member_access) continue;
    if (!other_access.object?.location) continue;

    // Check if same receiver (simplified - would need data flow analysis)
    if (
      locations_refer_to_same_object(
        member_access.object.location,
        other_access.object.location,
        context
      )
    ) {
      siblings.add(other_access.member_name);
    }
  }

  return siblings;
}

/**
 * Infer type from variable naming convention
 */
function infer_type_from_receiver_name(
  member_access: MemberAccessReference,
  context: HeuristicLookupContext
): SymbolName | null {
  // userService -> UserService, orderRepo -> OrderRepository
  // This would require extracting variable names from AST
  return null; // TODO: Implement naming convention inference
}

/**
 * Get all imported classes in current file
 */
function get_imported_classes(context: HeuristicLookupContext): Set<SymbolId> {
  const imported = new Set<SymbolId>();
  const imports = context.imports.get(context.current_file);

  if (imports) {
    for (const symbol_id of imports.values()) {
      imported.add(symbol_id);
    }
  }

  return imported;
}

/**
 * Find method on a specific class
 */
function find_method_on_class(
  class_id: SymbolId,
  method_name: SymbolName,
  context: HeuristicLookupContext
): SymbolId | null {
  // Look through class definitions to find the method
  for (const [_, index] of context.indices) {
    if (index.classes) {
      const class_def = index.classes.get(class_id);
      if (class_def?.methods) {
        const method = class_def.methods.find((m) => m.name === method_name);
        if (method) {
          return method.id;
        }
      }
    }
  }
  return null;
}

/**
 * Get location of a symbol
 */
function get_symbol_location(
  symbol_id: SymbolId,
  context: HeuristicLookupContext
): Location | null {
  // Look through all definitions to find the symbol
  for (const [file_path, index] of context.indices) {
    // Check class methods
    if (index.classes) {
      for (const class_def of index.classes.values()) {
        if (class_def.methods) {
          for (const method of class_def.methods) {
            if (method.id === symbol_id) {
              return method.location;
            }
          }
        }
      }
    }

    // Check interface methods
    if (index.interfaces) {
      for (const interface_def of index.interfaces.values()) {
        if (interface_def.methods) {
          for (const method of interface_def.methods) {
            if (method.id === symbol_id) {
              return method.location;
            }
          }
        }
      }
    }

    // Check function definitions
    if (index.functions) {
      const func_def = index.functions.get(symbol_id);
      if (func_def) {
        return func_def.location;
      }
    }
  }
  return null;
}

/**
 * Check if two locations refer to the same object
 */
function locations_refer_to_same_object(
  loc1: Location,
  loc2: Location,
  context: HeuristicLookupContext
): boolean {
  // Simplified check - would need data flow analysis
  return (
    loc1.file_path === loc2.file_path &&
    loc1.start_position.row === loc2.start_position.row &&
    loc1.start_position.column === loc2.start_position.column
  );
}

/**
 * Fuzzy type matching by name similarity
 */
function types_match_fuzzy(class_id: SymbolId, type_name: SymbolName): boolean {
  // Would need to extract class name from symbol id
  // This could be enhanced by looking up the class definition
  // and comparing names with fuzzy matching
  return false;
}

/**
 * Check if set A contains all elements of set B
 */
function is_superset<T>(setA: Set<T>, setB: Set<T>): boolean {
  for (const elem of setB) {
    if (!setA.has(elem)) {
      return false;
    }
  }
  return true;
}
