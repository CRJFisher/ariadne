/**
 * Scope Resolver Index - On-demand scope-aware symbol lookup
 *
 * This module builds a lightweight resolver function for each symbol in each scope.
 * Resolvers are closures that capture just enough context to resolve a symbol when called.
 *
 * ## Key Concepts
 *
 * ### Resolver Functions
 * A resolver is a tiny closure (~100 bytes) that captures the information needed to
 * resolve one symbol. For example:
 * - Local definition resolver: `() => "fn:src/app.ts:foo:10:0"`
 * - Import resolver: `() => resolve_export_chain("utils.ts", "bar", indices)`
 *
 * ### Scope-Aware Lookup
 * Each scope has its own map of symbol name → resolver. Child scopes inherit parent
 * resolvers but can override them (shadowing). This implements lexical scope resolution.
 *
 * ### Shadowing Mechanism
 * When building resolvers for a scope, we layer them in this order:
 * 1. Inherit all parent resolvers (cheap map copy)
 * 2. Add import resolvers (can shadow parent)
 * 3. Add local definition resolvers (can shadow imports and parent)
 *
 * This ensures local definitions always win, followed by imports, then parent scope.
 *
 * ### On-Demand Execution
 * Resolvers are created during index building but only executed when a symbol is
 * actually referenced. This provides ~90% reduction in wasted work.
 */

import type { FilePath, SymbolId, SymbolName, ScopeId } from "@ariadnejs/types";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type { SymbolResolver } from "../types";
import {
  extract_import_specs,
  resolve_export_chain,
} from "../import_resolution/import_resolver";

/**
 * Resolution Cache Interface
 *
 * Caches the results of resolver execution to avoid redundant work.
 * All resolvers share the same cache for consistency and performance.
 *
 * Cache key is (scope_id, name) → symbol_id
 * This ensures the same symbol name in different scopes can have different resolutions.
 */
export interface ResolutionCache {
  /** Get cached resolution, returns undefined if not cached */
  get(scope_id: ScopeId, name: SymbolName): SymbolId | undefined;

  /** Store a resolved symbol_id in the cache */
  set(scope_id: ScopeId, name: SymbolName, symbol_id: SymbolId): void;
}

/**
 * Scope Resolver Index Interface
 *
 * Provides on-demand scope-aware symbol resolution with caching.
 * This is the main interface used by all call resolvers.
 */
export interface ScopeResolverIndex {
  /**
   * Resolve a symbol name in a scope using on-demand lookup
   *
   * Resolution process:
   * 1. Check cache for (scope_id, name) → returns immediately if cached
   * 2. Look up resolver function for this name in this scope
   * 3. Execute resolver (may trigger cross-file import resolution)
   * 4. Store result in cache for future lookups
   * 5. Return resolved symbol_id or null if not found
   *
   * @param scope_id - Scope where the symbol is referenced
   * @param name - Symbol name to resolve
   * @param cache - Shared resolution cache
   * @returns Resolved symbol_id or null if symbol not found in scope
   *
   * @example
   * ```typescript
   * // Resolve function call "foo()" in scope "scope:src/app.ts:main"
   * const symbol_id = resolver_index.resolve(
   *   "scope:src/app.ts:main",
   *   "foo",
   *   cache
   * );
   * // → "fn:src/utils.ts:foo:10:0" (if foo is imported from utils.ts)
   * // → "fn:src/app.ts:foo:5:0" (if foo is defined locally)
   * // → null (if foo is not defined or imported)
   * ```
   */
  resolve(
    scope_id: ScopeId,
    name: SymbolName,
    cache: ResolutionCache
  ): SymbolId | null;
}

/**
 * Build resolver index for all scopes across all files
 *
 * Creates a lightweight resolver function for every symbol in every scope.
 * Resolvers are organized hierarchically to implement shadowing.
 *
 * Process:
 * 1. For each file, build resolvers recursively from root scope
 * 2. Each scope inherits parent resolvers and adds its own
 * 3. Child resolvers override parent resolvers (shadowing)
 * 4. Final index maps scope_id → (name → resolver)
 *
 * @param indices - All semantic indices for the codebase
 * @returns ScopeResolverIndex with on-demand resolution capability
 */
