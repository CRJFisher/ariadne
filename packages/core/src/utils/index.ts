/**
 * Utility functions for Ariadne Core
 */

// Symbol construction utilities (TODO: implement when needed)

// Scope path utilities
export {
  build_scope_path,
  build_full_scope_path,
  get_parent_scope_name,
  find_containing_class,
  find_containing_function,
  is_scope_nested_in,
  get_scope_depth,
  format_scope_path
} from './scope_path_builder';