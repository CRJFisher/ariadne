import type { TypeHierarchyGraph, LocalTypeDefinition } from "../types";
import type { TypeId, FilePath, SymbolId, SymbolName } from "@ariadnejs/types";
import { defined_type_id, TypeCategory } from "@ariadnejs/types";

/**
 * Create a TypeId from a local type definition
 */
function create_type_id(type_def: LocalTypeDefinition): TypeId {
  const category = kind_to_category(type_def.kind);
  return defined_type_id(category, type_def.name, type_def.location);
}

/**
 * Convert type kind to TypeCategory
 */
function kind_to_category(
  kind: "class" | "interface" | "type" | "enum"
): TypeCategory.CLASS | TypeCategory.INTERFACE | TypeCategory.TYPE_ALIAS | TypeCategory.ENUM {
  switch (kind) {
    case "class":
      return TypeCategory.CLASS;
    case "interface":
      return TypeCategory.INTERFACE;
    case "type":
      return TypeCategory.TYPE_ALIAS;
    case "enum":
      return TypeCategory.ENUM;
  }
}

/**
 * Resolve type inheritance chains
 */
export function resolve_inheritance(
  type_definitions: Map<FilePath, LocalTypeDefinition[]>,
  resolved_imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>
): TypeHierarchyGraph {
  const extends_map = new Map<TypeId, TypeId[]>();
  const implements_map = new Map<TypeId, TypeId[]>();
  const all_ancestors = new Map<TypeId, Set<TypeId>>();
  const all_descendants = new Map<TypeId, Set<TypeId>>();

  // First, build a name-to-TypeId registry for local resolution
  const type_names = new Map<FilePath, Map<SymbolName, TypeId>>();

  for (const [file_path, type_defs] of Array.from(type_definitions.entries())) {
    const file_types = new Map<SymbolName, TypeId>();
    for (const type_def of type_defs) {
      const type_id = create_type_id(type_def);
      file_types.set(type_def.name, type_id);
    }
    type_names.set(file_path, file_types);
  }

  // Phase 1: Build direct relationships
  for (const [file_path, type_defs] of Array.from(type_definitions.entries())) {
    for (const type_def of type_defs) {
      const type_id = create_type_id(type_def);

      // Resolve extends clause
      if (type_def.extends_names && type_def.extends_names.length > 0) {
        const parent_types = resolve_type_names(
          type_def.extends_names,
          file_path,
          type_names,
          resolved_imports
        );
        if (parent_types.length > 0) {
          extends_map.set(type_id, parent_types);
        }
      }

      // Resolve implements clause
      if (type_def.implements_names && type_def.implements_names.length > 0) {
        const interface_types = resolve_type_names(
          type_def.implements_names,
          file_path,
          type_names,
          resolved_imports
        );
        if (interface_types.length > 0) {
          implements_map.set(type_id, interface_types);
        }
      }
    }
  }

  // Phase 2: Compute transitive closures
  compute_transitive_closures(
    extends_map,
    implements_map,
    all_ancestors,
    all_descendants
  );

  return {
    extends_map,
    implements_map,
    all_ancestors,
    all_descendants,
  };
}

/**
 * Resolve type name references to TypeIds
 */
function resolve_type_names(
  names: SymbolName[],
  current_file: FilePath,
  type_names: Map<FilePath, Map<SymbolName, TypeId>>,
  resolved_imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>
): TypeId[] {
  const resolved: TypeId[] = [];

  for (const name of names) {
    // 1. Try local file first
    const local_type = type_names.get(current_file)?.get(name);
    if (local_type) {
      resolved.push(local_type);
      continue;
    }

    // 2. Try to resolve through imports
    const file_imports = resolved_imports.get(current_file);
    if (file_imports) {
      const imported_symbol = file_imports.get(name);
      if (imported_symbol) {
        // Find which file exports this symbol and convert to TypeId
        const type_id = resolve_imported_type(
          name,
          imported_symbol,
          type_names
        );
        if (type_id) {
          resolved.push(type_id);
        }
      }
    }
  }

  return resolved;
}

