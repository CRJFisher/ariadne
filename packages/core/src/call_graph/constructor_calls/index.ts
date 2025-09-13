/**
 * Constructor call detection
 *
 * Configuration-driven dispatcher with bespoke language enhancements
 */

import { CallInfo } from '@ariadnejs/types';
import {
  ConstructorCallContext,
  process_constructor_calls_generic,
  walk_tree
} from './constructor_calls';
import { node_to_location } from '../../ast/node_utils';

// Import bespoke handlers
import { 
  handle_object_create_pattern,
  detect_advanced_factory_pattern
} from './constructor_calls.javascript';
import {
  handle_generic_constructor
} from './constructor_calls.typescript';
import {
  handle_super_init_call,
  detect_classmethod_factory
} from './constructor_calls.python';
import {
  handle_enum_variant_construction,
  handle_tuple_struct_construction,
  handle_macro_construction,
  handle_smart_pointer_construction,
  handle_default_construction
} from './constructor_calls.rust';

// Export type validation functions for Global Assembly phase
export {
  enrich_constructor_calls_with_types,
  validate_constructor,
  batch_validate_constructors,
  get_constructable_types,
} from './constructor_type_resolver';

// Export bidirectional flow functions
export {
  extract_constructor_calls_and_types,
  merge_constructor_types,
  ConstructorCallResult,
  ConstructorTypeAssignment
} from './constructor_type_extraction';

/**
 * Find all constructor calls in code (Per-File Phase - Layer 4)
 *
 * Uses configuration-driven generic processing combined with
 * language-specific bespoke handlers for unique features.
 *
 * NOTE: This is a per-file analysis function. It identifies constructor call syntax
 * but cannot validate if the constructor actually exists in the codebase.
 * Full validation happens in the global phase with the type registry.
 *
 * @param context The context containing source code, AST, and metadata
 * @returns Array of constructor call information (unvalidated)
 */
export function find_constructor_calls(
  context: ConstructorCallContext
): CallInfo[] {
  // TODO: Implement using new query-based system
  // See task 11.100.6 for implementation details
  return [];
}



