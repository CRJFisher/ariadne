/**
 * Method resolution module - Public API
 *
 * Provides type-based method and constructor call resolution with inheritance support
 */

export { resolve_method_calls } from "./method_resolver";
export type {
  MethodCallResolution,
  MethodResolutionMap,
  MethodLookupContext,
  TypeMethodMap,
} from "./method_types";
export { resolve_method_on_type, get_type_methods, find_symbol_definition } from "./type_lookup";
export { determine_if_static_call, get_method_kind } from "./static_resolution";

// Inheritance resolution
export {
  resolve_method_with_inheritance,
  build_inheritance_chain
} from "./inheritance_resolver";

// Interface resolution
export {
  lookup_interface_method,
  get_implemented_interfaces,
  find_method_implementation,
  is_method_implementation,
  find_interface_implementations,
  type_implements_interface
} from "./interface_resolver";

// Constructor resolution
export {
  resolve_constructor_calls_enhanced,
  resolve_constructor_with_inheritance,
  find_default_constructor
} from "./constructor_resolver";

// Polymorphism handling
export {
  resolve_polymorphic_method_call,
  find_all_method_implementations,
  choose_most_specific_method,
  is_method_override,
  find_method_overrides,
  determine_dispatch_type,
  type CallContext
} from "./polymorphism_handler";

// Rust ownership semantics
export {
  resolve_ownership_receiver_type,
  should_use_ownership_semantics,
  get_smart_pointer_methods
} from "./ownership_resolver";