/**
 * Resolve an imported symbol to its TypeId
 */
function resolve_imported_type(
  type_name: SymbolName,
  symbol_id: SymbolId,
  type_names: Map<FilePath, Map<SymbolName, TypeId>>
): TypeId | undefined {
  // Extract file path from symbol_id (symbol_id format typically includes file context)
  // This is a simplified approach - in a full implementation, we'd need proper symbol tracking
  for (const [file_path, file_types] of Array.from(type_names.entries())) {
    const type_id = file_types.get(type_name);
    if (type_id && symbol_id.includes(file_path)) {
      return type_id;
    }
  }
  return undefined;
}

/**
 * Compute transitive closures for ancestors and descendants with cycle detection
 */
function compute_transitive_closures(
  extends_map: Map<TypeId, TypeId[]>,
  implements_map: Map<TypeId, TypeId[]>,
  all_ancestors: Map<TypeId, Set<TypeId>>,
  all_descendants: Map<TypeId, Set<TypeId>>
): void {
  // Initialize all types in the maps
  const all_types = new Set<TypeId>();
  for (const [type_id, parents] of Array.from(extends_map.entries())) {
    all_types.add(type_id);
    for (const parent of parents) {
      all_types.add(parent);
    }
  }
  for (const [type_id, interfaces] of Array.from(implements_map.entries())) {
    all_types.add(type_id);
    for (const iface of interfaces) {
      all_types.add(iface);
    }
  }

  // Compute ancestors for each type using DFS with cycle detection
  for (const type_id of Array.from(all_types.values())) {
    if (!all_ancestors.has(type_id)) {
      compute_ancestors_dfs(
        type_id,
        extends_map,
        implements_map,
        all_ancestors,
        new Set()
      );
    }
  }

  // Compute descendants (reverse of ancestors)
  for (const [descendant, ancestors] of Array.from(all_ancestors.entries())) {
    for (const ancestor of Array.from(ancestors.values())) {
      if (!all_descendants.has(ancestor)) {
        all_descendants.set(ancestor, new Set());
      }
      const descendantsSet = all_descendants.get(ancestor);
      if (descendantsSet) {
        descendantsSet.add(descendant);
      }
    }
  }
}

/**
 * Compute ancestors using DFS with circular inheritance detection
 */
function compute_ancestors_dfs(
  type_id: TypeId,
  extends_map: Map<TypeId, TypeId[]>,
  implements_map: Map<TypeId, TypeId[]>,
  all_ancestors: Map<TypeId, Set<TypeId>>,
  visiting: Set<TypeId>
): Set<TypeId> {
  // Check for circular inheritance
  if (visiting.has(type_id)) {
    console.warn(`Circular inheritance detected for ${type_id}`);
    return new Set();
  }

  // Return cached result if available
  if (all_ancestors.has(type_id)) {
    return all_ancestors.get(type_id)!;
  }

  visiting.add(type_id);
  const ancestors = new Set<TypeId>();

  // Process extends relationships
  const parents = extends_map.get(type_id) || [];
  for (const parent of parents) {
    ancestors.add(parent);
    const parent_ancestors = compute_ancestors_dfs(
      parent,
      extends_map,
      implements_map,
      all_ancestors,
      visiting
    );
    for (const ancestor of Array.from(parent_ancestors.values())) {
      ancestors.add(ancestor);
    }
  }

  // Process implements relationships
  const interfaces = implements_map.get(type_id) || [];
  for (const iface of interfaces) {
    ancestors.add(iface);
    const iface_ancestors = compute_ancestors_dfs(
      iface,
      extends_map,
      implements_map,
      all_ancestors,
      visiting
    );
    for (const ancestor of Array.from(iface_ancestors.values())) {
      ancestors.add(ancestor);
    }
  }

  visiting.delete(type_id);
  all_ancestors.set(type_id, ancestors);
  return ancestors;
}
