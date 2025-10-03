/**
 * Call Resolution Module
 *
 * Provides on-demand resolution of function, method, and constructor calls
 * using scope-aware lookup with caching.
 */

export { resolve_function_calls, type FunctionCallMap } from "./function_resolver";
export { resolve_method_calls, type MethodCallMap } from "./method_resolver";
