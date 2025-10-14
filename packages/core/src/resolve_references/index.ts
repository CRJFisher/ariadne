/**
 * Symbol Resolution - DEPRECATED MODULE
 *
 * This module contains the OLD lazy resolution system that has been replaced
 * by eager resolution in ResolutionRegistry (packages/core/src/project/resolution_registry.ts).
 *
 * MIGRATION GUIDE:
 * - Old: resolve_symbols(file_references, definitions, types, scopes, exports, imports, root_folder)
 * - New: Use Project class which calls ResolutionRegistry.resolve_calls() internally
 *
 * The new eager resolution system:
 * 1. Resolves ALL symbols immediately when files are updated (via ResolutionRegistry.resolve_files())
 * 2. Stores direct mappings: Scope → (Name → SymbolId) in memory
 * 3. Provides O(1) lookups via ResolutionRegistry.resolve(scope_id, name)
 * 4. No closures, no caches - just direct Map lookups
 *
 * This module is kept for backward compatibility with existing tests only.
 * It will be removed in a future version.
 */

// DEPRECATED: Use Project class and ResolutionRegistry instead
// export { resolve_symbols } from "./symbol_resolution";

// DEPRECATED: These types are no longer used by the eager resolution system
// export type { ScopeResolverIndex } from "./scope_resolver_index/scope_resolver_index";
// export type { ResolutionCache } from "./resolution_cache/resolution_cache";
// export type { TypeContext } from "./type_resolution/type_context";
// export type { FunctionCallMap } from "./call_resolution/function_resolver";
// export type { MethodCallMap } from "./call_resolution/method_resolver";
// export type { ConstructorCallMap } from "./call_resolution/constructor_resolver";
