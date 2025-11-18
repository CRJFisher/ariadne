/**
 * Call Resolution Module
 *
 * Provides eager resolution of function, method, and constructor calls.
 * These are now used internally by ResolutionRegistry.
 */

export { resolve_method_call } from "./method_resolver";
export { resolve_constructor_call } from "./constructor_resolver";
