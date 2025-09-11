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
  SymbolName,
  ModulePath,
  TypeInfo as PublicTypeInfo,
  VariableName,
  ImportInfo,
  ExportInfo,
  TypeKind,
} from "@ariadnejs/types";
import { TypeInfo } from "./type_tracking";
import {
  create_readonly_array,
  create_readonly_map,
} from "@ariadnejs/types";

/**
 * Convert internal ImportInfo to public ImportStatement
 */
export function convert_import_info_to_statement(
  import_info: ImportInfo,
  file_path: string
): ImportStatement {
  // Get the single symbol name
  const symbol_name: SymbolName | undefined =
    import_info.name && import_info.kind !== "namespace"
      ? (import_info.name as SymbolName)
      : undefined;

  // Handle namespace imports
  const is_namespace_import = import_info.kind === "namespace";
  const namespace_name = import_info.namespace_name;

  // Use the location from import info directly
  const location = import_info.location;

  return {
    source: import_info.source as ModulePath,
    symbol_name, // Changed from symbol_names array to single symbol_name
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
  // Get the single symbol name
  const symbol_name: SymbolName | undefined =
    export_info.name && export_info.kind !== "default"
      ? (export_info.name as SymbolName)
      : undefined;

  // Use the location from export info directly
  const location = export_info.location;

  return {
    symbol_name: symbol_name || ("" as SymbolName), // Provide default empty string
    location,
    is_default: export_info.kind === "default" || false,
    is_type_export: export_info.is_type_only || false,
    source: export_info.source as ModulePath,
    export_name: export_info.name as any || "",
  };
}

/**
 * Map internal type_kind to public TypeKind enum
 */
function map_type_kind(type_kind?: string): TypeKind {
  switch (type_kind) {
    case "class":
      return TypeKind.CLASS;
    case "interface":
      return TypeKind.INTERFACE;
    case "enum":
      return TypeKind.ENUM;
    case "trait":
      return TypeKind.TRAIT;
    default:
      // For primitive, object, function, array, unknown, or undefined
      return TypeKind.TYPE;
  }
}

/**
 * Convert array of internal TypeInfo to single public TypeInfo
 */
export function convert_type_info_array_to_single(
  types: TypeInfo[]
): PublicTypeInfo {
  if (types.length === 0) {
    return {
      type_name: "unknown" as any,
      type_kind: TypeKind.TYPE,
      location: {
        file_path: "" as any,
        line: 0,
        column: 0,
        end_line: 0,
        end_column: 0,
      },
      confidence: "assumed",
    };
  }

  // If single type, return it
  if (types.length === 1) {
    const type = types[0];
    return {
      type_name: (type.type_name || "unknown") as any,
      type_kind: map_type_kind(type.type_kind),
      location: type.location,
      confidence: type.confidence === "explicit" || type.confidence === "inferred" || type.confidence === "assumed" 
        ? type.confidence 
        : "assumed",
      source: type.source,
    };
  }

  // Multiple types - create union
  const unique_types = [...new Set(types.map((t) => t.type_name || "unknown"))];
  const union_type = unique_types.join(" | ");

  // Use first type's location as representative
  const first_type = types[0];

  return {
    type_name: union_type as any,
    type_kind: TypeKind.TYPE,
    location: first_type.location,
    confidence: "inferred",
  };
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
