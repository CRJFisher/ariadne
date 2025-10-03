/**
 * Symbol Resolution - On-demand scope-aware symbol resolution
 *
 * Main entry point for resolving all symbol references across a codebase.
 *
 * Five-phase pipeline:
 * 1. Build scope resolver index (lightweight resolver functions)
 * 2. Create resolution cache (shared cache for all resolutions)
 * 3. Build type context (type tracking and member lookup)
 * 4. Resolve all call types (function, method, constructor calls)
 * 5. Combine results (merge all resolutions into final output)
 */

export { resolve_symbols } from "./symbol_resolution";

// Export types for external use
export type { ScopeResolverIndex } from "./scope_resolver_index/scope_resolver_index";
export type { ResolutionCache } from "./resolution_cache/resolution_cache";
export type { TypeContext } from "./type_resolution/type_context";
export type { FunctionCallMap } from "./call_resolution/function_resolver";
export type { MethodCallMap } from "./call_resolution/method_resolver";
export type { ConstructorCallMap } from "./call_resolution/constructor_resolver";
