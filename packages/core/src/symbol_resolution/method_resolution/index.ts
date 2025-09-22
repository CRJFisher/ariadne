/**
 * Method resolution module - Public API
 *
 * Provides type-based method and constructor call resolution
 */

export { resolve_method_calls } from "./method_resolver";
export type {
  MethodCallResolution,
  MethodResolutionMap,
  MethodLookupContext,
  TypeMethodMap,
} from "./method_types";
export { resolve_method_on_type, get_type_methods } from "./type_lookup";
export { determine_if_static_call, get_method_kind } from "./static_resolution";