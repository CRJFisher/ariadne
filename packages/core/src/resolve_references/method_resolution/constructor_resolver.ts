/**
 * Enhanced constructor resolution
 *
 * Handles complex constructor scenarios including super calls,
 * delegation, and inheritance
 */

import type {
  Location,
  SymbolId,
  SymbolName,
  TypeId,
  FilePath,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type { CallReference } from "@ariadnejs/types/src/call_chains";
import type { LocalConstructorCall } from "../../index_single_file/references/type_flow_references/type_flow_references";
import type { MethodCallResolution, MethodLookupContext } from "./method_types";
import { get_type_methods } from "./type_lookup";
import { build_inheritance_chain } from "./inheritance_resolver";

/**
 * Resolve all constructor calls with enhanced support
 */
export function resolve_constructor_calls_enhanced(
  index: SemanticIndex,
  context: MethodLookupContext
): MethodCallResolution[] {
  const resolutions: MethodCallResolution[] = [];

  // Process different types of constructor calls
  resolutions.push(...resolve_new_expressions(index, context));
  resolutions.push(...resolve_super_constructor_calls(index, context));
  resolutions.push(...resolve_delegated_constructors(index, context));

  return resolutions;
}

/**
 * Resolve new expressions (new Class())
 */
function resolve_new_expressions(
  index: SemanticIndex,
  context: MethodLookupContext
): MethodCallResolution[] {
  const resolutions: MethodCallResolution[] = [];

  if (index.local_type_flow?.constructor_calls) {
    for (const ctor_call of index.local_type_flow.constructor_calls) {
      const resolution = resolve_constructor_with_inheritance(
        ctor_call,
        context
      );
      if (resolution) {
        resolutions.push(resolution);
      }
    }
  }

  return resolutions;
}

/**
 * Resolve a constructor call with inheritance support
 */
export function resolve_constructor_with_inheritance(
  ctor_call: LocalConstructorCall,
  context: MethodLookupContext
): MethodCallResolution | null {
  // Find the type being constructed
  const type_name_map = context.current_index.file_symbols_by_name.get(
    context.current_file
  );
  if (!type_name_map) {
    return null;
  }

  const type_symbol = type_name_map.get(ctor_call.class_name);
  if (!type_symbol) {
    return null;
  }

  // Get the type ID for this symbol
  const constructed_type =
    context.type_resolution.symbol_types.get(type_symbol);
  if (!constructed_type) {
    return null;
  }

  // 1. Look for explicit constructor
  const explicit_constructor = find_explicit_constructor(
    constructed_type,
    context
  );
  if (explicit_constructor) {
    return create_constructor_resolution(
      explicit_constructor,
      ctor_call,
      constructed_type
    );
  }

  // 2. Look for default constructor
  const default_constructor = find_default_constructor(
    constructed_type,
    context
  );
  if (default_constructor) {
    return create_constructor_resolution(
      default_constructor,
      ctor_call,
      constructed_type
    );
  }

  // 3. Look for inherited constructors
  const inherited_constructor = find_inherited_constructor(
    constructed_type,
    context
  );
  if (inherited_constructor) {
    return create_constructor_resolution(
      inherited_constructor,
      ctor_call,
      constructed_type,
      "inherited"
    );
  }

  return null;
}

/**
 * Find an explicit constructor for a type
 */
function find_explicit_constructor(
  type_id: TypeId,
  context: MethodLookupContext
): SymbolId | null {
  // First check the constructors map
  const constructor = context.type_resolution.constructors.get(type_id);
  if (constructor) {
    return constructor;
  }

  // Check type methods for constructor
  const type_methods = get_type_methods(type_id, context);
  if (!type_methods) return null;

  // Look for constructor by common names
  const constructor_names = [
    "constructor",
    "__init__",
    "new",
    "__new__",
  ] as SymbolName[];

  for (const name of constructor_names) {
    const ctor = type_methods.constructors.get(name);
    if (ctor) return ctor;
  }

  return null;
}

/**
 * Find a default constructor for a type
 */
export function find_default_constructor(
  type_id: TypeId,
  context: MethodLookupContext
): SymbolId | null {
  // First check the constructors map
  const constructor = context.type_resolution.constructors.get(type_id);
  if (constructor) {
    return constructor;
  }

  const type_methods = get_type_methods(type_id, context);
  if (!type_methods) return null;

  // Try common constructor names
  const constructor_names = [
    "constructor",
    "new",
    "__init__",
    "__new__",
  ] as SymbolName[];

  for (const name of constructor_names) {
    const constructor = type_methods.constructors.get(name);
    if (constructor) return constructor;
  }

  return null;
}

/**
 * Find an inherited constructor
 */
function find_inherited_constructor(
  type_id: TypeId,
  context: MethodLookupContext
): SymbolId | null {
  const inheritance_chain = build_inheritance_chain(type_id, context);

  for (const ancestor_type of inheritance_chain) {
    // Check explicit constructor first
    const explicit_ctor = find_explicit_constructor(ancestor_type, context);
    if (explicit_ctor) return explicit_ctor;

    // Then check default constructor
    const default_ctor = find_default_constructor(ancestor_type, context);
    if (default_ctor) return default_ctor;
  }

  return null;
}

/**
 * Resolve super() calls in constructors
 */
function resolve_super_constructor_calls(
  index: SemanticIndex,
  context: MethodLookupContext
): MethodCallResolution[] {
  const resolutions: MethodCallResolution[] = [];

  // Look for super calls in the references
  if (index.references.calls) {
    for (const call_ref of index.references.calls) {
      if (is_super_constructor_call(call_ref)) {
        const resolution = resolve_super_call(call_ref, context);
        if (resolution) {
          resolutions.push(resolution);
        }
      }
    }
  }

  return resolutions;
}

/**
 * Check if a call is a super constructor call
 */
function is_super_constructor_call(call_ref: CallReference): boolean {
  // Check if the name is "super" or the call_type is "super"
  return (
    call_ref.name === ("super" as SymbolName) || call_ref.call_type === "super"
  );
}

/**
 * Resolve a super() call
 */
function resolve_super_call(
  call_ref: CallReference,
  context: MethodLookupContext
): MethodCallResolution | null {
  // Find the containing class type
  const containing_class = find_containing_class_type(
    call_ref.location,
    context
  );
  if (!containing_class) return null;

  // Get parent classes from inheritance hierarchy
  const parent_classes =
    context.type_resolution.inheritance_hierarchy.get(containing_class) || [];
  if (parent_classes.length === 0) return null;

  // Find constructor in first parent class
  const parent_constructor =
    find_explicit_constructor(parent_classes[0], context) ||
    find_default_constructor(parent_classes[0], context);

  if (parent_constructor) {
    return {
      call_location: call_ref.location,
      resolved_method: parent_constructor,
      receiver_type: parent_classes[0],
      method_kind: "constructor",
      resolution_path: "inherited",
    };
  }

  return null;
}

/**
 * Find the type of the class containing a location
 */
function find_containing_class_type(
  location: Location,
  context: MethodLookupContext
): TypeId | null {
  // Look through all symbols to find the containing class
  for (const [symbol_id, symbol_def] of context.current_index.symbols) {
    if (
      symbol_def.kind === "class" &&
      location_is_within(location, symbol_def.location)
    ) {
      // Get the type for this class symbol
      return context.type_resolution.symbol_types.get(symbol_id) || null;
    }
  }
  return null;
}

/**
 * Check if a location is within another location
 */
function location_is_within(inner: Location, outer: Location): boolean {
  return (
    inner.file_path === outer.file_path &&
    inner.start_line >= outer.start_line &&
    inner.end_line <= outer.end_line
  );
}

/**
 * Resolve delegated constructors (this() calls)
 */
function resolve_delegated_constructors(
  index: SemanticIndex,
  context: MethodLookupContext
): MethodCallResolution[] {
  const resolutions: MethodCallResolution[] = [];

  // Look for this() calls in constructors
  if (index.references.calls) {
    for (const call_ref of index.references.calls) {
      if (is_delegated_constructor_call(call_ref)) {
        const resolution = resolve_delegated_call(call_ref, context);
        if (resolution) {
          resolutions.push(resolution);
        }
      }
    }
  }

  return resolutions;
}

/**
 * Check if a call is a delegated constructor call
 */
function is_delegated_constructor_call(call_ref: CallReference): boolean {
  // Check if the name is "this" (for languages that support it)
  return call_ref.name === ("this" as SymbolName);
}

/**
 * Resolve a this() constructor delegation
 */
function resolve_delegated_call(
  call_ref: CallReference,
  context: MethodLookupContext
): MethodCallResolution | null {
  // Find the containing class type
  const containing_class = find_containing_class_type(
    call_ref.location,
    context
  );
  if (!containing_class) return null;

  // Find another constructor in the same class
  const constructor = find_explicit_constructor(containing_class, context);
  if (constructor) {
    return {
      call_location: call_ref.location,
      resolved_method: constructor,
      receiver_type: containing_class,
      method_kind: "constructor",
      resolution_path: "direct",
    };
  }

  return null;
}

/**
 * Create a constructor resolution result
 */
function create_constructor_resolution(
  constructor_symbol: SymbolId,
  ctor_call: LocalConstructorCall,
  constructed_type: TypeId,
  resolution_path: "direct" | "inherited" = "direct"
): MethodCallResolution {
  return {
    call_location: ctor_call.location,
    resolved_method: constructor_symbol,
    receiver_type: constructed_type,
    method_kind: "constructor",
    resolution_path,
  };
}
