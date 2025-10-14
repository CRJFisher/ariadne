/**
 * @deprecated THIS MODULE IS DEPRECATED
 *
 * Symbol Resolution - LEGACY lazy resolution system
 *
 * This module implements the OLD multi-phase lazy resolution system that has been
 * REPLACED by eager resolution in ResolutionRegistry.
 *
 * ## Why Deprecated?
 *
 * The lazy resolution approach (closures + cache) has been replaced by a simpler
 * eager resolution approach that:
 * - Resolves ALL symbols immediately when files update
 * - Stores flat Map<ScopeId, Map<SymbolName, SymbolId>> - no closures
 * - Provides O(1) direct lookups - no cache needed
 * - Matches the pattern of other registries (DefinitionRegistry, etc.)
 *
 * ## Migration Guide
 *
 * **Old Way (this file):**
 * ```typescript
 * const resolved = resolve_symbols(file_references, definitions, types, scopes, exports, imports, root);
 * ```
 *
 * **New Way (ResolutionRegistry):**
 * ```typescript
 * // In Project class (already migrated):
 * resolutions.resolve_files(changed_files, semantic_indexes, definitions, types, scopes, exports, imports, root);
 * const resolved_calls = resolutions.resolve_calls(file_references, scopes, types, definitions);
 * ```
 *
 * ## Legacy Architecture (for reference only)
 *
 * This OLD system used a 5-phase pipeline:
 *
 * 1. **Build scope resolver index** - Creates lightweight resolver functions per scope
 * 2. **Create resolution cache** - Shared cache for all resolvers
 * 3. **Build type context** - Tracks variable types using resolver index
 * 4. **Resolve all calls** - Functions, methods, constructors (on-demand with caching)
 * 5. **Combine results** - Unified output with resolved references
 *
 * The new system does this in 2 steps:
 * 1. **Eager resolution** - Resolve all symbols immediately on file update
 * 2. **O(1) lookups** - Direct Map access, no closures or cache
 *
 * This file is kept only for backward compatibility with old tests.
 * It will be removed in a future version.
 */

import {
  type Location,
  type SymbolId,
  type FilePath,
  type LocationKey,
  parse_location_key,
  AnyDefinition,
  ResolvedSymbols,
  CallReference,
  SymbolReference,
} from "@ariadnejs/types";
import { SemanticIndex } from "../index_single_file/semantic_index";
import type { FileSystemFolder } from "./types";
import { DefinitionRegistry } from "../project/definition_registry";
import { TypeRegistry } from "../project/type_registry";
import { ScopeRegistry } from "../project/scope_registry";
import { ExportRegistry } from "../project/export_registry";
import { ImportGraph } from "../project/import_graph";

// Legacy imports removed - this module is deprecated

/**
 * Resolve all symbol references using on-demand scope-aware lookup
 *
 * This is the main entry point for the symbol resolution system. It takes semantic
 * indices from all files and resolves all function, method, and constructor calls
 * to their definitions.
 *
 * ## How It Works
 *
 * The resolution process happens in five phases:
 *
 * **Phase 1: Build Scope Resolver Index**
 * Creates a lightweight resolver function for each symbol in each scope. These
 * resolvers are closures that capture context but don't execute until called.
 * This phase is fast because we're only creating closures, not resolving symbols.
 *
 * **Phase 2: Create Resolution Cache**
 * Initializes an empty cache shared by all resolvers. As symbols are resolved,
 * results are stored here for O(1) future lookups.
 *
 * **Phase 3: Build Type Context**
 * Analyzes variable types and class members using the resolver index. Type names
 * are resolved on-demand using the same resolver functions, ensuring consistency.
 *
 * **Phase 4: Resolve All Calls (on-demand)**
 * Processes all function, method, and constructor calls. Each call triggers:
 * - Cache check (O(1) if previously resolved)
 * - Resolver execution (only if cache miss)
 * - Cache storage (for future lookups)
 *
 * **Phase 5: Combine Results**
 * Merges all resolutions into a unified output with forward and reverse maps.
 *
 * ## Performance Characteristics
 *
 * - **On-demand resolution**: Only ~10% of symbols are actually resolved (those referenced)
 * - **Cache hit rate**: Typically 80%+ for repeated references
 * - **Resolver overhead**: ~100 bytes per resolver (lightweight closures)
 * - **Overall speedup**: ~90% reduction in wasted work vs pre-computation
 *
 * @param indices - Map of file_path → SemanticIndex for all files in the codebase.
 *                  Each index must contain complete scope trees with definitions and references.
 * @param definitions - Project-level registry of all definitions (from Project coordination layer).
 * @param types - Project-level registry of type information (from Project coordination layer).
 * @param scopes - Project-level registry of scope trees (from Project coordination layer).
 * @param exports - Project-level registry of exported symbols (from Project coordination layer).
 * @param imports - Project-level import dependency graph (from Project coordination layer).
 * @param root_folder - Root of the file system tree used for import resolution.
 *                      This enables resolution to work with in-memory test data without filesystem I/O.
 *
 * @returns ResolvedSymbols containing:
 *          - `resolved_references`: Map of reference location → resolved symbol_id
 *          - `references_to_symbol`: Reverse map of symbol_id → all reference locations
 *          - `references`: All call references (function, method, constructor)
 *          - `definitions`: All callable definitions (functions, classes, methods, constructors)
 *
 * @example
 * ```typescript
 * import { build_semantic_index } from './index_single_file';
 * import { resolve_symbols, build_file_tree } from './resolve_references';
 *
 * // Build indices for all files
 * const indices = new Map();
 * const file_paths = [];
 * for (const file of files) {
 *   const index = build_semantic_index(file.path, file.content, file.language);
 *   indices.set(file.path, index);
 *   file_paths.push(file.path);
 * }
 *
 * // Build file tree from file paths
 * const root_folder = build_file_tree(file_paths);
 *
 * // Resolve all symbols
 * const resolved = resolve_symbols(indices, root_folder);
 *
 * // Look up where a function is called
 * const call_location = "src/app.ts:10:5";
 * const target_symbol = resolved.resolved_references.get(call_location);
 * // → "fn:src/utils.ts:processData:5:0"
 * ```
 *
 * @see {@link ScopeResolverIndex} for resolver function architecture
 * @see {@link ResolutionCache} for caching strategy
 * @see {@link TypeRegistry} for type tracking
 */
export function resolve_symbols(
  _file_references: Map<FilePath, readonly SymbolReference[]>,
  _definitions: DefinitionRegistry,
  _types: TypeRegistry,
  _scopes: ScopeRegistry,
  _exports: ExportRegistry,
  _imports: ImportGraph,
  _root_folder: FileSystemFolder,
): CallReference[] {
  // @deprecated - This function is stubbed out as it's deprecated.
  // Use ResolutionRegistry.resolve_calls() instead via the Project class.
  console.warn("resolve_symbols() is deprecated. Use Project class with ResolutionRegistry instead.");
  return [];
}
