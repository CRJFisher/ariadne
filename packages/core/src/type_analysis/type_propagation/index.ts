/**
 * Type propagation module - Public API
 *
 * This module provides type flow analysis through assignments, function calls,
 * and control flow narrowing.
 *
 * ONLY exports the function used by code_graph.ts.
 */

export {
  propagate_types_across_files,
} from './type_propagation';
