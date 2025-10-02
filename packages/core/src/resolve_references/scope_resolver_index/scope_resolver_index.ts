/**
 * Scope Resolver Index
 *
 * Maps each scope to its available symbol resolvers.
 * Resolvers are lazy - they only execute when a symbol is referenced.
 */

import type { FilePath, SymbolId, SymbolName, ScopeId } from "@ariadnejs/types";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type { SymbolResolver, ImportSpec } from "../types";

/**
 * Resolution Cache Interface
 * (Will be implemented in task 11.109.2)
 */
export interface ResolutionCache {
  get(scope_id: ScopeId, name: SymbolName): SymbolId | undefined;
  set(scope_id: ScopeId, name: SymbolName, symbol_id: SymbolId): void;
}

/**
 * Scope Resolver Index
 *
 * Maps each scope to its available symbol resolvers.
 * Resolvers are lazy - they only execute when a symbol is referenced.
 */
export interface ScopeResolverIndex {
  /**
   * Resolve a symbol name in a scope (with caching)
   * This encapsulates cache checking and resolver execution
   */
  resolve(
    scope_id: ScopeId,
    name: SymbolName,
    cache: ResolutionCache
  ): SymbolId | null;
}

/**
 * Build resolver index for all scopes across all files
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
 * Returns map of scope_id -> resolver map
 */
function build_resolvers_recursive(
  scope_id: ScopeId,
  parent_resolvers: ReadonlyMap<SymbolName, SymbolResolver>,
  index: SemanticIndex,
  file_path: FilePath,
  indices: ReadonlyMap<FilePath, SemanticIndex>
): Map<ScopeId, Map<SymbolName, SymbolResolver>> {
  const result = new Map<ScopeId, Map<SymbolName, SymbolResolver>>();
  const resolvers = new Map<SymbolName, SymbolResolver>();

  const scope = index.scopes.get(scope_id)!;

  // Step 1: Inherit parent resolvers (copy references - cheap!)
  for (const [name, resolver] of parent_resolvers) {
    resolvers.set(name, resolver);
  }

  // Step 2: Add import resolvers for this scope (any scope level!)
  const import_specs = extract_import_specs(scope_id, index, file_path);

  for (const spec of import_specs) {
    // Closure captures import spec and resolves lazily
    resolvers.set(spec.local_name, () =>
      resolve_export_chain(spec.source_file, spec.import_name, indices)
    );
  }

  // Step 3: Add local definition resolvers (OVERRIDES parent/imports!)
  const local_defs = find_local_definitions(scope_id, index);

  for (const [name, symbol_id] of local_defs) {
    // Closure captures the local symbol_id
    // This naturally implements shadowing!
    resolvers.set(name, () => symbol_id);
  }

  // Special case: For function expression nodes or block scopes,
  // also collect definitions from sibling function name scopes
  // This handles the case where semantic index creates sibling scopes for function name and body
  if (scope.type === 'function' || scope.type === 'block') {
    // Get parent scope
    const parent_scope = scope.parent_id ? index.scopes.get(scope.parent_id) : null;
    if (parent_scope) {
      // Check if parent has any function children (sibling scopes)
      for (const sibling_id of parent_scope.child_ids) {
        if (sibling_id !== scope_id) {  // Don't process ourself
          const sibling_scope = index.scopes.get(sibling_id);
          if (sibling_scope && sibling_scope.type === 'function') {
            const sibling_defs = find_local_definitions(sibling_id, index);
            for (const [name, symbol_id] of sibling_defs) {
              if (!resolvers.has(name)) {  // Don't override existing resolvers
                resolvers.set(name, () => symbol_id);
              }
            }
          }
        }
      }
    }
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
 */
function find_local_definitions(
  scope_id: ScopeId,
  index: SemanticIndex
): Map<SymbolName, SymbolId> {
  const defs = new Map<SymbolName, SymbolId>();

  // Functions
  for (const [func_id, func_def] of index.functions) {
    if (func_def.scope_id === scope_id) {
      defs.set(func_def.name, func_id);
    }
  }

  // Variables
  for (const [var_id, var_def] of index.variables) {
    if (var_def.scope_id === scope_id) {
      defs.set(var_def.name, var_id);
    }
  }

  // Classes
  for (const [class_id, class_def] of index.classes) {
    if (class_def.scope_id === scope_id) {
      defs.set(class_def.name, class_id);
    }
  }

  // Interfaces
  for (const [iface_id, iface_def] of index.interfaces) {
    if (iface_def.scope_id === scope_id) {
      defs.set(iface_def.name, iface_id);
    }
  }

  return defs;
}

/**
 * Create ScopeResolverIndex implementation
 */
function create_resolver_index(
  scope_resolvers: Map<ScopeId, Map<SymbolName, SymbolResolver>>
): ScopeResolverIndex {
  return {
    resolve(
      scope_id: ScopeId,
      name: SymbolName,
      cache: ResolutionCache
    ): SymbolId | null {
      // Check cache first - O(1)
      const cached = cache.get(scope_id, name);
      if (cached !== undefined) {
        return cached;
      }

      // Get resolver function
      const resolvers = scope_resolvers.get(scope_id);
      if (!resolvers) {
        return null;
      }

      const resolver = resolvers.get(name);
      if (!resolver) {
        return null;
      }

      // Call resolver ON-DEMAND (only now!)
      const symbol_id = resolver();

      // Store in cache for future lookups
      if (symbol_id !== null) {
        cache.set(scope_id, name, symbol_id);
      }

      return symbol_id;
    },
  };
}

/**
 * Extract import specifications from a scope's import statements.
 * Used when building resolver functions.
 *
 * TODO: This will be moved to import_resolver.ts in task 11.109.3
 */
function extract_import_specs(
  scope_id: ScopeId,
  index: SemanticIndex,
  file_path: FilePath
): ImportSpec[] {
  const specs: ImportSpec[] = [];

  // Find all imports in this scope
  for (const [import_id, import_def] of index.imported_symbols) {
    if (import_def.scope_id === scope_id) {
      // Create import spec
      // Note: source file resolution will be implemented in task 11.109.3
      specs.push({
        local_name: import_def.name,
        source_file: import_def.import_path as unknown as FilePath, // Simplified for now - proper conversion in 11.109.3
        import_name: import_def.original_name || import_def.name,
        import_kind: import_def.import_kind,
      });
    }
  }

  return specs;
}

/**
 * Resolve export chain to find the actual symbol being imported.
 * Follows re-exports until finding the actual definition.
 *
 * TODO: This will be moved to import_resolver.ts in task 11.109.3
 */
function resolve_export_chain(
  source_file: FilePath,
  import_name: SymbolName,
  indices: ReadonlyMap<FilePath, SemanticIndex>
): SymbolId | null {
  const index = indices.get(source_file);
  if (!index) {
    return null;
  }

  // Look for the symbol in the source file
  const symbols = index.symbols_by_name.get(import_name);
  if (!symbols || symbols.length === 0) {
    return null;
  }

  // Return the first matching symbol
  // TODO: Implement proper export chain resolution in task 11.109.3
  return symbols[0];
}
