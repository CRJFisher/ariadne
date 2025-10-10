/**
 * Derived Data - Indexed structures computed from SemanticIndex
 *
 * This module provides derived indexing structures that enable fast lookups.
 * These structures are computed from the raw parsing output (definitions, references, scopes)
 * contained in SemanticIndex.
 */

import type {
  FilePath,
  ScopeId,
  SymbolId,
  SymbolName,
  SymbolKind,
  LocationKey,
  AnyDefinition,
  ExportableDefinition,
  TypeMemberInfo,
} from "@ariadnejs/types";
import type { SemanticIndex } from "./semantic_index";
import {
  extract_type_bindings,
  extract_constructor_bindings,
  extract_type_members,
  extract_type_alias_metadata,
} from "./type_preprocessing";

/**
 * Derived indexing structures computed from SemanticIndex.
 * These structures enable fast lookups but are derived from the
 * raw parsing output (definitions, references, scopes).
 */
export interface DerivedData {
  /** The file this data was derived from */
  readonly file_path: FilePath;

  /** Scope → kind → definitions in that scope */
  readonly scope_to_definitions: ReadonlyMap<
    ScopeId,
    ReadonlyMap<SymbolKind, AnyDefinition[]>
  >;

  /** Export name → exported definition */
  readonly exported_symbols: ReadonlyMap<SymbolName, ExportableDefinition>;

  /** Location → type name (from annotations, constructors, return types) */
  readonly type_bindings: ReadonlyMap<LocationKey, SymbolName>;

  /** Type SymbolId → member info (methods, properties, constructor, extends) */
  readonly type_members: ReadonlyMap<SymbolId, TypeMemberInfo>;

  /** Type alias SymbolId → type expression string */
  readonly type_alias_metadata: ReadonlyMap<SymbolId, string>;
}

/**
 * Build derived indexing structures from a SemanticIndex.
 *
 * This function extracts and indexes:
 * - Scope → definition mapping for fast lookup by scope
 * - Export name → definition mapping for import resolution
 * - Type bindings from definitions and references
 * - Type members from class/interface/enum definitions
 * - Type alias metadata
 *
 * @param semantic_index - The raw parsing output
 * @returns Indexed structures for fast lookups
 */
export function build_derived_data(
  semantic_index: SemanticIndex
): DerivedData {
  // Build scope_to_definitions map
  const scope_to_definitions = build_scope_to_definitions_map({
    functions: semantic_index.functions,
    classes: semantic_index.classes,
    variables: semantic_index.variables,
    interfaces: semantic_index.interfaces,
    enums: semantic_index.enums,
    namespaces: semantic_index.namespaces,
    types: semantic_index.types,
    imports: semantic_index.imported_symbols,
  });

  // Build exported_symbols map
  const exported_symbols = build_exported_symbols_map({
    functions: semantic_index.functions,
    classes: semantic_index.classes,
    variables: semantic_index.variables,
    interfaces: semantic_index.interfaces,
    enums: semantic_index.enums,
    namespaces: semantic_index.namespaces,
    types: semantic_index.types,
    imports: semantic_index.imported_symbols,
  });

  // Extract type bindings from definitions
  const type_bindings_from_defs = extract_type_bindings({
    variables: semantic_index.variables,
    functions: semantic_index.functions,
    classes: semantic_index.classes,
    interfaces: semantic_index.interfaces,
  });

  // Extract type bindings from constructor calls
  const type_bindings_from_ctors = extract_constructor_bindings(
    semantic_index.references
  );

  // Merge type bindings from definitions and constructors
  const type_bindings = new Map([
    ...type_bindings_from_defs,
    ...type_bindings_from_ctors,
  ]);

  // Extract type members from classes, interfaces, enums
  const type_members = extract_type_members({
    classes: semantic_index.classes,
    interfaces: semantic_index.interfaces,
    enums: semantic_index.enums,
  });

  // Extract type alias metadata
  const type_alias_metadata = extract_type_alias_metadata(semantic_index.types);

  return {
    file_path: semantic_index.file_path,
    scope_to_definitions,
    exported_symbols,
    type_bindings,
    type_members,
    type_alias_metadata,
  };
}

/**
 * Build scope → definitions mapping from all definitions.
 * Mimics the logic from semantic_index.ts build_scope_to_definitions()
 */
