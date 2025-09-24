/**
 * Rust Types Module
 *
 * Consolidated exports for Rust-specific type resolution
 */

export {
  resolve_rust_reference_types
} from "./reference_types";

export {
  resolve_rust_function_types,
  resolve_closure_types,
  resolve_higher_order_function_calls
} from "./function_types";

export {
  resolve_rust_async_types,
  extract_future_output_type,
  get_future_trait_methods,
  get_rust_reference_methods
} from "./async_types";

export {
  resolve_pattern_matching,
  resolve_pattern_conditional_calls,
  integrate_pattern_matching_into_type_resolution
} from "./pattern_matching";

export {
  resolve_ownership_operations
} from "./ownership_ops";

export {
  resolve_const_generics,
  resolve_associated_types,
  resolve_unsafe_contexts,
  resolve_loop_constructs
} from "./advanced_types";

export {
  resolve_all_rust_types
} from "./rust_type_resolver";

export type {
  RustTypeInfo,
  RustReferenceType,
  RustLifetime,
  RustTraitBound,
  RustGenericParam
} from "./rust_type_utils";