export function build_scope_resolver_index(
  indices: ReadonlyMap<FilePath, SemanticIndex>
): ScopeResolverIndex {
  const scope_resolvers = new Map<ScopeId, Map<SymbolName, SymbolResolver>>();

  // Process each file's scope tree
  for (const [file_path, index] of indices) {
    const file_resolvers = build_resolvers_recursive(
      index.root_scope_id,
      new Map(), // Empty parent resolvers at root
      index,
      file_path,
      indices
    );

    // Merge file's resolvers into main map
    for (const [scope_id, resolvers] of file_resolvers) {
      scope_resolvers.set(scope_id, resolvers);
    }
  }

  return create_resolver_index(scope_resolvers);
}

/**
 * Recursively build resolvers for a scope and its children
 *
 * This is the core algorithm that implements shadowing and scope inheritance.
 * Resolvers are layered in priority order: local > imports > parent
 *
 * Shadowing Example:
 * ```typescript
 * import { foo } from './utils';  // Import resolver for "foo"
 * function bar() {
 *   const foo = 5;                // Local resolver SHADOWS import
 *   foo();                        // Resolves to local const, not import
 * }
 * ```
 *
 * @param scope_id - Current scope being processed
 * @param parent_resolvers - Resolvers inherited from parent scope
 * @param index - SemanticIndex for the current file
 * @param file_path - Path to current file
 * @param indices - All indices (needed for import resolution)
 * @returns Map of scope_id → resolver map for this scope and all children
 */
function build_resolvers_recursive(
  scope_id: ScopeId,
  parent_resolvers: ReadonlyMap<SymbolName, SymbolResolver>,
  index: SemanticIndex,
  file_path: FilePath,
  indices: ReadonlyMap<FilePath, SemanticIndex>
): ReadonlyMap<ScopeId, Map<SymbolName, SymbolResolver>> {
  const result = new Map<ScopeId, Map<SymbolName, SymbolResolver>>();
  const resolvers = new Map<SymbolName, SymbolResolver>();

  const scope = index.scopes.get(scope_id)!;

  // Step 1: Inherit parent resolvers (copy map references - very cheap!)
  // This gives us access to all symbols from outer scopes
  for (const [name, resolver] of parent_resolvers) {
    resolvers.set(name, resolver);
  }

  // Step 2: Add import resolvers for this scope (can shadow parent!)
  // Import statements can appear at any scope level (file, block, etc.)
  const import_specs = extract_import_specs(scope_id, index, file_path);

  for (const spec of import_specs) {
    // Create resolver closure that captures import specification
    // The closure will execute lazily when this symbol is actually referenced
    // This allows cross-file resolution to happen on-demand only
    //
    // Example: import { foo } from './utils'
    //   → resolvers.set("foo", () => resolve_export_chain("./utils.ts", "foo", indices, "named"))
    //
    // Example: import bar from './utils'
    //   → resolvers.set("bar", () => resolve_export_chain("./utils.ts", "bar", indices, "default"))
    //   Note: For defaults, import_name="bar" is ignored; resolve_export_chain uses import_kind to find is_default=true
    //
    // Example: import * as utils from './utils'
    //   → resolvers.set("utils", () => "import:src/app.ts:utils:5:0")
    //   For namespace imports, we return the import's own symbol_id instead of resolving
    //   Member access like utils.helper() is handled separately by namespace member resolution
    //
    // Since we're using Map.set(), this will OVERRIDE any parent resolver for the same name
    // This implements shadowing: imports in inner scopes shadow parent scope symbols
    if (spec.import_kind === "namespace") {
      // Namespace imports: return the import's own symbol_id
      // Member resolution (utils.helper) is handled by TypeContext.get_namespace_member
      resolvers.set(spec.local_name, () => spec.symbol_id);
    } else {
      // Named/default imports: follow export chain
      resolvers.set(spec.local_name, () =>
        resolve_export_chain(spec.source_file, spec.import_name, indices, spec.import_kind)
      );
    }
  }

  // Step 3: Add local definition resolvers (OVERRIDES everything!)
  // Local definitions have highest priority and shadow both imports and parent symbols
  const local_defs = find_local_definitions(scope_id, index);

  for (const [name, symbol_id] of local_defs) {
    // Create resolver closure that captures the local symbol_id
    // This is the simplest resolver - just returns the captured id
    //
    // Example: const foo = 5;
    //   → resolvers.set("foo", () => "var:src/app.ts:foo:10:0")
    //
    // Since we're using Map.set() AFTER imports, this will OVERRIDE any import or parent
    // This naturally implements shadowing priority: local > imports > parent
    resolvers.set(name, () => symbol_id);
  }

  // Store this scope's resolvers in result
  result.set(scope_id, resolvers);

  // Step 4: Recurse to children with OUR resolvers as parent
  for (const child_id of scope.child_ids) {
    const child = index.scopes.get(child_id);
    if (child) {
      const child_resolvers = build_resolvers_recursive(
        child_id,
        resolvers, // Pass our resolvers down to children
        index,
        file_path,
        indices
      );

      // Merge child results into our result
      for (const [child_scope_id, child_scope_resolvers] of child_resolvers) {
        result.set(child_scope_id, child_scope_resolvers);
      }
    }
  }

  return result;
}

