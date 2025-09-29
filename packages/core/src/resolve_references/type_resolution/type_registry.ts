/**
 * Type Registry - Global type information after cross-file resolution
 *
 * This module builds a complete type registry with resolved TypeIds
 * and inheritance relationships after imports have been resolved.
 */

import type {
  TypeId,
  SymbolId,
  Location,
  FilePath,
  SymbolName,
  ScopeId,
} from "@ariadnejs/types";
import {
  defined_type_id,
  TypeCategory,
} from "@ariadnejs/types";
import type {
  GlobalTypeRegistry,
  LocalTypeDefinition,
  ResolvedTypeDefinition,
  TypeHierarchyGraph,
  ResolvedMemberInfo,
  LocalMemberInfo,
} from "./types";

/**
 * Build the global type registry after imports are resolved
 *
 * This function performs cross-file type resolution in three phases:
 * 1. Create TypeIds for all type definitions
 * 2. Resolve inheritance relationships across files
 * 3. Build complete member maps including inherited members
 */
export function build_global_type_registry(
  local_types: Map<FilePath, LocalTypeDefinition[]>,
  resolved_imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>
): GlobalTypeRegistry {
  const types = new Map<TypeId, ResolvedTypeDefinition>();
  const type_names = new Map<FilePath, Map<SymbolName, TypeId>>();

  // Phase 1: Create TypeIds for all type definitions
  for (const [file_path, type_defs] of local_types) {
    for (const type_def of type_defs) {
      const type_id = create_type_id(type_def);

      // Create resolved type definition
      const resolved_type: ResolvedTypeDefinition = {
        type_id,
        name: type_def.name,
        kind: type_def.kind,
        definition_location: type_def.location,
        file_path,
        all_members: new Map(), // Will be populated in Phase 3
        base_types: [], // Will be resolved in Phase 2
        derived_types: [], // Will be populated in Phase 2
      };

      types.set(type_id, resolved_type);

      // Add to name mapping
      if (!type_names.has(file_path)) {
        type_names.set(file_path, new Map());
      }
      type_names.get(file_path)!.set(type_def.name, type_id);
    }
  }

  // Phase 2: Resolve inheritance relationships and trait implementations
  const hierarchy = resolve_type_hierarchy(
    local_types,
    types,
    type_names,
    resolved_imports
  );

  // Update base_types and derived_types in resolved definitions
  for (const [type_id, base_types] of hierarchy.extends_map) {
    const type_def = types.get(type_id);
    if (type_def) {
      type_def.base_types.push(...base_types);
    }
  }

  for (const [type_id, impl_types] of hierarchy.implements_map) {
    const type_def = types.get(type_id);
    if (type_def) {
      type_def.base_types.push(...impl_types);
    }
  }

  // Phase 2.5: Resolve trait implementations (Rust-specific)
  resolve_trait_implementations(types, local_types, type_names, resolved_imports);

  // Phase 3: Build complete member maps with inheritance
  resolve_all_members(types, local_types, hierarchy);

  return {
    types,
    type_names,
  };
}

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
function kind_to_category(kind: "class" | "interface" | "type" | "enum"): TypeCategory.CLASS | TypeCategory.INTERFACE | TypeCategory.TYPE_ALIAS | TypeCategory.ENUM {
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
 * Resolve type hierarchy relationships across files
 */
function resolve_type_hierarchy(
  local_types: Map<FilePath, LocalTypeDefinition[]>,
  resolved_types: Map<TypeId, ResolvedTypeDefinition>,
  type_names: Map<FilePath, Map<SymbolName, TypeId>>,
  resolved_imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>
): TypeHierarchyGraph {
  const extends_map = new Map<TypeId, TypeId[]>();
  const implements_map = new Map<TypeId, TypeId[]>();
  const all_ancestors = new Map<TypeId, Set<TypeId>>();
  const all_descendants = new Map<TypeId, Set<TypeId>>();

  // Process each type's inheritance clauses
  for (const [file_path, type_defs] of local_types) {
    for (const type_def of type_defs) {
      const type_id = type_names.get(file_path)?.get(type_def.name);
      if (!type_id) continue;

      // Resolve extends clause
      if (type_def.extends_names) {
        const base_types: TypeId[] = [];
        for (const base_name of type_def.extends_names) {
          const base_type_id = resolve_type_reference(
            base_name,
            file_path,
            type_names,
            resolved_imports
          );
          if (base_type_id) {
            base_types.push(base_type_id);
          }
        }
        if (base_types.length > 0) {
          extends_map.set(type_id, base_types);
        }
      }

      // Resolve implements clause
      if (type_def.implements_names) {
        const impl_types: TypeId[] = [];
        for (const impl_name of type_def.implements_names) {
          const impl_type_id = resolve_type_reference(
            impl_name,
            file_path,
            type_names,
            resolved_imports
          );
          if (impl_type_id) {
            impl_types.push(impl_type_id);
          }
        }
        if (impl_types.length > 0) {
          implements_map.set(type_id, impl_types);
        }
      }
    }
  }

  // Build transitive closures
  build_transitive_closures(
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
 * Resolve a type name reference to a TypeId
 */
function resolve_type_reference(
  type_name: SymbolName,
  file_path: FilePath,
  type_names: Map<FilePath, Map<SymbolName, TypeId>>,
  resolved_imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>
): TypeId | undefined {
  // First check local file
  const local_type_id = type_names.get(file_path)?.get(type_name);
  if (local_type_id) {
    return local_type_id;
  }

  // Check imports - resolved_imports maps imported names to symbol IDs
  const file_imports = resolved_imports.get(file_path);
  if (file_imports) {
    const imported_symbol = file_imports.get(type_name);
    if (imported_symbol) {
      // The imported symbol should correspond to a type
      // We need to find which file defines this symbol and get its TypeId
      // For now, we'll return undefined as we need more context
      // This would require tracking symbol_id to type_id mappings
    }
  }

  return undefined;
}

/**
 * Build transitive closures for type hierarchy
 */
function build_transitive_closures(
  extends_map: Map<TypeId, TypeId[]>,
  implements_map: Map<TypeId, TypeId[]>,
  all_ancestors: Map<TypeId, Set<TypeId>>,
  all_descendants: Map<TypeId, Set<TypeId>>
): void {
  // Initialize with direct relationships
  for (const [type_id, base_types] of extends_map) {
    if (!all_ancestors.has(type_id)) {
      all_ancestors.set(type_id, new Set());
    }
    for (const base_type of base_types) {
      all_ancestors.get(type_id)!.add(base_type);
      if (!all_descendants.has(base_type)) {
        all_descendants.set(base_type, new Set());
      }
      all_descendants.get(base_type)!.add(type_id);
    }
  }

  for (const [type_id, impl_types] of implements_map) {
    if (!all_ancestors.has(type_id)) {
      all_ancestors.set(type_id, new Set());
    }
    for (const impl_type of impl_types) {
      all_ancestors.get(type_id)!.add(impl_type);
      if (!all_descendants.has(impl_type)) {
        all_descendants.set(impl_type, new Set());
      }
      all_descendants.get(impl_type)!.add(type_id);
    }
  }

  // Compute transitive closure using Floyd-Warshall approach
  const all_types = new Set<TypeId>([...all_ancestors.keys(), ...all_descendants.keys()]);

  for (const intermediate of all_types) {
    for (const source of all_types) {
      for (const target of all_types) {
        const source_ancestors = all_ancestors.get(source);
        const intermediate_ancestors = all_ancestors.get(intermediate);
        const target_ancestors = all_ancestors.get(target);

        if (source_ancestors?.has(intermediate) && intermediate_ancestors?.has(target)) {
          source_ancestors.add(target);
        }
      }
    }
  }
}

/**
 * Resolve all members including inherited ones
 */
function resolve_all_members(
  resolved_types: Map<TypeId, ResolvedTypeDefinition>,
  local_types: Map<FilePath, LocalTypeDefinition[]>,
  hierarchy: TypeHierarchyGraph
): void {
  // First, add direct members to each type
  for (const [file_path, type_defs] of local_types) {
    for (const type_def of type_defs) {
      const type_id = create_type_id(type_def);
      const resolved_type = resolved_types.get(type_id);
      if (!resolved_type) continue;

      // Add direct members
      for (const [member_name, member_info] of type_def.direct_members) {
        const resolved_member: ResolvedMemberInfo = {
          symbol_id: `${type_id}.${member_name}` as SymbolId,
          name: member_name,
          kind: member_info.kind,
          location: member_info.location,
          is_static: member_info.is_static,
          is_optional: member_info.is_optional,
          type_id: undefined, // Will be resolved in later phase
          inherited_from: undefined, // Direct member
        };
        resolved_type.all_members.set(member_name, resolved_member);
      }
    }
  }

  // Then, add inherited members
  for (const [type_id, resolved_type] of resolved_types) {
    const ancestors = hierarchy.all_ancestors.get(type_id);
    if (!ancestors) continue;

    for (const ancestor_id of ancestors) {
      const ancestor_type = resolved_types.get(ancestor_id);
      if (!ancestor_type) continue;

      // Inherit members that aren't already defined
      for (const [member_name, member_info] of ancestor_type.all_members) {
        if (!resolved_type.all_members.has(member_name)) {
          const inherited_member: ResolvedMemberInfo = {
            ...member_info,
            inherited_from: ancestor_id,
          };
          resolved_type.all_members.set(member_name, inherited_member);
        }
      }
    }
  }
}

/**
 * Resolve trait implementations for Rust types
 */
function resolve_trait_implementations(
  resolved_types: Map<TypeId, ResolvedTypeDefinition>,
  local_types: Map<FilePath, LocalTypeDefinition[]>,
  type_names: Map<FilePath, Map<SymbolName, TypeId>>,
  resolved_imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>
): void {
  // This function processes Rust trait implementations
  // It looks for types with trait bounds and associated types

  for (const [file_path, type_defs] of local_types) {
    for (const type_def of type_defs) {
      const type_id = create_type_id(type_def);
      const resolved_type = resolved_types.get(type_id);
      if (!resolved_type) continue;

      // Handle Rust-specific trait features
      if (type_def.is_generic && type_def.type_parameters) {
        // Add type parameter information to the resolved type
        resolved_type.is_generic = true;
        resolved_type.type_parameters = type_def.type_parameters.map(param => ({
          name: param.name,
          location: param.location,
          bounds: param.bounds?.map(bound => ({
            type_name: bound.type_name,
            constraint_kind: bound.constraint_kind,
            bound_types: [], // Would be resolved with proper trait resolution
            bound_names: bound.bound_names,
            location: bound.location,
          })),
          default_type: undefined, // Would be resolved to TypeId
        }));
      }

      if (type_def.where_constraints) {
        // Add where clause constraints
        resolved_type.where_constraints = type_def.where_constraints.map(constraint => ({
          type_name: constraint.type_name,
          constraint_kind: constraint.constraint_kind,
          bound_types: [], // Would be resolved with proper trait resolution
          bound_names: constraint.bound_names,
          location: constraint.location,
        }));
      }

      if (type_def.lifetime_parameters) {
        // Add lifetime parameters
        resolved_type.lifetime_parameters = type_def.lifetime_parameters.map(lifetime => ({
          name: lifetime.name,
          location: lifetime.location,
          bounds: lifetime.bounds,
        }));
      }
    }
  }
}

/**
 * Build type registry from local type definitions (simplified version for backward compat)
 */
export function build_type_registry(
  type_definitions: Map<FilePath, LocalTypeDefinition[]>
): GlobalTypeRegistry {
  // For now, build without import resolution
  const empty_imports = new Map<FilePath, Map<SymbolName, SymbolId>>();

  return build_global_type_registry(type_definitions, empty_imports);
}