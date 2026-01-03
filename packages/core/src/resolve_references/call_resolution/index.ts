/**
 * Call Resolution Module
 *
 * Provides eager resolution of function, method, and constructor calls.
 * These are now used internally by ResolutionRegistry.
 */

export { resolve_method_call } from "./call_resolution.method";
export { resolve_constructor_call } from "./call_resolution.constructor";
export { resolve_collection_arguments } from "./call_resolution.collection_argument";
