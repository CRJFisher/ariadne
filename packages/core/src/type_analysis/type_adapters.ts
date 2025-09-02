/**
 * Type Adapters for Public API Compatibility
 *
 * Converts between internal implementation types and public API types
 * defined in @ariadnejs/types package.
 */

import {
  ImportStatement,
  ExportStatement,
  Location,
  VariableDeclaration,
  AnalysisError,
  SymbolName,
  ModulePath,
  FilePath,
  TypeInfo as PublicTypeInfo,
  VariableName,
  ImportInfo,
  ExportInfo,
} from "@ariadnejs/types";
import { TypeInfo } from "./type_tracking";

/**
 * Convert internal ImportInfo to public ImportStatement
 */
export function convert_import_info_to_statement(
  import_info: ImportInfo,
  file_path: string
): ImportStatement {
  // Build symbols array from imported items
  const symbols: SymbolName[] = [];

  if (import_info.name && import_info.kind !== "namespace") {
    symbols.push(import_info.name);
  }

  // Handle namespace imports
  const is_namespace_import = import_info.kind === "namespace";
  const namespace_name = import_info.namespace_name;

  // Use the location from import info directly
  const location = import_info.location;

  return {
    source: import_info.source as ModulePath,
    symbol_names: symbols,
    location,
    is_type_import: import_info.is_type_only,
    is_namespace_import,
    namespace_name,
  };
}

/**
 * Convert internal ExportInfo to public ExportStatement
 */
export function convert_export_info_to_statement(
  export_info: ExportInfo
): ExportStatement {
  // Build symbols array
  const symbol_names: SymbolName[] = [];

  if (export_info.name && export_info.kind !== "default") {
    symbol_names.push(export_info.name);
  }

  // Use the location from export info directly
  const location = export_info.location;

  return {
    symbol_names,
    location,
    is_default: export_info.kind === "default",
    is_type_export: export_info.is_type_only,
    source: export_info.source as ModulePath,
  };
}

/**
 * Convert array of internal TypeInfo to single public TypeInfo
 */
export function convert_type_info_array_to_single(
  types: TypeInfo[]
): PublicTypeInfo {
  if (types.length === 0) {
    return {
      type: "unknown",
      nullable: false,
      is_collection: false,
    };
  }

  // If single type, return it
  if (types.length === 1) {
    const type = types[0];
    return {
      type: type.type || "unknown",
      nullable: type.nullable || false,
      is_collection: type.is_collection || false,
      element_type: type.element_type,
      type_parameters: type.type_parameters,
    };
  }

  // Multiple types - create union
  const unique_types = [...new Set(types.map((t) => t.type || "unknown"))];
  const union_type = unique_types.join(" | ");

  return {
    type: union_type,
    nullable: types.some((t) => t.nullable || false),
    is_collection: types.some((t) => t.is_collection || false),
  };
}

/**
 * Create a readonly map from a mutable map
 */
export function create_readonly_map<K, V>(map: Map<K, V>): ReadonlyMap<K, V> {
  // Maps are already compatible, just need type assertion
  return map as ReadonlyMap<K, V>;
}

/**
 * Create a readonly array from a mutable array
 */
export function create_readonly_array<T>(array: T[]): readonly T[] {
  return Object.freeze(array);
}

/**
 * Convert internal type map to public type map
 */
export function convert_type_map_to_public(
  type_map: Map<string, TypeInfo[]>
): ReadonlyMap<VariableName, PublicTypeInfo> {
  const public_map = new Map<VariableName, PublicTypeInfo>();

  for (const [variable, types] of type_map) {
    public_map.set(
      variable as VariableName,
      convert_type_info_array_to_single(types)
    );
  }

  return create_readonly_map(public_map);
}

/**
 * Create Location from ScopeRange
 */
export function create_location_from_range(
  range: ScopeRange,
  file_path: string
): Location {
  return {
    file_path: file_path as FilePath,
    line: range.start.row,
    column: range.start.column,
    end_line: range.end.row,
    end_column: range.end.column,
  };
}

/**
 * Create empty variable declarations array
 * TODO: Implement actual extraction
 */
export function create_empty_variables(): readonly VariableDeclaration[] {
  return create_readonly_array<VariableDeclaration>([]);
}

/**
 * Create empty analysis errors array
 * TODO: Implement actual error collection
 */
export function create_empty_errors(): readonly AnalysisError[] {
  return create_readonly_array<AnalysisError>([]);
}

/**
 * Convert imports array to import statements
 */
export function convert_imports_to_statements(
  imports: ImportInfo[],
  file_path: string
): readonly ImportStatement[] {
  const statements = imports.map((imp) =>
    convert_import_info_to_statement(imp, file_path)
  );
  return create_readonly_array(statements);
}

/**
 * Convert exports array to export statements
 */
export function convert_exports_to_statements(
  exports: readonly ExportInfo[]
): readonly ExportStatement[] {
  const statements = exports.map((exp) =>
    convert_export_info_to_statement(exp)
  );
  return create_readonly_array(statements);
}