function build_scope_to_definitions_map(definitions: {
  functions: ReadonlyMap<SymbolId, any>;
  classes: ReadonlyMap<SymbolId, any>;
  variables: ReadonlyMap<SymbolId, any>;
  interfaces: ReadonlyMap<SymbolId, any>;
  enums: ReadonlyMap<SymbolId, any>;
  namespaces: ReadonlyMap<SymbolId, any>;
  types: ReadonlyMap<SymbolId, any>;
  imports: ReadonlyMap<SymbolId, any>;
}): Map<ScopeId, Map<SymbolKind, AnyDefinition[]>> {
  const index = new Map<ScopeId, Map<SymbolKind, AnyDefinition[]>>();

  const add_to_index = (def: AnyDefinition) => {
    // Re-exports don't create local bindings - exclude them from scope_to_definitions.
    // Re-exports are ImportDefinitions with export.is_reexport === true.
    if (def.kind === "import" && def.export?.is_reexport) {
      return;
    }

    // Ensure scope map exists
    if (!index.has(def.defining_scope_id)) {
      index.set(def.defining_scope_id, new Map());
    }

    const scope_map = index.get(def.defining_scope_id)!;
    const existing = scope_map.get(def.kind) || [];
    existing.push(def);
    scope_map.set(def.kind, existing);
  };

  // Add all definition types
  definitions.functions.forEach((def) => add_to_index(def));
  definitions.classes.forEach((def) => add_to_index(def));
  definitions.variables.forEach((def) => add_to_index(def));
  definitions.interfaces.forEach((def) => add_to_index(def));
  definitions.enums.forEach((def) => add_to_index(def));
  definitions.namespaces.forEach((def) => add_to_index(def));
  definitions.types.forEach((def) => add_to_index(def));
  definitions.imports.forEach((def) => add_to_index(def));

  return index;
}

/**
 * Build export name → definition mapping from all definitions.
 * Mimics the logic from semantic_index.ts build_exported_symbols_map()
 *
 * IMPORTANT: Asserts that export names are unique within a file.
 */
function build_exported_symbols_map(definitions: {
  functions: ReadonlyMap<SymbolId, any>;
  classes: ReadonlyMap<SymbolId, any>;
  variables: ReadonlyMap<SymbolId, any>;
  interfaces: ReadonlyMap<SymbolId, any>;
  enums: ReadonlyMap<SymbolId, any>;
  namespaces: ReadonlyMap<SymbolId, any>;
  types: ReadonlyMap<SymbolId, any>;
  imports: ReadonlyMap<SymbolId, any>;
}): Map<SymbolName, ExportableDefinition> {
  const map = new Map<SymbolName, ExportableDefinition>();

  const add_to_map = (def: ExportableDefinition) => {
    // ImportDefinitions don't have is_exported - check export field directly
    if (def.kind === "import") {
      if (!def.export) {
        return;
      }
    } else {
      // Only add exported symbols
      if (!def.is_exported) {
        return;
      }
    }

    // Get the effective export name (alias or original name)
    const export_name = def.export?.export_name || def.name;

    // Check for duplicates - this should never happen
    const existing = map.get(export_name);
    if (existing) {
      throw new Error(
        `Duplicate export name "${export_name}" in file.\n` +
          `  First:  ${existing.kind} ${existing.symbol_id}\n` +
          `  Second: ${def.kind} ${def.symbol_id}\n` +
          `This indicates a bug in is_exported logic or malformed source code.`
      );
    }

    map.set(export_name, def);
  };

  // Add all exportable definition types
  definitions.functions.forEach(add_to_map);
  definitions.classes.forEach(add_to_map);
  definitions.variables.forEach(add_to_map);
  definitions.interfaces.forEach(add_to_map);
  definitions.enums.forEach(add_to_map);
  definitions.namespaces.forEach(add_to_map);
  definitions.types.forEach(add_to_map);

  // Add re-exports (imports with export metadata)
  definitions.imports.forEach((imp: any) => {
    if (imp.export) {
      const export_name = imp.export.export_name || imp.name;
      const existing = map.get(export_name);
      if (existing) {
        throw new Error(
          `Duplicate export name "${export_name}" in file.\n` +
            `  First:  ${existing.kind} ${existing.symbol_id}\n` +
            `  Second: ${imp.kind} ${imp.symbol_id}\n` +
            `This indicates a bug in re-export logic or malformed source code.`
        );
      }
      map.set(export_name, imp as any);
    }
  });

  return map;
}
