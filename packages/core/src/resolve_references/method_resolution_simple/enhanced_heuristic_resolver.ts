/**
 * Enhanced Heuristic Method Resolution
 *
 * Uses rich semantic index data directly for improved type resolution accuracy
 */

import {
  Location,
  LocationKey,
  SymbolId,
  FilePath,
  SymbolName,
  ScopeId,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type { MemberAccessReference } from "../../index_single_file/references/member_access_references/member_access_references";
import {
  EnhancedMethodResolutionContext,
  DetailedStrategy,
} from "./enhanced_context";
import { find_variable_type_enhanced } from "./enhanced_context";
import { find_containing_scope } from "../../index_single_file/scope_tree";

/**
 * Enhanced resolution result with detailed tracking
 */
export interface EnhancedResolution {
  method_id: SymbolId;
  class_id: SymbolId;
  confidence: number;
  strategy: DetailedStrategy;
  is_static?: boolean;
}

/**
 * Method index for global lookup
 */
export interface MethodIndex {
  methods: Map<
    SymbolName,
    Array<{
      class_id: SymbolId;
      method_id: SymbolId;
      location: Location;
      is_static?: boolean;
    }>
  >;
  class_methods: Map<SymbolId, Set<SymbolName>>;
}

/**
 * Resolve method using enhanced context
 */
export function resolve_method_enhanced(
  member_access: MemberAccessReference,
  context: EnhancedMethodResolutionContext,
  method_index: MethodIndex
): EnhancedResolution | null {
  // Get the scope for the member access
  const scope = find_scope_for_location(member_access.location, context);

  // Strategy 1: Direct type annotation or cast
  const direct_type = find_direct_type_hint(member_access, context, scope);
  if (direct_type) {
    const method = find_method_on_type(
      direct_type.type_id,
      member_access.member_name,
      method_index
    );
    if (method) {
      return {
        method_id: method.method_id,
        class_id: method.class_id,
        confidence: 0.99,
        strategy: direct_type.strategy,
        is_static: method.is_static,
      };
    }
  }

  // Strategy 2: Variable type resolution
  const variable_type = find_variable_type_hint(member_access, context, scope);
  if (variable_type) {
    const method = find_method_on_type(
      variable_type.type_id,
      member_access.member_name,
      method_index
    );
    if (method) {
      return {
        method_id: method.method_id,
        class_id: method.class_id,
        confidence: 0.95,
        strategy: variable_type.strategy,
        is_static: method.is_static,
      };
    }
  }

  // Strategy 3: Check for type guards in scope
  const guarded_type = find_type_guard_hint(member_access, context, scope);
  if (guarded_type) {
    const method = find_method_on_type(
      guarded_type,
      member_access.member_name,
      method_index
    );
    if (method) {
      return {
        method_id: method.method_id,
        class_id: method.class_id,
        confidence: 0.93,
        strategy: DetailedStrategy.TYPE_GUARD,
        is_static: method.is_static,
      };
    }
  }

  // Strategy 4: Return type tracking
  const return_type = find_return_type_hint(member_access, context, scope);
  if (return_type) {
    const method = find_method_on_type(
      return_type,
      member_access.member_name,
      method_index
    );
    if (method) {
      return {
        method_id: method.method_id,
        class_id: method.class_id,
        confidence: 0.9,
        strategy: DetailedStrategy.RETURN_TYPE_ANNOTATION,
        is_static: method.is_static,
      };
    }
  }

  // Strategy 5: Unique method name
  const methods = method_index.methods.get(member_access.member_name);
  if (methods?.length === 1) {
    const method = methods[0];
    return {
      method_id: method.method_id,
      class_id: method.class_id,
      confidence: 1.0,
      strategy: DetailedStrategy.UNIQUE_METHOD,
      is_static: method.is_static,
    };
  }

  // Strategy 6: Sibling methods
  const sibling_narrowed = narrow_by_sibling_methods(
    member_access,
    context,
    method_index,
    methods
  );
  if (sibling_narrowed) {
    return sibling_narrowed;
  }

  // Strategy 7: Import scope
  if (methods) {
    for (const method of methods) {
      if (is_type_imported(method.class_id, context)) {
        return {
          method_id: method.method_id,
          class_id: method.class_id,
          confidence: 0.8,
          strategy: DetailedStrategy.IMPORT_SCOPE,
          is_static: method.is_static,
        };
      }
    }
  }

  // Strategy 8: File proximity
  if (methods) {
    for (const method of methods) {
      if (method.location.file_path === context.file_path) {
        return {
          method_id: method.method_id,
          class_id: method.class_id,
          confidence: 0.6,
          strategy: DetailedStrategy.FILE_PROXIMITY,
          is_static: method.is_static,
        };
      }
    }
  }

  return null;
}

/**
 * Find direct type hint from annotations or casts
 */
function find_direct_type_hint(
  member_access: MemberAccessReference,
  context: EnhancedMethodResolutionContext,
  scope: ScopeId | null
): { type_id: SymbolId; strategy: DetailedStrategy } | null {
  if (!member_access.object?.location) return null;

  // Check for type cast at this location
  const loc_key = location_key(member_access.object.location);
  const annotation = context.annotation_map.get(loc_key);

  if (annotation && annotation.annotation_kind === "cast") {
    const type_name = extract_type_name(annotation.annotation_text);
    if (type_name) {
      const type_id = resolve_type_name(type_name, context);
      if (type_id) {
        return { type_id, strategy: DetailedStrategy.EXPLICIT_CAST };
      }
    }
  }

  return null;
}

/**
 * Find variable type hint using enhanced resolution
 */
function find_variable_type_hint(
  member_access: MemberAccessReference,
  context: EnhancedMethodResolutionContext,
  scope: ScopeId | null
): { type_id: SymbolId; strategy: DetailedStrategy } | null {
  if (!member_access.object) return null;

  // Extract variable name from object
  const var_name = extract_variable_name(member_access.object);
  if (!var_name) return null;

  // Use enhanced variable type resolution
  return find_variable_type_enhanced(
    var_name,
    member_access.location,
    context,
    scope || undefined
  );
}

/**
 * Find type guard hint in current scope
 */
function find_type_guard_hint(
  member_access: MemberAccessReference,
  context: EnhancedMethodResolutionContext,
  scope: ScopeId | null
): SymbolId | null {
  if (!member_access.object || !scope) return null;

  const var_name = extract_variable_name(member_access.object);
  if (!var_name) return null;

  // Type guards are not directly available in LocalTypeTracking
  // This would need to be extracted from the semantic index references
  // For now, return null - this is a limitation that needs addressing
  // TODO: Add type guard extraction to LocalTypeTracking or use references directly

  return null;
}

/**
 * Find return type hint for containing function
 */
function find_return_type_hint(
  member_access: MemberAccessReference,
  context: EnhancedMethodResolutionContext,
  scope: ScopeId | null
): SymbolId | null {
  if (!scope) return null;

  // Look for return type annotation in current or parent function scope
  const function_scope = find_function_scope(scope, context);
  if (!function_scope) return null;

  // Return type annotations are not directly available in LocalTypeTracking
  // We could look for annotations with annotation_kind === 'return'
  // For now, return null - this is a limitation that needs addressing
  // TODO: Extract return type annotations from LocalTypeAnnotation[]

  return null;
}

/**
 * Narrow by sibling method calls
 */
function narrow_by_sibling_methods(
  member_access: MemberAccessReference,
  context: EnhancedMethodResolutionContext,
  method_index: MethodIndex,
  candidate_methods?: Array<{
    class_id: SymbolId;
    method_id: SymbolId;
    is_static?: boolean;
  }>
): EnhancedResolution | null {
  if (!candidate_methods || candidate_methods.length === 0) return null;
  if (!member_access.object) return null;

  // Find other method calls on the same receiver
  const siblings = find_sibling_method_names(member_access, context);
  if (siblings.size === 0) return null;

  // Find classes that have all sibling methods
  for (const method of candidate_methods) {
    const class_methods = method_index.class_methods.get(method.class_id);
    if (class_methods && is_superset(class_methods, siblings)) {
      return {
        method_id: method.method_id,
        class_id: method.class_id,
        confidence: 0.9,
        strategy: DetailedStrategy.SIBLING_METHODS,
        is_static: method.is_static,
      };
    }
  }

  return null;
}

/**
 * Find method on a specific type
 */
function find_method_on_type(
  type_id: SymbolId,
  method_name: SymbolName,
  method_index: MethodIndex
): { method_id: SymbolId; class_id: SymbolId; is_static?: boolean } | null {
  const methods = method_index.methods.get(method_name);
  if (!methods) return null;

  for (const method of methods) {
    if (method.class_id === type_id) {
      return {
        method_id: method.method_id,
        class_id: method.class_id,
        is_static: method.is_static,
      };
    }
  }

  return null;
}

/**
 * Check if type is imported
 */
function is_type_imported(
  type_id: SymbolId,
  context: EnhancedMethodResolutionContext
): boolean {
  for (const imported_id of context.imports.values()) {
    if (imported_id === type_id) {
      return true;
    }
  }
  return false;
}

/**
 * Find scope for a location
 */
function find_scope_for_location(
  location: Location,
  context: EnhancedMethodResolutionContext
): ScopeId | null {
  const root_scope = context.current_index.scopes.get(
    context.current_index.root_scope_id
  );
  if (!root_scope) return null;

  const scope = find_containing_scope(
    location,
    root_scope,
    context.current_index.scopes
  );
  return scope.id;
}

/**
 * Find containing function scope
 */
function find_function_scope(
  scope_id: ScopeId,
  context: EnhancedMethodResolutionContext
): ScopeId | null {
  let current_scope_id: ScopeId | null = scope_id;

  while (current_scope_id) {
    const scope = context.current_index.scopes.get(current_scope_id);
    if (!scope) return null;

    if (
      scope.type === "function" ||
      scope.type === "method" ||
      scope.type === "constructor"
    ) {
      return current_scope_id;
    }

    current_scope_id = scope.parent_id || null;
  }

  return null;
}

/**
 * Extract variable name from object expression
 */
function extract_variable_name(object: any): SymbolName | null {
  if (object.name) {
    return object.name as SymbolName;
  }
  if (object.type === "identifier" && object.text) {
    return object.text as SymbolName;
  }
  return null;
}

/**
 * Extract type name from annotation text
 */
function extract_type_name(annotation_text: string): SymbolName | null {
  const match = annotation_text.match(/^(\w+)/);
  return match ? (match[1] as SymbolName) : null;
}

/**
 * Resolve type name to SymbolId
 */
function resolve_type_name(
  type_name: SymbolName,
  context: EnhancedMethodResolutionContext
): SymbolId | null {
  // Check imports
  const imported = context.imports.get(type_name);
  if (imported) return imported;

  // Check local classes
  if (context.current_index.classes) {
    for (const [id, class_def] of context.current_index.classes) {
      if (class_def.name === type_name) {
        return id;
      }
    }
  }

  // Check interfaces
  if (context.current_index.interfaces) {
    for (const [id, interface_def] of context.current_index.interfaces) {
      if (interface_def.name === type_name) {
        return id;
      }
    }
  }

  // Check local type info
  for (const type_info of context.local_types) {
    if (type_info.type_name === type_name) {
      // LocalTypeInfo doesn't have symbol_id - need to look it up from the index
      // For now, return null and rely on other resolution methods
      return null;
    }
  }

  return null;
}

/**
 * Find sibling method calls on same receiver
 */
function find_sibling_method_names(
  member_access: MemberAccessReference,
  context: EnhancedMethodResolutionContext
): Set<SymbolName> {
  const siblings = new Set<SymbolName>();

  if (!member_access.object?.location) return siblings;
  if (!context.current_index.references?.member_accesses) return siblings;

  for (const other of context.current_index.references.member_accesses) {
    if (other === member_access) continue;
    if (!other.object?.location) continue;
    if (other.access_type !== "method") continue;

    // Simple check - same receiver variable name
    const this_var = extract_variable_name(member_access.object);
    const other_var = extract_variable_name(other.object);

    if (this_var && other_var && this_var === other_var) {
      siblings.add(other.member_name);
    }
  }

  return siblings;
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