/**
 * Find all definitions declared directly in a scope
 *
 * Collects all symbols defined at this scope level (not in child scopes).
 * These will be used to create local definition resolvers that shadow
 * imports and parent scope symbols.
 *
 * TODO: could make this more efficient by adding a scope-id->symbols map to the index
 *
 * @param scope_id - Scope to search for definitions
 * @param index - SemanticIndex containing all definitions
 * @returns Map of symbol name → symbol_id for all local definitions
 */
function find_local_definitions(
  scope_id: ScopeId,
  index: SemanticIndex
): ReadonlyMap<SymbolName, SymbolId> {
  const defs = new Map<SymbolName, SymbolId>();

  // Functions
  for (const [func_id, func_def] of index.functions) {
    if (func_def.defining_scope_id === scope_id) {
      defs.set(func_def.name, func_id);
    }
  }

  // Variables
  for (const [var_id, var_def] of index.variables) {
    if (var_def.defining_scope_id === scope_id) {
      defs.set(var_def.name, var_id);
    }
  }

  // Classes
  for (const [class_id, class_def] of index.classes) {
    if (class_def.defining_scope_id === scope_id) {
      defs.set(class_def.name, class_id);
    }
  }

  // Interfaces
  for (const [iface_id, iface_def] of index.interfaces) {
    if (iface_def.defining_scope_id === scope_id) {
      defs.set(iface_def.name, iface_id);
    }
  }

  return defs;
}

/**
 * Create ScopeResolverIndex implementation
 *
 * Wraps the scope_resolvers map with on-demand resolution and caching.
 * This is where the cache-check → resolver-execution → cache-store pattern is implemented.
 *
 * @param scope_resolvers - Map of scope_id → (name → resolver) built recursively
 * @returns ScopeResolverIndex that performs on-demand cached resolution
 */
function create_resolver_index(
  scope_resolvers: ReadonlyMap<ScopeId, Map<SymbolName, SymbolResolver>>
): ScopeResolverIndex {
  return {
    resolve(
      scope_id: ScopeId,
      name: SymbolName,
      cache: ResolutionCache
    ): SymbolId | null {
      // STEP 1: Check cache first - O(1) lookup
      // If this (scope_id, name) has been resolved before, return immediately
      // This provides massive speedup for repeated references (~80% cache hit rate)
      const cached = cache.get(scope_id, name);
      if (cached !== undefined) {
        return cached;
      }

      // STEP 2: Get resolver function for this scope
      // Lookup the resolver map for this specific scope
      const resolvers = scope_resolvers.get(scope_id);
      if (!resolvers) {
        return null; // Scope doesn't exist (shouldn't happen in valid indices)
      }

      // STEP 3: Get resolver function for this name
      // Thanks to the shadowing mechanism in build_resolvers_recursive,
      // this resolver already represents the correct priority: local > imports > parent
      const resolver = resolvers.get(name);
      if (!resolver) {
        return null; // Symbol not found in this scope
      }

      // STEP 4: Execute resolver ON-DEMAND (only now!)
      // This is where the actual resolution happens - the closure executes
      // For local definitions: returns captured symbol_id immediately
      // For imports: triggers cross-file export chain resolution
      const symbol_id = resolver();

      // STEP 5: Store in cache for future lookups
      // All future references to this (scope_id, name) will hit cache
      // Only cache successful resolutions (null means symbol not found)
      if (symbol_id !== null) {
        cache.set(scope_id, name, symbol_id);
      }

      return symbol_id;
    },
  };
}
